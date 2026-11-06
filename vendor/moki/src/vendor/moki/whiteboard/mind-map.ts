import type { WhiteboardSnapshot } from "../domain/whiteboard.js";
import {mindMapConnectionPorts} from './mind-map-connection.js';
import {
  createNativeId,
  createNativeWhiteboardSnapshot,
  isNativeShape,
  nativeRichText,
  nativeRichTextValue,
  nativeShapeBounds,
  nextNativeIndex,
  type NativePoint,
  type NativeWhiteboardRecord,
  type NativeWhiteboardShape,
} from "./native-whiteboard-model.js";

export type MindMapTemplateId =
  | "mind-right"
  | "mind-left"
  | "mind-both"
  | "mind-down"
  | "tree-right"
  | "tree-left"
  | "tree-down"
  | "timeline-right"
  | "timeline-down";

export type MindMapShapeInput = Partial<NativeWhiteboardShape> & { type: string };

export type MindMapDirection = "right" | "left" | "down";

export type MindMapChildInput = {
  key?: string | undefined;
  parentId?: string | undefined;
  text: string;
  width?: number | undefined;
  color?: string | undefined;
  direction?: MindMapDirection | undefined;
};

export type MindMapChildOptions = Partial<Omit<MindMapChildInput, "key" | "parentId" | "text">> & {
  text?: string | undefined;
  center?: NativePoint;
  deferLayout?: boolean;
};

const NODE_WIDTH = 184;
const NODE_HEIGHT = 64;
const ROOT_WIDTH = 204;
const ROOT_HEIGHT = 72;
const HORIZONTAL_GAP = 116;
const VERTICAL_GAP = 46;

function mapId(): string {
  return `mindmap:${createNativeId("shape").slice(6)}`;
}

