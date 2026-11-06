import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../src/mcp/create-server.js';
import { WhiteboardStore } from '../src/server/store.js';
import { isNativeShape, nativeShapeBounds } from '../src/vendor/moki/whiteboard/native-whiteboard-model.js';
import { isMindMapNode, mindMapChildren } from '../src/vendor/moki/whiteboard/mind-map.js';

describe('native mind maps through MCP', () => {
  let store: WhiteboardStore, server: ReturnType<typeof createMcpServer>, client: Client, boardId: string;
  const pageId = 'page:moki';
  const node = (id: string) => {
    const record = store.get(boardId).snapshot.document.store[id];
    if (!isNativeShape(record)) throw new Error('Missing shape ' + id);
    return record;
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: { boardId, pageId, ...args } });
    return result.structuredContent as Record<string, any>;
  };
  beforeEach(async () => {
    store = new WhiteboardStore(':memory:');
    server = createMcpServer(store); client = new Client({ name: 'mind-map-regression', version: '1' });
    const [a,b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
    const created = await call('whiteboard_create', { title: 'Mind map regression' });
    boardId = created.board.id;
  });
  afterEach(async () => { await client.close(); await server.close(); store.close(); });

  it('creates a 46-node native tree in one call with two sides, complete long text and explicit widths', async () => {
    const branches = Array.from({ length: 8 }, (_, index) => ({ title: `主题 ${index + 1}`,
      children: Array.from({ length: index < 5 ? 5 : 4 }, (_, leaf) => `第 ${index + 1} 类第 ${leaf + 1} 项：香洲 2.57 万｜金湾 1.33 万｜斗门 0.96 万，保留完整信息`),
      width: index === 0 ? 380 : 320,
    }));
    const added = await call('whiteboard_add_elements', { elements: [{ kind: 'mindmap', text: '原生导图测试', width: 320, layout: 'both', branches }] });
    expect(added.nodes).toHaveLength(46);
    expect(added.elementIds).toHaveLength(91);
    const snapshot = store.get(boardId).snapshot;
    const root = node(added.elementIds[0]);
    expect(root.props).toMatchObject({ mokiMindMapRoot: true, mokiMindMapLayout: 'both', w: 320 });
    const children = mindMapChildren(snapshot, root.id);
    expect(children.filter(child => child.x < Number(root.x))).toHaveLength(4);
    expect(children.filter(child => child.x > Number(root.x))).toHaveLength(4);
    expect(mindMapChildren(snapshot, children[0]!.id)[0]!.props.w).toBe(380);
    expect(added.nodes.map((node: any) => node.text)).toEqual(expect.arrayContaining(branches.flatMap(branch => branch.children)));
    const nodes = Object.values(snapshot.document.store).filter(isNativeShape).filter(isMindMapNode);
    for (let i=0; i<nodes.length; i++) for (const other of nodes.slice(i+1)) {
      const a = nativeShapeBounds(nodes[i]!), b = nativeShapeBounds(other);
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${nodes[i]!.id} overlaps ${other.id}`).toBe(true);
    }
  });

  it('batches multiple parents and forward references, passes text for single operations and returns compact results', async () => {
    const added = await call('whiteboard_add_elements', { elements: [{kind:'mindmap', text:'计划', layout:'both', branches:[]}] });
    const root = added.elementIds[0];
    const batch = await call('whiteboard_native_edit', { action:'mindmap_children', ids:[root], expectedVersion:added.version, nodes:[
      {key:'leaf',parentId:'branch',text:'先定义的子节点',width:360},
      {key:'branch',text:'研究方向',width:320},
      {key:'other',text:'实施计划',width:280},
      {parentId:'other',text:'另一个父节点下的工作'},
    ] });
    expect(batch.version).toBe(added.version + 1);
    expect(batch.nodes).toHaveLength(4);
    expect(batch.nodes[0]).toMatchObject({id:batch.keys.leaf,parentId:batch.keys.branch,text:'先定义的子节点',width:360});
    expect(batch).not.toHaveProperty('shapes');
    const child = await call('whiteboard_native_edit', {action:'mindmap_child',ids:[batch.keys.branch],text:'传入文字应保留',width:350,expectedVersion:batch.version});
    expect(child.nodes[0]).toMatchObject({text:'传入文字应保留',width:350,parentId:batch.keys.branch});
    const sibling = await call('whiteboard_native_edit', {action:'mindmap_sibling',ids:[child.result],text:'同级文字',width:300,includeSnapshot:true});
    expect(sibling.nodes[0]).toMatchObject({text:'同级文字',width:300,parentId:batch.keys.branch});
    expect(sibling.shapes).toBeDefined();
    const resized = await call('whiteboard_update_elements', {expectedVersion:sibling.version,updates:[{id:child.result,width:80,text:'长文本自动换行并增加高度，节点之间仍保持足够空间。'},{id:batch.keys.other,width:420}]});
    expect(node(child.result).props).toMatchObject({w:80});
    expect(Number(node(child.result).props.h)).toBeGreaterThan(64);
    expect(node(batch.keys.other).props).toMatchObject({w:420});
    expect(resized.version).toBe(sibling.version + 1);
    const folded = await call('whiteboard_native_edit', {action:'mindmap_toggle',ids:[batch.keys.branch]});
    expect(folded.result).toBe(true);
    expect(node(child.result).props).toMatchObject({mokiMindMapHidden:true});
  });

  it('rejects invalid, cyclic, cross-map and stale batches without partial writes or version changes', async () => {
    const added = await call('whiteboard_add_elements', {elements:[{kind:'mindmap',branches:[]},{kind:'mindmap',branches:[]}]});
    const [root,other] = added.elementIds;
    const before = store.get(boardId);
    for (const nodes of [
      [{text:'Valid first'}, {text:'Missing parent',parentId:'missing'}],
      [{key:'a',parentId:'b',text:'A'}, {key:'b',parentId:'a',text:'B'}],
      [{text:'Different tree',parentId:other}],
      [{key:'dup',text:'A'}, {key:'dup',text:'B'}],
      [{text:'   '}],
    ]) {
      const result = await call('whiteboard_native_edit', {action:'mindmap_children',ids:[root],nodes});
      expect(result.error?.code).toBe('OPERATION_FAILED');
      expect(store.get(boardId)).toEqual(before);
    }
    const stale = await call('whiteboard_native_edit', {action:'mindmap_children',ids:[root],expectedVersion:added.version-1,nodes:[{text:'Stale'}]});
    expect(stale.error?.code).toBe('VERSION_CONFLICT');
    expect(store.get(boardId)).toEqual(before);
  });
});
