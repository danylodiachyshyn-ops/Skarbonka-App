import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedCurrency } from '@/src/lib/currencyApi';

const HOME_CURRENCY_KEY = '@skarbonka/home_currency';

export function useHomeCurrency(): {
  homeCurrency: SupportedCurrency | null;
  setHomeCurrency: (code: SupportedCurrency | null) => Promise<void>;
} {
  const [homeCurrency, setState] = useState<SupportedCurrency | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HOME_CURRENCY_KEY).then((raw) => {
      if (cancelled) return;
      const code = raw as SupportedCurrency | null;
      if (code && ['EUR', 'USD', 'UAH', 'GBP'].includes(code)) {
        setState(code as SupportedCurrency);
      } else {
        setState(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setHomeCurrency = useCallback(async (code: SupportedCurrency | null) => {
    if (code) {
      await AsyncStorage.setItem(HOME_CURRENCY_KEY, code);
      setState(code);
    } else {
      await AsyncStorage.removeItem(HOME_CURRENCY_KEY);
      setState(null);
    }
  }, []);

  return { homeCurrency, setHomeCurrency };
}
