import {t, useI18n, getLanguage} from './i18n.js';
import {useEffect,useState} from 'react';
import {ArrowLeft,ChevronLeft,ChevronRight,History,UsersRound} from 'lucide-react';
import type {SharedVisitHistory} from '../shared/lan-sharing-contract.js';
const date=(value:string)=>new Date(value).toLocaleString(getLanguage(),{hour12:false});
const duration=(seconds:number)=>seconds<60?seconds+t(" 秒"):seconds<3600?Math.floor(seconds/60)+t(" 分钟"):Math.floor(seconds/3600)+t(" 小时 ")+Math.floor(seconds%3600/60)+t(" 分钟");
export function ShareVisitHistory({boardId,title,close}:{boardId?:string;title:string;close:()=>void}){
  useI18n();
 const [page,setPage]=useState(1),[data,setData]=useState<SharedVisitHistory>(),[error,setError]=useState('');
 useEffect(()=>{let live=true,pending=false;setData(undefined);setError('');
  const load=async()=>{if(pending)return;pending=true;try{
   const query=new URLSearchParams({page:String(page),pageSize:'20'});if(boardId)query.set('boardId',boardId);
   const response=await fetch('/api/sharing/visits?'+query,{cache:'no-store'}),value=await response.json();
   if(!response.ok||!Array.isArray(value.items))throw new Error(value.error??t("无法读取访问记录"));
   if(live){setData(value);setError('');}
  }catch(error){if(live)setError(error instanceof Error?error.message:t("无法读取访问记录"));}finally{pending=false;}};
  void load();const timer=setInterval(()=>void load(),5000);return()=>{live=false;clearInterval(timer);};
 },[boardId,page]);
 return <section className="share-visit-history" aria-label={t("共享访问记录")}>
  <button className="share-history-back" onClick={close}><ArrowLeft size={14}/>{t("返回已共享白板")}</button>
  <div className="share-history-title"><History size={17}/><h4>{title}</h4></div>
  <p className="share-history-help">{t("访问记录仅保存在本机，分享者可查看；在线人数按浏览器去重，多标签页合并计数。")}</p>
  {data?<><div className="share-history-summary"><span><UsersRound size={14}/>{data.onlineCount} {t("人在线")}</span><span>{t("累计")}{data.total} {t("次访问")}</span></div>
  {data.items.length?<ol className="share-visit-list">{data.items.map(item=><li key={item.id}>
   <div className="share-visit-row"><strong>{item.client}</strong><span className={item.online?'share-visit-status is-online':'share-visit-status'}>{item.online?t("在线"):t("已离线")}</span></div>
   {!boardId?<p className="share-visit-board">{item.boardTitle}</p>:null}
   <p className="share-visit-address">{item.address} {t("· 停留")}{duration(item.durationSeconds)}</p>
   <div className="share-visit-times"><span>{t("首次访问")}<time dateTime={item.startedAt}>{date(item.startedAt)}</time></span><span>{item.online?t("最近活跃"):t("最后访问")} <time dateTime={item.lastSeenAt}>{date(item.lastSeenAt)}</time></span></div>
  </li>)}</ol>:<p className="settings-shared-empty">{t("暂无访问记录。分享链接被打开后会自动记录。")}</p>}
  <nav className="share-history-pagination" aria-label={t("访问记录分页")}><button disabled={page<=1} aria-label={t("上一页访问记录")} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={15}/></button><span>{t("第")}{page} / {Math.max(1,Math.ceil(data.total/data.pageSize))} {t("页")}</span><button disabled={page*data.pageSize>=data.total} aria-label={t("下一页访问记录")} onClick={()=>setPage(value=>value+1)}><ChevronRight size={15}/></button></nav></>:!error?<p role="status">{t("正在读取访问记录…")}</p>:null}
  {error?<p role="alert" className="manager-dialog-error">{error}{data?t("，当前显示上次读取的记录。"):''}</p>:null}
 </section>;
}
