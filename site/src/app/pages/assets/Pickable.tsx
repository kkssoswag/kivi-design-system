import type { ReactNode } from 'react';
import { Checkbox } from '@kivi';

/**
 * 批量编辑时给一格加勾选框：右上方形 Checkbox（照线上，11-18 用户定），整格点一下也是选中 / 取消。
 * 外面那层一直在（只是勾选框和点击层批量时才出）：进出批量编辑时格子不重新挂载，图片不重新加载、不闪。
 * 格子自己的悬停操作、右键菜单批量时不出。
 */
export function Pickable({ picking, checked, onToggle, label, children }: { picking: boolean; checked: boolean; onToggle: () => void; label: string; children: ReactNode }) {
  return (
    <div className="tpl-as__pick">
      {children}
      {picking && <div className="tpl-as__pick-hit" aria-hidden onClick={onToggle} />}
      {picking && <Checkbox checked={checked} onChange={onToggle} aria-label={`选择 ${label}`} />}
    </div>
  );
}
