import { referenceName, type ReferenceStackItem, type ReferenceType } from '../reference/ReferenceStack';
import { VIDEO_FIRST_LAST_ONLY } from './options';

/*
  生成的规则只写这一份（11-17 用户定）：主站输入框 PromptBox 和画布生成面板 NodePanel 都调这里，
  别的地方不再自己拼工具条、自己判断能不能生成。改规则改这里，两边一起变。
*/

/** 主站输入框的任务类型 */
export type GenTask = 'agent' | 'image' | 'video' | 'audio';
/** 画布生成节点的类型：画布有文字节点，没有 Agent */
export type GenNodeType = 'text' | 'image' | 'video' | 'audio';
/** 任务或节点类型 */
export type GenKind = GenTask | GenNodeType;

/** 首尾帧的两张图 */
export interface GenFrames {
  /** 首帧图地址 */
  first?: string;
  /** 尾帧图地址 */
  last?: string;
}

/** 主站输入框的占位文字，跟着任务变 */
export const GEN_PLACEHOLDER: Record<GenTask, string> = {
  agent: '输入想法、剧本或上传参考，支持「/」使用技能，@ 添加主体，和 Agent 一起创作',
  image: '描述你想生成的图片，可以上传参考图',
  video: '描述你想生成的视频，@ 引用参考素材',
  audio: '描述你想生成的声音，或者输入要念的文字',
};

/** 画布生成面板的占位文字 */
export const GEN_NODE_PLACEHOLDER = '描述任何你想要生成的内容';

/**
 * 参考区是不是首尾帧：参考方式选了首尾帧，或者模型只有首尾帧（Veo、Sora…，没有参考方式下拉）。
 * 全能参考、视频编辑、视频延长照线上是同一条参考区
 */
export function isFramesMode(model: string, refMode: string): boolean {
  return VIDEO_FIRST_LAST_ONLY.includes(model) || refMode === 'frames';
}

export interface GenBlockInput {
  /** 任务或节点类型 */
  kind: GenKind;
  /** 提示词 */
  text: string;
  /** 视频模型 */
  model?: string;
  /** 参考方式 */
  refMode?: string;
  /** 参考素材的类型（看有没有视频） */
  referenceTypes?: string[];
  /** 首尾帧的首帧有没有图 */
  hasFirstFrame?: boolean;
}

/**
 * 现在不能生成的原因，能生成返回 undefined（11-17 用户定：置灰 + 悬停说为什么）。
 * 文案照线上的校验：先看素材够不够，再看有没有描述。Agent 没写字只置灰，不说原因（发送按钮）
 */
export function genBlockedReason({ kind, text, model = '', refMode = 'omni', referenceTypes = [], hasFirstFrame }: GenBlockInput): string | undefined {
  if (kind === 'video') {
    if (isFramesMode(model, refMode)) {
      if (!hasFirstFrame) return '请上传首帧图';
    } else if ((refMode === 'edit' || refMode === 'extend') && !referenceTypes.includes('video')) {
      return '请至少上传 1 个视频';
    }
  }
  if (!text.trim()) {
    if (kind === 'audio') return '请输入文字';
    if (kind === 'text' || kind === 'agent') return '请输入内容';
    return '请输入画面描述';
  }
  return undefined;
}

// 生成消耗：示例数字，线上由后端按模型下发。表里没有的，图片 3、视频 60、音频 2、文字 1
const COST: Record<string, number> = {
  'gpt-image-2': 4,
  'nano-banana-pro': 6,
  'nano-banana-2': 3,
  'seedream-5-lite': 2,
  'seedream-4.5': 2,
  'qwen-image-3.0': 2,
  'seedance-2.0': 99,
  'seedance-2.0-fast': 60,
  'seedance-2.5': 120,
  'kling-v3-omni': 110,
  'veo-3.1-fast': 80,
  'sora-2': 90,
};

/** 按任务和模型取消耗（示例数字）。PromptBox、NodePanel 不传 cost 时用它 */
export function genCost(kind: GenKind, model: string): number {
  if (kind === 'audio') return 2;
  if (kind === 'text' || kind === 'agent') return 1;
  return COST[model] ?? (kind === 'image' ? 3 : 60);
}

/** 文件是哪种参考素材 */
export function referenceTypeOf(file: File): ReferenceType {
  return file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
}

/** 秒数写成「5s」「1:05」 */
function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const s = Math.round(sec);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 读视频的第一帧当封面、顺便拿时长；读不出来就不要封面 */
function readVideo(url: string): Promise<{ poster?: string; duration?: string }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    const done = (poster?: string) => resolve({ poster, duration: formatDuration(v.duration) || undefined });
    v.onerror = () => done();
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.1, v.duration || 0);
    };
    v.onseeked = () => {
      try {
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d')?.drawImage(v, 0, 0);
        done(c.toDataURL('image/jpeg', 0.8));
      } catch {
        done();
      }
    };
  });
}

/** 读音频时长 */
function readAudio(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.src = url;
    a.onloadedmetadata = () => resolve(formatDuration(a.duration) || undefined);
    a.onerror = () => resolve(undefined);
  });
}

/**
 * 本地文件变成参考素材：图片直接用本地地址；视频取第一帧当封面、带时长，悬停预览能播；音频带时长、能试听。
 * 名字按类型接着 list 编号（图片1、视频1…）
 */
export async function fileToReference(file: File, list: ReferenceStackItem[]): Promise<ReferenceStackItem> {
  const type = referenceTypeOf(file);
  const url = URL.createObjectURL(file);
  const id = `ref-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const name = referenceName(list, type);
  if (type === 'video') {
    const { poster, duration } = await readVideo(url);
    return { id, type, name, src: poster, video: url, duration };
  }
  if (type === 'audio') return { id, type, name, src: url, duration: await readAudio(url) };
  return { id, type, name, src: url };
}
