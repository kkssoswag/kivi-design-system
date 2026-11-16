import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type PointerEvent } from 'react';
import { Icon } from '../Icon';
import { cx } from '../utils';
import { composeHandlers } from '../hooks';
import './asset.css';

export type CreateCardVariant = 'default' | 'canvas';

export interface CreateCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** 文字，比如「新建项目」「创建文件夹」「新建画布」 */
  label: string;
  /**
   * 样式：默认 / 画布，默认是默认。
   * 画布给创作首页「最近项目」的「新建画布」（11-10 用户定，照即梦）：渐变底 + 点阵，正中白色方块里一个加号，
   * 鼠标进来、点下去，点阵从正中荡开一圈冲击波；鼠标附近的点微微亮。图标不变
   */
  variant?: CreateCardVariant;
}

/**
 * 冲击波（11-16 用户定，照 React Bits「Dot Grid」的点击冲击，点不位移、不变大、不加柔光）：
 * 鼠标进卡片、按下时，从卡片正中荡开一圈宽而柔的波，波过处的点变亮（最亮白 40%），越往外越弱，传到 460 停；
 * 鼠标附近 40 以内的点微微亮（跟着鼠标）。冲击半径 460、靠近范围 40 照用户在 Dot Grid 演示页调的；速度、宽度、亮度按用户说的改过。
 * 点阵平时是 CSS 背景画的，动的时候换成画布画（位置、大小、颜色和 CSS 的点重合），停了清掉画布、回到 CSS 背景。
 * 减少动态效果时不动。
 */
const SHOCK = {
  gap: 22, // 点间距，和 CSS 背景一样
  dot: 1.25, // 点半径，和 CSS 背景一样
  travel: 320, // 波每秒走多远（Dot Grid 650，用户要慢一些）
  radius: 460, // 传多远停（用户调的）
  band: 22 * 3, // 波带宽（Dot Grid 一格 × 1.4，用户要宽一些、柔和一些）
  strength: 0.6, // 波峰上的点亮到多少（0–1）
  peak: 0.4, // 最亮时点的透明度（白 40%，用户嫌太白；Figma 没变量）
  proximity: 40, // 鼠标附近多大范围的点会亮（用户调的）
  near: 0.4, // 鼠标附近最亮多少（Dot Grid 原值）
};

const smootherstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function useShock(enabled: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    raf: 0,
    last: 0,
    shocks: [] as Array<{ x: number; y: number; start: number }>,
    pointer: { x: 0, y: 0, inside: false, presence: 0 },
    calm: 0,
  });
  useEffect(() => () => cancelAnimationFrame(state.current.raf), []);

  const frame = (now: number) => {
    const st = state.current;
    st.raf = 0;
    const canvas = canvasRef.current;
    const card = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !card || !ctx) return;
    const w = card.clientWidth;
    const h = card.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0;
    st.last = now;
    const { gap, dot, travel, radius, band, strength, peak, proximity, near } = SHOCK;
    const p = st.pointer;
    p.presence += ((p.inside ? 1 : 0) - p.presence) * (1 - Math.exp(-dt / 0.2));
    // 波走过的距离；传出范围的扔掉
    st.shocks = st.shocks.filter((s) => ((now - s.start) / 1000) * travel < radius + band * 3);
    const active = st.shocks.map((s) => {
      const front = ((now - s.start) / 1000) * travel;
      return { x: s.x, y: s.y, front, power: smootherstep(1 - front / radius) * strength };
    });

    ctx.clearRect(0, 0, w, h);
    if (active.length === 0 && p.presence < 0.001 && !p.inside) {
      card.removeAttribute('data-shocking');
      st.last = 0;
      return;
    }
    card.setAttribute('data-shocking', '');
    ctx.fillStyle = '#fff';
    const calm = st.calm;
    const cx0 = w / 2;
    const cy0 = h / 2;
    const nx = Math.ceil(w / 2 / gap) + 1;
    const ny = Math.ceil(h / 2 / gap) + 1;
    for (let j = -ny; j <= ny; j++) {
      const y = cy0 + j * gap;
      if (y < -gap || y > h + gap) continue;
      for (let i = -nx; i <= nx; i++) {
        const x = cx0 + i * gap;
        if (x < -gap || x > w + gap) continue;
        let energy = 0;
        for (const s of active) {
          if (s.power <= 0) continue;
          const u = (Math.hypot(x - s.x, y - s.y) - s.front) / band;
          if (Math.abs(u) < 3) energy = Math.max(energy, s.power * Math.exp(-u * u));
        }
        if (p.presence > 0.001) {
          const d = Math.hypot(x - p.x, y - p.y);
          if (d < proximity) energy = Math.max(energy, smootherstep(1 - d / proximity) * near * p.presence);
        }
        // 点不变大、不加柔光（用户定），只变亮
        ctx.globalAlpha = calm + (peak - calm) * Math.min(1, energy / strength);
        ctx.beginPath();
        ctx.arc(x, y, dot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    st.raf = requestAnimationFrame(frame);
  };

  const start = () => {
    const st = state.current;
    if (st.raf) return;
    // 平时点的颜色是 border-subtle（白带透明度），取它的透明度
    const canvas = canvasRef.current;
    if (canvas) {
      const m = getComputedStyle(canvas).color.match(/rgba?\(([^)]+)\)/);
      const parts = m ? m[1].split(/[\s,/]+/).filter(Boolean) : [];
      st.calm = parts.length > 3 ? parseFloat(parts[3]) : 1;
    }
    st.raf = requestAnimationFrame(frame);
  };

  // 冲击波都从卡片正中出（用户定）
  const center = (el: HTMLElement) => {
    state.current.shocks.push({ x: el.clientWidth / 2, y: el.clientHeight / 2, start: performance.now() });
  };
  const ok = () => enabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const local = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  return {
    canvasRef,
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (!ok()) return;
      const { x, y } = local(e);
      Object.assign(state.current.pointer, { x, y, inside: true });
      center(e.currentTarget);
      start();
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!ok()) return;
      const { x, y } = local(e);
      Object.assign(state.current.pointer, { x, y, inside: true });
      start();
    },
    onPointerLeave: () => {
      state.current.pointer.inside = false;
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (!ok()) return;
      center(e.currentTarget);
      start();
    },
  };
}

/**
 * 新建卡：画布管理页第一格「新建项目」、资产页文件夹区第一格「创建文件夹」、创作首页「新建画布」。
 * 默认：浅底 + 描边，中间加号 24 和文字 14，悬停底色变亮。大小跟着所在的格子走（11-04 两处统一成一种，线上文件夹那格是虚线）
 */
export const CreateCard = forwardRef<HTMLButtonElement, CreateCardProps>(function CreateCard(
  { label, variant = 'default', type = 'button', className, onPointerEnter, onPointerMove, onPointerLeave, onPointerDown, ...rest },
  ref,
) {
  const canvas = variant === 'canvas';
  const shock = useShock(canvas);
  return (
    <button
      ref={ref}
      type={type}
      className={cx('kv-create-card', canvas && 'kv-create-card--canvas', className)}
      onPointerEnter={composeHandlers(onPointerEnter, canvas ? shock.onPointerEnter : undefined)}
      onPointerMove={composeHandlers(onPointerMove, canvas ? shock.onPointerMove : undefined)}
      onPointerLeave={composeHandlers(onPointerLeave, canvas ? shock.onPointerLeave : undefined)}
      onPointerDown={composeHandlers(onPointerDown, canvas ? shock.onPointerDown : undefined)}
      {...rest}
    >
      {canvas ? (
        <>
          <canvas ref={shock.canvasRef} className="kv-create-card__shock" aria-hidden />
          <span className="kv-create-card__mark" aria-hidden>
            <Icon name="AddSmall" />
          </span>
          <span className="kv-create-card__label">{label}</span>
        </>
      ) : (
        <>
          <Icon name="AddSmall" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
});
CreateCard.displayName = 'CreateCard';