function shapeId(): string {
  return createNativeId("shape");
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function isMindMapNode(shape: NativeWhiteboardShape | undefined): shape is NativeWhiteboardShape {
  return Boolean(shape?.props.mokiMindMapNode === true);
}

export function isMindMapEdge(shape: NativeWhiteboardShape | undefined): shape is NativeWhiteboardShape {
  return Boolean(shape?.type === "arrow" && shape.props.mokiMindMapEdge === true);
}

export function isMindMapShapeHidden(shape: NativeWhiteboardShape): boolean {
  return shape.props.mokiMindMapHidden === true;
}

export function mindMapParentId(shape: NativeWhiteboardShape | undefined): string | undefined {
  const value = shape?.props.mokiMindMapParentId;
  return typeof value === "string" && value ? value : undefined;
}

export function mindMapMapId(shape: NativeWhiteboardShape | undefined): string | undefined {
  const value = shape?.props.mokiMindMapId;
  return typeof value === "string" && value ? value : undefined;
}

export function mindMapChildren(
  snapshot: WhiteboardSnapshot,
  parentId: string,
): NativeWhiteboardShape[] {
  return Object.values(snapshot.document.store)
    .filter((record): record is NativeWhiteboardShape => (
      isNativeShape(record)
      && isMindMapNode(record)
      && mindMapParentId(record) === parentId
    ))
    .sort((left, right) => (
      finite(left.props.mokiMindMapOrder) - finite(right.props.mokiMindMapOrder)
      || left.index.localeCompare(right.index)
    ));
}

export function mindMapDescendantIds(snapshot: WhiteboardSnapshot, nodeId: string): Set<string> {
  const descendants = new Set<string>();
  const pending = [nodeId];
  while (pending.length > 0) {
    const parentId = pending.shift()!;
    for (const child of mindMapChildren(snapshot, parentId)) {
      if (descendants.has(child.id)) continue;
      descendants.add(child.id);
      pending.push(child.id);
    }
  }
  return descendants;
}

function nodeInput(input: {
  id: string;
  mapId: string;
  parentId?: string | undefined;
  x: number;
  y: number;
  label: string;
  color: string;
  direction: MindMapDirection;
  order: number;
  root?: boolean;
  width?: number | undefined;
}): MindMapShapeInput {
  const root = input.root === true;
  return {
    id: input.id,
    type: "geo",
    x: input.x,
    y: input.y,
    props: {
      w: input.width ?? (root ? ROOT_WIDTH : NODE_WIDTH),
      h: root ? ROOT_HEIGHT : NODE_HEIGHT,
      geo: "round-rectangle",
      scale: 1,
      richText: nativeRichText(input.label),
      size: root ? "m" : "s",
      bold: root,
      textAlign: "middle",
      color: input.color,
      strokeEnabled: true,
      strokeColor: input.color,
      strokeOpacity: root ? 1 : 0.78,
      fillEnabled: true,
      fillColor: "light-violet",
      fillOpacity: root ? 0.42 : 0.18,
      mokiMindMapNode: true,
      mokiMindMapId: input.mapId,
      ...(input.parentId ? { mokiMindMapParentId: input.parentId } : {}),
      mokiMindMapDirection: input.direction,
      mokiMindMapOrder: input.order,
      mokiMindMapRoot: root,
      mokiMindMapAutoManaged: true,
      mokiMindMapCollapsed: false,
      mokiMindMapHidden: false,
    },
  };
}

function edgeInput(input: {
  id: string;
  mapId: string;
  fromId: string;
  toId: string;
  color: string;
}): MindMapShapeInput {
  return {
    id: input.id,
    type: "arrow",
    x: 0,
    y: 0,
    props: {
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      color: input.color,
      size: "m",
      arrowStyle: "line",
      mokiMindMapEdge: true,
      mokiMindMapId: input.mapId,
      mokiMindMapFromId: input.fromId,
      mokiMindMapToId: input.toId,
      mokiMindMapHidden: false,
    },
  };
}

type TemplateNode = {
  key: string;
  parent?: string;
  x: number;
  y: number;
  label: string;
  direction: MindMapDirection;
};

function templateNodes(template: MindMapTemplateId): TemplateNode[] {
  const basicRight: TemplateNode[] = [
    { key: "root", x: -310, y: -36, label: "中心主题", direction: "right" },
    ...[-165, -55, 55, 165].map((y, index) => ({
      key: `branch-${index}`,
      parent: "root",
      x: 110,
      y,
      label: `分支 ${index + 1}`,
      direction: "right" as const,
    })),
  ];
  if (template === "mind-right") return basicRight;
  if (template === "mind-left") {
    return basicRight.map((node) => ({
      ...node,
      x: node.key === "root" ? 106 : -310,
      direction: "left" as const,
    }));
  }
  if (template === "mind-both") {
    return [
      { key: "root", x: -102, y: -36, label: "中心主题", direction: "right" },
      { key: "left-1", parent: "root", x: -420, y: -120, label: "左侧分支 1", direction: "left" },
      { key: "left-2", parent: "root", x: -420, y: 55, label: "左侧分支 2", direction: "left" },
      { key: "right-1", parent: "root", x: 140, y: -120, label: "右侧分支 1", direction: "right" },
      { key: "right-2", parent: "root", x: 140, y: 55, label: "右侧分支 2", direction: "right" },
    ];
  }
  if (template === "mind-down") {
    return [
      { key: "root", x: -102, y: -245, label: "中心主题", direction: "down" },
      ...[-330, -110, 110, 330].map((x, index) => ({
        key: `branch-${index}`,
        parent: "root",
        x,
        y: 80,
        label: `分支 ${index + 1}`,
        direction: "down" as const,
      })),
    ];
  }
  if (template === "timeline-right" || template === "timeline-down") {
    const down = template === "timeline-down";
    return Array.from({ length: 5 }, (_, index) => ({
      key: index === 0 ? "root" : `stage-${index}`,
      ...(index > 0 ? { parent: index === 1 ? "root" : `stage-${index - 1}` } : {}),
      x: down ? -102 : -480 + index * 250,
      y: down ? -260 + index * 125 : -36,
      label: index === 0 ? "起点" : `阶段 ${index}`,
      direction: down ? "down" as const : "right" as const,
    }));
  }
  const direction: MindMapDirection = template === "tree-left"
    ? "left"
    : template === "tree-down"
      ? "down"
      : "right";
  const rootX = direction === "left" ? 120 : direction === "down" ? -102 : -360;
  const rootY = direction === "down" ? -260 : -36;
  const firstPositions = direction === "down"
    ? [{ x: -300, y: 20 }, { x: -92, y: 20 }, { x: 116, y: 20 }]
    : [{ x: direction === "left" ? -180 : -30, y: -150 }, { x: direction === "left" ? -180 : -30, y: -30 }, { x: direction === "left" ? -180 : -30, y: 90 }];
  const secondPositions = direction === "down"
    ? [{ x: -300, y: 170 }, { x: -92, y: 170 }, { x: 116, y: 170 }]
    : [{ x: direction === "left" ? -470 : 260, y: -150 }, { x: direction === "left" ? -470 : 260, y: -30 }, { x: direction === "left" ? -470 : 260, y: 90 }];
  return [
    { key: "root", x: rootX, y: rootY, label: "主题", direction },
    ...firstPositions.map((position, index) => ({ key: `level-1-${index}`, parent: "root", ...position, label: `一级 ${index + 1}`, direction })),
    ...secondPositions.map((position, index) => ({ key: `level-2-${index}`, parent: `level-1-${index}`, ...position, label: `二级 ${index + 1}`, direction })),
  ];
}

export function buildMindMapTemplate(input: {
  template: MindMapTemplateId;
  center: NativePoint;
  color: string;
}): { rootId: string; nodeIds: string[]; shapes: MindMapShapeInput[] } {
  const currentMapId = mapId();
  const specs = templateNodes(input.template);
  const ids = new Map(specs.map((node) => [node.key, shapeId()]));
  const nodes = specs.map((node, index) => nodeInput({
    id: ids.get(node.key)!,
    mapId: currentMapId,
    ...(node.parent ? { parentId: ids.get(node.parent)! } : {}),
    x: input.center.x + node.x,
    y: input.center.y + node.y,
    label: node.label,
    color: input.color,
    direction: node.direction,
    order: index,
    root: !node.parent,
  }));
  const edges = specs.flatMap((node) => node.parent ? [edgeInput({
    id: shapeId(),
    mapId: currentMapId,
    fromId: ids.get(node.parent)!,
    toId: ids.get(node.key)!,
    color: input.color,
  })] : []);
  const root = nodes.find((node) => node.id === ids.get("root"))!;
  root.props!.mokiMindMapLayout = input.template === "mind-both" ? "both"
    : input.template.endsWith("left") ? "left" : input.template.endsWith("down") ? "down" : "right";
  return {
    rootId: ids.get("root")!,
    nodeIds: [...ids.values()],
    shapes: [...edges, ...nodes],
  };
}

export type MindMapOutlineBranch = {
  title: string;
  children?: string[] | undefined;
  width?: number | undefined;
  color?: string | undefined;
};

/** The UI and agent use the same native tree, sizing and layout. */
export function buildMindMapOutline(input: {
  topic: string;
  branches: MindMapOutlineBranch[];
  layout: "right" | "left" | "both" | "down";
  center: NativePoint;
  color: string;
  width?: number | undefined;
}): { rootId: string; nodeIds: string[]; shapes: MindMapShapeInput[] } {
  const snapshot = createNativeWhiteboardSnapshot();
  const rootId = shapeId();
  const rootInput = nodeInput({
    id: rootId, mapId: mapId(), x: input.center.x, y: input.center.y,
    label: input.topic, color: input.color, width: input.width,
    direction: input.layout === "both" ? "right" : input.layout, order: 0, root: true,
  });
  const root: NativeWhiteboardShape = {
    ...rootInput, id: rootId, typeName: "shape", type: "geo", x: input.center.x, y: input.center.y,
    parentId: "page:moki", index: "a000001", rotation: 0, opacity: 1,
    props: { ...rootInput.props, mokiMindMapLayout: input.layout, mokiMindMapChildWidth: input.width ?? NODE_WIDTH }, meta: {},
  };
  fitMindMapNode(root);
  root.x -= finite(root.props.w) / 2;
  root.y -= finite(root.props.h) / 2;
  snapshot.document.store[rootId] = root;
  const items: MindMapChildInput[] = [];
  input.branches.forEach((branch, index) => {
    const key = `branch-${index}`;
    items.push({ key, text: branch.title, width: branch.width ?? input.width, color: branch.color });
    for (const text of branch.children ?? []) {
      items.push({ parentId: key, text, width: branch.width ?? input.width, color: branch.color });
    }
  });
  if (items.length) addMindMapChildren(snapshot, rootId, items);
  const shapes = Object.values(snapshot.document.store).filter(isNativeShape);
  return { rootId, nodeIds: shapes.filter(isMindMapNode).map(node => node.id), shapes };
}

/** Conservative server-side measurement also works without a DOM or installed fonts. */
export function fitMindMapNode(node: NativeWhiteboardShape): void {
  if (!isMindMapNode(node)) return;
  const width = Math.max(64, Math.min(4096, finite(node.props.w, NODE_WIDTH)));
  const scale = Math.max(0.01, Math.abs(finite(node.props.scale, 1)));
  const scaleX = Math.max(0.01, Math.abs(finite(node.props.scaleX, 1)));
  const scaleY = Math.max(0.01, Math.abs(finite(node.props.scaleY, 1)));
  const size = { s: 14, m: 18, l: 24, xl: 32 }[String(node.props.size)] ?? 14;
  const fontSize = Math.max(12, size * scale);
  const contentWidth = Math.max(20, width * scale * scaleX - 32);
  let lines = 0;
  for (const line of nativeRichTextValue(node.props.richText).split(/\r?\n/u)) {
    let used = 0;
    lines++;
    for (const character of line) {
      // CJK, emoji and wide punctuation occupy a full em; Latin uses a safe estimate.
      const advance = /[^\u0000-\u00ff]|[MW@%]/u.test(character) ? fontSize : fontSize * 0.65;
      if (used > 0 && used + advance > contentWidth) { lines++; used = 0; }
      used += advance;
    }
  }
  node.props = { ...node.props, w: width,
    h: Math.max(node.props.mokiMindMapRoot ? ROOT_HEIGHT : NODE_HEIGHT, Math.ceil((lines * fontSize * 1.35 + 24) / (scale * scaleY))) };
}

/** Reflow each side independently using complete subtree bounds, keeping the root anchored. */
export function layoutMindMap(snapshot: WhiteboardSnapshot, nodeId: string): void {
  const start = snapshot.document.store[nodeId];
  if (!isNativeShape(start) || !isMindMapNode(start)) return;
  let root = start;
  const ancestors = new Set([root.id]);
  while (mindMapParentId(root)) {
    const parent = snapshot.document.store[mindMapParentId(root)!];
    if (!isNativeShape(parent) || !isMindMapNode(parent) || ancestors.has(parent.id)) break;
    ancestors.add(parent.id); root = parent;
  }
  const visited = new Set<string>();
  const subtree = (node: NativeWhiteboardShape): NativeWhiteboardShape[] =>
    [node, ...[...mindMapDescendantIds(snapshot, node.id)].map(id => snapshot.document.store[id]).filter(isNativeShape)];
  const extent = (nodes: NativeWhiteboardShape[]) => {
    const bounds = nodes.map(nativeShapeBounds);
    const x = Math.min(...bounds.map(b => b.x)), y = Math.min(...bounds.map(b => b.y));
    return { x, y, w: Math.max(...bounds.map(b => b.x + b.w)) - x, h: Math.max(...bounds.map(b => b.y + b.h)) - y };
  };
  const arrange = (parent: NativeWhiteboardShape) => {
    if (visited.has(parent.id)) return;
    visited.add(parent.id);
    const children = mindMapChildren(snapshot, parent.id);
    children.forEach(arrange);
    const parentBounds = nativeShapeBounds(parent);
    for (const direction of ["left", "right", "down"] as const) {
      const group = children.filter(child => (child.props.mokiMindMapDirection ?? "right") === direction);
      // A manually placed sibling keeps the existing arrangement of its side.
      if (!group.length || group.some(child => child.props.mokiMindMapAutoManaged === false)) continue;
      const entries = group.map(child => { const nodes = subtree(child); return { child, nodes, box: extent(nodes) }; });
      const down = direction === "down";
      const total = entries.reduce((sum, e) => sum + (down ? e.box.w : e.box.h), 0) + (entries.length - 1) * 28;
      let cursor = (down ? parentBounds.center.x : parentBounds.center.y) - total / 2;
      for (const { child, nodes, box } of entries) {
        const bounds = nativeShapeBounds(child);
        const dx = down ? cursor - box.x : direction === "left"
          ? parentBounds.x - HORIZONTAL_GAP - bounds.w - bounds.x
          : parentBounds.x + parentBounds.w + HORIZONTAL_GAP - bounds.x;
        const dy = down ? parentBounds.y + parentBounds.h + HORIZONTAL_GAP - bounds.y : cursor - box.y;
        for (const node of nodes) { node.x += dx; node.y += dy; }
        cursor += (down ? box.w : box.h) + 28;
      }
    }
  };
  arrange(root);
  synchronizeMindMapSnapshot(snapshot);
}

/** Validate the complete dependency graph before inserting anything; supports forward references. */
export function addMindMapChildren(snapshot: WhiteboardSnapshot, defaultParentId: string, inputs: MindMapChildInput[]) {
  if (!inputs.length || inputs.length > 200) throw new Error("一次添加需要 1–200 个节点");
  const parent = snapshot.document.store[defaultParentId];
  if (!isNativeShape(parent) || !isMindMapNode(parent)) throw new Error("父节点不是思维导图节点");
  const keys = new Map<string, number>();
  inputs.forEach((input, index) => {
    if (!input.text.trim() || input.text.length > 20000) throw new Error("节点文字需要 1–20000 字符");
    if (input.width !== undefined && (!Number.isFinite(input.width) || input.width < 64 || input.width > 4096)) throw new Error("节点宽度需要 64–4096");
    if (input.key) {
      if (keys.has(input.key) || snapshot.document.store[input.key]) throw new Error("节点 key 重复或与已有 ID 冲突");
      keys.set(input.key, index);
    }
  });
  const ordered: number[] = [], visiting = new Set<number>(), done = new Set<number>();
  const visit = (index: number) => {
    if (done.has(index)) return;
    if (visiting.has(index)) throw new Error("节点父子引用不能成环");
    visiting.add(index);
    const parentId = inputs[index]!.parentId ?? defaultParentId;
    const dependency = keys.get(parentId);
    if (dependency !== undefined) visit(dependency);
    else {
      const target = snapshot.document.store[parentId];
      if (!isNativeShape(target) || !isMindMapNode(target) || target.parentId !== parent.parentId || mindMapMapId(target) !== mindMapMapId(parent)) {
        throw new Error("父节点不存在或不属于同一思维导图：" + parentId);
      }
    }
    visiting.delete(index); done.add(index); ordered.push(index);
  };
  inputs.forEach((_, index) => visit(index));
  const created: Array<{ key?: string | undefined; nodeId: string; edgeId: string; parentId: string }> = [];
  const ids = new Map<string, string>();
  for (const index of ordered) {
    const input = inputs[index]!;
    const parentId = ids.get(input.parentId ?? "") ?? input.parentId ?? defaultParentId;
    const result = addMindMapChild(snapshot, parentId, { ...input, deferLayout: true })!;
    if (input.key) ids.set(input.key, result.nodeId);
    created[index] = { ...result, ...(input.key ? { key: input.key } : {}), parentId };
  }
  layoutMindMap(snapshot, defaultParentId);
  return created;
}

function directionFor(parent: NativeWhiteboardShape, child: NativeWhiteboardShape): MindMapDirection {
  const parentBounds = nativeShapeBounds(parent);
  const childBounds = nativeShapeBounds(child);
  const dx = childBounds.center.x - parentBounds.center.x;
  const dy = childBounds.center.y - parentBounds.center.y;
  if (Math.abs(dy) > Math.abs(dx) * 1.1 && dy > 0) return "down";
  return dx < 0 ? "left" : "right";
}

function connectionPoints(parent: NativeWhiteboardShape, child: NativeWhiteboardShape): { start: NativePoint; end: NativePoint } {
  const ports=mindMapConnectionPorts(parent,child);
  return {start:ports.start.point,end:ports.end.point};
}

function hiddenForNode(nodes: Map<string, NativeWhiteboardShape>, node: NativeWhiteboardShape): boolean {
  const visited = new Set<string>([node.id]);
  let parentId = mindMapParentId(node);
  while (parentId) {
    if (visited.has(parentId)) return false;
    visited.add(parentId);
    const parent = nodes.get(parentId);
    if (!parent) return false;
    if (parent.props.mokiMindMapCollapsed === true) return true;
    parentId = mindMapParentId(parent);
  }
  return false;
}

/** Keeps relation edges and collapsed-branch visibility aligned with node state. */
export function synchronizeMindMapSnapshot(snapshot: WhiteboardSnapshot): boolean {
  const allShapes = Object.values(snapshot.document.store)
    .filter((record): record is NativeWhiteboardShape => isNativeShape(record));
  let changed = false;
  const rawNodes = new Map(allShapes.filter(isMindMapNode).map((shape) => [shape.id, shape]));
  const legacyMapIds = new Map<string, string>();
  for (const node of rawNodes.values()) {
    if (mindMapMapId(node)) continue;
    const visited = new Set<string>([node.id]);
    let root = node;
    let parentId = mindMapParentId(root);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = rawNodes.get(parentId);
      if (!parent) break;
      root = parent;
      parentId = mindMapParentId(root);
    }
    const legacyMapId = legacyMapIds.get(root.id) ?? `mindmap:legacy:${root.id}`;
    legacyMapIds.set(root.id, legacyMapId);
    node.props = {
      ...node.props,
      mokiMindMapId: legacyMapId,
      mokiMindMapRoot: !mindMapParentId(node),
      mokiMindMapCollapsed: node.props.mokiMindMapCollapsed === true,
      mokiMindMapHidden: false,
    };
    changed = true;
  }
  const nodes = new Map(allShapes.filter(isMindMapNode).map((shape) => [shape.id, shape]));
  for (const edge of allShapes) {
    const fromId = typeof edge.props.mokiMindMapFromId === "string" ? edge.props.mokiMindMapFromId : "";
    const toId = typeof edge.props.mokiMindMapToId === "string" ? edge.props.mokiMindMapToId : "";
    const child = nodes.get(toId);
    if (edge.type !== "arrow" || !nodes.has(fromId) || !child || edge.props.mokiMindMapEdge === true) continue;
    edge.props = {
      ...edge.props,
      mokiMindMapEdge: true,
      mokiMindMapId: mindMapMapId(child),
      arrowStyle: "line",
      mokiMindMapHidden: false,
    };
    changed = true;
  }
  for (const node of nodes.values()) {
    const hidden = hiddenForNode(nodes, node);
    if (node.props.mokiMindMapHidden !== hidden) {
      node.props = { ...node.props, mokiMindMapHidden: hidden };
      changed = true;
    }
  }
  for (const edge of allShapes.filter(isMindMapEdge)) {
    const fromId = typeof edge.props.mokiMindMapFromId === "string" ? edge.props.mokiMindMapFromId : "";
    const toId = typeof edge.props.mokiMindMapToId === "string" ? edge.props.mokiMindMapToId : "";
    const parent = nodes.get(fromId);
    const child = nodes.get(toId);
    if (!parent || !child || mindMapParentId(child) !== parent.id) {
      delete snapshot.document.store[edge.id];
      changed = true;
      continue;
    }
    const { start, end } = connectionPoints(parent, child);
    const hidden = child.props.mokiMindMapHidden === true;
    const nextEnd = { x: end.x - start.x, y: end.y - start.y };
    const currentStart = edge.props.start as Partial<NativePoint> | undefined;
    const currentEnd = edge.props.end as Partial<NativePoint> | undefined;
    if (
      Math.abs(edge.x - start.x) > 0.001
      || Math.abs(edge.y - start.y) > 0.001
      || Math.abs(finite(currentStart?.x) - 0) > 0.001
      || Math.abs(finite(currentStart?.y) - 0) > 0.001
      || Math.abs(finite(currentEnd?.x) - nextEnd.x) > 0.001
      || Math.abs(finite(currentEnd?.y) - nextEnd.y) > 0.001
      || edge.props.mokiMindMapHidden !== hidden
      || finite(edge.rotation) !== 0
      || finite(edge.props.scale,1) !== 1
      || finite(edge.props.scaleX,1) !== 1
      || finite(edge.props.scaleY,1) !== 1
    ) {
      edge.x = start.x;
      edge.y = start.y;
      edge.rotation = 0;
      edge.props = {
        ...edge.props,
        start: { x: 0, y: 0 },
        end: nextEnd,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        mokiMindMapHidden: hidden,
      };
      changed = true;
    }
  }
  return changed;
}

