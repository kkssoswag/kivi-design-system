import { placeholderImageSrc, type ExpertItem, type SkillItem } from '@kivi';
import { SKILL_ITEMS } from './skill-data';

/*
  专家的演示数据：线上的专家在管理后台配置（名称、头像、定位、擅长、示例提问、系统提示词、预置技能），这里是示例。
  需求见飞书《KIVI PRD｜专家模式》。组件库（kivi/expert）不带任何专家，演示通过 experts 传进去。
*/

/** 专家的预置技能：也能在专家技能面板里添加 */
const ACTIVITY: SkillItem = { id: 'activity-visual', title: '活动视觉设计', description: '需求梳理、主视觉、标题 Logo、页面组件、资源位', category: '设计', recommended: true };
const TEMPLATE: SkillItem = { id: 'template-material', title: '模板活动素材', description: '主背景、标题、按钮、礼物容器、弹窗边框五件套', category: '设计' };
const GIFT: SkillItem = { id: 'live-gift', title: '直播礼物设计', description: '分镜脚本、分镜图、设定图、动效视频、等级规格', category: '视频', recommended: true };
const BRAND: SkillItem = { id: 'brand-ip', title: '品牌与 IP 素材', description: '品牌 Logo、IP 标准形象、表情与服装规范', category: '设计', recommended: true };

/** 专家技能面板里能添加的技能：专家的预置技能 + 技能面板的示例技能 */
export const EXPERT_SKILL_ITEMS: SkillItem[] = [ACTIVITY, TEMPLATE, GIFT, BRAND, ...SKILL_ITEMS];

/** 第一个是「无需专家」：不传头像，用用户自己的 */
export const EXPERTS: ExpertItem[] = [
  { id: 'none', name: '无需专家', description: '你来主导，按指令直接执行' },
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
    id: 'game',
    name: '游戏设计专家',
    description: '角色、道具、场景、游戏 UI，一套世界观出齐',
    avatar: placeholderImageSrc('monstera-dots', '1:1'),
    skills: [],
    strengths: ['角色', '道具', '场景', '游戏 UI 与图标', '宣传图'],
    examples: ['设计一个 Q 版法师角色，出三视图', '按这个世界观出 6 个道具图标', '画一张森林关卡的场景概念图'],
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

/** 演示用的用户：「无需专家」显示用户自己的头像 */
export const EXPERT_USER = { name: 'KIVI', avatar: placeholderImageSrc('ip-peek', '1:1') };

/**
 * 模板里判断「需求不对口」用的关键词（演示用：线上是专家自己判断）。
 * 发出去的话里有别的专家的词、没有当前专家的词，就问要不要换
 */
export const EXPERT_KEYWORDS: Record<string, string[]> = {
  visual: ['主视觉', 'Banner', '海报', '页面', '资源位', '活动'],
  gift: ['礼物', '座驾', '头像框', '麦圈', '动效'],
  game: ['游戏', '角色', '道具', '场景', '关卡'],
  brand: ['Logo', 'logo', '品牌', 'IP', '表情', 'Dobi', 'Dori', 'Toppy'],
};

/** 这句话更适合哪位专家：当前专家的词没命中、别的专家命中了才算；无需专家不问 */
export function suggestExpert(current: string, text: string): ExpertItem | undefined {
  if (current === 'none') return undefined;
  const hit = (id: string) => (EXPERT_KEYWORDS[id] ?? []).some((w) => text.includes(w));
  if (hit(current)) return undefined;
  const other = Object.keys(EXPERT_KEYWORDS).find((id) => id !== current && hit(id));
  return other ? expertOf(other) : undefined;
}
