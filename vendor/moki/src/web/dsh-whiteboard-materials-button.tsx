import {PanelRightOpen} from 'lucide-react';

export function DshWhiteboardMaterialsButton({open, count, onToggle}: {open: boolean; count: number; onToggle: () => void}) {
  return <button type="button" className="dsh-whiteboard-materials" aria-label={open ? '收起素材列表' : '展开素材列表'} aria-expanded={open} aria-controls="whiteboard-materials-panel" title={`当前页面素材 · ${count} 项`} onClick={onToggle}>
    <PanelRightOpen size={13}/><span>素材</span><span className="dsh-material-count">{count > 99 ? '99+' : count}</span>
  </button>;
}
