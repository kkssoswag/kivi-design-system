import { useMemo } from 'react';
import type { AgentTurn as AgentTurnData, Asset, Chat, Task } from '../../data/types';
import { AgentTurn } from './AgentTurn';
import { GenRecordView } from './GenRecordView';
import type { TileContext } from './tiles';

/*
  记录流：对话里的每一项按顺序排下来，生成任务一条记录，Agent 一轮一段（data/agent.ts 播的）。
  任务已经被删掉、取消了的项直接跳过。
*/

export interface RecordFeedProps {
  chat: Chat;
  tasks: Task[];
  assets: Asset[];
  agentTurns: AgentTurnData[];
  ctx: TileContext;
  /** 从第几项开始显示（更早的还没加载） */
  start?: number;
}

export function RecordFeed({ chat, tasks, assets, agentTurns, ctx, start = 0 }: RecordFeedProps) {
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const turnById = useMemo(() => new Map(agentTurns.map((t) => [t.id, t])), [agentTurns]);
  return (
    <>
      {chat.items.slice(start).map((it) => {
        if (it.kind === 'agent') {
          const turn = turnById.get(it.id);
          return turn ? <AgentTurn key={it.id} turn={turn} tasks={taskById} assets={assetById} ctx={ctx} /> : null;
        }
        const task = taskById.get(it.taskId);
        if (!task || task.status === 'cancelled') return null;
        return <GenRecordView key={task.id} task={task} assets={assetById} ctx={ctx} />;
      })}
    </>
  );
}
