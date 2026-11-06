import { useEffect, useState } from "react";

/** Commit once on Enter/blur so a width adjustment is one undo step. */
export function MindMapWidthControl({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(width)));
  useEffect(() => setDraft(String(Math.round(width))), [width]);
  const commit = () => {
    const value = Number(draft);
    if (!draft.trim() || !Number.isFinite(value)) { setDraft(String(Math.round(width))); return; }
    const next = Math.max(64, Math.min(4096, Math.round(value)));
    setDraft(String(next));
    if (next !== width) onChange(next);
  };
  return <label className="flex h-8 shrink-0 items-center gap-1 border-l border-black/10 pl-2 pr-1 text-[11px] text-[#6d7284] dark:border-white/15 dark:text-[#b6bdca]">
    宽
    <input aria-label="思维导图节点宽度" title="节点宽度（64–4096），回车确认" type="number"
      min={64} max={4096} step={16} value={draft}
      className="h-6 w-16 rounded border border-black/15 bg-transparent px-1 text-center text-[11px] text-inherit dark:border-white/20"
      onChange={event => setDraft(event.target.value)} onBlur={commit}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(String(Math.round(width))); }
      }} />
  </label>;
}
