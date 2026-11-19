import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Connector, DropOverlay, Dropdown, toast } from '@kivi';
import { useFileDrop } from '@kivi/hooks';
import {
  addFileNodes,
  addNodes,
  connect,
  getDoc,
  hasClipboard,
  isBusy,
  makeNode,
  moveNodes,
  removeItems,
  setView as saveView,
  undo,
  updateNode,
  useCanvasDoc,
  useHistory,
  useUploading,
  withChildren,
  copyNodes,
  duplicateNodes,
  pasteNodes,
  replaceNodeFile,
  registerViewCenter,
  scatterImages,
} from '../../data/canvas-doc';
import { useDB } from '../../data/db';
import { useNow } from '../../data/tasks';
import type { CanvasItem, CanvasNode, CanvasNodeType } from '../../data/types';
import { ALIGN_THRESHOLD, CANVAS_MAX_UPLOAD, CANVAS_TEXT, DROP_STAGGER, SNAP_GRID, ZOOM_MAX, ZOOM_MIN, connectProblem, nodeSize } from '../../rules/canvas';
import { edgeBox, edgeHits, fitView, inPort, intersects, outPort, rectFrom, rectOf, toWorld, boundsOf, type Pt, type Rect, type View } from './geometry';
import { AddNodeMenu, BlankMenu, NodeMenu } from './menus';
import { NodeFloat } from './NodeFloat';
import { NodeView } from './NodeView';
import { useCanvasKeys } from './useCanvasKeys';
import { ViewBar } from './ViewBar';
import { EmptyHint } from './EmptyHint';
// 浮层（节点工具栏、生成面板）、视图工具栏的样式和业务页的小画布同一份
import '../../../docs/business/canvas.demos.css';

/*
  画布本体（照线上无限画布，规则在 rules/canvas.ts，命令在 data/canvas-doc.ts）：
  - 视角：滚轮 / 触控板平移，⌘ / Ctrl + 滚轮（捏合）以鼠标为中心缩放 20%–800%；按住空格或中键拖是平移。
  - 拖空白是框选（相交就选上，连线一起选），Shift 加选。点节点选中、Shift 加减；拖节点挪动（选中的一起挪，组带着里面的），
    拖的时候和别的节点边、中线对齐出辅助线；开了吸附按 12 跳格。
  - 从节点右边的连接点拖出线：放到别的节点上连上（不行就提示原因），拖到空白处松手出「引用该节点生成」，选了就在那建节点连上。
  - 双击空白出添加节点；右键空白 / 节点出菜单；拖文件进来在落点建节点。
  - 拖动中的位置只在本地，松手才写进数据（撤销一步回到拖之前）。
*/

export interface CanvasBoardHandle {
  /** 选中这些节点、视角移过去（单个居中，缩放不超过 1.3；多个适配） */
  focus: (ids: string[]) => void;
  /** 在视口中心加一个节点（底部「添加」） */
  addAtCenter: (type: Exclude<CanvasNodeType, 'group'>) => void;
  /** 打开选文件，传完在视口中心建节点（底部「上传」） */
  upload: () => void;
  /** 只选中，不动视角（Agent 建了节点） */
  select: (ids: string[]) => void;
}

interface CanvasBoardProps {
  canvasId: string;
  /** 全屏看一张 */
  onView: (item: CanvasItem, node: CanvasNode) => void;
  /** 添加到对话 */
  onAddToChat?: (ids: string[]) => void;
}

type Drag =
  | { kind: 'pan'; id: number; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'marquee'; id: number; start: Pt; base: Sel }
  | { kind: 'move'; id: number; start: Pt; ids: string[]; moved: boolean; node: string; shift: boolean }
  | { kind: 'connect'; id: number; from: string };

interface Sel {
  nodes: string[];
  edges: string[];
}
const NONE: Sel = { nodes: [], edges: [] };

