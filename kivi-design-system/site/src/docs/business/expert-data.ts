import { placeholderImageSrc, type ExpertItem, type SkillItem } from '@kivi';

/*
  专家的演示数据：线上的专家在管理后台配置（名称、头像、定位、擅长、示例提问、系统提示词、预置技能），这里是示例。
  需求见飞书《KIVI PRD｜专家模式》。组件库（kivi/expert）不带任何专家，演示通过 experts 传进去。
  首批四位：通用专家（默认，就是现在的 Agent）、视觉、礼物、品牌。预置技能用户不能增删。
*/

// 预置技能：一位专家一般七八个（11-24 用户说），都带封面
const sk = (id: string, title: string, description: string, category: string, cover: SkillItem['cover']): SkillItem => ({ id, title, description, category, cover });

const VISUAL_SKILLS: SkillItem[] = [
  sk('activity-visual', '活动视觉设计', '需求梳理、主视觉、标题 Logo、页面组件、资源位', '设计', 'kivi-future'),
  sk('template-material', '模板活动素材', '主背景、标题、按钮、礼物容器、弹窗边框五件套', '设计', 'kiwi-light'),
  sk('title-logo', '活动标题 Logo', '按活动主题出标题字效，中英阿三语一套', '设计', 'ip-future'),
  sk('h5-components', 'H5 页面组件', '按需求文档拆页面，出头图、按钮、榜单、规则弹窗', '设计', 'monstera-dots'),
  sk('banner', 'Banner 资源位', '开屏、直播间、首页 Banner 按各尺寸一次出齐', '营销', 'kiwi-glass'),
  sk('i18n', '多语言延展', '一张主视觉换成多语言版本，文字排版跟着调', '设计', 'ip-kiwi-pile'),
  sk('poster', '海报设计', '按主题、尺寸和文案出一组海报，自动排版标题和信息层级', '设计', 'bunny-gouache'),
  sk('social', '社媒配图', '小红书、抖音封面，一次出多个比例', '营销', 'ip-peek'),
];
const GIFT_SKILLS: SkillItem[] = [
  sk('live-gift', '直播礼物设计', '分镜脚本、分镜图、设定图、动效视频、等级规格', '视频', 'ip-gouache'),
  sk('gift-script', '礼物分镜脚本', '按礼物等级写 4–15 秒的分镜，每镜写画面和动效', '视频', 'bunny-gouache'),
  sk('vehicle', '座驾设计', '进场座驾的设定图、三视图和进场动效', '视频', 'ip-future'),
  sk('avatar-frame', '头像框', '按活动主题出静态和动态两版头像框', '设计', 'kiwi-light'),
  sk('mic-ring', '麦圈勋章', '麦位光圈、等级勋章，一套出多个等级', '设计', 'monstera-dots'),
  sk('gift-loop', '礼物循环动效', '静态礼物图做成首尾相接的循环动效', '视频', 'kiwi-glass'),
  sk('gift-spec', '礼物规格检查', '按平台规格检查尺寸、时长、文件大小', '设计', 'ip-kiwi-pile'),
];
const BRAND_SKILLS: SkillItem[] = [
  sk('brand-ip', '品牌与 IP 素材', '品牌 Logo、IP 标准形象、表情与服装规范', '设计', 'ip-peek'),
  sk('logo', 'Logo 设计', '从品牌名和行业出 6 个方向的标志草图', '设计', 'kivi-future'),
  sk('ip', 'IP 形象延展', '上传一张角色图，延展表情包、三视图和动作', '设计', 'ip-gouache'),
  sk('sticker', '表情包', '用 IP 形象做一组 16 个表情，带文字和不带两版', '设计', 'ip-kiwi-pile'),
  sk('outfit', 'IP 换装', '按节日、活动主题给 IP 换一套服装和道具', '设计', 'bunny-gouache'),
  sk('brand-check', '品牌规范检查', '按品牌色、字体和 Logo 用法检查设计稿', '设计', 'kiwi-light'),
  sk('brand-kit', '品牌物料', '名片、工牌、PPT 模板、周边，一套品牌物料', '营销', 'monstera-dots'),
];

/** 通用专家的 id：默认选它；首页横条里没有它；切换器不会建议切到它 */
export const GENERAL_EXPERT = 'general';

export const EXPERTS: ExpertItem[] = [
  { id: GENERAL_EXPERT, name: '通用专家', description: '不限领域，按你的需求直接做', avatar: placeholderImageSrc('kiwi-glass', '1:1') },
  {
    id: 'visual',
    name: '视觉设计专家',
    description: '活动主视觉、标题 Logo、页面组件、资源位，一套做齐',
    avatar: placeholderImageSrc('kivi-future', '1:1'),
    skills: VISUAL_SKILLS,
    strengths: ['活动主视觉', '标题 Logo', 'H5 页面组件', 'Banner 资源位', '多语言延展'],
    examples: ['做一张斋月活动主视觉，面向中东用户', '把这张主视觉延展成开屏和直播间 Banner', '按这份活动需求文档出 H5 页面组件'],
  },
  {
    id: 'gift',
    name: '礼物设计专家',
    description: '直播礼物、座驾、头像框、麦圈，从脚本到动效',
    avatar: placeholderImageSrc('ip-gouache', '1:1'),
    skills: GIFT_SKILLS,
    strengths: ['直播礼物', '座驾', '头像框', '麦圈勋章', '礼物动效'],
    examples: ['做一个 A 级动态礼物：星空旋转木马', '给这个礼物写一版 8 秒的分镜脚本', '把这张静态礼物图做成循环动效'],
  },
  {
    id: 'brand',
    name: '品牌设计专家',
    description: 'Logo 规范、IP 形象延展、品牌物料，守住品牌一致',
    avatar: placeholderImageSrc('ip-peek', '1:1'),
    skills: BRAND_SKILLS,
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
