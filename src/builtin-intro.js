import { constants, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const ROOT = fileURLToPath(new URL('../builtin', import.meta.url))
const KEY = 'moki-for-dsh-introduction'

/** Seed once per database. The receipt survives rename, edits and deliberate deletion. */
export function ensureBuiltinIntroduction(store, dataDir) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS moki_plugin_builtins (
    key TEXT PRIMARY KEY, board_id TEXT NOT NULL, revision INTEGER NOT NULL)`)
  store.db.exec('BEGIN IMMEDIATE')
  try {
    const existing = store.db.prepare('SELECT board_id FROM moki_plugin_builtins WHERE key=?').get(KEY)
    if (existing) {
      store.db.exec('COMMIT')
      return String(existing.board_id)
    }
    const template = JSON.parse(readFileSync(join(ROOT, 'introduction.json'), 'utf8'))
    const snapshot = structuredClone(template.snapshot)
    const resourceRoot = join(dataDir, 'builtin', KEY)
    mkdirSync(resourceRoot, { recursive: true })
    for (const file of template.files) {
      // Filenames are authored with the package, never derived from board content.
      if (file.name !== file.name.split(/[\\/]/).pop() || file.name.includes('..')) throw new Error('Invalid built-in filename')
      const target = join(resourceRoot, file.name)
      if (!existsSync(target)) copyFileSync(join(ROOT, file.name), target, constants.COPYFILE_EXCL)
      const id = randomUUID(), now = new Date().toISOString()
      store.db.prepare('INSERT INTO native_library(id,item_json) VALUES (?,?)').run(id, JSON.stringify({
        id, parentId: null, kind: 'local_file', name: file.name, target, tags: ['MOKI 简介'], createdAt: now, updatedAt: now,
      }))
      for (const record of Object.values(snapshot.document.store)) {
        if (record.typeName === 'shape' && record.props?.source === file.reference) {
          record.props = { ...record.props, source: target, localPath: target, libraryItemId: id }
        }
      }
    }
    const board = store.create(template.title, 'builtin-introduction', snapshot)
    store.db.prepare('INSERT INTO moki_plugin_builtins VALUES (?,?,?)').run(KEY, board.id, template.revision)
    store.db.exec('COMMIT')
    return board.id
  } catch (error) {
    store.db.exec('ROLLBACK')
    throw error
  }
}
