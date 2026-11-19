import { addNodes, getDoc, makeNode, nodeById, setNodeInputs, setNodeTask, upstreamOf } from './canvas-doc';
import { nearestRatio, ratioNum } from './mock';
import { submitTask } from './tasks';
import type { CanvasDoc, CanvasNode, ClipConfig, PackConfig, Ratio } from './types';
import { archiveFileName, defaultPackConfig, toSeconds } from '../rules/packager';

/*
  处理器节点的命令（视频剪辑、视频封装，照线上 nodes/video-project、nodes/archive）：
  - 从视频节点的工具栏「剪辑」「封装」建：放在视频右边 200、连上线（线上 createSuffixNode）。
  - 弹窗里「合成」「导出」：在处理器右边 200 建结果节点（剪辑 → 视频，封装 → 压缩包 / 视频 / 图片）、连上线，
    走全站假任务（tasks.ts），处理器和结果节点都记这个任务，生成中两个都是忙的。结果由 canvas-doc 的 applyResult 写回。
*/

/** 处理器 / 结果节点离上游的水平间距（照线上 suffix 节点） */
const GAP = 200;

/** 在 node 的右边找个不压别的节点的位置：先放正右边，压了往下挪 */
function spotRight(d: CanvasDoc, from: CanvasNode, size: { w: number; h: number }) {
  const x = from.x + from.w + GAP;
  let y = from.y + from.h / 2 - size.h / 2;
  const hit = (yy: number) => d.nodes.some((n) => n.type !== 'group' && x < n.x + n.w && x + size.w > n.x && yy < n.y + n.h && yy + size.h > n.y);
  for (let i = 0; i < 20 && hit(y); i++) y += size.h + 40;
  return { x, y };
}

/**
 * 视频节点工具栏的「剪辑」「封装」：在它右边建一个处理器节点并连上线（线上 createSuffixNode）。
 * 返回新节点 id；没有可用的源节点返回 undefined
 */
export function addProcessorAfter(canvasId: string, sourceId: string, type: 'clip' | 'pack'): string | undefined {
  const d = getDoc(canvasId);
  const src = nodeById(d, sourceId);
  if (!src || src.type === 'group') return undefined;
  const node = makeNode(type, { x: 0, y: 0 }, type === 'clip' ? { clip: defaultClip() } : { pack: defaultPackConfig() });
  const at = spotRight(d, src, node);
  const [id] = addNodes(canvasId, [{ ...node, ...at }], [{ from: sourceId, to: node.id }]);
  return id;
}

export const defaultClip = (): ClipConfig => ({ order: [], ratio: 'auto', fps: 30 });

// ---------- 视频剪辑 ----------

/** 剪辑能用的素材：连进来的图片、视频、音频，按时间轴顺序（用户排过的顺序在前，新连的接在后面） */
export function clipSources(doc: CanvasDoc, node: CanvasNode): CanvasNode[] {
  const ups = upstreamOf(doc, node.id).filter((n) => n.type === 'image' || n.type === 'video' || n.type === 'audio');
  const order = node.clip?.order ?? [];
  const known = order.map((id) => ups.find((u) => u.id === id)).filter((n): n is CanvasNode => !!n);
  return [...known, ...ups.filter((u) => !order.includes(u.id))];
}

/** 剪辑节点能不能打开：连了素材才行（线上 canOpen） */
export const canOpenClip = (doc: CanvasDoc, node: CanvasNode) => clipSources(doc, node).some((n) => !!n.items?.[0]?.src);

/** 剪辑弹窗里改了设置（顺序、比例、帧率）：节点记住，不进撤销栈 */
export function setClip(canvasId: string, nodeId: string, clip: ClipConfig) {
  setNodeInputs(canvasId, nodeId, { clip });
}

