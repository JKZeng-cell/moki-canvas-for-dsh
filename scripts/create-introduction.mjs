import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(process.env.MOKI_REPO || join(root,'vendor/moki'))
const { addElements, createSnapshot, richText } = await import(pathToFileURL(join(repo, 'dist/core/board.js')))
const { layoutMindMap } = await import(pathToFileURL(join(repo, 'dist/vendor/moki/whiteboard/mind-map.js')))
const out = join(root, 'builtin')
mkdirSync(out, { recursive: true })
const snapshot = createSnapshot()
snapshot.document.store = {}
const records = snapshot.document.store
let page, order = 0
const add = (type, x, y, props, role, extra = {}) => {
  const id = 'shape:intro-' + String(++order).padStart(4, '0')
  records[id] = { id, typeName: 'shape', type, x, y, parentId: page, index: 'a' + String(order).padStart(8, '0'), rotation: 0, opacity: 1, isLocked: false, props, meta: { introRole: role || type }, ...extra }
  return records[id]
}
const text = (x, y, w, h, content, font = 26, color = 'black', bold = false, role) => {
  const scale = font / 18
  return add('text', x, y, { w: w / scale, h: h / scale, size: 'm', scale, color, bold, richText: richText(content), textAlign: 'start' }, role)
}
const geo = (x, y, w, h, color = 'blue', opacity = .08, type = 'round-rectangle', role) => add('geo', x, y, {
  w, h, geo: type, color, strokeEnabled: false, strokeColor: color, fillEnabled: true, fillColor: color, fillOpacity: opacity,
}, role)
const line = (x, y, dx, dy, color = 'blue', style = 'single') => add('arrow', x, y, { w: Math.abs(dx), h: Math.abs(dy), start: { x: 0, y: 0 }, end: { x: dx, y: dy }, color, arrowStyle: style, size: 'm' })
const note = (x, y, w, h, content, color = 'yellow', role) => add('note', x, y, {
  w, h, scale: 1.5, scaleX: w / 300, scaleY: h / 300, size: 'm', color, labelColor: 'black', richText: richText(content),
}, role)
const panel = (x, y, w, h, title, content, color = 'blue') => {
  geo(x, y, w, h, color)
  text(x + 10, y + 12, w - 20, 52, title, 28, color, true)
  text(x + 10, y + 70, w - 20, h - 76, content, 24)
}
const newPage = (slug, name, number, title, subtitle, color = 'blue') => {
  page = 'page:intro-' + slug
  records[page] = { id: page, typeName: 'page', name, index: 'a00000' + number, meta: { groupId: number <= 3 ? 'page-group:intro-explore' : 'page-group:intro-work', mokiPageGroupId: number <= 3 ? 'page-group:intro-explore' : 'page-group:intro-work', mokiPageGroupName: number <= 3 ? '先玩起来' : '一起做事' } }
  geo(40, 40, 8, 94, color, 1, 'rectangle', 'chapter-marker')
  text(62, 32, 1370, 32, `MOKI FOR DSH   /   FIELD GUIDE                                      ${String(number).padStart(2, '0')} — 06`, 18, color, true)
  text(62, 71, 1380, 72, title, 44, 'black', true)
  text(62, 151, 1370, 60, subtitle, 24, 'grey')
  line(54, 950, 1380, 0, 'grey', 'line')
  text(45, 965, 1385, 40, `${String(number).padStart(2, '0')} / 06    ${name}                         左上角页面菜单换站 · Ctrl+0 适应画布 · 右上角缩放探索`, 18, 'grey')
  return page
}
const data = (name, mime) => `data:${mime};base64,${readFileSync(join(out, name)).toString('base64')}`
const asset = (id, type, props) => { records[id] = { id, typeName: 'asset', type, props, meta: {} }; return id }
const tent = (x, y, scale = 1) => {
  geo(x, y, 250 * scale, 175 * scale, 'orange', .85, 'triangle', 'tent')
  geo(x + 83 * scale, y + 72 * scale, 84 * scale, 104 * scale, 'violet', .8, 'triangle')
  line(x - 22 * scale, y + 180 * scale, 298 * scale, 0, 'green', 'line')
  geo(x + 224 * scale, y - 80 * scale, 48 * scale, 48 * scale, 'yellow', .8, 'ellipse')
  for (const [dx, dy, size] of [[8,-60,18],[98,-112,28],[180,-40,16],[305,20,22]]) geo(x + dx * scale, y + dy * scale, size * scale, size * scale, 'violet', .8, 'star')
}

