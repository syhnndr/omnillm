import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore, retrieveApiKey } from '../../store';
import { ChatMessage, ChatSession, BackendChatRequest, BackendLLMResponse } from '../../types';
import ChatMessageBubble from '../../components/ChatMessage';

function sanitizeError(err: string): string {
  if (!err) return 'Unknown error';
  if (err.includes('<!DOCTYPE') || err.includes('<html')) {
    return 'Provider Error: The AI service returned an invalid response (404/500). Please check your API config or credentials.';
  }
  if (err.length > 200) {
    return err.substring(0, 200) + '...';
  }
  return err;
}

function buildHistory(session: ChatSession): { role: 'user' | 'assistant'; content: string }[] {
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const msg of session.messages) {
    // Include user messages and fully resolved assistant messages (skip loading/errored ones)
    if (msg.role === 'user') {
      history.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' && !msg.loading && !msg.error && msg.content) {
      history.push({ role: 'assistant', content: msg.content });
    }
  }
  return history;
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const sessions = useStore((s) => s.sessions);
  const addMessage = useStore((s) => s.addMessage);
  const updateMessage = useStore((s) => s.updateMessage);
  const backendUrl = useStore((s) => s.backendUrl);

  const session = sessions.find((s) => s.id === id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeStatus, setActiveStatus] = useState<{ name: string; status: string; error?: string } | null>(null);
  const [modError, setModError] = useState<{ type: 'key' | 'runtime'; message: string } | null>(null);
  const listRef = useRef<FlatList>(null);

  // Set screen title
  useEffect(() => {
    if (session) {
      navigation.setOptions({ title: session.name });
    }
  }, [session?.name]);

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Session not found.</Text>
      </View>
    );
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !session) return;
    setInput('');
    setSending(true);
    // Start with sequencing
    setActiveStatus({ name: 'Moderator', status: 'sequencing' });

    // Add user message
    const userMsgId = `msg_${Date.now()}_user`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(id!, userMsg);

    // Scroll to bottom
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    // Build request — fetch API keys from SecureStore right before sending
    const history = buildHistory(session);

    try {
      setModError(null); // Reset moderator error state

      // 1. Fetch Experts API Keys
      const llmConfigs = await Promise.all(
        session.llms.map(async (l) => {
          const apiKey = await retrieveApiKey(l.savedLLMId);
          if (!apiKey) throw new Error(`API Key missing for expert: ${l.displayName}`);
          return {
            savedLLMId: l.savedLLMId,
            provider: l.provider,
            model: l.model,
            apiKey,
            systemPrompt: l.systemPrompt,
            role: l.role,
            displayName: l.displayName,
            ...(l.baseUrl ? { baseUrl: l.baseUrl } : {}),
          };
        })
      );

      // 2. Fetch Moderator API Key (CRITICAL: If session has a moderator, it MUST have a key)
      let moderatorConfig = undefined;
      if (session.moderator) {
        const apiKey = await retrieveApiKey(session.moderator.savedLLMId);
        if (!apiKey) {
          const errorMsg = "Missing API Key for the Moderator. The Council cannot convene without its leader. Please check your API settings.";
          setModError({ type: 'key', message: errorMsg });
          
          // Add a system bubble and STOP
          addMessage(id!, {
            id: `msg_err_${Date.now()}`,
            role: 'assistant',
            content: `🛑 ${errorMsg}`,
            llmDisplayName: 'System',
            llmColor: '#ef4444',
            timestamp: Date.now(),
          });
          setSending(false);
          setActiveStatus(null);
          return; // STOP HERE
        }
        
        moderatorConfig = {
          savedLLMId: session.moderator.savedLLMId,
          provider: session.moderator.provider,
          model: session.moderator.model,
          apiKey,
          systemPrompt: session.moderator.systemPrompt,
          role: session.moderator.role,
          displayName: session.moderator.displayName,
          ...(session.moderator.baseUrl ? { baseUrl: session.moderator.baseUrl } : {}),
        };
      }

      const requestBody: BackendChatRequest = {
        message: text,
        history,
        llms: llmConfigs,
        moderator: moderatorConfig,
      };

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${backendUrl}/chat`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      let lastProcessedLength = 0;

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const newText = xhr.responseText.substring(lastProcessedLength);
          const lines = newText.split('\n');
          
          if (xhr.readyState === 3 && lines.length > 0) {
             const lastLine = lines.pop();
             lastProcessedLength += (newText.length - (lastLine?.length || 0));
          } else {
             lastProcessedLength = xhr.responseText.length;
          }

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'status') {
                setActiveStatus({ name: data.name, status: data.status });
              } else {
                setActiveStatus(null);
                
                const cleanError = data.error ? sanitizeError(data.error) : null;

                // FATAL MODERATOR ERROR: If the orchestrator fails at any point, stop EVERYTHING immediately.
                if (data.role === 'Moderator' && data.error) {
                  xhr.abort(); // KILL THE STREAM IMMEDIATELY
                  
                  const cleanDetails = sanitizeError(data.error);
                  setModError({ type: 'runtime', message: cleanDetails });
                  
                  // Add a single, clean system bubble explaining the failure. NO TECHNICAL LOGS in the bubble.
                  const errorMsgId = `msg_err_${Date.now()}`;
                  addMessage(id!, {
                    id: errorMsgId,
                    role: 'assistant',
                    content: `🛑 Council Assembly Blocked\n\nThe Moderator (Orchestrator) is encountering an issue and cannot lead the council. Please check your API/Model settings in the top banner.`,
                    llmDisplayName: 'System',
                    llmRole: 'Moderator',
                    llmColor: '#ef4444',
                    timestamp: Date.now(),
                  });

                  setSending(false);
                  setActiveStatus(null);
                  return; // EXIT - DO NOT process any more lines or experts
                }

                const msgId = `msg_${Date.now()}_${data.savedLLMId}`;
                const participant = session.llms.find(l => l.savedLLMId === data.savedLLMId) 
                  || (session.moderator?.savedLLMId === data.savedLLMId ? session.moderator : null);

                const newMsg: ChatMessage = {
                  id: msgId,
                  role: 'assistant',
                  content: cleanError ? `Error Details: ${cleanError}` : data.content,
                  llmDisplayName: data.displayName,
                  llmProvider: data.provider as any,
                  llmRole: data.role,
                  llmColor: participant?.color,
                  loading: false,
                  error: data.error,
                  timestamp: Date.now(),
                };
                addMessage(id!, newMsg);
              }
              setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
            } catch (e) { }
          }
        }

        if (xhr.readyState === 4) {
          setSending(false);
          setActiveStatus(null);
        }
      };

      xhr.onerror = () => {
        setSending(false);
        setActiveStatus(null);
      };

      xhr.send(JSON.stringify(requestBody));
    } catch (err) {
      console.error('handleSend prepare error:', err);
      setSending(false);
    }
  }

  const messages = session.messages;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {modError && (
        <View style={[
          styles.warningBanner, 
          modError.type === 'runtime' && { backgroundColor: '#450a0a', borderColor: '#ef4444' }
        ]}>
          <Ionicons 
            name={modError.type === 'runtime' ? "flash" : "warning"} 
            size={16} 
            color={modError.type === 'runtime' ? "#ef4444" : "#f59e0b"} 
          />
          <Text style={[styles.warningText, modError.type === 'runtime' && { color: '#ef4444' }]}>
            {modError.message}
          </Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        ListFooterComponent={
          activeStatus ? (
            <View style={styles.thinkingContainer}>
              <ActivityIndicator size="small" color="#10a37f" />
              <Text style={styles.thinkingText}>
                {activeStatus.name}{' '}
                {activeStatus.status === 'synthesizing'
                  ? 'is synthesizing result...'
                  : activeStatus.status === 'sequencing'
                  ? 'is deciding sequence...'
                  : 'is thinking...'}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={48} color="#262626" />
            <Text style={styles.emptyChatText}>Send a message to start the council debate</Text>
          </View>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Message all LLMs…"
          placeholderTextColor="#525252"
          multiline
          maxLength={4000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="send" size={20} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  errorText: { color: '#ef4444', fontSize: 16 },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 15,
    marginHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#262626',
    alignSelf: 'flex-start',
  },
  thinkingText: {
    color: '#a3a3a3',
    fontSize: 13,
    fontStyle: 'italic',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b2a0a',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 12,
    flex: 1,
  },
  participantBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  participantDot: { width: 8, height: 8, borderRadius: 4 },
  participantLabel: { color: '#a3a3a3', fontSize: 12, maxWidth: 120 },
  messageList: {
    padding: 12,
    gap: 8,
    paddingBottom: 16,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 80,
  },
  emptyChatText: { color: '#404040', fontSize: 14, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#262626',
  },
  sendBtn: {
    backgroundColor: '#10a37f',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#262626' },
});
