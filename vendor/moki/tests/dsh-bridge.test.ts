// @vitest-environment jsdom
import {act, cleanup, render, waitFor} from '@testing-library/react';
import {createElement} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {dshSelectionKey} from '../src/web/dsh-selection.js';

const storageKey='moki.current-workbench-selection';
const selected=(text='准备帐篷',image=true)=>({source:'whiteboard',label:'白板已选 1 项',itemCount:1,capturedAt:new Date().toISOString(),content:JSON.stringify({kind:'whiteboard_selection',pageId:'page:moki',selectedShapes:[{id:'shape:a',text}],...(image?{visualAttachments:[{name:'选区.png',imageSource:'/api/whiteboard/assets/selection.png'}]}:{})})});
let parentWindow: Window, post: ReturnType<typeof vi.fn>, fetchMock: ReturnType<typeof vi.fn>;
beforeEach(()=>{
  vi.resetModules();sessionStorage.clear();localStorage.clear();localStorage.setItem('moki-whiteboard-language','zh-CN');window.mokiDshEmbed=true;
  history.replaceState({},'','/?dshSession=chat-a&dshBridge=bridge-a&dshParent=http%3A%2F%2Fdsh.test');
  const iframe=document.createElement('iframe');document.body.append(iframe);parentWindow=iframe.contentWindow!;
  post=vi.fn();Object.defineProperty(parentWindow,'postMessage',{configurable:true,value:post});vi.stubGlobal('parent',parentWindow);
  fetchMock=vi.fn(async(url:string)=>String(url).startsWith('/api/dsh/context')?new Response('{"ok":true}',{headers:{'content-type':'application/json'}}):new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}}));
  vi.stubGlobal('fetch',fetchMock);
});
afterEach(()=>{cleanup();document.body.replaceChildren();vi.unstubAllGlobals();delete window.mokiDshEmbed;});
async function mount(flush:()=>Promise<void>=async()=>{}){
  const {useDshBridge}=await import('../src/web/dsh-bridge.js');
  function Bridge(){useDshBridge('board:a',flush,()=>{});return null;}
  render(createElement(Bridge));
  await waitFor(()=>expect(post.mock.calls.some(call=>call[0].type==='moki:ready')).toBe(true));
}
async function choose(selection:ReturnType<typeof selected>){await act(async()=>{sessionStorage.setItem(storageKey,JSON.stringify(selection));dispatchEvent(new Event('workbench:selection-context-changed'));});}
async function request(selection:ReturnType<typeof selected>,origin='http://dsh.test'){
  await act(async()=>{dispatchEvent(new MessageEvent('message',{source:parentWindow,origin,data:{type:'dsh:quote',bridgeId:'bridge-a',requestId:'request-a',selectionKey:dshSelectionKey('board:a',selection)}}));});
}
function messages(type:string){return post.mock.calls.map(call=>call[0]).filter(message=>message.type===type);}

describe('DSH selection transfer',()=>{
  it('only follows language messages from its authenticated DSH parent and preserves manual choices',async()=>{
    localStorage.setItem('moki-whiteboard-language','dsh');
    await mount();
    const {getLanguage,getLanguagePreference,setDshLanguage,setLanguage}=await import('../src/web/i18n.js');
    act(()=>setDshLanguage('zh'));
    const change=async(language:unknown,origin='http://dsh.test',bridgeId='bridge-a',source:Window=parentWindow)=>act(async()=>{
      dispatchEvent(new MessageEvent('message',{source,origin,data:{type:'dsh:language',bridgeId,language}}));
    });
    await change('en','http://untrusted.test'); await change('en','http://dsh.test','wrong'); await change('en','http://dsh.test','bridge-a',window);
    expect(getLanguage()).toBe('zh-CN');
    await change('en');
    expect(getLanguage()).toBe('en'); expect(getLanguagePreference()).toBe('dsh');
    expect(messages('moki:language').at(-1)).toMatchObject({language:'en'});
    await change(null); expect(getLanguage()).toBe('en');
    act(()=>setLanguage('zh-CN')); await change('en');
    expect(getLanguage()).toBe('zh-CN'); expect(getLanguagePreference()).toBe('zh-CN');
    expect(fetchMock.mock.calls.some(call=>call[0]==='/api/preferences')).toBe(false);
  });
  it('waits for the matching selection image and sends a correlated snapshot',async()=>{
    await mount();const before=selected('准备帐篷',false);await choose(before);await request(before);
    const withImage=selected();expect(dshSelectionKey('board:a',before)).toBe(dshSelectionKey('board:a',withImage));
    await choose(withImage);
    await waitFor(()=>expect(messages('moki:quote')).toHaveLength(1));
    expect(messages('moki:quote')[0]).toMatchObject({requestId:'request-a',boardId:'board:a',selection:{itemCount:1},images:[{name:'选区.png',mediaType:'image/png'}],imageWarning:false});
    expect(messages('moki:quote')[0].images[0].bytes.byteLength).toBe(3);
  });

  it.each(['save','image'] as const)('rejects a selection changed while awaiting %s',async stage=>{
    let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
    if(stage==='image')fetchMock.mockImplementation(async(url:string)=>{if(!String(url).startsWith('/api/dsh/context'))await pending;return new Response(String(url).startsWith('/api/dsh/context')?'{}':'png',{headers:{'content-type':String(url).startsWith('/api/dsh/context')?'application/json':'image/png'}});});
    await mount(stage==='save'?()=>pending:async()=>{});
    const original=selected();await choose(original);await request(original);await choose(selected('已经换成另一项'));
    await act(async()=>release());
    await waitFor(()=>expect(messages('moki:error').some(message=>message.requestId==='request-a')).toBe(true));
    expect(messages('moki:quote')).toHaveLength(0);
    expect(messages('moki:error').at(-1).message).toContain('选区已变化');
  });

  it('keeps selected text available when image loading fails',async()=>{
    fetchMock.mockImplementation(async(url:string)=>new Response('{}',{status:String(url).startsWith('/api/dsh/context')?200:503}));
    await mount();const selection=selected();await choose(selection);await request(selection);
    await waitFor(()=>expect(messages('moki:quote')).toHaveLength(1));
    expect(messages('moki:quote')[0]).toMatchObject({images:[],imageWarning:true,selection:{content:selection.content}});
  });

  it('does not accept another origin or fetch a selection image from another origin',async()=>{
    const flush=vi.fn(async()=>{});await mount(flush);const selection=selected();await choose(selection);await request(selection,'http://untrusted.test');
    expect(flush).not.toHaveBeenCalled();expect(messages('moki:quote')).toHaveLength(0);
    const foreign={...selection,content:JSON.stringify({selectedShapes:[{id:'shape:a',text:'内容'}],visualAttachments:[{imageSource:'http://untrusted.test/image.png'}]})};
    await choose(foreign);await request(foreign);
    await waitFor(()=>expect(messages('moki:quote')).toHaveLength(1));
    expect(fetchMock.mock.calls.every(call=>!String(call[0]).includes('untrusted.test'))).toBe(true);
    expect(messages('moki:quote')[0]).toMatchObject({images:[],imageWarning:true});
  });
});
