window.__ModuleLoader__.load({
  id: 'dsh-moki-canvas',
  factory(require) {
    const React = require('react'), h = React.createElement
    const TYPE = 'dsh-moki-canvas/board', KIND = 'moki-whiteboard'
    const COPY = {
      zh: { title:'MOKI 白板',open:'打开 MOKI 白板',guide:'自由编辑画布，与 DSH 一起整理内容',share:'发送选区给 DSH',shareShort:'发给 DSH',reload:'重新加载白板',loading:'正在连接白板…',retry:'重试',empty:'选中画布内容后可发送给 DSH',sent:'已加入当前对话草稿',failed:'白板连接失败',noSession:'请先打开一个对话',noSelection:'请先在白板中选择内容',busy:'对话正在提交，请稍后再试' },
      en: { title:'MOKI Canvas',open:'Open MOKI Canvas',guide:'Edit a canvas and work with DSH',share:'Send selection to DSH',shareShort:'To DSH',reload:'Reload whiteboard',loading:'Connecting to whiteboard…',retry:'Retry',empty:'Select canvas content to share with DSH',sent:'Added to this chat draft',failed:'Whiteboard connection failed',noSession:'Open a chat first',noSelection:'Select something on the canvas first',busy:'The chat is submitting. Please try again.' },
    }
    Object.assign(COPY.zh, {sidebarTitle:'MOKI白板',selectionHint:'白板选区',choose:'在白板中选择内容后，可点击此处加入对话',add:'加入对话',adding:'正在加入…',added:'已加入草稿',attached:'选区已加入草稿，发送消息时一起提交',textOnly:'文字与元素信息已加入；截图未完整加入',changed:'选区已变化，请重新点击加入对话',sendFailed:'加入失败，请重试',timedOut:'读取选区超时，请重试',plainOnly:'请先退出当前指令，或等待消息提交完成',selected:'已选 {count} 项',clickHint:'点击加入当前对话草稿',preview:'查看选区内容'})
    Object.assign(COPY.en, {sidebarTitle:COPY.en.title,selectionHint:'Whiteboard selection',choose:'Select canvas content, then click here to add it to the chat',add:'Add to chat',adding:'Adding…',added:'Added to draft',attached:'Selection added to the draft; it will accompany your message',textOnly:'Text and element details added; some selection images are unavailable',changed:'Selection changed. Click again to add the new selection.',sendFailed:'Could not add selection. Try again.',timedOut:'Selection request timed out. Try again.',plainOnly:'Exit the current command or wait for the message to finish submitting',selected:'{count} selected',clickHint:'Click to add to this chat draft',preview:'Preview selection'})
    let canvasLanguage=null
    const languageListeners=new Set()
    const subscribeLanguage=fn=>{languageListeners.add(fn);return()=>languageListeners.delete(fn)}
    const readLanguage=()=>canvasLanguage
    function setCanvasLanguage(value){if(!['zh-CN','en'].includes(value)||value===canvasLanguage)return;canvasLanguage=value;for(const listener of languageListeners)listener()}
    function useCanvasTranslation(fallback){React.useSyncExternalStore(subscribeLanguage,readLanguage,readLanguage);return key=>COPY[canvasLanguage==='zh-CN'?'zh':canvasLanguage]?.[key]??fallback(key)}
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
    `
    // MOKI's three-finger high-five silhouette, on DSH's 16 px / 1 px outline grid.
    // Keep these paths in sync with icon.svg, the package-manager glyph.
    const ICON_PATHS = [
      'M4.65 6.9 3.85 4.78C3.32 3.38 4.03 2.46 5.03 2.39 6.03 2.3 6.63 3.03 6.83 4.05L7.25 6.04 6.82 3.65C6.59 2.36 7.23 1.43 8.26 1.38 9.32 1.31 9.94 2.09 10.06 3.25L10.29 6.05C10.39 4.88 10.95 4.3 11.67 4.2 12.83 4.1 13.48 5.38 13.49 7.55',
      'M4.74 8.16C4.13 7.18 2.82 6.34 1.85 6.86.83 7.4 1.09 8.47 1.92 9.22 2.65 9.87 3.23 10.83 3.72 11.6 4.67 13.08 5.68 13.8 7.56 13.8 10.52 13.8 13.92 12.17 13.6 8.63',
      'M12.55 2.78 13.03 1.47M13.7 3.71 14.9 2.93',
    ]
    function Icon({size=16,className,style}={}){return h('svg',{width:size,height:size,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor',strokeWidth:1,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:false,className,style:{flexShrink:0,...style}},...ICON_PATHS.map((d,key)=>h('path',{d,key})))}
    function BoardTitle({useTabInfo}){const {tab}=useTabInfo();return h(React.Fragment,null,h(Icon,{className:'moki-dsh-tab-icon'}),tab.title)}
    function theme(){return getComputedStyle(document.documentElement).colorScheme==='dark'||document.body.hasAttribute('data-ds-dark-theme')||/dark/.test(document.documentElement.dataset.colorScheme??document.documentElement.dataset.theme??'')||document.documentElement.classList.contains('dark')?'dark':'light'}

    // Session-scoped UI state. Only the visible, owning frame may publish or clear it.
    const selectionViews=new Map(),selectionListeners=new Map()
    function updateSelectionView(sessionId,owner,value){
      const current=selectionViews.get(sessionId)
      if(value===null){if(current?.owner!==owner)return;selectionViews.delete(sessionId)}
      else selectionViews.set(sessionId,{...value,owner})
      for(const listener of selectionListeners.get(sessionId)??[])listener()
    }
    function useSelectionView(sessionId){
      const subscribe=React.useCallback(listener=>{let listeners=selectionListeners.get(sessionId);if(!listeners)selectionListeners.set(sessionId,listeners=new Set());listeners.add(listener);return()=>{listeners.delete(listener);if(!listeners.size)selectionListeners.delete(sessionId)}},[sessionId])
      const read=React.useCallback(()=>selectionViews.get(sessionId)??null,[sessionId])
      return React.useSyncExternalStore(subscribe,read,read)
    }
    function selectionContent(selection){try{const {visualAttachments,...content}=JSON.parse(selection.content);return JSON.stringify(content)}catch{return selection?.content??''}}
    function selectionKey(boardId,selection){return selection?.itemCount?JSON.stringify([boardId,selection.source,selection.itemCount,selectionContent(selection)]):''}
    function quoteText(boardId,selection,prompt=''){return [`MOKI 白板 ID：${boardId}`,selection?`选区：${selection.label}\n${selectionContent(selection)}`:'',prompt?`请求：${prompt}`:'请结合此选区和 whiteboard_get_selection 读取、分析或编辑白板。'].filter(Boolean).join('\n\n')}
    function draftIncludes(draft,text){return !!text&&String(draft??'').replace(/^> ?/gm,'').includes(text)}
    function selectionPreview(selection){
      try{const data=JSON.parse(selection.content),items=data.selectedShapes??data.annotations??[];return items.map(item=>item.text??item.annotation??item.name??item.title??item.type??'').filter(Boolean).join(' · ')||selection.label}catch{return selection?.label??''}
    }
    function composerSelection(fallback){return function SelectionHint({sessionId,useInput}){
      const t=useCanvasTranslation(fallback)
      const view=useSelectionView(sessionId),input=useInput(state=>state),[expanded,setExpanded]=React.useState(false)
      const key=selectionKey(view?.boardId,view?.selection)
      React.useEffect(()=>setExpanded(false),[sessionId,key])
      if(!view?.boardId)return null
      const selected=!!view.selection?.itemCount,quoted=selected&&draftIncludes(input?.draft,quoteText(view.boardId,view.selection))
      const locked=input?.phase!=='plain',status=view.pending?'pending':quoted?'added':view.error?'error':selected?'ready':'empty'
      const summary=view.pending?t('adding'):quoted?(view.textOnly?t('textOnly'):t('attached')):view.error|| (selected?selectionPreview(view.selection):t('choose'))
      const heading=selected?`${t('selectionHint')} · ${t('selected').replace('{count}',String(view.selection.itemCount))}`:t('selectionHint')
      return h(React.Fragment,null,h('style',null,STYLE),
        h('div',{className:'moki-composer-selection','data-state':status,'aria-label':t('selectionHint')},
          h('button',{type:'button',className:'moki-composer-selection-main',disabled:!selected||!!view.pending||quoted||locked,'aria-label':`${heading} · ${quoted?t('added'):t('add')}`,title:locked?t('plainOnly'):quoted?t('attached'):t('clickHint'),onMouseDown:event=>event.preventDefault(),onClick:()=>view.share()},
            h(Icon),h('span',{className:'moki-composer-selection-copy'},h('span',{className:'moki-composer-selection-heading'},heading),h('span',{className:'moki-composer-selection-summary',role:'status'},summary)),selected?h('span',{className:'moki-composer-selection-action'},view.pending?t('adding'):quoted?'✓ '+t('added'):t('add')):null),
          selected?h('button',{type:'button',className:'moki-composer-selection-preview','aria-label':t('preview'),'aria-expanded':expanded,onClick:()=>setExpanded(value=>!value)},expanded?'⌃':'⌄'):null),
        expanded&&selected?h('div',{className:'moki-composer-selection-details'},selectionPreview(view.selection).slice(0,2000)):null)
    }}

    function panel(fallback,conversation,locale){return function BoardPanel({sessionId,inputActions,useTabInfo,useSession,useInput}){
      const t=useCanvasTranslation(fallback)
      const {tab}=useTabInfo()
      const canUploadImages=useSession(snapshot=>snapshot.subagent===null)
      const input=useInput(state=>state)
      const [attempt,setAttempt]=React.useState(0),[url,setUrl]=React.useState(),[phase,setPhase]=React.useState('loading'),[notice,setNotice]=React.useState(''),[selection,setSelection]=React.useState(null),[boardId,setBoardId]=React.useState(null),[fullscreen,setFullscreen]=React.useState(false)
      const [pending,setPending]=React.useState(null),[shareError,setShareError]=React.useState(''),[textOnly,setTextOnly]=React.useState(false)
      const pendingRef=React.useRef(null)
      const transfers=React.useRef(new Map())
      const frame=React.useRef(null),bridge=React.useRef(crypto.randomUUID()),latest=React.useRef({tab,inputActions})
      latest.current={tab,inputActions,input,phase,boardId,selection}
      const send=React.useCallback((type,body={})=>{if(url)frame.current?.contentWindow?.postMessage({type,bridgeId:bridge.current,...body},new URL(url).origin)},[url])
      const finish=React.useCallback(error=>{const current=pendingRef.current;if(current)clearTimeout(current.timer);pendingRef.current=null;setPending(null);setShareError(error??'')},[])
      const share=React.useCallback(()=>{
        const current=latest.current
        if(pendingRef.current||!current.tab.visible||current.phase!=='ready'||!current.boardId||!current.selection?.itemCount)return
        if(current.input?.phase!=='plain'){setShareError(t('plainOnly'));return}
        if(draftIncludes(current.input.draft,quoteText(current.boardId,current.selection)))return
        const requestId=crypto.randomUUID(),key=selectionKey(current.boardId,current.selection)
        const timer=setTimeout(()=>{if(pendingRef.current?.requestId===requestId){finish(t('timedOut'));setNotice(t('timedOut'))}},15000)
        pendingRef.current={requestId,key,timer};setPending(requestId);setShareError('');setTextOnly(false)
        send('dsh:quote',{requestId,selectionKey:key})
      },[send,finish])
      React.useEffect(()=>{
        if(tab.visible&&phase==='ready'&&boardId)updateSelectionView(sessionId,bridge.current,{boardId,selection,pending,error:shareError,textOnly,share})
        else updateSelectionView(sessionId,bridge.current,null)
        return()=>updateSelectionView(sessionId,bridge.current,null)
      },[sessionId,tab.visible,phase,boardId,selection,pending,shareError,textOnly,share])
      React.useEffect(()=>{if(!tab.visible){finish();setSelection(null)}},[tab.visible,finish])
      React.useEffect(()=>()=>{if(pendingRef.current)clearTimeout(pendingRef.current.timer);pendingRef.current=null;updateSelectionView(sessionId,bridge.current,null)},[sessionId])
      React.useEffect(()=>{
        let disposed=false;const abort=new AbortController();setPhase('loading');setNotice('');setUrl(undefined);setFullscreen(false);setSelection(null);setBoardId(null);finish()
        void (async()=>{
          const r=await fetch('/moki-whiteboard/info',{signal:abort.signal,cache:'no-store'});if(!r.ok)throw new Error(`${t('failed')} (${r.status})`)
          const info=await r.json();if(!info.running||!info.appUrl)throw new Error(t('failed'))
          const target=new URL(info.appUrl);let board
          try{board=localStorage.getItem(`moki:dsh:board:${sessionId}`)}catch{}
          if(board)target.pathname='/board/'+encodeURIComponent(board)
          target.search=new URLSearchParams({dshEmbed:'1',dshSession:sessionId,dshBridge:bridge.current,dshParent:location.origin,theme:theme(),dshLanguage:locale.getSnapshot().active}).toString()
          if(!disposed)setUrl(target.toString())
        })().catch(error=>{if(!disposed){setNotice(error.message);setPhase('failed')}})
        return()=>{disposed=true;abort.abort()}
      },[attempt,sessionId])
      React.useEffect(()=>{
        if(!url)return
        const receive=(event)=>{
          if(event.source!==frame.current?.contentWindow||event.origin!==new URL(url).origin||event.data?.bridgeId!==bridge.current)return
          const data=event.data
          if(data.type==='moki:language')setCanvasLanguage(data.language)
          if(data.type==='moki:ready'){setPhase('ready');send('dsh:theme',{theme:theme()});send('dsh:language',{language:locale.getSnapshot().active});send('dsh:active',{active:latest.current.tab.visible})}
          if(data.type==='moki:state'){
            const nextKey=selectionKey(data.boardId,data.selection),oldKey=selectionKey(latest.current.boardId,latest.current.selection)
            if(nextKey!==oldKey){setShareError('');setTextOnly(false)}
            if(pendingRef.current&&pendingRef.current.key!==nextKey)finish(t('changed'))
            setSelection(data.selection)
            setBoardId(data.boardId)
            try{if(data.boardId)localStorage.setItem(`moki:dsh:board:${sessionId}`,data.boardId);else localStorage.removeItem(`moki:dsh:board:${sessionId}`)}catch{}
          }
          if(data.type==='moki:error'){
            if(!data.requestId||pendingRef.current?.requestId===data.requestId){setNotice(data.message);if(data.requestId)finish(data.message)}
          }
          if(data.type==='moki:layout')setFullscreen(data.fullscreen===true)
          if(data.type==='moki:quote'&&latest.current.tab.visible){
            if(data.requestId&&pendingRef.current?.requestId!==data.requestId)return
            if(data.requestId&&selectionKey(data.boardId,data.selection)!==pendingRef.current?.key){finish(t('changed'));return}
            if(data.boardId!==latest.current.boardId){finish(t('changed'));return}
            if(!data.selection&&!data.prompt){finish(t('noSelection'));setNotice(t('noSelection'));return}
            const text=quoteText(data.boardId,data.selection,data.prompt)
            if(draftIncludes(latest.current.input?.draft,text)){finish();return}
            const ok=latest.current.inputActions?.insertQuote(text)
            if(ok){
              try{
                const images=(data.images??[]).slice(0,3).filter(image=>image.bytes instanceof ArrayBuffer&&image.bytes.byteLength<=8*1024*1024&&/^image\/(png|jpeg|webp|gif)$/.test(image.mediaType))
                const key=selectionKey(data.boardId,data.selection),known=transfers.current.get(key)??new Map(),activeIds=new Set(latest.current.input?.attachmentIds??[])
                const imageKey=(image,index)=>image.source??`${index}:${image.name}:${image.mediaType}`
                const missing=images.map((image,index)=>({image,key:imageKey(image,index)})).filter(item=>!activeIds.has(known.get(item.key)))
                if(missing.length){
                  const drafts=conversation.createDrafts(sessionId,missing.map(({image})=>new File([image.bytes],image.name,{type:image.mediaType})),canUploadImages)
                  if(!latest.current.inputActions.addAttachments(drafts.map(d=>d.id))){conversation.releaseDraftAttachments(drafts);throw new Error(t('busy'))}
                  drafts.forEach((draft,index)=>{known.set(missing[index].key,draft.id);activeIds.add(draft.id)})
                }
                transfers.current.set(key,known);if(transfers.current.size>20)transfers.current.delete(transfers.current.keys().next().value)
                const hasImage=[...known.values()].some(id=>activeIds.has(id))
                latest.current.inputActions.persistDraft();setTextOnly(!!data.imageWarning||!hasImage&&!!data.selection);setNotice(data.imageWarning||!hasImage&&data.selection?t('textOnly'):t('sent'));finish()
              }catch(error){latest.current.inputActions.persistDraft();setTextOnly(true);finish();setNotice(t('textOnly')+'：'+error.message)}
            }else{finish(t('busy'));setNotice(t('busy'))}
          }
        }
        window.addEventListener('message',receive)
        const unsubscribeLocale=locale.subscribe(()=>send('dsh:language',{language:locale.getSnapshot().active}))
        const observer=new MutationObserver(()=>send('dsh:theme',{theme:theme()}))
        observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-color-scheme','data-ds-theme-source','class','style']})
        observer.observe(document.body,{attributes:true,attributeFilter:['data-ds-dark-theme']})
        const timeout=setTimeout(()=>setPhase(current=>current==='loading'?'failed':current),20000)
        return()=>{clearTimeout(timeout);observer.disconnect();unsubscribeLocale();window.removeEventListener('message',receive);send('dsh:active',{active:false})}
      },[url,send,sessionId,canUploadImages])
      React.useEffect(()=>{send('dsh:active',{active:tab.visible})},[tab.visible,send])
      React.useEffect(()=>{if(!notice.startsWith(t('sent')))return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer)},[notice])
      return h('div',{className:'moki-dsh-panel'},h('style',null,STYLE),
        !fullscreen?h('div',{className:'moki-dsh-bar'},
          boardId?h('button',{className:'moki-dsh-button',title:selection?.itemCount?`${t('share')} · ${selection.itemCount} 项`:t('empty'),'aria-label':t('share'),disabled:!selection?.itemCount||phase!=='ready'||!!pending||input?.phase!=='plain'||draftIncludes(input?.draft,quoteText(boardId,selection)),onMouseDown:e=>e.preventDefault(),onClick:share},pending?t('adding'):t('shareShort')):null,
          h('button',{className:'moki-dsh-button',title:t('reload'),'aria-label':t('reload'),onClick:()=>setAttempt(n=>n+1)},'↻'))
        :null,
        notice?h('div',{className:'moki-dsh-status',role:'status'},notice,h('button',{className:'moki-dsh-button','aria-label':'关闭提示',onClick:()=>setNotice('')},'×')):null,
        h('div',{className:'moki-dsh-body'},url?h('iframe',{key:attempt,ref:frame,src:url,title:'MOKI 白板画布',allow:'clipboard-read; clipboard-write; fullscreen; autoplay',referrerPolicy:'no-referrer'}):null,
          phase!=='ready'?h('div',{className:'moki-dsh-loading'},h('span',null,t(phase==='failed'?'failed':'loading')),phase==='failed'?h('button',{className:'moki-dsh-button',onClick:()=>setAttempt(n=>n+1)},t('retry')):null):null))
    }}
    // Native panel rows select the main column. Hand the selection back to the chat
    // synchronously so its mounted canvas and draft survive repeated sidebar clicks.
    function registerSidebarLauncher(ctx,t){
      const layout=ctx.layout, current=ctx.uiSession.adapter.current
      function SessionHint(){
        return h('div',{role:'status',style:{padding:24}},t('noSession'))
      }
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:KIND,locale:'mokiWhiteboard'},SessionHint))
      ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:KIND,order:20,locale:'mokiWhiteboard',label:()=>t('sidebarTitle')},Icon))
      ctx.effect(()=>{
        let previousPanel,timer,stopWaiting,showingHint=false
        function cancelPending(){
          clearTimeout(timer)
          stopWaiting?.()
          stopWaiting=undefined
        }
        function followSelection(){
          const panel=layout.panelInfo.getSnapshot().activePanelId
          if(panel===previousPanel)return
          previousPanel=panel
          cancelPending()
          if(panel!==KIND||showingHint)return

          layout.selectPanel(null)
          function openWhenReady(sessionId,attempt){
            if(current.getSnapshot().key!==sessionId)return
            if(ctx.sidebarRight.mounted.getSnapshot()===sessionId){
              try{ctx.sidebarRight.openTab(KIND);return}
              catch(error){
                // DSH can select a session one render before its dock store exists.
                if(error?.message!=='sidebarRight: no session surface is mounted')throw error
              }
            }
            if(attempt<30){timer=setTimeout(()=>openWhenReady(sessionId,attempt+1),100);return}
            showingHint=true
            try{layout.selectPanel(KIND)}finally{showingHint=false}
          }
          function openSelectedSession(){
            const sessionId=current.getSnapshot().key
            if(!sessionId)return
            cancelPending()
            openWhenReady(sessionId,1)
          }
          if(current.getSnapshot().key)openSelectedSession()
          else{
            stopWaiting=current.subscribe(openSelectedSession)
            ctx.uiWorkspace.startSession()
          }
        }
        const unsubscribe=layout.panelInfo.subscribe(followSelection)
        followSelection()
        return ()=>{unsubscribe();cancelPending()}
      },'moki: sidebar navigation')
    }
    return {
      inject:['slots','sidebarRight','sidebarRightTabs','locale','layout','uiSession','uiWorkspace','conversation'],
      apply(ctx){
        try {
        const NS='mokiWhiteboard';ctx.effect(()=>ctx.locale.register(NS,COPY),'moki: locale');const t=ctx.locale.bind(NS)
        ctx.effect(()=>ctx.sidebarRightTabs.register({id:TYPE,kind:KIND,title:()=>t('title'),keepMounted:true,guide:[{id:KIND,order:25,title:()=>t('title'),description:()=>t('guide'),icon:Icon}]}),'moki: tab')
        ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:TYPE,locale:NS},panel(t,ctx.conversation,ctx.locale)))
        ctx.slots.inject('sidebar.right.pane.tab.title',()=>ctx.slots.register({name:'sidebar.right.pane.tab.title',key:TYPE},BoardTitle))
        ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'moki-whiteboard-selection',order:10,locale:NS},composerSelection(t)))
        registerSidebarLauncher(ctx,t)
        } catch(error) { console.error('MOKI plugin activation failed',error); throw error }
      },
    }
  },
})
