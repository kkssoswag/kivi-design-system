import type { SelectOption } from '@kivi';
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
  { value: 'remove', label: '元素消除', icon: 'RemoveEle' },
];

/** 每个工具一次消耗的猕猴桃，有的看参数 */
export function toolCost(tool: ToolId, st: ToolState): number {
  const table: Record<ToolId, number> = {
    cutout: 2,
    expand: 8,
    hd: st.hdScale === '4' ? 8 : 4,
    edit: 8,
    'video-hd': st.fps > 30 ? 40 : 20,
    loop: 10,
    stitch: 5,
    'video-cutout': 20,
  };
  return table[tool];
}

/** 记进任务的参数，按显示顺序 */
export function toolParams(tool: ToolId, st: ToolState): Record<string, string> {
  switch (tool) {
    case 'expand':
      return { 比例: EXPAND_RATIOS.find((o) => o.value === st.expandRatio)?.label as string };
    case 'hd':
      return { 放大倍数: `${st.hdScale} 倍` };
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
