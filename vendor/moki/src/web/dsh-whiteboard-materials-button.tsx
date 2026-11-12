import {t, useI18n} from './i18n.js';
import {PanelRightOpen} from 'lucide-react';

export function DshWhiteboardMaterialsButton({open, count, onToggle}: {open: boolean; count: number; onToggle: () => void}) {
  useI18n();
  return <button type="button" className="dsh-whiteboard-materials" aria-label={open ? t("收起素材列表") : t("展开素材列表")} aria-expanded={open} aria-controls="whiteboard-materials-panel" title={t("当前页面素材 · {0} 项", count)} onClick={onToggle}>
    <PanelRightOpen size={13}/><span>{t("素材")}</span><span className="dsh-material-count">{count > 99 ? '99+' : count}</span>
  </button>;
}
