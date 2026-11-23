import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon } from '../Icon';
import { cx } from '../utils';
import './expert.css';

export interface ExpertCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** 专家名字 */
  name: string;
  /** 配图：专家头像，铺在右边、往左渐隐 */
  avatar?: string;
  /** 已邀请：描边变亮 */
  invited?: boolean;
}

/** 专家横条：创作首页输入框下面一行，名字 + 箭头，右边配图。点了打开专家详情（在详情里邀请） */
export const ExpertCard = forwardRef<HTMLButtonElement, ExpertCardProps>(function ExpertCard(
  { name, avatar, invited = false, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('kv-expert-card', className)}
      data-invited={invited ? '' : undefined}
      aria-label={invited ? `${name}，已邀请` : name}
      {...rest}
    >
      {avatar && <span className="kv-expert-card__cover" style={{ backgroundImage: `url(${avatar})` }} aria-hidden />}
      <span className="kv-expert-card__name">{name}</span>
      <Icon name="RightArrowSmall" className="kv-expert-card__arrow" />
    </button>
  );
});
ExpertCard.displayName = 'ExpertCard';
