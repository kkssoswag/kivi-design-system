import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dropdown,
  Icon,
  Menu,
  MenuItem,
  NodePanel,
  NodePanelBar,
  NumberInput,
  ParamField,
  ParamPicker,
  PromptInput,
  Select,
  Slider,
  TabItem,
  Popover,
  Tabs,
} from '@kivi';
import type { ToolId } from '../../data/tools';
import { EDIT_MODELS, EDIT_MODES, EDIT_PROMPT_MAX, EXPAND_RATIOS, EXPAND_SCALES } from './options';
import type { ToolState } from './types';

/*
  参数面板：每个工具一块，和画布节点下面的工具面板是同一套。
*/

/** 提示词：PromptInput 是不受控的，这里记下打的字（切工具再切回来接着显示），也决定生成按钮能不能点 */
function Prompt({ placeholder, initial, onText, oneLine, maxLength }: { placeholder: string; initial: string; onText: (t: string) => void; oneLine?: boolean; maxLength?: number }) {
  const [init] = useState(initial); // 只在挂上时放进去，之后由用户编辑
  return (
    <PromptInput
      placeholder={placeholder}
      minRows={oneLine ? 1 : undefined}
      maxRows={oneLine ? 4 : undefined}
      maxLength={maxLength}
      onInput={(e) => onText(e.currentTarget.textContent ?? '')}
    >
      {init || undefined}
    </PromptInput>
  );
}

/** 量一行字有多宽（和输入框同字体），判断一横条里放不放得下 */
let ruler: CanvasRenderingContext2D | null = null;
function textWidth(text: string, el: HTMLElement) {
  ruler ??= document.createElement('canvas').getContext('2d');
  if (!ruler) return 0;
  const cs = getComputedStyle(el);
  ruler.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ruler.measureText(text).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
}

/**
 * 一横条的参数面板：左边下拉、中间一行输入、右边生成。没有提示词（元素消除）时中间空着。
 * 字一行放不下（或换了行）：输入挪到上面一整行、下面一排参数和生成，越打越高，最高 4 行（就是原来上下两排面板的高度），再多在框里滚；
 * 删到一行放得下又回到一横条。只改排版，输入框不重新挂，光标和字都在。
 */
