import { placeholderImageSrc, type ExpertItem, type SkillItem } from '@kivi';

/*
  专家的演示数据：线上的专家在管理后台配置（名称、头像、定位、擅长、示例提问、系统提示词、预置技能），这里是示例。
  需求见飞书《KIVI PRD｜专家模式》。组件库（kivi/expert）不带任何专家，演示通过 experts 传进去。
  首批四位：通用专家（默认，就是现在的 Agent）、视觉、礼物、品牌。预置技能用户不能增删。
*/

const ACTIVITY: SkillItem = { id: 'activity-visual', title: '活动视觉设计', description: '需求梳理、主视觉、标题 Logo、页面组件、资源位', category: '设计', recommended: true };
const TEMPLATE: SkillItem = { id: 'template-material', title: '模板活动素材', description: '主背景、标题、按钮、礼物容器、弹窗边框五件套', category: '设计' };
const GIFT: SkillItem = { id: 'live-gift', title: '直播礼物设计', description: '分镜脚本、分镜图、设定图、动效视频、等级规格', category: '视频', recommended: true };
const BRAND: SkillItem = { id: 'brand-ip', title: '品牌与 IP 素材', description: '品牌 Logo、IP 标准形象、表情与服装规范', category: '设计', recommended: true };

/** 通用专家的 id：默认选它；首页横条里没有它；切换器不会建议切到它 */
export const GENERAL_EXPERT = 'general';

export const EXPERTS: ExpertItem[] = [
  { id: GENERAL_EXPERT, name: '通用专家', description: '不限领域，按你的需求直接做', avatar: placeholderImageSrc('kiwi-glass', '1:1') },
  {
    id: 'visual',
    name: '视觉设计专家',
    description: '活动主视觉、标题 Logo、页面组件、资源位，一套做齐',
    avatar: placeholderImageSrc('kivi-future', '1:1'),
    skills: [ACTIVITY, TEMPLATE],
    strengths: ['活动主视觉', '标题 Logo', 'H5 页面组件', 'Banner 资源位', '多语言延展'],
    examples: ['做一张斋月活动主视觉，面向中东用户', '把这张主视觉延展成开屏和直播间 Banner', '按这份活动需求文档出 H5 页面组件'],
  },
  {
    id: 'gift',
    name: '礼物设计专家',
    description: '直播礼物、座驾、头像框、麦圈，从脚本到动效',
    avatar: placeholderImageSrc('ip-gouache', '1:1'),
    skills: [GIFT],
    strengths: ['直播礼物', '座驾', '头像框', '麦圈勋章', '礼物动效'],
    examples: ['做一个 A 级动态礼物：星空旋转木马', '给这个礼物写一版 8 秒的分镜脚本', '把这张静态礼物图做成循环动效'],
  },
  {
    id: 'brand',
    name: '品牌设计专家',
    description: 'Logo 规范、IP 形象延展、品牌物料，守住品牌一致',
    avatar: placeholderImageSrc('ip-peek', '1:1'),
    skills: [BRAND],
    strengths: ['Logo 规范', 'IP 形象延展', '表情与服装', '品牌物料'],
    examples: ['用 Dobi 和 Dori 做一组新年表情', '给 Toppy 换一套足球主题服装', '检查这张图里的 Logo 用法对不对'],
  },
];

export const expertOf = (id: string) => EXPERTS.find((e) => e.id === id) ?? EXPERTS[0];

/**
 * 切换器判断「需求不对口」用的关键词（演示用：线上是模型按后台配的定位、擅长、示例提问判断）。
 * 通用专家没有关键词：什么需求都不算不对口，但需求明显属于某位专家时也会建议切
 */
export const EXPERT_KEYWORDS: Record<string, string[]> = {
  visual: ['主视觉', 'Banner', '海报', '页面', '资源位', '活动'],
  gift: ['礼物', '座驾', '头像框', '麦圈', '动效'],
  brand: ['Logo', 'logo', '品牌', 'IP', '表情', '服装', 'Dobi', 'Dori', 'Toppy'],
};

/** 切换器的建议：更对口的专家 + 需求里命中的词（说明为什么） */
export interface ExpertSuggestion {
  expert: ExpertItem;
  words: string[];
}

/**
 * 这句话更适合哪位专家：当前专家的词一个都没命中、别的专家命中了才算；几位都命中取命中最多的。
 * declined 是这段对话里用户选过「不换」的专家，不再建议
 */
export function suggestExpert(current: string, text: string, declined: string[] = []): ExpertSuggestion | undefined {
  // 命中的词按在这句话里出现的先后排（说明里照这个顺序写）
  const hits = (id: string) => (EXPERT_KEYWORDS[id] ?? []).filter((w) => text.includes(w)).sort((x, y) => text.indexOf(x) - text.indexOf(y));
  if (hits(current).length) return undefined;
  let best: ExpertSuggestion | undefined;
  for (const id of Object.keys(EXPERT_KEYWORDS)) {
    if (id === current || declined.includes(id)) continue;
    const words = hits(id);
    if (words.length > (best?.words.length ?? 0)) best = { expert: expertOf(id), words };
  }
  return best;
}
