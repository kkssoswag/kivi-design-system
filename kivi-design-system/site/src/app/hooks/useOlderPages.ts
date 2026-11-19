import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { listDelay } from '../data/api';

/**
 * 倒着翻页：最新的在下面，往上滚到顶加载更早的一页（创作页记录流）。
 * 一开始只显示最后 size 条；新追加的不影响已显示的范围；更早的加载好后，补滚动位置，视线不跳。
 * 返回 start（从第几条开始显示）、loading（加载中）、loadOlder（外面滚到顶时调）
 */
export function useOlderPages(total: number, size: number, resetKey: string, viewport: RefObject<HTMLElement>) {
  const [start, setStart] = useState(() => Math.max(0, total - size));
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setStart(Math.max(0, total - size));
    setLoading(false);
  }
  const begin = Math.min(start, total);
  const hasMore = begin > 0;
  // 加载前内容多高：加载完用它补滚动位置
  const before = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => {
      before.current = viewport.current?.scrollHeight ?? null;
      setStart((s) => Math.max(0, Math.min(s, total) - size));
      setLoading(false);
    }, listDelay());
    return () => window.clearTimeout(t);
  }, [loading, size, total, viewport]);

  // 新的一页排进去了：顶上多出来的高度补进 scrollTop，看着的那条不动
  useLayoutEffect(() => {
    const el = viewport.current;
    if (el && before.current !== null) el.scrollTop += el.scrollHeight - before.current;
    before.current = null;
  }, [start, viewport]);

  const loadOlder = useCallback(() => {
    if (!loading && hasMore) setLoading(true);
  }, [loading, hasMore]);
  return { start: begin, loading, hasMore, loadOlder };
}
