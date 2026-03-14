import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LLMProvider, SavedLLM } from '../types';
import { PROVIDERS, getProviderInfo } from '../constants/providers';
import { Ionicons } from '@expo/vector-icons';

// ────────────────────────────────────────────────────────────────
// Sub-form for backend URL
// ────────────────────────────────────────────────────────────────

interface BackendUrlProps {
  mode: 'backendUrl';
  currentUrl: string;
  onSaveUrl: (url: string) => void;
}

// ────────────────────────────────────────────────────────────────
// Sub-form for adding / editing an LLM
// ────────────────────────────────────────────────────────────────

interface LLMFormProps {
  mode: 'llm';
  editTarget: SavedLLM | null;
  onSave: (data: {
    displayName: string;
    provider: LLMProvider;
    model: string;
    apiKey: string;
    baseUrl?: string;
  }) => void;
  onCancel: () => void;
}

type Props = BackendUrlProps | LLMFormProps;

export default function ApiKeyForm(props: Props) {
  // ── Backend URL mode ──────────────────────────────────────────────
  if (props.mode === 'backendUrl') {
    return <BackendUrlForm {...props} />;
  }

  return <LLMAddForm {...props} />;
}

// ────────────────────────────────────────────────────────────────

function BackendUrlForm({ currentUrl, onSaveUrl }: BackendUrlProps) {
  const [url, setUrl] = useState(currentUrl);

  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, { flex: 1 }]}
        value={url}
        onChangeText={setUrl}
        placeholder="http://localhost:3001"
        placeholderTextColor="#525252"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <TouchableOpacity style={styles.saveBtn} onPress={() => onSaveUrl(url.trim())}>
        <Text style={styles.saveBtnText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────

function LLMAddForm({ editTarget, onSave, onCancel }: LLMFormProps) {
  const [displayName, setDisplayName] = useState(editTarget?.displayName ?? '');
  const [provider, setProvider] = useState<LLMProvider>(editTarget?.provider ?? 'openai');
  const [model, setModel] = useState(editTarget?.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(editTarget?.baseUrl ?? '');
  const [showKey, setShowKey] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  const selectedProvider = getProviderInfo(provider);

  function handleSave() {
    onSave({ displayName: displayName.trim(), provider, model: model.trim(), apiKey: apiKey.trim(), baseUrl: baseUrl.trim() || undefined });
  }

  return (
    <View style={styles.form}>
      {/* Provider picker */}
      <Text style={styles.label}>Provider</Text>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setShowProviderPicker((v) => !v)}
      >
        <View style={[styles.providerDot, { backgroundColor: selectedProvider.color }]} />
        <Text style={styles.pickerBtnText}>{selectedProvider.label}</Text>
        <Ionicons name={showProviderPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#a3a3a3" />
      </TouchableOpacity>

      {showProviderPicker && (
        <View style={styles.providerList}>
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.providerItem, provider === p.id && styles.providerItemActive]}
              onPress={() => {
                setProvider(p.id);
                setShowProviderPicker(false);
                if (p.defaultModels.length > 0 && !model) {
                  setModel(p.defaultModels[0]);
                }
              }}
            >
              <View style={[styles.providerDot, { backgroundColor: p.color }]} />
              <Text style={styles.providerItemText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Model */}
      <Text style={styles.label}>Model</Text>
      {selectedProvider.defaultModels.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelRow}>
          {selectedProvider.defaultModels.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modelChip, model === m && { backgroundColor: selectedProvider.color, borderColor: selectedProvider.color }]}
              onPress={() => setModel(m)}
            >
              <Text style={[styles.modelChipText, model === m && { color: '#fff' }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <TextInput
        style={styles.input}
        value={model}
        onChangeText={setModel}
        placeholder="e.g. gpt-4o"
        placeholderTextColor="#525252"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Display name */}
      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="e.g. My GPT-4o"
        placeholderTextColor="#525252"
      />

      {/* API Key */}
      <Text style={styles.label}>API Key{editTarget ? ' (leave blank to keep current)' : ''}</Text>
      <View style={styles.keyRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={editTarget ? '••••••••••••' : 'sk-…'}
          placeholderTextColor="#525252"
          secureTextEntry={!showKey}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={() => setShowKey((v) => !v)} style={styles.eyeBtn}>
          <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color="#a3a3a3" />
        </TouchableOpacity>
      </View>

      {/* Base URL — shown only for custom OpenAI-compatible providers */}
      {provider === 'custom' && (
        <>
          <Text style={styles.label}>Base URL</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://your-endpoint/v1"
            placeholderTextColor="#525252"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitBtnText}>{editTarget ? 'Update' : 'Add LLM'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: '#262626',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#404040',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  pickerBtnText: { flex: 1, color: '#ffffff', fontSize: 14 },
  providerDot: { width: 10, height: 10, borderRadius: 5 },
  providerList: {
    backgroundColor: '#262626',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#404040',
    overflow: 'hidden',
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  providerItemActive: { backgroundColor: '#1a1a1a' },
  providerItemText: { color: '#ffffff', fontSize: 14 },
  modelRow: { marginBottom: 6 },
  modelChip: {
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  modelChipText: { color: '#a3a3a3', fontSize: 12 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyeBtn: { padding: 10 },
  saveBtn: {
    backgroundColor: '#10a37f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#404040',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#a3a3a3', fontWeight: '600' },
  submitBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#10a37f',
    alignItems: 'center',
  },
  submitBtnText: { color: '#ffffff', fontWeight: '700' },
});