/** 「合成」：在右边建一个视频结果节点，走假任务出成片 */
export async function composeClip(canvasId: string, nodeId: string): Promise<string | undefined> {
  const d = getDoc(canvasId);
  const node = nodeById(d, nodeId);
  if (!node || node.type !== 'clip') return undefined;
  const sources = clipSources(d, node).filter((n) => n.items?.[0]);
  const cfg = node.clip ?? defaultClip();
  // 导出比例：选了就用，「原图比例」按第一个视频、没有视频按第一张图
  const first = sources.find((n) => n.type === 'video') ?? sources.find((n) => n.type === 'image');
  const ratio: Ratio = cfg.ratio === 'auto' ? first?.ratio ?? '16:9' : nearestRatio(ratioNum(cfg.ratio));
  const out = makeNode('video', { x: 0, y: 0 }, { name: node.name, ratio, output: true });
  const task = await submitTask({
    kind: 'tool',
    media: 'video',
    where: { page: 'canvas', canvasId, nodeId: out.id },
    label: '视频剪辑',
    params: { 帧率: `${cfg.fps}fps` },
    refs: sources.filter((n) => n.type !== 'text').map((n) => ({ type: n.type as 'image' | 'video' | 'audio', src: n.items![0].src })),
    ratio,
    cost: 0,
    seconds: Math.max(6, Math.min(30, Math.round(sources.reduce((s, n) => s + (toSeconds(n.items?.[0]?.duration) || 3), 0) / 2))),
  });
  const at = spotRight(getDoc(canvasId), node, out);
  addNodes(canvasId, [{ ...out, ...at, taskId: task.id }], [{ from: nodeId, to: out.id }]);
  setNodeTask(canvasId, [nodeId], task.id);
  return out.id;
}

// ---------- 视频封装 ----------

/** 封装弹窗里改了设置：节点记住，不进撤销栈 */
export function setPack(canvasId: string, nodeId: string, pack: PackConfig) {
  setNodeInputs(canvasId, nodeId, { pack });
}

/** 「导出」：麦圈、礼物、背景出压缩包；自定义按格式出视频（MP4、Mp4-Alpha）或图片（WebP、APng）（照线上 PACKAGER_TEMPLATE_OUTPUT_TYPE_MAP） */
export async function exportPack(canvasId: string, nodeId: string): Promise<string | undefined> {
  const d = getDoc(canvasId);
  const node = nodeById(d, nodeId);
  if (!node || node.type !== 'pack') return undefined;
  const cfg = node.pack ?? defaultPackConfig();
  const ups = upstreamOf(d, nodeId).filter((n) => n.items?.[0]);
  const video = ups.find((n) => n.type === 'video');
  const common = {
    kind: 'tool' as const,
    label: '视频封装',
    params: {},
    refs: ups.map((n) => ({ type: n.type as 'image' | 'video', src: n.items![0].src })),
    cost: 0,
  };
  const ratio: Ratio = video?.ratio ?? '16:9';
  const archive = cfg.template !== 'custom';
  const media = archive ? 'archive' : cfg.format === 'webp' || cfg.format === 'apng' ? 'image' : 'video';
  const out = archive
    ? makeNode('archive', { x: 0, y: 0 }, { name: cfg.name || '视频封装', output: true, archive: { fileName: archiveFileName(cfg) } })
    : makeNode(media === 'image' ? 'image' : 'video', { x: 0, y: 0 }, { name: cfg.name || '视频封装', ratio, output: true });
  // 压缩包不进素材：用文字任务占位（只要倒计时和成功 / 失败），完成时 applyResult 记「导出完成」
  const task = await submitTask(
    archive
      ? { ...common, media: 'text', where: { page: 'canvas', canvasId, nodeId: out.id }, ratio: '1:1', seconds: 6 }
      : { ...common, media: media === 'image' ? 'image' : 'video', where: { page: 'canvas', canvasId, nodeId: out.id }, ratio, seconds: 8 },
  );
  const at = spotRight(getDoc(canvasId), node, out);
  addNodes(canvasId, [{ ...out, ...at, taskId: task.id }], [{ from: nodeId, to: out.id }]);
  setNodeTask(canvasId, [nodeId], task.id);
  return out.id;
}

/** 封装节点能不能打开：连了视频才行（线上 hasVideoInput） */
export const canOpenPack = (doc: CanvasDoc, node: CanvasNode) => upstreamOf(doc, node.id).some((n) => n.type === 'video' && !!n.items?.[0]?.src);
