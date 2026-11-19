import { forwardRef, useEffect, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { useMergedRef } from '../hooks';
import { cx } from '../utils';
import faceClosedSvg from './assets/face-closed.svg?raw';
import styleCSvg from './assets/style-c.svg?raw';
import './kimo.css';

/*
  Kimo：KIVI 的 IP 形象（戴尖帽、拿魔法杖的猕猴桃）。
  源码和矢量来自 KIVI IP Motion Lab（https://kivi-ip-motion-lab.immichelle109.chatgpt.site，我们自己做的，11-18 用户给），
  这里原样搬了它的骨骼和待机动效，只留用户要的：风格三「模糊发光」（style-c）、待机（悬浮呼吸、眨眼、眼睛跟着鼠标、绒毛轻摆）。
  招呼、思考、开心、施法这些动作先不搬。系统开了减少动态效果时停在第一帧。
*/

const NS = 'http://www.w3.org/2000/svg';
/** 原图 154 × 153，按 153 缩放到 size */
const ART = 153;

type Pt = [number, number];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
/** 关键帧曲线（原站 curve）：两帧之间余弦缓动 */
function curve(t: number, keys: Pt[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], ease((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
}

/** 沿路径取点（原站 motion-geometry samplePath，开放路径版） */
function sampleLine(path: SVGPathElement, count: number): Pt[] {
  const length = path.getTotalLength();
  const points = Array.from({ length: count }, (_, i): Pt => {
    const p = path.getPointAtLength((length * i) / (count - 1));
    return [p.x, p.y];
  });
  if (points[0][1] > points[count - 1][1] && Math.abs(points[0][0] - points[count - 1][0]) < 5) points.reverse();
  return points;
}
const pathFromPoints = (points: Pt[]) => points.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(3) + ' ' + y.toFixed(3)).join(' ');

/** 绒毛的 6 个受力点（原站 furPath 的 tufts）：x、y、影响半径 x、y、推的方向 x、y */
const TUFTS = [
  [141, 76, 15, 12, 1, 0.35],
  [132, 103, 12, 11, 0.8, 0.5],
  [124, 54, 12, 12, 0.5, -0.5],
  [18, 86, 10, 12, -1, -0.2],
  [17, 109, 15, 12, -1, 0.4],
  [40.5, 130, 10, 12, -0.3, 1],
];
/** 按受力点把路径上的点推一推（只认 M L C H V Z 绝对坐标，原图都是这几种） */
function furPath(source: string, amounts: number[]): string {
  const tokens = source.match(/[MLCHVZ]|-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: string[] = [];
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let i = 0;
  const warp = (x: number, y: number): Pt =>
    TUFTS.reduce<Pt>((p, t, j) => {
      const influence = Math.exp(-(((x - t[0]) / t[2]) ** 2 + ((y - t[1]) / t[3]) ** 2));
      return [p[0] + influence * amounts[j] * t[4], p[1] + influence * amounts[j] * t[5]];
    }, [x, y]);
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) {
      cmd = tokens[i++];
      out.push(cmd);
      if (cmd === 'Z') continue;
    }
    if (cmd === 'H') {
      cx = Number(tokens[i++]);
      out.push(warp(cx, cy)[0].toFixed(3));
    } else if (cmd === 'V') {
      cy = Number(tokens[i++]);
      out.push(warp(cx, cy)[1].toFixed(3));
    } else {
      const n = cmd === 'C' ? 3 : 1;
      for (let j = 0; j < n; j++) {
        const x = Number(tokens[i++]);
        const y = Number(tokens[i++]);
        const p = warp(x, y);
        out.push(p[0].toFixed(3), p[1].toFixed(3));
        if (j === n - 1) {
          cx = x;
          cy = y;
        }
      }
    }
  }
  return out.join(' ');
}

const byId = (root: Element, id: string) => [...root.querySelectorAll('[id]')].find((n) => n.id === id);
function group(parent: Element, name: string) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-part', name);
  parent.append(g);
  return g;
}

let instances = 0;

interface Pose {
  y: number;
  rot: number;
  sx: number;
  sy: number;
  wand: number;
  hat: number;
  blink: number;
  lookX: number;
  lookY: number;
  fur: number[];
}

