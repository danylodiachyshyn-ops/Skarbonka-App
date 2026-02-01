import type { LocaleCode } from '@/src/i18n';

const LOCALE_MAP: Record<LocaleCode, string> = {
  en: 'en-US',
  de: 'de-DE',
  uk: 'uk-UA',
};

/**
 * Formats a transaction date/time for display, adapted to the user's language preference.
 * @param dateStr ISO date string
 * @param locale App locale code (en, de, uk)
 * @param options todayLabel - translated "Today" string for same-day transactions
 */
export function formatTransactionDate(
  dateStr: string,
  locale: LocaleCode,
  options?: { todayLabel?: string }
): string {
  const d = new Date(dateStr);
  const intlLocale = LOCALE_MAP[locale] ?? 'en-US';

  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateTimeFormatter = new Intl.DateTimeFormat(intlLocale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday && options?.todayLabel) {
    return `${options.todayLabel}, ${timeFormatter.format(d)}`;
  }

  return dateTimeFormatter.format(d);
}
