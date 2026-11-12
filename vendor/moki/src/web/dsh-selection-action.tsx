import {useEffect, useRef, useState, type RefObject} from 'react';
import {Check, LoaderCircle, RotateCcw} from 'lucide-react';
import {readWorkbenchSelectionContext,type WorkbenchSelectionContext} from '../vendor/moki/web/lib/workbench-selection-context.js';
import {t, useI18n} from './i18n.js';
import {quoteDshSelection} from './dsh-quick-quote.js';
import {selectionActionPosition, textareaSelectionBox, type SelectionBox} from './dsh-selection-anchor.js';
import {SelectionComposer} from './selection-composer.js';

type Props = {
  root: RefObject<HTMLDivElement | null>;
  textarea: RefObject<HTMLTextAreaElement | null>;
  bounds?: SelectionBox | undefined;
  selectionId: string;
  pageId: string;
  pageName: string;
  editing: boolean;
  finishEditing: () => void;
  textValue?: string | undefined;
  blocked: boolean;
};
type TextTarget = {box: SelectionBox; selection: WorkbenchSelectionContext; key: string};

export function DshSelectionAction({root, textarea, bounds, selectionId, pageId, pageName, editing, finishEditing, textValue, blocked}: Props) {
  useI18n();
  const [textTarget, setTextTarget] = useState<TextTarget>();
  const [pinnedText, setPinnedText] = useState<TextTarget>();
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState({width: 0, height: 0});
  const [status, setStatus] = useState<'ready' | 'pending' | 'added' | 'error'>('ready');
  const [notice, setNotice] = useState('');
  const [composer,setComposer]=useState<{selection:WorkbenchSelectionContext;anchor:{x:number;y:number}}>();
  const pending = useRef<AbortController | undefined>(undefined);
  const action = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSize(previous => previous.width === container.clientWidth && previous.height === container.clientHeight ? previous : {width: container.clientWidth, height: container.clientHeight});
        const input = textarea.current;
        const selectedText = editing && input ? input.value.slice(input.selectionStart, input.selectionEnd) : '';
        const rect = selectedText.trim() && input && (document.activeElement === input || document.activeElement === action.current) ? textareaSelectionBox(input) : undefined;
        if (!rect || !input) { setTextTarget(undefined); return; }
        const parent = container.getBoundingClientRect(), scale = parent.width / container.clientWidth || 1;
        const content = JSON.stringify({kind: 'whiteboard_text_selection', pageId, pageName, shapeId: input.dataset.whiteboardInlineTextEditor === 'new' ? undefined : input.dataset.whiteboardInlineTextEditor, selectedText, range: {start: input.selectionStart, end: input.selectionEnd}, guidance: t('仅引用划选的文字；未包含该元素中的其他文字。')});
        const target: TextTarget = {key: content, box: {left: (rect.left - parent.left) / scale, top: (rect.top - parent.top) / scale, width: rect.width / scale, height: rect.height / scale}, selection: {source: 'whiteboard', itemCount: 1, label: t('白板划选文字'), content, capturedAt: new Date().toISOString()}};
        setTextTarget(previous => previous?.key === target.key && JSON.stringify(previous.box) === JSON.stringify(target.box) ? previous : target);
      });
    };
    const down = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('.dsh-selection-action,[data-selection-composer]'))) setPinnedText(undefined);
      if (event.target === container.querySelector('canvas.native-whiteboard-canvas')) setDragging(true);
    };
    const clearPinned = (event: Event) => { if (!(event.target instanceof Element && event.target.closest('.dsh-selection-action,[data-selection-composer]'))) setPinnedText(undefined); };
    const up = () => { setDragging(false); measure(); };
    const blur = () => { setDragging(false); setTextTarget(undefined); };
    const observer = new ResizeObserver(measure); observer.observe(container);
    document.addEventListener('selectionchange', measure);
    container.addEventListener('select', measure, true);
    container.addEventListener('keyup', measure);
    container.addEventListener('scroll', measure, true);
    container.addEventListener('pointerdown', down, true);
    container.addEventListener('keydown', clearPinned);
    container.addEventListener('wheel', clearPinned, {passive: true});
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', blur);
    measure();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener('selectionchange', measure);
      container.removeEventListener('select', measure, true);
      container.removeEventListener('keyup', measure);
      container.removeEventListener('scroll', measure, true);
      container.removeEventListener('pointerdown', down, true);
      container.removeEventListener('keydown', clearPinned); container.removeEventListener('wheel', clearPinned);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('blur', blur);
    };
  }, [root, textarea, editing, textValue, pageId, pageName, bounds?.left, bounds?.top, bounds?.width, bounds?.height]);

  const targetText = pinnedText ?? (editing ? textTarget : undefined);
  const box = targetText?.box ?? (editing ? undefined : bounds);
  const key = blocked || dragging ? '' : targetText?.key ?? (editing ? '' : selectionId);
  const position = box && key ? selectionActionPosition(box, size.width, size.height) : undefined;
  useEffect(() => {
    setStatus('ready'); setNotice('');setComposer(undefined);
    return () => { pending.current?.abort(); pending.current = undefined; };
  }, [key, pageId]);
  useEffect(() => { setPinnedText(undefined); }, [pageId]);

  if (!position&&!composer) return null;
  const label = status === 'pending' ? t('正在加入对话…') : status === 'added' ? t('已加入对话草稿') : status === 'error' ? t('重试加入对话') : t('引用到 DSH');
  const Icon = status === 'pending' ? LoaderCircle : status === 'added' ? Check : status === 'error' ? RotateCcw : undefined;
  const quote = () => {
    if (pending.current||composer) return;
    const selectedText = targetText;
    if (selectedText) setPinnedText(selectedText);
    const selected=selectedText?.selection??readWorkbenchSelectionContext();
    if(!selected)return;
    const rect=action.current?.getBoundingClientRect();
    setComposer({selection:structuredClone(selected),anchor:{x:rect?.left??8,y:rect?.bottom??8}});
    // Capture the exact substring before committing the editor. DSH may focus its
    // composer during the handshake; that blur must not discard the chosen quote.
    if (selectedText && editing) {
      finishEditing();
    }
  };
  let excerpt='';if(composer)try{const data=JSON.parse(composer.selection.content);excerpt=String(data.selectedText??data.selectedShapes?.map((shape:{text?:string;name?:string})=>shape.text??shape.name??'').filter(Boolean).join(' · ')??'').slice(0,180)}catch{}
  return <>{composer&&<SelectionComposer anchor={composer.anchor} label={composer.selection.label} excerpt={excerpt} t={t} onClose={()=>setComposer(undefined)} onSend={async submission=>{
    const controller=new AbortController();pending.current=controller;
    try{const result=await quoteDshSelection(composer.selection,controller.signal,submission);if(!result.ok)throw new Error(result.message??t('发送失败，请重试'));}
    finally{if(pending.current===controller)pending.current=undefined;}
  }}/>}{position&&!composer&&<div className="dsh-selection-action" style={position} data-whiteboard-control-surface data-dsh-selection-kind={targetText ? 'text' : 'objects'}>
    <button ref={action} type="button" aria-label={label} aria-busy={status === 'pending'} aria-disabled={status === 'pending'} title={notice || label} onPointerDown={event => {event.preventDefault(); event.stopPropagation();}} onBlur={event => {if (editing && !pending.current && event.relatedTarget !== textarea.current) finishEditing();}} onClick={event => {event.stopPropagation(); void quote();}}>
      {Icon ? <Icon size={17} aria-hidden="true" className={status === 'pending' ? 'animate-spin' : undefined} /> : <span className="dsh-whale" aria-hidden="true" />}
    </button>
    <span className="dsh-selection-action-label" role="status" style={position.left < 210 ? {left: 0, right: 'auto', maxWidth: Math.min(200, size.width - position.left - 8)} : undefined}>{notice || label}</span>
  </div>}</>;
}
