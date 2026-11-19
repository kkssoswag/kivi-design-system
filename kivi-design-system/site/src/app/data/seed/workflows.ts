import { NODE_NAME, nodeSize } from '../../rules/canvas';
import { flowsOf, FLOW_CATEGORIES } from '../catalog';
import { mockOutput, mockText, pic } from '../mock';
import { uid } from '../store';
import type { CanvasNode, CanvasNodeType, Workflow, WorkflowTemplate } from '../types';

/*
  工作流的演示数据：官方工作流（和探索页「工作流」同一批）、我的工作流种子。
  一个工作流就是一段节点和连线（坐标从 0 开始）。不引 canvas-doc / db，免得种子数据绕回任务模块。
*/

/** 和 canvas-doc 的 makeNode 一样：按类型和比例定尺寸、默认名 */
function makeNode(type: CanvasNodeType, at: { x: number; y: number }, extra: Partial<CanvasNode> = {}): CanvasNode {
  const ratio = extra.ratio ?? (type === 'image' ? '1:1' : type === 'video' ? '16:9' : undefined);
  return { id: uid('n'), type, name: NODE_NAME[type], x: at.x, y: at.y, ...nodeSize(type, ratio), ratio, ...extra };
}

const GAP = 140;
const W = 256;

/** 几种节点结构，按序号轮着用；节点都带着结果，预览和应用后看到的一样 */
const SHAPES: ((seed: number, name: string) => WorkflowTemplate)[] = [
  // 文生图：文本 → 图片 4 张
  (s, name) => {
    const text = makeNode('text', { x: 0, y: 0 }, { text: mockText(name) });
    const image = makeNode('image', { x: W + GAP, y: 0 }, { prompt: name, count: '4', items: [0, 1, 2, 3].map((i) => ({ src: pic(s + i) })) });
    return { nodes: [text, image], edges: [{ from: text.id, to: image.id }] };
  },
  // 图生图：参考图 → 图片
  (s, name) => {
    const src = makeNode('image', { x: 0, y: 0 }, { name: '参考图', upload: true, items: [{ src: pic(s) }] });
    const image = makeNode('image', { x: W + GAP, y: 0 }, { prompt: name, items: [{ src: pic(s + 3) }] });
    return { nodes: [src, image], edges: [{ from: src.id, to: image.id }] };
  },
  // 图生视频：参考图 → 视频
  (s, name) => {
    const src = makeNode('image', { x: 0, y: 0 }, { name: '参考图', upload: true, ratio: '16:9', w: 455, h: 256, items: [{ src: pic(s, '16:9') }] });
    const video = makeNode('video', { x: 455 + GAP, y: 0 }, { prompt: name, items: [mockOutput('video', '16:9')] });
    return { nodes: [src, video], edges: [{ from: src.id, to: video.id }] };
  },
  // 首尾帧：首帧、尾帧 → 视频
  (s, name) => {
    const a = makeNode('image', { x: 0, y: 0 }, { name: '首帧', upload: true, items: [{ src: pic(s) }] });
    const b = makeNode('image', { x: 0, y: W + 40 }, { name: '尾帧', upload: true, items: [{ src: pic(s + 4) }] });
    const video = makeNode('video', { x: W + GAP, y: (W + 40) / 2 }, { prompt: name, refMode: 'frames', items: [mockOutput('video', '16:9')] });
    return { nodes: [a, b, video], edges: [{ from: a.id, to: video.id }, { from: b.id, to: video.id }] };
  },
  // 文生图再生视频：文本 → 图片 → 视频
  (s, name) => {
    const text = makeNode('text', { x: 0, y: 0 }, { text: mockText(name) });
    const image = makeNode('image', { x: W + GAP, y: 0 }, { prompt: name, items: [{ src: pic(s + 2) }] });
    const video = makeNode('video', { x: (W + GAP) * 2, y: 0 }, { items: [mockOutput('video', '16:9')] });
    return { nodes: [text, image, video], edges: [{ from: text.id, to: image.id }, { from: image.id, to: video.id }] };
  },
  // 多图参考：两张参考图 + 文本 → 图片
  (s, name) => {
    const a = makeNode('image', { x: 0, y: 0 }, { name: '参考图', upload: true, items: [{ src: pic(s + 1) }] });
    const b = makeNode('image', { x: 0, y: W + 40 }, { name: '参考图', upload: true, items: [{ src: pic(s + 5) }] });
    const text = makeNode('text', { x: 0, y: (W + 40) * 2 }, { text: name });
    const image = makeNode('image', { x: W + GAP, y: W + 40 }, { prompt: name, count: '2', items: [{ src: pic(s + 6) }, { src: pic(s + 7) }] });
    return { nodes: [a, b, text, image], edges: [a, b, text].map((n) => ({ from: n.id, to: image.id })) };
  },
];

/** 第 i 个结构 */
export const templateOf = (i: number, name: string): WorkflowTemplate => SHAPES[i % SHAPES.length](i, name);

/** 官方工作流的分类：「全部」+ 后台配置的分类 */
export const WORKFLOW_CATEGORIES = FLOW_CATEGORIES;

/** 官方工作流：和探索页「工作流」同一批（96 条），节点结构按序号轮着来 */
let officialCache: Workflow[] | undefined;
export function officialWorkflows(): Workflow[] {
  officialCache ??= flowsOf('workflow').map((f, i) => ({
    id: f.id,
    name: f.name,
    cover: f.cover,
    video: f.video,
    category: f.category,
    scope: 'public',
    createdAt: 0,
    template: templateOf(i, f.name),
  }));
  return officialCache;
}

/** 我的工作流的种子：两条 */
export function workflowSeed(): Workflow[] {
  const now = Date.now();
  return [
    { id: 'wf-mine-1', name: '新品主图 4 连', cover: pic(2, '16:9'), scope: 'private', createdAt: now - 86_400_000, template: templateOf(0, '新品主图 4 连') },
    { id: 'wf-mine-2', name: '首帧尾帧转场', cover: pic(5, '16:9'), scope: 'private', createdAt: now - 3 * 86_400_000, template: templateOf(3, '首帧尾帧转场') },
  ];
}

