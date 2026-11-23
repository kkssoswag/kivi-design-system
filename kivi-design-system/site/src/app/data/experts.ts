import { GENERAL_EXPERT, expertOf } from '../../docs/business/expert-data';
import { db } from './db';
import { uid } from './store';
import type { CanvasChat, Chat, ExpertNote } from './types';

/*
  专家模式（飞书《KIVI PRD｜专家模式》）：每段对话（主站对话、画布里的一条 Agent 对话）记自己的专家。
  换专家在对话里留一条记录：主站对话排进 items，画布对话记在 notes（按时间和 Agent 的回合排在一起）。
  专家的技能是后台配好的预置技能，用户不能增删。专家的数据在 docs/business/expert-data.ts（线上是管理后台配的）。
*/

/** 哪段对话：主站对话 / 画布里的 Agent 对话 */
export type ExpertTarget = { kind: 'chat' | 'canvas'; id: string };

function patch(t: ExpertTarget, fn: <T extends Chat | CanvasChat>(x: T) => T) {
  db.set((s) =>
    t.kind === 'chat'
      ? { ...s, chats: s.chats.map((c) => (c.id === t.id ? fn(c) : c)) }
      : { ...s, canvasChats: s.canvasChats.map((c) => (c.id === t.id ? fn(c) : c)) },
  );
}

function withNote<T extends Chat | CanvasChat>(x: T, text: string, avatar?: string): T {
  const note: ExpertNote = { id: uid('note'), text, avatar, createdAt: Date.now() };
  if ('items' in x) {
    const chat = x as Chat;
    return { ...chat, items: [...chat.items, { kind: 'note', note }] } as T;
  }
  const cc = x as CanvasChat;
  return { ...cc, notes: [...(cc.notes ?? []), note] } as T;
}

/** 新对话、新画布带上首页的专家：留一条「XX 加入对话」。通用专家是默认，什么都不做 */
export function startExpert(t: ExpertTarget, expert: string) {
  if (expert === GENERAL_EXPERT) return;
  const e = expertOf(expert);
  patch(t, (x) => withNote({ ...x, expert, expertJoined: true }, `${e.name}加入对话`, e.avatar));
}

/** 换专家：第一次换成别的专家是「加入对话」，之后（包括切回通用专家）是「已切换为」 */
export function switchExpert(t: ExpertTarget, expert: string) {
  patch(t, (x) => {
    if ((x.expert ?? GENERAL_EXPERT) === expert) return x;
    const e = expertOf(expert);
    const back = expert === GENERAL_EXPERT;
    const text = x.expertJoined || back ? `已切换为${e.name}` : `${e.name}加入对话`;
    return withNote({ ...x, expert, expertJoined: x.expertJoined || !back }, text, e.avatar);
  });
}

/** 切换器问过、选了「不换，继续」：这段对话里不再建议这位专家 */
export function declineExpert(t: ExpertTarget, expert: string) {
  patch(t, (x) => ({ ...x, expertDeclined: [...(x.expertDeclined ?? []).filter((id) => id !== expert), expert] }));
}
