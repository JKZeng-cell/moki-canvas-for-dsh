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
function wireKey(selection){const {visualAttachments,...content}=JSON.parse(selection.content);return JSON.stringify(['board:a',selection.source,selection.itemCount,JSON.stringify(content)])}
function wireScope(selection){const content=JSON.parse(selection.content);return JSON.stringify(['board:a',selection.source,content.pageId,content.selectedShapes.map(shape=>shape.id).sort()])}

async function harness(t){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://dsh.test/'}),win=dom.window
  const previous=new Map()
  for(const [key,value] of Object.entries({window:win,document:win.document,HTMLElement:win.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}
  const components=new Map(),requests=[],inserted=[],attachments=[],sent=[],timeouts=new Set()
  const state={value:{draft:'原有草稿',phase:'plain',attachmentIds:[]},listeners:new Set(),get:()=>state.value,subscribe:fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn)},set:patch=>{state.value={...state.value,...patch};for(const fn of state.listeners)fn()}}
  let plugin,failImages=false,visible=true
  win.__ModuleLoader__={load:entry=>{plugin=entry.factory(require)}}
  runInNewContext(clientSource,{window:win,document:win.document,location:win.location,localStorage:win.localStorage,console,crypto:globalThis.crypto,URL,URLSearchParams,ArrayBuffer,File,AbortController,MutationObserver:win.MutationObserver,getComputedStyle:win.getComputedStyle.bind(win),requestAnimationFrame:fn=>setImmediate(fn),CSS:{escape:value=>value},fetch:async()=>new Response(JSON.stringify({running:true,appUrl:'http://moki.test/'})),
    setTimeout:(fn,ms)=>{if(ms!==15000)return setTimeout(fn,ms);const timer={fn};timeouts.add(timer);return timer},clearTimeout:timer=>{if(timeouts.has(timer))timeouts.delete(timer);else clearTimeout(timer)}})
  const ctx={effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>key=>({selectionHint:'白板选区',selected:'已选 {count} 项',add:'加入对话',added:'已加入草稿',textOnly:'截图未就绪',changed:'选区已变化',timedOut:'读取超时'}[key]??key)},slots:{inject:(_name,fn)=>fn(),register:(spec,component)=>{components.set(spec.name,component);return()=>{}}},sidebarRightTabs:{register:()=>()=>{}},conversation:{createDrafts:(_id,files)=>{if(failImages)throw new Error('upload failed');return files.map((file,i)=>({id:`image-${i}`,file}))},releaseDraftAttachments:()=>{}},layout:{},sidebarRight:{},uiWorkspace:{}}
  ctx.sessions={retain:sessionId=>({ready:Promise.resolve(),binding:{session:{sessionId,getSnapshot:()=>({subagent:null})}},release(){}})}
  ctx.conversation.fileUploads={getSnapshot:()=>({'image-0':{status:'ready'},'image-1':{status:'ready'}})}
  ctx.conversation.sendSession=async(session,text,ids)=>{sent.push({sessionId:session.sessionId,text,ids});return{kind:'success'}}
  const registrations=new Map(), panelListeners=new Set(), sessionListeners=new Set()
  const navigation={panel:null,session:'a',ready:true,starts:0,opened:[]}
  const register=ctx.slots.register
  ctx.slots.register=(spec,component)=>{registrations.set(spec.name,spec);return register(spec,component)}
  ctx.layout={
    panelInfo:{getSnapshot:()=>({activePanelId:navigation.panel}),subscribe:fn=>{panelListeners.add(fn);return()=>panelListeners.delete(fn)}},
    selectPanel:id=>{navigation.panel=id;for(const fn of panelListeners)fn()},
  }
  navigation.selectSession=id=>{navigation.session=id;for(const fn of sessionListeners)fn()}
  ctx.uiSession={adapter:{current:{getSnapshot:()=>({key:navigation.session}),subscribe:fn=>{sessionListeners.add(fn);return()=>sessionListeners.delete(fn)}}}}
  ctx.uiWorkspace.startSession=()=>{navigation.starts++}
  ctx.sidebarRight={
    mounted:{getSnapshot:()=>navigation.session},
    openTab:kind=>{
      if(!navigation.ready)throw new Error('sidebarRight: no session surface is mounted')
      navigation.opened.push([kind,navigation.session])
    },
  }
  let activeLocale='zh';const localeListeners=new Set()
  ctx.locale.getSnapshot=()=>({active:activeLocale})
  ctx.locale.subscribe=fn=>{localeListeners.add(fn);return()=>localeListeners.delete(fn)}
  const changeLocale=async value=>act(async()=>{activeLocale=value;for(const fn of localeListeners)fn()})
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
  return {win,state,inserted,attachments,sent,message,select,requests,timeouts,navigation,registrations,changeLocale,selectPanel:ctx.layout.selectPanel,failImages:()=>{failImages=true},hint:()=>win.document.querySelector('[data-chat="a"] .moki-composer-selection-main'),click:()=>act(async()=>win.document.querySelector('[data-chat="a"] .moki-composer-selection-main').click()),hide:()=>act(async()=>{visible=false;render()})}
}

