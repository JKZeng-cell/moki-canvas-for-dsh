(() => {
  // src/quick-prompt.js
  function createQuickPromptSender(ctx, t = (value) => value) {
    const requests = /* @__PURE__ */ new Map();
    return function sendQuickPrompt(sessionId, request, { valid = () => true, signal } = {}) {
      if (!request?.id || typeof request.text !== "string") return Promise.reject(new Error(t("\u5FEB\u6377\u6307\u4EE4\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165")));
      const key = sessionId + ":" + request.id;
      if (requests.has(key)) return requests.get(key);
      const pending = (async () => {
        let reference, drafts = [], accepted = false;
        const check = () => {
          if (signal?.aborted || !valid()) throw new Error(t("\u5F53\u524D\u6587\u4EF6\u6216\u4F1A\u8BDD\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u53D1\u9001"));
        };
        try {
          check();
          reference = ctx.sessions.retain(sessionId, { source: "moki-quick-composer" });
          await reference.ready;
          check();
          const session = reference.binding.session, files = request.files ?? [];
          if (files.some((file) => !(file instanceof File) || file.size > 32 * 1024 * 1024)) throw new Error(t("\u5355\u4E2A\u5BF9\u8BDD\u9644\u4EF6\u4E0D\u80FD\u8D85\u8FC7 32 MB"));
          drafts = ctx.conversation.createDrafts(sessionId, files, session.getSnapshot().subagent === null);
          const deadline = Date.now() + 12e4;
          while (drafts.length) {
            check();
            const uploads = ctx.conversation.fileUploads.getSnapshot();
            const states = drafts.map((draft) => uploads[draft.id] ?? (draft.kind === "image" ? { status: "ready" } : null));
            const failed = states.find((upload) => upload?.status === "error");
            if (failed) throw new Error(t("\u9644\u4EF6\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5"));
            if (states.every((upload) => upload?.status === "ready")) break;
            if (Date.now() > deadline) throw new Error(t("\u9644\u4EF6\u4E0A\u4F20\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5"));
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          check();
          const result = await ctx.conversation.sendSession(session, request.text, drafts.map((draft) => draft.id), "queue", signal);
          if (result?.kind === "error") throw new Error(t("DSH \u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u68C0\u67E5\u4F1A\u8BDD\u540E\u91CD\u8BD5"));
          accepted = true;
          return { sent: true };
        } finally {
          if (!accepted && drafts.length) ctx.conversation.releaseDraftAttachments(drafts);
          reference?.release();
        }
      })();
      requests.set(key, pending);
      pending.catch(() => requests.delete(key));
      if (requests.size > 100) requests.delete(requests.keys().next().value);
      return pending;
    };
  }

  // src/client.js
  window.__ModuleLoader__.load({
    id: "dsh-moki-canvas",
    factory(require2) {
      const React = require2("react"), h = React.createElement;
      const TYPE = "dsh-moki-canvas/board", KIND = "moki-whiteboard";
      const COPY = {
        zh: { title: "MOKI \u767D\u677F", open: "\u6253\u5F00 MOKI \u767D\u677F", guide: "\u81EA\u7531\u7F16\u8F91\u753B\u5E03\uFF0C\u4E0E DSH \u4E00\u8D77\u6574\u7406\u5185\u5BB9", share: "\u53D1\u9001\u9009\u533A\u7ED9 DSH", shareShort: "\u53D1\u7ED9 DSH", reload: "\u91CD\u65B0\u52A0\u8F7D\u767D\u677F", loading: "\u6B63\u5728\u8FDE\u63A5\u767D\u677F\u2026", retry: "\u91CD\u8BD5", empty: "\u9009\u4E2D\u753B\u5E03\u5185\u5BB9\u540E\u53EF\u53D1\u9001\u7ED9 DSH", sent: "\u5DF2\u52A0\u5165\u5F53\u524D\u5BF9\u8BDD\u8349\u7A3F", failed: "\u767D\u677F\u8FDE\u63A5\u5931\u8D25", noSession: "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u5BF9\u8BDD", noSelection: "\u8BF7\u5148\u5728\u767D\u677F\u4E2D\u9009\u62E9\u5185\u5BB9", busy: "\u5BF9\u8BDD\u6B63\u5728\u63D0\u4EA4\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" },
        en: { title: "MOKI Canvas", open: "Open MOKI Canvas", guide: "Edit a canvas and work with DSH", share: "Send selection to DSH", shareShort: "To DSH", reload: "Reload whiteboard", loading: "Connecting to whiteboard\u2026", retry: "Retry", empty: "Select canvas content to share with DSH", sent: "Added to this chat draft", failed: "Whiteboard connection failed", noSession: "Open a chat first", noSelection: "Select something on the canvas first", busy: "The chat is submitting. Please try again." }
      };
      Object.assign(COPY.zh, { sidebarTitle: "MOKI\u767D\u677F", selectionHint: "\u767D\u677F\u9009\u533A", choose: "\u5728\u767D\u677F\u4E2D\u9009\u62E9\u5185\u5BB9\u540E\uFF0C\u53EF\u70B9\u51FB\u6B64\u5904\u52A0\u5165\u5BF9\u8BDD", add: "\u52A0\u5165\u5BF9\u8BDD", adding: "\u6B63\u5728\u52A0\u5165\u2026", added: "\u5DF2\u52A0\u5165\u8349\u7A3F", attached: "\u9009\u533A\u5DF2\u52A0\u5165\u8349\u7A3F\uFF0C\u53D1\u9001\u6D88\u606F\u65F6\u4E00\u8D77\u63D0\u4EA4", textOnly: "\u6587\u5B57\u4E0E\u5143\u7D20\u4FE1\u606F\u5DF2\u52A0\u5165\uFF1B\u622A\u56FE\u672A\u5B8C\u6574\u52A0\u5165", changed: "\u9009\u533A\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u52A0\u5165\u5BF9\u8BDD", sendFailed: "\u52A0\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5", timedOut: "\u8BFB\u53D6\u9009\u533A\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5", plainOnly: "\u8BF7\u5148\u9000\u51FA\u5F53\u524D\u6307\u4EE4\uFF0C\u6216\u7B49\u5F85\u6D88\u606F\u63D0\u4EA4\u5B8C\u6210", selected: "\u5DF2\u9009 {count} \u9879", clickHint: "\u70B9\u51FB\u52A0\u5165\u5F53\u524D\u5BF9\u8BDD\u8349\u7A3F", preview: "\u67E5\u770B\u9009\u533A\u5185\u5BB9" });
      Object.assign(COPY.en, { sidebarTitle: COPY.en.title, selectionHint: "Whiteboard selection", choose: "Select canvas content, then click here to add it to the chat", add: "Add to chat", adding: "Adding\u2026", added: "Added to draft", attached: "Selection added to the draft; it will accompany your message", textOnly: "Text and element details added; some selection images are unavailable", changed: "Selection changed. Click again to add the new selection.", sendFailed: "Could not add selection. Try again.", timedOut: "Selection request timed out. Try again.", plainOnly: "Exit the current command or wait for the message to finish submitting", selected: "{count} selected", clickHint: "Click to add to this chat draft", preview: "Preview selection" });
      Object.assign(COPY.zh, { "\u9009\u533A\u5FEB\u6377\u5BF9\u8BDD": "\u9009\u533A\u5FEB\u6377\u5BF9\u8BDD", "\u4E0E DSH \u5BF9\u8BDD": "\u4E0E DSH \u5BF9\u8BDD", "\u5173\u95ED\u5FEB\u6377\u8F93\u5165": "\u5173\u95ED\u5FEB\u6377\u8F93\u5165", "\u5DF2\u9644\u5E26\u9009\u533A": "\u5DF2\u9644\u5E26\u9009\u533A", "\u9009\u533A\u6307\u4EE4": "\u9009\u533A\u6307\u4EE4", "\u8F93\u5165\u6307\u4EE4\uFF0C\u4E0E\u9009\u533A\u4E00\u8D77\u53D1\u9001\u2026": "\u8F93\u5165\u6307\u4EE4\uFF0C\u4E0E\u9009\u533A\u4E00\u8D77\u53D1\u9001\u2026", "Shift+Enter \u6362\u884C": "Shift+Enter \u6362\u884C", "\u6B63\u5728\u53D1\u9001\u2026": "\u6B63\u5728\u53D1\u9001\u2026", "\u53D1\u9001": "\u53D1\u9001", "\u9644\u4EF6": "\u9644\u4EF6", "\u6DFB\u52A0\u9644\u4EF6": "\u6DFB\u52A0\u9644\u4EF6", "\u79FB\u9664\u9644\u4EF6": "\u79FB\u9664\u9644\u4EF6", "\u5355\u4E2A\u5BF9\u8BDD\u9644\u4EF6\u4E0D\u80FD\u8D85\u8FC7 32 MB": "\u5355\u4E2A\u5BF9\u8BDD\u9644\u4EF6\u4E0D\u80FD\u8D85\u8FC7 32 MB", "\u5F53\u524D\u6587\u4EF6\u6216\u4F1A\u8BDD\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u53D1\u9001": "\u5F53\u524D\u6587\u4EF6\u6216\u4F1A\u8BDD\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u53D1\u9001", "\u5FEB\u6377\u6307\u4EE4\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165": "\u5FEB\u6377\u6307\u4EE4\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165", "\u9644\u4EF6\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5": "\u9644\u4EF6\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5", "\u9644\u4EF6\u4E0A\u4F20\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5": "\u9644\u4EF6\u4E0A\u4F20\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5", "DSH \u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u68C0\u67E5\u4F1A\u8BDD\u540E\u91CD\u8BD5": "DSH \u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u68C0\u67E5\u4F1A\u8BDD\u540E\u91CD\u8BD5", "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5": "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" });
      Object.assign(COPY.en, { "\u9009\u533A\u5FEB\u6377\u5BF9\u8BDD": "Quick selection chat", "\u4E0E DSH \u5BF9\u8BDD": "Chat with DSH", "\u5173\u95ED\u5FEB\u6377\u8F93\u5165": "Close quick input", "\u5DF2\u9644\u5E26\u9009\u533A": "Selection included", "\u9009\u533A\u6307\u4EE4": "Selection instruction", "\u8F93\u5165\u6307\u4EE4\uFF0C\u4E0E\u9009\u533A\u4E00\u8D77\u53D1\u9001\u2026": "Describe what to do with this selection\u2026", "Shift+Enter \u6362\u884C": "Shift+Enter for a new line", "\u6B63\u5728\u53D1\u9001\u2026": "Sending\u2026", "\u53D1\u9001": "Send", "\u9644\u4EF6": "Attachments", "\u6DFB\u52A0\u9644\u4EF6": "Add attachments", "\u79FB\u9664\u9644\u4EF6": "Remove attachment", "\u5355\u4E2A\u5BF9\u8BDD\u9644\u4EF6\u4E0D\u80FD\u8D85\u8FC7 32 MB": "Each chat attachment must be 32 MB or smaller", "\u5F53\u524D\u6587\u4EF6\u6216\u4F1A\u8BDD\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u53D1\u9001": "The file or conversation changed. Please send again.", "\u5FEB\u6377\u6307\u4EE4\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165": "This quick instruction is invalid. Please enter it again.", "\u9644\u4EF6\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5": "Attachment upload failed. Please try again.", "\u9644\u4EF6\u4E0A\u4F20\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5": "Attachment upload timed out. Please try again.", "DSH \u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u68C0\u67E5\u4F1A\u8BDD\u540E\u91CD\u8BD5": "DSH could not send the message. Check the conversation and retry.", "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5": "Could not send. Please try again." });
      let canvasLanguage = null;
      const languageListeners = /* @__PURE__ */ new Set();
      const subscribeLanguage = (fn) => {
        languageListeners.add(fn);
        return () => languageListeners.delete(fn);
      };
      const readLanguage = () => canvasLanguage;
      function setCanvasLanguage(value) {
        if (!["zh-CN", "en"].includes(value) || value === canvasLanguage) return;
        canvasLanguage = value;
        for (const listener of languageListeners) listener();
      }
      function useCanvasTranslation(fallback) {
        React.useSyncExternalStore(subscribeLanguage, readLanguage, readLanguage);
        return (key) => COPY[canvasLanguage === "zh-CN" ? "zh" : canvasLanguage]?.[key] ?? fallback(key);
      }
      const STYLE = `
      .moki-dsh-panel{position:relative;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
      .moki-dsh-bar{position:absolute;z-index:10;top:0;right:4px;display:flex;align-items:center;gap:2px;height:36px;font-size:12px}
      .moki-dsh-button{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;border:0;border-radius:5px;padding:4px 7px;cursor:pointer;font:inherit;color:inherit;background:transparent}
      .moki-dsh-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.moki-dsh-button:disabled{opacity:.45;cursor:default}
      .moki-dsh-body{position:relative;flex:1;min-height:0;display:flex}.moki-dsh-body iframe{border:0;width:100%;height:100%;min-width:0}
      body:has([data-side][data-dragging=true]) .moki-dsh-body iframe{pointer-events:none}
      .moki-dsh-status{position:absolute;z-index:20;right:8px;top:42px;max-width:calc(100% - 16px);display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 8px 6px 12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;box-shadow:0 2px 8px #0001}
      .moki-dsh-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:24px;text-align:center;background:var(--dsw-alias-bg-base)}
      [data-dockkit-tab]:has(.moki-dsh-tab-icon){min-width:104px}
      .moki-composer-selection{box-sizing:border-box;display:flex;align-items:center;gap:8px;min-width:0;width:calc(100% - var(--dsh-composer-side-clearance,16px) - var(--dsh-composer-side-clearance,16px));max-width:var(--dsh-composer-card-max-width,800px);margin:0 auto 5px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.5}
      .moki-composer-selection button{font:inherit;color:inherit;border:0;background:transparent;cursor:pointer}.moki-composer-selection button:disabled{cursor:default;opacity:.65}
      .moki-composer-selection-main{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:0;text-align:left}.moki-composer-selection-main:not(:disabled):hover{color:var(--dsw-alias-label-primary)}
      .moki-composer-selection-copy{display:flex;flex:1;min-width:0;flex-direction:column}.moki-composer-selection-heading{color:var(--dsw-alias-label-primary);font-weight:500}.moki-composer-selection-summary{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
      .moki-composer-selection-action{flex-shrink:0;border-radius:4px;padding:3px 5px;background:var(--dsw-alias-interactive-bg-hover)}.moki-composer-selection-preview{flex-shrink:0;padding:4px;line-height:1}
      .moki-composer-selection[data-state=empty]{padding:5px 9px}.moki-composer-selection[data-state=error]{border-color:var(--dsw-alias-label-secondary)}
      .moki-composer-selection[data-state=empty] .moki-composer-selection-heading{display:none}
      .moki-composer-selection-details{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance,16px) - var(--dsh-composer-side-clearance,16px));max-width:var(--dsh-composer-card-max-width,800px);margin:0 auto 7px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:140px;overflow-y:auto}
    `;
      const ICON_PATHS = [
        "M4.65 6.9 3.85 4.78C3.32 3.38 4.03 2.46 5.03 2.39 6.03 2.3 6.63 3.03 6.83 4.05L7.25 6.04 6.82 3.65C6.59 2.36 7.23 1.43 8.26 1.38 9.32 1.31 9.94 2.09 10.06 3.25L10.29 6.05C10.39 4.88 10.95 4.3 11.67 4.2 12.83 4.1 13.48 5.38 13.49 7.55",
        "M4.74 8.16C4.13 7.18 2.82 6.34 1.85 6.86.83 7.4 1.09 8.47 1.92 9.22 2.65 9.87 3.23 10.83 3.72 11.6 4.67 13.08 5.68 13.8 7.56 13.8 10.52 13.8 13.92 12.17 13.6 8.63",
        "M12.55 2.78 13.03 1.47M13.7 3.71 14.9 2.93"
      ];
      function Icon({ size = 16, className, style } = {}) {
        return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false, className, style: { flexShrink: 0, ...style } }, ...ICON_PATHS.map((d, key) => h("path", { d, key })));
      }
      function BoardTitle({ useTabInfo }) {
        const { tab } = useTabInfo();
        return h(React.Fragment, null, h(Icon, { className: "moki-dsh-tab-icon" }), tab.title);
      }
      function theme() {
        return getComputedStyle(document.documentElement).colorScheme === "dark" || document.body.hasAttribute("data-ds-dark-theme") || /dark/.test(document.documentElement.dataset.colorScheme ?? document.documentElement.dataset.theme ?? "") || document.documentElement.classList.contains("dark") ? "dark" : "light";
      }
      const selectionViews = /* @__PURE__ */ new Map(), selectionListeners = /* @__PURE__ */ new Map();
      function updateSelectionView(sessionId, owner, value) {
        const current = selectionViews.get(sessionId);
        if (value === null) {
          if (current?.owner !== owner) return;
          selectionViews.delete(sessionId);
        } else selectionViews.set(sessionId, { ...value, owner });
        for (const listener of selectionListeners.get(sessionId) ?? []) listener();
      }
      function useSelectionView(sessionId) {
        const subscribe = React.useCallback((listener) => {
          let listeners = selectionListeners.get(sessionId);
          if (!listeners) selectionListeners.set(sessionId, listeners = /* @__PURE__ */ new Set());
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
            if (!listeners.size) selectionListeners.delete(sessionId);
          };
        }, [sessionId]);
        const read = React.useCallback(() => selectionViews.get(sessionId) ?? null, [sessionId]);
        return React.useSyncExternalStore(subscribe, read, read);
      }
      function selectionContent(selection) {
        try {
          const { visualAttachments, ...content } = JSON.parse(selection.content);
          return JSON.stringify(content);
        } catch {
          return selection?.content ?? "";
        }
      }
      function selectionKey(boardId, selection) {
        return selection?.itemCount ? JSON.stringify([boardId, selection.source, selection.itemCount, selectionContent(selection)]) : "";
      }
      function selectionScope(boardId, selection) {
        try {
          const content = JSON.parse(selection?.content ?? "{}");
          if (selection?.source === "whiteboard" && Array.isArray(content.selectedShapes)) return JSON.stringify([boardId, selection.source, content.pageId, content.selectedShapes.map((shape) => shape.id).sort()]);
        } catch {
        }
        return selectionKey(boardId, selection);
      }
      function isTextSelection(selection) {
        try {
          return JSON.parse(selection.content).kind === "whiteboard_text_selection";
        } catch {
          return false;
        }
      }
      function quoteText(boardId, selection, prompt = "") {
        return [`MOKI \u767D\u677F ID\uFF1A${boardId}`, selection ? `\u9009\u533A\uFF1A${selection.label}
${selectionContent(selection)}` : "", prompt ? `\u8BF7\u6C42\uFF1A${prompt}` : isTextSelection(selection) ? "\u4EC5\u9488\u5BF9\u5F15\u7528\u4E2D selectedText \u7684\u5212\u9009\u6587\u5B57\u8FDB\u884C\u5BF9\u8BDD\uFF1B\u5176\u4ED6\u6587\u5B57\u672A\u88AB\u5F15\u7528\u3002" : "\u8BF7\u7ED3\u5408\u6B64\u9009\u533A\u548C whiteboard_get_selection \u8BFB\u53D6\u3001\u5206\u6790\u6216\u7F16\u8F91\u767D\u677F\u3002"].filter(Boolean).join("\n\n");
      }
      function draftIncludes(draft, text) {
        return !!text && String(draft ?? "").replace(/^> ?/gm, "").includes(text);
      }
      function selectionPreview(selection) {
        try {
          const data = JSON.parse(selection.content), items = data.selectedShapes ?? data.annotations ?? [];
          return items.map((item) => item.text ?? item.annotation ?? item.name ?? item.title ?? item.type ?? "").filter(Boolean).join(" \xB7 ") || selection.label;
        } catch {
          return selection?.label ?? "";
        }
      }
      function composerSelection(fallback) {
        return function SelectionHint({ sessionId, useInput }) {
          const t = useCanvasTranslation(fallback);
          const view = useSelectionView(sessionId), input = useInput((state) => state), [expanded, setExpanded] = React.useState(false);
          const key = selectionKey(view?.boardId, view?.selection);
          React.useEffect(() => setExpanded(false), [sessionId, key]);
          if (!view?.boardId) return null;
          const selected = !!view.selection?.itemCount, quoted = selected && draftIncludes(input?.draft, quoteText(view.boardId, view.selection));
          const locked = input?.phase !== "plain", status = view.pending ? "pending" : quoted ? "added" : view.error ? "error" : selected ? "ready" : "empty";
          const summary = view.pending ? t("adding") : quoted ? view.textOnly ? t("textOnly") : t("attached") : view.error || (selected ? selectionPreview(view.selection) : t("choose"));
          const heading = selected ? `${t("selectionHint")} \xB7 ${t("selected").replace("{count}", String(view.selection.itemCount))}` : t("selectionHint");
          return h(
            React.Fragment,
            null,
            h("style", null, STYLE),
            h(
              "div",
              { className: "moki-composer-selection", "data-state": status, "aria-label": t("selectionHint") },
              h(
                "button",
                { type: "button", className: "moki-composer-selection-main", disabled: !selected || !!view.pending || quoted || locked, "aria-label": `${heading} \xB7 ${quoted ? t("added") : t("add")}`, title: locked ? t("plainOnly") : quoted ? t("attached") : t("clickHint"), onMouseDown: (event) => event.preventDefault(), onClick: () => view.share() },
                h(Icon),
                h("span", { className: "moki-composer-selection-copy" }, h("span", { className: "moki-composer-selection-heading" }, heading), h("span", { className: "moki-composer-selection-summary", role: "status" }, summary)),
                selected ? h("span", { className: "moki-composer-selection-action" }, view.pending ? t("adding") : quoted ? "\u2713 " + t("added") : t("add")) : null
              ),
              selected ? h("button", { type: "button", className: "moki-composer-selection-preview", "aria-label": t("preview"), "aria-expanded": expanded, onClick: () => setExpanded((value) => !value) }, expanded ? "\u2303" : "\u2304") : null
            ),
            expanded && selected ? h("div", { className: "moki-composer-selection-details" }, selectionPreview(view.selection).slice(0, 2e3)) : null
          );
        };
      }
      function panel(fallback, conversation, locale, ctx) {
        const submitQuick = createQuickPromptSender(ctx, (message) => COPY[canvasLanguage === "en" ? "en" : "zh"][message] ?? message);
        return function BoardPanel({ sessionId, inputActions, useTabInfo, useSession, useInput }) {
          const t = useCanvasTranslation(fallback);
          const { tab } = useTabInfo();
          const canUploadImages = useSession((snapshot) => snapshot.subagent === null);
          const input = useInput((state) => state);
          const [attempt, setAttempt] = React.useState(0), [url, setUrl] = React.useState(), [phase, setPhase] = React.useState("loading"), [notice, setNotice] = React.useState(""), [selection, setSelection] = React.useState(null), [boardId, setBoardId] = React.useState(null), [fullscreen, setFullscreen] = React.useState(false);
          const [pending, setPending] = React.useState(null), [shareError, setShareError] = React.useState(""), [textOnly, setTextOnly] = React.useState(false);
          const pendingRef = React.useRef(null);
          const transfers = React.useRef(/* @__PURE__ */ new Map());
          const frame = React.useRef(null), bridge = React.useRef(crypto.randomUUID()), latest = React.useRef({ tab, inputActions });
          latest.current = { tab, inputActions, input, phase, boardId, selection };
          const send = React.useCallback((type, body = {}) => {
            if (url) frame.current?.contentWindow?.postMessage({ type, bridgeId: bridge.current, ...body }, new URL(url).origin);
          }, [url]);
          const finish = React.useCallback((error, warning) => {
            const current = pendingRef.current;
            if (current) clearTimeout(current.timer);
            pendingRef.current = null;
            setPending(null);
            setShareError(error ?? "");
            if (current?.inline) send("dsh:quote-result", { requestId: current.requestId, ok: !error, message: error || warning });
          }, [send]);
          const share = React.useCallback(() => {
            const current = latest.current;
            if (pendingRef.current || !current.tab.visible || current.phase !== "ready" || !current.boardId || !current.selection?.itemCount) return;
            if (current.input?.phase !== "plain") {
              setShareError(t("plainOnly"));
              return;
            }
            if (draftIncludes(current.input.draft, quoteText(current.boardId, current.selection))) return;
            const requestId = crypto.randomUUID(), key = selectionKey(current.boardId, current.selection);
            const timer = setTimeout(() => {
              if (pendingRef.current?.requestId === requestId) {
                finish(t("timedOut"));
                setNotice(t("timedOut"));
              }
            }, 15e3);
            pendingRef.current = { requestId, key, timer };
            setPending(requestId);
            setShareError("");
            setTextOnly(false);
            send("dsh:quote", { requestId, selectionKey: key });
          }, [send, finish]);
          React.useEffect(() => {
            if (tab.visible && phase === "ready" && boardId) updateSelectionView(sessionId, bridge.current, { boardId, selection, pending, error: shareError, textOnly, share });
            else updateSelectionView(sessionId, bridge.current, null);
            return () => updateSelectionView(sessionId, bridge.current, null);
          }, [sessionId, tab.visible, phase, boardId, selection, pending, shareError, textOnly, share]);
          React.useEffect(() => {
            if (!tab.visible) {
              finish(t("changed"));
              setSelection(null);
            }
          }, [tab.visible, finish]);
          React.useEffect(() => () => {
            if (pendingRef.current) clearTimeout(pendingRef.current.timer);
            pendingRef.current = null;
            updateSelectionView(sessionId, bridge.current, null);
          }, [sessionId]);
          React.useEffect(() => {
            let disposed = false;
            const abort = new AbortController();
            setPhase("loading");
            setNotice("");
            setUrl(void 0);
            setFullscreen(false);
            setSelection(null);
            setBoardId(null);
            finish();
            void (async () => {
              const r = await fetch("/moki-whiteboard/info", { signal: abort.signal, cache: "no-store" });
              if (!r.ok) throw new Error(`${t("failed")} (${r.status})`);
              const info = await r.json();
              if (!info.running || !info.appUrl) throw new Error(t("failed"));
              const target = new URL(info.appUrl);
              let board;
              try {
                board = localStorage.getItem(`moki:dsh:board:${sessionId}`);
              } catch {
              }
              if (board) target.pathname = "/board/" + encodeURIComponent(board);
              target.search = new URLSearchParams({ dshEmbed: "1", dshSession: sessionId, dshBridge: bridge.current, dshParent: location.origin, theme: theme(), dshLanguage: locale.getSnapshot().active }).toString();
              if (!disposed) setUrl(target.toString());
            })().catch((error) => {
              if (!disposed) {
                setNotice(error.message);
                setPhase("failed");
              }
            });
            return () => {
              disposed = true;
              abort.abort();
            };
          }, [attempt, sessionId]);
          React.useEffect(() => {
            if (!url) return;
            const receive = (event) => {
              if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin || event.data?.bridgeId !== bridge.current) return;
              const data = event.data;
              if (data.type === "moki:language") setCanvasLanguage(data.language);
              if (data.type === "moki:ready") {
                setPhase("ready");
                send("dsh:theme", { theme: theme() });
                send("dsh:language", { language: locale.getSnapshot().active });
                send("dsh:active", { active: latest.current.tab.visible });
              }
              if (data.type === "moki:state") {
                const nextKey = selectionKey(data.boardId, data.selection), oldKey = selectionKey(latest.current.boardId, latest.current.selection);
                if (nextKey !== oldKey) {
                  setShareError("");
                  setTextOnly(false);
                }
                if (pendingRef.current && (pendingRef.current.scope !== void 0 ? pendingRef.current.scope !== selectionScope(data.boardId, data.selection) : pendingRef.current.key !== nextKey)) finish(t("changed"));
                setSelection(data.selection);
                setBoardId(data.boardId);
                try {
                  if (data.boardId) localStorage.setItem(`moki:dsh:board:${sessionId}`, data.boardId);
                  else localStorage.removeItem(`moki:dsh:board:${sessionId}`);
                } catch {
                }
              }
              if (data.type === "moki:error") {
                if (!data.requestId || pendingRef.current?.requestId === data.requestId) {
                  setNotice(data.message);
                  if (data.requestId) finish(data.message);
                }
              }
              if (data.type === "moki:layout") setFullscreen(data.fullscreen === true);
              if (data.type === "moki:quote-request") {
                const current = latest.current;
                const matches = data.selectionScope !== void 0 ? data.selectionScope === selectionScope(current.boardId, current.selection) : data.selectionKey === selectionKey(current.boardId, current.selection);
                const error = !current.tab.visible || current.phase !== "ready" || data.boardId !== current.boardId || !matches ? t("changed") : !data.submit && current.input?.phase !== "plain" || pendingRef.current ? t("plainOnly") : !data.quoteKey ? t("noSelection") : null;
                if (error) {
                  send("dsh:quote-result", { requestId: data.requestId, ok: false, message: error });
                  return;
                }
                const timer = setTimeout(() => {
                  if (pendingRef.current?.requestId === data.requestId) {
                    finish(t("timedOut"));
                    setNotice(t("timedOut"));
                  }
                }, data.submit ? 18e4 : 15e3);
                pendingRef.current = { requestId: data.requestId, key: data.selectionKey, scope: data.selectionScope, quoteKey: data.quoteKey, inline: true, submit: data.submit === true, timer };
                setPending(data.requestId);
                setShareError("");
                setTextOnly(false);
                send("dsh:quote", { requestId: data.requestId, selectionKey: data.selectionKey });
              }
              if (data.type === "moki:quote-cancel" && pendingRef.current?.requestId === data.requestId) finish(t("changed"));
              if (data.type === "moki:quote" && latest.current.tab.visible) {
                if (data.requestId && pendingRef.current?.requestId !== data.requestId) return;
                if (data.requestId && selectionKey(data.boardId, data.selection) !== (pendingRef.current?.quoteKey ?? pendingRef.current?.key)) {
                  finish(t("changed"));
                  return;
                }
                if (data.boardId !== latest.current.boardId) {
                  finish(t("changed"));
                  return;
                }
                if (data.submission) {
                  const request = pendingRef.current;
                  if (!request?.submit || request.sending) return;
                  request.sending = true;
                  const images = (data.images ?? []).slice(0, 3).filter((image) => image.bytes instanceof ArrayBuffer && image.bytes.byteLength <= 8 * 1024 * 1024 && /^image\/(png|jpeg|webp|gif)$/.test(image.mediaType));
                  const text2 = [quoteText(data.boardId, data.selection).split("\n").map((line) => "> " + line).join("\n"), data.submission.prompt].filter(Boolean).join("\n\n");
                  const files = [...data.submission.files ?? [], ...images.map((image) => new File([image.bytes], image.name, { type: image.mediaType }))];
                  void submitQuick(sessionId, { id: data.submission.id, text: text2, files }, { valid: () => pendingRef.current === request && latest.current.tab.visible && latest.current.boardId === data.boardId && ctx.uiSession.adapter.current.getSnapshot().key === sessionId }).then(() => {
                    if (pendingRef.current !== request) return;
                    finish();
                    ctx.layout.selectPanel(null);
                    requestAnimationFrame(() => document.querySelector('[data-conversation-content][data-conversation-session="' + CSS.escape(sessionId) + '"] [data-composer-input]')?.focus({ preventScroll: true }));
                  }, (error) => {
                    if (pendingRef.current === request) finish(error.message);
                  });
                  return;
                }
                if (!data.selection && !data.prompt) {
                  finish(t("noSelection"));
                  setNotice(t("noSelection"));
                  return;
                }
                const text = quoteText(data.boardId, data.selection, data.prompt);
                if (draftIncludes(latest.current.input?.draft, text)) {
                  finish();
                  return;
                }
                if (latest.current.input?.phase !== "plain") {
                  finish(t("plainOnly"));
                  setNotice(t("plainOnly"));
                  return;
                }
                const ok = latest.current.inputActions?.insertQuote(text);
                if (ok) {
                  try {
                    const images = (data.images ?? []).slice(0, 3).filter((image) => image.bytes instanceof ArrayBuffer && image.bytes.byteLength <= 8 * 1024 * 1024 && /^image\/(png|jpeg|webp|gif)$/.test(image.mediaType));
                    const key = selectionKey(data.boardId, data.selection), known = transfers.current.get(key) ?? /* @__PURE__ */ new Map(), activeIds = new Set(latest.current.input?.attachmentIds ?? []);
                    const imageKey = (image, index) => image.source ?? `${index}:${image.name}:${image.mediaType}`;
                    const missing = images.map((image, index) => ({ image, key: imageKey(image, index) })).filter((item) => !activeIds.has(known.get(item.key)));
                    if (missing.length) {
                      const drafts = conversation.createDrafts(sessionId, missing.map(({ image }) => new File([image.bytes], image.name, { type: image.mediaType })), canUploadImages);
                      if (!latest.current.inputActions.addAttachments(drafts.map((d) => d.id))) {
                        conversation.releaseDraftAttachments(drafts);
                        throw new Error(t("busy"));
                      }
                      drafts.forEach((draft, index) => {
                        known.set(missing[index].key, draft.id);
                        activeIds.add(draft.id);
                      });
                    }
                    transfers.current.set(key, known);
                    if (transfers.current.size > 20) transfers.current.delete(transfers.current.keys().next().value);
                    const hasImage = [...known.values()].some((id) => activeIds.has(id));
                    const partial = !!data.imageWarning || !hasImage && !!data.selection && !isTextSelection(data.selection);
                    latest.current.inputActions.persistDraft();
                    setTextOnly(partial);
                    setNotice(partial ? t("textOnly") : t("sent"));
                    finish(void 0, partial ? t("textOnly") : void 0);
                  } catch (error) {
                    latest.current.inputActions.persistDraft();
                    setTextOnly(true);
                    finish(void 0, t("textOnly") + "\uFF1A" + error.message);
                    setNotice(t("textOnly") + "\uFF1A" + error.message);
                  }
                } else {
                  finish(t("busy"));
                  setNotice(t("busy"));
                }
              }
            };
            window.addEventListener("message", receive);
            const unsubscribeLocale = locale.subscribe(() => send("dsh:language", { language: locale.getSnapshot().active }));
            const observer = new MutationObserver(() => send("dsh:theme", { theme: theme() }));
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-color-scheme", "data-ds-theme-source", "class", "style"] });
            observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
            const timeout = setTimeout(() => setPhase((current) => current === "loading" ? "failed" : current), 2e4);
            return () => {
              clearTimeout(timeout);
              observer.disconnect();
              unsubscribeLocale();
              window.removeEventListener("message", receive);
              send("dsh:active", { active: false });
            };
          }, [url, send, sessionId, canUploadImages]);
          React.useEffect(() => {
            send("dsh:active", { active: tab.visible });
          }, [tab.visible, send]);
          React.useEffect(() => {
            if (!notice.startsWith(t("sent"))) return;
            const timer = setTimeout(() => setNotice(""), 5e3);
            return () => clearTimeout(timer);
          }, [notice]);
          return h(
            "div",
            { className: "moki-dsh-panel" },
            h("style", null, STYLE),
            !fullscreen ? h(
              "div",
              { className: "moki-dsh-bar" },
              boardId ? h("button", { className: "moki-dsh-button", title: selection?.itemCount ? `${t("share")} \xB7 ${selection.itemCount} \u9879` : t("empty"), "aria-label": t("share"), disabled: !selection?.itemCount || phase !== "ready" || !!pending || input?.phase !== "plain" || draftIncludes(input?.draft, quoteText(boardId, selection)), onMouseDown: (e) => e.preventDefault(), onClick: share }, pending ? t("adding") : t("shareShort")) : null,
              h("button", { className: "moki-dsh-button", title: t("reload"), "aria-label": t("reload"), onClick: () => setAttempt((n) => n + 1) }, "\u21BB")
            ) : null,
            notice ? h("div", { className: "moki-dsh-status", role: "status" }, notice, h("button", { className: "moki-dsh-button", "aria-label": "\u5173\u95ED\u63D0\u793A", onClick: () => setNotice("") }, "\xD7")) : null,
            h(
              "div",
              { className: "moki-dsh-body" },
              url ? h("iframe", { key: attempt, ref: frame, src: url, title: "MOKI \u767D\u677F\u753B\u5E03", allow: "clipboard-read; clipboard-write; fullscreen; autoplay", referrerPolicy: "no-referrer" }) : null,
              phase !== "ready" ? h("div", { className: "moki-dsh-loading" }, h("span", null, t(phase === "failed" ? "failed" : "loading")), phase === "failed" ? h("button", { className: "moki-dsh-button", onClick: () => setAttempt((n) => n + 1) }, t("retry")) : null) : null
            )
          );
        };
      }
      function registerSidebarLauncher(ctx, t) {
        const layout = ctx.layout, current = ctx.uiSession.adapter.current;
        function SessionHint() {
          return h("div", { role: "status", style: { padding: 24 } }, t("noSession"));
        }
        ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: KIND, locale: "mokiWhiteboard" }, SessionHint));
        ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: KIND, order: 20, locale: "mokiWhiteboard", label: () => t("sidebarTitle") }, Icon));
        ctx.effect(() => {
          let previousPanel, timer, stopWaiting, showingHint = false;
          function cancelPending() {
            clearTimeout(timer);
            stopWaiting?.();
            stopWaiting = void 0;
          }
          function followSelection() {
            const panel2 = layout.panelInfo.getSnapshot().activePanelId;
            if (panel2 === previousPanel) return;
            previousPanel = panel2;
            cancelPending();
            if (panel2 !== KIND || showingHint) return;
            layout.selectPanel(null);
            function openWhenReady(sessionId, attempt) {
              if (current.getSnapshot().key !== sessionId) return;
              if (ctx.sidebarRight.mounted.getSnapshot() === sessionId) {
                try {
                  ctx.sidebarRight.openTab(KIND);
                  return;
                } catch (error) {
                  if (error?.message !== "sidebarRight: no session surface is mounted") throw error;
                }
              }
              if (attempt < 30) {
                timer = setTimeout(() => openWhenReady(sessionId, attempt + 1), 100);
                return;
              }
              showingHint = true;
              try {
                layout.selectPanel(KIND);
              } finally {
                showingHint = false;
              }
            }
            function openSelectedSession() {
              const sessionId = current.getSnapshot().key;
              if (!sessionId) return;
              cancelPending();
              openWhenReady(sessionId, 1);
            }
            if (current.getSnapshot().key) openSelectedSession();
            else {
              stopWaiting = current.subscribe(openSelectedSession);
              ctx.uiWorkspace.startSession();
            }
          }
          const unsubscribe = layout.panelInfo.subscribe(followSelection);
          followSelection();
          return () => {
            unsubscribe();
            cancelPending();
          };
        }, "moki: sidebar navigation");
      }
      return {
        inject: ["slots", "sidebarRight", "sidebarRightTabs", "locale", "layout", "uiSession", "uiWorkspace", "sessions", "conversation"],
        apply(ctx) {
          try {
            const NS = "mokiWhiteboard";
            ctx.effect(() => ctx.locale.register(NS, COPY), "moki: locale");
            const t = ctx.locale.bind(NS);
            ctx.effect(() => ctx.sidebarRightTabs.register({ id: TYPE, kind: KIND, title: () => t("title"), keepMounted: true, guide: [{ id: KIND, order: 25, title: () => t("title"), description: () => t("guide"), icon: Icon }] }), "moki: tab");
            ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: TYPE, locale: NS }, panel(t, ctx.conversation, ctx.locale, ctx)));
            ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: TYPE }, BoardTitle));
            ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({ name: "conversation.input.dock", id: "moki-whiteboard-selection", order: 10, locale: NS }, composerSelection(t)));
            registerSidebarLauncher(ctx, t);
          } catch (error) {
            console.error("MOKI plugin activation failed", error);
            throw error;
          }
        }
      };
    }
  });
})();