records['page-group:intro-explore'] = { id: 'page-group:intro-explore', typeName: 'page_group', name: '先玩起来', index: 'g000001', meta: {} }
records['page-group:intro-work'] = { id: 'page-group:intro-work', typeName: 'page_group', name: '一起做事', index: 'g000002', meta: {} }

// 01 — Cover: an editable illustrated invitation, followed by a six-stop itinerary.
const firstPage = newPage('welcome', '01 · 欢迎来到灵感营地', 1, 'MOKI 白板简介', '一块画布，把你的想法、资料和 DSH 放在一起。')
text(48, 230, 880, 190, '从「有个想法」\n到「一起做出来」', 66, 'blue', true, 'cover-headline')
text(53, 444, 790, 105, '拖一张便签，长出一棵导图。\n圈一段内容，让 DSH 接着帮你完成。', 30)
text(53, 569, 880, 52, '入口：左侧栏「MOKI 白板」或右侧工作区「新标签页」。', 22, 'grey')
tent(1080, 357, 1.04)
const hello = note(1020, 230, 230, 94, '嗨，一起开工！', 'yellow', 'welcome-note')
hello.rotation = -5
const logoSrc = 'data:image/png;base64,' + readFileSync(join(repo, 'public/moki-whiteboard-icon.png')).toString('base64')
add('image', 1330, 230, { w: 86, h: 86, assetId: asset('asset:intro-moki', 'image', { src: logoSrc, name: 'MOKI 白板图标.png', mimeType: 'image/png', width: 512, height: 512 }), altText: 'MOKI 白板图标' })
text(1035, 565, 430, 45, '这顶帐篷也是原生图形，可以拆开！', 20, 'grey')
const routes = [
  ['01  欢迎来到灵感营地', '一张画布，两位搭档。', 'blue'],
  ['02  画出来，想清楚', '便签、文字、图形与自由绘制。', 'orange'],
  ['03  让想法长成树', '折叠、调宽、批量扩展分支。', 'violet'],
  ['04  装满你的素材包', '图片、附件、链接、音频和视频。', 'green'],
  ['05  邀请 DSH 一起做', '选区加入草稿，语言变成画布操作。', 'blue'],
  ['06  整理、保存、带走', '页面、分组、版本和文件导出。', 'orange'],
]
routes.forEach(([title, content, color], i) => panel(48 + i % 3 * 483, 650 + Math.floor(i / 3) * 136, 450, 116, title, content, color))

// 02 — Native drawing tools in one small, playful project.
newPage('draw', '02 · 画出来，想清楚', 2, '周末星空露营，先把想法摊开', '便签负责发散，图形负责结构，自由绘制负责让灵感保留原来的样子。', 'orange')
text(48, 220, 430, 50, 'A. 把想法贴出来', 30, 'orange', true)
note(64, 292, 372, 175, '想拍一支 30 秒短片\n帐篷 + 日落 + 星星\n预算：每人 200 元', 'yellow', 'editable-idea')
const rotated = note(108, 500, 310, 150, '小惊喜：\n给未来的自己\n录一句话', 'green')
rotated.rotation = 5
text(52, 669, 420, 76, '双击文字编辑；拖动、缩放、旋转。\n这张便签可以直接改成你的计划。', 22)
text(524, 220, 435, 50, 'B. 把流程连起来', 30, 'blue', true)
geo(590, 296, 300, 80, 'blue', .13)
text(608, 307, 266, 58, '出发 → 找到营地', 25, 'blue', true)
line(740, 382, 0, 45)
geo(642, 436, 196, 130, 'violet', .16, 'diamond')
text(663, 472, 155, 56, '天气好吗？', 24, 'violet', true)
line(840, 503, 92, 0, 'violet', 'dashed')
text(854, 545, 160, 72, '雨天预案\n室内放映', 20, 'grey')
line(740, 574, 0, 54)
geo(590, 639, 300, 76, 'green', .14)
text(608, 648, 270, 57, '搭帐篷 · 开拍！', 25, 'green', true)
text(1010, 220, 455, 50, 'C. 随手画一个现场', 30, 'violet', true)
tent(1090, 398, .95)
add('draw', 1040, 625, { points: [{x:0,y:30},{x:45,y:4},{x:90,y:31},{x:135,y:7},{x:180,y:27},{x:225,y:2},{x:270,y:28},{x:335,y:10}], color: 'green', size: 'l' }, 'freehand-demo')
add('bezier', 1060, 695, { anchors: [
  {x:0,y:20,in:{x:0,y:20},out:{x:80,y:-25}},
  {x:175,y:20,in:{x:95,y:65},out:{x:255,y:-25}},
  {x:350,y:20,in:{x:270,y:65},out:{x:350,y:20}},
], color:'violet', size:'m', isClosed:false }, 'pen-demo')
panel(52, 795, 1382, 124, '动手试一试 · 30 秒', '改写黄色便签 → 框选几颗星星并对齐 → 用画笔添一条路。底部“…”里还有钢笔、橡皮、图形和更多工具。', 'orange')

