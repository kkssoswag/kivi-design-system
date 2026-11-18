import { useState, type ReactNode } from 'react';
import {
  AddTile,
  AttachmentStrip,
  Dropdown,
  Menu,
  MenuItem,
  NodePanel,
  NodePanelBar,
  NumberInput,
  ParamField,
  PromptInput,
  Select,
  Slider,
  TabItem,
  Tabs,
  placeholderImageSrc,
} from '@kivi';
import type { ToolId } from '../../data/tools';
import { EDIT_MODES, EXPAND_RATIOS } from './options';
import type { ToolState } from './types';

/*
  参数面板：每个工具一块，和画布节点下面的工具面板是同一套。
*/

/** 提示词：PromptInput 是不受控的，这里记下打的字（切工具再切回来接着显示），也决定生成按钮能不能点 */
function Prompt({ placeholder, initial, onText, oneLine }: { placeholder: string; initial: string; onText: (t: string) => void; oneLine?: boolean }) {
  const [init] = useState(initial); // 只在挂上时放进去，之后由用户编辑
  return (
    <PromptInput
      placeholder={placeholder}
      minRows={oneLine ? 1 : undefined}
      maxRows={oneLine ? 3 : undefined}
      onInput={(e) => onText(e.currentTarget.textContent ?? '')}
    >
      {init || undefined}
    </PromptInput>
  );
}

/** 一横条的参数面板：左边下拉、中间一行输入（字多了往上长，最多 3 行）、右边生成。没有提示词（元素消除）时中间空着 */
function PromptBar({ left, prompt, right }: { left: ReactNode; prompt: ReactNode; right: ReactNode }) {
  return (
    <NodePanel className="tpl-at__panel tpl-at__bar">
      <div className="tpl-at__bar-left">{left}</div>
      <div className="tpl-at__bar-input">{prompt}</div>
      {right}
    </NodePanel>
  );
}

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
  /** 有没有原图（拼接的第一段） */
  hasSource: boolean;
  pickExpandRatio: (v: string | null) => void;
}

export function ToolPanel({ tool, st, set, gen, promptKey, prompt, setPrompt, promptBar, hasSource, pickExpandRatio }: ToolPanelProps) {
  switch (tool) {
    case 'cutout':
      return (
        <NodePanel className="tpl-tool__panel">
          <NodePanelBar left={<Hint>自动识别主体，去掉背景</Hint>} right={gen} />
        </NodePanel>
      );
    case 'video-cutout':
      return (
        <NodePanel className="tpl-tool__panel">
          <ParamField label="输出模式">
            <Tabs variant="segment" value={st.cutoutOutput} onChange={(v) => set('cutoutOutput', v)} aria-label="输出模式">
              <TabItem value="alpha">透明视频</TabItem>
              <TabItem value="mask">蒙版视频</TabItem>
            </Tabs>
          </ParamField>
          <NodePanelBar right={gen} />
        </NodePanel>
      );
    case 'hd':
      return (
        <NodePanel className="tpl-tool__panel">
          <ParamField label="放大倍数">
            <Tabs variant="segment" value={st.hdScale} onChange={(v) => set('hdScale', v)} aria-label="放大倍数">
              <TabItem value="2">2 倍</TabItem>
              <TabItem value="4">4 倍</TabItem>
            </Tabs>
          </ParamField>
          <NodePanelBar right={gen} />
        </NodePanel>
      );
    case 'expand': {
      const ratioPicker = (
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
      );
      const expandPrompt = (
        <Prompt key={promptKey} initial={prompt} placeholder="描述扩出去的地方画什么，不填由 AI 自己补全" onText={setPrompt} oneLine={promptBar} />
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
            placeholder={st.editMode === 'redraw' ? '描述你想怎么改这张图' : '描述涂抹的地方要改成什么'}
            onText={setPrompt}
            oneLine={promptBar}
          />
        ) : null;
      const editLeft = (
        <>
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
          {st.editMode === 'remove' && <Hint>涂抹要去掉的东西</Hint>}
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
    case 'video-hd':
      return (
        <NodePanel className="tpl-tool__panel">
          <ParamField label="分辨率">
            <Tabs variant="segment" value={st.videoRes} onChange={(v) => set('videoRes', v)} aria-label="分辨率">
              {['720P', '1080P', '4K'].map((r) => (
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
          <NodePanelBar right={gen} />
        </NodePanel>
      );
    case 'loop':
      return (
        <NodePanel className="tpl-tool__panel">
          <ParamField label="过渡时长">
            <Tabs variant="segment" value={st.loop} onChange={(v) => set('loop', v)} aria-label="过渡时长">
              {[['auto', '自动'], ['1', '1s'], ['2', '2s'], ['3', '3s']].map(([v, l]) => (
                <TabItem key={v} value={v}>
                  {l}
                </TabItem>
              ))}
            </Tabs>
          </ParamField>
          <NodePanelBar right={gen} />
        </NodePanel>
      );
    case 'stitch':
      return (
        <NodePanel className="tpl-tool__panel">
          <ParamField label="按顺序拼接">
            <div className="tpl-at__strip">
              <AttachmentStrip
                aria-label="要拼接的视频"
                items={[
                  ...(hasSource ? [{ id: 'a', type: 'video' as const, name: '视频1', src: placeholderImageSrc('kivi-future', '16:9'), duration: '0:08', badge: '1' }] : []),
                  ...(st.stitchExtra ? [{ id: 'b', type: 'video' as const, name: '视频2', src: placeholderImageSrc('ip-gouache', '9:16'), duration: '0:05', badge: '2' }] : []),
                ]}
                onRemove={(id) => id === 'b' && set('stitchExtra', false)}
              />
              {!st.stitchExtra && <AddTile label="添加视频" onClick={() => set('stitchExtra', true)} />}
            </div>
          </ParamField>
          <NodePanelBar right={gen} />
        </NodePanel>
      );
  }
}
