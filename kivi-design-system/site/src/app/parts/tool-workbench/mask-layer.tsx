import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CropRect } from '@kivi';

/*
  涂抹层：局部重绘、元素消除时在图上涂要改的地方。笔画按图宽的比例记，舞台变大变小都对得上。
*/

export interface Stroke {
  erase: boolean;
  /** 笔刷直径，按图宽的比例记，舞台变大变小都对得上 */
  size: number;
  pts: [number, number][];
}

function drawStrokes(canvas: HTMLCanvasElement, strokes: Stroke[], color: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s.size * w;
    if (s.pts.length === 1) {
      ctx.beginPath();
      ctx.arc(s.pts[0][0] * w, s.pts[0][1] * h, (s.size * w) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function MaskLayer({ rect, strokes, onStroke, erase, size }: {
  rect: CropRect;
  strokes: Stroke[];
  onStroke: (s: Stroke) => void;
  erase: boolean;
  /** 笔刷直径，屏幕像素 */
  size: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef<Stroke | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  // 涂的颜色：品牌色，整层再降到一半透明度，笔画交叠处不叠深
  const color = useRef('#2BFF75');
  useLayoutEffect(() => {
    if (ref.current) color.current = getComputedStyle(ref.current).getPropertyValue('--color-brand-solid').trim() || color.current;
  }, []);

  const redraw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    drawStrokes(c, live.current ? [...strokes, live.current] : strokes, color.current);
  }, [strokes]);
  useEffect(redraw, [redraw, rect.w, rect.h]);

  const point = (e: ReactPointerEvent): [number, number] => {
    const b = ref.current!.getBoundingClientRect();
    return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height];
  };
  return (
    <div className="tpl-at__mask" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      <canvas
        ref={ref}
        width={Math.round(rect.w * dpr)}
        height={Math.round(rect.h * dpr)}
        aria-label={erase ? '橡皮' : '涂抹要修改的地方'}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          live.current = { erase, size: size / rect.w, pts: [point(e)] };
          redraw();
        }}
        onPointerMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          setCursor({ x: e.clientX - b.left, y: e.clientY - b.top });
          if (!live.current) return;
          live.current.pts.push(point(e));
          redraw();
        }}
        onPointerUp={() => {
          if (live.current) onStroke(live.current);
          live.current = null;
        }}
        onPointerLeave={() => setCursor(null)}
      />
      {cursor && <span className="tpl-at__brush" style={{ left: cursor.x, top: cursor.y, width: size, height: size }} />}
    </div>
  );
}
