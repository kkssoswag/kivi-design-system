import { toast } from '@kivi';
import { ARRANGE_GAP, GRID_GAP, GROUP_PAD } from '../rules/canvas';
import { GROUP_TEXT, TIDY, type ArrangeMode } from '../rules/canvas-group';
import { commit, fitGroups, getDoc, patch } from './canvas-doc';
import type { CanvasDoc, CanvasNode } from './types';

/*
  画布的排列和整理（照线上 utils/selected-node-layout.ts、utils/arrange-canvas*.ts）：
  - 排列（多选浮条、组工具栏的「布局」）：垂直 / 水平一条排开，间距 150，交叉方向居中；宫格列数 ceil(√n)、间距 80，
    格子按最大的节点算、节点在格子里居中。按原来的阅读顺序排，整体锚定在原来外框的左上角。
    单选一个组排的是组里的节点；多选里有组，组当一整块挪（组里的节点跟着），组里被一起选中的节点不单独排。
  - 整理画布（左下角）：按连线拆成连通分量，每个分量从左到右分层（层间 200、同层 100、同层左对齐），
    分量按阅读顺序打包成行（间距 150、行宽按宽高比 1.6），组先整理里面的节点、再整体参与外层排列。
    线上分层用 Dagre（network-simplex），演示站不引布局库，这里写了一个简化版：层 = 最长路径，层内按上一层的连线位置排。
    先预览，左下角问「是否保留此次整理结果？」，取消回到原位，确定才进撤销栈。
*/

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Pos = Map<string, { x: number; y: number }>;

const boundsOf = (rects: Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
};

/** 阅读顺序：竖向有重叠的算一行，行从上到下，行内从左到右（线上 sortRectsInReadingOrder） */
function readingOrder<T>(list: T[], rectOf: (t: T) => Rect): T[] {
  const sorted = [...list].sort((a, b) => rectOf(a).y - rectOf(b).y || rectOf(a).x - rectOf(b).x);
  const bands: { bottom: number; items: T[] }[] = [];
  for (const it of sorted) {
    const r = rectOf(it);
    const band = bands[bands.length - 1];
    if (!band || r.y >= band.bottom) bands.push({ bottom: r.y + r.h, items: [it] });
    else {
      band.items.push(it);
      band.bottom = Math.max(band.bottom, r.y + r.h);
    }
  }
  return bands.flatMap((b) => b.items.sort((a, c) => rectOf(a).x - rectOf(c).x || rectOf(a).y - rectOf(c).y));
}

