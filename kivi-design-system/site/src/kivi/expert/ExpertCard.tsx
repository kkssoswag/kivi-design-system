import { forwardRef, type HTMLAttributes } from 'react';
import { Button } from '../button';
import { AssetThumb } from '../tags-avatar';
import { useControllable } from '../hooks';
import { cx } from '../utils';
import './expert.css';

export interface ExpertCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** 专家名字 */
  name: string;
  /** 定位：两行，不够两行也占两行高 */
  description: string;
  /** 头像图 */
  avatar?: string;
  /** 预置技能数：0 就不显示 */
  skillCount?: number;
  /** 邀请了（受控）：卡片描边变亮，按钮换成「已邀请」 */
  invited?: boolean;
  /** 邀请了（非受控的初始值） */
  defaultInvited?: boolean;
  /** 点「邀请」「已邀请」：邀请、取消邀请（回到无需专家） */
  onInvitedChange?: (invited: boolean) => void;
  /** 点卡片别的地方：打开专家详情 */
  onOpen?: () => void;
}

/** 专家卡片：创作首页输入框下面一行四张，点「邀请」选这位专家，点卡片看详情 */
export const ExpertCard = forwardRef<HTMLDivElement, ExpertCardProps>(function ExpertCard(
  { name, description, avatar, skillCount = 0, invited: invitedProp, defaultInvited = false, onInvitedChange, onOpen, className, ...rest },
  ref,
) {
  const [invited, setInvited] = useControllable(invitedProp, defaultInvited, onInvitedChange);
  return (
    <div ref={ref} className={cx('kv-expert-card', className)} data-invited={invited ? '' : undefined} {...rest}>
      {/* 整张卡是一个按钮：点了看详情。「邀请」盖在它上面 */}
      <button type="button" className="kv-expert-card__open" aria-label={`查看 ${name} 详情`} onClick={onOpen} />
      <div className="kv-expert-card__top">
        <AssetThumb size={56} src={avatar} />
        <span className="kv-expert-card__text">
          <span className="kv-expert-card__name">{name}</span>
          <span className="kv-expert-card__desc">{description}</span>
        </span>
      </div>
      <div className="kv-expert-card__foot">
        <span className="kv-expert-card__count">{skillCount > 0 ? `${skillCount} 项技能` : ''}</span>
        <Button size={28} variant={invited ? 'secondary-muted' : 'secondary'} className="kv-expert-card__invite" onClick={() => setInvited(!invited)}>
          {invited ? '已邀请' : '邀请'}
        </Button>
      </div>
    </div>
  );
});
ExpertCard.displayName = 'ExpertCard';
