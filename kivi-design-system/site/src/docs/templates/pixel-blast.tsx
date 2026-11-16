import { useEffect, useRef } from 'react';

/**
 * 像素云背景（11-16 用户要，照 React Bits「Pixel Blast」，MIT + Commons Clause，原版是手写 WebGL2、没有依赖）：
 * 抖动成方块像素的云慢慢飘、闪，鼠标下面亮一片，点一下荡开一圈。
 * 改动：只留方块一种形状、去掉倾斜地面和噪点；颜色固定白色（用户定）；不要开场动画（原版的 intro，用户定）。
 * 铺满父元素（父元素要有大小），透明底。系统开了「减少动态效果」：画一帧不动、不闪、点了不荡。只在页面模板里用，组件库没有。
 */

const MAX_CLICKS = 10;
const bayer2 = (x: number, y: number) => (Math.floor(x) / 2 + Math.floor(y) * Math.floor(y) * 0.75) % 1;
const bayer8 = (x: number, y: number) => (bayer2(x / 4, y / 4) * 0.25 + bayer2(x / 2, y / 2)) * 0.25 + bayer2(x, y);
const BAYER_TABLE = Array.from({ length: 64 }, (_, i) => bayer8(i % 8, Math.floor(i / 8)).toFixed(6)).join(', ');

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const PACKING = `
const float RANGE_MIN = -6.0;
const float RANGE_MAX = 10.0;
vec2 pack16(float value) {
  float x = floor(clamp((value - RANGE_MIN) / (RANGE_MAX - RANGE_MIN), 0.0, 1.0) * 65535.0 + 0.5);
  float hi = floor(x / 256.0);
  return vec2(hi, x - hi * 256.0) / 255.0;
}
float unpack16(vec2 c) {
  float x = floor(c.x * 255.0 + 0.5) * 256.0 + floor(c.y * 255.0 + 0.5);
  return RANGE_MIN + x / 65535.0 * (RANGE_MAX - RANGE_MIN);
}
`;

/** 第一遍：每 8 × 8 像素一格，算这一格的浓度（噪声 + 点击水波 + 鼠标拖尾），存进纹理 */
const CELL_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform vec2 uClickPos[${MAX_CLICKS}];
uniform float uClickAge[${MAX_CLICKS}];
uniform ivec2 uOrigin;
uniform vec2 uDrift;
uniform int uHover;
uniform vec2 uMouse;
uniform float uMouseRadius;
uniform float uMousePresence;
uniform float uHoverStrength;
uniform sampler2D uPrev;
uniform float uDecay;
uniform float uFresh;
out vec4 outCell;
${PACKING}
float hash11(float n) { return fract(sin(n) * 43758.5453); }
float vnoise(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  vec3 k = vec3(1.0, 57.0, 113.0);
  float n000 = hash11(dot(ip, k));
  float n100 = hash11(dot(ip + vec3(1.0, 0.0, 0.0), k));
  float n010 = hash11(dot(ip + vec3(0.0, 1.0, 0.0), k));
  float n110 = hash11(dot(ip + vec3(1.0, 1.0, 0.0), k));
  float n001 = hash11(dot(ip + vec3(0.0, 0.0, 1.0), k));
  float n101 = hash11(dot(ip + vec3(1.0, 0.0, 1.0), k));
  float n011 = hash11(dot(ip + vec3(0.0, 1.0, 1.0), k));
  float n111 = hash11(dot(ip + vec3(1.0, 1.0, 1.0), k));
  vec3 w = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);
  float y0 = mix(mix(n000, n100, w.x), mix(n010, n110, w.x), w.y);
  float y1 = mix(mix(n001, n101, w.x), mix(n011, n111, w.x), w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}
