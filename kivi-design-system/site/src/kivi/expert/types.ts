import type { SkillItem } from '../generation';

/*
  专家：一套系统提示词 + 一组预置技能，用户邀请后 Agent 按这位专家的方法和技能工作。
  第一个一般是「通用专家」（默认，就是现在的 Agent，不挂预置技能）。技能都是后台配好的，用户不能增删。
  专家都是管理后台配的，组件库不带任何专家，演示通过 experts 传进去。
*/

export interface ExpertItem {
  /** 唯一标识 */
  id: string;
  /** 名字，比如「视觉设计专家」 */
  name: string;
  /** 定位：一句话，选择浮层里一行 */
  description: string;
  /** 头像图：专家条、选择浮层、首页横条、详情、对话记录共用 */
  avatar: string;
  /** 预置技能：专家默认带的技能，可以为空，只在详情里只读展示 */
  skills?: SkillItem[];
  /** 擅长：详情里的一排标签，切换卡也用它说明为什么更适合 */
  strengths?: string[];
  /** 试试这样说：详情里的示例提问，最多 3 条 */
  examples?: string[];
}

/** 有没有详情可看：擅长、示例提问、预置技能都没有的（通用专家）不出「详情」 */
export const hasExpertDetail = (e: ExpertItem) => !!(e.strengths?.length || e.examples?.length || e.skills?.length);
