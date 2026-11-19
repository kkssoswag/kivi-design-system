import type { CSSProperties } from 'react';
import { Button, ExpertBar, ExpertCard, ExpertDetail, ExpertRecord, ExpertSkillPanel, type SkillItem } from '@kivi';
import { Playground } from '@shell';
import { EXPERTS, EXPERT_SKILL_ITEMS, EXPERT_USER, expertOf } from './expert-data';
import { SKILL_CATEGORIES } from './skill-data';

// 属性面板：专家都是 expert-data.ts 里的示例，线上是管理后台配的

const UP = 'top-start' as const;
const tall = (minHeight: number): CSSProperties => ({ minHeight, display: 'flex', alignItems: 'flex-end' });
const EXPERT_OPTIONS: [string, string][] = EXPERTS.map((e) => [e.id, e.name.replace('设计专家', '')]);
const skillsOf = (ids: string) => ids.split(',').filter(Boolean).map((id) => EXPERT_SKILL_ITEMS.find((s) => s.id === id)).filter((s): s is SkillItem => !!s);
const idsOf = (skills: SkillItem[]) => skills.map((s) => s.id).join(',');
const presetIds = (expert: string) => idsOf(expertOf(expert).skills ?? []);
/** 面板上换了专家，技能清单回到那位专家的预置；在预览里增删过的记在 skills（skillsFor 记是谁的） */
const currentIds = (s: { expert: string; skills?: string; skillsFor?: string }) => (s.skillsFor === s.expert && s.skills !== undefined ? s.skills : presetIds(s.expert));

// ---------- ExpertBar ----------

type BarState = { expert: string; session: boolean; skills?: string; skillsFor?: string; disabled: boolean };

export function ExpertBarPlayground() {
  return (
    <Playground<BarState>
      controls={[
        { key: 'expert', label: '当前专家', type: 'segment', value: 'visual', options: EXPERT_OPTIONS },
        { key: 'session', label: '会话里（能调技能）', type: 'toggle', value: true },
        { key: 'disabled', label: '禁用', type: 'toggle', value: false },
      ]}
      render={(s, update) => (
        <div style={tall(560)}>
          <ExpertBar
            experts={EXPERTS}
            user={EXPERT_USER}
            value={s.expert}
            onValueChange={(expert) => update({ expert })}
            skills={s.session ? skillsOf(currentIds(s)) : undefined}
            onSkillsChange={(skills) => update({ skills: idsOf(skills), skillsFor: s.expert })}
            skillItems={EXPERT_SKILL_ITEMS}
            skillCategories={SKILL_CATEGORIES}
            placement={UP}
            disabled={s.disabled}
          />
        </div>
      )}
    />
  );
}

// ---------- ExpertSkillPanel ----------

type PanelState = { expert: string; skills?: string; skillsFor?: string };

export function ExpertSkillPanelPlayground() {
  return (
    <Playground<PanelState>
      controls={[{ key: 'expert', label: '专家', type: 'segment', value: 'visual', options: EXPERT_OPTIONS.filter(([id]) => id !== 'none') }]}
      render={(s, update) => {
        const e = expertOf(s.expert);
        return (
          <ExpertSkillPanel
            key={s.expert}
            title={`${e.name}的技能`}
            scope="仅当前会话"
            value={skillsOf(currentIds(s))}
            onValueChange={(skills) => update({ skills: idsOf(skills), skillsFor: s.expert })}
            defaults={e.skills}
            items={EXPERT_SKILL_ITEMS}
            categories={SKILL_CATEGORIES}
          />
        );
      }}
    />
  );
}

// ---------- ExpertCard ----------

type CardState = { expert: string; invited: boolean; hover: boolean };

export function ExpertCardPlayground() {
  return (
    <Playground<CardState>
      controls={[
        { key: 'expert', label: '专家', type: 'segment', value: 'gift', options: EXPERT_OPTIONS.filter(([id]) => id !== 'none') },
        { key: 'invited', label: '已邀请', type: 'toggle', value: false },
        { key: 'hover', label: '悬停', type: 'toggle', value: false },
      ]}
      render={(s, update) => {
        const e = expertOf(s.expert);
        return (
          <ExpertCard
            name={e.name}
            description={e.description}
            avatar={e.avatar}
            skillCount={e.skills?.length}
            invited={s.invited}
            onInvitedChange={(invited) => update({ invited })}
            className={s.hover ? 'is-hover' : undefined}
            style={{ width: 300 }}
          />
        );
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
        { key: 'expert', label: '专家', type: 'segment', value: 'visual', options: EXPERT_OPTIONS.filter(([id]) => id !== 'none') },
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
  skills: { text: '已调整技能：添加 海报设计，移除 模板活动素材', avatar: expertOf('visual').avatar },
  none: { text: '已切换为无需专家' },
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
            ['skills', '调整技能'],
            ['none', '切回无需专家'],
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
