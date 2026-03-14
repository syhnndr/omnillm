import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SavedLLM, ChatSession, ChatMessage, SessionLLM } from '../types';
import { LLM_ACCENT_COLORS } from '../constants/providers';

// ─────────────────────────────────────────────
// Secure storage helpers for API keys
// ─────────────────────────────────────────────

/** Store an API key securely by LLM id */
export async function storeApiKey(llmId: string, apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(`apikey_${llmId}`, apiKey);
}

/** Retrieve a stored API key by LLM id */
export async function retrieveApiKey(llmId: string): Promise<string> {
  return (await SecureStore.getItemAsync(`apikey_${llmId}`)) ?? '';
}

/** Delete a stored API key */
export async function deleteApiKey(llmId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`apikey_${llmId}`);
}

// ─────────────────────────────────────────────
// Store types
// ─────────────────────────────────────────────

interface AppState {
  /** Saved LLM configurations (API keys stored separately in SecureStore) */
  savedLLMs: SavedLLM[];
  /** All chat sessions */
  sessions: ChatSession[];
  /** Backend base URL */
  backendUrl: string;

  // LLM actions
  addLLM: (llm: SavedLLM) => void;
  updateLLM: (id: string, updates: Partial<SavedLLM>) => void;
  deleteLLM: (id: string) => void;

  // Session actions
  createSession: (name: string, llms: SessionLLM[]) => ChatSession;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  updateSessionTimestamp: (sessionId: string) => void;

  // Settings
  setBackendUrl: (url: string) => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      savedLLMs: [],
      sessions: [],
      backendUrl: 'http://localhost:3001',

      // ── LLM management ──────────────────────────────────────────────────

      addLLM: (llm) =>
        set((state) => ({ savedLLMs: [...state.savedLLMs, llm] })),

      updateLLM: (id, updates) =>
        set((state) => ({
          savedLLMs: state.savedLLMs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        })),

      deleteLLM: (id) =>
        set((state) => ({ savedLLMs: state.savedLLMs.filter((l) => l.id !== id) })),

      // ── Session management ───────────────────────────────────────────────

      createSession: (name, llms) => {
        // Assign accent colours to LLMs
        const colouredLLMs: SessionLLM[] = llms.map((l, i) => ({
          ...l,
          color: LLM_ACCENT_COLORS[i % LLM_ACCENT_COLORS.length],
        }));

        const session: ChatSession = {
          id: Date.now().toString(),
          name,
          llms: colouredLLMs,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({ sessions: [session, ...state.sessions] }));
        return session;
      },

      deleteSession: (id) =>
        set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),

      addMessage: (sessionId, message) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
              : s
          ),
        })),

      updateMessage: (sessionId, messageId, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                }
              : s
          ),
        })),

      updateSessionTimestamp: (sessionId) => {
        const { sessions } = get();
        set({
          sessions: sessions.map((s) =>
            s.id === sessionId ? { ...s, updatedAt: Date.now() } : s
          ),
        });
      },

      // ── Settings ─────────────────────────────────────────────────────────

      setBackendUrl: (url) => set({ backendUrl: url }),
    }),
    {
      name: 'omnillm-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Explicitly list persisted fields to prevent API keys or future sensitive
      // fields from reaching AsyncStorage. Keys are stored exclusively in SecureStore.
      partialize: (state) => ({
        savedLLMs: state.savedLLMs,
        sessions: state.sessions,
        backendUrl: state.backendUrl,
      }),
    }
  )
);
