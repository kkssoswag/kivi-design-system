import { EXPERT_SKILL_ITEMS, expertOf } from '../../docs/business/expert-data';
import { db } from './db';
import { uid } from './store';
import type { CanvasChat, Chat, ChatExpert, ExpertNote } from './types';

/*
  专家模式（飞书《KIVI PRD｜专家模式》）：每段对话（主站对话、画布里的一条 Agent 对话）记自己的专家和技能清单。
  换专家、调技能都在对话里留一条记录：主站对话排进 items，画布对话记在 notes（按时间和 Agent 的回合排在一起）。
  专家、技能的数据在 docs/business/expert-data.ts（线上是管理后台配的）。
*/

/** 哪段对话：主站对话 / 画布里的 Agent 对话 */
export type ExpertTarget = { kind: 'chat' | 'canvas'; id: string };

const presetIds = (expert: string) => (expertOf(expert).skills ?? []).map((s) => s.id);

/** 这段对话里专家的技能（技能 id）：调过就是调过的，没调过是预置 + 自己加过的 */
export function skillIdsOf(x?: ChatExpert): string[] {
  const p = presetIds(x?.expert ?? 'none');
  return x?.expertSkills ?? [...p, ...(x?.expertAdded ?? []).filter((id) => !p.includes(id))];
}

export const skillsOfIds = (ids: string[]) => ids.flatMap((id) => EXPERT_SKILL_ITEMS.filter((s) => s.id === id));

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

/** 新对话、新画布带上首页的专家：留一条「XX 加入对话」。无需专家什么都不做 */
export function startExpert(t: ExpertTarget, expert: string) {
  if (expert === 'none') return;
  const e = expertOf(expert);
  patch(t, (x) => withNote({ ...x, expert, expertJoined: true }, `${e.name}加入对话`, e.avatar));
}

/** 换专家：清单换成新专家的预置，自己加的保留。第一次是「加入对话」，之后是「已切换为」 */
export function switchExpert(t: ExpertTarget, expert: string) {
  patch(t, (x) => {
    if ((x.expert ?? 'none') === expert) return x;
    const e = expertOf(expert);
    const text = x.expertJoined || expert === 'none' ? `已切换为${e.name}` : `${e.name}加入对话`;
    return withNote({ ...x, expert, expertSkills: undefined, expertJoined: x.expertJoined || expert !== 'none' }, text, e.avatar);
  });
}

/** 调技能：记下清单和自己加的（不在预置里的） */
export function setExpertSkills(t: ExpertTarget, ids: string[]) {
  patch(t, (x) => {
    const p = presetIds(x.expert ?? 'none');
    return { ...x, expertSkills: ids, expertAdded: ids.filter((id) => !p.includes(id)) };
  });
}

/** 技能面板关上：和打开时比，变了就留一条「已调整技能：添加 A，移除 B」 */
export function noteSkillChange(t: ExpertTarget, before: string[], after: string[]) {
  const name = (id: string) => skillsOfIds([id])[0]?.title ?? id;
  const plus = after.filter((id) => !before.includes(id)).map(name);
  const minus = before.filter((id) => !after.includes(id)).map(name);
  if (!plus.length && !minus.length) return;
  const parts = [plus.length ? `添加 ${plus.join('、')}` : '', minus.length ? `移除 ${minus.join('、')}` : ''].filter(Boolean);
  patch(t, (x) => withNote(x, `已调整技能：${parts.join('，')}`, expertOf(x.expert ?? 'none').avatar));
}