function PromptBar({ left, prompt, right }: { left: ReactNode; prompt: ReactNode; right: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  // 一横条时输入区有多宽（挪上去以后量不到，记着回来时比）
  const lineWidth = useRef(0);
  const check = useCallback(() => {
    const el = box.current;
    const field = el?.querySelector<HTMLElement>('[contenteditable]');
    if (!el || !field) return setStacked(false);
    if (el.dataset.stacked === undefined) lineWidth.current = el.clientWidth;
    const text = field.innerText.replace(/\n+$/, '');
    setStacked(!!text && (text.includes('\n') || textWidth(text, field) > lineWidth.current));
  }, []);
  useLayoutEffect(check, [check, prompt]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [check]);
  return (
    <NodePanel className="tpl-at__panel tpl-at__bar" data-stacked={stacked ? '' : undefined}>
      <div className="tpl-at__bar-left">{left}</div>
      <div ref={box} className="tpl-at__bar-input" data-stacked={stacked ? '' : undefined} onInput={check}>
        {prompt}
      </div>
      <div className="tpl-at__bar-right">{right}</div>
    </NodePanel>
  );
}

/** 选一个值的下拉（无底 Select + 列表），参数面板一横条里用：触发器写当前值，列表里当前项用选中底色 */
function OptionSelect({ label, value, options, text, onChange }: { label: string; value: string; options: [string, string][]; text?: (label: string) => string; onChange: (v: string) => void }) {
  const cur = options.find(([v]) => v === value)?.[1] ?? '';
  return (
    <Dropdown
      haspopup="listbox"
      trigger={
        <Select variant="plain" aria-label={label}>
          {text ? text(cur) : cur}
        </Select>
      }
    >
      <Menu role="listbox" aria-label={label}>
        {options.map(([v, l]) => (
          <MenuItem key={v} selected={v === value} onClick={() => onChange(v)}>
            {l}
          </MenuItem>
        ))}
      </Menu>
    </Dropdown>
  );
}

const HD_SCALES: [string, string][] = [
  ['2', '2 倍'],
  ['4', '4 倍'],
];
const CUTOUT_OUTPUTS: [string, string][] = [
  ['alpha', '透明视频'],
  ['mask', '蒙版视频'],
];
const VIDEO_RES = ['720P', '1080P', '4K'];
const LOOP_LENGTHS: [string, string][] = [
  ['auto', '自动'],
  ['1', '1s'],
  ['2', '2s'],
  ['3', '3s'],
];

function Hint({ children }: { children: ReactNode }) {
  return <span className="tpl-at__hint">{children}</span>;
}

export interface ToolPanelProps {
  tool: ToolId;
  st: ToolState;
  set: <K extends keyof ToolState>(k: K, v: ToolState[K]) => void;
  /** 生成按钮 */
  gen: ReactNode;
  /** 提示词的键（智能编辑按编辑方式分开记） */
  promptKey: string;
  prompt: string;
  setPrompt: (t: string) => void;
  /** 扩图、智能编辑的提示词放成一横条 */
  promptBar?: boolean;
  /** 智能编辑的编辑方式固定、不出切换的下拉（画布节点工具栏用） */
  lockEdit?: boolean;
  /** 面板最上面多放的一块（画布工具节点放连进来的素材条）；放在每个面板的第一项前 */
  lead?: ReactNode;
  pickExpandRatio: (v: string | null) => void;
  /** 扩图倍数：原比例时点 1.5x / 2x / 3x */
  pickExpandScale: (v: string) => void;
}

export function ToolPanel({ tool, st, set, gen, promptKey, prompt, setPrompt, promptBar, lockEdit, lead, pickExpandRatio, pickExpandScale }: ToolPanelProps) {
  switch (tool) {
    case 'cutout':
      return (
        <NodePanel className="tpl-tool__panel">
          {lead}
          <NodePanelBar left={<Hint>自动识别主体，去掉背景</Hint>} right={gen} />
        </NodePanel>
      );
    // 只有一两个参数的工具：一横条，左边参数下拉、右边生成（11-19 用户定，和扩图、智能编辑一样；原来是标题 + 分段 + 生成三排）
    case 'video-cutout':
      return (
        <NodePanel className="tpl-tool__panel">
          {lead}
          <NodePanelBar
            left={<OptionSelect label="输出模式" value={st.cutoutOutput} options={CUTOUT_OUTPUTS} onChange={(v) => set('cutoutOutput', v)} />}
            right={gen}
          />
        </NodePanel>
      );
    case 'hd':
      return (
        <NodePanel className="tpl-tool__panel">
          {lead}
          <NodePanelBar
            left={<OptionSelect label="放大倍数" value={st.hdScale} options={HD_SCALES} text={(l) => `放大 ${l}`} onChange={(v) => set('hdScale', v)} />}
            right={gen}
          />
        </NodePanel>
      );
    case 'expand': {
      const ratioPicker = (
        <>
        <Dropdown
          haspopup="listbox"
          trigger={
            <Select variant="plain" leftIcon={EXPAND_RATIOS.find((o) => o.value === st.expandRatio)?.icon} aria-label="扩图比例">
              {EXPAND_RATIOS.find((o) => o.value === st.expandRatio)?.label}
            </Select>
          }
        >
          <Menu role="listbox" aria-label="扩图比例">
            {EXPAND_RATIOS.map((o) => (
              <MenuItem key={o.value} icon={o.icon} selected={o.value === st.expandRatio} disabled={o.disabled} onClick={() => pickExpandRatio(o.value)}>
                {o.label}
              </MenuItem>
            ))}
          </Menu>
        </Dropdown>
        {/* 倍数只在原比例时出（照即梦）：原图四周一起往外扩到几倍；手动拖了框就哪个都不选，入口写「倍数」 */}
        {st.expandRatio === 'original' && (
          <Dropdown
            haspopup="listbox"
            trigger={
              <Select variant="plain" aria-label="扩图倍数">
                {st.expandScale ? `${st.expandScale}x` : '倍数'}
              </Select>
            }
          >
            <Menu role="listbox" aria-label="扩图倍数">
              {EXPAND_SCALES.map((v) => (
                <MenuItem key={v} selected={v === st.expandScale} onClick={() => pickExpandScale(v)}>
                  {`${v}x`}
                </MenuItem>
              ))}
            </Menu>
          </Dropdown>
        )}
        </>
      );
      const expandPrompt = (
        <Prompt key={promptKey} initial={prompt} placeholder="描述希望扩展出的画面内容，不填将自动补全" onText={setPrompt} oneLine={promptBar} />
      );
      return promptBar ? (
        <PromptBar left={ratioPicker} prompt={expandPrompt} right={gen} />
      ) : (
        <NodePanel className="tpl-at__panel">
          {expandPrompt}
          <NodePanelBar left={ratioPicker} right={gen} />
        </NodePanel>
      );
    }
    case 'edit': {
      const editPrompt =
        st.editMode !== 'remove' ? (
          <Prompt
            key={promptKey}
            initial={prompt}
            placeholder={st.editMode === 'redraw' ? '描述希望如何修改这张图片' : '描述希望如何修改涂抹区域'}
            onText={setPrompt}
            oneLine={promptBar}
            maxLength={EDIT_PROMPT_MAX}
          />
        ) : null;
      const model = EDIT_MODELS.find((o) => o.value === st.editModel);
      const editLeft = (
        <>
          {!lockEdit && (
          <Dropdown
            haspopup="listbox"
            trigger={
              <Select variant="plain" leftIcon={EDIT_MODES.find((o) => o.value === st.editMode)?.icon} aria-label="编辑方式">
                {EDIT_MODES.find((o) => o.value === st.editMode)?.label}
              </Select>
            }
          >
            <Menu role="listbox" aria-label="编辑方式">
              {EDIT_MODES.map((o) => (
                <MenuItem key={o.value} icon={o.icon} selected={o.value === st.editMode} disabled={o.disabled} onClick={() => set('editMode', o.value)}>
                  {o.label}
                </MenuItem>
              ))}
            </Menu>
          </Dropdown>
          )}
          {/* 只有智能重绘能选模型，局部重绘、元素去除用固定的 */}
          {st.editMode === 'redraw' && (
            <Dropdown
              haspopup="listbox"
              trigger={
                <Select variant="plain" leftIcon={model?.icon} aria-label="模型">
                  {model?.label}
                </Select>
              }
            >
              <Menu role="listbox" aria-label="模型">
                {EDIT_MODELS.map((o) => (
                  <MenuItem key={o.value} icon={o.icon} selected={o.value === st.editModel} onClick={() => set('editModel', o.value as string)}>
                    {o.label}
                  </MenuItem>
                ))}
              </Menu>
            </Dropdown>
          )}
          {st.editMode === 'remove' && <Hint>涂抹需要去除的区域，AI 将自动补全背景</Hint>}
        </>
      );
      return promptBar ? (
        <PromptBar left={editLeft} prompt={editPrompt} right={gen} />
      ) : (
        <NodePanel className="tpl-at__panel">
          {editPrompt}
          <NodePanelBar left={editLeft} right={gen} />
        </NodePanel>
      );
    }
    // 两个参数放一起调：参数选择（触发器写「1080P · 30fps」，点开是参数浮层，和生成面板的视频参数同一套）
    case 'video-hd':
      return (
        <NodePanel className="tpl-tool__panel">
          {lead}
          <NodePanelBar
            left={
              <ParamPicker summary={`${st.videoRes} · ${st.fps}fps`} aria-label="视频高清参数" placement="top-start">
                <ParamField label="分辨率">
                  <Tabs variant="segment" value={st.videoRes} onChange={(v) => set('videoRes', v)} aria-label="分辨率">
                    {VIDEO_RES.map((r) => (
                      <TabItem key={r} value={r}>
                        {r}
                      </TabItem>
                    ))}
                  </Tabs>
                </ParamField>
                <ParamField label="帧速率">
                  <div className="tpl-tool__slider">
                    <Slider aria-label="帧速率" min={15} max={60} value={st.fps} onChange={(v) => set('fps', v)} />
                    <NumberInput
                      aria-label="帧速率数值"
                      min={15}
                      max={60}
                      unit="fps"
                      value={st.fps}
                      onChange={(v) => v !== '' && !Number.isNaN(Number(v)) && set('fps', Number(v))}
                    />
                  </div>
                </ParamField>
              </ParamPicker>
            }
            right={gen}
          />
        </NodePanel>
      );
    case 'loop':
      return (
        <NodePanel className="tpl-tool__panel">
          {lead}
          <NodePanelBar
            left={
              <ParamPicker summary={`过渡时长 ${LOOP_LENGTHS.find(([v]) => v === st.loop)?.[1] ?? ''}`} aria-label="视频循环参数" placement="top-start">
                <ParamField
                  label={
                    <span className="tpl-at__label-tip">
                      过渡时长
                      {/* 说明性的话用 Popover，Tooltip 只写工具名（设计规则「提示」） */}
                      <Popover content="在首尾之间补出过渡画面，让视频循环播放时不跳">
                        <span className="tpl-at__label-info" tabIndex={0} role="img" aria-label="过渡时长说明">
                          <Icon name="Lightbulb" size={16} />
                        </span>
                      </Popover>
                    </span>
                  }
                >
                  <Tabs variant="segment" value={st.loop} onChange={(v) => set('loop', v)} aria-label="过渡时长">
                    {LOOP_LENGTHS.map(([v, l]) => (
                      <TabItem key={v} value={v}>
                        {l}
                      </TabItem>
                    ))}
                  </Tabs>
                </ParamField>
              </ParamPicker>
            }
            right={gen}
          />
        </NodePanel>
      );
    case 'stitch':
      return (
        <NodePanel className="tpl-tool__panel">
          {lead}
          {/* 左边一句说明（和抠图一样）；拼完一次换成「继续拼接」 */}
          <NodePanelBar left={<Hint>将两段视频按顺序拼接为一段</Hint>} right={gen} />
        </NodePanel>
      );
  }
}
