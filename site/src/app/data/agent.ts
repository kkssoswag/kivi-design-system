import { ApiError, request } from './api';
import { scriptOf, pickScript, type Beat, type ScriptGenerate } from './agent-scripts';
import { db } from './db';
import { demo } from './demo';
import { uid } from './store';
import { submitTask } from './tasks';
import type { AgentBlock, AgentTurn, AgentUserMessage } from './types';

/*
  Agent 的假后端：发消息 → 随机挑一个剧本 → 一步步播（思考、逐字说话、工具调用一行行出、生成、等结果）。
  生成走 submitTask，和普通生成同一套（扣费、倒计时、失败退回、结果进素材）。
  播放进度存在 db 里，刷新后接着播。页面只调 sendAgent / stopAgent / regenerateAgent。
*/

/** 思考多久、工具调用每行隔多久、每 tick 出几个字 */
const THINK_MS = 1600;
const TOOL_MS = 700;
const TICK_MS = 50;
const CHARS_PER_TICK = 2;

const fill = (text: string, t: AgentTurn) =>
  text
    .replace('{prompt}', t.user.text.length > 20 ? `${t.user.text.slice(0, 20)}…` : t.user.text || '这个需求')
    .replace('{refs}', t.user.refs.length ? `参考了 ${t.user.refs.length} 个素材，` : '');

const patchTurn = (id: string, fn: (t: AgentTurn) => AgentTurn) =>
  db.set((s) => ({ ...s, agentTurns: s.agentTurns.map((t) => (t.id === id ? fn(t) : t)) }));

const lastBlock = (t: AgentTurn) => t.blocks[t.blocks.length - 1];
const replaceLast = (t: AgentTurn, b: AgentBlock): AgentTurn => ({ ...t, blocks: [...t.blocks.slice(0, -1), b] });
const next = (t: AgentTurn, now: number): AgentTurn => ({ ...t, step: t.step + 1, beatAt: now });

/** 往前走一小步：返回新的这一轮（没变化返回原对象） */
function advance(t: AgentTurn, now: number): AgentTurn {
  const beats = scriptOf(t.script).beats;
  const beat: Beat | undefined = beats[t.step];
  if (!beat) return { ...t, status: 'done' };
  const last = lastBlock(t);

  if ('think' in beat) {
    if (last?.kind !== 'thinking' || last.done) {
      if (demo.get().offline) return fail(t);
      return { ...t, beatAt: now, blocks: [...t.blocks, { kind: 'thinking', text: fill(beat.think, t), done: false }] };
    }
    return now - t.beatAt >= THINK_MS ? next(replaceLast(t, { ...last, done: true }), now) : t;
  }
  if ('say' in beat) {
    const text = fill(beat.say, t);
    if (last?.kind !== 'text' || last.text !== text) return { ...t, beatAt: now, blocks: [...t.blocks, { kind: 'text', text, shown: 0 }] };
    if (last.shown >= text.length) return next(t, now);
    return replaceLast(t, { ...last, shown: Math.min(text.length, last.shown + CHARS_PER_TICK) });
  }
  if ('tools' in beat) {
    if (last?.kind !== 'tools' || last.done) {
      if (demo.get().offline) return fail(t);
      return { ...t, beatAt: now, blocks: [...t.blocks, { kind: 'tools', steps: beat.tools, shown: 1, done: false }] };
    }
    if (now - t.beatAt < TOOL_MS) return t;
    if (last.shown < last.steps.length) return { ...replaceLast(t, { ...last, shown: last.shown + 1 }), beatAt: now };
    return next(replaceLast(t, { ...last, done: true }), now);
  }
  if ('generate' in beat) {
    // 创作页不出确认卡，到这一步直接提交生成（11-18 用户定）；提交完等结果出来再往下走
    if (last?.kind !== 'task') {
      if (!submitting.has(t.id)) void startGenerate(t.id, beat.generate);
      return t;
    }
    const task = db.get().tasks.find((x) => x.id === last.taskId);
    return !task || task.status !== 'running' ? next(t, now) : t;
  }
  return t;
}

