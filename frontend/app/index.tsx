import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { ChatSession } from '../types';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SessionCard({
  session,
  onPress,
  onDelete,
}: {
  session: ChatSession;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {session.name}
        </Text>
        <Text style={styles.cardSub}>
          {session.llms.map((l) => l.displayName).join(', ')}
        </Text>
        <Text style={styles.cardDate}>{formatDate(session.createdAt)}</Text>
      </View>
      <View style={styles.cardRight}>
        <View style={styles.llmChips}>
          {session.llms.slice(0, 4).map((l) => (
            <View key={l.savedLLMId} style={[styles.chip, { backgroundColor: l.color }]} />
          ))}
          {session.llms.length > 4 && (
            <Text style={styles.chipMore}>+{session.llms.length - 4}</Text>
          )}
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const sessions = useStore((s) => s.sessions);
  const deleteSession = useStore((s) => s.deleteSession);

  function handleDelete(id: string, name: string) {
    Alert.alert('Delete Session', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession(id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'OmniLLM', headerLargeTitle: false }} />
      
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={64} color="#404040" />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Create a new session to start chatting</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              onPress={() => router.push(`/session/${item.id}`)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* FAB row */}
      <View style={styles.fabRow}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="key-outline" size={20} color="#ffffff" />
          <Text style={styles.fabLabel}>API Keys</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.fabPrimary]}
          onPress={() => router.push('/new-session')}
        >
          <Ionicons name="add" size={22} color="#ffffff" />
          <Text style={styles.fabLabel}>New Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 100, // Extra space for FABs
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardLeft: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSub: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  cardDate: {
    color: '#525252',
    fontSize: 12,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  llmChips: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  chip: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipMore: {
    color: '#a3a3a3',
    fontSize: 11,
  },
  deleteBtn: {
    padding: 4,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  emptySub: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  fabRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    paddingBottom: 40,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 50,
  },
  fabPrimary: {
    backgroundColor: '#10a37f',
  },
  fabSecondary: {
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#404040',
  },
  fabLabel: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