type Menu =
  | { kind: 'add'; x: number; y: number; at: Pt; from?: string }
  | { kind: 'blank'; x: number; y: number; at: Pt }
  | { kind: 'node'; x: number; y: number };

const clampK = (k: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
const download = () => toast.success('已开始下载');

export const CanvasBoard = forwardRef<CanvasBoardHandle, CanvasBoardProps>(function CanvasBoard({ canvasId, onView, onAddToChat }, ref) {
  const doc = useCanvasDoc(canvasId);
  const tasks = useDB((s) => s.tasks);
  const uploading = useUploading();
  const { canUndo } = useHistory(canvasId);
  const vp = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAt = useRef<Pt | null>(null);
  /** 素材节点点了「上传」：换哪个节点的文件 */
  const replaceRef = useRef<string | null>(null);

  const [view, setViewState] = useState<View>(doc.view ?? { x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [gliding, setGliding] = useState(false);
  const saveTimer = useRef<number>();
  const setView = (next: View | ((v: View) => View), glide = false) => {
    const v = typeof next === 'function' ? next(viewRef.current) : next;
    viewRef.current = v;
    setViewState(v);
    if (glide) {
      setGliding(true);
      window.setTimeout(() => setGliding(false), 320);
    }
    // 视角停下来再存，不然每一帧都写一次数据
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveView(canvasId, viewRef.current), 500);
  };

  const [sel, setSel] = useState<Sel>(NONE);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [offset, setOffset] = useState<{ ids: Set<string>; dx: number; dy: number } | null>(null);
  const [guides, setGuides] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [wire, setWire] = useState<{ from: string; to: Pt; target?: string } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [stackOpen, setStackOpen] = useState<string | null>(null);
  const [snap, setSnap] = useState(false);
  const [hideLines, setHideLines] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [space, setSpace] = useState(false);
  const drag = useRef<Drag | null>(null);
  const running = tasks.some((t) => t.status === 'running' && t.where.page === 'canvas');
  const now = useNow(running);

  const taskOf = (n: CanvasNode) => (n.taskId ? tasks.find((t) => t.id === n.taskId) : undefined);
  const busyOf = (n: CanvasNode) => !!uploading[n.id] || taskOf(n)?.status === 'running';

  // 删掉的节点、连线从选中里去掉
  useEffect(() => {
    setSel((s) => {
      const nodes = s.nodes.filter((id) => doc.nodes.some((n) => n.id === id));
      const edges = s.edges.filter((id) => doc.edges.some((e) => e.id === id));
      return nodes.length === s.nodes.length && edges.length === s.edges.length ? s : { nodes, edges };
    });
  }, [doc]);

  // ---------- 视角 ----------

  const size = () => ({ w: vp.current?.clientWidth ?? 0, h: vp.current?.clientHeight ?? 0 });
  const fit = (glide = true) => {
    const b = boundsOf(doc.nodes.map(rectOf));
    const { w, h } = size();
    if (!b) setView({ x: w / 2, y: h / 2, k: 1 }, glide);
    else setView(fitView(b, w, h, 80, 1, ZOOM_MIN), glide);
  };
  // 第一次进来：有存过的视角用它，没有就把内容放进来（缩放最大 1）
  useLayoutEffect(() => {
    if (!doc.view) fit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const zoomAt = (p: Pt, k: number, glide = false) =>
    setView((v) => {
      const nk = clampK(k);
      return { k: nk, x: p.x - ((p.x - v.x) * nk) / v.k, y: p.y - ((p.y - v.y) * nk) / v.k };
    }, glide);
  const zoomCenter = (fn: (k: number) => number) => {
    const { w, h } = size();
    zoomAt({ x: w / 2, y: h / 2 }, fn(viewRef.current.k), true);
  };
  const centerWorld = (): Pt => {
    const { w, h } = size();
    return toWorld({ x: w / 2, y: h / 2 }, viewRef.current);
  };
  // 登记视口中心：Agent 建节点没有源节点时放这
  useEffect(() => registerViewCenter(canvasId, centerWorld), [canvasId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 滚轮：⌘ / Ctrl（触控板捏合）缩放，其他平移。浮层（面板、菜单）里的滚动不管
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.cv-float, .tpl-cb__ui')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, viewRef.current.k * Math.exp(-e.deltaY * 0.01));
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    focus: (ids) => {
      const nodes = getDoc(canvasId).nodes.filter((n) => ids.includes(n.id));
      const b = boundsOf(nodes.map(rectOf));
      if (!b) return;
      const { w, h } = size();
      setSel({ nodes: nodes.map((n) => n.id), edges: [] });
      if (nodes.length === 1) {
        const k = Math.min(viewRef.current.k, 1.3);
        setView({ k, x: w / 2 - (b.x + b.w / 2) * k, y: h / 2 - (b.y + b.h / 2) * k }, true);
      } else setView(fitView(b, w, h, 80, 1.3, ZOOM_MIN), true);
    },
    addAtCenter: (type) => addAt(type, centerWorld(), true),
    select: (ids) => setSel({ nodes: ids, edges: [] }),
    upload: () => {
      uploadAt.current = centerWorld();
      fileRef.current?.click();
    },
  }));

  // ---------- 加节点 ----------

  /** 在 at 加一个节点（center：at 是节点中心；否则是左边入口的位置）；from 给了就连上 */
  const addAt = (type: Exclude<CanvasNodeType, 'group'>, at: Pt, center: boolean, from?: string) => {
    const s = nodeSize(type, type === 'image' ? '1:1' : type === 'video' ? '16:9' : undefined);
    const pos = center ? { x: at.x - s.w / 2, y: at.y - s.h / 2 } : { x: at.x + 16, y: at.y - s.h / 2 };
    const node = makeNode(type, pos);
    addNodes(canvasId, [node], from ? [{ from, to: node.id }] : []);
    setSel({ nodes: [node.id], edges: [] });
  };

  const addFiles = (files: File[], at: Pt) => {
    if (files.length > CANVAS_MAX_UPLOAD) {
      toast.error(CANVAS_TEXT.tooManyFiles(CANVAS_MAX_UPLOAD));
      return;
    }
    void addFileNodes(canvasId, files, at, DROP_STAGGER).then((ids) => setSel({ nodes: ids, edges: [] }));
  };

  // 拖文件进来：落在哪建在哪
  const dropAt = useRef<Pt | null>(null);
  const { dragging, rejected, bind } = useFileDrop({
    accept: 'image/png,image/jpeg,image/webp,video/mp4,audio/mpeg,audio/wav,.mp3,.wav,.txt,.md,.json',
    multiple: true,
    onFiles: (files) => addFiles(files, dropAt.current ?? centerWorld()),
    onReject: () => toast.error(CANVAS_TEXT.badFileType),
  });

  // ---------- 指针 ----------

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = vp.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const worldOf = (e: { clientX: number; clientY: number }) => toWorld(local(e), viewRef.current);
  const nodeAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-node]')?.dataset.node;

  /** 菜单、弹窗是挂在 body 上的，React 事件会顺着组件树冒到画布上来：不在画布里的不管 */
  const outside = (t: HTMLElement) => !vp.current?.contains(t);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (outside(t) || t.closest('.cv-float, .tpl-cb__ui')) return;
    setMenu(null);
    const capture = () => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 脚本模拟的点击没有真的指针 */
      }
    };
    // 中键、按住空格：平移
    if (e.button === 1 || (e.button === 0 && space)) {
      e.preventDefault();
      drag.current = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      capture();
      return;
    }
    if (e.button !== 0) return;
    const nodeId = t.closest<HTMLElement>('[data-node]')?.dataset.node;
    // 右边的连接点：拖出连线
    if (nodeId && t.closest('.kv-node-wrapper__dot--right')) {
      drag.current = { kind: 'connect', id: e.pointerId, from: nodeId };
      setWire({ from: nodeId, to: worldOf(e) });
      capture();
      return;
    }
    if (nodeId) {
      const already = sel.nodes.includes(nodeId);
      if (e.shiftKey) setSel((s) => ({ nodes: already ? s.nodes.filter((id) => id !== nodeId) : [...s.nodes, nodeId], edges: s.edges }));
      else if (!already) setSel({ nodes: [nodeId], edges: [] });
      if (stackOpen && stackOpen !== nodeId) setStackOpen(null);
      // 点在节点里的按钮、播放器上：只选中，不拖
      if (t.closest('button, a, input, textarea, [contenteditable="true"], .kv-audio-wave, .kv-video-player__bar')) return;
      if (e.shiftKey && already) return;
      const picked = e.shiftKey || already ? [...new Set([...sel.nodes, nodeId])] : [nodeId];
      drag.current = { kind: 'move', id: e.pointerId, start: worldOf(e), ids: withChildren(doc, picked), moved: false, node: nodeId, shift: e.shiftKey };
      capture();
      return;
    }
    // 空白：框选
    if (!e.shiftKey) setSel(NONE);
    setStackOpen(null);
    drag.current = { kind: 'marquee', id: e.pointerId, start: worldOf(e), base: e.shiftKey ? sel : NONE };
    capture();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
      return;
    }
    const p = worldOf(e);
    if (d.kind === 'marquee') {
      const r = rectFrom(d.start, p);
      if (r.w * view.k < 3 && r.h * view.k < 3) return;
      setMarquee(r);
      const nodes = doc.nodes.filter((n) => n.type !== 'group' && intersects(r, rectOf(n))).map((n) => n.id);
      const edges = doc.edges
        .filter((ed) => {
          const a = doc.nodes.find((n) => n.id === ed.from);
          const b = doc.nodes.find((n) => n.id === ed.to);
          return a && b && edgeHits(outPort(a), inPort(b), r);
        })
        .map((ed) => ed.id);
      setSel({ nodes: [...new Set([...d.base.nodes, ...nodes])], edges: [...new Set([...d.base.edges, ...edges])] });
      return;
    }
    if (d.kind === 'connect') {
      const over = nodeAt(e.clientX, e.clientY);
      const target = over && over !== d.from && !connectProblem(doc, d.from, over) ? over : undefined;
      const tn = target ? doc.nodes.find((n) => n.id === target) : undefined;
      setWire({ from: d.from, to: tn ? inPort(tn) : p, target });
      return;
    }
    // 挪节点
    let dx = p.x - d.start.x;
    let dy = p.y - d.start.y;
    if (!d.moved && Math.hypot(dx, dy) * view.k < 3) return;
    d.moved = true;
    const moving = new Set(d.ids);
    const box = boundsOf(doc.nodes.filter((n) => moving.has(n.id)).map(rectOf))!;
    // 对齐辅助线：移动的那一堆的左、中、右（上、中、下）贴近别的节点的边或中线就吸过去
    const T = ALIGN_THRESHOLD / view.k;
    const others = doc.nodes.filter((n) => !moving.has(n.id) && n.type !== 'group');
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    let bx: { d: number; v: number; n: CanvasNode } | null = null;
    let by: { d: number; v: number; n: CanvasNode } | null = null;
    for (const o of others) {
      for (const ov of [o.x, o.x + o.w / 2, o.x + o.w]) {
        for (const mv of [box.x + dx, box.x + dx + box.w / 2, box.x + dx + box.w]) {
          const dd = ov - mv;
          if (Math.abs(dd) < T && (!bx || Math.abs(dd) < Math.abs(bx.d))) bx = { d: dd, v: ov, n: o };
        }
      }
      for (const ov of [o.y, o.y + o.h / 2, o.y + o.h]) {
        for (const mv of [box.y + dy, box.y + dy + box.h / 2, box.y + dy + box.h]) {
          const dd = ov - mv;
          if (Math.abs(dd) < T && (!by || Math.abs(dd) < Math.abs(by.d))) by = { d: dd, v: ov, n: o };
        }
      }
    }
    if (bx) dx += bx.d;
    else if (snap) dx = Math.round((box.x + dx) / SNAP_GRID) * SNAP_GRID - box.x;
    if (by) dy += by.d;
    else if (snap) dy = Math.round((box.y + dy) / SNAP_GRID) * SNAP_GRID - box.y;
    if (bx) lines.push({ x1: bx.v, y1: Math.min(box.y + dy, bx.n.y), x2: bx.v, y2: Math.max(box.y + dy + box.h, bx.n.y + bx.n.h) });
    if (by) lines.push({ x1: Math.min(box.x + dx, by.n.x), y1: by.v, x2: Math.max(box.x + dx + box.w, by.n.x + by.n.w), y2: by.v });
    setGuides(lines);
    setOffset({ ids: moving, dx, dy });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.kind === 'marquee') setMarquee(null);
    if (d.kind === 'move') {
      if (d.moved && offset) {
        const moves: Record<string, Pt> = {};
        for (const n of doc.nodes) if (offset.ids.has(n.id)) moves[n.id] = { x: Math.round(n.x + offset.dx), y: Math.round(n.y + offset.dy) };
        moveNodes(canvasId, moves);
      } else if (!d.moved && !d.shift && sel.nodes.length > 1) setSel({ nodes: [d.node], edges: [] });
      setOffset(null);
      setGuides([]);
    }
    if (d.kind === 'connect') {
      const over = nodeAt(e.clientX, e.clientY);
      setWire(null);
      if (over && over !== d.from) connect(canvasId, d.from, over);
      else if (!over) setMenu({ kind: 'add', x: e.clientX, y: e.clientY, at: worldOf(e), from: d.from });
    }
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (outside(t) || t.closest('[data-node], .cv-float, .tpl-cb__ui')) return;
    setMenu({ kind: 'add', x: e.clientX, y: e.clientY, at: worldOf(e) });
  };

  const onContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (outside(t) || t.closest('.cv-float, .tpl-cb__ui')) return;
    e.preventDefault();
    const nodeId = t.closest<HTMLElement>('[data-node]')?.dataset.node;
    if (nodeId) {
      if (!sel.nodes.includes(nodeId)) setSel({ nodes: [nodeId], edges: [] });
      setMenu({ kind: 'node', x: e.clientX, y: e.clientY });
    } else setMenu({ kind: 'blank', x: e.clientX, y: e.clientY, at: worldOf(e) });
  };

  // ---------- 键盘 ----------

  const pasteAt = (at?: Pt) => {
    const ids = pasteNodes(canvasId, at ?? centerWorld());
    if (ids.length) setSel({ nodes: ids, edges: [] });
  };
  useCanvasKeys({
    canvasId,
    sel,
    setSel: (nodes, edges = []) => setSel({ nodes, edges }),
    onSpace: setSpace,
    onZoom: (dir) => zoomCenter((k) => (dir > 0 ? k * 1.25 : k / 1.25)),
    onPaste: () => pasteAt(),
    onFiles: (files) => addFiles(files, centerWorld()),
    onEscape: () => {
      setMenu(null);
      setSel(NONE);
    },
  });

  // ---------- 画 ----------

  const posOf = (n: CanvasNode) => (offset?.ids.has(n.id) ? { ...n, x: n.x + offset.dx, y: n.y + offset.dy } : n);
  const shown = useMemo(() => doc.nodes.map(posOf), [doc.nodes, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = (id: string) => shown.find((n) => n.id === id);
  const selNode = sel.nodes.length === 1 && !offset ? byId(sel.nodes[0]) : undefined;
  const selected = new Set(sel.nodes);
  const linkedIn = new Set(doc.edges.map((e) => e.to));
  const linkedOut = new Set(doc.edges.map((e) => e.from));

  const menuNodes = sel.nodes.map((id) => doc.nodes.find((n) => n.id === id)).filter((n): n is CanvasNode => !!n);
  const one = menuNodes.length === 1 ? menuNodes[0] : undefined;

  return (
    <div
      ref={vp}
      className="tpl-cb"
      data-space={space || undefined}
      data-panning={drag.current?.kind === 'pan' || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      {...bind}
      onDragOverCapture={(e) => {
        dropAt.current = worldOf(e);
      }}
      // 节点里的图片是原生 <img>：按住拖会触发浏览器自己的拖图片，把我们的拖动打断（pointercancel），节点就挪不动了
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="tpl-cb__world"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transition: gliding ? 'transform var(--motion-duration-300) var(--motion-ease-in-out)' : undefined,
        }}
      >
        {doc.edges.map((ed) => {
          const a = byId(ed.from);
          const b = byId(ed.to);
          if (!a || !b) return null;
          const on = selected.has(a.id) || selected.has(b.id) || sel.edges.includes(ed.id);
          // 隐藏连线时，选中节点上下游的连线还显示（照线上）
          if (hideLines && !on) return null;
          const box = edgeBox(outPort(a), inPort(b));
          const flowing = taskOf(b)?.status === 'running';
          return (
            <Connector
              key={ed.id}
              className="tpl-cb__edge"
              status={flowing ? 'flowing' : on ? 'active' : 'default'}
              width={box.width}
              height={box.height}
              direction={box.direction}
              remove="hover"
              onRemove={() => removeItems(canvasId, [], [ed.id])}
              style={{ left: box.left, top: box.top, transform: box.flip ? 'scaleX(-1)' : undefined }}
            />
          );
        })}
        {wire &&
          (() => {
            const a = byId(wire.from);
            if (!a) return null;
            const box = edgeBox(outPort(a), wire.to);
            return (
              <Connector
                className="tpl-cb__edge"
                status="drawing"
                width={box.width}
                height={box.height}
                direction={box.direction}
                style={{ left: box.left, top: box.top, transform: box.flip ? 'scaleX(-1)' : undefined, pointerEvents: 'none' }}
              />
            );
          })()}
        {shown
          .filter((n) => n.type !== 'group')
          .map((n) => (
            <div key={n.id} data-node={n.id} className="tpl-cb__node" style={{ left: n.x, top: n.y }}>
              <NodeView
                node={n}
                task={taskOf(n)}
                uploading={!!uploading[n.id]}
                now={now}
                selected={selected.has(n.id)}
                inLinked={linkedIn.has(n.id)}
                outLinked={linkedOut.has(n.id) || wire?.from === n.id}
                inHighlight={wire?.target === n.id}
                stackOpen={stackOpen === n.id}
                onStackOpenChange={(open) => setStackOpen(open ? n.id : null)}
                onSetMain={(i) => {
                  const items = [...(n.items ?? [])];
                  items.unshift(...items.splice(i, 1));
                  updateNode(canvasId, n.id, { items });
                  setStackOpen(null);
                }}
                onReplace={() => {
                  uploadAt.current = null;
                  replaceRef.current = n.id;
                  fileRef.current?.click();
                }}
                onView={(item) => onView(item, n)}
                onDownload={download}
                onGuideSelect={() => toast.info('在下面的面板里写提示词，点生成')}
              />
            </div>
          ))}
        {guides.map((g, i) => (
          <div
            key={i}
            className="tpl-cb__guide"
            style={{ left: g.x1, top: g.y1, width: Math.max(g.x2 - g.x1, 0), height: Math.max(g.y2 - g.y1, 0), '--cb-k': view.k } as CSSProperties}
          />
        ))}
        {marquee && <div className="tpl-cb__marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, '--cb-k': view.k } as CSSProperties} />}
        {selNode && selNode.type !== 'group' && (
          <NodeFloat canvasId={canvasId} doc={doc} node={selNode} busy={busyOf(selNode)} zoom={view.k} onView={(item) => onView(item, selNode)} onDownload={download} />
        )}
      </div>

      {doc.nodes.length === 0 && <EmptyHint canvasId={canvasId} at={centerWorld} onInserted={(ids) => setSel({ nodes: ids, edges: [] })} />}

      <ViewBar
        className="tpl-cb__ui"
        view={view}
        size={size()}
        nodes={doc.nodes}
        minimap={minimap}
        onMinimap={setMinimap}
        snap={snap}
        onSnap={setSnap}
        hideLines={hideLines}
        onHideLines={setHideLines}
        onFit={() => fit(true)}
        onZoom={(dir) => zoomCenter((k) => (dir === 0 ? 1 : dir > 0 ? k * 1.25 : k / 1.25))}
        onPan={(c) => setView((v) => ({ ...v, x: size().w / 2 - c.x * v.k, y: size().h / 2 - c.y * v.k }))}
      />

      <DropOverlay active={dragging} rejected={rejected} />

      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,video/mp4,audio/mpeg,audio/wav,.txt,.md,.json"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          const target = replaceRef.current;
          replaceRef.current = null;
          if (target) void replaceNodeFile(canvasId, target, files[0]);
          else addFiles(files, uploadAt.current ?? centerWorld());
        }}
      />

      <Dropdown anchorPoint={menu ? { x: menu.x, y: menu.y } : undefined} open={menu !== null} onOpenChange={(v) => !v && setMenu(null)}>
        {menu?.kind === 'add' ? (
          <AddNodeMenu
            doc={doc}
            from={menu.from}
            onPick={(type) => {
              addAt(type, menu.at, !menu.from, menu.from);
              setMenu(null);
            }}
            onUpload={() => {
              uploadAt.current = menu.at;
              setMenu(null);
              fileRef.current?.click();
            }}
          />
        ) : menu?.kind === 'blank' ? (
          <BlankMenu
            canUndo={canUndo}
            canPaste={hasClipboard()}
            onUpload={() => {
              uploadAt.current = menu.at;
              setMenu(null);
              fileRef.current?.click();
            }}
            onUndo={() => {
              undo(canvasId);
              setMenu(null);
            }}
            onPaste={() => {
              pasteAt(menu.at);
              setMenu(null);
            }}
          />
        ) : menu?.kind === 'node' ? (
          <NodeMenu
            busy={menuNodes.some(isBusy)}
            canScatter={!!one && one.type === 'image' && (one.items?.length ?? 0) > 1}
            copyLabel={one?.type === 'text' && one.text ? '复制文本' : one?.type === 'image' && one.items?.length ? '复制图片' : undefined}
            canChat={menuNodes.some((n) => n.type !== 'group')}
            onCopy={() => {
              copyNodes(canvasId, sel.nodes);
              setMenu(null);
            }}
            onDuplicate={() => {
              const ids = duplicateNodes(canvasId, sel.nodes);
              if (ids.length) setSel({ nodes: ids, edges: [] });
              setMenu(null);
            }}
            onDelete={() => {
              removeItems(canvasId, sel.nodes, sel.edges);
              setMenu(null);
            }}
            onCopyContent={() => {
              if (one?.type === 'text' && one.text) void navigator.clipboard?.writeText(one.text).catch(() => undefined);
              toast.success(CANVAS_TEXT.copied);
              setMenu(null);
            }}
            onScatter={() => {
              if (one) {
                const ids = scatterImages(canvasId, one.id);
                setSel({ nodes: ids, edges: [] });
              }
              setMenu(null);
            }}
            onChat={() => {
              onAddToChat?.(sel.nodes);
              setMenu(null);
            }}
          />
        ) : (
          <span />
        )}
      </Dropdown>
    </div>
  );
});
