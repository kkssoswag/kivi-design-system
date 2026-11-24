import { forwardRef, useState, type HTMLAttributes } from 'react';
import { IconButton } from '../button';
import { Icon } from '../Icon';
import { Dropdown, Menu, MenuItem } from '../menu';
import { Avatar } from '../tags-avatar';
import { useControllable } from '../hooks';
import { cx } from '../utils';
import { hasExpertDetail, type ExpertItem } from './types';
import './expert.css';

export interface ExpertBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  /** 能选的专家，第一个一般是「通用专家」（默认） */
  experts: ExpertItem[];
  /** 当前专家的 id（受控） */
  value?: string;
  /** 当前专家的 id（非受控的初始值），默认第一个 */
  defaultValue?: string;
  /** 换了专家 */
  onValueChange?: (id: string) => void;
  /** 选择浮层里悬停某位专家出「详情」，点了调用。没有详情可看的（通用专家）不出 */
  onDetail?: (expert: ExpertItem) => void;
  /** 选择浮层往哪边弹：贴底部的输入框往上（默认），创作首页往下 */
  placement?: 'top-start' | 'bottom-start';
  /** 不能换专家：Agent 回复进行中 */
  disabled?: boolean;
}

/** 专家条：放在 Agent 输入框的工具条里（主站在「Agent」右边，画布在最前面），显示当前专家（圆头像 + 名字），点开选择浮层换专家 */
export const ExpertBar = forwardRef<HTMLDivElement, ExpertBarProps>(function ExpertBar(
  { experts, value: valueProp, defaultValue, onValueChange, onDetail, placement = 'top-start', disabled = false, className, ...rest },
  ref,
) {
  const [value, setValue] = useControllable(valueProp, defaultValue ?? experts[0]?.id ?? '', onValueChange);
  // 选择浮层：点「详情」时先关掉，详情弹窗不压在浮层上
  const [picking, setPicking] = useState(false);
  const expert = experts.find((e) => e.id === value) ?? experts[0];
  if (!expert) return null;

  return (
    <div ref={ref} className={cx('kv-expert-bar', className)} {...rest}>
      <Dropdown
        placement={placement}
        haspopup="listbox"
        open={picking}
        onOpenChange={setPicking}
        trigger={
          <button type="button" className="kv-expert-bar__main" disabled={disabled}>
            <Avatar size={24} name={expert.name} src={expert.avatar} />
            <span className="kv-expert-bar__name">{expert.name}</span>
            <Icon name="DownArrowSmall" className="kv-expert-bar__arrow" />
          </button>
        }
      >
        <Menu role="listbox" aria-label="选择专家">
          {experts.map((e) => (
            <MenuItem
              key={e.id}
              thumb={<Avatar size={24} name={e.name} src={e.avatar} />}
              description={e.description}
              selected={e.id === expert.id}
              actions={
                onDetail && hasExpertDetail(e) ? (
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
    </div>
  );
});
ExpertBar.displayName = 'ExpertBar';