/** 宫格的阅读顺序：中心接近或有重叠的归进同一行（线上 sortGridItemsInReadingOrder） */
function gridOrder<T>(list: T[], rectOf: (t: T) => Rect): T[] {
  const bands: { top: number; bottom: number; centerSum: number; hSum: number; items: T[] }[] = [];
  const sorted = [...list].sort((a, b) => rectOf(a).y - rectOf(b).y || rectOf(a).h - rectOf(b).h);
  for (const it of sorted) {
    const r = rectOf(it);
    const c = r.y + r.h / 2;
    let best: (typeof bands)[number] | undefined;
    let bestD = Infinity;
    for (const b of bands) {
      const d = Math.abs(c - b.centerSum / b.items.length);
      const tol = Math.max(8, 0.6 * Math.min(r.h, b.hSum / b.items.length));
      const overlaps = r.y <= b.bottom && r.y + r.h >= b.top;
      if (!overlaps && d > tol) continue;
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (!best) bands.push({ top: r.y, bottom: r.y + r.h, centerSum: c, hSum: r.h, items: [it] });
    else {
      best.bottom = Math.max(best.bottom, r.y + r.h);
      best.centerSum += c;
      best.hSum += r.h;
      best.items.push(it);
    }
  }
  return bands
    .sort((a, b) => a.top - b.top || a.centerSum / a.items.length - b.centerSum / b.items.length)
    .flatMap((b) => b.items.sort((a, c) => rectOf(a).x - rectOf(c).x));
}

/** 排列的目标位置（左上角）。items 至少 2 个 */
export function arrangeRects(items: { id: string; rect: Rect }[], mode: ArrangeMode): Pos {
  const ordered = mode === 'grid' ? gridOrder(items, (i) => i.rect) : readingOrder(items, (i) => i.rect);
  const anchor = boundsOf(items.map((i) => i.rect));
  const out: Pos = new Map();
  if (mode === 'grid') {
    const cols = Math.ceil(Math.sqrt(ordered.length));
    const cw = Math.max(...ordered.map((i) => i.rect.w));
    const ch = Math.max(...ordered.map((i) => i.rect.h));
    const raw = ordered.map((it, i) => ({ id: it.id, x: (i % cols) * (cw + GRID_GAP) + (cw - it.rect.w) / 2, y: Math.floor(i / cols) * (ch + GRID_GAP) + (ch - it.rect.h) / 2 }));
    // 格子居中会在外面留白：归一到原外框左上角，重复排列不漂
    const ox = Math.min(...raw.map((p) => p.x));
    const oy = Math.min(...raw.map((p) => p.y));
    raw.forEach((p) => out.set(p.id, { x: Math.round(anchor.x + p.x - ox), y: Math.round(anchor.y + p.y - oy) }));
    return out;
  }
  const horizontal = mode === 'horizontal';
  const cross = Math.max(...ordered.map((i) => (horizontal ? i.rect.h : i.rect.w)));
  let cursor = 0;
  for (const it of ordered) {
    const p = horizontal ? { x: cursor, y: (cross - it.rect.h) / 2 } : { x: (cross - it.rect.w) / 2, y: cursor };
    out.set(it.id, { x: Math.round(anchor.x + p.x), y: Math.round(anchor.y + p.y) });
    cursor += (horizontal ? it.rect.w : it.rect.h) + ARRANGE_GAP;
  }
  return out;
}

/** 选中的哪些参与排列（线上 resolveSelectedLayoutTargets）：单选一个组 = 组里的节点；多选去掉祖先也选中了的 */
export function arrangeTargets(doc: CanvasDoc, ids: string[]): CanvasNode[] {
  const picked = doc.nodes.filter((n) => ids.includes(n.id));
  if (picked.length === 1) return picked[0].type === 'group' ? doc.nodes.filter((n) => n.parentId === picked[0].id) : picked;
  return picked.filter((n) => !n.parentId || !ids.includes(n.parentId));
}

/** 按「组 → 组里的节点也跟着挪」把位移写进节点，再重算组的大小 */
function applyMoves(doc: CanvasDoc, moves: Pos): CanvasDoc {
  const delta = new Map<string, { dx: number; dy: number }>();
  for (const n of doc.nodes) {
    const to = moves.get(n.id);
    if (to) delta.set(n.id, { dx: to.x - n.x, dy: to.y - n.y });
  }
  const nodes = doc.nodes.map((n) => {
    const own = delta.get(n.id);
    // 组挪了：组里的节点跟着挪（自己没被单独排）
    const d = own ?? (n.parentId ? delta.get(n.parentId) : undefined);
    return d && (d.dx || d.dy) ? { ...n, x: n.x + d.dx, y: n.y + d.dy } : n;
  });
  return { ...doc, nodes: fitGroups(nodes) };
}

/** 排列选中的节点（进撤销栈） */
export function arrangeNodes(canvasId: string, ids: string[], mode: ArrangeMode) {
  const doc = getDoc(canvasId);
  const targets = arrangeTargets(doc, ids);
  if (targets.length < 2) return;
  if (targets.some((n) => !(n.w > 0 && n.h > 0))) {
    toast.warning(GROUP_TEXT.arrangeInvalid);
    return;
  }
  const moves = arrangeRects(
    targets.map((n) => ({ id: n.id, rect: { x: n.x, y: n.y, w: n.w, h: n.h } })),
    mode,
  );
  commit(canvasId, (d) => applyMoves(d, moves));
}

// ---------- 整理画布 ----------

interface Item {
  id: string;
  rect: Rect;
}
interface Link {
  from: string;
  to: string;
}

/** 一个连通分量从左到右分层：层 = 从源头走过来的最长路径；层内按上一层连过来的位置排，挤了往下推 */
function layered(items: Item[], links: Link[]): Map<string, Rect> {
  const rectOf = new Map(items.map((i) => [i.id, i.rect]));
  const ins = new Map<string, string[]>(items.map((i) => [i.id, []]));
  for (const l of links) ins.get(l.to)?.push(l.from);
  const rank = new Map<string, number>();
  const rankOf = (id: string, seen = new Set<string>()): number => {
    if (rank.has(id)) return rank.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const r = Math.max(0, ...ins.get(id)!.map((p) => rankOf(p, seen) + 1));
    rank.set(id, r);
    return r;
  };
  items.forEach((i) => rankOf(i.id));
  const layers: string[][] = [];
  // 按原来的上下顺序进层，层内先保持用户原来的上下关系
  [...items].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x).forEach((i) => (layers[rank.get(i.id)!] ??= []).push(i.id));
  const out = new Map<string, Rect>();
  let x = 0;
  for (const layer of layers.filter(Boolean)) {
    const want = (id: string) => {
      const ps = ins.get(id)!.filter((p) => out.has(p));
      if (!ps.length) return undefined;
      return ps.reduce((s, p) => s + out.get(p)!.y + out.get(p)!.h / 2, 0) / ps.length;
    };
    const order = layer.map((id, i) => ({ id, i, c: want(id) })).sort((a, b) => (a.c ?? Infinity) - (b.c ?? Infinity) || a.i - b.i);
    let bottom = -Infinity;
    for (const { id, c } of order) {
      const r = rectOf.get(id)!;
      const next = bottom === -Infinity ? 0 : bottom + TIDY.nodeGap;
      // 想对齐上一层连过来的位置；和同层上一个挤了就往下推
      const top = c !== undefined ? Math.max(c - r.h / 2, bottom === -Infinity ? -Infinity : next) : next;
      out.set(id, { ...r, x, y: top });
      bottom = top + r.h;
    }
    x += Math.max(...layer.map((id) => rectOf.get(id)!.w)) + TIDY.layerGap;
  }
  return out;
}

