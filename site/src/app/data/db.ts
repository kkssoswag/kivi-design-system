import { createStore, useStore } from './store';
import { ASSETS_SEED } from './seed/assets';
import { CANVAS_SEED } from './seed/canvas';
import { CREATE_SEED } from './seed/create';
import type { Asset, DB } from './types';

/*
  全站一份数据（假后端的「数据库」）。所有页面读它；改它只能通过 data/ 里的动作函数（tasks.ts、assets.ts…）。
  种子数据按页分文件放在 seed/，这里拼起来。存进本机，演示开关里能重置。
*/

/** 改了 DB 的形状或种子数据就加 1，本机存的旧数据作废 */
const VERSION = 6;

/** 初始余额 */
export const INITIAL_BALANCE = 2000;

export const db = createStore<DB>({
  key: 'kivi-app-db',
  version: VERSION,
  init: () => ({
    balance: INITIAL_BALANCE,
    tasks: [...CREATE_SEED.tasks, ...ASSETS_SEED.tasks],
    assets: [...CREATE_SEED.assets, ...ASSETS_SEED.assets],
    folders: ASSETS_SEED.folders,
    chats: CREATE_SEED.chats,
    canvases: CANVAS_SEED.canvases,
    agentTurns: CREATE_SEED.agentTurns,
    // 探索页一开始收藏着的作品（照原来的演示）
    favorites: ['w2', 'w9', 'w15'],
    flags: {},
  }),
  // 本次上传的本地文件刷新后就没了，不存
  save: (s) => ({ ...s, assets: s.assets.filter((a: Asset) => !a.local) }),
});

/** 读一部分数据，见 store.ts 的 useStore 说明 */
export const useDB = <S,>(selector: (s: DB) => S) => useStore(db, selector);

export const useBalance = () => useDB((s) => s.balance);

/** 按 id 找，找不到返回 undefined */
export const byId = <T extends { id: string }>(list: T[], id: string | undefined) => (id ? list.find((x) => x.id === id) : undefined);
