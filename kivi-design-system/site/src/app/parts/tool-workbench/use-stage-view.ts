import { useEffect, useState, type RefObject } from 'react';
import type { CropRect } from '@kivi';

/*
  舞台的缩放和平移：滚轮以鼠标为中心缩放（25%–400%，100% 是刚好放进舞台），拖动工具平移。
  图、扩图框、涂抹层都按算出来的矩形摆，所以缩放不用动它们各自的坐标。
*/

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

interface View {
  z: number;
  ox: number;
  oy: number;
}
const HOME: View = { z: 1, ox: 0, oy: 0 };

export function useStageView(areaRef: RefObject<HTMLElement>, enabled: boolean, resetKey: unknown) {
  const [view, setView] = useState<View>(HOME);
  useEffect(() => setView(HOME), [resetKey]);

  // 滚轮缩放：要能 preventDefault（别让触摸板双指捏合缩放整页），所以不用 React 的 onWheel
  useEffect(() => {
    const el = areaRef.current;
    if (!el || !enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const b = el.getBoundingClientRect();
      const px = e.clientX - b.left;
      const py = e.clientY - b.top;
      setView((v) => {
        const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        let z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * k));
        if (Math.abs(z - 1) < 0.015) z = 1; // 靠近 100% 吸过去
        if (z === 1) return HOME;
        const r = z / v.z;
        return { z, ox: px - (px - v.ox) * r, oy: py - (py - v.oy) * r };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [areaRef, enabled]);

  return {
    z: view.z,
    /** 把放进舞台的基准矩形换成缩放平移后的 */
    apply: (r: CropRect): CropRect => ({ x: r.x * view.z + view.ox, y: r.y * view.z + view.oy, w: r.w * view.z, h: r.h * view.z }),
    pan: (dx: number, dy: number) => setView((v) => ({ ...v, ox: v.ox + dx, oy: v.oy + dy })),
    reset: () => setView(HOME),
  };
}
