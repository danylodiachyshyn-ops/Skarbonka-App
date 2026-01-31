import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@skarbonka_jar_colors';

export type JarColorPreset = 'emerald' | 'ocean' | 'sunset' | 'slate';

export const JAR_COLOR_PRESETS: Record<
  JarColorPreset,
  { gradient: [string, string]; button: string; progress: string }
> = {
  emerald: {
    gradient: ['#064e3b', '#10b981'],
    button: '#10b981',
    progress: '#10b981',
  },
  ocean: {
    gradient: ['#0c4a6e', '#0ea5e9'],
    button: '#0ea5e9',
    progress: '#0ea5e9',
  },
  sunset: {
    gradient: ['#9a3412', '#f97316'],
    button: '#f97316',
    progress: '#f97316',
  },
  slate: {
    gradient: ['#334155', '#64748b'],
    button: '#64748b',
    progress: '#64748b',
  },
};

type JarColorsState = Record<string, JarColorPreset>;

interface JarColorContextValue {
  getColorForBox: (boxId: string) => JarColorPreset;
  setColorForBox: (boxId: string, preset: JarColorPreset) => Promise<void>;
  removeColorForBox: (boxId: string) => Promise<void>;
  colors: JarColorsState;
}

const JarColorContext = createContext<JarColorContextValue | null>(null);

export function JarColorProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<JarColorsState>({});

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as JarColorsState;
          setColors(parsed);
        }
      } catch (e) {
        console.warn('Failed to load jar colors', e);
      }
    })();
  }, []);

  const persist = useCallback(async (next: JarColorsState) => {
    setColors(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save jar colors', e);
    }
  }, []);

  const getColorForBox = useCallback(
    (boxId: string): JarColorPreset => {
      return colors[boxId] ?? 'ocean';
    },
    [colors]
  );

  const setColorForBox = useCallback(
    async (boxId: string, preset: JarColorPreset) => {
      await persist({ ...colors, [boxId]: preset });
    },
    [colors, persist]
  );

  const removeColorForBox = useCallback(
    async (boxId: string) => {
      const next = { ...colors };
      delete next[boxId];
      await persist(next);
    },
    [colors, persist]
  );

  const value: JarColorContextValue = {
    getColorForBox,
    setColorForBox,
    removeColorForBox,
    colors,
  };

  return (
    <JarColorContext.Provider value={value}>{children}</JarColorContext.Provider>
  );
}

export function useJarColor() {
  const ctx = useContext(JarColorContext);
  if (!ctx) throw new Error('useJarColor must be used within JarColorProvider');
  return ctx;
}
