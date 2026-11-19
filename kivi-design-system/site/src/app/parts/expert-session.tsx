import { useRef, useState, type ReactNode } from 'react';
import { ActionCard, Button, ExpertBar, ExpertDetail, type ExpertItem } from '@kivi';
import { EXPERTS, EXPERT_SKILL_ITEMS, EXPERT_USER, expertOf, suggestExpert } from '../../docs/business/expert-data';
import { SKILL_CATEGORIES } from '../../docs/business/skill-data';
import { db, useDB } from '../data/db';
import { noteSkillChange, setExpertSkills, skillIdsOf, skillsOfIds, switchExpert, type ExpertTarget } from '../data/experts';

/*
  专家模式在一段对话里（主站对话页、画布 Agent 共用）：输入框顶上的专家条、专家详情、需求不对口时的确认卡。
  专家和技能清单记在这段对话上（data/experts.ts），换专家、调技能在对话里留记录。
  是否对口按 expert-data.ts 里的关键词判断（演示用：线上是专家自己判断）
*/

/** 邀请了专家，Agent 输入框的占位文字换成这句 */
export const expertPlaceholder = (id: string) => (id === 'none' ? undefined : `告诉${expertOf(id).name}你想做什么，可以上传参考`);

/** 专家详情弹窗：首页、对话页、画布共用。onInvite(on)：邀请 / 取消邀请；onExample：点示例提问（邀请 + 填进输入框） */
export function ExpertDetailHost({
  detail,
  current,
  onClose,
  onInvite,
  onExample,
}: {
  detail: ExpertItem | null;
  current: string;
  onClose: () => void;
  onInvite: (expert: ExpertItem, on: boolean) => void;
  onExample: (expert: ExpertItem, text: string) => void;
}) {
  return (
    <ExpertDetail
      open={detail !== null}
      onOpenChange={(v) => !v && onClose()}
      name={detail?.name}
      description={detail?.description}
      avatar={detail?.avatar}
      strengths={detail?.strengths}
      examples={detail?.examples}
      skills={detail?.skills}
      invited={detail?.id === current}
      onInvitedChange={(on) => {
        if (detail) onInvite(detail, on);
        onClose();
      }}
      onExample={(text) => {
        if (detail) onExample(detail, text);
        onClose();
      }}
    />
  );
}

/** 这段对话现在的数据（技能面板关上时要拿最新的清单：面板里改的已经写进 db，闭包里的还是旧的） */
function latest(t: ExpertTarget) {
  const s = db.get();
  return t.kind === 'chat' ? s.chats.find((c) => c.id === t.id) : s.canvasChats.find((c) => c.id === t.id);
}

export function useExpertSession({ target, scope, fill, disabled }: { target: ExpertTarget; scope: string; fill: (text: string) => void; disabled?: boolean }) {
  const x = useDB((s) => (target.kind === 'chat' ? s.chats.find((c) => c.id === target.id) : s.canvasChats.find((c) => c.id === target.id)));
  const expert = x?.expert ?? 'none';
  const skillIds = skillIdsOf(x);
  const snapshot = useRef<string[]>([]);
  const [detail, setDetail] = useState<ExpertItem | null>(null);
  // 需求不对口：先停住这次发送，等用户选「不换，继续」或「切换并继续」
  const [ask, setAsk] = useState<{ suggest: ExpertItem; go: () => void } | null>(null);
  // 选了「不换，继续」的：这段对话里不再建议切到同一位专家
  const declined = useRef<string[]>([]);

  const bar = (placement: 'top-start' | 'bottom-start' = 'top-start') => (
    <ExpertBar
      experts={EXPERTS}
      user={EXPERT_USER}
      value={expert}
      onValueChange={(id) => switchExpert(target, id)}
      onDetail={setDetail}
      skills={skillsOfIds(skillIds)}
      onSkillsChange={(skills) => setExpertSkills(target, skills.map((s) => s.id))}
      onSkillsOpenChange={(open) => {
        if (open) snapshot.current = skillIds;
        else noteSkillChange(target, snapshot.current, skillIdsOf(latest(target)));
      }}
      skillItems={EXPERT_SKILL_ITEMS}
      skillCategories={SKILL_CATEGORIES}
      skillsScope={scope}
      placement={placement}
      disabled={disabled}
    />
  );

  /** 发给 Agent 之前过一下：需求明显属于别的专家就先问，不然直接发 */
  const guard = (text: string, go: () => void) => {
    const s = suggestExpert(expert, text);
    if (s && !declined.current.includes(s.id)) {
      setAsk({ suggest: s, go });
      return;
    }
    go();
  };

  /** 停在输入框的位置，替换掉输入框 */
  const askCard: ReactNode = ask && (
    <ActionCard
      title={`这个需求更适合${ask.suggest.name}`}
      description={`现在是${expertOf(expert).name}。切换后由${ask.suggest.name}接着做，不用重发。`}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              declined.current.push(ask.suggest.id);
              setAsk(null);
              ask.go();
            }}
          >
            不换，继续
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              switchExpert(target, ask.suggest.id);
              setAsk(null);
              ask.go();
            }}
          >
            切换并继续
          </Button>
        </>
      }
    />
  );

  const detailDialog = (
    <ExpertDetailHost
      detail={detail}
      current={expert}
      onClose={() => setDetail(null)}
      onInvite={(e, on) => switchExpert(target, on ? e.id : 'none')}
      onExample={(e, text) => {
        switchExpert(target, e.id);
        fill(text);
      }}
    />
  );

  return { expert, notes: x && 'notes' in x ? (x.notes ?? []) : [], asking: ask !== null, bar, guard, askCard, detailDialog, placeholder: expertPlaceholder(expert) };
}
