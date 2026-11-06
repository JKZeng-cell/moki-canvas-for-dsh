import { ArrowLeft, Check, CloudOff, FileDown, FileUp, History, Image, Keyboard, LoaderCircle, Maximize2, MoreHorizontal, PanelRightOpen, Save, Settings } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNativeControls } from './native-context.js';

type Props = {
  title: string;
  status: string;
  state: string;
  transferring: boolean;
  onSave: () => void;
  onSaveAs?: (() => void) | undefined;
  onImport: () => void;
  onExport: () => void;
  onImage: () => void;
  onHistory: () => void;
  onShortcuts: () => void;
  onFullscreen: () => void;
  onMaterials: () => void;
};

/** A single compact row; the host places its selection action in the reserved right edge. */
export function DshWhiteboardHeader(props: Props) {
  const controls = useNativeControls();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const action = (label: string, icon: ReactNode, callback: () => void, disabled = false) => (
    <button type="button" key={label} disabled={disabled} onClick={() => { setOpen(false); callback(); }}>
      {icon}<span>{label}</span>
    </button>
  );
  return <header ref={root} className="dsh-whiteboard-header">
    <button type="button" aria-label="返回白板列表" title="返回白板列表" onClick={controls?.back}><ArrowLeft size={15} /></button>
    <span className="dsh-whiteboard-title" title={props.title}>{props.title}</span>
    <button type="button" aria-label="立即保存白板" title={props.status} onClick={props.onSave} className="dsh-whiteboard-save" data-state={props.state}>
      <span role="status" aria-label="白板保存状态">
        {props.state === 'saving' ? <LoaderCircle size={14} className="animate-spin" /> : props.state === 'error' ? <CloudOff size={14} /> : props.state === 'pending' ? <Save size={14} /> : <Check size={14} />}
        <span className="sr-only">{props.status}</span>
      </span>
    </button>
    <button ref={trigger} type="button" aria-label="更多白板操作" title="更多白板操作" aria-expanded={open} aria-controls="dsh-whiteboard-actions" onClick={() => setOpen(value => !value)}><MoreHorizontal size={16} /></button>
    {open && <div id="dsh-whiteboard-actions" className="dsh-whiteboard-actions" role="group" aria-label="白板操作" onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }}>
      {action('立即保存白板', <Save size={14} />, props.onSave)}
      {props.onSaveAs && action('另存为白板文件', <Save size={14} />, props.onSaveAs, props.transferring)}
      {action('导入白板文件', <FileUp size={14} />, props.onImport, props.transferring)}
      {action('导出白板文件', <FileDown size={14} />, props.onExport, props.transferring)}
      {action('导出白板图片', <Image size={14} />, props.onImage)}
      <hr />
      {action('查看白板版本', <History size={14} />, props.onHistory)}
      {action('当前页面素材', <PanelRightOpen size={14} />, props.onMaterials)}
      {action('白板快捷键', <Keyboard size={14} />, props.onShortcuts)}
      {action('画布全屏', <Maximize2 size={14} />, props.onFullscreen)}
      {controls && action('白板设置', <Settings size={14} />, controls.settings)}
    </div>}
  </header>;
}
