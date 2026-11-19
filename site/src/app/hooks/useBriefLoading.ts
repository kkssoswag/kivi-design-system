import { useEffect, useState } from 'react';
import { listDelay } from '../data/api';

/**
 * 「首次进入 / 换了条件」的短暂加载：挂上时、key 变了都先是 true，等一会儿（listDelay，慢网更久）变 false。
 * 页面拿它决定要不要画骨架，不自己写计时。skip：这次不用加载（数据刚在本地生成，比如刚新建的对话）
 */
export function useBriefLoading(key: string, skip = false): boolean {
  const [state, setState] = useState({ key, loading: !skip });
  // key 变了：渲染时就回到加载中（不放 effect，免得闪一帧旧内容）
  if (state.key !== key) setState({ key, loading: !skip });
  useEffect(() => {
    if (skip) return;
    const t = window.setTimeout(() => setState((s) => (s.key === key ? { ...s, loading: false } : s)), listDelay());
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.loading;
}
