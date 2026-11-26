import { useState } from 'react';
import { ActionCard, Button, QuestionOption, QuestionPanel } from '@kivi';
import { answerConfirm, answerLark, answerQuestion } from '../data/agent';
import { LARK_DESCRIPTION } from '../data/agent-scripts';
import type { AgentBlock, AgentQuestion, AgentTurn } from '../data/types';

/*
  中断面板（照线上 ChatInterruptPanel）：Agent 等用户回话时，卡片停在输入框的位置、换掉输入框，宽度和输入框一样；
  答完卡片消失、输入框回来，消息里留一行询问记录（AgentTurn 里画 AskRecord）。主站对话和画布 Agent 共用。
  三种：生成确认（画布手动模式）、问题卡、飞书授权。用的地方：interruptOf(turn) 有值就画 <AgentInterrupt>、藏起输入框（不卸载，写了一半的字还在）。
*/

type Pending = Extract<AgentBlock, { kind: 'confirm' | 'question' | 'lark' }>;

/** 这一轮正在等用户回答的那张卡；没有就是 undefined */
export function interruptOf(turn: AgentTurn | undefined): Pending | undefined {
  if (turn?.status !== 'waiting') return undefined;
  const last = turn.blocks[turn.blocks.length - 1];
  if (last?.kind === 'confirm' && !last.answer) return last;
  if (last?.kind === 'question' && !last.answers && !last.skipped) return last;
  if (last?.kind === 'lark' && !last.answer) return last;
  return undefined;
}

export interface AgentInterruptProps {
  turn: AgentTurn;
  className?: string;
  /** 生成确认卡「点击查看节点参数」：定位到画布节点 */
  onLocate?: (nodeIds: string[]) => void;
}

export function AgentInterrupt({ turn, className, onLocate }: AgentInterruptProps) {
  const card = interruptOf(turn);
  if (!card) return null;
  if (card.kind === 'question') return <QuestionCard key={turn.id} turnId={turn.id} questions={card.questions} className={className} />;
  if (card.kind === 'lark') return <LarkCard key={turn.id} turnId={turn.id} title={card.title} className={className} />;
  return (
    <ActionCard
      className={className}
      title={`是否确认${card.nodeIds.length}个节点生成?`}
      description={
        <>
          {card.cost > 0 && `预计消耗 ${card.cost}猕猴桃 · `}
          <a className="kv-action-card__link" href="#" onClick={(e) => (e.preventDefault(), onLocate?.(card.nodeIds))}>
            点击查看节点参数
          </a>
        </>
      }
      actions={
        <>
          <Button variant="secondary" onClick={() => answerConfirm(turn.id, false)}>
            取消
          </Button>
          <Button variant="primary" onClick={() => answerConfirm(turn.id, true)}>
            确认生成
          </Button>
        </>
      }
    />
  );
}

// ---------- 问题卡 ----------

type Answer = { picked: string[]; other: string };
const EMPTY: Answer = { picked: [], other: '' };
const complete = (a: Answer) => a.picked.length > 0 || a.other.trim() !== '';

/** 问题题目：多选后面写「【多选 已选/总数】」（照线上） */
const titleOf = (q: AgentQuestion, i: number, a: Answer) => `${i + 1}. ${q.title}${q.multiple ? `【多选${a.picked.length}/${q.options.length}】` : ''}`;

/** 一题的答案写成一句：选的项 + 「其他」里的字，用顿号连 */
const sentenceOf = (q: AgentQuestion, a: Answer) => [...a.picked.map((v) => q.options[Number(v)]), ...(a.other.trim() ? [a.other.trim()] : [])].join('、');

/**
 * 照线上问题卡：一页一题，多题时右上角翻页；没到最后一题是「下一个」（这题答完才能点），最后一题「确认提交」；
 * 「忽略」整张跳过。每题的作答记在这里，翻回去还在
 */
function QuestionCard({ turnId, questions, className }: { turnId: string; questions: AgentQuestion[]; className?: string }) {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => EMPTY));
  const q = questions[page];
  const a = answers[page] ?? EMPTY;
  const last = page === questions.length - 1;
  const set = (patch: Partial<Answer>) => setAnswers((all) => all.map((x, i) => (i === page ? { ...x, ...patch } : x)));

  const submit = () => {
    // 翻页跳过了没答的：先翻到第一道没答的
    const missing = answers.findIndex((x) => !complete(x));
    if (missing >= 0) return setPage(missing);
    answerQuestion(turnId, questions.map((x, i) => sentenceOf(x, answers[i])));
  };

  return (
    <QuestionPanel
      key={page}
      className={className}
      title={titleOf(q, page, a)}
      pager={questions.length > 1 ? `${page + 1}/${questions.length}` : undefined}
      prevDisabled={page === 0}
      nextDisabled={last}
      onPrev={() => setPage(page - 1)}
      onNext={() => setPage(page + 1)}
      multiple={q.multiple || undefined}
      value={a.picked}
      onChange={(picked) => set({ picked })}
      submitText={last ? undefined : '下一个'}
      onSubmit={last ? submit : () => setPage(page + 1)}
      onSkip={() => answerQuestion(turnId, null)}
    >
      {q.options.map((o, i) => (
        <QuestionOption key={i} value={String(i)}>
          {o}
        </QuestionOption>
      ))}
      {q.other && <QuestionOption type="other" inputProps={{ value: a.other, onChange: (e) => set({ other: e.target.value }) }} />}
    </QuestionPanel>
  );
}

// ---------- 飞书授权 ----------

/**
 * 照线上 LarkAuthPanel：ActionCard 授权，标题后端给、说明前端固定；「取消」= 不授权接着回复，「去授权」线上新开飞书授权页、
 * 授权页发回结果才继续。演示里不开飞书，按钮转一下当授权成功
 */
function LarkCard({ turnId, title, className }: { turnId: string; title: string; className?: string }) {
  const [authorizing, setAuthorizing] = useState(false);
  const authorize = () => {
    setAuthorizing(true);
    window.setTimeout(() => answerLark(turnId, true), 1200);
  };
  return (
    <ActionCard
      type="auth"
      className={className}
      title={title}
      description={LARK_DESCRIPTION}
      actions={
        <>
          <Button variant="secondary" disabled={authorizing} onClick={() => answerLark(turnId, false)}>
            取消
          </Button>
          <Button variant="primary" loading={authorizing} onClick={authorize}>
            去授权
          </Button>
        </>
      }
    />
  );
}
