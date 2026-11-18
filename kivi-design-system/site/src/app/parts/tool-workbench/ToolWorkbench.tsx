import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  ButtonGroup,
  CropHandles,
  Divider,
  GenerateButton,
  Icon,
  IconButton,
  Slider,
  VideoPlayer,
  placeholderImageSrc,
  toast,
  type CropRect,
  type PlaceholderImageName,
} from '@kivi';
import { cx } from '@kivi/utils';
import { TOOL_INTRO, toolOf, type ToolId } from '../../data/tools';
import { ratioNum } from '../../data/mock';
import { MaskLayer, type Stroke } from './mask-layer';
import { EDIT_MODES, toolCost, toolParams } from './options';
import { ToolPanel } from './panels';
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

export interface ToolWorkbenchProps {
  tool: ToolId;
  /** 原图 / 原视频，没有就是介绍和上传 */
  source: Source | null;
  /** 上传：传了才有「上传」按钮和舞台右上的下载 / 换一张（工具页用，创作页弹窗里不传） */
  onUpload?: () => void;
  /** 点生成 */
  onGenerate: (job: ToolJob) => void;
  /** 工具页里每个工具一块，不是当前的藏起来（参数、扩图框、涂抹、提示词都还在） */
  hidden?: boolean;
  /** 扩图、智能编辑的提示词放成一横条（左边下拉、中间一行输入、右边生成），给图多留地方：创作页工具弹窗用（11-12 用户定） */
  promptBar?: boolean;
  className?: string;
}

