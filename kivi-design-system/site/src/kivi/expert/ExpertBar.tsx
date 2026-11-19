import { forwardRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { IconButton } from '../button';
import { Icon } from '../Icon';
import { Dropdown, Menu, MenuItem } from '../menu';
import { AssetThumb, Avatar } from '../tags-avatar';
import type { SkillItem } from '../generation';
import { useControllable } from '../hooks';
import { cx } from '../utils';
import { ExpertSkillPanel } from './ExpertSkillPanel';
import type { ExpertItem, ExpertUser } from './types';
import './expert.css';

/** 头像：专家是方形缩略图，「无需专家」（没有 avatar）是用户自己的圆形头像 */
export function expertAvatar(expert: ExpertItem, user: ExpertUser | undefined, size: 24) {
  return expert.avatar ? (
    <AssetThumb size={size} src={expert.avatar} />
  ) : (
    <Avatar size={size} name={user?.name ?? expert.name} src={user?.avatar} />
  );
}

export interface ExpertBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  /** 能选的专家，第一个一般是「无需专家」（不传 avatar） */
  experts: ExpertItem[];
  /** 当前专家的 id（受控） */
  value?: string;
  /** 当前专家的 id（非受控的初始值），默认第一个 */
  defaultValue?: string;
  /** 换了专家 */
  onValueChange?: (id: string) => void;
  /** 用户自己：「无需专家」显示用户的头像 */
  user?: ExpertUser;
  /** 选择浮层里悬停某位专家出「详情」，点了调用 */
  onDetail?: (expert: ExpertItem) => void;
  /**
   * 当前会话里这位专家的技能清单（受控）。传了专家条右边多一个「N 项技能」，点开专家技能面板增删；
   * 不传（首页）只在名字后面显示预置技能数，不能点
   */
  skills?: SkillItem[];
  /** 技能清单变了 */
  onSkillsChange?: (skills: SkillItem[]) => void;
  /** 专家技能面板开关（受控） */
  skillsOpen?: boolean;
  /** 专家技能面板打开、关闭：关闭时对话里留一条调整记录用 */
  onSkillsOpenChange?: (open: boolean) => void;
  /** 能添加的技能，传给专家技能面板 */
  skillItems?: SkillItem[];
  /** 技能分类，传给专家技能面板 */
  skillCategories?: string[];
  /** 专家技能面板标题后的范围说明，默认「仅当前会话」，画布里传「仅当前画布」 */
  skillsScope?: ReactNode;
  /** 选择浮层、技能面板往哪边弹：贴底部的输入框往上（默认），创作首页往下 */
  placement?: 'top-start' | 'bottom-start';
  /** 不能换专家、不能调技能：Agent 回复进行中 */
  disabled?: boolean;
}

/**
 * 专家条：放在 Agent 输入框顶上，显示当前专家，点开选择浮层换专家。
 * 会话页、画布里多一个「N 项技能」，点开专家技能面板增删技能（只对当前会话生效）
 */
export const ExpertBar = forwardRef<HTMLDivElement, ExpertBarProps>(function ExpertBar(
  {
    experts,
    value: valueProp,
    defaultValue,
    onValueChange,
    user,
    onDetail,
    skills,
    onSkillsChange,
    skillsOpen,
    onSkillsOpenChange,
    skillItems,
    skillCategories,
    skillsScope = '仅当前会话',
    placement = 'top-start',
    disabled = false,
    className,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControllable(valueProp, defaultValue ?? experts[0]?.id ?? '', onValueChange);
  const [open, setOpen] = useControllable(skillsOpen, false, onSkillsOpenChange);
  // 选择浮层：点「详情」时先关掉，详情弹窗不压在浮层上
  const [picking, setPicking] = useState(false);
  const expert = experts.find((e) => e.id === value) ?? experts[0];
  if (!expert) return null;
  const self = !expert.avatar;
  const presets = expert.skills?.length ?? 0;

  return (
    <div ref={ref} className={cx('kv-expert-bar', className)} {...rest}>
      <Dropdown
        placement={placement}
        haspopup="listbox"
        open={picking}
        onOpenChange={setPicking}
        trigger={
          <button type="button" className="kv-expert-bar__main" disabled={disabled}>
            {expertAvatar(expert, user, 24)}
            <span className="kv-expert-bar__name">{expert.name}</span>
            {self ? (
              <span className="kv-expert-bar__meta">{expert.description}</span>
            ) : (
              skills === undefined && presets > 0 && <span className="kv-expert-bar__meta">{presets} 项技能</span>
            )}
            <Icon name="DownArrowSmall" className="kv-expert-bar__arrow" />
          </button>
        }
      >
        <Menu role="listbox" aria-label="选择专家">
          {experts.map((e) => (
            <MenuItem
              key={e.id}
              thumb={expertAvatar(e, user, 24)}
              description={e.description}
              selected={e.id === expert.id}
              actions={
                e.avatar && onDetail ? (
                  <IconButton
                    icon="Preview"
                    label="详情"
                    variant="ghost-muted"
                    size={28}
                    onClick={() => {
                      setPicking(false);
                      onDetail(e);
                    }}
                  />
                ) : undefined
              }
              onClick={() => setValue(e.id)}
            >
              {e.name}
            </MenuItem>
          ))}
        </Menu>
      </Dropdown>

      {skills !== undefined && !self && (
        <Dropdown
          placement={placement}
          haspopup="dialog"
          closeOnSelect={false}
          open={open}
          onOpenChange={setOpen}
          trigger={
            <button type="button" className="kv-expert-bar__skills" disabled={disabled}>
              <Icon name="Skill" />
              {skills.length ? `${skills.length} 项技能` : '添加技能'}
            </button>
          }
        >
          <ExpertSkillPanel
            title={`${expert.name}的技能`}
            scope={skillsScope}
            value={skills}
            onValueChange={onSkillsChange}
            defaults={expert.skills}
            items={skillItems}
            categories={skillCategories}
          />
        </Dropdown>
      )}
    </div>
  );
});
ExpertBar.displayName = 'ExpertBar';
