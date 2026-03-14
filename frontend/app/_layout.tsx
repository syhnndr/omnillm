import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#10a37f',
    background: '#0f0f0f',
    surface: '#1a1a1a',
    surfaceVariant: '#262626',
    onSurface: '#ffffff',
    onSurfaceVariant: '#a3a3a3',
  },
};

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f0f0f' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0f0f0f' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'OmniLLM', headerLargeTitle: true }} />
        <Stack.Screen name="settings" options={{ title: 'API Keys' }} />
        <Stack.Screen name="new-session" options={{ title: 'New Session' }} />
        <Stack.Screen
          name="session/[id]"
          options={{ title: 'Chat', headerBackTitle: 'Back' }}
        />
      </Stack>
    </PaperProvider>
  );
}
