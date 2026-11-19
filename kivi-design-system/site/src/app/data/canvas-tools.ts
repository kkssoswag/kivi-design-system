import { NODE_NAME, nodeSize } from '../rules/canvas';
import { addNodes, attachTask, getDoc, makeNode, nodeById, requestSelect } from './canvas-doc';
import { nearestRatio } from './mock';
import { submitTask } from './tasks';
import type { CanvasDoc, CanvasNode, Media, Ratio } from './types';

/*
  画布节点工具栏的工具（照线上 nodes/image、nodes/video 的 topbar-content.tsx）：
  点工具 = 在源节点右边 200 建一个工具节点（连着源节点），选中它；
  有的直接执行（抠图），有的在节点下面出参数面板再点生成（高清、循环、视频高清、拼接、视频抠图），
  有的先弹窗编辑再执行（扩图、重绘、元素去除、编辑文字）、有的编辑完直接出图不生成（裁剪）。
  生成走全站的假任务；任务记在节点上，出结果写回这个节点（canvas-doc.ts 的 applyResult）。
*/

/** 工具节点上显示的名字（照线上的工具名） */
export const TOOL_NODE_NAME: Record<string, string> = {
  cutout: '抠图',
  crop: '裁剪',
  expand: '扩图',
  hd: '高清',
  inpaint: '重绘',
  remove: '元素去除',
  'text-edit': '编辑文字',
  loop: '循环',
  'video-hd': '高清',
  stitch: '拼接',
  'video-cutout': '抠图',
};

/** 工具的原图 / 原视频：节点的第一张结果 */
export interface ToolSource {
  media: 'image' | 'video';
  src: string;
  poster?: string;
  ratio: Ratio;
  /** 视频时长（秒） */
  duration?: number;
}

/** '0:05' → 5 */
export function secondsOf(clock?: string): number | undefined {
  if (!clock) return undefined;
  const [m, s] = clock.split(':').map(Number);
  return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : undefined;
}

export function toolSourceOf(node: CanvasNode): ToolSource | undefined {
  const item = node.items?.[0];
  if ((node.type !== 'image' && node.type !== 'video') || !item) return undefined;
  return { media: node.type, src: item.src, poster: item.poster, ratio: node.ratio ?? '1:1', duration: secondsOf(item.duration) };
}

/** 工具节点放在源节点右边 200，顶对齐；右边已经有节点就往下排，避开 */
function suffixSpot(d: CanvasDoc, from: CanvasNode, size: { w: number; h: number }) {
  const x = from.x + from.w + 200;
  let y = from.y;
  const hit = (yy: number) => d.nodes.some((n) => n.type !== 'group' && x < n.x + n.w && x + size.w > n.x && yy < n.y + n.h && yy + size.h > n.y);
  for (let i = 0; i < 40 && hit(y); i++) y += size.h + 40;
  return { x, y };
}

export interface ToolRun {
  /** 工具 id（data/tools.ts），文字编辑写 text-edit */
  tool: string;
  /** 记进任务的名字 */
  label: string;
  params: Record<string, string>;
  cost: number;
  /** 出来的结果大概是什么比例（扩图按扩图框） */
  ratio: Ratio;
  /** 画面不变的工具（抠图、高清…）结果直接用原图 */
  echo: boolean;
  /** 参考：原图 / 原视频，拼接是几段视频 */
  refs: { type: Media; src: string }[];
}

/**
 * 在 from 右边建一个工具节点并连上：
 * - 带 run：先提交任务（余额不足、断网抛 ApiError，这时不建节点），建好的节点直接是生成中；
 * - 不带 run：建一个空的工具节点，选中后在下面出参数面板，点生成再提交。
 */
