/*
  画布「对口型」节点的规则（照线上 growth-tool-panel、node-execution-validation）。纯函数 / 常量，不碰界面。
  线上是视频节点的一种预设：只收一段视频、一段音频，没有提示词和模型，生成时才校验时长。
*/

/** 音频、视频时长范围（秒） */
export const LIP_DURATION = { min: 1, max: 240 } as const;
/** 两段时长（各自向下取整）最多差几秒 */
export const LIP_GAP_MAX = 1;
/** 演示价：每秒音频 1 个猕猴桃 */
export const LIP_COST_PER_SECOND = 1;

export const LIP_TEXT = {
  /** 节点默认标题 */
  title: 'AI对口型',
  /** 面板两个格子的名字，也是角标 */
  audio: '音频',
  video: '视频',
  needBoth: '请连接音频和视频',
  range: `音频、视频时长需在 ${LIP_DURATION.min}-${LIP_DURATION.max}s`,
  gap: `音频与视频时长相差不能超过 ${LIP_GAP_MAX}s`,
} as const;

/** 一次消耗的猕猴桃：按音频时长，每秒 1 个，向上取整，至少 1；读不到时长按 1 */
export function lipCost(audioSeconds?: number): number {
  return Math.max(1, Math.ceil((audioSeconds ?? 0) * LIP_COST_PER_SECOND));
}

/** 生成前校验：不行返回原因。读不到时长（undefined）就跳过时长的校验 */
export function lipProblem(p: { hasAudio: boolean; hasVideo: boolean; audio?: number; video?: number }): string | undefined {
  if (!p.hasAudio || !p.hasVideo) return LIP_TEXT.needBoth;
  const known = [p.audio, p.video].filter((s): s is number => s != null);
  if (known.some((s) => s < LIP_DURATION.min || s > LIP_DURATION.max)) return LIP_TEXT.range;
  if (p.audio != null && p.video != null && Math.abs(Math.floor(p.audio) - Math.floor(p.video)) > LIP_GAP_MAX) return LIP_TEXT.gap;
  return undefined;
}