float fbm2(vec2 uv, float t) {
  vec3 p = vec3(uv * uScale, t);
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < 5; ++i) {
    sum += vnoise(p * freq);
    freq *= 1.25;
  }
  return sum * 0.5 + 0.5;
}
void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  float aspectRatio = uResolution.x / uResolution.y;
  float cellPixelSize = 8.0 * uPixelSize;
  vec2 cellCoord = vec2(texel + uOrigin) * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);
  float base = fbm2(uv + uDrift, uTime * 0.05) * 0.5 - 0.65;
  float feed = base + (uDensity - 0.5) * 0.3;
  for (int i = 0; i < ${MAX_CLICKS}; ++i) {
    vec2 pos = uClickPos[i];
    if (pos.x < 0.0) continue;
    vec2 cuv = ((pos - uResolution * 0.5 - cellPixelSize * 0.5) / uResolution) * vec2(aspectRatio, 1.0);
    float t = max(uClickAge[i], 0.0);
    float r = distance(uv, cuv);
    float ring = exp(-pow((r - uRippleSpeed * t) / uRippleThickness, 2.0));
    float atten = exp(-1.0 * t) * exp(-10.0 * r);
    feed = max(feed, ring * atten * uRippleIntensity);
  }
  float brush = 0.0;
  if (uHover > 0) {
    vec2 d = (cellCoord + cellPixelSize * 0.5 + uResolution * 0.5 - uMouse) / max(uMouseRadius, 1.0);
    brush = exp(-dot(d, d)) * uMousePresence;
  }
  vec4 prev = texelFetch(uPrev, texel, 0) * (1.0 - uFresh);
  float trail = max(brush, max(prev.a * uDecay - 1.0 / 255.0, 0.0));
  if (uHover > 0) feed += trail * uHoverStrength;
  outCell = vec4(pack16(feed), clamp((feed + 0.5) * 0.5, 0.0, 1.0), trail);
}`;

/** 第二遍：按浓度 + 8 × 8 抖动矩阵决定每个像素方块亮不亮，白色、透明底（预乘） */
const MAIN_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uResolution;
uniform float uClock;
uniform float uPixelSize;
uniform float uEdgeFade;
uniform sampler2D uCells;
uniform ivec2 uOrigin;
uniform ivec2 uCellCount;
uniform float uSoftness;
uniform float uGlow;
uniform float uTwinkle;
out vec4 fragColor;
${PACKING}
const float BAYER[64] = float[64](${BAYER_TABLE});
vec2 gDx;
vec2 gDy;
float maskSquare(vec2 p, float cov, float soft) {
  if (soft <= 0.0) return cov;
  float side = 0.5 * sqrt(clamp(cov, 0.0, 1.0));
  vec2 c = p - 0.5;
  vec2 q = abs(c) - side;
  float d = max(q.x, q.y);
  vec2 grad = q.x > q.y ? vec2(sign(c.x), 0.0) : vec2(0.0, sign(c.y));
  float aa = max(abs(dot(grad, gDx)) + abs(dot(grad, gDy)), 1e-4);
  return 1.0 - smoothstep(-aa * 0.5, aa * 0.5, d);
}
void main() {
  vec2 fragCoord = gl_FragCoord.xy - uResolution * 0.5;
  gDx = dFdx(fragCoord) / uPixelSize;
  gDy = dFdy(fragCoord) / uPixelSize;
  float cellPixelSize = 8.0 * uPixelSize;
  vec2 smoothAt = (fragCoord / cellPixelSize - vec2(uOrigin)) / vec2(uCellCount);
  float feed = texture(uCells, smoothAt).b * 2.0 - 0.5;
  if (feed < -0.12 * uSoftness && feed < 0.2) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 pixelId = floor(fragCoord / uPixelSize);
  vec2 pixelUV = fragCoord / uPixelSize - pixelId;
  ivec2 cellBits = ivec2(mod(pixelId, 8.0));
  float bayer = BAYER[cellBits.y * 8 + cellBits.x] - 0.5;
  float margin = feed + bayer - 0.5;
  float bw = uSoftness > 0.0 ? smoothstep(-0.12 * uSoftness, 0.12 * uSoftness, margin) : step(0.0, margin);
  float h = fract(sin(dot(pixelId, vec2(127.1, 311.7))) * 43758.5453);
  float heat = clamp((feed - 1.0) * 2.5, 0.0, 1.0) * min(uGlow * 2.0, 1.0);
  float M = maskSquare(pixelUV, bw * (1.0 + heat * 0.35), uSoftness);
  if (uTwinkle > 0.0) {
    float rate = 1.5 + 3.0 * fract(h * 7.31);
    float wave = 0.5 + 0.5 * sin(uClock * rate + h * 37.0);
    M *= 1.0 - uTwinkle * 0.55 * wave * wave;
  }
  float density = clamp(feed, 0.0, 1.0);
  float bloom = smoothstep(0.2, 1.0, density);
  float glow = bloom * bloom * uGlow * 0.22;
  float fade = 1.0;
  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    vec2 a = clamp(norm / uEdgeFade, 0.0, 1.0);
    vec2 b = clamp((1.0 - norm) / uEdgeFade, 0.0, 1.0);
    vec2 sa = a * a * a * (a * (a * 6.0 - 15.0) + 10.0);
    vec2 sb = b * b * b * (b * (b * 6.0 - 15.0) + 10.0);
    fade = sa.x * sa.y * sb.x * sb.y;
  }
  M = clamp(M, 0.0, 1.0) * fade;
  float alpha = M + glow * fade * (1.0 - M);
  fragColor = vec4(vec3(alpha), alpha);
}`;

