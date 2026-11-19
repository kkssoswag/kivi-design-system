import { MODELS, type SelectOption } from '@kivi';
import type { ToolId } from '../../data/tools';
import type { ToolState } from './types';

/*
  工具参数的选项、消耗、记进任务的参数文字。
*/

export const EXPAND_RATIOS: SelectOption[] = [
  { value: 'free', label: '自由比例', icon: 'AutoAspect' },
  { value: '1:1', label: '1:1', icon: 'Square11' },
  { value: '4:3', label: '4:3', icon: 'Square43' },
  { value: '3:4', label: '3:4', icon: 'Square34' },
  { value: '16:9', label: '16:9', icon: 'Square169' },
  { value: '9:16', label: '9:16', icon: 'Square916' },
];

export const EDIT_MODES: SelectOption[] = [
  { value: 'redraw', label: '智能重绘', icon: 'SmartEditing' },
  { value: 'inpaint', label: '局部重绘', icon: 'Brush' },
  { value: 'remove', label: '元素去除', icon: 'RemoveEle' },
];

/** 智能重绘能选的模型（11-18 用户定只给这两个），选项照生成用的模型表 */
export const EDIT_MODELS: SelectOption[] = MODELS.image.filter((m) => m.value === 'nano-banana-2' || m.value === 'gpt-image-2');

/** 智能编辑提示词最多多少字（照线上） */
export const EDIT_PROMPT_MAX = 2000;
/** 笔刷直径范围和默认值、撤销最多几步 */
export const BRUSH = { min: 10, max: 100, default: 30 };
export const UNDO_STEPS = 30;

/** 视频默认时长（秒）：读不出原视频时长时按它算消耗 */
const DEFAULT_SECONDS = 5;

/** 算消耗要知道的、参数之外的东西 */
export interface CostContext {
  /** 扩图：扩图框面积 / 原图面积 */
  expandArea?: number;
  /** 视频：时长（秒） */
  duration?: number;
}

/** 扩图按扩出来的面积分三档：1K / 2K / 4K */
export function expandTier(area = 1): '1K' | '2K' | '4K' {
  return area <= 1.5 ? '1K' : area <= 3 ? '2K' : '4K';
}

/** 每个工具一次消耗的猕猴桃（示例单价），有的看参数：扩图看面积档，高清修复看倍数，视频高清看分辨率 × 帧率档 × 时长，视频抠图看时长 */
export function toolCost(tool: ToolId, st: ToolState, ctx: CostContext = {}): number {
  const seconds = Math.max(1, Math.ceil(ctx.duration ?? DEFAULT_SECONDS));
  switch (tool) {
    case 'cutout':
      return 2;
    case 'expand':
      return { '1K': 6, '2K': 10, '4K': 16 }[expandTier(ctx.expandArea)];
    case 'hd':
      return st.hdScale === '4' ? 8 : 4;
    case 'edit':
      return 8;
    case 'video-hd': {
      const perSecond = ({ '720P': 1, '1080P': 2, '4K': 5 } as Record<string, number>)[st.videoRes] ?? 2;
      return Math.ceil(perSecond * (st.fps > 30 ? 1.5 : 1) * seconds);
    }
    case 'loop':
      return 10;
    case 'stitch':
      return 5;
    case 'video-cutout':
      return 2 * seconds;
  }
}

/** 记进任务的参数，按显示顺序 */
export function toolParams(tool: ToolId, st: ToolState, ctx: CostContext = {}): Record<string, string> {
  switch (tool) {
    case 'expand':
      return { 比例: EXPAND_RATIOS.find((o) => o.value === st.expandRatio)?.label as string, 分辨率: expandTier(ctx.expandArea) };
    case 'hd':
      return { 放大倍数: `${st.hdScale} 倍` };
    case 'edit':
      return st.editMode === 'redraw' ? { 模型: EDIT_MODELS.find((o) => o.value === st.editModel)?.label as string } : {};
    case 'video-cutout':
      return { 输出模式: st.cutoutOutput === 'mask' ? '蒙版视频' : '透明视频' };
    case 'video-hd':
      return { 分辨率: st.videoRes, 帧速率: `${st.fps}fps` };
    case 'loop':
      return { 过渡时长: st.loop === 'auto' ? '自动' : `${st.loop}s` };
    default:
      return {};
  }
}