export async function spawnToolNode(canvasId: string, from: CanvasNode, tool: string, run?: ToolRun, extra: Partial<CanvasNode> = {}): Promise<CanvasNode> {
  const src = toolSourceOf(from);
  const type = from.type === 'video' ? 'video' : 'image';
  const ratio = run?.ratio ?? src?.ratio ?? from.ratio ?? '1:1';
  const size = nodeSize(type, ratio);
  const at = suffixSpot(getDoc(canvasId), from, size);
  const node = makeNode(type, at, { name: TOOL_NODE_NAME[tool] ?? NODE_NAME[type], ratio, tool, ...extra });
  if (run) {
    const task = await submitTask({
      kind: 'tool',
      media: type,
      where: { page: 'canvas', canvasId, nodeId: node.id },
      tool: run.tool,
      label: run.label,
      params: run.params,
      refs: run.refs.map((r) => ({ type: r.type, src: r.src })),
      ratio: run.ratio,
      cost: run.cost,
      echo: run.echo,
    });
    node.taskId = task.id;
  }
  addNodes(canvasId, [node], [{ from: from.id, to: node.id }]);
  requestSelect(canvasId, [node.id]);
  return node;
}

/** 工具节点点生成（面板里）：按上游当参考提交任务，任务记到节点上；再点一次是重新生成，结果换掉 */
export async function runToolNode(canvasId: string, nodeId: string, run: Omit<ToolRun, 'refs' | 'ratio'>) {
  const d = getDoc(canvasId);
  const node = nodeById(d, nodeId);
  if (!node || (node.type !== 'image' && node.type !== 'video')) return;
  const refs = d.edges
    .filter((e) => e.to === nodeId)
    .map((e) => nodeById(d, e.from))
    .filter((n): n is CanvasNode => !!n && (n.type === 'image' || n.type === 'video') && !!n.items?.[0])
    .map((n) => ({ type: n.type as Media, src: n.items![0].src }));
  const ratio = node.ratio ?? '1:1';
  const task = await submitTask({
    kind: 'tool',
    media: node.type,
    where: { page: 'canvas', canvasId, nodeId },
    tool: run.tool,
    label: run.label,
    params: run.params,
    refs,
    ratio,
    cost: run.cost,
    echo: run.echo,
  });
  attachTask(canvasId, nodeId, task.id);
}

/** 图推词 / 视频推词（照线上 handleCreateSuffixTextNode）：右边建一个文本节点连上，带着线上的默认提示词，选中，点生成才出词 */
export const TEXT_FROM_PROMPT = {
  image: '根据图片生成提示词，请用当前输入语言输出',
  video: '根据视频生成故事脚本，请用当前输入语言输出',
} as const;

export function spawnTextNode(canvasId: string, from: CanvasNode): CanvasNode {
  const size = nodeSize('text');
  const at = suffixSpot(getDoc(canvasId), from, size);
  const node = makeNode('text', at, { prompt: from.type === 'video' ? TEXT_FROM_PROMPT.video : TEXT_FROM_PROMPT.image });
  addNodes(canvasId, [node], [{ from: from.id, to: node.id }]);
  requestSelect(canvasId, [node.id]);
  return node;
}

/** 裁剪：按相对原图的框（0–1）真的裁一张出来；图跨域画不了就用原图 */
export async function cropImage(src: string, srcRatio: number, rel: { x: number; y: number; w: number; h: number }): Promise<{ src: string; ratio: Ratio }> {
  const ratio = nearestRatio((srcRatio * rel.w) / rel.h);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    const w = Math.max(1, Math.round(img.naturalWidth * rel.w));
    const h = Math.max(1, Math.round(img.naturalHeight * rel.h));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, img.naturalWidth * rel.x, img.naturalHeight * rel.y, w, h, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) return { src: URL.createObjectURL(blob), ratio: nearestRatio(w / h) };
  } catch {
    /* 画不了就用原图 */
  }
  return { src, ratio };
}

/** 裁剪出来的图：右边一个裁剪节点，没有生成、不消耗（照线上，裁剪是本地处理） */
export function spawnCropNode(canvasId: string, from: CanvasNode, out: { src: string; ratio: Ratio }): CanvasNode {
  const size = nodeSize('image', out.ratio);
  const at = suffixSpot(getDoc(canvasId), from, size);
  const node = makeNode('image', at, { name: TOOL_NODE_NAME.crop, ratio: out.ratio, tool: 'crop', items: [{ src: out.src }] });
  addNodes(canvasId, [node], [{ from: from.id, to: node.id }]);
  requestSelect(canvasId, [node.id]);
  return node;
}
