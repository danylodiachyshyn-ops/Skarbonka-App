import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LanguageProvider } from '@/src/contexts/LanguageContext';
import { JarColorProvider } from '@/src/contexts/JarColorContext';
import '../src/styles/global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
      <JarColorProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#ffffff' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="archive" options={{ headerShown: false }} />
      </Stack>
      </JarColorProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}
