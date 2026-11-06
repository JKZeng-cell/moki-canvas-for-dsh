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
