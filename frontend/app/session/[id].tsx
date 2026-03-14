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
import { ChatMessage, ChatSession, BackendChatRequest, BackendChatResponse } from '../../types';
import ChatMessageBubble from '../../components/ChatMessage';

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

    // Add user message
    const userMsgId = `msg_${Date.now()}_user`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(id!, userMsg);

    // Add loading placeholder for each LLM
    const loadingIds: Record<string, string> = {};
    session.llms.forEach((llm) => {
      const msgId = `msg_${Date.now()}_${llm.savedLLMId}`;
      loadingIds[llm.savedLLMId] = msgId;
      const placeholder: ChatMessage = {
        id: msgId,
        role: 'assistant',
        content: '',
        llmDisplayName: llm.displayName,
        llmProvider: llm.provider,
        llmRole: llm.role,
        llmColor: llm.color,
        loading: true,
        timestamp: Date.now(),
      };
      addMessage(id!, placeholder);
    });

    // Scroll to bottom
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    // Build request — fetch API keys from SecureStore right before sending
    const history = buildHistory(session);

    try {
      // Fetch API keys from SecureStore — inside try so missing keys are caught
      const llmConfigs = await Promise.all(
        session.llms.map(async (l) => {
          const apiKey = await retrieveApiKey(l.savedLLMId);
          if (!apiKey) {
            throw new Error(`No API key found for "${l.displayName}". Please add it in Settings.`);
          }
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
      const requestBody: BackendChatRequest = {
        message: text,
        history,
        llms: llmConfigs,
      };

      const res = await fetch(`${backendUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: BackendChatResponse = await res.json();

      // Update loading placeholders with actual responses
      data.responses.forEach((resp) => {
        const msgId = loadingIds[resp.savedLLMId];
        if (!msgId) return;
        updateMessage(id!, msgId, {
          content: resp.error ? `Error: ${resp.error}` : resp.content,
          loading: false,
          error: resp.error,
        });
      });
    } catch (err) {
      // Mark all loading messages as errored
      session.llms.forEach((llm) => {
        const msgId = loadingIds[llm.savedLLMId];
        updateMessage(id!, msgId, {
          content: `Error: ${err instanceof Error ? err.message : 'Network error'}`,
          loading: false,
          error: err instanceof Error ? err.message : 'Network error',
        });
      });
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }

  const messages = session.messages;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* LLM participant bar */}
      <View style={styles.participantBar}>
        {session.llms.map((llm) => (
          <View key={llm.savedLLMId} style={styles.participantChip}>
            <View style={[styles.participantDot, { backgroundColor: llm.color }]} />
            <Text style={styles.participantLabel} numberOfLines={1}>
              {llm.displayName}
              {llm.role ? ` · ${llm.role}` : ''}
            </Text>
          </View>
        ))}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={48} color="#262626" />
            <Text style={styles.emptyChatText}>Send a message to all LLMs at once</Text>
          </View>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 16 },
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
