import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { SessionLLM, SavedLLM } from '../types';
import LLMCard from '../components/LLMCard';
import { LLM_ACCENT_COLORS } from '../constants/providers';

const PRESET_ROLES = ['Analyst', "Devil's Advocate", 'Summarizer', 'Creative', 'Critic', 'Expert'];

export default function NewSessionScreen() {
  const router = useRouter();
  const savedLLMs = useStore((s) => s.savedLLMs);
  const createSession = useStore((s) => s.createSession);

  const [sessionName, setSessionName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<Record<string, { role: string; systemPrompt: string }>>({});

  // Initialize config when selection changes
  useEffect(() => {
    setLlmConfigs((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        if (!next[id]) {
          next[id] = { role: '', systemPrompt: '' };
        }
      });
      return next;
    });
  }, [selectedIds]);

  function toggleSelect(llm: SavedLLM) {
    setSelectedIds((prev) =>
      prev.includes(llm.id) ? prev.filter((id) => id !== llm.id) : [...prev, llm.id]
    );
  }

  function updateConfig(llmId: string, key: 'role' | 'systemPrompt', value: string) {
    setLlmConfigs((prev) => ({
      ...prev,
      [llmId]: { ...prev[llmId], [key]: value },
    }));
  }

  function handleCreate() {
    if (!sessionName.trim()) {
      Alert.alert('Error', 'Please enter a session name');
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert('Error', 'Please select at least one LLM');
      return;
    }

    const sessionLLMs: SessionLLM[] = selectedIds.map((id, index) => {
        const saved = savedLLMs.find((l) => l.id === id)!;
        const config = llmConfigs[id] ?? { role: '', systemPrompt: '' };
        return {
          savedLLMId: id,
          displayName: saved.displayName,
          provider: saved.provider,
          model: saved.model,
          role: config.role,
          systemPrompt: config.systemPrompt,
          color: LLM_ACCENT_COLORS[index % LLM_ACCENT_COLORS.length],
        };
      });

    const session = createSession(sessionName.trim(), sessionLLMs);
    router.replace(`/session/${session.id}`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Session name */}
      <View style={styles.section}>
        <Text style={styles.label}>Session Name</Text>
        <TextInput
          style={styles.input}
          value={sessionName}
          onChangeText={setSessionName}
          placeholder="e.g. Tech Analysis Round-table"
          placeholderTextColor="#525252"
        />
      </View>

      {/* LLM selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Select LLMs ({selectedIds.length} selected)</Text>
        {savedLLMs.length === 0 ? (
          <Text style={styles.hint}>
            No LLMs saved yet. Go to API Keys settings to add some.
          </Text>
        ) : (
          savedLLMs.map((llm) => {
            const selected = selectedIds.includes(llm.id);
            return (
              <TouchableOpacity
                key={llm.id}
                style={[styles.llmSelectRow, selected && styles.llmSelectRowActive]}
                onPress={() => toggleSelect(llm)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selected ? '#10a37f' : '#525252'}
                />
                <Text style={[styles.llmSelectName, selected && { color: '#fff' }]}>
                  {llm.displayName}
                </Text>
                <Text style={styles.llmSelectSub}>{llm.provider} · {llm.model}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Role + system prompt per selected LLM */}
      {selectedIds.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Configure Roles & Prompts</Text>
          {selectedIds.map((id, index) => {
            const llm = savedLLMs.find((l) => l.id === id)!;
            const config = llmConfigs[id] ?? { role: '', systemPrompt: '' };
            const color = LLM_ACCENT_COLORS[index % LLM_ACCENT_COLORS.length];
            return (
              <LLMCard
                key={id}
                llm={llm}
                role={config.role}
                systemPrompt={config.systemPrompt}
                color={color}
                presetRoles={PRESET_ROLES}
                onRoleChange={(v) => updateConfig(id, 'role', v)}
                onSystemPromptChange={(v) => updateConfig(id, 'systemPrompt', v)}
              />
            );
          })}
        </View>
      )}

      {/* Create button */}
      <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
        <Ionicons name="chatbubbles" size={20} color="#fff" />
        <Text style={styles.createBtnText}>Start Session</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  scroll: { padding: 16, gap: 0, paddingBottom: 40 },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 16,
  },
  label: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  hint: { color: '#525252', fontSize: 13 },
  input: {
    backgroundColor: '#262626',
    color: '#ffffff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#404040',
  },
  llmSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#0f0f0f',
  },
  llmSelectRowActive: {
    borderColor: '#10a37f',
    backgroundColor: '#0d2e24',
  },
  llmSelectName: { flex: 1, color: '#a3a3a3', fontSize: 14, fontWeight: '600' },
  llmSelectSub: { color: '#525252', fontSize: 12 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10a37f',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  createBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