function currentRecords(snapshot: WhiteboardSnapshot): NativeWhiteboardRecord[] {
  return Object.values(snapshot.document.store).filter((record): record is NativeWhiteboardRecord => (
    Boolean(record && typeof record === "object" && typeof record.id === "string" && typeof record.typeName === "string")
  ));
}

export function addMindMapChild(
  snapshot: WhiteboardSnapshot,
  parentId: string,
  options: MindMapChildOptions = {},
): { nodeId: string; edgeId: string } | undefined {
  const parent = snapshot.document.store[parentId];
  if (!isNativeShape(parent) || !isMindMapNode(parent)) return undefined;
  const currentMapId = mindMapMapId(parent);
  if (!currentMapId) return undefined;
  const siblings = mindMapChildren(snapshot, parentId);
  const parentBounds = nativeShapeBounds(parent);
  const direction = String(parent.props.mokiMindMapDirection) as MindMapDirection;
  const dx = options.center ? options.center.x - parentBounds.center.x : 0;
  const dy = options.center ? options.center.y - parentBounds.center.y : 0;
  const resolvedDirection: MindMapDirection = options.center
    ? Math.abs(dy) > Math.abs(dx) * 1.1 && dy > 0
      ? "down"
      : dx < 0 ? "left" : "right"
    : options.direction ?? (parent.props.mokiMindMapLayout === "both"
      ? siblings.filter(s => s.props.mokiMindMapDirection === "right").length <= siblings.filter(s => s.props.mokiMindMapDirection === "left").length ? "right" : "left"
      : direction === "left" || direction === "down" ? direction : "right");
  const nodeId = shapeId();
  const edgeId = shapeId();
  const siblingBounds = siblings.flatMap(sibling => [sibling, ...[...mindMapDescendantIds(snapshot, sibling.id)]
    .map(id => snapshot.document.store[id]).filter(isNativeShape)]).map(nativeShapeBounds);
  const x = options.center
    ? options.center.x - NODE_WIDTH / 2
    : resolvedDirection === "left"
    ? parentBounds.x - HORIZONTAL_GAP - NODE_WIDTH
    : resolvedDirection === "down"
      ? siblingBounds.length > 0
        ? Math.max(...siblingBounds.map((bounds) => bounds.x + bounds.w)) + VERTICAL_GAP
        : parentBounds.center.x - NODE_WIDTH / 2
      : parentBounds.x + parentBounds.w + HORIZONTAL_GAP;
  const y = options.center
    ? options.center.y - NODE_HEIGHT / 2
    : resolvedDirection === "down"
    ? parentBounds.y + parentBounds.h + HORIZONTAL_GAP
    : siblingBounds.length > 0
      ? Math.max(...siblingBounds.map((bounds) => bounds.y + bounds.h)) + VERTICAL_GAP
      : parentBounds.center.y - NODE_HEIGHT / 2;
  const color = options.color ?? (typeof parent.props.strokeColor === "string" ? parent.props.strokeColor : "black");
  const node = nodeInput({
    id: nodeId,
    mapId: currentMapId,
    parentId,
    x,
    y,
    label: options.text ?? `新节点 ${siblings.length + 1}`,
    width: options.width ?? finite(parent.props.mokiMindMapRoot ? parent.props.mokiMindMapChildWidth : parent.props.w, NODE_WIDTH),
    color,
    direction: resolvedDirection,
    order: siblings.length,
  });
  if (options.center) {
    node.props = { ...node.props, mokiMindMapAutoManaged: false };
  }
  const edge = edgeInput({ id: edgeId, mapId: currentMapId, fromId: parentId, toId: nodeId, color });
  const pageId = parent.parentId;
  const records = currentRecords(snapshot);
  for (const input of [edge, node]) {
    const shape: NativeWhiteboardShape = {
      id: input.id!,
      typeName: "shape",
      type: input.type,
      x: input.x ?? 0,
      y: input.y ?? 0,
      parentId: pageId,
      index: nextNativeIndex(records, pageId),
      rotation: 0,
      opacity: 1,
      props: { ...(input.props ?? {}) },
      meta: {},
    };
    snapshot.document.store[shape.id] = shape;
    records.push(shape);
  }
  const createdNode = snapshot.document.store[nodeId] as NativeWhiteboardShape;
  fitMindMapNode(createdNode);
  if (options.center) {
    createdNode.x = options.center.x - finite(createdNode.props.w) / 2;
    createdNode.y = options.center.y - finite(createdNode.props.h) / 2;
  } else if (resolvedDirection === 'left') {
    createdNode.x = parentBounds.x - HORIZONTAL_GAP - finite(createdNode.props.w);
  }
  parent.props = { ...parent.props, mokiMindMapCollapsed: false };
  if (!options.deferLayout) {
    if (!options.center) layoutMindMap(snapshot, parentId);
    synchronizeMindMapSnapshot(snapshot);
  }
  return { nodeId, edgeId };
}