test('the native sidebar row returns to the same chat and opens its canvas',async t=>{
  const {navigation,registrations,selectPanel}=await harness(t)
  const row=registrations.get('sidebar.panellist')
  assert.equal(row.id,'moki-whiteboard')
  assert.equal(registrations.get('main').key,row.id)
  assert.equal(registrations.has('sidebar.footer.action'),false)
  selectPanel('plugins')
  selectPanel(row.id)
  selectPanel(row.id)
  assert.equal(navigation.panel,null)
  assert.equal(navigation.starts,0)
  assert.deepEqual(navigation.opened,[[row.id,'a'],[row.id,'a']])
})

test('sidebar launch waits for a new chat and cancels if the user navigates away',async t=>{
  const {navigation,selectPanel}=await harness(t)
  navigation.selectSession(undefined)
  selectPanel('moki-whiteboard')
  assert.equal(navigation.starts,1)
  navigation.selectSession('b')
  assert.deepEqual(navigation.opened,[['moki-whiteboard','b']])

  navigation.ready=false
  selectPanel('moki-whiteboard')
  selectPanel('plugins')
  navigation.ready=true
  await new Promise(resolve=>setTimeout(resolve,130))
  assert.equal(navigation.panel,'plugins')
  assert.equal(navigation.opened.length,1)
})

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

test('canvas language updates selection controls, preserving the draft and rejecting foreign frame messages',async t=>{
  const h=await harness(t)
  await h.select(makeSelection())
  const draft=h.state.value.draft
  await h.message({type:'moki:language',language:'en'},'http://untrusted.test')
  assert.match(h.hint().textContent,/已选 1 项/)
  await h.message({type:'moki:language',language:'en'})
  assert.match(h.hint().textContent,/Whiteboard selection · 1 selected/)
  assert.match(h.hint().textContent,/Add to chat/)
  assert.equal(h.state.value.draft,draft)
  await h.message({type:'moki:language',language:'unknown'})
  assert.match(h.hint().textContent,/Whiteboard selection/)
  await h.message({type:'moki:language',language:'zh-CN'})
  assert.match(h.hint().textContent,/白板选区/)
})

test('passes the actual DSH locale at startup and forwards changes without reloading the canvas or draft',async t=>{
  const h=await harness(t),frame=h.win.document.querySelector('iframe'),url=frame.src,draft=h.state.value.draft
  assert.equal(new URL(url).searchParams.get('dshLanguage'),'zh')
  assert.equal(h.requests.filter(r=>r.type==='dsh:language').at(-1).language,'zh')
  await h.select(makeSelection()); await h.changeLocale('en')
  assert.equal(h.requests.filter(r=>r.type==='dsh:language').at(-1).language,'en')
  await h.changeLocale('ja'); await h.message({type:'moki:ready'})
  assert.equal(h.requests.filter(r=>r.type==='dsh:language').at(-1).language,'ja')
  assert.equal(h.win.document.querySelector('iframe'),frame)
  assert.equal(frame.src,url);assert.equal(h.state.value.draft,draft)
  assert.equal(h.hint().disabled,false)
})

