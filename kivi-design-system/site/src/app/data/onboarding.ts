import { db } from './db';
import { demo, setDemo } from './demo';
import { createStore, useStore } from './store';

/*
  改版后的新手引导（演示站）。分两种人：
  - 新用户（没用过 KIVI）：创作首页先出 Kimo 欢迎，点「带我认识一下」走一遍首页导览（6 步），最后一步把一句示例填进输入框。
  - 老用户（改版前用过）：先出「KIVI 换新了」，说清哪几处变了，点「带我看看」走一遍变了的地方（5 步）。
  两种人之后都一样「边用边教」：对话里 Agent 第一次回完、第一次出生成结果，第一次进画布、画布里第一次等确认，各出一次引导气泡。
  看过没看过记在 db.flags（onboard-*、tip-*），重置演示数据就回到没看过。线上新老用户按改版前有没有生成记录分；演示站在演示开关里切。
  正在走的导览、排队的提示是这次打开的状态，不存。
*/

export type Audience = 'new' | 'old';
/** 边用边教的提示：对话里 Agent 第一次回完 / 第一次出生成结果 / 第一次进画布 / 画布里第一次等确认 */
export type TipId = 'chat-agent' | 'chat-result' | 'canvas' | 'canvas-confirm';

export const INTRO_FLAG = 'onboard-intro';
export const TOUR_FLAG = 'onboard-tour';
const tipFlag = (id: TipId) => `tip-${id}`;

interface GuideState {
  /** 正在走的导览和第几步 */
  tour: Audience | null;
  step: number;
  /** 等着出的提示（按先来后到），正在出的那个和它第几步 */
  pending: TipId[];
  tip: { id: TipId; step: number } | null;
  /** 回创作首页的请求（重看引导时页面不在首页）：变了就回 */
  home: number;
  /** 回到首页后要开始的导览（账号菜单「新手引导」） */
  startAfterHome: Audience | null;
  /** 导览最后一步「填进输入框」：创作首页接住，切到生成 · Agent 填进去 */
  fill: { text: string; key: number } | null;
}

export const guide = createStore<GuideState>({
  init: () => ({ tour: null, step: 0, pending: [], tip: null, home: 0, startAfterHome: null, fill: null }),
});

export const useGuide = <T>(selector: (s: GuideState) => T) => useStore(guide, selector);

export const audienceOf = (): Audience => (demo.get().oldUser ? 'old' : 'new');

const setFlags = (patch: Record<string, boolean>) => db.set((s) => ({ ...s, flags: { ...s.flags, ...patch } }));
export const seen = (key: string) => !!db.get().flags[key];

/** 欢迎 / 换新了：看完（不管点哪个）就不再出 */
export function finishIntro(startTour: boolean) {
  setFlags(startTour ? { [INTRO_FLAG]: true } : { [INTRO_FLAG]: true, [TOUR_FLAG]: true });
  if (startTour) guide.set((s) => ({ ...s, tour: audienceOf(), step: 0 }));
}

export function nextStep(total: number) {
  const { step } = guide.get();
  if (step + 1 < total) guide.set((s) => ({ ...s, step: s.step + 1 }));
  else endTour();
}

export function endTour() {
  setFlags({ [TOUR_FLAG]: true });
  guide.set((s) => ({ ...s, tour: null, step: 0 }));
}

/** 导览最后一步：把示例填进首页输入框 */
export function fillHome(text: string) {
  guide.set((s) => ({ ...s, fill: { text, key: Date.now() } }));
}

/** 页面到了某个时机就叫一声；看过的、已经在排的不再排 */
export function requestTip(id: TipId) {
  if (seen(tipFlag(id))) return;
  const s = guide.get();
  if (s.pending.includes(id) || s.tip?.id === id) return;
  guide.set({ ...s, pending: [...s.pending, id] });
}

export function showTip(id: TipId) {
  guide.set((s) => ({ ...s, pending: s.pending.filter((p) => p !== id), tip: { id, step: 0 } }));
}

/** 提示走完：记下看过 */
export function nextTipStep(total: number) {
  const t = guide.get().tip;
  if (!t) return;
  if (t.step + 1 < total) {
    guide.set((s) => ({ ...s, tip: { id: t.id, step: t.step + 1 } }));
    return;
  }
  setFlags({ [tipFlag(t.id)]: true });
  guide.set((s) => ({ ...s, tip: null }));
}

/** 目标没出来（页面换了、被收起）：先撤掉，下次页面再叫 */
export function dropTip(id: TipId) {
  guide.set((s) => ({ ...s, pending: s.pending.filter((p) => p !== id), tip: s.tip?.id === id ? null : s.tip }));
}

/** 账号菜单「新手引导」：回到创作首页再走一遍导览（不再出欢迎） */
export function replayTour() {
  guide.set((s) => ({ ...s, tip: null, tour: null, step: 0, startAfterHome: audienceOf(), home: Date.now() }));
}

export function startPendingTour() {
  guide.set((s) => (s.startAfterHome ? { ...s, tour: s.startAfterHome, step: 0, startAfterHome: null } : s));
}

/** 演示开关「重看引导」、切新老用户：看过的全清掉，回创作首页从欢迎开始 */
export function resetOnboarding() {
  db.set((s) => ({ ...s, flags: Object.fromEntries(Object.entries(s.flags).filter(([k]) => !k.startsWith('onboard-') && !k.startsWith('tip-'))) }));
  guide.set((s) => ({ ...s, tour: null, step: 0, pending: [], tip: null, startAfterHome: null, fill: null, home: Date.now() }));
}

export function setOldUser(oldUser: boolean) {
  setDemo({ oldUser });
  resetOnboarding();
}
