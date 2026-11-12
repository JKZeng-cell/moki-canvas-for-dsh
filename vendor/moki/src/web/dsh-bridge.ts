import {t, getLanguage, setDshLanguage, subscribeLanguage} from './i18n.js';
import {useEffect,useRef} from 'react';
import {readWorkbenchSelectionContext,WORKBENCH_SELECTION_EVENT,MOKI_ASSISTANT_COMPOSE_EVENT,type MokiAssistantComposeRequest} from '../vendor/moki/web/lib/workbench-selection-context.js';
import type {ThemeMode} from './use-theme.js';
import {dshSelectionKey} from './dsh-selection.js';

declare global {interface Window {mokiDshEmbed?:boolean;}}
const query=new URLSearchParams(location.search);
const config=window.mokiDshEmbed?{sessionId:query.get('dshSession')??'',instanceId:query.get('dshBridge')??'',parentOrigin:query.get('dshParent')??''}:undefined;

/** Opt-in bridge for a DSH-owned iframe; normal web and desktop behavior is unchanged. */
export function useDshBridge(boardId:string|undefined,flush:()=>Promise<void>,setTheme:(mode:ThemeMode)=>void){
 const latest=useRef({boardId,flush,setTheme});latest.current={boardId,flush,setTheme};
 const publishRef=useRef<(()=>void)|undefined>(undefined);
 useEffect(()=>{
  if(!config?.sessionId||!config.instanceId||!config.parentOrigin||parent===window)return;
  const {sessionId,instanceId,parentOrigin}=config;
  let active=true,disposed=false,sharing=false,serial=Promise.resolve();
  const send=(type:string,detail:Record<string,unknown>={})=>parent.postMessage({type,bridgeId:instanceId,...detail},parentOrigin);
  const publishLanguage=()=>send('moki:language',{language:getLanguage()});
  const unsubscribeLanguage=subscribeLanguage(publishLanguage);
  const selection=()=>{const value=readWorkbenchSelectionContext();return value?{...value,label:value.label.slice(0,1000),content:value.content.slice(0,200000)}:null;};
  const publish=()=>{
   const body={sessionId,instanceId,boardId:latest.current.boardId??null,selection:latest.current.boardId?selection():null,active:active&&!disposed};
   send('moki:state',{boardId:body.boardId,selection:body.selection});
   serial=serial.catch(()=>{}).then(async()=>{const r=await fetch('/api/dsh/context',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),keepalive:true});if(!r.ok)throw new Error(t("DSH 选区同步失败"));});
   void serial.catch(error=>{if(!disposed)send('moki:error',{message:String(error)});});
   return serial;
  };
  const share=async(prompt?:string,requestId?:string,expectedKey?:string)=>{
   if(sharing){if(requestId)send('moki:error',{requestId,message:t("正在读取选区，请稍后重试")});return;}
   sharing=true;
   const sharedBoardId=latest.current.boardId;
   const initialKey=dshSelectionKey(sharedBoardId,selection());
   const readCurrent=()=>{
    if(disposed||!active)throw new Error(t("白板已隐藏，请重新打开后加入对话"));
    const current=selection();
    if(latest.current.boardId!==sharedBoardId||dshSelectionKey(sharedBoardId,current)!==initialKey)throw new Error(t("选区已变化，请重新点击加入对话"));
    return current;
   };
   try{
    if(expectedKey&&expectedKey!==initialKey)throw new Error(t("选区已变化，请重新点击加入对话"));
    if(!initialKey&&!prompt)throw new Error(t("请先在白板中选择内容"));
    await latest.current.flush();
    // Native selection export is debounced; allow its actual canvas image to settle.
    let selected=readCurrent();
    const imagesOf=()=>{try{return JSON.parse(selected?.content??'{}').visualAttachments??[];}catch{return [];}};
    for(let attempt=0;selected&&imagesOf().length===0&&attempt<30;attempt++){await new Promise(resolve=>setTimeout(resolve,100));selected=readCurrent();}
    const results=await Promise.allSettled(imagesOf().slice(0,3).map(async(image:{imageSource?:string;name?:string})=>{
     if(typeof image.imageSource!=='string')throw new Error(t("选区图片地址无效"));
     const url=new URL(image.imageSource,location.href);
     if(url.origin!==location.origin||!url.pathname.startsWith('/api/whiteboard/assets/'))throw new Error(t("选区图片不属于当前白板服务"));
     const response=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error(t("无法读取选区图片"));
     const blob=await response.blob();if(blob.size>8*1024*1024)throw new Error(t("选区图片超过 8 MiB，请缩小选区"));
     return {source:url.href,name:String(image.name??t("白板选区.png")),mediaType:blob.type,bytes:await blob.arrayBuffer()};
    }));
    const images=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
    selected=readCurrent();
    await publish();
    readCurrent();
    send('moki:quote',{requestId,boardId:sharedBoardId,selection:selected,prompt:prompt??'',images,imageWarning:results.some(result=>result.status==='rejected')});
   }
   catch(error){if(!disposed&&active)send('moki:error',{requestId,message:t("加入选区失败：")+String(error)});}
   finally{sharing=false;}
  };
  const receive=(event:MessageEvent)=>{
   if(event.source!==parent||event.origin!==parentOrigin||event.data?.bridgeId!==instanceId)return;
   const data=event.data;
   if(data.type==='dsh:language')setDshLanguage(data.language);
   if(data.type==='dsh:theme'&&(data.theme==='light'||data.theme==='dark'))latest.current.setTheme(data.theme);
   if(data.type==='dsh:active'){active=data.active===true;void publish();}
   if(data.type==='dsh:quote'&&active)void share(undefined,data.requestId,data.selectionKey);
  };
  const onSelection=()=>void publish();
  const onCompose=(event:Event)=>{event.stopImmediatePropagation();const request=(event as CustomEvent<MokiAssistantComposeRequest>).detail;void share(request?.prompt);};
  const focus=()=>{if(active)void publish();};
  const layout=(event:Event)=>send('moki:layout',{fullscreen:(event as CustomEvent<boolean>).detail===true});
  addEventListener('moki:dsh-fullscreen',layout);
  addEventListener('message',receive);
  addEventListener(WORKBENCH_SELECTION_EVENT,onSelection);
  addEventListener(MOKI_ASSISTANT_COMPOSE_EVENT,onCompose,true);
  addEventListener('focus',focus);
  publishRef.current=()=>void publish();
  const timer=setInterval(()=>{if(active)void publish();},15000);
  send('moki:ready');publishLanguage();void publish();
  return()=>{disposed=true;unsubscribeLanguage();clearInterval(timer);publishRef.current=undefined;removeEventListener('moki:dsh-fullscreen',layout);removeEventListener('message',receive);removeEventListener(WORKBENCH_SELECTION_EVENT,onSelection);removeEventListener(MOKI_ASSISTANT_COMPOSE_EVENT,onCompose,true);removeEventListener('focus',focus);void publish();};
 },[]);
 useEffect(()=>{if(config){sessionStorage.removeItem('moki.current-workbench-selection');publishRef.current?.();}},[boardId]);
}