/** 按连线拆连通分量；孤立节点各自一个 */
function components(items: Item[], links: Link[]): { items: Item[]; links: Link[] }[] {
  const parent = new Map(items.map((i) => [i.id, i.id]));
  const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
  const valid = links.filter((l) => l.from !== l.to && parent.has(l.from) && parent.has(l.to));
  valid.forEach((l) => parent.set(find(l.to), find(l.from)));
  const groups = new Map<string, { items: Item[]; links: Link[] }>();
  items.forEach((i) => {
    const r = find(i.id);
    if (!groups.has(r)) groups.set(r, { items: [], links: [] });
    groups.get(r)!.items.push(i);
  });
  valid.forEach((l) => groups.get(find(l.from))!.links.push(l));
  return [...groups.values()];
}

/** 一层的整理：每个分量分层排好，再按阅读顺序打包成行，锚在原来外框的左上角 */
function arrangeLevel(items: Item[], links: Link[]): Map<string, Rect> {
  const out = new Map<string, Rect>();
  if (!items.length) return out;
  const comps = components(items, links).map((c) => {
    const laid = c.items.length > 1 ? layered(c.items, c.links) : new Map(c.items.map((i) => [i.id, i.rect]));
    const b = boundsOf([...laid.values()]);
    return { original: boundsOf(c.items.map((i) => i.rect)), size: b, local: new Map([...laid].map(([id, r]) => [id, { ...r, x: r.x - b.x, y: r.y - b.y }])) };
  });
  const ordered = readingOrder(comps, (c) => c.original);
  const maxW = Math.max(...ordered.map((c) => c.size.w));
  const area = ordered.reduce((s, c) => s + c.size.w * c.size.h, 0);
  const rowW = Math.max(maxW, Math.sqrt(area) * TIDY.aspectRatio);
  const anchor = boundsOf(items.map((i) => i.rect));
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  for (const c of ordered) {
    if (cx > 0 && cx + c.size.w > rowW) {
      cx = 0;
      cy += rowH + TIDY.componentGap;
      rowH = 0;
    }
    c.local.forEach((r, id) => out.set(id, { ...r, x: Math.round(anchor.x + cx + r.x), y: Math.round(anchor.y + cy + r.y) }));
    cx += c.size.w + TIDY.componentGap;
    rowH = Math.max(rowH, c.size.h);
  }
  return out;
}

