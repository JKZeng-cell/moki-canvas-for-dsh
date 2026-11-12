type Selection = { source: string; itemCount: number; content: string };

/** Image export settles asynchronously; it must not change the selected content's identity. */
export function dshSelectionContent(selection: Selection): string {
  try { const {visualAttachments, ...content} = JSON.parse(selection.content); return JSON.stringify(content); }
  catch { return selection.content; }
}

/** Keep the matching client helper in the DSH plugin in sync with this wire contract. */
export function dshSelectionKey(boardId: string | undefined | null, selection: Selection | undefined | null): string {
  return selection?.itemCount ? JSON.stringify([boardId, selection.source, selection.itemCount, dshSelectionContent(selection)]) : '';
}

/** Inline text is a captured substring. Committing its editor may resize the same
 * shape; only a different board, page or selected object invalidates that quote. */
export function dshSelectionScope(boardId: string | undefined | null, selection: Selection | undefined | null): string {
  try {
    const content = JSON.parse(selection?.content ?? '{}');
    if (selection?.source === 'whiteboard' && Array.isArray(content.selectedShapes)) return JSON.stringify([boardId, selection.source, content.pageId, content.selectedShapes.map((shape: {id: string}) => shape.id).sort()]);
  } catch { /* Other workbench selections retain their full identity. */ }
  return dshSelectionKey(boardId, selection);
}
