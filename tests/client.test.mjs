import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {runInNewContext} from 'node:vm'

const require=createRequire(process.env.MOKI_REPO ? resolve(process.env.MOKI_REPO,'package.json') : new URL('../vendor/moki/package.json',import.meta.url))
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom')
const clientSource=await readFile(new URL('../client.js',import.meta.url),'utf8')
function makeSelection(text='露营装备',count=1){return {source:'whiteboard',label:`白板已选 ${count} 项`,itemCount:count,capturedAt:new Date().toISOString(),content:JSON.stringify({kind:'whiteboard_selection',pageId:'page:moki',selectedShapes:[{id:'shape:a',type:'geo',text}],visualAttachments:[{imageSource:'/api/whiteboard/assets/one.png'}]})}}

async function harness(t){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://dsh.test/'}),win=dom.window
  const previous=new Map()
  for(const [key,value] of Object.entries({window:win,document:win.document,HTMLElement:win.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
  const components=new Map(),requests=[],inserted=[],attachments=[],timeouts=new Set()
  const state={value:{draft:'原有草稿',phase:'plain',attachmentIds:[]},listeners:new Set(),get:()=>state.value,subscribe:fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn)},set:patch=>{state.value={...state.value,...patch};for(const fn of state.listeners)fn()}}
  let plugin,failImages=false,visible=true
  win.__ModuleLoader__={load:entry=>{plugin=entry.factory(require)}}
  runInNewContext(clientSource,{window:win,document:win.document,location:win.location,localStorage:win.localStorage,console,crypto:globalThis.crypto,URL,URLSearchParams,ArrayBuffer,File,AbortController,MutationObserver:win.MutationObserver,getComputedStyle:win.getComputedStyle.bind(win),fetch:async()=>new Response(JSON.stringify({running:true,appUrl:'http://moki.test/'})),
    setTimeout:(fn,ms)=>{if(ms!==15000)return setTimeout(fn,ms);const timer={fn};timeouts.add(timer);return timer},clearTimeout:timer=>{if(timeouts.has(timer))timeouts.delete(timer);else clearTimeout(timer)}})
  const ctx={effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>key=>({selectionHint:'白板选区',selected:'已选 {count} 项',add:'加入对话',added:'已加入草稿',textOnly:'截图未就绪',changed:'选区已变化',timedOut:'读取超时'}[key]??key)},slots:{inject:(_name,fn)=>fn(),register:(spec,component)=>{components.set(spec.name,component);return()=>{}}},sidebarRightTabs:{register:()=>()=>{}},conversation:{createDrafts:(_id,files)=>{if(failImages)throw new Error('upload failed');return files.map((file,i)=>({id:`image-${i}`,file}))},releaseDraftAttachments:()=>{}},layout:{},sidebarRight:{},uiWorkspace:{}}
  plugin.apply(ctx)
  const actions={insertQuote:text=>{inserted.push(text);state.set({draft:state.value.draft+'\n\n'+text.split('\n').map(line=>'> '+line).join('\n')});return true},addAttachments:ids=>{attachments.push(...ids);state.set({attachmentIds:[...state.value.attachmentIds,...ids]});return true},persistDraft:()=>{}}
  const useInput=select=>select(React.useSyncExternalStore(state.subscribe,state.get,state.get))
  const Panel=components.get('sidebar.right.pane.tab'),Hint=components.get('conversation.input.dock'),root=createRoot(win.document.getElementById('root'))
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}})
  const render=()=>root.render(React.createElement(React.Fragment,null,React.createElement(Panel,{sessionId:'a',inputActions:actions,useInput,useSession:fn=>fn({subagent:null}),useTabInfo:()=>({tab:{visible}})}),React.createElement('section',{'data-chat':'a'},React.createElement(Hint,{sessionId:'a',useInput})),React.createElement('section',{'data-chat':'b'},React.createElement(Hint,{sessionId:'b',useInput}))))
  await act(async()=>{render();await new Promise(resolve=>setImmediate(resolve))})
  const frame=win.document.querySelector('iframe'),bridgeId=new URL(frame.src).searchParams.get('dshBridge')
  frame.contentWindow.postMessage=message=>requests.push(message)
  const message=async(data,origin='http://moki.test',source=frame.contentWindow)=>act(async()=>{win.dispatchEvent(new win.MessageEvent('message',{origin,source,data:{bridgeId,...data}}))})
  const select=selection=>message({type:'moki:state',boardId:'board:a',selection})
  await message({type:'moki:ready'});await select(null)
  return {win,state,inserted,attachments,message,select,requests,timeouts,failImages:()=>{failImages=true},hint:()=>win.document.querySelector('[data-chat="a"] .moki-composer-selection-main'),click:()=>act(async()=>win.document.querySelector('[data-chat="a"] .moki-composer-selection-main').click()),hide:()=>act(async()=>{visible=false;render()})}
}

