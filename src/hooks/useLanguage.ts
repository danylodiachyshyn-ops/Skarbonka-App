import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { i18n, type LocaleCode } from '@/src/i18n';

const LANGUAGE_KEY = '@skarbonka/language';

const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'de', 'uk'];

function mapDeviceLocaleToSupported(locale: string): LocaleCode {
  const normalized = locale.toLowerCase().split('-')[0];
  if (normalized === 'de') return 'de';
  if (normalized === 'uk') return 'uk';
  return 'en';
}

export function useLanguage(): {
  language: LocaleCode;
  setLanguage: (code: LocaleCode) => Promise<void>;
} {
  const [language, setState] = useState<LocaleCode>('en');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LANGUAGE_KEY).then((raw) => {
      if (cancelled) return;
      const code = raw as LocaleCode | null;
      if (code && SUPPORTED_LOCALES.includes(code)) {
        setState(code);
        i18n.locale = code;
      } else {
        const deviceLocale = Localization.getLocales()[0]?.languageTag ?? 'en';
        const mapped = mapDeviceLocaleToSupported(deviceLocale);
        setState(mapped);
        i18n.locale = mapped;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (code: LocaleCode) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
    i18n.locale = code;
    setState(code);
  }, []);

  return { language, setLanguage };
}
