import type { CSSProperties } from 'react';
import { Button, ExpertBar, ExpertCard, ExpertDetail, ExpertRecord } from '@kivi';
import { Playground } from '@shell';
import { EXPERTS, GENERAL_EXPERT, expertOf } from './expert-data';

// 属性面板：专家都是 expert-data.ts 里的示例，线上是管理后台配的

const tall = (minHeight: number): CSSProperties => ({ minHeight, display: 'flex', alignItems: 'flex-end' });
const EXPERT_OPTIONS: [string, string][] = EXPERTS.map((e) => [e.id, e.name.replace('设计专家', '').replace('专家', '')]);
/** 横条、详情只有通用专家以外的专家 */
const SPECIALISTS = EXPERT_OPTIONS.filter(([id]) => id !== GENERAL_EXPERT);

// ---------- ExpertBar ----------

type BarState = { expert: string; disabled: boolean };

export function ExpertBarPlayground() {
  return (
    <Playground<BarState>
      controls={[
        { key: 'expert', label: '当前专家', type: 'segment', value: 'visual', options: EXPERT_OPTIONS },
        { key: 'disabled', label: '禁用', type: 'toggle', value: false },
      ]}
      render={(s, update) => (
        <div style={tall(360)}>
          <ExpertBar experts={EXPERTS} value={s.expert} onValueChange={(expert) => update({ expert })} placement="top-start" disabled={s.disabled} />
        </div>
      )}
    />
  );
}

// ---------- ExpertCard ----------

type CardState = { expert: string; invited: boolean; hover: boolean };

export function ExpertCardPlayground() {
  return (
    <Playground<CardState>
      controls={[
        { key: 'expert', label: '专家', type: 'segment', value: 'gift', options: SPECIALISTS },
        { key: 'invited', label: '已邀请', type: 'toggle', value: false },
        { key: 'hover', label: '悬停', type: 'toggle', value: false },
      ]}
      render={(s) => {
        const e = expertOf(s.expert);
        return <ExpertCard name={e.name} avatar={e.avatar} invited={s.invited} className={s.hover ? 'is-hover' : undefined} style={{ width: 340 }} />;
      }}
    />
  );
}

// ---------- ExpertDetail ----------

type DetailState = { expert: string; open: boolean; invited: boolean };

export function ExpertDetailPlayground() {
  return (
    <Playground<DetailState>
      controls={[
        { key: 'expert', label: '专家', type: 'segment', value: 'visual', options: SPECIALISTS },
        { key: 'invited', label: '已邀请', type: 'toggle', value: false },
        { key: 'open', label: '打开', type: 'toggle', value: false },
      ]}
      render={(s, update) => {
        const e = expertOf(s.expert);
        return (
          <>
            <Button onClick={() => update({ open: true })}>打开专家详情</Button>
            <ExpertDetail
              open={s.open}
              onOpenChange={(open) => update({ open })}
              name={e.name}
              description={e.description}
              avatar={e.avatar}
              strengths={e.strengths}
              examples={e.examples}
              skills={e.skills}
              invited={s.invited}
              onInvitedChange={(invited) => update({ invited })}
              onExample={() => update({ open: false, invited: true })}
            />
          </>
        );
      }}
    />
  );
}

// ---------- ExpertRecord ----------

type RecordState = { kind: string };

const RECORDS: Record<string, { text: string; avatar?: string }> = {
  join: { text: '视觉设计专家加入对话', avatar: expertOf('visual').avatar },
  switch: { text: '已切换为品牌设计专家', avatar: expertOf('brand').avatar },
  general: { text: '已切换为通用专家', avatar: expertOf(GENERAL_EXPERT).avatar },
};

export function ExpertRecordPlayground() {
  return (
    <Playground<RecordState>
      controls={[
        {
          key: 'kind',
          label: '记录',
          type: 'segment',
          value: 'join',
          options: [
            ['join', '加入对话'],
            ['switch', '切换专家'],
            ['general', '切回通用专家'],
          ],
        },
      ]}
      render={(s) => (
        <ExpertRecord avatar={RECORDS[s.kind].avatar} style={{ width: 640 }}>
          {RECORDS[s.kind].text}
        </ExpertRecord>
      )}
    />
  );
}
