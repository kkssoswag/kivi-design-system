import type { SkillItem } from '../generation';

/*
  专家：一套系统提示词 + 一组预置技能，用户邀请后 Agent 按这位专家的方法和技能工作。
  专家都是管理后台配的，组件库不带任何专家，演示通过 experts 传进去。
*/

export interface ExpertItem {
  /** 唯一标识 */
  id: string;
  /** 名字，比如「视觉设计专家」 */
  name: string;
  /** 定位：一句话。卡片上两行，选择浮层里一行，专家条在「无需专家」时显示它 */
  description: string;
  /** 头像图。不传就是「无需专家」：用用户自己的头像（圆形 Avatar），没有卡片、没有详情、不能调技能 */
  avatar?: string;
  /** 预置技能：专家默认带的技能，可以为空 */
  skills?: SkillItem[];
  /** 擅长：详情里的一排标签 */
  strengths?: string[];
  /** 试试这样说：详情里的示例提问，最多 3 条 */
  examples?: string[];
}

/** 用户自己：「无需专家」显示用户的头像 */
export interface ExpertUser {
  name: string;
  avatar?: string;
}