// 03 — Real managed mind map: retain native hierarchy, automatic layout and curved edges.
newPage('mindmap', '03 · 让想法长成树', 3, '这是一棵真的会长大的思维导图', '拖动分支会带着子节点走；折叠、展开、改宽度，都可以继续编辑。', 'violet')
const map = addElements(snapshot, page, [{ kind: 'mindmap', text: '星空露营\n30 秒短片', x: 750, y: 502, width: 196, layout: 'both', color: 'violet', branches: [
  {title:'拍什么', width:172, color:'blue', children:['日落时搭帐篷','夜色里的小灯']},
  {title:'带什么', width:172, color:'green', children:['帐篷与暖光灯','相机与备用电池']},
  {title:'怎么分工', width:172, color:'orange', children:['你负责拍摄','DSH 整理脚本']},
  {title:'如何交付', width:172, color:'violet', children:['剪成 30 秒短片','封面与发布文案']},
]}])
const mapRoot = map.find(s => s.props.mokiMindMapRoot)
for (const node of map.filter(s => s.props.mokiMindMapNode)) {
  node.props.size = node.props.mokiMindMapRoot ? 'l' : 'm'
  node.meta.introRole = node.props.mokiMindMapRoot ? 'mindmap-root' : 'mindmap-node'
}
layoutMindMap(snapshot, mapRoot.id)
panel(52, 760, 438, 160, '① 调整宽度', '选节点 → 浮动栏“宽”。\n长句自动换行，不必删字。', 'violet')
panel(510, 760, 438, 160, '② 长出新分支', 'Tab 加子节点，Enter 加同级。\n分支可折叠，连线随节点走。', 'blue')
panel(968, 760, 466, 160, '③ 让 DSH 批量扩展', '“给拍什么加 3 个镜头，\n每个镜头再加时长和备注。”', 'green')