test('composer hint adds one native quote and image, keeps typed text and allows re-adding after removal',async t=>{
  const h=await harness(t),selection=makeSelection()
  assert.equal(h.hint().disabled,true)
  await h.select(selection)
  assert.match(h.hint().textContent,/已选 1 项/)
  assert.equal(h.win.document.querySelector('[data-chat="b"] .moki-composer-selection'),null)
  await h.click();await h.click()
  const requests=h.requests.filter(r=>r.type==='dsh:quote')
  assert.equal(requests.length,1)
  await h.message({type:'moki:quote',requestId:requests[0].requestId,boardId:'board:a',selection,images:[{name:'选区.png',mediaType:'image/png',bytes:new Uint8Array([1,2,3]).buffer}]})
  assert.equal(h.inserted.length,1);assert.equal(h.attachments.length,1)
  assert.ok(h.state.value.draft.startsWith('原有草稿'))
  assert.ok(h.inserted[0].includes('露营装备'))
  assert.ok(!h.inserted[0].includes('visualAttachments'))
  assert.equal(h.hint().disabled,true)
  assert.match(h.hint().textContent,/已加入草稿/)
  await act(async()=>h.state.set({draft:'原有草稿'}))
  assert.equal(h.hint().disabled,false)
  await h.click()
  const again=h.requests.filter(r=>r.type==='dsh:quote').at(-1)
  await h.message({type:'moki:quote',requestId:again.requestId,boardId:'board:a',selection,images:[{name:'选区.png',mediaType:'image/png',bytes:new Uint8Array([1,2,3]).buffer}]})
  assert.equal(h.inserted.length,2)
  assert.equal(h.attachments.length,1,'reuses the image still attached after removing its quote')
})

test('rejects foreign messages, changed selections and late responses after hiding the panel',async t=>{
  const h=await harness(t),selection=makeSelection()
  await h.message({type:'moki:state',boardId:'wrong',selection},'http://other.test')
  assert.equal(h.hint().disabled,true)
  await h.select(selection);await h.click()
  const first=h.requests.filter(r=>r.type==='dsh:quote').at(-1)
  await h.select(makeSelection('新的内容'))
  await h.message({type:'moki:quote',requestId:first.requestId,boardId:'board:a',selection,images:[]})
  assert.equal(h.inserted.length,0)
  await h.click()
  const second=h.requests.filter(r=>r.type==='dsh:quote').at(-1)
  await h.hide()
  await h.message({type:'moki:quote',requestId:second.requestId,boardId:'board:a',selection:makeSelection('新的内容'),images:[]})
  assert.equal(h.inserted.length,0);assert.equal(h.hint(),null)
})

test('busy input and request timeouts leave the draft intact; attachment failure keeps a clear text-only receipt',async t=>{
  const h=await harness(t),selection=makeSelection()
  await h.select(selection)
  await act(async()=>h.state.set({phase:'sending'}));assert.equal(h.hint().disabled,true)
  await act(async()=>h.state.set({phase:'plain'}));await h.click()
  const first=h.requests.filter(r=>r.type==='dsh:quote').at(-1)
  await act(async()=>[...h.timeouts][0].fn())
  assert.match(h.hint().textContent,/读取超时/)
  await h.message({type:'moki:quote',requestId:first.requestId,boardId:'board:a',selection,images:[]})
  assert.equal(h.inserted.length,0)
  await h.click();h.failImages()
  const second=h.requests.filter(r=>r.type==='dsh:quote').at(-1)
  await h.message({type:'moki:quote',requestId:second.requestId,boardId:'board:a',selection,images:[{name:'选区.png',mediaType:'image/png',bytes:new ArrayBuffer(4)}]})
  assert.equal(h.inserted.length,1);assert.equal(h.attachments.length,0)
  assert.match(h.hint().textContent,/截图未就绪/)
})
