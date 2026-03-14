import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SavedLLM } from '../types';
import { getProviderInfo } from '../constants/providers';

interface Props {
  llm: SavedLLM;
  role: string;
  systemPrompt: string;
  color: string;
  presetRoles: string[];
  onRoleChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
}

export default function LLMCard({
  llm,
  role,
  systemPrompt,
  color,
  presetRoles,
  onRoleChange,
  onSystemPromptChange,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const providerInfo = getProviderInfo(llm.provider);

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((e) => !e)}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{llm.displayName}</Text>
          <Text style={styles.sub}>{providerInfo.label} · {llm.model}</Text>
        </View>
        <Text style={styles.toggle}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Role presets */}
          <Text style={styles.fieldLabel}>Role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
            {presetRoles.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.preset, role === r && { backgroundColor: color, borderColor: color }]}
                onPress={() => onRoleChange(role === r ? '' : r)}
              >
                <Text style={[styles.presetText, role === r && { color: '#fff' }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={styles.input}
            value={role}
            onChangeText={onRoleChange}
            placeholder="Custom role…"
            placeholderTextColor="#525252"
          />

          {/* System prompt */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>System Prompt</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={systemPrompt}
            onChangeText={onSystemPromptChange}
            placeholder="You are a helpful assistant…"
            placeholderTextColor="#525252"
            multiline
            numberOfLines={4}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f0f0f',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  headerInfo: { flex: 1 },
  name: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#a3a3a3', fontSize: 12 },
  toggle: { color: '#525252', fontSize: 14 },
  body: { padding: 12, paddingTop: 0, gap: 6 },
  fieldLabel: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  presetRow: { marginBottom: 6 },
  preset: {
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  presetText: { color: '#a3a3a3', fontSize: 12 },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#404040',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
