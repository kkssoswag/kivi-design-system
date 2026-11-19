import { ratioNum } from '../data/mock';
import type { CanvasDoc, CanvasNode, CanvasNodeType, Ratio } from '../data/types';

/*
  画布的业务规则（照线上 packages/infinite-canvas，11-18 整理在 page-notes/canvas-rewrite-2026-11-18.md）：
  节点尺寸、连线能不能连、输入上限、组、线上文案。纯函数，不碰界面。
*/

// ---------- 尺寸 ----------

/** 图片、视频按比例，短边 256；文字 256 × 256；音频 341 × 256 */
const SHORT = 256;

export function nodeSize(type: CanvasNodeType, ratio?: Ratio): { w: number; h: number } {
  if (type === 'group') return { w: 560, h: 400 };
  if (type === 'audio') return { w: 341, h: 256 };
  if (type === 'text' || !ratio) return { w: SHORT, h: SHORT };
  const r = ratioNum(ratio);
  return r >= 1 ? { w: Math.round(SHORT * r), h: SHORT } : { w: SHORT, h: Math.round(SHORT / r) };
}

/** 组的内边距：上 80（组名、工具栏）、下 40、左右 65 */
export const GROUP_PAD = { top: 80, bottom: 40, x: 65 };

/** 组的背景色（线上 6 种）：无、青、蓝、紫、橙、黄 */
export const GROUP_COLORS = [
  { value: '', label: '无' },
  { value: '#00cae0', label: '青' },
  { value: '#6c7cff', label: '蓝' },
  { value: '#b866f7', label: '紫' },
  { value: '#ff9330', label: '橙' },
  { value: '#ffd702', label: '黄' },
] as const;

/** 节点的默认名字 */
export const NODE_NAME: Record<CanvasNodeType, string> = {
  text: '文本生成',
  image: '图片生成',
  video: '视频生成',
  audio: '音频生成',
  group: '新建组',
};

// ---------- 视角 ----------

/** 缩放范围（照线上 0.2–8） */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 8;
/** 网格吸附：默认关，开了按 12 跳格；背景点阵 18 */
export const SNAP_GRID = 12;
/** 拖动时对齐辅助线的吸附距离（线上没写，取常见的 6，按屏幕像素） */
export const ALIGN_THRESHOLD = 6;
/** 多个文件拖进来，逐个错开 24 */
export const DROP_STAGGER = 24;
/** 多结果、展开所有图片：2 列，间距 40 */
export const SCATTER_GAP = 40;
/** 排列：横竖间距 150，宫格间距 80、列数 ceil(√n) */
export const ARRANGE_GAP = 150;
export const GRID_GAP = 80;

// ---------- 连线 ----------

type InputKind = 'image' | 'text' | 'video' | 'audio';
/** 每种节点最多接几个上游（照线上 canvas-action-registry：图 / 文 / 视 / 音）。上传的素材节点不接上游 */
const INPUT_LIMITS: Record<Exclude<CanvasNodeType, 'group'>, Record<InputKind, number>> = {
  image: { image: 10, text: 4, video: 0, audio: 0 },
  video: { image: 30, text: 4, video: 10, audio: 10 },
  text: { image: 4, text: 4, video: 1, audio: 0 },
  audio: { image: 1, text: 4, video: 0, audio: 3 },
};

const TYPE_NAME: Record<InputKind, string> = { image: '图片', text: '文本', video: '视频', audio: '音频' };

/** 下游还能不能再接一个这种类型的上游（拖到空白处的添加面板里，超限的类型置灰） */
export function inputRoom(doc: CanvasDoc, to: CanvasNode, kind: InputKind): boolean {
  if (to.type === 'group' || to.upload) return false;
  const used = doc.edges.filter((e) => e.to === to.id).map((e) => doc.nodes.find((n) => n.id === e.from)?.type).filter((t) => t === kind).length;
  return used < INPUT_LIMITS[to.type][kind];
}

/** 从 from 连到 to 行不行：不行返回原因（不能自连、不能成环、组不连、素材节点不接上游、超上限、已经连过） */
export function connectProblem(doc: CanvasDoc, fromId: string, toId: string): string | undefined {
  if (fromId === toId) return '不能连接自己';
  const from = doc.nodes.find((n) => n.id === fromId);
  const to = doc.nodes.find((n) => n.id === toId);
  if (!from || !to || from.type === 'group' || to.type === 'group') return '组不能连线';
  if (to.upload) return '素材节点不能接入上游';
  if (doc.edges.some((e) => e.from === fromId && e.to === toId)) return '已经连过了';
  if (reaches(doc, toId, fromId)) return '不能连成环';
  if (!inputRoom(doc, to, from.type)) {
    const max = INPUT_LIMITS[to.type][from.type];
    return max === 0 ? `${NODE_NAME[to.type]}节点不能接入${TYPE_NAME[from.type]}` : `最多接入 ${max} 个${TYPE_NAME[from.type]}`;
  }
  return undefined;
}

/** 从 a 顺着连线能不能走到 b */
function reaches(doc: CanvasDoc, a: string, b: string): boolean {
  const seen = new Set<string>();
  const stack = [a];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === b) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of doc.edges) if (e.from === id) stack.push(e.to);
  }
  return false;
}

// ---------- 线上文案 ----------

export const CANVAS_TEXT = {
  noSelection: '未选中节点',
  busyCopy: '节点正在执行或上传中无法复制',
  busyDuplicate: '节点正在执行或上传中无法创建副本',
  busyDelete: '节点正在执行或上传中无法删除',
  busyGroup: '节点正在执行或上传中无法打组',
  cannotGroup: '当前选中节点不支持打组',
  pasteOtherSite: '无法从不同站点粘贴节点',
  addedToChat: '已添加到对话',
  copied: '已复制',
  tooManyFiles: (n: number) => `最多上传 ${n} 个文件`,
  badFileType: '当前文件类型不支持上传',
  arrangeNeedTwo: '至少选中 2 个节点',
  emptyHint: ['双击', '画布添加节点'],
  /** 拖连线到空白处松手，添加面板的标题 */
  quoteTitle: '引用该节点生成',
} as const;

/** 一次最多拖进来 / 粘贴几个文件 */
export const CANVAS_MAX_UPLOAD = 20;