export function reparentMindMapNode(
  snapshot: WhiteboardSnapshot,
  nodeId: string,
  nextParentId: string,
): boolean {
  const node = snapshot.document.store[nodeId];
  const nextParent = snapshot.document.store[nextParentId];
  if (
    !isNativeShape(node)
    || !isNativeShape(nextParent)
    || !isMindMapNode(node)
    || !isMindMapNode(nextParent)
    || node.props.mokiMindMapRoot === true
    || mindMapMapId(node) !== mindMapMapId(nextParent)
    || node.id === nextParent.id
    || mindMapDescendantIds(snapshot, node.id).has(nextParent.id)
  ) return false;
  const siblings = mindMapChildren(snapshot, nextParentId).filter((shape) => shape.id !== nodeId);
  node.props = {
    ...node.props,
    mokiMindMapParentId: nextParentId,
    mokiMindMapDirection: directionFor(nextParent, node),
    mokiMindMapOrder: siblings.length,
    mokiMindMapAutoManaged: false,
    mokiMindMapHidden: false,
  };
  const edge = Object.values(snapshot.document.store).find((record) => (
    isNativeShape(record)
    && isMindMapEdge(record)
    && record.props.mokiMindMapToId === nodeId
  ));
  if (isNativeShape(edge)) {
    edge.props = { ...edge.props, mokiMindMapFromId: nextParentId };
  } else {
    const input = edgeInput({
      id: shapeId(),
      mapId: mindMapMapId(node)!,
      fromId: nextParentId,
      toId: nodeId,
      color: typeof nextParent.props.strokeColor === "string" ? nextParent.props.strokeColor : "black",
    });
    snapshot.document.store[input.id!] = {
      id: input.id!, typeName: "shape", type: "arrow", x: 0, y: 0,
      parentId: node.parentId,
      index: nextNativeIndex(currentRecords(snapshot), node.parentId),
      rotation: 0, opacity: 1, props: { ...input.props }, meta: {},
    };
  }
  synchronizeMindMapSnapshot(snapshot);
  return true;
}

export function promoteMindMapNode(snapshot: WhiteboardSnapshot, nodeId: string): boolean {
  const node = snapshot.document.store[nodeId];
  if (!isNativeShape(node) || !isMindMapNode(node)) return false;
  const parentId = mindMapParentId(node);
  const parent = parentId ? snapshot.document.store[parentId] : undefined;
  if (!isNativeShape(parent) || !isMindMapNode(parent)) return false;
  const grandParentId = mindMapParentId(parent);
  return grandParentId ? reparentMindMapNode(snapshot, nodeId, grandParentId) : false;
}

export function toggleMindMapBranch(snapshot: WhiteboardSnapshot, nodeId: string): boolean {
  const node = snapshot.document.store[nodeId];
  if (!isNativeShape(node) || !isMindMapNode(node) || mindMapChildren(snapshot, nodeId).length === 0) return false;
  node.props = {
    ...node.props,
    mokiMindMapCollapsed: node.props.mokiMindMapCollapsed !== true,
  };
  synchronizeMindMapSnapshot(snapshot);
  return true;
}