// 04 — Self-contained materials; playable media and a real local text attachment.
newPage('materials', '04 · 装满你的素材包', 4, '图片、文件、链接，都有自己的位置', '右上角“素材”在缩略导航右侧：搜索、定位、改名和预览，找回散落在画布里的资料。', 'green')
geo(53, 242, 420, 382, 'green', .06)
add('image', 156, 275, {w:216,h:216,assetId:'asset:intro-moki',altText:'MOKI 白板原始图标'}, 'image-demo')
text(65, 520, 398, 82, '原图也在白板里\n图片支持拖入、缩放和选区分享。', 24, 'black', true)
add('resource', 520, 257, { w:434,h:112,scale:1,source:'builtin://camp-checklist.md',localPath:'builtin://camp-checklist.md',name:'星空露营 · 行前清单.md',kind:'local_file',mimeType:'text/markdown' }, 'file-demo')
text(520, 390, 434, 85, '打开素材列表，预览这份清单。\n它是一份随插件带来的真实附件。', 24)
add('link', 520, 504, {w:434,h:102,scale:1,url:'https://deepseek-harness.github.io/deepseek-harness/develop/basic/',title:'DeepSeek Harness · 插件文档',titleAuto:false,mode:'link',richText:richText('DeepSeek Harness · 插件文档')}, 'link-demo')
text(523, 624, 432, 60, '链接卡片可保留参考网址。\n访问外部网页需要网络。', 21, 'grey')
const videoId = asset('asset:intro-video','media',{src:data('star-signal.mp4','video/mp4'),name:'星光信号 · 4 秒.mp4',mediaKind:'video',mimeType:'video/mp4'})
text(1007,212,430,45,'视频 · 星空营地 4 秒',22,'green',true)
add('media',1006,257,{w:428,h:245,assetId:videoId,mediaKind:'video',name:'星光信号 · 4 秒.mp4'},'video-demo')
const audioId = asset('asset:intro-audio','media',{src:data('camp-chime.wav','audio/wav'),name:'出发提示音 · 2 秒.wav',mediaKind:'audio',mimeType:'audio/wav'})
add('media',1006,545,{w:428,h:112,assetId:audioId,mediaKind:'audio',name:'出发提示音 · 2 秒.wav'},'audio-demo')
text(1007,678,430,60,'从素材列表点“预览”即可播放。\n这两个示例离线也可使用。',21,'grey')
panel(53,789,1380,132,'一个素材入口，几种工作方式','把参考图摆在任务旁，把清单与方案放在一起。支持图片、文件、网址和音视频；PDF 可预览，其他格式按支持情况打开。','green')

// 05 — The actual selection-to-composer workflow and natural-language tasks.
newPage('collaborate','05 · 邀请 DSH 一起做',5,'你指哪一块，DSH 就从那里开始','插件自动连接当前 DSH 对话，无需另配 MCP。选区提示只加入草稿，由你决定何时发送。','blue')
const steps = [ ['01  选中内容','点击一张便签，或框选多个对象。'], ['02  点击选区提示','输入框旁点“加入对话”。'], ['03  写下你的要求','文字引用与选区图片一起进入草稿。'], ['04  查看画布变化','发送后，让 DSH 读取、整理或编辑。'] ]
steps.forEach(([title,body],i)=>{panel(52+i*352,245,327,170,title,body,'blue'); if(i<3)line(383+i*352,326,19,0,'blue')})
text(52,454,1380,58,'选一张任务卡，亲自试一次',34,'blue',true)
note(64,538,418,270,'任务 A · 把想法说清楚\n\n请读取这张便签，\n写 3 个星空短片标题。\n保留“周末”与“微光”的感觉。','yellow','collaboration-mission')
note(539,538,418,270,'任务 B · 让画布有结构\n\n请在新页面建一棵原生导图：\n主题“周末露营”，分成\n行程、装备、拍摄，各加 2 项。','light-blue','collaboration-map-mission')
note(1014,538,418,270,'任务 C · 帮我整理素材\n\n请读取当前白板的素材与文字，\n整理成一页拍摄准备清单。\n先说明计划，再按我的要求改。','violet','collaboration-organize-mission')
text(52,844,1380,74,'也能直接对 DSH 说：添加便签、修改文案、调整宽度、对齐排版、批量加脑图节点、管理页面或导出。\n换一个对话时，活动白板与选区会分别记录；更改前让 DSH 先读取最新内容。',23,'grey')

