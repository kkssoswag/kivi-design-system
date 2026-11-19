import { forwardRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { Button, IconButton } from '../button';
import { Icon } from '../Icon';
import { Input } from '../inputs';
import { TabItem, Tabs } from '../navigation';
import { ScrollArea } from '../scroll-area';
import { Tag } from '../tags-avatar';
import type { SkillItem } from '../generation';
import { useControllable } from '../hooks';
import { cx } from '../utils';
import './expert.css';

export interface ExpertSkillPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'defaultValue' | 'onChange'> {
  /** 标题，比如「视觉设计专家的技能」 */
  title: ReactNode;
  /** 标题后面的范围说明，比如「仅当前会话」「仅当前画布」 */
  scope?: ReactNode;
  /** 当前技能清单（受控） */
  value?: SkillItem[];
  /** 当前技能清单（非受控的初始值），一般就是预置技能 */
  defaultValue?: SkillItem[];
  /** 清单变了：添加、移除、恢复默认都会触发 */
  onValueChange?: (skills: SkillItem[]) => void;
  /** 这位专家的预置技能：清单里的标「预置」；清单和它不一样时出「恢复默认」 */
  defaults?: SkillItem[];
  /** 能添加的技能（线上是后端下发的） */
  items?: SkillItem[];
  /** 分类，排在「推荐」后面、「我的」前面 */
  categories?: string[];
  /** 清单最多几个，满了「添加」不能点。默认 20 */
  max?: number;
}

const sameList = (a: SkillItem[], b: SkillItem[]) => a.length === b.length && a.every((s) => b.some((x) => x.id === s.id));

/**
 * 专家技能面板：会话、画布里点专家条上的「N 项技能」打开，增删这位专家在当前会话里用的技能。
 * 上面是当前技能（悬停出「移除」，预置的也能移除），下面和技能面板一样按推荐、分类、我的、搜索找技能（悬停出「添加」）
 */
export const ExpertSkillPanel = forwardRef<HTMLDivElement, ExpertSkillPanelProps>(function ExpertSkillPanel(
  { title, scope, value: valueProp, defaultValue = [], onValueChange, defaults = [], items = [], categories = [], max = 20, className, ...rest },
  ref,
) {
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const [tab, setTab] = useState('recommend');
  const [searching, setSearching] = useState(false);
  const [keyword, setKeyword] = useState('');

  const has = (s: SkillItem) => value.some((x) => x.id === s.id);
  const full = value.length >= max;
  const k = keyword.trim();
  const pool = (k ? items : items.filter((s) => (tab === 'recommend' ? s.recommended : tab === 'mine' ? s.mine : s.category === tab))).filter(
    (s) => !k || s.title.includes(k) || s.description?.includes(k),
  );

  const row = (s: SkillItem, action: ReactNode, tag?: ReactNode) => (
    <div key={s.id} className="kv-expert-skill-panel__row">
      <Icon name="Tool" className="kv-expert-skill-panel__icon" />
      <span className="kv-expert-skill-panel__text">
        <span className="kv-expert-skill-panel__label">
          {s.title}
          {tag}
        </span>
        {s.description && <span className="kv-expert-skill-panel__desc">{s.description}</span>}
      </span>
      {action}
    </div>
  );

  return (
    <div ref={ref} className={cx('kv-expert-skill-panel', className)} role="dialog" aria-label={typeof title === 'string' ? title : '专家技能'} {...rest}>
      <div className="kv-expert-skill-panel__head">
        <span className="kv-expert-skill-panel__title">
          {title}
          {scope && <span className="kv-expert-skill-panel__scope">{scope}</span>}
        </span>
        {!sameList(value, defaults) && (
          <Button size={28} variant="secondary" onClick={() => setValue(defaults)}>
            恢复默认
          </Button>
        )}
      </div>

      <div className="kv-expert-skill-panel__sub">当前技能（{value.length}）</div>
      {value.length ? (
        <ScrollArea className="kv-expert-skill-panel__scroll" maxHeight={228}>
          <div className="kv-expert-skill-panel__list">
            {value.map((s) =>
              row(
                s,
                <Button size={28} variant="secondary-muted" className="kv-expert-skill-panel__action" onClick={() => setValue(value.filter((x) => x.id !== s.id))}>
                  移除
                </Button>,
                defaults.some((d) => d.id === s.id) ? <Tag className="kv-expert-skill-panel__tag">预置</Tag> : undefined,
              ),
            )}
          </div>
        </ScrollArea>
      ) : (
        <div className="kv-expert-skill-panel__empty">还没有技能，从下面添加</div>
      )}

      <div className="kv-expert-skill-panel__sub">添加技能</div>
      {searching ? (
        <div className="kv-expert-skill-panel__search">
          <Input leftIcon="Search" clearable autoFocus placeholder="搜索技能" aria-label="搜索技能" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Button
            size={28}
            variant="ghost"
            onClick={() => {
              setSearching(false);
              setKeyword('');
            }}
          >
            取消
          </Button>
        </div>
      ) : (
        <div className="kv-expert-skill-panel__tabs">
          <Tabs value={tab} onChange={setTab} aria-label="技能分类">
            <TabItem value="recommend">推荐</TabItem>
            {categories.map((c) => (
              <TabItem key={c} value={c}>
                {c}
              </TabItem>
            ))}
            <TabItem value="mine">我的</TabItem>
          </Tabs>
          <IconButton tooltip={false} icon="Search" label="搜索技能" variant="ghost" size={28} onClick={() => setSearching(true)} />
        </div>
      )}
      {pool.length ? (
        <ScrollArea className="kv-expert-skill-panel__scroll" maxHeight={228}>
          <div className="kv-expert-skill-panel__list">
            {pool.map((s) =>
              row(
                s,
                has(s) ? (
                  <span className="kv-expert-skill-panel__done">已添加</span>
                ) : (
                  <Button size={28} variant="secondary-muted" className="kv-expert-skill-panel__action" disabled={full} onClick={() => setValue([...value, s])}>
                    添加
                  </Button>
                ),
                s.mine ? <Tag className="kv-expert-skill-panel__tag">我的</Tag> : undefined,
              ),
            )}
          </div>
        </ScrollArea>
      ) : (
        <div className="kv-expert-skill-panel__empty">{k ? '没有搜索到技能' : '暂无技能'}</div>
      )}
    </div>
  );
});
ExpertSkillPanel.displayName = 'ExpertSkillPanel';
