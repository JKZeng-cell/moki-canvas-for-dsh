import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,sep} from 'node:path'
import {createRuntime,apply} from '../lib/host.mjs'

test('DSH tools use valid JSON Schema, share the real canvas, and reject stale writes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'moki-dsh-test-'))
  const cleanups=[],tools=new Map(),routes=[],contexts=[]
  const ctx={effect:fn=>{const dispose=fn();cleanups.push(dispose);return dispose},
    tools:{register:t=>{tools.set(t.name,t);return()=>tools.delete(t.name)}},
    webServer:{register:r=>{routes.push(r);return()=>{}}},
    systemPrompt:{section:()=>()=>{},context:c=>{contexts.push(c);return()=>{}}}}
  let url,boardId
  try{
    await apply(ctx,{dataDir:dir})
    for(const name of ['whiteboard_list','whiteboard_inspect','whiteboard_create','whiteboard_add_elements','whiteboard_native_edit','whiteboard_get_selection'])assert.ok(tools.has(name),name)
    for(const tool of tools.values()){
      assert.equal(tool.parameters.type,'object',tool.name)
      assert.ok(tool.parameters.properties,tool.name)
      if(tool.parameters.required)assert.ok(tool.parameters.required.every(key=>typeof key==='string'),tool.name)
    }
    const info=await (await routes[0].resource()).json();url=info.appUrl
    assert.equal(routes[0].kind,'exact')
    assert.equal((await fetch(new URL('api/health',url))).status,200)
    assert.deepEqual(await (await fetch(new URL('api/preferences',url))).json(),{language:null})
    const languageSaved=await fetch(new URL('api/preferences',url),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({language:'en'})})
    assert.equal(languageSaved.status,200)
    assert.deepEqual(await languageSaved.json(),{language:'en'})
    const exec=(name,args={},sessionId='chat-a')=>tools.get(name).execute(args,{agent:{session:{id:sessionId}}})
    const created=await exec('whiteboard_create',{title:'DSH integration test'})
    boardId=created.board.id
    const before=await exec('whiteboard_inspect',{boardId})
    const pageId=before.pages[0].id
    const added=await exec('whiteboard_add_elements',{boardId,pageId,expectedVersion:before.board.version,elements:[{kind:'note',text:'Selected note',x:30,y:40}]})
    assert.equal(added.elementIds.length,1)
    const stale=await exec('whiteboard_update_elements',{boardId,expectedVersion:before.board.version,updates:[{id:added.elementIds[0],text:'Must not overwrite'}]})
    assert.equal(stale.error.code,'VERSION_CONFLICT')
    const inspected=await exec('whiteboard_inspect',{boardId})
    assert.ok(JSON.stringify(inspected).includes('Selected note'))
    assert.ok(!JSON.stringify(inspected).includes('Must not overwrite'))
    const invalid=await exec('whiteboard_add_elements',{boardId,pageId,elements:[{kind:'invalid-type'}]}).catch(error=>({error:String(error)}))
    assert.ok(invalid.error||invalid.isError)
    assert.equal((await exec('whiteboard_inspect',{boardId})).board.version,inspected.board.version)
    const post=body=>fetch(new URL('api/dsh/context',url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
    const active={sessionId:'chat-a',instanceId:'frame-a',boardId,selection:{source:'whiteboard',label:'one note',content:'Selected note',itemCount:1,capturedAt:new Date().toISOString()},active:true}
    assert.equal((await post(active)).status,200)
    assert.equal((await exec('whiteboard_get_selection')).selection.content,'Selected note')
    assert.equal((await exec('whiteboard_get_selection',{},'chat-b')).selection,null)
    assert.equal((await exec('whiteboard_inspect',{boardId},'chat-b')).agentContext.selection,null)
    assert.equal((await exec('whiteboard_inspect')).board.id,boardId)
    assert.match(contexts[0].text({scope:{session:{id:'chat-a'}}}),new RegExp(boardId))
    assert.equal(contexts[0].text({scope:{session:{id:'chat-b'}}}),'')
    await post({...active,instanceId:'stale-frame',active:false})
    assert.ok((await exec('whiteboard_get_selection')).selection)
    await post({...active,selection:null})
    assert.equal((await exec('whiteboard_get_selection')).selection,null)
    await post({...active,active:false})
    assert.equal((await exec('whiteboard_inspect')).error.code,'BOARD_REQUIRED')
    const map=await exec('whiteboard_add_elements',{boardId,pageId,elements:[{kind:'mindmap',text:'Native DSH tree',layout:'both',width:320,branches:[{title:'Research',children:['Long text is preserved and editable']},'Delivery']}]})
    assert.equal(map.nodes.length,4)
    const batch=await exec('whiteboard_native_edit',{boardId,pageId,expectedVersion:map.version,action:'mindmap_children',ids:[map.nodes[0].id],nodes:[{key:'branch',text:'Batch branch',width:380},{parentId:'branch',text:'Batch leaf'}]})
    assert.equal(batch.version,map.version+1)
    assert.equal(batch.nodes.length,2)
    assert.equal(batch.nodes[1].parentId,batch.keys.branch)
    assert.equal(batch.nodes[1].width,380)
    assert.equal(batch.shapes,undefined)
    const full=await exec('whiteboard_inspect',{boardId})
    assert.ok(JSON.stringify(full).includes('Batch leaf'))
    const badBatch=await exec('whiteboard_native_edit',{boardId,pageId,expectedVersion:batch.version,action:'mindmap_children',ids:[map.nodes[0].id],nodes:[{text:'Must roll back'},{text:'Invalid parent',parentId:'missing'}]})
    assert.equal(badBatch.error.code,'OPERATION_FAILED')
    assert.equal((await exec('whiteboard_inspect',{boardId})).board.version,batch.version)
    const blocked=await fetch(new URL('api/boards',url),{method:'POST',headers:{'content-type':'application/json','sec-fetch-site':'cross-site'},body:JSON.stringify({title:'Blocked'})})
    assert.equal(blocked.status,403)
  }finally{
    for(const dispose of cleanups.reverse())await dispose?.()
  }
  const reopened=await createRuntime({dataDir:dir})
  try{
    assert.deepEqual(await (await fetch(new URL('api/preferences',reopened.appUrl))).json(),{language:'en'})
    assert.equal(reopened.store.get(boardId).title,'DSH integration test')
    assert.ok(JSON.stringify(reopened.store.get(boardId).snapshot).includes('Batch leaf'))
    assert.ok(!JSON.stringify(reopened.store.get(boardId).snapshot).includes('Must roll back'))
    assert.equal(reopened.getSelection('chat-a').selection,null)
  }finally{
    await reopened.close()
    const target=resolve(dir),parent=resolve(tmpdir())+sep
    if(!target.startsWith(parent)||!target.includes('moki-dsh-test-'))throw new Error('Unsafe test cleanup path')
    await rm(target,{recursive:true,force:true})
  }
  assert.equal(tools.size,0)
  await assert.rejects(fetch(new URL('api/health',url)))
})
