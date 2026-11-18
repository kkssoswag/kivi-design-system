import {
  forwardRef,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type HTMLAttributes,
  type Ref,
} from 'react';
import { toast } from '../feedback';
import { cx } from '../utils';
import { composeDropHandlers, rejectMessage, useControllable, useFileDrop, useMergedRef } from '../hooks';
import { ReferenceFramePair } from '../reference/ReferenceFramePair';
import { ReferenceStack, referenceName, relabelReferences, type ReferenceStackItem } from '../reference/ReferenceStack';
import { PromptInput } from './PromptInput';
import { insertMention, promptText, setPromptText, syncMentions } from './mentions';
import { DropOverlay } from './DropOverlay';
import { PromptBoxContext } from './context';
import type { AgentControlsProps } from './AgentControls';
import { GenActions, GenToolbar } from './gen-controls';
import { GEN_PLACEHOLDER, fileToReference, genBlockedReason, genCost, isFramesMode, type GenFrames, type GenTask } from './gen-rules';
import { DEFAULT_MODEL } from './options';
import { TaskSelect } from './GenSelects';
import { GEN_PARAM_DEFAULTS, type GenParamValues } from './GenParams';
import './generation.css';

export interface PromptBoxSubmit {
  task: GenTask;
  /** 这个任务现在选的模型 */
  model: string;
  /** 视频的参考方式 */
  refMode: string;
  text: string;
  references: ReferenceStackItem[];
  frames: GenFrames;
  /** 这个任务参数面板里选的值（比例、分辨率、时长……），键见 GenParams 的 GEN_PARAM_DEFAULTS；Agent、文字没有，是空的 */
  params: GenParamValues;
  /** 张数（图片、视频），别的任务是 1 */
  count: number;
}

export interface PromptBoxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'children' | 'onSubmit'> {
  /** 提示词（纯文字，@ 引用写成「@图片1」）。传了就是受控，要自己在 onChange 里更新；从外面改了文字，框里的 @ 标签变回纯文字 */
  value?: string;
  /** 非受控时的初始提示词 */
  defaultValue?: string;
  /** 提示词变了触发，参数是新的文字 */
  onChange?: (value: string) => void;
  /** 任务类型：Agent / 图片生成 / 视频生成 / 音频生成。传了就是受控 */
  task?: GenTask;
  /** 非受控时一开始的任务，默认 Agent */
  defaultTask?: GenTask;
  /** 切了任务类型 */
  onTaskChange?: (task: GenTask) => void;
  /** 每种任务各选的模型，比如 `{ video: 'veo-3.1-fast' }`，没写的用默认模型。传了就是受控 */
  models?: Partial<Record<GenTask, string>>;
  /** 非受控时一开始各任务的模型 */
  defaultModels?: Partial<Record<GenTask, string>>;
  /** 换了模型，参数是所有任务的模型 */
  onModelsChange?: (models: Partial<Record<GenTask, string>>) => void;
  /** 视频的参考方式：omni 全能参考 / frames 首尾帧 / edit 视频编辑 / extend 视频延长。传了就是受控。换模型时回到全能参考 */
  refMode?: string;
  /** 非受控时一开始的参考方式，默认全能参考 */
  defaultRefMode?: string;
  /** 换了参考方式 */
  onRefModeChange?: (mode: string) => void;
  /** 参考区的素材（全能参考、视频编辑、视频延长和图片、音频、Agent 都用这一份）。传了就是受控 */
  references?: ReferenceStackItem[];
  /** 非受控时一开始的素材，默认空（只有添加格） */
  defaultReferences?: ReferenceStackItem[];
  /** 素材变了（加、删、拖进来） */
  onReferencesChange?: (items: ReferenceStackItem[]) => void;
  /** 首尾帧的两张图。传了就是受控 */
  frames?: GenFrames;
  /** 非受控时一开始的首尾帧 */
  defaultFrames?: GenFrames;
  /** 首尾帧变了（互换、拖进来、从参考区搬过来） */
  onFramesChange?: (frames: GenFrames) => void;
  /** 点了参考区的添加格。不传就弹出选文件，选完加进参考区 */
  onAddReference?: () => void;
  /** 参考区固定展开（受控）。不传是鼠标移上去展开 */
  referencesExpanded?: boolean;
  /** 参考区展开收起 */
  onReferencesExpandedChange?: (expanded: boolean) => void;
  /** 点了生成 / 发送，参数是现在的所有选择。不能生成时（按钮置灰）不触发。不受控的提示词发出后清空 */
  onSubmit?: (submit: PromptBoxSubmit) => void;
  /** 正在生成：生成按钮置灰，Agent 的发送按钮变停止 */
  generating?: boolean;
  /** Agent 正在回复时点了停止（发送按钮变成的停止） */
  onStop?: () => void;
  /** 消耗的猕猴桃数。不传按任务和模型取示例数字 */
  cost?: number;
  /** 工具条里的下拉往哪边弹：输入框贴底时往上（默认），在页面上面时往下 */
  placement?: 'top-start' | 'bottom-start';
  /** Agent 技能面板里的技能 */
  skills?: AgentControlsProps['skills'];
  /** Agent 技能面板里的分类 */
  skillCategories?: AgentControlsProps['skillCategories'];
  /** Agent 点了一个技能 */
  onPickSkill?: AgentControlsProps['onPickSkill'];
  /** 没输入时的占位文字。不传跟着任务变 */
  placeholder?: string;
  /** 提示词最高多高，超过就在里面滚动，数字按 px。默认 240 */
  maxHeight?: number;
  /** 把文件拖进输入框时触发，参数是通过 `accept` 检查的文件列表。不传就直接加进参考区（首尾帧时图片填空着的格）。拖进来时盖一层 DropOverlay「松手上传」，类型不收的显示「不支持这种文件」、不接收，放下后弹 toast（页面上要放 `<Toaster />`） */
  onDropFiles?: (files: File[]) => void;
  /** 收哪些文件，写法同 `<input accept>`。默认图片、视频、音频；首尾帧时只收图片 */
  accept?: string;
  /** 提示词输入框（PromptInput，contentEditable）的 ref，聚焦、选中用 */
  inputRef?: Ref<HTMLDivElement>;
  /** 提示词输入框的说明，读屏用，默认「提示词」 */
  inputLabel?: string;
}

