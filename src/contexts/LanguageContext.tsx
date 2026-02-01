import React, { createContext, useCallback, useContext } from 'react';
import { i18n, type LocaleCode } from '@/src/i18n';
import { useLanguage } from '@/src/hooks/useLanguage';

interface LanguageContextValue {
  language: LocaleCode;
  setLanguage: (code: LocaleCode) => Promise<void>;
  t: (key: string, options?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguage();

  const t = useCallback(
    (key: string, options?: Record<string, string | number>): string => {
      return i18n.t(key, options);
    },
    [language]
  );

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguageContext() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguageContext must be used within LanguageProvider');
  return ctx;
}
