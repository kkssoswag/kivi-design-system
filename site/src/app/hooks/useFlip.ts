import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * 列表里加了、删了一项，别的项从原来的位置滑到新位置（FLIP）：容器里带 `data-flip-key` 的子元素，每次 keys 变了量一遍位置，
 * 挪了的先瞬间放回原处，再过渡回来。屏幕内移动用 ease-in-out；时长 300（移动 100–400px 一档，历史一格 176 + 间距 16）。
 * 「减少动态效果」时 tokens 把时长归零，直接到位。resetKey 变了（比如换了筛选）只记位置不动画。
 * 11-19 用户要的：AI 工具页右侧历史新增任务时，下面的往下顶。
 */
export function useFlip(container: RefObject<HTMLElement | null>, keys: string[], resetKey?: unknown) {
  const prev = useRef(new Map<string, number>());
  const lastReset = useRef(resetKey);
  const signature = keys.join('|');
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const animate = lastReset.current === resetKey;
    lastReset.current = resetKey;
    const next = new Map<string, number>();
    for (const item of Array.from(el.querySelectorAll<HTMLElement>('[data-flip-key]'))) {
      const key = item.dataset.flipKey!;
      const top = item.offsetTop;
      next.set(key, top);
      const before = prev.current.get(key);
      if (!animate || before === undefined || before === top) continue;
      item.style.transition = 'none';
      item.style.transform = `translateY(${before - top}px)`;
      void item.offsetHeight; // 先把「放回原处」画出来，再开过渡
      item.style.transition = 'transform var(--motion-duration-300) var(--motion-ease-in-out)';
      item.style.transform = '';
      item.addEventListener('transitionend', () => (item.style.transition = ''), { once: true });
    }
    prev.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, resetKey]);
}