/** 整个画布整理后每个节点的新左上角：组先整理里面的，再用整理后的组大小参与外层 */
export function tidyPositions(doc: CanvasDoc): Pos {
  const links = doc.edges.map((e) => ({ from: e.from, to: e.to }));
  const top = (id: string) => doc.nodes.find((n) => n.id === id)?.parentId ?? id;
  const result: Pos = new Map();
  // 组里先排，记下组整理后的外框（相对组里节点的新位置）
  const groupRect = new Map<string, Rect>();
  for (const g of doc.nodes.filter((n) => n.type === 'group')) {
    const kids = doc.nodes.filter((n) => n.parentId === g.id);
    if (!kids.length) continue;
    const ids = new Set(kids.map((k) => k.id));
    const laid = arrangeLevel(
      kids.map((k) => ({ id: k.id, rect: { x: k.x, y: k.y, w: k.w, h: k.h } })),
      links.filter((l) => ids.has(l.from) && ids.has(l.to)),
    );
    laid.forEach((r, id) => result.set(id, { x: r.x, y: r.y }));
    const b = boundsOf([...laid.values()]);
    groupRect.set(g.id, { x: b.x - GROUP_PAD.x, y: b.y - GROUP_PAD.top, w: b.w + GROUP_PAD.x * 2, h: b.h + GROUP_PAD.top + GROUP_PAD.bottom });
  }
  // 外层：没在组里的节点和组；连到组里的线算在组上
  const outer = doc.nodes.filter((n) => !n.parentId);
  const outerLinks = links.map((l) => ({ from: top(l.from), to: top(l.to) })).filter((l) => l.from !== l.to);
  const laid = arrangeLevel(
    outer.map((n) => ({ id: n.id, rect: groupRect.get(n.id) ?? { x: n.x, y: n.y, w: n.w, h: n.h } })),
    outerLinks,
  );
  laid.forEach((r, id) => {
    const node = outer.find((n) => n.id === id)!;
    const before = groupRect.get(id);
    if (node.type === 'group' && before) {
      // 组整体挪：组里的节点跟着同样的位移
      const dx = r.x - before.x;
      const dy = r.y - before.y;
      doc.nodes.filter((k) => k.parentId === id).forEach((k) => {
        const p = result.get(k.id)!;
        result.set(k.id, { x: p.x + dx, y: p.y + dy });
      });
    }
    result.set(id, { x: r.x, y: r.y });
  });
  return result;
}

const setPositions = (doc: CanvasDoc, pos: Pos): CanvasDoc => ({
  ...doc,
  nodes: fitGroups(doc.nodes.map((n) => (pos.has(n.id) ? { ...n, ...pos.get(n.id)! } : n))),
});

/** 整理前的位置（预览中）：每块画布一份，在内存里 */
const tidyBefore = new Map<string, Pos>();
export const isTidyPreviewing = (canvasId: string) => tidyBefore.has(canvasId);

/** 整理画布：先预览（不进撤销栈）；再点一次照当前位置再整理一遍，取消还是回到第一次之前 */
export function previewTidy(canvasId: string) {
  const doc = getDoc(canvasId);
  if (!doc.nodes.length) return;
  if (!tidyBefore.has(canvasId)) tidyBefore.set(canvasId, new Map(doc.nodes.map((n) => [n.id, { x: n.x, y: n.y }])));
  patch(canvasId, (d) => setPositions(d, tidyPositions(d)));
}

/** 取消：回到整理前（整理后新加的、删掉的不管） */
export function cancelTidy(canvasId: string) {
  const before = tidyBefore.get(canvasId);
  tidyBefore.delete(canvasId);
  if (before) patch(canvasId, (d) => setPositions(d, before));
}

/** 确定：保留整理结果，进撤销栈（⌘Z 回到整理前） */
export function keepTidy(canvasId: string) {
  const before = tidyBefore.get(canvasId);
  tidyBefore.delete(canvasId);
  if (!before) return;
  const after = new Map(getDoc(canvasId).nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  patch(canvasId, (d) => setPositions(d, before));
  commit(canvasId, (d) => setPositions(d, after));
}

/** 改节点大小（文字节点拖边）：在组里的，组跟着重新包住（进撤销栈） */
export function resizeNode(canvasId: string, nodeId: string, size: { w: number; h: number }) {
  commit(canvasId, (d) => ({ ...d, nodes: fitGroups(d.nodes.map((n) => (n.id === nodeId ? { ...n, ...size } : n))) }));
}
