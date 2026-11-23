import { useState, type ReactNode } from 'react';
import { ActionCard, Button, ExpertBar, ExpertDetail, type ExpertItem } from '@kivi';
import { EXPERTS, GENERAL_EXPERT, expertOf, suggestExpert, type ExpertSuggestion } from '../../docs/business/expert-data';
import { useDB } from '../data/db';
import { declineExpert, switchExpert, type ExpertTarget } from '../data/experts';

/*
  专家模式在一段对话里（主站对话页、画布 Agent 共用）：输入框顶上的专家条、专家详情、切换器（需求不对口时的确认卡）。
  专家记在这段对话上（data/experts.ts），换专家在对话里留记录。专家的技能是后台配好的，这里不能增删。
  是否对口按 expert-data.ts 里的关键词判断（演示用：线上是模型按后台配的定位、擅长、示例提问判断）
*/

/** 邀请了通用专家以外的专家，Agent 输入框的占位文字换成这句 */
export const expertPlaceholder = (id: string) => (id === GENERAL_EXPERT ? undefined : `告诉${expertOf(id).name}你想做什么，可以上传参考`);

/** 专家详情弹窗：首页、对话页、画布共用。onInvite(on)：邀请 / 取消邀请（回到通用专家）；onExample：点示例提问（邀请 + 填进输入框） */
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

/** 切换器的说明：第一行为什么更适合（需求里命中的词 + 那位专家擅长什么），第二行两个按钮各会怎样 */
export function switchReason(current: string, s: ExpertSuggestion): ReactNode {
  const to = s.expert;
  const strengths = to.strengths?.length ? `：${to.strengths.join('、')}` : '';
  return (
    <>
      你提到「{s.words.join('」「')}」，属于{to.name}擅长的{strengths}。
      <br />
      切换后由{to.name}接着处理这条需求，不用重发；不换就由{expertOf(current).name}照做，这段对话里不再建议{to.name}。
    </>
  );
}

export function useExpertSession({ target, fill, disabled }: { target: ExpertTarget; fill: (text: string) => void; disabled?: boolean }) {
  const x = useDB((s) => (target.kind === 'chat' ? s.chats.find((c) => c.id === target.id) : s.canvasChats.find((c) => c.id === target.id)));
  const expert = x?.expert ?? GENERAL_EXPERT;
  const [detail, setDetail] = useState<ExpertItem | null>(null);
  // 需求不对口：先停住这次发送，等用户选「不换，继续」或「切换并继续」
  const [ask, setAsk] = useState<{ suggest: ExpertSuggestion; go: () => void } | null>(null);

  const bar = (placement: 'top-start' | 'bottom-start' = 'top-start') => (
    <ExpertBar
      experts={EXPERTS}
      value={expert}
      onValueChange={(id) => switchExpert(target, id)}
      onDetail={setDetail}
      placement={placement}
      disabled={disabled}
    />
  );

  /** 切换器：发给 Agent 之前过一下，需求明显属于别的专家就先问（通用专家下也问），不然直接发 */
  const guard = (text: string, go: () => void) => {
    const s = suggestExpert(expert, text, x?.expertDeclined);
    if (s) {
      setAsk({ suggest: s, go });
      return;
    }
    go();
  };

  /** 停在输入框的位置，替换掉输入框 */
  const askCard: ReactNode = ask && (
    <ActionCard
      title={`这个需求更适合${ask.suggest.expert.name}`}
      description={switchReason(expert, ask.suggest)}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              declineExpert(target, ask.suggest.expert.id);
              setAsk(null);
              ask.go();
            }}
          >
            不换，继续
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              switchExpert(target, ask.suggest.expert.id);
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
      onInvite={(e, on) => switchExpert(target, on ? e.id : GENERAL_EXPERT)}
      onExample={(e, text) => {
        switchExpert(target, e.id);
        fill(text);
      }}
    />
  );

  return { expert, notes: x && 'notes' in x ? (x.notes ?? []) : [], asking: ask !== null, bar, guard, askCard, detailDialog, placeholder: expertPlaceholder(expert) };
}
