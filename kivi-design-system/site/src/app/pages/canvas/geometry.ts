import type { CanvasDoc, CanvasNode } from '../../data/types';

/* 画布的几何：连接点在哪、连线外框、框选、视角换算。都按世界坐标（缩放前） */

export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface View {
  x: number;
  y: number;
  k: number;
}

/** 连接点在节点外 8、直径 16：圆心离节点边 16 */
const DOT = 16;

/** 右边的出口（上游连出去）、左边的入口（下游接进来） */
export const outPort = (n: Rect): Pt => ({ x: n.x + n.w + DOT, y: n.y + n.h / 2 });
export const inPort = (n: Rect): Pt => ({ x: n.x - DOT, y: n.y + n.h / 2 });

/**
 * 两点之间的连线外框和走向（给 Connector）。Connector 只会从左往右画：终点在起点左边时，
 * 外框照样从左到右算，再水平翻过来（flip），曲线两头还是水平出入
 */
export function edgeBox(a: Pt, b: Pt) {
  const flip = b.x < a.x;
  const [l, r] = flip ? [b, a] : [a, b];
  const width = Math.max(r.x - l.x, 1);
  if (Math.abs(a.y - b.y) < 1) return { left: l.x, top: a.y - 1, width, height: 2, direction: 'flat' as const, flip };
  // 翻过来之前起点 a 在左：起点在下就是往上走
  const up = a.y > b.y;
  return { left: l.x, top: Math.min(a.y, b.y), width, height: Math.abs(a.y - b.y), direction: up ? ('up' as const) : ('down' as const), flip };
}

export const rectOf = (n: CanvasNode): Rect => ({ x: n.x, y: n.y, w: n.w, h: n.h });

export const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** 拖出来的框（两个角）→ 矩形 */
export const rectFrom = (a: Pt, b: Pt): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

/** 屏幕（相对画布左上）↔ 世界 */
export const toWorld = (p: Pt, v: View): Pt => ({ x: (p.x - v.x) / v.k, y: (p.y - v.y) / v.k });

/** 一堆节点的外框 */
export function boundsOf(nodes: Rect[]): Rect | null {
  if (!nodes.length) return null;
  const x = Math.min(...nodes.map((n) => n.x));
  const y = Math.min(...nodes.map((n) => n.y));
  const r = Math.max(...nodes.map((n) => n.x + n.w));
  const b = Math.max(...nodes.map((n) => n.y + n.h));
  return { x, y, w: r - x, h: b - y };
}

/** 让 rect 放进 w × h 的画布正中，留 pad，缩放不超过 max */
export function fitView(rect: Rect, w: number, h: number, pad: number, max: number, min: number): View {
  const k = Math.max(min, Math.min(max, (w - pad * 2) / rect.w, (h - pad * 2) / rect.h));
  return { k, x: w / 2 - (rect.x + rect.w / 2) * k, y: h / 2 - (rect.y + rect.h / 2) * k };
}

/** 线段和矩形相交没有（框选时连线一起选，容差 8） */
export function edgeHits(a: Pt, b: Pt, r: Rect, tol = 8): boolean {
  const box = { x: r.x - tol, y: r.y - tol, w: r.w + tol * 2, h: r.h + tol * 2 };
  // 曲线取 16 个点近似
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const mx = (a.x + b.x) / 2;
    // 三次贝塞尔：控制点 (mx, a.y)、(mx, b.y)
    const x = (1 - t) ** 3 * a.x + 3 * (1 - t) ** 2 * t * mx + 3 * (1 - t) * t ** 2 * mx + t ** 3 * b.x;
    const y = (1 - t) ** 3 * a.y + 3 * (1 - t) ** 2 * t * a.y + 3 * (1 - t) * t ** 2 * b.y + t ** 3 * b.y;
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return true;
  }
  return false;
}

/** 找一个空位放新节点：从 at 开始往右下错开，避开已有节点 */
export function freeSpot(doc: CanvasDoc, at: Pt, size: { w: number; h: number }): Pt {
  let p = at;
  for (let i = 0; i < 20; i++) {
    const r = { x: p.x, y: p.y, ...size };
    if (!doc.nodes.some((n) => n.type !== 'group' && intersects(r, rectOf(n)))) return p;
    p = { x: p.x + 40, y: p.y + 40 };
  }
  return p;
}
