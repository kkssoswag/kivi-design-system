import { ActionCard, MessageFeedback, ProcessGroup, ReferenceItem, ThinkingBlock, UserMessage, type IconName } from '@kivi';
import { regenerateAgent } from '../../data/agent';
import type { AgentTurn as AgentTurnData, Asset, Task } from '../../data/types';
import { attempt } from '../../flows/errors';
import { TaskGrid } from './GenRecordView';
import type { TileContext } from './tiles';

/*
  主站 Agent 的一轮：用户消息（文字 + 带的素材）→ 回复的各块（思考、文字逐字出、工具调用、结果、出错）→ 反馈条。
  内容全来自 data/agent.ts 播出来的数据，这里只画。结果是普通任务，用和记录一样的结果格（收藏、删除、看大图都一样）。
*/

export interface AgentTurnProps {
  turn: AgentTurnData;
  tasks: Map<string, Task>;
  assets: Map<string, Asset>;
  ctx: TileContext;
}

export function AgentTurn({ turn, tasks, assets, ctx }: AgentTurnProps) {
  const busy = turn.status === 'running';
  // 反馈条复制的是回复里所有文字
  const reply = turn.blocks
    .filter((b) => b.kind === 'text')
    .map((b) => (b.kind === 'text' ? b.text.slice(0, b.shown) : ''))
    .join('\n');

  return (
    <div className="tpl-turn">
      <UserMessage
        assets={
          turn.user.refs.length > 0 && (
            <>
              {turn.user.refs.map((r, i) => (
                <ReferenceItem key={i} type={r.type} src={r.type === 'audio' ? undefined : r.src} duration={r.duration} />
              ))}
            </>
          )
        }
      >
        {turn.user.text}
      </UserMessage>

      {turn.blocks.map((b, i) => {
        switch (b.kind) {
          case 'thinking':
            return (
              <ThinkingBlock key={i} thinking={!b.done}>
                {b.text}
              </ThinkingBlock>
            );
          case 'text':
            return (
              <div key={i} className="tpl-text">
                {b.text.slice(0, b.shown)}
              </div>
            );
          case 'tools':
            return (
              <ProcessGroup
                key={i}
                running={!b.done}
                steps={b.steps.slice(0, b.shown).map((s, k) => ({
                  id: `${turn.id}-${i}-${k}`,
                  icon: s.icon as IconName,
                  action: s.action,
                  object: s.object,
                  status: !b.done && k === b.shown - 1 ? 'running' : 'done',
                }))}
              />
            );
          case 'task': {
            const task = tasks.get(b.taskId);
            return task && task.status !== 'cancelled' ? <TaskGrid key={i} task={task} assets={assets} ctx={ctx} /> : null;
          }
          case 'error':
            return <ActionCard key={i} type="error" description={b.text} />;
          default:
            return null;
        }
      })}

      {/* 回复完、停止、出错后才出反馈条（照线上） */}
      {!busy && <MessageFeedback text={reply} traceId={`trace-${turn.id}`} onRegenerate={() => void attempt(() => regenerateAgent(turn.id))} />}
    </div>
  );
}
