/** Keep the action beside a visible selection, outside its resize handles. */
export function selectionActionPosition(box, width, height) {
    const size = 32, gap = 18, inset = 8;
    if (width < size + 2 * inset || height < 96 || box.left + box.width < 0 || box.top + box.height < 0 || box.left > width || box.top > height)
        return;
    let left = box.left + box.width + gap;
    let top = box.top - 2;
    if (left + size > width - inset)
        left = box.left - gap - size;
    if (left < inset) {
        left = box.left + box.width - size;
        top = box.top + box.height + gap;
    }
    return { left: Math.max(inset, Math.min(width - size - inset, left)), top: Math.max(52, Math.min(height - 76, top)) };
}
/** Textareas do not expose DOM ranges. Mirror their layout to locate the highlighted line,
 * including wrapping, scroll, zoom and rotation, without changing the user's selection. */
export function textareaSelectionBox(input) {
    if (input.selectionStart === input.selectionEnd || !input.parentElement)
        return;
    const style = getComputedStyle(input), mirror = document.createElement('div');
    const properties = ['box-sizing', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-synthesis', 'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-indent', 'text-transform', 'word-break', 'overflow-wrap', 'tab-size', 'direction', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'transform', 'transform-origin'];
    for (const property of properties)
        mirror.style.setProperty(property, style.getPropertyValue(property));
    Object.assign(mirror.style, { position: 'absolute', left: `${input.offsetLeft}px`, top: `${input.offsetTop}px`, width: style.width, height: style.height, borderStyle: 'solid', whiteSpace: input.wrap === 'off' ? 'pre' : 'pre-wrap', overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' });
    mirror.setAttribute('aria-hidden', 'true');
    mirror.textContent = input.value + '\u200b';
    input.parentElement.append(mirror);
    try {
        mirror.scrollTop = input.scrollTop;
        mirror.scrollLeft = input.scrollLeft;
        const range = document.createRange();
        range.setStart(mirror.firstChild, input.selectionStart);
        range.setEnd(mirror.firstChild, input.selectionEnd);
        const viewport = input.getBoundingClientRect();
        const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom && rect.right > viewport.left && rect.left < viewport.right);
        const rect = input.selectionDirection === 'backward' ? rects[0] : rects.at(-1);
        return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined;
    }
    finally {
        mirror.remove();
    }
}
