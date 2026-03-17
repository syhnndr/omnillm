import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useStore, storeApiKey, deleteApiKey } from '../store';
import { SavedLLM, LLMProvider } from '../types';
import ApiKeyForm from '../components/ApiKeyForm';
import { PROVIDER_COLORS, getProviderInfo } from '../constants/providers';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const savedLLMs = useStore((s) => s.savedLLMs);
  const addLLM = useStore((s) => s.addLLM);
  const updateLLM = useStore((s) => s.updateLLM);
  const deleteLLM = useStore((s) => s.deleteLLM);
  const backendUrl = useStore((s) => s.backendUrl);
  const setBackendUrl = useStore((s) => s.setBackendUrl);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SavedLLM | null>(null);

  async function handleSave(data: {
    displayName: string;
    provider: LLMProvider;
    model: string;
    apiKey: string;
    baseUrl?: string;
  }) {
    if (editTarget) {
      // Update existing — only overwrite the API key if a new one was provided
      if (data.apiKey) {
        await storeApiKey(editTarget.id, data.apiKey);
      }
      updateLLM(editTarget.id, {
        displayName: data.displayName,
        provider: data.provider,
        model: data.model,
        baseUrl: data.baseUrl,
      });
    } else {
      // Add new
      const id = `llm_${Date.now()}`;
      await storeApiKey(id, data.apiKey);
      addLLM({ id, displayName: data.displayName, provider: data.provider, model: data.model, baseUrl: data.baseUrl });
    }
    setShowForm(false);
    setEditTarget(null);
  }

  function handleEdit(llm: SavedLLM) {
    setEditTarget(llm);
    setShowForm(true);
  }

  function handleDelete(llm: SavedLLM) {
    const affectedSessions = useStore.getState().sessions.filter(
      (s) =>
        s.llms.some((l) => l.savedLLMId === llm.id) ||
        s.moderator?.savedLLMId === llm.id
    );
    const warningLine =
      affectedSessions.length > 0
        ? `\n\n⚠️ This will break ${affectedSessions.length} existing session(s) that use this model.`
        : '';
    Alert.alert('Delete LLM', `Remove "${llm.displayName}"?${warningLine}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteApiKey(llm.id);
          deleteLLM(llm.id);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Backend URL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend URL</Text>
          <ApiKeyForm
            mode="backendUrl"
            currentUrl={backendUrl}
            onSaveUrl={(url) => setBackendUrl(url)}
          />
        </View>

        {/* Saved LLMs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved LLMs ({savedLLMs.length})</Text>
          {savedLLMs.length === 0 && (
            <Text style={styles.empty}>No LLMs added yet. Add one below!</Text>
          )}
          {savedLLMs.map((llm) => (
            <View key={llm.id} style={styles.llmRow}>
              <View
                style={[
                  styles.providerDot,
                  { backgroundColor: PROVIDER_COLORS[llm.provider] ?? '#7c3aed' },
                ]}
              />
              <View style={styles.llmInfo}>
                <Text style={styles.llmName}>{llm.displayName}</Text>
                <Text style={styles.llmSub}>
                  {getProviderInfo(llm.provider).label} · {llm.model}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleEdit(llm)} style={styles.iconBtn}>
                <Ionicons name="pencil-outline" size={18} color="#a3a3a3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(llm)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Add / Edit form */}
        {showForm ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{editTarget ? 'Edit LLM' : 'Add LLM'}</Text>
            <ApiKeyForm
              mode="llm"
              editTarget={editTarget}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditTarget(null);
              }}
            />
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#10a37f" />
            <Text style={styles.addBtnText}>Add New LLM</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  scroll: { padding: 16, gap: 8 },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  empty: { color: '#525252', fontSize: 14 },
  llmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  providerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  llmInfo: { flex: 1 },
  llmName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  llmSub: { color: '#a3a3a3', fontSize: 12 },
  iconBtn: { padding: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10a37f',
    borderStyle: 'dashed',
    marginBottom: 32,
  },
  addBtnText: { color: '#10a37f', fontSize: 15, fontWeight: '600' },
});
