import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  CropHandles,
  Dropdown,
  GenerateButton,
  Menu,
  MenuItem,
  VideoPlayer,
  placeholderImageSrc,
  toast,
  type CropRect,
  type PlaceholderImageName,
} from '@kivi';
import { cx } from '@kivi/utils';
import { TOOL_INTRO, toolOf, type ToolId } from '../../data/tools';
import { ratioNum } from '../../data/mock';
import { uid } from '../../data/store';
import type { Task } from '../../data/types';
import { confirm } from '../../flows/dialogs';
import { confirmDelete } from '../../flows/delete';
import { MaskLayer } from './mask-layer';
import { BRUSH, EDIT_MODES, toolCost, toolParams, type CostContext } from './options';
import { ToolPanel } from './panels';
import { PaintBar, StageActions, ZoomBadge, type BrushTool } from './stage-bars';
import { StageFailed, StageGenerating, StageUploading } from './stage-parts';
import { StitchStage } from './stitch-stage';
import { checkToolFile, loadToolFile, mediaOfFile } from './upload';
import { useStageView } from './use-stage-view';
import { useStrokes } from './use-strokes';
import { INITIAL_STATE, type Source, type ToolJob, type ToolState } from './types';

/*
  一个工具的工作区：舞台（原图、扩图框、涂抹）+ 底部参数面板。工具页、创作页的工具弹窗都用它，
  参数面板和画布节点下面的工具面板是同一套。只在业务页里拼，不进组件库（11-11 用户定先看效果）。
*/

const VIDEO = './placeholders/video/kivi-demo-16x9.mp4';

/** 把宽高比为 ratio 的东西放进 w × h 里，居中 */
function fitRect(ratio: number, w: number, h: number, scale = 1): CropRect {
  const bw = w * scale;
  const bh = h * scale;
  const fw = Math.min(bw, bh * ratio);
  const fh = fw / ratio;
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
}

/** 页面传进来的运行状态：这个工具有没有在生成、失败了没有、生成成功几次。创作页弹窗不传 */
export interface ToolRuntime {
  /** 这个工具最近一条生成中的任务：舞台盖生成中的样子、中间写倒计时 */
  running?: Task | null;
  /** 刚失败的任务：舞台出生成失败 +「重试」「取消」 */
  failed?: Task | null;
  onRetry?: () => void;
  onCancelFail?: () => void;
  /** 视频原素材正在上传（视频1） */
  uploading?: boolean;
  /** 这个工具成功了几次：扩图成功后比例回自由比例 */
  successCount?: number;
  /** 视频拼接刚生成好的结果：出「继续拼接」，点了放进视频1、视频2 清空 */
  stitchResult?: Source | null;
  onContinue?: (result: Source) => void;
}

export interface ToolWorkbenchProps {
  tool: ToolId;
  /** 原图 / 原视频，没有就是介绍和上传。视频拼接是视频1 */
  source: Source | null;
  /** 上传：传了才有「上传」按钮和舞台右上的下载 / 重新上传（工具页用，创作页弹窗里不传） */
  onUpload?: () => void;
  /** 删除原图 / 原视频，回到空态（先确认）。不传就没有删除键 */
  onRemove?: () => void;
  /** 视频拼接：拖了一个文件到视频1的位上 */
  onFile?: (file: File) => void;
  /** 点生成 */
  onGenerate: (job: ToolJob) => void;
  /** 工具页里每个工具一块，不是当前的藏起来（参数、扩图框、涂抹、提示词都还在） */
  hidden?: boolean;
  /** 扩图、智能编辑的提示词放成一横条（左边下拉、中间一行输入、右边生成），给图多留地方：创作页工具弹窗用（11-12 用户定） */
  promptBar?: boolean;
  runtime?: ToolRuntime;
  className?: string;
}

