import { Dropdown, Menu, MenuItem, Select, type IconName } from '@kivi';

/*
  弹窗里的单选下拉：Dropdown + Select（触发器）+ Menu + MenuItem 拼（照 Select 拆成触发器的写法）。
  剪辑、封装弹窗共用，选项只写一份。
*/

export interface PickOption<T extends string | number> {
  value: T;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export function PickSelect<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled,
  placement,
}: {
  value: T;
  options: PickOption<T>[];
  onChange: (value: T) => void;
  /** 读屏用的名字，也是菜单的名字 */
  label: string;
  disabled?: boolean;
  placement?: 'bottom-start' | 'top-start';
}) {
  const cur = options.find((o) => o.value === value);
  return (
    <Dropdown
      haspopup="listbox"
      placement={placement}
      trigger={
        <Select leftIcon={cur?.icon} disabled={disabled} aria-label={label}>
          {cur?.label}
        </Select>
      }
    >
      <Menu role="listbox" aria-label={label}>
        {options.map((o) => (
          <MenuItem key={o.value} icon={o.icon} selected={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </Dropdown>
  );
}
