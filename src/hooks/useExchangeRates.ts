import { useState, useEffect, useCallback } from 'react';
import { getRates, convertToBase, SupportedCurrency } from '@/src/lib/currencyApi';

export function useExchangeRates(homeCurrency: SupportedCurrency | null): {
  rates: Record<string, number>;
  loading: boolean;
  error: string | null;
  convertToHome: (amount: number, fromCurrency: string | null) => number | null;
} {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!homeCurrency) {
      setRates({});
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRates(homeCurrency)
      .then((r) => {
        if (!cancelled) {
          setRates(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to load rates');
          setRates({});
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [homeCurrency]);

  const convertToHome = useCallback(
    (amount: number, fromCurrency: string | null): number | null => {
      if (!homeCurrency) return null;
      const from = (fromCurrency || 'EUR').toUpperCase();
      if (from === homeCurrency) return amount;
      return convertToBase(amount, from, rates);
    },
    [homeCurrency, rates]
  );

  return { rates, loading, error, convertToHome };
}