function fail(t: AgentTurn): AgentTurn {
  return { ...t, status: 'failed', blocks: [...t.blocks, { kind: 'error', text: '网络连接失败，请检查网络后重试' }] };
}

/** 正在提交生成的那几轮，免得每个 tick 重复提交 */
const submitting = new Set<string>();

/** 扣费、提交任务，结果挂进这一轮。余额不足、断网就在这一轮里出错误卡，这一轮结束 */
async function startGenerate(turnId: string, g: ScriptGenerate) {
  const t = db.get().agentTurns.find((x) => x.id === turnId);
  if (!t) return;
  submitting.add(turnId);
  try {
    const task = await submitTask({
      kind: 'gen',
      media: g.media,
      where: { page: 'create', chatId: t.chatId },
      prompt: t.user.text,
      model: g.model,
      params: g.params,
      refs: t.user.refs.map((r) => ({ type: r.type, src: r.src })),
      ratio: g.ratio,
      count: g.count,
      cost: g.unitCost * g.count,
    });
    patchTurn(turnId, (x) => (x.status === 'running' ? { ...x, beatAt: Date.now(), blocks: [...x.blocks, { kind: 'task', taskId: task.id }] } : x));
  } catch (e) {
    const text = e instanceof ApiError && e.code === 'balance' ? '猕猴桃余额不足，这次没有生成' : e instanceof ApiError ? e.message : '生成没有发起，请稍后再试';
    patchTurn(turnId, (x) => (x.status === 'running' ? { ...x, status: 'failed', blocks: [...x.blocks, { kind: 'error', text }] } : x));
  } finally {
    submitting.delete(turnId);
  }
  tick();
}

// ---------- 计时：有回复中的才转 ----------

let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  const now = Date.now();
  const turns = db.get().agentTurns;
  if (turns.some((t) => t.status === 'running')) {
    let changed = false;
    const nextTurns = turns.map((t) => {
      if (t.status !== 'running') return t;
      const n = advance(t, now);
      if (n !== t) changed = true;
      return n;
    });
    if (changed) db.set((s) => ({ ...s, agentTurns: nextTurns }));
  }
  const running = db.get().agentTurns.some((t) => t.status === 'running');
  if (running && !timer) timer = setInterval(tick, TICK_MS);
  if (!running && timer) {
    clearInterval(timer);
    timer = undefined;
  }
}
if (typeof window !== 'undefined') tick();

// ---------- 动作 ----------

/** 发一条消息给 Agent：对话里多一轮，开始播剧本。断网会抛错 */
export function sendAgent(chatId: string, user: AgentUserMessage): Promise<AgentTurn> {
  return request(() => {
    const now = Date.now();
    const turn: AgentTurn = { id: uid('ag'), chatId, user, script: pickScript(), step: 0, beatAt: now, status: 'running', blocks: [], createdAt: now };
    db.set((s) => ({
      ...s,
      agentTurns: [...s.agentTurns, turn],
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, updatedAt: now, items: [...c.items, { kind: 'agent', id: turn.id }] } : c)),
    }));
    tick();
    return turn;
  });
}

/** 停止：停在当前进度，已经出来的内容留着（照线上） */
export function stopAgent(turnId: string) {
  patchTurn(turnId, (x) => {
    if (x.status !== 'running') return x;
    const blocks = x.blocks.map((b): AgentBlock => {
      if (b.kind === 'thinking' && !b.done) return { ...b, done: true };
      if (b.kind === 'tools' && !b.done) return { ...b, done: true };
      return b;
    });
    return { ...x, status: 'stopped', blocks };
  });
}

/** 重新生成：同一条用户消息，换一个剧本从头播 */
export function regenerateAgent(turnId: string) {
  return request(() => {
    patchTurn(turnId, (x) => ({ ...x, script: pickScript(x.script), step: 0, beatAt: Date.now(), status: 'running', blocks: [] }));
    tick();
  });
}

/** 这个对话里正在回复的那一轮 */
export const activeTurnOf = (turns: AgentTurn[], chatId: string) => turns.find((t) => t.chatId === chatId && t.status === 'running');
