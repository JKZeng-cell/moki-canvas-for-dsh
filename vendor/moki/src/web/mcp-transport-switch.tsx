import {t, useI18n} from './i18n.js';
import {Globe2,Terminal} from 'lucide-react';

export function McpTransportSwitch({http,onChange}:{http:boolean;onChange:(http:boolean)=>void}){
  useI18n();
 return <div className="mcp-transport-switch" role="group" aria-label={t("MCP 连接方式")}>
  <button type="button" aria-pressed={!http} onClick={()=>onChange(false)}><Terminal size={15} aria-hidden="true"/>stdio</button>
  <button type="button" aria-pressed={http} onClick={()=>onChange(true)}><Globe2 size={15} aria-hidden="true"/>Streamable HTTP</button>
 </div>;
}