test('inline text action inserts only the highlighted excerpt, acknowledges it, and never warns about an intentional text-only quote',async t=>{
  const h=await harness(t),whole=makeSelection('只引用这一句。其他私人内容不要加入。')
  const text={...whole,label:'白板划选文字',content:JSON.stringify({kind:'whiteboard_text_selection',pageId:'page:moki',shapeId:'shape:a',selectedText:'只引用这一句。',range:{start:0,end:7}})}
  await h.select(whole)
  const start=()=>h.message({type:'moki:quote-request',requestId:'inline-a',boardId:'board:a',selectionKey:wireKey(whole),selectionScope:wireScope(whole),quoteKey:wireKey(text)})
  const reply=()=>h.message({type:'moki:quote',requestId:'inline-a',boardId:'board:a',selection:text,images:[]})
  await start()
  assert.equal(h.requests.filter(r=>r.type==='dsh:quote').at(-1).requestId,'inline-a')
  const committed={...whole,content:JSON.stringify({...JSON.parse(whole.content),selectedShapes:[{id:'shape:a',type:'text',text:'只引用这一句。其他私人内容不要加入。',width:310}]})}
  await h.select(committed)
  await reply();await reply()
  assert.equal(h.inserted.length,1)
  assert.ok(h.state.value.draft.startsWith('原有草稿'))
  assert.ok(h.inserted[0].includes('只引用这一句。'))
  assert.ok(!h.inserted[0].includes('其他私人内容'))
  assert.equal(h.attachments.length,0)
  assert.equal(h.requests.filter(r=>r.type==='dsh:quote-result').at(-1).ok,true)
  assert.equal(h.requests.filter(r=>r.type==='dsh:quote-result').at(-1).message,undefined)
  await start();await reply()
  assert.equal(h.inserted.length,1,'re-clicking the same excerpt does not duplicate the quote')
  await start();await h.select({...committed,content:JSON.stringify({pageId:'page:moki',selectedShapes:[{id:'shape:b',text:'另一个对象'}]})});await reply()
  assert.equal(h.requests.filter(r=>r.type==='dsh:quote-result').at(-1).ok,false)
  assert.equal(h.inserted.length,1,'a different object still invalidates the text snapshot')
})

test('inline quote cannot bypass busy input, cancellation, changed selections or a hidden conversation',async t=>{
  const h=await harness(t),selection=makeSelection()
  await h.select(selection)
  const start=()=>h.message({type:'moki:quote-request',requestId:'inline-a',boardId:'board:a',selectionKey:wireKey(selection),quoteKey:wireKey(selection)})
  const reply=()=>h.message({type:'moki:quote',requestId:'inline-a',boardId:'board:a',selection,images:[]})
  await act(async()=>h.state.set({phase:'sending'}));await start()
  assert.equal(h.requests.filter(r=>r.type==='dsh:quote').length,0)
  assert.equal(h.requests.filter(r=>r.type==='dsh:quote-result').at(-1).ok,false)
  await act(async()=>h.state.set({phase:'plain'}));await start()
  await h.message({type:'moki:quote-cancel',requestId:'inline-a'});await reply()
  assert.equal(h.inserted.length,0)
  await start();await h.select(makeSelection('另一个选区'));await reply()
  assert.equal(h.inserted.length,0)
  await h.select(selection);await start();await h.hide();await reply()
  assert.equal(h.inserted.length,0)
  assert.equal(h.requests.filter(r=>r.type==='dsh:quote-result').at(-1).ok,false)
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


test('quick instructions send their captured selection and attachments without appending or sending the existing draft',async t=>{
  const h=await harness(t),selection=makeSelection()
  await h.select(selection)
  const key=wireKey(selection)
  await h.message({type:'moki:quote-request',requestId:'quick-1',boardId:'board:a',selectionKey:key,quoteKey:key,submit:true})
  assert.equal(h.requests.at(-1).type,'dsh:quote')
  await h.message({type:'moki:quote',requestId:'quick-1',boardId:'board:a',selection,images:[],submission:{id:'quick-1',prompt:'Only edit this selection',files:[new File(['Attached brief'],'brief.txt',{type:'text/plain'})]}})
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20))})
  assert.equal(h.sent.length,1);assert.equal(h.sent[0].sessionId,'a')
  assert.match(h.sent[0].text,/Only edit this selection/);assert.match(h.sent[0].text,/露营装备/)
  assert.equal(h.state.value.draft,'原有草稿');assert.equal(h.inserted.length,0);assert.equal(h.attachments.length,0)
  assert.equal(h.sent[0].ids.length,1)
  assert.equal(h.requests.find(r=>r.type==='dsh:quote-result'&&r.requestId==='quick-1')?.ok,true)
})