// 06 — Grouping, multi-page organization, save/restore and output.
newPage('takeaway','06 · 整理、保存、带走',6,'灵感不散场，下一次接着做','把探索变成工作方式：分页面，收成组，保存过程，再把结果带走。','orange')
panel(52,246,438,249,'页面是你的章节','左上角页面菜单：\n新建、重命名、排序与分组。\n\n这份导览已经分成 2 组、6 页。\n缩略导航帮你在大画布中定位。','blue')
panel(510,246,438,249,'画布也可以收纳','框选相关对象 → 组合。\n还能折叠为一个小空间。\n\n右侧是已收好的“装备包”。\n双击即可展开成两张清单。','violet')
const group = 'group:intro-kit'
const memberA = note(1045,307,165,145,'装备\n暖光灯\n相机','yellow','folder-member')
const memberB = note(1250,307,165,145,'备用\n电池\n存储卡','green','folder-member')
for(const member of [memberA,memberB])Object.assign(member.props,{mokiGroupId:group,mokiGroupCollapsed:true,mokiGroupLabel:'星空装备包',mokiGroupDescription:'两张清单，一起收好',mokiGroupColor:'#7c63d9'})
add('group-folder',1087,290,{w:280,h:185,mokiGroupId:group,groupLabel:'星空装备包',groupDescription:'双击查看里面的两张清单',groupColor:'#7c63d9',groupOriginX:1087,groupOriginY:290},'group-folder-demo')
panel(52,542,438,244,'保存与回看','本地自动保存，重开继续。\n顶栏可手动保存；“…”查看版本。\n\nCtrl+Z 撤销当前编辑。\n重要修改前，先复制一份。','green')
panel(510,542,438,244,'导出与继续编辑','“…”导出图片，用于分享展示。\n导出 .moki，保留可编辑结构。\n\n导入已有白板，把文件与素材\n一起组织，方便继续工作。','orange')
panel(968,542,466,244,'给画布多一点空间','侧边工作区：一边对话，一边画。\n全屏：专心整理更大的画布。\n\n底部手形 / 空格拖动画布。\nCtrl+0 回到整页全貌。','violet')
geo(52,807,1382,112,'orange',.12)
text(66,822,1340,84,'你的下一步：复制这份白板，把露营计划换成自己的项目。\n这一整份简介都可以编辑。大胆试试，MOKI 和 DSH 会陪你接着做。',28,'black',true,'closing-invitation')

// Stable IDs make the packaged tutorial reviewable and help tests locate real content.
const replacements = new Map()
let mapIndex = 0
for(const [id,record] of Object.entries(records))if(record.typeName==='shape'&&!id.startsWith('shape:intro-'))replacements.set(id,'shape:intro-map-'+String(++mapIndex).padStart(3,'0'))
for(const record of Object.values(records))if(record.props?.mokiMindMapId)replacements.set(record.props.mokiMindMapId,'mindmap:intro-camping')
const normalize = value => typeof value==='string' ? replacements.get(value)??value : Array.isArray(value) ? value.map(normalize) : value&&typeof value==='object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[replacements.get(k)??k,normalize(v)])) : value
snapshot.document.store = normalize(records)
snapshot.session = {currentPageId:firstPage,camera:{x:0,y:0,zoom:1}}
const markdown = `# 星空露营 · 行前清单\n\n这是一份随 MOKI 白板 for DSH 内置的示例附件。\n可从画布右上角“素材”入口搜索、定位和预览。\n\n## 装备\n- 帐篷、地垫、暖光灯\n- 相机、备用电池、存储卡\n- 保暖衣物、水和简单食物\n\n## 30 秒短片镜头\n1. 0–6 秒：日落时搭起帐篷。\n2. 6–14 秒：点亮小灯，拍手部细节。\n3. 14–24 秒：两个人看向夜空。\n4. 24–30 秒：说一句留给未来的话。\n\n## 交给 DSH 的一句话\n请结合白板里的露营导图和这份清单，把拍摄任务整理成一页分工表。\n\n## 白板玩法\n双击编辑文字；Tab 添加导图子节点；框选后对齐与组合。\n选中内容后，点击 DSH 输入框旁“白板选区”的“加入对话”。\n引用和截图会进入草稿，准备好后再发送。\n\n这份文件保存在本机，插件重启不会覆盖你的修改。\n`
writeFileSync(join(out,'星空露营 · 行前清单.md'),markdown)
writeFileSync(join(out,'introduction.json'),JSON.stringify({revision:1,title:'MOKI 白板简介 · for DSH',files:[{name:'星空露营 · 行前清单.md',reference:'builtin://camp-checklist.md'}],snapshot},null,2)+'\n')
console.log(JSON.stringify({pages:Object.values(records).filter(r=>r.typeName==='page').length,shapes:Object.values(records).filter(r=>r.typeName==='shape').length,output:join(out,'introduction.json')}))
