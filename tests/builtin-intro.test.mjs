import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createRuntime } from '../lib/host.mjs'

test('built-in guide is editable, self-contained, seeded once, and respects edits and deletion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moki-intro-test-'))
  let runtime
  try {
    runtime = await createRuntime({dataDir:dir})
    const id = runtime.introductionId, board = runtime.store.get(id)
    const second = await createRuntime({dataDir:dir})
    try {
      assert.equal(second.introductionId,id)
      assert.equal(second.store.list().filter(item=>item.title===board.title).length,1)
    } finally { await second.close() }
    const records = Object.values(board.snapshot.document.store)
    assert.equal(records.filter(r => r.typeName === 'page').length, 6)
    assert.equal(records.filter(r => r.typeName === 'page_group').length, 2)
    assert.equal(board.snapshot.session.currentPageId, 'page:intro-welcome')
    for (const type of ['note','text','geo','arrow','draw','bezier','image','resource','link','media','group-folder']) assert.ok(records.some(r => r.typeName==='shape' && r.type===type), type)
    const root = records.find(r => r.meta?.introRole==='mindmap-root')
    const nodes = records.filter(r => r.props?.mokiMindMapNode)
    assert.equal(nodes.length, 13)
    for (const node of nodes.filter(r => r.id!==root.id)) assert.ok(nodes.some(parent => parent.id===node.props.mokiMindMapParentId))
    const copy = runtime.store.duplicate(id, 'Guide interaction test', 'test')
    const expanded = await runtime.invoke('whiteboard_native_edit', {boardId:copy.id,expectedVersion:copy.version,pageId:root.parentId,action:'mindmap_children',ids:[root.id],nodes:[{key:'new',text:'New branch',width:300},{parentId:'new',text:'New child'}]}, 'test')
    assert.equal(expanded.nodes.length, 2)
    assert.equal(expanded.nodes[1].parentId, expanded.keys.new)
    assert.equal(runtime.store.get(id).version, board.version)
    for(const item of records.filter(r=>r.typeName==='asset'))assert.match(item.props.src,/^data:(image\/png|audio\/wav|video\/mp4);base64,/)
    const file = records.find(r=>r.type==='resource')
    assert.ok(file.props.localPath.startsWith(dir+sep))
    const preview = await fetch(new URL('api/library/items/'+file.props.libraryItemId+'/content',runtime.appUrl))
    assert.equal(preview.status,200)
    assert.match((await preview.json()).content,/行前清单/)
    runtime.store.rename(id,'My edited introduction','test',board.version)
    await writeFile(file.props.localPath,'My edited attachment')
    const count = runtime.store.list().length
    await runtime.close()
    runtime = await createRuntime({dataDir:dir})
    assert.equal(runtime.introductionId,id)
    assert.equal(runtime.store.list().length,count)
    assert.equal(runtime.store.get(id).title,'My edited introduction')
    assert.equal(await readFile(file.props.localPath,'utf8'),'My edited attachment')
    runtime.store.delete(id,'test')
    await runtime.close()
    runtime = await createRuntime({dataDir:dir})
    assert.equal(runtime.store.list().length,count-1)
    assert.ok(!runtime.store.list().some(b=>b.id===id))
  } finally {
    await runtime?.close()
    const target=resolve(dir)
    if(!target.startsWith(resolve(tmpdir())+sep)||!target.includes('moki-intro-test-'))throw Error('Unsafe cleanup')
    await rm(target,{recursive:true,force:true})
  }
})
