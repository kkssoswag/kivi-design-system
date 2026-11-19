import { forwardRef, useLayoutEffect, useRef, useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { IconButton } from '../button';
import { toast } from '../feedback';
import { useControllable } from '../hooks';
import { AttachmentStrip, type AttachmentItem } from '../reference/AttachmentStrip';
import { ReferenceFramePair, type ReferenceFrameSlot } from '../reference/ReferenceFramePair';
import { referenceLabels } from '../reference/ReferenceStack';
import { GenActions, GenToolbar } from '../generation/gen-controls';
import { GEN_NODE_PLACEHOLDER, PROMPT_MAX_LENGTH, genBlockedReason, genCost, isFramesMode, type GenNodeType } from '../generation/gen-rules';
import { GEN_PARAM_DEFAULTS, type GenParamValues } from '../generation/GenParams';
import { fallbackParams } from '../generation/model-caps';
import { DEFAULT_MODEL } from '../generation/options';
import { PromptInput } from '../generation/PromptInput';
import { insertMention, promptText, syncMentions } from '../generation/mentions';
import { cx } from '../utils';
import './canvas.css';

/*
  「模板 · 画布」页的模板：生成面板。
  它在 Figma 里是模板，不是组件：里面放什么按钮、什么参数，随节点类型和模型变，复制整条改内容。
  传了 type 就是完整的生成面板（11-17 用户定，状态都在组件里，画布、模板只传状态）：参考素材、提示词、模型和参数、
  参考方式和首尾帧、不能生成的原因、生成按钮，规则和主站 PromptBox 共用 generation/gen-rules.ts。
  不传 type 只是外框（工具面板用：抠图、高清这些），里面自己放 AttachmentStrip、参数、NodePanelBar。
  节点工具栏 glass 44，画布工具栏 surface 56：都不在这里，是 ButtonGroup。
*/

export interface NodePanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 右上角的全屏按钮：IconButton 32 · 无底灰，图标 FullScreen */
  expand?: boolean;
  /** 点了全屏按钮 */
  onExpand?: () => void;
  /** 生成节点的类型：文字 / 图片 / 视频 / 音频。传了就是完整的生成面板；不传只是外框，里面放 children（工具面板） */
  type?: GenNodeType;
  /** 参考素材：连进来的上游节点，按连接顺序排，右上角自动写「图片1、视频1」（每种类型各自编号），点缩略图把它 @ 进提示词。文字节点不显示。首尾帧时前两张图片是首帧、尾帧；附件条里不能删（连线才是来源），首尾帧里能删 */
  references?: AttachmentItem[];
  /** 首尾帧里点了删除，参数是那张图的 `id`（上游节点）：断开这条连线 */
  onRemoveReference?: (id: string) => void;
  /** 首尾帧里点了空格的添加格，参数是哪一格：上传一张图，新建图片节点连进来（照线上） */
  onAddReference?: (slot: ReferenceFrameSlot) => void;
  /** 附件条里拖着排序，参数是挪的那个 `id` 和挪到哪个 `id` 的位置：改连线的顺序，名字（图片1…）跟着变。不分类型，随便换（11-18 用户定）。不传就不能拖 */
  onReorderReference?: (id: string, targetId: string) => void;
  /** 开头的提示词（只在第一次渲染时用，之后由用户编辑） */
  defaultValue?: ReactNode;
  /** 提示词变了，参数是现在的文字 */
  onChange?: (text: string) => void;
  /** 模型（值）。传了就是受控；不传用这个类型的默认模型 */
  model?: string;
  /** 非受控时一开始的模型 */
  defaultModel?: string;
  /** 换了模型 */
  onModelChange?: (model: string) => void;
  /** 视频的参考方式，同 PromptBox。换模型时回到全能参考 */
  refMode?: string;
  /** 非受控时一开始的参考方式，默认全能参考 */
  defaultRefMode?: string;
  /** 换了参考方式 */
  onRefModeChange?: (mode: string) => void;
  /** 参数（比例、分辨率、时长…）。传了就是受控；画布里每个节点记住自己的参数 */
  params?: GenParamValues;
  /** 非受控时一开始的参数，不传用这个类型的默认值 */
  defaultParams?: GenParamValues;
  /** 改了参数（换模型回落时也会触发） */
  onParamsChange?: (params: GenParamValues) => void;
  /** 张数（图片、视频，'1'–'4'）。传了就是受控 */
  count?: string;
  /** 非受控时一开始的张数，默认 '1' */
  defaultCount?: string;
  onCountChange?: (count: string) => void;
  /** 点了生成，带上这次的提示词、模型、参考方式、实际生效的参数、是不是首尾帧。不能生成时（按钮置灰）不触发 */
  onGenerate?: (submit: NodePanelSubmit) => void;
  /** 正在生成：生成按钮置灰 */
  generating?: boolean;
  /** 消耗的猕猴桃数。不传按类型和模型取示例数字 */
  cost?: number;
  /** 没输入时的占位文字，默认「描述任何你想要生成的内容」 */
  placeholder?: string;
}

