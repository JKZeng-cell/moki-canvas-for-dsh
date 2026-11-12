import {mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import Fastify from 'fastify';
import {expect, it} from 'vitest';
import {WhiteboardStore} from '../src/server/store.js';
import {registerUiPreferences} from '../src/server/ui-preferences.js';

it('keeps language across server restarts without modifying any canvas', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moki-language-'));
  const file = join(dir, 'canvas.db');
  let store = new WhiteboardStore(file), app = Fastify();
  try {
    registerUiPreferences(app, store);
    const before = store.get('default');
    expect((await app.inject('/api/preferences')).json()).toEqual({language: null});
    const saved = await app.inject({method: 'PUT', url: '/api/preferences', payload: {language: 'en'}});
    expect(saved.statusCode).toBe(200);
    for (const payload of [{language: 'xx'}, {language: 'en', path: 'unrelated'}, {}]) {
      expect((await app.inject({method: 'PUT', url: '/api/preferences', payload})).statusCode).toBeGreaterThanOrEqual(400);
    }
    expect(store.get('default')).toEqual(before);
    await app.close(); store.close();
    store = new WhiteboardStore(file); app = Fastify(); registerUiPreferences(app, store);
    expect((await app.inject('/api/preferences')).json()).toEqual({language: 'en'});
    expect(store.get('default')).toEqual(before);
  } finally { await app.close(); store.close(); rmSync(dir, {recursive: true, force: true}); }
});
