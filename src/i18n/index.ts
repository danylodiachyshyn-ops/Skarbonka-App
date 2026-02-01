import { I18n } from 'i18n-js';
import en from './en.json';
import de from './de.json';
import uk from './uk.json';

const translations = { en, de, uk };

export const i18n = new I18n(translations);
i18n.defaultLocale = 'en';
i18n.locale = 'en';
i18n.enableFallback = true;

export type LocaleCode = 'en' | 'de' | 'uk';

export function t(key: string, options?: Record<string, string | number>): string {
  return i18n.t(key, options);
}
