import { SendButton } from '../agent/SendButton';
import { AgentControls, type AgentControlsProps } from './AgentControls';
import { AudioCharCount } from './AudioCharCount';
import { GenerateButton } from './GenerateButton';
import { CountSelect, ModelSelect, RefModeSelect, type GenSelectProps } from './GenSelects';
import { AudioModelControls, ImageModelControls, VideoModelControls } from './ModelControls';
import type { GenParamValues } from './GenParams';
import { charCount, type GenKind } from './gen-rules';

/*
  PromptBox 和 NodePanel 共用的工具条内容（11-17 用户定，只写这一份，不导出给页面用）：
  左边按任务 / 节点类型出模型和参数，右边是张数（音频是字数）和生成按钮，Agent 是发送按钮。
*/

type Placement = 'top-start' | 'bottom-start';

/** 其余属性给模型那一格（Agent 是选择模型浮层，不收） */
export interface GenToolbarProps extends Omit<GenSelectProps, 'value' | 'defaultValue' | 'onChange' | 'placement'> {
  kind: GenKind;
  model: string;
  onModelChange: (model: string) => void;
  refMode: string;
  onRefModeChange: (mode: string) => void;
  placement?: Placement;
  skills?: AgentControlsProps['skills'];
  skillCategories?: AgentControlsProps['skillCategories'];
  onPickSkill?: AgentControlsProps['onPickSkill'];
  /** 参数面板的值（受控），不传各面板自己存 */
  params?: GenParamValues;
  onParamsChange?: (params: GenParamValues) => void;
}

/** 工具条左边：模型、参考方式、参数，跟着任务 / 节点类型和模型变。不转发 ref：返回一串并排的控件，没有自己的根元素 */
export function GenToolbar({ kind, model, onModelChange, refMode, onRefModeChange, placement, skills, skillCategories, onPickSkill, params, onParamsChange, ...rest }: GenToolbarProps) {
  const values = { params, onParamsChange };
  switch (kind) {
    case 'agent':
      return <AgentControls placement={placement} skills={skills} skillCategories={skillCategories} onPickSkill={onPickSkill} />;
    case 'text':
      return <ModelSelect type="text" placement={placement} value={model} onChange={onModelChange} {...rest} />;
    case 'image':
      return <ImageModelControls placement={placement} model={model} onModelChange={onModelChange} {...values} {...rest} />;
    case 'video':
      return (
        <VideoModelControls
          placement={placement}
          model={model}
          onModelChange={onModelChange}
          refMode={<RefModeSelect placement={placement} value={refMode} onChange={onRefModeChange} />}
          {...values}
          {...rest}
        />
      );
    default:
      return <AudioModelControls placement={placement} model={model} onModelChange={onModelChange} {...values} {...rest} />;
  }
}
GenToolbar.displayName = 'GenToolbar';

export interface GenActionsProps {
  kind: GenKind;
  model: string;
  text: string;
  cost: number;
  /** 不能生成的原因：置灰 + 悬停说为什么 */
  reason?: string;
  /** 正在生成：生成按钮不能点（置灰），发送按钮变停止 */
  generating?: boolean;
  /** 提交了、请求还没回来：生成按钮转圈 */
  loading?: boolean;
  onSubmit?: () => void;
  /** Agent 回复中点了停止 */
  onStop?: () => void;
  placement?: Placement;
  /** 张数（受控，'1'–'4'），不传张数下拉自己存 */
  count?: string;
  onCountChange?: (count: string) => void;
}

/** 工具条右边：Agent 是发送按钮（没写字置灰）；文字只有生成按钮；音频是字数 / 上限 + 生成；图片、视频是张数 + 生成。不转发 ref：返回一两个并排的控件，没有自己的根元素 */
export function GenActions({ kind, model, text, cost, reason, generating, loading, onSubmit, onStop, placement, count, onCountChange }: GenActionsProps) {
  if (kind === 'agent') return <SendButton disabled={!generating && !text.trim()} generating={generating} onClick={generating ? onStop : onSubmit} />;
  const generate = <GenerateButton cost={cost} disabled={generating} disabledReason={generating ? undefined : reason} loading={loading} onClick={onSubmit} />;
  if (kind === 'text') return generate;
  return (
    <>
      {kind === 'audio' ? <AudioCharCount count={charCount(text)} model={model} /> : <CountSelect placement={placement} value={count} onChange={onCountChange} />}
      {generate}
    </>
  );
}
GenActions.displayName = 'GenActions';
