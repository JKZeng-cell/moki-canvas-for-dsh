// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); window.mokiDshEmbed = true; });
afterEach(() => { delete window.mokiDshEmbed; localStorage.clear(); history.replaceState({}, '', '/'); vi.unstubAllGlobals(); });

it.each([['en', 'en'], ['zh', 'zh-CN'], ['ja', 'en']])('defaults new DSH canvases to following %s', async (host, expected) => {
  history.replaceState({}, '', '/?dshLanguage=' + host);
  const i18n = await import('../src/web/i18n.js');
  expect(i18n.getLanguagePreference()).toBe('dsh');
  expect(i18n.getLanguage()).toBe(expected);
});

it('preserves an existing manual choice on another DSH origin', async () => {
  history.replaceState({}, '', '/?dshLanguage=zh');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"language":"en"}')));
  const i18n = await import('../src/web/i18n.js');
  await i18n.initializeLanguage();
  expect(i18n.getLanguagePreference()).toBe('en');
  expect(i18n.getLanguage()).toBe('en');
});

it('restores following mode against the latest host language, not a previously resolved language', async () => {
  history.replaceState({}, '', '/?dshLanguage=en');
  localStorage.setItem('moki-whiteboard-language', 'en');
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  const i18n = await import('../src/web/i18n.js');
  const pending = i18n.initializeLanguage();
  i18n.setDshLanguage('zh-TW');
  finish(new Response('{"language":"dsh"}')); await pending;
  expect(i18n.getLanguagePreference()).toBe('dsh');
  expect(i18n.getLanguage()).toBe('zh-CN');
  expect(localStorage.getItem(i18n.LANGUAGE_STORAGE_KEY)).toBe('dsh');
});
