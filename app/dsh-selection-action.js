import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, MessageSquare, RotateCcw } from 'lucide-react';
import { t, useI18n } from './i18n.js';
import { quoteDshSelection } from './dsh-quick-quote.js';
import { selectionActionPosition, textareaSelectionBox } from './dsh-selection-anchor.js';
export function DshSelectionAction({ root, textarea, bounds, selectionId, pageId, pageName, editing, finishEditing, textValue, blocked }) {
    useI18n();
    const [textTarget, setTextTarget] = useState();
    const [pinnedText, setPinnedText] = useState();
    const [dragging, setDragging] = useState(false);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [status, setStatus] = useState('ready');
    const [notice, setNotice] = useState('');
    const pending = useRef(undefined);
    const action = useRef(null);
    useEffect(() => {
        const container = root.current;
        if (!container)
            return;
        let frame = 0;
        const measure = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setSize(previous => previous.width === container.clientWidth && previous.height === container.clientHeight ? previous : { width: container.clientWidth, height: container.clientHeight });
                const input = textarea.current;
                const selectedText = editing && input ? input.value.slice(input.selectionStart, input.selectionEnd) : '';
                const rect = selectedText.trim() && input && (document.activeElement === input || document.activeElement === action.current) ? textareaSelectionBox(input) : undefined;
                if (!rect || !input) {
                    setTextTarget(undefined);
                    return;
                }
                const parent = container.getBoundingClientRect(), scale = parent.width / container.clientWidth || 1;
                const content = JSON.stringify({ kind: 'whiteboard_text_selection', pageId, pageName, shapeId: input.dataset.whiteboardInlineTextEditor === 'new' ? undefined : input.dataset.whiteboardInlineTextEditor, selectedText, range: { start: input.selectionStart, end: input.selectionEnd }, guidance: t('仅引用划选的文字；未包含该元素中的其他文字。') });
                const target = { key: content, box: { left: (rect.left - parent.left) / scale, top: (rect.top - parent.top) / scale, width: rect.width / scale, height: rect.height / scale }, selection: { source: 'whiteboard', itemCount: 1, label: t('白板划选文字'), content, capturedAt: new Date().toISOString() } };
                setTextTarget(previous => previous?.key === target.key && JSON.stringify(previous.box) === JSON.stringify(target.box) ? previous : target);
            });
        };
        const down = (event) => {
            if (!(event.target instanceof Element && event.target.closest('.dsh-selection-action')))
                setPinnedText(undefined);
            if (event.target === container.querySelector('canvas.native-whiteboard-canvas'))
                setDragging(true);
        };
        const clearPinned = (event) => { if (!(event.target instanceof Element && event.target.closest('.dsh-selection-action')))
            setPinnedText(undefined); };
        const up = () => { setDragging(false); measure(); };
        const blur = () => { setDragging(false); setTextTarget(undefined); };
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        document.addEventListener('selectionchange', measure);
        container.addEventListener('select', measure, true);
        container.addEventListener('keyup', measure);
        container.addEventListener('scroll', measure, true);
        container.addEventListener('pointerdown', down, true);
        container.addEventListener('keydown', clearPinned);
        container.addEventListener('wheel', clearPinned, { passive: true });
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        window.addEventListener('blur', blur);
        measure();
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener('selectionchange', measure);
            container.removeEventListener('select', measure, true);
            container.removeEventListener('keyup', measure);
            container.removeEventListener('scroll', measure, true);
            container.removeEventListener('pointerdown', down, true);
            container.removeEventListener('keydown', clearPinned);
            container.removeEventListener('wheel', clearPinned);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            window.removeEventListener('blur', blur);
        };
    }, [root, textarea, editing, textValue, pageId, pageName, bounds?.left, bounds?.top, bounds?.width, bounds?.height]);
    const targetText = pinnedText ?? (editing ? textTarget : undefined);
    const box = targetText?.box ?? (editing ? undefined : bounds);
    const key = blocked || dragging ? '' : targetText?.key ?? (editing ? '' : selectionId);
    const position = box && key ? selectionActionPosition(box, size.width, size.height) : undefined;
    useEffect(() => {
        setStatus('ready');
        setNotice('');
        return () => { pending.current?.abort(); pending.current = undefined; };
    }, [key, pageId]);
    useEffect(() => { setPinnedText(undefined); }, [pageId]);
    if (!position)
        return null;
    const label = status === 'pending' ? t('正在加入对话…') : status === 'added' ? t('已加入对话草稿') : status === 'error' ? t('重试加入对话') : t('引用到 DSH');
    const Icon = status === 'pending' ? LoaderCircle : status === 'added' ? Check : status === 'error' ? RotateCcw : MessageSquare;
    const quote = async () => {
        if (pending.current)
            return;
        const controller = new AbortController();
        pending.current = controller;
        const selectedText = targetText;
        if (selectedText)
            setPinnedText(selectedText);
        setStatus('pending');
        setNotice('');
        // Capture the exact substring before committing the editor. DSH may focus its
        // composer during the handshake; that blur must not discard the chosen quote.
        if (selectedText && editing) {
            finishEditing();
            await new Promise(resolve => requestAnimationFrame(() => resolve()));
        }
        if (controller.signal.aborted)
            return;
        const result = await quoteDshSelection(selectedText?.selection, controller.signal);
        if (controller.signal.aborted)
            return;
        pending.current = undefined;
        setStatus(result.ok ? 'added' : 'error');
        setNotice(result.message ?? '');
    };
    return _jsxs("div", { className: "dsh-selection-action", style: position, "data-whiteboard-control-surface": true, "data-dsh-selection-kind": targetText ? 'text' : 'objects', children: [_jsx("button", { ref: action, type: "button", "aria-label": label, "aria-busy": status === 'pending', "aria-disabled": status === 'pending', title: notice || label, onPointerDown: event => { event.preventDefault(); event.stopPropagation(); }, onBlur: event => { if (editing && !pending.current && event.relatedTarget !== textarea.current)
                    finishEditing(); }, onClick: event => { event.stopPropagation(); void quote(); }, children: _jsx(Icon, { size: 17, "aria-hidden": "true", className: status === 'pending' ? 'animate-spin' : undefined }) }), _jsx("span", { className: "dsh-selection-action-label", role: "status", style: position.left < 210 ? { left: 0, right: 'auto', maxWidth: Math.min(200, size.width - position.left - 8) } : undefined, children: notice || label })] });
}
