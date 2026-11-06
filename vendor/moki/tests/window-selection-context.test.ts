// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {replaceWorkbenchSelectionContext,readWorkbenchSelectionContext,subscribeWorkbenchSelectionContext,WORKBENCH_SELECTION_STORAGE_KEY,requestMokiAssistance,readPendingMokiAssistantComposeRequest} from '../src/vendor/moki/web/lib/workbench-selection-context.js';
afterEach(()=>{delete window.mokiDesktop;delete window.mokiDshEmbed;localStorage.clear();sessionStorage.clear();});
it.each(['desktop','dsh'])('keeps %s Agent selection/compose state in this window and ignores other-window storage events',(host)=>{
 if(host==='desktop')window.mokiDesktop={captureWhiteboardLinkPreview:async()=>null,windows:{openBoard:async()=>{},focusBoard:async()=>false}};
 else window.mokiDshEmbed=true;
 const other={source:'whiteboard' as const,label:'other board',itemCount:1,content:'other',capturedAt:new Date().toISOString()},own={...other,label:'current board',content:'own'};
 localStorage.setItem(WORKBENCH_SELECTION_STORAGE_KEY,JSON.stringify(other));replaceWorkbenchSelectionContext(own);expect(readWorkbenchSelectionContext()).toEqual(own);expect(JSON.parse(localStorage.getItem(WORKBENCH_SELECTION_STORAGE_KEY)!)).toEqual(other);
 const listener=vi.fn(),off=subscribeWorkbenchSelectionContext(listener);window.dispatchEvent(new StorageEvent('storage',{key:WORKBENCH_SELECTION_STORAGE_KEY}));expect(listener).not.toHaveBeenCalled();off();
 requestMokiAssistance(own,'整理当前白板');expect(readPendingMokiAssistantComposeRequest()?.prompt).toBe('整理当前白板');replaceWorkbenchSelectionContext(undefined);expect(readWorkbenchSelectionContext()).toBeUndefined();expect(JSON.parse(localStorage.getItem(WORKBENCH_SELECTION_STORAGE_KEY)!)).toEqual(other);
});
