/**
 * Exchange rates: Frankfurter (EUR, USD, GBP) + NBU for UAH.
 * Frankfurter: https://www.frankfurter.app/docs/
 * NBU: https://bank.gov.ua/en/open-data/api-dev
 */

const FRANKFURTER_BASE = 'https://api.frankfurter.dev';
const NBU_BASE = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';
const CACHE_MS = 1000 * 60 * 60; // 1 hour

// Frankfurter supports EUR, USD, GBP only (no UAH)
const FRANKFURTER_CURRENCIES = ['EUR', 'USD', 'GBP'] as const;

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'UAH', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

let cachedRates: Record<string, number> = {};
let cachedBase: string = '';
let cachedAt = 0;

// NBU: rate = how many UAH per 1 unit of foreign currency
let nbuCache: Record<string, number> | null = null;
let nbuCachedAt = 0;

type NBUItem = { cc: string; rate: number };

async function fetchNBURates(): Promise<Record<string, number>> {
  if (nbuCache && Date.now() - nbuCachedAt < CACHE_MS) {
    return nbuCache;
  }
  const res = await fetch(`${NBU_BASE}?json`);
  if (!res.ok) throw new Error('Failed to fetch UAH exchange rates');
  const data = (await res.json()) as NBUItem[];
  const rates: Record<string, number> = {};
  for (const item of data) {
    if (item.cc && typeof item.rate === 'number' && item.rate > 0) {
      rates[item.cc] = item.rate;
    }
  }
  nbuCache = rates;
  nbuCachedAt = Date.now();
  return rates;
}

function getCachedRates(base: string): Record<string, number> | null {
  if (cachedBase === base && Date.now() - cachedAt < CACHE_MS) {
    return cachedRates;
  }
  return null;
}

function setCachedRates(base: string, rates: Record<string, number>): void {
  cachedBase = base;
  cachedRates = rates;
  cachedAt = Date.now();
}

export async function fetchRatesFromBase(base: string): Promise<Record<string, number>> {
  const code = (base || 'EUR').toUpperCase();

  if (code === 'UAH') {
    const nbu = await fetchNBURates();
    const eur = nbu['EUR'];
    const usd = nbu['USD'];
    const gbp = nbu['GBP'];
    if (eur == null || usd == null || gbp == null) {
      throw new Error('UAH rates not available');
    }
    return {
      EUR: 1 / eur,
      USD: 1 / usd,
      GBP: 1 / gbp,
      UAH: 1,
    };
  }

  if (!FRANKFURTER_CURRENCIES.includes(code as (typeof FRANKFURTER_CURRENCIES)[number])) {
    throw new Error(`Unsupported base currency: ${code}`);
  }

  const symbols = FRANKFURTER_CURRENCIES.filter((c) => c !== code).join(',');
  const url = `${FRANKFURTER_BASE}/v1/latest?base=${encodeURIComponent(code)}&symbols=${symbols}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rates: Record<string, number> = { ...(data.rates ?? {}), [code]: 1 };

  const nbu = await fetchNBURates();
  const uahPerBase = nbu[code];
  if (uahPerBase != null && uahPerBase > 0) {
    rates['UAH'] = uahPerBase;
  }

  return rates;
}

export async function getRates(base: string): Promise<Record<string, number>> {
  const code = (base || 'EUR').toUpperCase();
  const cached = getCachedRates(code);
  if (cached) return cached;
  const rates = await fetchRatesFromBase(code);
  setCachedRates(code, rates);
  return rates;
}

export function convertToBase(
  amount: number,
  fromCurrency: string,
  rates: Record<string, number>
): number | null {
  const from = (fromCurrency || 'EUR').toUpperCase();
  if (from in rates) {
    const rate = rates[from];
    return rate !== 0 ? amount / rate : null;
  }
  return null;
}
