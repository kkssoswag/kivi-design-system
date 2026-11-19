import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 等一个动作做完：run(fn) 执行 fn，fn 返回 Promise 时 pending 为 true，等它结束（成功、失败都算）变回 false。
 * fn 不返回 Promise 就不进 pending。生成按钮用：页面的 onSubmit / onClick 返回请求的 Promise，按钮就转圈、不能重复点（11-19 用户要的：慢网时点了生成没反应）
 */
export function usePending() {
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback(<T,>(fn: () => T): T => {
    const result = fn();
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      setPending(true);
      void Promise.resolve(result)
        .catch(() => undefined)
        .finally(() => alive.current && setPending(false));
    }
    return result;
  }, []);
  return [pending, run] as const;
}
