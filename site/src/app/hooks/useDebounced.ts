import { useEffect, useState } from 'react';

/** 停下来 delay 毫秒后才变的值：搜索框打完字停 0.5 秒再搜（需求） */
export function useDebounced<T>(value: T, delay = 500) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}
