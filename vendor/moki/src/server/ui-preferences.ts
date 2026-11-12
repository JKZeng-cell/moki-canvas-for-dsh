import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import type {WhiteboardStore} from './store.js';

const key = 'interface-language';
const preferenceSchema = z.object({language: z.enum(['zh-CN', 'en'])}).strict();
export function registerUiPreferences(app: FastifyInstance, store: WhiteboardStore) {
  store.db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY,value_json TEXT NOT NULL)');
  app.get('/api/preferences', async () => {
    const row = store.db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(key);
    if (!row) return {language: null};
    const value = preferenceSchema.safeParse(JSON.parse(String(row.value_json)));
    return value.success ? value.data : {language: null};
  });
  app.put('/api/preferences', async request => {
    const value = preferenceSchema.parse(request.body);
    store.db.prepare('INSERT OR REPLACE INTO app_settings (key,value_json) VALUES (?,?)').run(key, JSON.stringify(value));
    return value;
  });
}
