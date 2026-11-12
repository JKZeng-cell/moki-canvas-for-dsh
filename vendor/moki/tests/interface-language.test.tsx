// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useState} from 'react';
import {SettingsDialog, type SettingsTab} from '../src/web/settings-dialog.js';
import {BoardCardMenu} from '../src/web/board-card-menu.js';
import {getLanguage, initializeLanguage, LANGUAGE_STORAGE_KEY, saveLanguage, setLanguage, t} from '../src/web/i18n.js';
import {newMindMapLabel, newCanvasSnapshot} from '../src/web/new-content-labels.js';
import {NATIVE_COLOR_OPTIONS} from '../src/vendor/moki/web/components/native-whiteboard.js';
import {dismissTopModalFromTarget} from '../src/vendor/moki/web/lib/modal-outside-dismiss.js';

afterEach(() => { cleanup(); setLanguage('zh-CN'); localStorage.clear(); delete window.mokiDshEmbed; vi.unstubAllGlobals(); });
function Demo() {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [draft, setDraft] = useState('已有文字 · My idea');
  return <><input aria-label="Unsubmitted draft" value={draft} onChange={event => setDraft(event.target.value)}/>
    <BoardCardMenu title="个人白板 · unchanged" onAction={() => {}}/>
    <SettingsDialog tab={tab} onTab={setTab} close={() => {}} themeMode="dark" onThemeMode={() => {}} mcp={null}/></>;
}
const respond = (value: unknown, ok = true) => Promise.resolve(new Response(JSON.stringify(value), {status: ok ? 200 : 500}));
describe('interface language', () => {
  it('switches settings and an open portal menu immediately without replacing a user draft', async () => {
    const fetcher = vi.fn((url: string) => respond(url === '/api/config' ? {resourceCache: {path: 'C:/cache', defaultPath: 'C:/cache'}} : {}));
    vi.stubGlobal('fetch', fetcher);
    render(<Demo/>);
    fireEvent.change(screen.getByLabelText('Unsubmitted draft'), {target: {value: '用户草稿 · keep {0}'}});
    fireEvent.click(screen.getByRole('button', {name: '更多操作 个人白板 · unchanged'}));
    fireEvent.change(screen.getByLabelText('界面语言'), {target: {value: 'en'}});
    expect(screen.getByRole('dialog', {name: 'Settings'})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'Rename 个人白板 · unchanged'})).toBeInTheDocument();
    expect(screen.getByLabelText('Unsubmitted draft')).toHaveValue('用户草稿 · keep {0}');
    expect(NATIVE_COLOR_OPTIONS[0]!.label).toBe('Black');
    expect(document.documentElement.lang).toBe('en');
    await waitFor(() => expect(screen.getByLabelText('Interface language')).not.toBeDisabled());
    expect(fetcher.mock.calls.some(call => call[0] === '/api/preferences')).toBe(true);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    fireEvent.click(screen.getByRole('tab', {name: 'Appearance'}));
    expect(screen.getByRole('button', {name: 'Dark'})).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('tab', {name: 'General'}));
    fireEvent.change(screen.getByLabelText('Interface language'), {target: {value: 'zh-CN'}});
    expect(screen.getByRole('dialog', {name: '设置'})).toBeInTheDocument();
    expect(screen.getByLabelText('Unsubmitted draft')).toHaveValue('用户草稿 · keep {0}');
    await waitFor(() => expect(screen.getByLabelText('界面语言')).not.toBeDisabled());
  });
  it('recovers a saved language when browser storage is empty, and does not overwrite a newer user choice', async () => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => respond({language: 'en'})));
    await initializeLanguage(); expect(getLanguage()).toBe('en');
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => {resolve = done;})));
    const hydration = initializeLanguage(); setLanguage('zh-CN');
    resolve(new Response(JSON.stringify({language: 'en'}))); await hydration;
    expect(getLanguage()).toBe('zh-CN');
  });
  it('shows a retry after persistence fails while keeping the selected interface language', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => respond({}, url !== '/api/preferences')));
    render(<Demo/>);
    fireEvent.change(screen.getByLabelText('界面语言'), {target: {value: 'en'}});
    expect(await screen.findByText(/Language changed, but could not be saved/)).toHaveAttribute('role', 'alert');
    vi.stubGlobal('fetch', vi.fn(() => respond({language: 'en'})));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(screen.queryByText(/Language changed, but could not be saved/)).not.toBeInTheDocument());
    expect(getLanguage()).toBe('en');
  });
  it.each([404, 405])('explains that an old DSH host must restart when the save route returns %s', async status => {
    window.mokiDshEmbed = true;
    vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/preferences'
      ? Promise.resolve(new Response(JSON.stringify({error: '资源不存在'}), {status}))
      : respond({})));
    render(<Demo/>);
    fireEvent.change(screen.getByLabelText('界面语言'), {target: {value: 'en'}});
    expect(await screen.findByText(/Quit and reopen DSH/)).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Interface language')).not.toBeDisabled();
    expect(screen.getByLabelText('Unsubmitted draft')).toHaveValue('已有文字 · My idea');
    expect(getLanguage()).toBe('en');
    fireEvent.change(screen.getByLabelText('Interface language'), {target: {value: 'zh-CN'}});
    expect(await screen.findByText(/请完全退出并重新打开 DSH/)).toHaveAttribute('role', 'status');
  });
  it('serializes preference writes and preserves parameter text verbatim', async () => {
    const saved: string[] = []; let release!: () => void;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      const value = JSON.parse(String(options.body)).language as string;
      if (value === 'en') await new Promise<void>(resolve => {release = resolve;});
      saved.push(value); return new Response('{}');
    }));
    const english = saveLanguage('en'), chinese = saveLanguage('zh-CN');
    await waitFor(() => expect(release).toBeTypeOf('function'));
    release(); await Promise.all([english, chinese]);
    expect(saved).toEqual(['en', 'zh-CN']);
    setLanguage('en');
    expect(t('重命名 {0}', '名字 {1}')).toBe('Rename 名字 {1}');
    expect(newMindMapLabel('左侧分支 2')).toBe('Left branch 2');
    expect(Object.values(newCanvasSnapshot().document.store).find(record => record.typeName === 'page')?.name).toBe('Page 1');
  });
  it('dismisses an English dialog from its backdrop', () => {
    const close = vi.fn();
    render(<div data-testid="outside"><section role="dialog" aria-modal="true"><button aria-label="Close settings" onClick={close}/></section></div>);
    act(() => { expect(dismissTopModalFromTarget(screen.getByTestId('outside'))).toBe(true); });
    expect(close).toHaveBeenCalledOnce();
  });
  it('updates mounted controls when another canvas frame changes the preference', () => {
    vi.stubGlobal('fetch', vi.fn(() => respond({})));
    render(<Demo/>);
    act(() => window.dispatchEvent(new StorageEvent('storage', {key: LANGUAGE_STORAGE_KEY, newValue: 'en'})));
    expect(screen.getByRole('dialog', {name: 'Settings'})).toBeInTheDocument();
    expect(screen.getByLabelText('Unsubmitted draft')).toHaveValue('已有文字 · My idea');
  });
});