/** 搭骨骼（原站 rig('style-c')）：原图的路径、颜色、滤镜都不动，只把要动的层重新分组：身体 → 脸 → 帽子 → 魔法杖 */
function buildRig() {
  const svg = new DOMParser().parseFromString(styleCSvg, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
  const frame = svg.firstElementChild!;
  frame.removeAttribute('clip-path');
  // 原图画板的深色底不要
  for (const n of [...frame.children]) if (n.tagName.toLowerCase() === 'rect' && n.getAttribute('fill') === '#0F1115') n.remove();
  const wand = byId(frame, 'Group 2');
  // 帽子和帽子上的高光（Mask group）一起转
  let hat: Element | undefined = byId(frame, 'Vector_5');
  const highlights = byId(frame, 'Mask group');
  if (hat && highlights) {
    const artwork = group(frame, 'hat-artwork');
    frame.insertBefore(artwork, hat);
    artwork.append(hat, highlights);
    hat = artwork;
  }
  const mouth = byId(frame, 'Group');
  const eyeNodes = [byId(frame, 'Vector_3'), byId(frame, 'Vector_4')].filter((n): n is SVGPathElement => !!n);
  const master = group(svg, 'master');
  const body = group(master, 'body');
  // 张嘴的那层待机用不上（原站待机是闭嘴）：去掉，换成闭嘴的脸
  mouth?.remove();
  for (const n of [...frame.children]) if (n !== wand && n !== hat && !eyeNodes.includes(n as SVGPathElement)) body.append(n);
  const face = group(master, 'face');
  const closed = group(face, 'face-closed');
  closed.setAttribute('transform', 'translate(46.5 77.5)');
  const faceDoc = new DOMParser().parseFromString(faceClosedSvg, 'image/svg+xml').documentElement;
  for (const n of [...faceDoc.children]) closed.append(n);
  for (const eye of eyeNodes) face.append(eye);
  if (hat) {
    hat.setAttribute('data-part', 'hat');
    master.append(hat);
  }
  if (wand) {
    wand.setAttribute('data-part', 'wand-and-hand');
    master.append(wand);
  }
  frame.remove();
  // 一页里几个 Kimo：id 和 url(#…) 加前缀，滤镜、渐变不串
  const unique = `kimo${++instances}-`;
  for (const n of [svg, ...svg.querySelectorAll('*')])
    for (const attr of [...n.attributes]) {
      if (attr.name === 'id') n.setAttribute('id', unique + attr.value);
      else if (attr.value.includes('url(#')) n.setAttribute(attr.name, attr.value.replace(/url\(#([^)]*)\)/g, `url(#${unique}$1)`));
    }
  svg.setAttribute('aria-hidden', 'true');
  svg.style.overflow = 'visible';

  const eyes = eyeNodes.map((n) => ({ node: n, points: sampleLine(n, 20) }));
  const furLayers = [...body.querySelectorAll('path')].map((node) => ({ node, d: node.getAttribute('d') ?? '' }));
  const rotate = (n: Element | undefined, deg: number, x: number, y: number) => n?.setAttribute('transform', `rotate(${deg} ${x} ${y})`);

  const draw = (p: Pose) => {
    master.setAttribute('transform', `translate(0 ${p.y}) translate(77 94) rotate(${p.rot}) scale(${p.sx} ${p.sy}) translate(-77 -94)`);
    rotate(hat, p.hat, 65, 64);
    rotate(wand, p.wand, 118, 119);
    face.setAttribute('transform', `translate(${p.lookX} ${p.lookY})`);
    // 眨眼：眼睛的线往中间压扁
    for (const { node, points } of eyes) {
      const mid = points.reduce((v, q) => v + q[1], 0) / points.length;
      node.setAttribute('d', pathFromPoints(points.map(([x, y]): Pt => [x, mid + (y - mid) * Math.max(0.04, p.blink)])));
    }
    for (const layer of furLayers) layer.node.setAttribute('d', furPath(layer.d, p.fur));
  };
  return { svg, draw };
}

/** 弹簧（原站 spring）：每个量追着目标值走，动作之间不跳 */
function makeSprings() {
  const s: Record<string, { v: number; vel: number }> = {};
  return (key: string, target: number, dt: number, k = 145, damping = 22) => {
    const st = (s[key] ??= { v: target, vel: 0 });
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      st.vel += (k * (target - st.v) - damping * st.vel) * h;
      st.v += st.vel * h;
    }
    return st.v;
  };
}

export interface KimoProps extends HTMLAttributes<HTMLDivElement> {
  /** 边长（像素），默认 216（原站首页大小） */
  size?: number;
  /** 下面的影子，默认有 */
  shadow?: boolean;
}

/** Kimo 待机：悬浮呼吸、眨眼、眼睛跟着鼠标、绒毛轻摆（原站 pose 的 idle 分支，数值原样） */
export const Kimo = forwardRef<HTMLDivElement, KimoProps>(function Kimo({ size = 216, shadow = true, className, style, ...rest }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const merged = useMergedRef(ref, hostRef);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stage = host.querySelector<HTMLElement>('.kv-kimo__rig')!;
    const rig = buildRig();
    stage.replaceChildren(rig.svg);
    const spring = makeSprings();
    const mouse = { x: 0, y: 0 };
    let clock = 0;
    let last = performance.now();
    let seedBlink = 3.5;
    let blinkStart = -10;
    let frame = 0;

    const pose = (time: number, dt: number): Pose => {
      const phase = (time * 2 * Math.PI) / 4.6;
      if (time > seedBlink) {
        blinkStart = time;
        seedBlink = time + 3.4 + Math.random() * 3.5;
      }
      const blink = curve(time - blinkStart, [
        [0, 1],
        [0.085, 0.04],
        [0.16, 0.04],
        [0.27, 1],
      ]);
      const y = -2.4 * (1 - Math.cos(phase));
      const target = {
        y,
        rot: 0.65 * Math.sin(phase),
        sx: 1 + 0.009 * Math.sin(phase),
        sy: 1 - 0.009 * Math.sin(phase),
        wand: 1.4 * Math.sin(phase - 0.45),
        hat: 0,
        blink,
        lookX: mouse.x * 1.8,
        lookY: mouse.y * 1.1,
      };
      const sm = Object.fromEntries(
        Object.entries(target).map(([key, v]) => [key, spring(key, v, dt, key === 'blink' ? 700 : 155, key === 'blink' ? 45 : 24)]),
      ) as typeof target;
      // 帽子比身体慢半拍
      sm.hat += spring('hat-follow', -sm.rot * 0.55 - sm.y * 0.12, dt, 90, 14);
      const drag = spring('fur-drag', -sm.rot * 0.65 - (y - sm.y) * 0.4, dt, 55, 11);
      const fur = Array.from({ length: 6 }, (_, i) => Math.sin(time * 2.05 - i * 0.73) * 0.75 + drag * (i < 3 ? 1 : -1) * (0.65 + i * 0.08));
      return { ...sm, fur };
    };

    rig.draw(pose(0, 0.016));
    host.dataset.ready = '';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.034);
      last = now;
      clock += dt;
      rig.draw(pose(clock, dt));
      frame = requestAnimationFrame(tick);
    };
    if (!reduced) frame = requestAnimationFrame(tick);
    // 眼睛跟着鼠标：离角色中心 400 像素就看到头
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      mouse.x = clamp((e.clientX - r.left - r.width / 2) / 400, -1, 1);
      mouse.y = clamp((e.clientY - r.top - r.height / 2) / 400, -1, 1);
    };
    const onLeave = () => {
      mouse.x = 0;
      mouse.y = 0;
    };
    const onVisible = () => {
      last = performance.now();
    };
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div ref={merged} className={cx('kv-kimo', className)} style={{ ...style, '--kv-kimo-size': `${size}px`, '--kv-kimo-scale': size / ART } as CSSProperties} {...rest}>
      {shadow && <div className="kv-kimo__shadow" />}
      <div className="kv-kimo__rig" />
    </div>
  );
});
Kimo.displayName = 'Kimo';
