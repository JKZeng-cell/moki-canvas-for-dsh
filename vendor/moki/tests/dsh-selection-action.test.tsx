// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useRef, useState} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {DshSelectionAction} from '../src/web/dsh-selection-action.js';
import {quoteDshSelection, type QuoteResult} from '../src/web/dsh-quick-quote.js';
import {setLanguage} from '../src/web/i18n.js';

vi.mock('../src/web/dsh-quick-quote.js', () => ({quoteDshSelection: vi.fn()}));
beforeEach(() => {
  setLanguage('en');
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600));
  Object.defineProperty(Range.prototype, 'getClientRects', {configurable: true, value: () => [new DOMRect(100, 200, 180, 24)]});
});
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.mocked(quoteDshSelection).mockReset();});

function Editor() {
  const root = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(true);
  return <div ref={root}>
    <canvas className="native-whiteboard-canvas" data-testid="canvas" />
    {editing && <textarea ref={textarea} aria-label="Canvas text" data-whiteboard-inline-text-editor="shape:one" defaultValue={'Only these words.\nDo not include this sentence.'} />}
    <DshSelectionAction root={root} textarea={textarea} editing={editing} finishEditing={() => setEditing(false)} selectionId={editing ? 'before-commit' : 'after-commit'} pageId="page:one" pageName="Canvas" blocked={false} bounds={{left:100,top:200,width:240,height:100}} />
  </div>;
}

it('captures the excerpt before committing, survives focus changes, and retries the same excerpt after a failed receipt', async () => {
  let respond!: (result: QuoteResult) => void;
  vi.mocked(quoteDshSelection).mockImplementation(() => new Promise(resolve => {respond = resolve;}));
  render(<Editor />);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  input.focus(); input.setSelectionRange(0, 17); fireEvent.select(input);
  const button = await screen.findByRole('button', {name:'Quote in DSH'});
  fireEvent.pointerDown(button); fireEvent.click(button);
  await waitFor(() => expect(quoteDshSelection).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  const [selection, signal] = vi.mocked(quoteDshSelection).mock.calls[0]!;
  expect(JSON.parse(selection!.content)).toMatchObject({kind:'whiteboard_text_selection',shapeId:'shape:one',selectedText:'Only these words.',range:{start:0,end:17}});
  expect(selection!.content).not.toContain('Do not include');
  expect(signal.aborted).toBe(false);
  fireEvent.blur(window); fireEvent.click(screen.getByRole('button', {name:'Adding to chat…'}));
  expect(quoteDshSelection).toHaveBeenCalledTimes(1);
  await act(async () => respond({requestId:'one',ok:false,message:'Composer busy'}));
  fireEvent.click(screen.getByRole('button', {name:'Retry adding to chat'}));
  await waitFor(() => expect(quoteDshSelection).toHaveBeenCalledTimes(2));
  expect(vi.mocked(quoteDshSelection).mock.calls[1]![0]?.content).toBe(selection!.content);
  await act(async () => respond({requestId:'two',ok:true}));
  expect(screen.getByRole('button', {name:'Added to chat draft'})).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByTestId('canvas')); fireEvent.pointerUp(window);
  await waitFor(() => expect(screen.getByRole('button', {name:'Quote in DSH'})).toBeInTheDocument());
});

it('cancels the pending excerpt if the user starts a new canvas selection', async () => {
  vi.mocked(quoteDshSelection).mockImplementation(() => new Promise(() => {}));
  const view = render(<Editor />);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  input.focus(); input.setSelectionRange(0, 17); fireEvent.select(input);
  fireEvent.click(await screen.findByRole('button', {name:'Quote in DSH'}));
  await waitFor(() => expect(quoteDshSelection).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(quoteDshSelection).mock.calls[0]![1];
  fireEvent.pointerDown(screen.getByTestId('canvas'));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.unmount();
});