export function ToolWorkbench({ tool, source, onUpload, onGenerate, hidden, promptBar, className }: ToolWorkbenchProps) {
  const media = toolOf(tool).media;
  const cur = source;
  const [st, setSt] = useState<ToolState>(INITIAL_STATE);
  const set = <K extends keyof ToolState>(k: K, v: ToolState[K]) => setSt((s) => ({ ...s, [k]: v }));

  // 提示词：智能编辑按编辑方式分开记
  const promptKey = tool === 'edit' ? `edit-${st.editMode}` : tool;
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const prompt = prompts[promptKey] ?? '';
  const setPrompt = (t: string) => setPrompts((p) => ({ ...p, [promptKey]: t }));

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
  const rect = cur ? fitRect(cur.ratio, area.w, area.h, expanding ? 0.6 : 1) : null;
  const bounds: CropRect = { x: 0, y: 0, w: area.w, h: area.h };

  // 扩图框：按原图的比例记（舞台变大变小、切走再切回来都对得上），换了原图才回到贴着原图
  const [frameRel, setFrameRel] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  const frame: CropRect | null =
    expanding && rect ? { x: rect.x + frameRel.x * rect.w, y: rect.y + frameRel.y * rect.h, w: frameRel.w * rect.w, h: frameRel.h * rect.h } : null;
  const setFrame = (f: CropRect) => {
    if (!rect) return;
    setFrameRel({ x: (f.x - rect.x) / rect.w, y: (f.y - rect.y) / rect.h, w: f.w / rect.w, h: f.h / rect.h });
  };
  useEffect(() => {
    setFrameRel({ x: 0, y: 0, w: 1, h: 1 });
    set('expandRatio', 'free');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);
  const pickExpandRatio = (v: string | null) => {
    set('expandRatio', v ?? 'free');
    if (!rect || !v || v === 'free') return;
    const r = ratioNum(v);
    const w = r >= rect.w / rect.h ? rect.h * r : rect.w;
    const h = r >= rect.w / rect.h ? rect.h : rect.w / r;
    const fit = Math.min(1, area.w / w, area.h / h);
    const fw = w * fit;
    const fh = h * fit;
    setFrame({ x: rect.x + rect.w / 2 - fw / 2, y: rect.y + rect.h / 2 - fh / 2, w: fw, h: fh });
  };

  // 涂抹：换了原图才清掉
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [erase, setErase] = useState(false);
  const [brush, setBrush] = useState(40);
  useEffect(() => {
    setStrokes([]);
    setRedo([]);
    setErase(false);
  }, [cur?.id]);

  const cost = toolCost(tool, st);
  const generate = () => {
    if (!cur) return;
    const label = tool === 'edit' ? (EDIT_MODES.find((m) => m.value === st.editMode)!.label as string) : toolOf(tool).name;
    onGenerate({
      tool,
      label,
      media: cur.media,
      src: cur.src,
      ratio: cur.ratio,
      targetRatio: tool === 'expand' && frame ? frame.w / frame.h : cur.ratio,
      params: toolParams(tool, st),
      cost,
    });
  };

  // 生成按钮能不能点：没素材、该写提示词没写、该涂没涂、拼接不够两段，都置灰（不弹原因）
  const needsPrompt = tool === 'edit' && st.editMode !== 'remove';
  const disabled = !cur || (needsPrompt && !prompt.trim()) || (painting && !strokes.length) || (tool === 'stitch' && !st.stitchExtra);

  const gen = <GenerateButton cost={cost} disabled={disabled} onClick={generate} />;
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
      hasSource={!!cur}
      pickExpandRatio={pickExpandRatio}
    />
  );

  // 舞台上的东西
  let stage: ReactNode = null;
  if (!cur) {
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
        {cur.media === 'image' ? (
          <img key={cur.id} className="tpl-at__media tpl-at__media--in" style={box} src={cur.src} alt="" />
        ) : (
          <div key={cur.id} className="tpl-at__media tpl-at__media--in" style={box}>
            <VideoPlayer variant="preview" src={cur.src} fit="contain" loop />
          </div>
        )}
        {expanding && frame && (
          <CropHandles
            aria-label="扩图框"
            value={frame}
            onValueChange={setFrame}
            ratio={st.expandRatio === 'free' ? null : ratioNum(st.expandRatio)}
            bounds={bounds}
            contain={rect}
            min={0}
            onConfirm={() => !disabled && generate()}
            onCancel={() => (setFrameRel({ x: 0, y: 0, w: 1, h: 1 }), set('expandRatio', 'free'))}
          />
        )}
        {painting && (
          <MaskLayer rect={rect} strokes={strokes} erase={erase} size={brush} onStroke={(s) => (setStrokes((l) => [...l, s]), setRedo([]))} />
        )}
      </>
    );
  }

  return (
    <section className={cx('tpl-at__stage', className)} hidden={hidden}>
      {/* 涂抹工具条：只在局部重绘、元素消除时出，浮在舞台上方正中 */}
      {painting && (
        <ButtonGroup variant="glass" size={44} className="tpl-at__top">
          <IconButton icon="Brush" label="画笔" selected={!erase} onClick={() => setErase(false)} />
          <IconButton icon="Eraser" label="橡皮" selected={erase} onClick={() => setErase(true)} />
          <Divider orientation="vertical" />
          <span className="tpl-at__size">
            <Icon name="BrushSize" />
            <Slider aria-label="笔刷大小" min={8} max={120} value={brush} onChange={setBrush} />
          </span>
          <Divider orientation="vertical" />
          <IconButton
            icon="Previous"
            label="撤销"
            disabled={!strokes.length}
            onClick={() => (setRedo((r) => [strokes[strokes.length - 1], ...r]), setStrokes((l) => l.slice(0, -1)))}
          />
          <IconButton
            icon="NextStep"
            label="重做"
            disabled={!redo.length}
            onClick={() => (setStrokes((l) => [...l, redo[0]]), setRedo((r) => r.slice(1)))}
          />
          <IconButton icon="Delete" label="清空" disabled={!strokes.length} onClick={() => (setRedo([]), setStrokes([]))} />
        </ButtonGroup>
      )}
      {cur && onUpload && (
        <ButtonGroup variant="glass" size={44} className="tpl-at__actions">
          <IconButton icon="Download" label="下载" tooltip={{ placement: 'bottom' }} onClick={() => toast.success('已开始下载')} />
          <IconButton icon="ReUpload" label="换一张" tooltip={{ placement: 'bottom' }} onClick={onUpload} />
        </ButtonGroup>
      )}

      <div ref={areaRef} className="tpl-at__area" data-painting={painting ? '' : undefined}>
        {!hidden && stage}
      </div>
      {cur && <div className="tpl-at__dock">{panel}</div>}
    </section>
  );
}
