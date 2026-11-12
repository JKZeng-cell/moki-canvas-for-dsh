import {t, useI18n} from './i18n.js';
import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {FolderOpen,MessageSquare,Settings,X} from 'lucide-react';
import type {ResourceCacheSettings} from '../shared/resource-cache-contract.js';
import {APP_NAME,APP_DEVELOPER_CONTACT,DEVELOPER_CONTACT_URL} from '../shared/app-metadata.js';
import type {ThemeMode} from './use-theme.js';
import {DesktopSettingsPanel} from './desktop-settings.js';
import {LanSharingPanel} from './lan-sharing-panel.js';
import {LanguageSettings} from './language-settings.js';

export type SettingsTab='general'|'appearance'|'mcp'|'cache';
export function SettingsDialog({tab,onTab,close,themeMode,onThemeMode,mcp,version}:{tab:SettingsTab;onTab:(tab:SettingsTab)=>void;close:()=>void;themeMode:ThemeMode;onThemeMode:(mode:ThemeMode)=>void;mcp:ReactNode;version?:string}){
  useI18n();
 const [contactError,setContactError]=useState('');
 const [cache,setCache]=useState<ResourceCacheSettings>(),[path,setPath]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const section=useRef<HTMLElement>(null),scroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(scroll.current)scroll.current.scrollTop=0;},[tab]);
 const bridge=window.mokiDesktop?.resourceCache;
 useEffect(()=>{
  let active=true;
  const previous=document.activeElement as HTMLElement|null;
  section.current?.querySelector<HTMLButtonElement>(`[aria-label="${t("关闭设置")}"]`)?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!busyRef.current){event.preventDefault();close();}
   if(event.key==='Tab'){
    const controls=Array.from(section.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')??[]);
    const first=controls[0],last=controls.at(-1);if(!first||!last)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',keyboard);
  const request=bridge?bridge.get():fetch('/api/config').then(async response=>{if(!response.ok)throw new Error(t("无法读取素材路径"));return (await response.json()).resourceCache as ResourceCacheSettings;});
  void request.then(value=>{if(active){setCache(value);setPath(value?.pendingPath??value?.path??'');}}).catch(e=>{if(active)setError(String(e));});
  return()=>{active=false;document.removeEventListener('keydown',keyboard);previous?.focus();};
 },[]);
 // Keep Escape safe while copying/validating a user-selected path.
 const busyRef=useRef(false);busyRef.current=busy;
 const save=async(value:string|null)=>{if(!bridge||busyRef.current)return;setBusy(true);setError('');setSaved(false);try{const next=await bridge.set(value);setCache(next);setPath(next.pendingPath??next.path);setSaved(true);}catch(e){setError(String(e));}finally{setBusy(false);}};
 const choose=async()=>{if(busyRef.current)return;setError('');try{const selected=await window.mokiDesktop?.selectLocalFolder?.();if(selected){setPath(selected);setSaved(false);}}catch(e){setError(String(e));}};
 return <div className="native-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close();}}><section ref={section} className="native-mcp-modal native-settings-modal" role="dialog" aria-modal="true" aria-label={t("设置")}><button className="native-modal-close" aria-label={t("关闭设置")} disabled={busy} onClick={close}><X size={18}/></button><header className="settings-dialog-header"><Settings size={28}/><h2>{t("设置")}</h2><div className="settings-tabs" role="tablist" aria-label={t("设置分类")}>{([['general',t("常规")],['appearance',t("外观")],['mcp','MCP'],['cache',t("素材缓存")]] as const).map(([value,label])=><button key={value} id={'settings-tab-'+value} role="tab" aria-selected={tab===value} aria-controls={'settings-panel-'+value} onClick={()=>onTab(value)}>{label}</button>)}</div></header><div ref={scroll} className="settings-dialog-scroll"><div id={'settings-panel-'+tab} role="tabpanel" aria-labelledby={'settings-tab-'+tab}>
 {tab==='general'?<><LanguageSettings/><DesktopSettingsPanel/><LanSharingPanel/></>:null}
 {tab==='appearance'?<><h3>{t("深浅色模式")}</h3><p>{t("外观偏好保存在当前设备，应用于管理页和白板编辑页。选择跟随系统后，自动响应系统外观变化。")}</p><div className="settings-theme-options">{([['light',t("浅色模式")],['dark',t("深色模式")],['system',t("跟随系统")]] as const).map(([mode,label])=><button key={mode} data-theme-mode={mode} aria-pressed={themeMode===mode} onClick={()=>onThemeMode(mode)}>{label}</button>)}</div></>:null}
 {tab==='mcp'?mcp:null}
 {tab==='cache'?<><h3>{t("白板素材缓存路径")}</h3><p>{t("保存导入文件、图片缓存、资料夹和预览素材。更改后重启客户端生效，迁移时复制并校验素材，原目录不会自动删除。")}</p>{cache?<><label htmlFor="material-cache-path">{t("素材目录")}</label><div className="settings-cache-input"><input id="material-cache-path" value={path} readOnly={!bridge} disabled={busy} onChange={event=>{setPath(event.target.value);setSaved(false);}}/><button aria-label={t("选择素材目录")} disabled={!bridge||busy} onClick={()=>void choose()}><FolderOpen size={18}/></button></div><p className="settings-cache-detail">{t("当前路径：")}{cache.path}<br/>{t("默认路径：")}{cache.defaultPath}</p>{cache.pendingPath?<p role="status">{t("待生效路径：")}{cache.pendingPath}{t("，请关闭并重新打开客户端。")}</p>:null}{cache.error?<p role="alert" className="manager-dialog-error">{cache.error}</p>:null}{bridge?<div className="settings-cache-actions"><button className="manager-primary" disabled={busy||!path.trim()} onClick={()=>void save(path)}>{busy?t("正在保存…"):t("保存路径")}</button><button disabled={busy} onClick={()=>void save(null)}>{t("恢复默认路径")}</button><button disabled={busy||!window.mokiDesktop?.openLocalPath} onClick={()=>void window.mokiDesktop?.openLocalPath?.(cache.path)}>{t("打开当前目录")}</button></div>:<p>{t("网页版仅显示服务端素材路径，请在 MOKI 白板客户端中修改。")}</p>}</>:<p>{t("正在读取素材路径…")}</p>}{saved?<p role="status">{t("设置已保存")}{cache?.pendingPath?t("，重启客户端后生效。"):'。'}</p>:null}{error?<p role="alert" className="manager-dialog-error">{error}</p>:null}</>:null}
 </div><footer className="settings-about"><span>{t(APP_NAME)} · {version?'v'+version:t("版本读取中…")}</span><a href={DEVELOPER_CONTACT_URL} title={APP_DEVELOPER_CONTACT} target="_blank" rel="noreferrer" onClick={event=>{const open=window.mokiDesktop?.openExternalUrl;if(!open)return;event.preventDefault();setContactError('');void open(DEVELOPER_CONTACT_URL).then(ok=>{if(!ok)setContactError(t("无法打开浏览器，请访问 ")+DEVELOPER_CONTACT_URL);}).catch(()=>setContactError(t("无法打开浏览器，请访问 ")+DEVELOPER_CONTACT_URL));}}><MessageSquare size={15}/>{t("联系开发者")}</a>{contactError?<p role="alert">{contactError}</p>:null}</footer></div></section></div>;
}
