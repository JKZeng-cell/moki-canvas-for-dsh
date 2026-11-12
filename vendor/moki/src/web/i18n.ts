import {useSyncExternalStore} from 'react';
import {en} from './locales/en.js';

export type InterfaceLanguage = 'zh-CN' | 'en';
export type LanguagePreference = InterfaceLanguage | 'dsh';
export class LanguageSaveError extends Error {
  constructor(readonly code: 'restart-required' | 'save-failed') {
    super(code);
    this.name = 'LanguageSaveError';
  }
}
export const LANGUAGE_STORAGE_KEY = 'moki-whiteboard-language';
const listeners = new Set<() => void>();
const valid = (value: unknown): value is LanguagePreference => value === 'dsh' || value === 'zh-CN' || value === 'en';
function hostLanguage(value: unknown): InterfaceLanguage | undefined {
  if (typeof value !== 'string' || !/^[a-z]{2,8}(?:[-_][a-z0-9]{1,8})*$/i.test(value)) return;
  return /^zh(?:[-_]|$)/i.test(value) ? 'zh-CN' : 'en';
}
function readLanguage(): LanguagePreference {
  try { const value = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (valid(value)) return value; } catch { /* Storage may be unavailable in embedded browsers. */ }
  return typeof window !== 'undefined' && window.mokiDshEmbed ? 'dsh' : 'zh-CN';
}
let preference = readLanguage();
let dshLanguage: InterfaceLanguage = (typeof window !== 'undefined' && window.mokiDshEmbed
  ? hostLanguage(new URLSearchParams(location.search).get('dshLanguage')) : undefined)
  ?? (typeof navigator !== 'undefined' ? hostLanguage(navigator.language) : undefined) ?? 'zh-CN';
let language: InterfaceLanguage = preference === 'dsh' ? dshLanguage : preference;
let revision = 0;
let pendingSave: Promise<void> = Promise.resolve();
export function getLanguage() { return language; }
export function getLanguagePreference() { return preference; }
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useI18n() { return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage); }
export function useLanguagePreference() { return useSyncExternalStore(subscribeLanguage, getLanguagePreference, getLanguagePreference); }

/** Translate interface copy only. Values such as titles and document text stay untouched. */
export function t(message: string, ...values: unknown[]): string {
  const copy = language === 'en' && Object.hasOwn(en, message) ? en[message]! : message;
  return copy.replace(/\{(\d+)\}/g, (placeholder, index: string) => Number(index) < values.length ? String(values[Number(index)]) : placeholder);
}

export function setLanguage(value: LanguagePreference) {
  if (!valid(value)) return;
  revision++;
  const resolved = value === 'dsh' ? dshLanguage : value;
  const changed = preference !== value || language !== resolved;
  preference = value;
  language = resolved;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, value); } catch { /* Server persistence remains available. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  if (changed) for (const listener of listeners) listener();
}

/** Host language changes never turn an explicit choice into a following preference. */
export function setDshLanguage(value: unknown) {
  const resolved = hostLanguage(value);
  if (!resolved) return;
  dshLanguage = resolved;
  if (preference !== 'dsh' || language === resolved) return;
  language = resolved;
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  for (const listener of listeners) listener();
}

// DSH can keep several canvas frames mounted at once. Keep their menus in sync.
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === LANGUAGE_STORAGE_KEY && valid(event.newValue)) setLanguage(event.newValue);
});

/** The database preference survives the randomly assigned DSH iframe port. */
export async function initializeLanguage() {
  const initialRevision = revision;
  try {
    const response = await fetch('/api/preferences', {signal: AbortSignal.timeout(4000)});
    if (!response.ok) return;
    const preferences = await response.json() as {language?: unknown};
    if (revision === initialRevision && valid(preferences.language)) setLanguage(preferences.language);
  } catch { /* Keep the last device preference when the service is unavailable. */ }
  finally { if (typeof document !== 'undefined') document.documentElement.lang = language; }
}

export function saveLanguage(value: LanguagePreference): Promise<void> {
  setLanguage(value);
  // Serialize rapid switches so an older request cannot overwrite the newest choice.
  pendingSave = pendingSave.catch(() => {}).then(async () => {
    const response = await fetch('/api/preferences', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({language: value}), signal: AbortSignal.timeout(10000)});
    // A linked plugin can serve new UI files while DSH still runs its old host.
    // Retrying cannot add a route that only exists after the host restarts.
    if (response.status === 404 || response.status === 405 || value === 'dsh' && response.status === 400) throw new LanguageSaveError('restart-required');
    if (!response.ok) throw new LanguageSaveError('save-failed');
  });
  return pendingSave;
}
