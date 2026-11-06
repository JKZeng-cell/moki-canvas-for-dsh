// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DshFilePreview} from '../src/web/dsh-file-preview.js';

afterEach(() => {cleanup(); vi.unstubAllGlobals();});
describe('DSH file preview', () => {
  it('renders text as readable content instead of an embedded document', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, json: async () => ({content: '<script>unsafe()</script>\n素材说明'})})));
    const {container} = render(<DshFilePreview material={{shapeId: 'shape:file', kind: 'resource', libraryItemId: 'file-1', name: '说明.txt'}}/>);
    expect(await screen.findByText(/素材说明/)).toHaveTextContent('<script>unsafe()</script>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });
  it('shows an actionable message when a file cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: false})));
    render(<DshFilePreview material={{shapeId: 'shape:file', kind: 'resource', libraryItemId: 'file-1', name: '说明.md'}}/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('请重试或点击“打开”');
  });
  it('does not try to decode binary files as text', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<DshFilePreview material={{shapeId: 'shape:file', kind: 'resource', libraryItemId: 'file-1', name: '附件.zip'}}/>);
    expect(screen.getByText(/暂不支持内嵌预览/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
});
