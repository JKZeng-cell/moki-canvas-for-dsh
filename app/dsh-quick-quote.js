import { t } from './i18n.js';
export const DSH_QUICK_QUOTE = 'moki:dsh-quick-quote';
export const DSH_CANCEL_QUOTE = 'moki:dsh-cancel-quote';
export const DSH_QUOTE_RESULT = 'moki:dsh-quote-result';
/** Acknowledged by the owning DSH composer, never by merely posting a message. */
export function quoteDshSelection(selection, signal) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
        const finish = (result) => {
            clearTimeout(timer);
            removeEventListener(DSH_QUOTE_RESULT, receive);
            signal.removeEventListener('abort', cancel);
            resolve(result);
        };
        const receive = (event) => {
            const result = event.detail;
            if (result?.requestId === requestId)
                finish(result);
        };
        const cancel = () => {
            dispatchEvent(new CustomEvent(DSH_CANCEL_QUOTE, { detail: { requestId } }));
            finish({ requestId, ok: false });
        };
        const timer = setTimeout(() => {
            dispatchEvent(new CustomEvent(DSH_CANCEL_QUOTE, { detail: { requestId } }));
            finish({ requestId, ok: false, message: t('读取选区超时，请重试') });
        }, 16000);
        addEventListener(DSH_QUOTE_RESULT, receive);
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted)
            cancel();
        else
            dispatchEvent(new CustomEvent(DSH_QUICK_QUOTE, { detail: { requestId, selection } }));
    });
}