/** 参考区展开时，盖不住的字从盖住的边往右渐隐出来，渐隐这么宽 */
const FADE = 40;

const DEFAULT_ACCEPT = 'image/*,video/*,audio/*';

/**
 * 主站的创作输入框（首页、对话页）。上面是内容区（参考区 + 提示词），下面是工具条：左边先选任务类型，后面的控件跟着任务和模型变；右边是张数和生成。
 * 提示词是多行的，随内容长高，超过最高高度就在里面滚动；参考区展开时浮在提示词上面，被盖住的字藏起来。
 * 状态都在组件里（11-17 用户定，不许各处自己拼）：任务、模型、参考方式和参考区（叠放 / 首尾帧）、素材上传和拖入、不能生成的原因、消耗。
 * 用的地方只传状态（task、models、refMode、references…），要哪个状态切哪个。规则和画布生成面板 NodePanel 共用 gen-rules.ts。
 * Figma「模板 · 主站」页「输入框」分区。
 */
export const PromptBox = forwardRef<HTMLDivElement, PromptBoxProps>(function PromptBox(
  {
    value: valueProp,
    defaultValue = '',
    onChange,
    task: taskProp,
    defaultTask = 'agent',
    onTaskChange,
    models: modelsProp,
    defaultModels = {},
    onModelsChange,
    refMode: refModeProp,
    defaultRefMode = 'omni',
    onRefModeChange,
    references: referencesProp,
    defaultReferences = [],
    onReferencesChange,
    frames: framesProp,
    defaultFrames = {},
    onFramesChange,
    onAddReference,
    referencesExpanded,
    onReferencesExpandedChange,
    onSubmit,
    onStop,
    generating,
    cost,
    placement = 'top-start',
    skills,
    skillCategories,
    onPickSkill,
    placeholder,
    maxHeight = 240,
    onDropFiles,
    accept = DEFAULT_ACCEPT,
    inputRef,
    inputLabel = '提示词',
    className,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControllable(valueProp, defaultValue, onChange);
  const [task, setTask] = useControllable<GenTask>(taskProp, defaultTask, onTaskChange);
  const [models, setModels] = useControllable(modelsProp, defaultModels, onModelsChange);
  const [refMode, setRefMode] = useControllable(refModeProp, defaultRefMode, onRefModeChange);
  const [references, setReferencesRaw] = useControllable(referencesProp, defaultReferences, onReferencesChange);
  // 素材名字按排列顺序、每种类型各自编号（图片1、视频1…）：删了、换了顺序都重新编，提示词里的 @ 跟着改
  const setReferences = (list: ReferenceStackItem[]) => setReferencesRaw(relabelReferences(list));
  const [frames, setFrames] = useControllable(framesProp, defaultFrames, onFramesChange);
  // 参数面板和张数：每种任务各记一份，切任务再切回来还在；发出时一起交出去
  const [params, setParams] = useState<Partial<Record<GenTask, GenParamValues>>>({});
  const [count, setCount] = useState('1');
  const paramsOf = (t: GenTask): GenParamValues => params[t] ?? (t in GEN_PARAM_DEFAULTS ? GEN_PARAM_DEFAULTS[t as keyof typeof GEN_PARAM_DEFAULTS] : {});
  const textRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useMergedRef(textRef, inputRef);
  const fileRef = useRef<HTMLInputElement>(null);
  // 上传是异步的：读最新的素材，免得两次加素材互相覆盖
  const latestRefs = useRef(references);
  latestRefs.current = references;

  const modelOf = (t: GenTask) => models[t] ?? (t === 'agent' ? '' : DEFAULT_MODEL[t]);
  const model = modelOf(task);
  const framesNow = task === 'video' && isFramesMode(model, refMode);

  // 换视频的模型或参考方式（照线上主站）：进首尾帧时两格空着，就把参考区前两张图搬进去（参考区留着）；
  // 出首尾帧时参考区空着，就把首尾帧的图搬回参考区。没有过渡，直接换（11-17 用户定）
  const switchVideo = (nextModel: string, nextMode: string) => {
    const was = isFramesMode(modelOf('video'), refMode);
    const now = isFramesMode(nextModel, nextMode);
    if (!was && now && !frames.first && !frames.last) {
      const imgs = references.filter((i) => i.type === 'image');
      if (imgs.length) setFrames({ first: imgs[0]?.src, last: imgs[1]?.src });
    }
    if (was && !now && references.length === 0) {
      const back = [frames.first, frames.last]
        .filter((src): src is string => !!src)
        .reduce<ReferenceStackItem[]>((list, src, i) => [...list, { id: `frame-${Date.now()}-${i}`, type: 'image', name: referenceName(list, 'image'), src }], []);
      if (back.length) setReferences(back);
    }
    if (nextModel !== modelOf('video')) setModels({ ...models, video: nextModel });
    setRefMode(nextMode);
  };
  // 换模型时参考方式回到全能参考（照线上：模型支持的参考方式不一样）
  const changeModel = (m: string) => (task === 'video' ? switchVideo(m, 'omni') : setModels({ ...models, [task]: m }));

  // 加文件（选的、拖进来的）：首尾帧时图片按顺序填空着的首帧、尾帧；其余加进参考区
  // 点了首尾帧哪一格的添加格：选的第一张图放进这一格，多的再填另一格（空着的话）
  const frameTarget = useRef<'first' | 'last' | null>(null);
  const addFiles = async (files: File[]) => {
    if (framesNow) {
      const srcs = files.filter((f) => f.type.startsWith('image')).map((f) => URL.createObjectURL(f));
      const target = frameTarget.current;
      frameTarget.current = null;
      const first = target === 'first' ? srcs.shift() ?? frames.first : frames.first ?? srcs.shift();
      const last = target === 'last' ? srcs.shift() ?? frames.last : frames.last ?? srcs.shift();
      setFrames({ first, last });
      return;
    }
    let list = latestRefs.current;
    for (const f of files) list = [...list, await fileToReference(f, list)];
    setReferences(list);
  };
  const dropFiles = onDropFiles ?? ((files: File[]) => void addFiles(files));
  const pickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) dropFiles(files);
  };
  const fileAccept = framesNow ? 'image/*' : accept;

  // 拖文件进来
  const { dragging, rejected, bind } = useFileDrop({
    accept: fileAccept,
    // 拖进来的不算点了哪一格：按顺序填空格（点了添加格又取消选文件，留下的目标作废）
    onFiles: (files) => {
      frameTarget.current = null;
      dropFiles(files);
    },
    onReject: (_, reason) => toast.error(rejectMessage(reason)),
  });

  const reason = genBlockedReason({
    kind: task,
    text: value,
    model,
    refMode,
    referenceTypes: references.map((r) => r.type),
    hasFirstFrame: !!frames.first,
  });
  const submit = () => {
    if (generating || (task === 'agent' ? !value.trim() : reason)) return;
    onSubmit?.({ task, model, refMode, text: value, references, frames, params: paramsOf(task), count: task === 'image' || task === 'video' ? Number(count) : 1 });
    if (onSubmit && valueProp === undefined) setValue('');
  };
  const dropHandlers = composeDropHandlers({ onDragEnter, onDragOver, onDragLeave, onDrop }, bind);

  // 提示词框是 contentEditable（能放 @ 标签），不能直接受控：记下框里现在的文字，外面改成别的文字时才重写框里的内容
  const shownText = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (value === shownText.current) return;
    setPromptText(textRef.current, value);
    shownText.current = value;
  }, [value]);
  const onInput = (e: FormEvent<HTMLDivElement>) => {
    const next = promptText(e.currentTarget);
    shownText.current = next;
    setValue(next);
  };
  // 素材改了名、删了：框里的 @ 标签跟着改、跟着删
  // 外面传进来的名字不一定是新编的，按现在的顺序算一遍
  const named = relabelReferences(references);
  useLayoutEffect(() => {
    if (!syncMentions(textRef.current, named)) return;
    const next = promptText(textRef.current);
    shownText.current = next;
    setValue(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [references]);

  // 参考区展开了多宽，就把提示词左边这么宽、4 行高的一块藏起来（再多一段渐隐）
  const ctx = useMemo(
    () => ({
      setCoverWidth: (width: number, duration?: string) => {
        const el = textRef.current;
        if (!el) return;
        const over = width - el.offsetLeft;
        el.style.setProperty('--kv-prompt-cover', over > 0 ? `${over + FADE}px` : '0px');
        if (duration) el.style.setProperty('--kv-prompt-cover-duration', duration);
      },
    }),
    [],
  );

  return (
    <PromptBoxContext.Provider value={ctx}>
      <div
        ref={ref}
        className={cx('kv-prompt-box', className)}
        data-dragover={dragging && !rejected ? '' : undefined}
        data-rejected={dragging && rejected ? '' : undefined}
        {...dropHandlers}
        {...rest}
      >
        <div className="kv-prompt-box__content">
          <div className="kv-prompt-box__refs">
            {framesNow ? (
              <ReferenceFramePair
                size={72}
                first={{ src: frames.first }}
                last={{ src: frames.last }}
                onSwap={(a, b) => setFrames({ first: a.src, last: b.src })}
                onAdd={(slot) => {
                  frameTarget.current = slot;
                  fileRef.current?.click();
                }}
                onRemove={(slot) => setFrames({ ...frames, [slot]: undefined })}
              />
            ) : (
              <ReferenceStack
                items={references}
                expanded={referencesExpanded}
                onExpandedChange={onReferencesExpandedChange}
                onAdd={onAddReference ?? (() => fileRef.current?.click())}
                onRemove={(id) => setReferences(references.filter((i) => i.id !== id))}
                onReorder={(from, to) => {
                  const next = [...references];
                  next.splice(to, 0, ...next.splice(from, 1));
                  setReferences(next);
                }}
                // 快捷 @（照线上）：点缩略图，把它以 @ 引用插进提示词
                onQuote={(item) => insertMention(textRef.current, named.find((i) => i.id === item.id) ?? item)}
              />
            )}
            <input ref={fileRef} type="file" multiple hidden accept={fileAccept} onChange={pickFiles} />
          </div>
          <PromptInput
            ref={setRefs}
            className="kv-prompt-box__input"
            aria-label={inputLabel}
            placeholder={placeholder ?? GEN_PLACEHOLDER[task]}
            style={{ maxHeight }}
            onInput={onInput}
            // 打 @ 弹出参考区的素材（首尾帧时没有）
            mentions={framesNow ? undefined : named}
          />
        </div>
        <div className="kv-prompt-box__toolbar">
          <div className="kv-prompt-box__toolbar-start">
            <TaskSelect placement={placement} value={task} onChange={(t) => setTask(t as GenTask)} />
            <GenToolbar
              kind={task}
              model={model}
              onModelChange={changeModel}
              refMode={refMode}
              onRefModeChange={(m) => switchVideo(modelOf('video'), m)}
              placement={placement}
              skills={skills}
              skillCategories={skillCategories}
              onPickSkill={onPickSkill}
              params={paramsOf(task)}
              onParamsChange={(p) => setParams((all) => ({ ...all, [task]: p }))}
            />
          </div>
          <div className="kv-prompt-box__toolbar-end">
            <GenActions
              kind={task}
              model={model}
              text={value}
              cost={cost ?? genCost(task, model)}
              reason={reason}
              generating={generating}
              onSubmit={submit}
              onStop={onStop}
              placement={placement}
              count={count}
              onCountChange={setCount}
            />
          </div>
        </div>
        <DropOverlay active={dragging} rejected={rejected} />
      </div>
    </PromptBoxContext.Provider>
  );
});
PromptBox.displayName = 'PromptBox';
