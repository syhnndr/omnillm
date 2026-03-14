import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ChatMessage } from '../types';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  message: ChatMessage;
}

export default function ChatMessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  // Assistant message
  const accentColor = message.llmColor ?? '#10a37f';

  return (
    <View style={[styles.assistantCard, { borderLeftColor: accentColor }]}>
      {/* Header */}
      <View style={styles.assistantHeader}>
        <View style={[styles.assistantDot, { backgroundColor: accentColor }]} />
        <Text style={[styles.assistantName, { color: accentColor }]}>
          {message.llmDisplayName ?? 'LLM'}
        </Text>
        {message.llmRole ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{message.llmRole}</Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      {message.loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={styles.loadingText}>Thinking…</Text>
        </View>
      ) : message.error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{message.content}</Text>
        </View>
      ) : (
        <Text style={styles.assistantText}>{message.content}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: '#10a37f',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  assistantCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 14,
    marginVertical: 4,
    gap: 8,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assistantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  assistantName: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleBadge: {
    backgroundColor: '#262626',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    color: '#a3a3a3',
    fontSize: 11,
  },
  assistantText: {
    color: '#e5e5e5',
    fontSize: 15,
    lineHeight: 23,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
  },
});