export function ToolWorkbench({ tool, source, onUpload, onRemove, onFile, onGenerate, hidden, promptBar, runtime = {}, className }: ToolWorkbenchProps) {
  const media = toolOf(tool).media;
  const cur = source;
  const stitching = tool === 'stitch';
  const [st, setSt] = useState<ToolState>(INITIAL_STATE);
  const set = <K extends keyof ToolState>(k: K, v: ToolState[K]) => setSt((s) => ({ ...s, [k]: v }));

  // 提示词：智能编辑按编辑方式分开记
  const promptKey = tool === 'edit' ? `edit-${st.editMode}` : tool;
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const prompt = prompts[promptKey] ?? '';
  const setPrompt = (t: string) => setPrompts((p) => ({ ...p, [promptKey]: t }));

  // 视频拼接的视频2：自己管（上传、删除），视频1 是外面传进来的
  const [second, setSecond] = useState<Source | null>(null);
  const [uploading2, setUploading2] = useState(false);
  const secondRef = useRef<HTMLInputElement>(null);
  const takeSecond = async (f: File) => {
    const ok = await checkToolFile(f);
    if (!ok) return;
    if (mediaOfFile(ok) !== 'video') return void toast.error('请上传视频');
    setUploading2(true);
    try {
      const r = await loadToolFile(ok);
      if (r) setSecond({ id: uid('v'), ...r });
    } finally {
      setUploading2(false);
    }
  };
  // 两段比例差太多（宽高比差超过 5%）只提示、不挡
  useEffect(() => {
    if (stitching && cur && second && Math.abs(cur.ratio / second.ratio - 1) > 0.05) toast.warning('两段视频的比例差别较大，拼接后画面可能有黑边');
  }, [stitching, cur?.id, second?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 拼接生成好后出「继续拼接」；两段视频一变就收起
  const [canContinue, setCanContinue] = useState(false);
  useEffect(() => setCanContinue(false), [cur?.id, second?.id]);
  useEffect(() => {
    if (runtime.stitchResult) setCanContinue(true);
  }, [runtime.stitchResult]);

  const generating = !!runtime.running;
  const failed = !!runtime.failed && !generating;
  const uploading = !!runtime.uploading || (stitching && uploading2);
  // 视频拼接一打开就露出两个上传位（照线上），不出工具介绍
  const slots = stitching;

  // 舞台大小：图片、视频按比例放进去；扩图时缩小留出往外拉的地方
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const expanding = tool === 'expand' && !!cur;
  const painting = tool === 'edit' && st.editMode !== 'redraw' && !!cur;
  const stageOn = !!cur && !stitching && !failed && !uploading;
  const view = useStageView(areaRef, stageOn, cur?.id);
  const rect = cur && !stitching ? view.apply(fitRect(cur.ratio, area.w, area.h, expanding ? 0.6 : 1)) : null;
  const bounds: CropRect = { x: 0, y: 0, w: area.w, h: area.h };

  // 扩图框：按原图的比例记（舞台变大变小、缩放、切走再切回来都对得上），换了原图才回到贴着原图
  const [frameRel, setFrameRel] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  const frame: CropRect | null =
    expanding && rect ? { x: rect.x + frameRel.x * rect.w, y: rect.y + frameRel.y * rect.h, w: frameRel.w * rect.w, h: frameRel.h * rect.h } : null;
  const setFrame = (f: CropRect) => {
    if (!rect) return;
    setFrameRel({ x: (f.x - rect.x) / rect.w, y: (f.y - rect.y) / rect.h, w: f.w / rect.w, h: f.h / rect.h });
  };
  const frameMoved = [frameRel.x, frameRel.y].some((v) => Math.abs(v) > 0.002) || [frameRel.w, frameRel.h].some((v) => Math.abs(v - 1) > 0.002);
  useEffect(() => {
    setFrameRel({ x: 0, y: 0, w: 1, h: 1 });
    set('expandRatio', 'free');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);
  const pickExpandRatio = (v: string | null) => {
    set('expandRatio', v ?? 'free');
    if (!rect || !cur || !v || v === 'free') return;
    // 按原图的比例算（原图宽高比 = cur.ratio）：框的宽高比 = v，贴着原图往外长，再缩到舞台放得下
    const r = ratioNum(v);
    let w = r >= cur.ratio ? r / cur.ratio : 1;
    let h = r >= cur.ratio ? 1 : cur.ratio / r;
    const fit = Math.min(1, area.w / (w * rect.w), area.h / (h * rect.h));
    w *= fit;
    h *= fit;
    setFrameRel({ x: 0.5 - w / 2, y: 0.5 - h / 2, w, h });
  };
  // 扩图成功后比例回「自由比例」（11-18 用户定）
  const successes = runtime.successCount ?? 0;
  const lastSuccesses = useRef(successes);
  useEffect(() => {
    if (successes === lastSuccesses.current) return;
    lastSuccesses.current = successes;
    if (tool === 'expand') set('expandRatio', 'free');
  }, [successes]); // eslint-disable-line react-hooks/exhaustive-deps

  // 涂抹：换了原图才清掉
  const paint = useStrokes();
  const [brushTool, setBrushTool] = useState<BrushTool>('brush');
  const [brush, setBrush] = useState<number>(BRUSH.default);
  const [space, setSpace] = useState(false);
  const activeTool: BrushTool = space ? 'hand' : brushTool;
  useEffect(() => {
    paint.reset();
    setBrushTool('brush');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);
  // 按住空格临时换成拖动；在输入框里打空格不算
  useEffect(() => {
    if (!painting || hidden) return;
    const field = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""]');
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || field(e.target)) return;
      e.preventDefault();
      setSpace(true);
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpace(false);
    const off = () => setSpace(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', off);
      setSpace(false);
    };
  }, [painting, hidden]);
  // 拖动工具：按住舞台平移
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const ctx: CostContext = { expandArea: expanding ? frameRel.w * frameRel.h : undefined, duration: cur?.duration };
  const cost = toolCost(tool, st, ctx);

  // 生成按钮能不能点：不满足就置灰，悬停说为什么
  const needsPrompt = tool === 'edit' && st.editMode !== 'remove';
  const reason = stitching && !(cur && second)
    ? '请上传两段视频'
    : !cur
      ? media === 'image'
        ? '请先上传图片'
        : '请先上传视频'
      : uploading
        ? '视频上传中，请稍候'
        : needsPrompt && !prompt.trim()
          ? '请输入画面描述'
          : painting && !paint.strokes.length
            ? '请涂抹要修改的区域'
            : expanding && !frameMoved
              ? '请拖动扩图框'
              : undefined;

  const generate = () => {
    if (!cur || reason) return;
    const label = tool === 'edit' ? (EDIT_MODES.find((m) => m.value === st.editMode)!.label as string) : toolOf(tool).name;
    onGenerate({
      tool,
      label,
      media: cur.media,
      src: cur.src,
      ratio: cur.ratio,
      targetRatio: tool === 'expand' && frame ? frame.w / frame.h : cur.ratio,
      params: toolParams(tool, st, ctx),
      cost,
    });
  };

  const gen = <GenerateButton cost={cost} disabledReason={reason} onClick={generate} />;
  const continueButton =
    canContinue && runtime.stitchResult ? (
      <Button
        variant="secondary-muted"
        onClick={() => {
          runtime.onContinue?.(runtime.stitchResult!);
          setSecond(null);
          setCanContinue(false);
        }}
      >
        继续拼接
      </Button>
    ) : undefined;
  const panel = (
    <ToolPanel
      tool={tool}
      st={st}
      set={set}
      gen={gen}
      promptKey={promptKey}
      prompt={prompt}
      setPrompt={setPrompt}
      promptBar={promptBar}
      continueButton={continueButton}
      pickExpandRatio={pickExpandRatio}
    />
  );

  // 右键菜单、右上的重新上传 / 删除
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const download = () => toast.success('已开始下载');
  const copy = async () => {
    // 图片真的放进剪贴板（浏览器不让就算了），演示里一律提示已复制
    try {
      if (cur?.media === 'image') {
        const blob = await (await fetch(cur.src)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      }
    } catch {
      /* 剪贴板不可用，照样提示 */
    }
    toast.success('已复制');
  };
  const reupload = async () => {
    const what = media === 'video' ? '原视频' : '原图';
    const ok = await confirm({ title: '重新上传', description: `重新上传后，${what}历史记录将清空`, confirmText: '重新上传', danger: false });
    if (ok) onUpload?.();
  };

  // 舞台上的东西
  let stage: ReactNode = null;
  if (failed) {
    stage = <StageFailed onRetry={() => runtime.onRetry?.()} onCancel={() => runtime.onCancelFail?.()} />;
  } else if (uploading && !slots) {
    stage = <StageUploading />;
  } else if (slots) {
    stage = (
      <>
        <StitchStage
          first={{ title: '视频1', source: cur, uploading: runtime.uploading, onPick: onUpload, onFile, onRemove }}
          second={{ title: '视频2', source: second, uploading: uploading2, onPick: () => secondRef.current?.click(), onFile: (f) => void takeSecond(f), onRemove: () => setSecond(null) }}
          area={area}
          ratio={cur?.ratio}
        />
        {generating && runtime.running && cur && <StageGenerating media="video" src={cur.src} box={bounds} task={runtime.running} />}
      </>
    );
  } else if (!cur) {
    const intro = TOOL_INTRO[tool];
    stage = (
      <div className="tpl-at__intro">
        <div className="tpl-at__intro-demo">
          {intro.demo === 'video' ? (
            <video src={VIDEO} muted autoPlay loop playsInline />
          ) : (
            <img src={placeholderImageSrc(intro.demo as PlaceholderImageName, '16:9')} alt="" />
          )}
        </div>
        <div className="tpl-at__intro-text">
          <div className="tpl-at__intro-title">{toolOf(tool).name}</div>
          <div className="tpl-at__intro-desc">{intro.desc}</div>
        </div>
        {onUpload && (
          <Button variant="secondary-muted" leftIcon="Upload" onClick={onUpload}>
            {media === 'image' ? '上传图片' : '上传视频'}
          </Button>
        )}
      </div>
    );
  } else if (rect && area.w > 0) {
    const box = { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
    stage = (
      <>
        {expanding && frame && <div className="tpl-at__expand-fill" style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }} />}
        {/* 生成中盖上去的那层自己带原素材（遮罩下面的原图 / 视频首帧），底下的原图、播放器先撤掉，不然视频还在播、控制条透出来 */}
        {!generating &&
          (cur.media === 'image' ? (
            <img key={cur.id} className="tpl-at__media tpl-at__media--in" style={box} src={cur.src} alt="" />
          ) : (
            <div key={cur.id} className="tpl-at__media tpl-at__media--in" style={box}>
              <VideoPlayer variant="preview" src={cur.src} fit="contain" loop />
            </div>
          ))}
        {expanding && frame && !generating && (
          <CropHandles
            aria-label="扩图框"
            value={frame}
            onValueChange={setFrame}
            ratio={st.expandRatio === 'free' ? null : ratioNum(st.expandRatio)}
            bounds={bounds}
            contain={rect}
            min={0}
            onConfirm={() => generate()}
            onCancel={() => (setFrameRel({ x: 0, y: 0, w: 1, h: 1 }), set('expandRatio', 'free'))}
          />
        )}
        {painting && !generating && (
          <MaskLayer
            rect={rect}
            strokes={paint.strokes}
            erase={activeTool === 'erase'}
            inactive={activeTool === 'hand'}
            size={brush * view.z}
            onStroke={paint.add}
          />
        )}
        {generating && runtime.running && <StageGenerating media={cur.media} src={cur.src} box={rect} task={runtime.running} />}
      </>
    );
  }

  const interactive = stageOn && !generating;

  return (
    <section className={cx('tpl-at__stage', className)} hidden={hidden}>
      {/* 涂抹工具条：只在局部重绘、元素去除时出，浮在舞台上方正中 */}
      {painting && interactive && (
        <PaintBar
          tool={activeTool}
          onTool={setBrushTool}
          size={brush}
          onSize={setBrush}
          canUndo={paint.canUndo}
          canRedo={paint.canRedo}
          onUndo={paint.undo}
          onRedo={paint.redo}
          canReset={paint.strokes.length > 0 || brushTool !== 'brush'}
          onReset={() => (paint.reset(), setBrushTool('brush'))}
        />
      )}
      {cur && onUpload && !stitching && !failed && !uploading && (
        <StageActions
          onDownload={download}
          onReupload={() => void reupload()}
          onRemove={onRemove && (() => void confirmDelete(async () => onRemove()))}
        />
      )}

      <div
        ref={areaRef}
        className="tpl-at__area"
        data-painting={painting ? '' : undefined}
        data-hand={painting && activeTool === 'hand' ? '' : undefined}
        data-panning={panning ? '' : undefined}
        data-zoomed={view.z !== 1 ? '' : undefined}
        onContextMenu={(e) => {
          if (!stageOn) return;
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        onPointerDown={(e) => {
          if (!painting || activeTool !== 'hand') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY };
          setPanning(true);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          view.pan(e.clientX - d.x, e.clientY - d.y);
          dragRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          dragRef.current = null;
          setPanning(false);
        }}
      >
        {!hidden && stage}
        {!hidden && stageOn && <ZoomBadge z={view.z} onReset={view.reset} />}
      </div>
      {(cur || (stitching && second)) && <Dock>{panel}</Dock>}

      {stitching && <input ref={secondRef} type="file" hidden accept="video/*" onChange={(e) => (e.target.files?.[0] && void takeSecond(e.target.files[0]), (e.target.value = ''))} />}

      {/* 舞台的右键菜单 */}
      <Dropdown anchorPoint={menu ?? undefined} open={menu !== null} onOpenChange={(v) => !v && setMenu(null)}>
        <Menu aria-label="舞台操作">
          <MenuItem icon="Download" onClick={download}>
            下载
          </MenuItem>
          <MenuItem icon="Copy" onClick={() => void copy()}>
            复制
          </MenuItem>
        </Menu>
      </Dropdown>
    </section>
  );
}

/**
 * 底下的参数面板：切编辑方式（元素去除没有提示词，面板矮一截）时高度过渡，不跳（11-18 用户定）。
 * 面板底边钉住不动、上边沿上下移：面板框（底色、圆角）的高度跟着外层走、加过渡，里面的内容贴底排，
 * 新出来的提示词从上边沿露出来 / 收进去。坑是剩下的高度，跟着一起逐帧变，图也跟着坑走。第一次出现不动画
 */
function Dock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const dock = ref.current;
    const panel = dock?.firstElementChild as HTMLElement | null;
    if (!dock || !panel) return;
    // 内容本来要多高：内容贴底排，第一个子元素离面板顶的距离就是多出来（或不够）的那段
    const measure = () => {
      const first = panel.firstElementChild as HTMLElement | null;
      if (!first) return;
      const pad = parseFloat(getComputedStyle(panel).paddingTop) || 0;
      setHeight(Math.round(panel.clientHeight - first.offsetTop + pad));
    };
    const ro = new ResizeObserver(measure);
    const watch = () => {
      ro.disconnect();
      ro.observe(panel);
      Array.from(panel.children).forEach((c) => ro.observe(c));
    };
    const mo = new MutationObserver(() => (watch(), measure()));
    mo.observe(panel, { childList: true });
    watch();
    measure();
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(id);
    };
  }, []);
  return (
    <div ref={ref} className="tpl-at__dock" data-ready={ready || undefined} style={height != null ? { height } : undefined}>
      {children}
    </div>
  );
}
