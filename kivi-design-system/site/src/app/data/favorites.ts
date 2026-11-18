import { request } from './api';
import { db, useDB } from './db';

/*
  探索页的收藏（作品、技能、工作流 id），存在 db.favorites。
  照素材收藏先变后请求（乐观更新），请求失败退回原样再抛错。
*/

const setLocal = (id: string, on: boolean) =>
  db.set((s) => {
    const has = s.favorites.includes(id);
    if (has === on) return s;
    return { ...s, favorites: on ? [...s.favorites, id] : s.favorites.filter((x) => x !== id) };
  });

/** 收藏 / 取消收藏。传 on 就设成这个值，不传就翻转 */
export async function toggleFavorite(id: string, on?: boolean) {
  const before = db.get().favorites.includes(id);
  const next = on ?? !before;
  setLocal(id, next);
  try {
    await request(() => undefined);
  } catch (e) {
    setLocal(id, before);
    throw e;
  }
}

/** 收藏了的 id 列表 */
export const useFavorites = () => useDB((s) => s.favorites);
