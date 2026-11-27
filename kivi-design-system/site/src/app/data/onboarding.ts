import { db } from './db';
import { createStore, useStore } from './store';

/*
  改版后的新手引导（演示站），新老用户一套：
  - 第一次打开先出 Kimo 欢迎：「开始」或「跳过引导」（跳过后哪一章都不再出）。
  - 之后按页面分章，第一次到哪讲哪：创作首页、画布。分章导览压暗页面、只亮出讲的那块。
    另有几条不压暗的小提示：画布里选中的节点有参考素材、画布里第一次等确认、AI 工具历史里第一次有图片。
  - 页面到了时机就 requestChapter，看过的、跳过的不再出；目标找不到（换页了）就先不算看过，下次再到这页还会出。
  - 看过没看过记在 db.flags（guide-*），重置演示数据就回到没看过。账号菜单「新手引导」把各章清掉、回首页重讲。
  正在讲的章、排队的章是这次打开的状态，不存。每章讲什么在 parts/onboarding/steps.ts。
*/

export type ChapterId = 'home' | 'canvas' | 'canvas-refs' | 'canvas-confirm' | 'tools';
export type HomeMode = 'generate' | 'canvas';

export const INTRO_FLAG = 'guide-intro';
/** 欢迎里点了「跳过引导」：哪一章都不再出 */
const OFF_FLAG = 'guide-off';
const chapterFlag = (id: ChapterId) => `guide-${id}`;

interface GuideState {
  /** 等着讲的章（按先来后到） */
  pending: ChapterId[];
  /** 正在讲的章、第几步、有没有真的出过（一步都没出就结束的不算看过） */
  run: { id: ChapterId; step: number; shown: boolean } | null;
  /** 回创作首页的请求（重看引导时页面不在首页）：变了就回 */
  home: number;
  /** 首页这一章要停在「生成」还是「画布」：创作首页接住 */
  homeMode: { mode: HomeMode; key: number } | null;
}

export const guide = createStore<GuideState>({
  init: () => ({ pending: [], run: null, home: 0, homeMode: null }),
});

export const useGuide = <T>(selector: (s: GuideState) => T) => useStore(guide, selector);

const flags = () => db.get().flags;
const setFlags = (patch: Record<string, boolean>) => db.set((s) => ({ ...s, flags: { ...s.flags, ...patch } }));

/** 页面到了某个时机叫一声：看过的、跳过引导的、已经在排的不再排 */
export function requestChapter(id: ChapterId) {
  const f = flags();
  if (f[OFF_FLAG] || f[chapterFlag(id)]) return;
  const s = guide.get();
  if (s.pending.includes(id) || s.run?.id === id) return;
  guide.set({ ...s, pending: [...s.pending, id] });
}

/** 欢迎：「开始」接着讲排着的章；「跳过引导」以后都不出 */
export function finishIntro(start: boolean) {
  setFlags(start ? { [INTRO_FLAG]: true } : { [INTRO_FLAG]: true, [OFF_FLAG]: true });
  if (!start) guide.set((s) => ({ ...s, pending: [], run: null }));
}

export function startChapter(id: ChapterId, mode?: HomeMode) {
  guide.set((s) => ({
    ...s,
    pending: s.pending.filter((p) => p !== id),
    run: { id, step: 0, shown: false },
    homeMode: mode ? { mode, key: Date.now() } : s.homeMode,
  }));
}

/** 这一步出来了 */
export function markShown() {
  guide.set((s) => (s.run && !s.run.shown ? { ...s, run: { ...s.run, shown: true } } : s));
}

/** 下一步；最后一步走完就结束这一章 */
export function nextStep(total: number) {
  const r = guide.get().run;
  if (!r) return;
  if (r.step + 1 < total) guide.set((s) => ({ ...s, run: { ...r, step: r.step + 1 } }));
  else endChapter();
}

/** 结束这一章（看完或跳过）：出过就记下看过 */
export function endChapter() {
  const r = guide.get().run;
  if (!r) return;
  if (r.shown) setFlags({ [chapterFlag(r.id)]: true });
  guide.set((s) => ({ ...s, run: null }));
}

/** 账号菜单「新手引导」：各章清掉，回创作首页从首页这一章讲起（不再出欢迎） */
export function replayGuide() {
  db.set((s) => ({ ...s, flags: Object.fromEntries(Object.entries(s.flags).filter(([k]) => !k.startsWith('guide-') || k === INTRO_FLAG)) }));
  guide.set((s) => ({ ...s, pending: ['home'], run: null, home: Date.now() }));
}

/** 演示开关「重看新手引导」：全部清掉，从欢迎开始 */
export function resetGuide() {
  db.set((s) => ({ ...s, flags: Object.fromEntries(Object.entries(s.flags).filter(([k]) => !k.startsWith('guide-'))) }));
  guide.set((s) => ({ ...s, pending: ['home'], run: null, home: Date.now() }));
}
