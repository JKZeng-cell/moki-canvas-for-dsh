import {useSyncExternalStore} from 'react';
import {en} from './locales/en.js';

export type InterfaceLanguage = 'zh-CN' | 'en';
export const LANGUAGE_STORAGE_KEY = 'moki-whiteboard-language';
const listeners = new Set<() => void>();
const valid = (value: unknown): value is InterfaceLanguage => value === 'zh-CN' || value === 'en';
function readLanguage(): InterfaceLanguage {
  try { const value = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (valid(value)) return value; } catch { /* Storage may be unavailable in embedded browsers. */ }
  return 'zh-CN';
}
let language = readLanguage();
let revision = 0;
let pendingSave: Promise<void> = Promise.resolve();
export function getLanguage() { return language; }
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useI18n() { return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage); }

/** Translate interface copy only. Values such as titles and document text stay untouched. */
export function t(message: string, ...values: unknown[]): string {
  const copy = language === 'en' && Object.hasOwn(en, message) ? en[message]! : message;
  return copy.replace(/\{(\d+)\}/g, (placeholder, index: string) => Number(index) < values.length ? String(values[Number(index)]) : placeholder);
}

export function setLanguage(value: InterfaceLanguage) {
  if (!valid(value)) return;
  revision++;
  const changed = language !== value;
  language = value;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, value); } catch { /* Server persistence remains available. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  if (changed) for (const listener of listeners) listener();
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

export function saveLanguage(value: InterfaceLanguage): Promise<void> {
  setLanguage(value);
  // Serialize rapid switches so an older request cannot overwrite the newest choice.
  pendingSave = pendingSave.catch(() => {}).then(async () => {
    const response = await fetch('/api/preferences', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({language: value}), signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error(t('语言已切换，但保存失败，请重试。'));
  });
  return pendingSave;
}
