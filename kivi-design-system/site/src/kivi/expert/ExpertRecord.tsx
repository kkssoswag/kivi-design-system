import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { AssetThumb } from '../tags-avatar';
import { cx } from '../utils';
import './expert.css';

export interface ExpertRecordProps extends HTMLAttributes<HTMLDivElement> {
  /** 专家头像图：16，放在文字前面。切回无需专家、专家下线不放 */
  avatar?: string;
  /** 记录的文字，比如「视觉设计专家加入对话」「已切换为品牌设计专家」「已调整技能：添加 海报设计」 */
  children: ReactNode;
}

/** 专家记录：对话里专家加入、切换、调整技能留的一行，两边细线、居中 */
export const ExpertRecord = forwardRef<HTMLDivElement, ExpertRecordProps>(function ExpertRecord({ avatar, children, className, ...rest }, ref) {
  return (
    <div ref={ref} role="note" className={cx('kv-expert-record', className)} {...rest}>
      <span className="kv-expert-record__text">
        {avatar && <AssetThumb size={16} src={avatar} />}
        {children}
      </span>
    </div>
  );
});
ExpertRecord.displayName = 'ExpertRecord';
