import {useEffect, useState} from 'react';
import {SharedPdfPreview} from './shared-pdf-preview.js';
import type {WhiteboardMaterial} from '../vendor/moki/web/components/whiteboard-materials-panel.js';

/** Render file contents inside the host theme; Electron cannot preview every MIME in an iframe. */
export function DshFilePreview({material}: {material: WhiteboardMaterial}) {
  const textFile = /\.(txt|md|markdown|json|csv|tsv|log|yaml|yml|xml|css|js|ts|py)$/i.test(material.name);
  const [text, setText] = useState<string>();
  const [error, setError] = useState('');
  useEffect(() => {
    setText(undefined); setError('');
    if (!textFile || !material.libraryItemId) return;
    const abort = new AbortController();
    void fetch('/api/library/items/' + encodeURIComponent(material.libraryItemId) + '/content', {signal: abort.signal})
      .then(async response => {
        if (!response.ok) throw new Error('文件暂时无法读取，请重试或点击“打开”。');
        const data = await response.json() as {content?: unknown};
        if (typeof data.content !== 'string') throw new Error('文件内容不可用。');
        if (!abort.signal.aborted) setText(data.content);
      }).catch(reason => {if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : '文件读取失败。');});
    return () => abort.abort();
  }, [material.libraryItemId, textFile]);
  if (error) return <p role="alert" className="dsh-file-preview-message">{error}</p>;
  if (textFile && material.libraryItemId) return text === undefined
    ? <p role="status" className="dsh-file-preview-message">正在读取文件…</p>
    : <pre className="dsh-file-preview-text">{text || '（空文件）'}</pre>;
  if (/\.pdf$/i.test(material.name) && material.previewUrl) return <SharedPdfPreview url={material.previewUrl}/>;
  return <p className="dsh-file-preview-message">此文件暂不支持内嵌预览，可点击上方“打开”查看。</p>;
}
