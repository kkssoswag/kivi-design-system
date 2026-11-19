import { useEffect, useLayoutEffect, useState, type MutableRefObject } from 'react';
import { listDelay } from '../data/api';

/** 「加载下一屏」的挂钩：外面的滚动区滚到底时调它，由选项卡自己挂上来 */
export type MoreRef = MutableRefObject<(() => void) | undefined>;

/**
 * 一屏一屏往下加载：先显示 size 条，滚到底（外面调 moreRef）出骨架，等一会儿（listDelay）多显示一屏。
 * resetKey 变了（切分类、搜索）回到第一屏
 */
export function usePaged(total: number, size: number, resetKey: string, moreRef: MoreRef) {
  const [count, setCount] = useState(size);
  const [loading, setLoading] = useState(false);
  // 切分类、搜索：渲染时就回到第一屏（不放进 effect：effect 比 ScrollArea 的「到底了」晚跑，会把刚开始的加载清掉）
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setCount(size);
    setLoading(false);
  }
  // 加载中：等一会儿（listDelay）多显示一屏。计时跟着 loading 走，切走、卸载时自己清掉
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => {
      setCount((n) => Math.min(n + size, total));
      setLoading(false);
    }, listDelay());
    return () => window.clearTimeout(t);
  }, [loading, size, total]);
  // 用 layout effect：外面 ScrollArea 挂上、内容变了就量一次「到底了没有」（也是 layout effect，比这里晚跑）。
  // 不满一屏时它马上调「加载下一屏」，这时这里得已经接好，不然第一次落空、高屏幕上一直不满
  useLayoutEffect(() => {
    moreRef.current = () => {
      if (loading || count >= total) return;
      setLoading(true);
    };
  });
  return { count, loading, done: count >= total };
}