/** 点生成时带出来的东西 */
export interface NodePanelSubmit {
  text: string;
  model: string;
  refMode: string;
  /** 按当前模型实际生效的参数（不支持的已回落到默认） */
  params: GenParamValues;
  /** 张数：图片、视频按选的，文字、音频是 1 */
  count: number;
  /** 视频是不是首尾帧方式；是的话 frames 是首帧、尾帧的上游 id（互换过就是换过的顺序） */
  frames?: { first?: string; last?: string };
}

/** 生成面板：选中节点后出现在节点下方。竖排三块：参考素材（AttachmentStrip，首尾帧时 ReferenceFramePair）、PromptInput（提示词）、NodePanelBar（模型选择栏） */
export const NodePanel = forwardRef<HTMLDivElement, NodePanelProps>(function NodePanel(
  {
    expand,
    onExpand,
    type,
    references = [],
    onRemoveReference,
    onAddReference,
    onReorderReference,
    defaultValue,
    onChange,
    model: modelProp,
    defaultModel,
    onModelChange,
    refMode: refModeProp,
    defaultRefMode = 'omni',
    onRefModeChange,
    params: paramsProp,
    defaultParams = {},
    onParamsChange,
    count: countProp,
    defaultCount = '1',
    onCountChange,
    onGenerate,
    generating,
    cost,
    placeholder = GEN_NODE_PLACEHOLDER,
    className,
    children,
    ...rest
  },
  ref,
) {
  const [model, setModel] = useControllable(modelProp, defaultModel ?? (type ? DEFAULT_MODEL[type] : ''), onModelChange);
  const [refMode, setRefMode] = useControllable(refModeProp, defaultRefMode, onRefModeChange);
  // 参数面板的值：换模型时新模型不支持的值改回默认并提示一声（和主站输入框一样）。实际在用的值按当前模型支持的算
  const [rawParams, setRawParams] = useControllable(paramsProp, defaultParams, onParamsChange);
  const [count, setCount] = useControllable(countProp, defaultCount, onCountChange);
  const params = type && type !== 'text' ? fallbackParams(type, model, { ...GEN_PARAM_DEFAULTS[type], ...rawParams }).values : {};
  const changeModel = (m: string) => {
    if (type && type !== 'text') {
      const { values, changed } = fallbackParams(type, m, params);
      if (changed) {
        setRawParams(values);
        toast.info('所选模型不支持当前参数，已调整为默认值');
      }
    }
    setModel(m);
    // 换模型时参考方式回到全能参考（照线上）
    setRefMode('omni');
  };
  const [text, setText] = useState(typeof defaultValue === 'string' ? defaultValue : '');
  const inputRef = useRef<HTMLDivElement>(null);
  // 参考素材按连接顺序、每种类型各自编号（图片1、视频1…），和右上角、@ 出来的一致
  const labels = referenceLabels(references.map((r) => r.type));
  const named = references.map((r, i) => ({ ...r, name: labels[i] }));
  const namesKey = named.map((r) => `${r.id}:${r.name}`).join('\n');
  // 断开了连线、换了顺序：提示词里的 @ 标签跟着删、跟着改名
  useLayoutEffect(() => {
    if (!syncMentions(inputRef.current, named)) return;
    const next = promptText(inputRef.current);
    setText(next);
    onChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);
  // 首尾帧互换过没有：连进来的图变了就作废，回到按连接顺序
  const [swap, setSwap] = useState({ key: '', on: false });

  let body: ReactNode = children;
  if (type) {
    const frames = type === 'video' && isFramesMode(model, refMode);
    // 首尾帧：连进来的前两张图片按顺序当首帧、尾帧（照线上画布）
    const images = references.filter((r) => r.type === 'image');
    const imageKey = images.map((r) => r.id).join('\n');
    const swapped = swap.on && swap.key === imageKey;
    const [firstImg, lastImg] = swapped ? [images[1], images[0]] : [images[0], images[1]];
    const reason = genBlockedReason({
      kind: type,
      text,
      model,
      refMode,
      referenceTypes: references.map((r) => r.type),
      hasFirstFrame: !!firstImg?.src,
    });
    const onInput = (e: FormEvent<HTMLDivElement>) => {
      const next = promptText(e.currentTarget);
      setText(next);
      onChange?.(next);
    };
    body = (
      <>
        {type !== 'text' &&
          (frames ? (
            <ReferenceFramePair
              first={{ id: firstImg?.id, src: firstImg?.src }}
              last={{ id: lastImg?.id, src: lastImg?.src }}
              onSwap={() => setSwap({ key: imageKey, on: !swapped })}
              onAdd={onAddReference}
              onRemove={onRemoveReference && ((_, frame) => frame.id && onRemoveReference(frame.id))}
            />
          ) : (
            references.length > 0 && (
              <AttachmentStrip
                items={named}
                aria-label="参考图"
                labels
                onReorder={onReorderReference && ((from, to) => onReorderReference(references[from].id, references[to].id))}
                // 快捷 @（照线上）：点缩略图，把它以 @ 引用插进提示词
                onQuote={(item) => insertMention(inputRef.current, item)}
              />
            )
          ))}
        <PromptInput ref={inputRef} placeholder={placeholder} maxLength={PROMPT_MAX_LENGTH} onInput={onInput} mentions={frames ? undefined : named}>
          {defaultValue}
        </PromptInput>
        <NodePanelBar
          left={
            <GenToolbar
              kind={type}
              model={model}
              onModelChange={changeModel}
              refMode={refMode}
              onRefModeChange={setRefMode}
              params={type === 'text' ? undefined : params}
              onParamsChange={setRawParams}
            />
          }
          right={
            <GenActions
              kind={type}
              model={model}
              text={text}
              cost={cost ?? genCost(type, model)}
              reason={reason}
              generating={generating}
              count={count}
              onCountChange={setCount}
              onSubmit={() =>
                !reason &&
                !generating &&
                onGenerate?.({
                  text,
                  model,
                  refMode,
                  params,
                  count: type === 'image' || type === 'video' ? Number(count) : 1,
                  frames: frames ? { first: firstImg?.id, last: lastImg?.id } : undefined,
                })
              }
            />
          }
        />
      </>
    );
  }

  return (
    <div ref={ref} className={cx('kv-node-panel', className)} {...rest}>
      {body}
      {expand && <IconButton icon="FullScreen" label="全屏" variant="ghost-muted" className="kv-node-panel__expand" onClick={onExpand} />}
    </div>
  );
});
NodePanel.displayName = 'NodePanel';

export interface NodePanelBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 左边：模型、质量、比例等下拉（Select · 无底），间距 6 */
  left?: ReactNode;
  /** 右边：数量下拉和生成按钮，间距 8 */
  right?: ReactNode;
}

/** 生成面板的模型选择栏：高 32，左边下拉、右边数量和生成按钮 */
export const NodePanelBar = forwardRef<HTMLDivElement, NodePanelBarProps>(function NodePanelBar(
  { left, right, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cx('kv-node-panel__bar', className)} {...rest}>
      <div className="kv-node-panel__bar-left">{left}</div>
      <div className="kv-node-panel__bar-right">{right}</div>
    </div>
  );
});
NodePanelBar.displayName = 'NodePanelBar';