/** 参数照 React Bits 演示页的默认值；颜色白、没有开场动画 */
const SETTINGS = {
  pixelSize: 3,
  patternScale: 2,
  patternDensity: 1,
  softness: 0.6,
  glow: 0.4,
  twinkle: 0.25,
  drift: 0.2,
  driftAngle: 30,
  speed: 0.5,
  hover: true, // 鼠标下面亮一片（原版 hoverEffect="reveal"）
  hoverRadius: 80, // 原版 140，用户嫌鼠标影响太大
  hoverStrength: 0.35, // 鼠标下面加多少浓度，原版 0.9
  rippleSpeed: 0.3,
  rippleThickness: 0.1,
  rippleIntensity: 1,
  edgeFade: 0.25,
};

type Uniforms = Record<string, WebGLUniformLocation | null>;

function link(gl: WebGL2RenderingContext, fragmentSource: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

export function PixelBlast({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!container || !canvas || !gl) return;
    const cellShader = link(gl, CELL_FRAGMENT);
    const mainShader = link(gl, MAIN_FRAGMENT);
    if (!cellShader || !mainShader) return;
    const cu = cellShader.uniforms;
    const mu = mainShader.uniforms;
    const vao = gl.createVertexArray();
    const s = SETTINGS;

    const targets = [0, 1].map(() => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture, framebuffer };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const view = { width: 1, height: 1, ratio: 1 };
    const cells = { x: 0, y: 0, w: 1, h: 1, key: '' };
    const pointer = { x: 0, y: 0, inside: false };
    const mouse = { x: 0, y: 0, ready: false };
    const clickPos = new Float32Array(MAX_CLICKS * 2).fill(-1);
    const clickAt = new Float32Array(MAX_CLICKS);
    const clickAge = new Float32Array(MAX_CLICKS);
    let clickIndex = 0;
    let current = 0;
    let fresh = true;
    const timeOffset = 417; // 起始画面固定，每次打开一样
    let elapsed = 0;
    let clock = 0;
    let presence = 0;
    let driftX = 0;
    let driftY = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    const layoutCells = () => {
      const cps = 8 * s.pixelSize * view.ratio;
      const w = canvas.width;
      const h = canvas.height;
      const x0 = Math.floor((-w / 2 - cps) / cps);
      const x1 = Math.floor((w / 2 + cps) / cps);
      const y0 = Math.floor((-h / 2 - cps) / cps);
      const y1 = Math.floor((h / 2 + cps) / cps);
      const width = Math.max(1, Math.min(2048, x1 - x0 + 1));
      const height = Math.max(1, Math.min(2048, y1 - y0 + 1));
      const key = `${x0}:${y0}:${width}:${height}`;
      if (key === cells.key) return;
      Object.assign(cells, { key, x: x0, y: y0, w: width, h: height });
      for (const target of targets) {
        gl.bindTexture(gl.TEXTURE_2D, target.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      fresh = true;
    };

    const stepCells = (decay: number) => {
      const source = targets[current];
      const target = targets[1 - current];
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, cells.w, cells.h);
      gl.disable(gl.BLEND);
      gl.useProgram(cellShader.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source.texture);
      gl.uniform1i(cu.uPrev, 0);
      gl.uniform2f(cu.uResolution, canvas.width, canvas.height);
      gl.uniform1f(cu.uTime, timeOffset + elapsed * s.speed);
      gl.uniform1f(cu.uPixelSize, s.pixelSize * view.ratio);
      gl.uniform1f(cu.uScale, s.patternScale);
      gl.uniform1f(cu.uDensity, s.patternDensity);
      gl.uniform1f(cu.uRippleSpeed, s.rippleSpeed);
      gl.uniform1f(cu.uRippleThickness, s.rippleThickness);
      gl.uniform1f(cu.uRippleIntensity, s.rippleIntensity);
      gl.uniform2fv(cu.uClickPos, clickPos);
      gl.uniform1fv(cu.uClickAge, clickAge);
      gl.uniform2i(cu.uOrigin, cells.x, cells.y);
      gl.uniform2f(cu.uDrift, driftX, driftY);
      gl.uniform1i(cu.uHover, s.hover ? 1 : 0);
      gl.uniform2f(cu.uMouse, mouse.x, mouse.y);
      gl.uniform1f(cu.uMouseRadius, s.hoverRadius * view.ratio);
      gl.uniform1f(cu.uMousePresence, presence);
      gl.uniform1f(cu.uHoverStrength, s.hoverStrength);
      gl.uniform1f(cu.uDecay, decay);
      gl.uniform1f(cu.uFresh, fresh ? 1 : 0);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      current = 1 - current;
      fresh = false;
    };

    const draw = () => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(mainShader.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[current].texture);
      gl.uniform1i(mu.uCells, 0);
      gl.uniform2f(mu.uResolution, canvas.width, canvas.height);
      gl.uniform1f(mu.uClock, clock);
      gl.uniform1f(mu.uPixelSize, s.pixelSize * view.ratio);
      gl.uniform1f(mu.uEdgeFade, s.edgeFade);
      gl.uniform2i(mu.uOrigin, cells.x, cells.y);
      gl.uniform2i(mu.uCellCount, cells.w, cells.h);
      gl.uniform1f(mu.uSoftness, s.softness);
      gl.uniform1f(mu.uGlow, s.glow);
      gl.uniform1f(mu.uTwinkle, reduce ? 0 : s.twinkle);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(Math.max((now - last) / 1000, 0), 1 / 20) : 0;
      last = now;
      elapsed += dt;
      clock += dt;
      const angle = (s.driftAngle * Math.PI) / 180;
      driftX += Math.cos(angle) * s.drift * dt * 0.05;
      driftY += Math.sin(angle) * s.drift * dt * 0.05;
      for (let k = 0; k < MAX_CLICKS; k++) clickAge[k] = (clock - clickAt[k]) * 0.5;
      const follow = 1 - Math.exp(-dt / 0.08);
      if (pointer.inside) {
        mouse.x += (pointer.x * view.ratio - mouse.x) * follow;
        mouse.y += ((view.height - pointer.y) * view.ratio - mouse.y) * follow;
      }
      presence += ((pointer.inside ? 1 : 0) - presence) * (1 - Math.exp(-dt / 0.25));
      layoutCells();
      stepCells(s.hover ? Math.exp(-dt / 0.45) : 0);
      draw();
      raf = requestAnimationFrame(frame);
    };

    // 减少动态效果：只画一帧，不跑循环、不响应鼠标
    const wake = () => {
      if (reduce || raf || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      view.width = Math.max(1, container.clientWidth);
      view.height = Math.max(1, container.clientHeight);
      view.ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(view.width * view.ratio));
      canvas.height = Math.max(1, Math.round(view.height * view.ratio));
      if (!mouse.ready) {
        mouse.ready = true;
        mouse.x = canvas.width / 2;
        mouse.y = canvas.height / 2;
      }
      layoutCells();
      stepCells(0);
      draw();
      wake();
    };

    const locate = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
    };
    const onPointerMove = (e: PointerEvent) => {
      const { x, y, inside } = locate(e);
      const was = pointer.inside;
      pointer.inside = inside;
      if (inside) {
        pointer.x = x;
        pointer.y = y;
        if (!was) {
          mouse.x = x * view.ratio;
          mouse.y = (view.height - y) * view.ratio;
        }
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const { x, y, inside } = locate(e);
      if (!inside || reduce) return;
      clickPos[clickIndex * 2] = x * view.ratio;
      clickPos[clickIndex * 2 + 1] = (view.height - y) * view.ratio;
      clickAt[clickIndex] = clock;
      clickIndex = (clickIndex + 1) % MAX_CLICKS;
    };
    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      wake();
    });
    io.observe(container);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', wake);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', wake);
      for (const t of targets) {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.framebuffer);
      }
      gl.deleteVertexArray(vao);
      gl.deleteProgram(cellShader.program);
      gl.deleteProgram(mainShader.program);
    };
  }, []);

  return (
    <div ref={containerRef} className={className} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
