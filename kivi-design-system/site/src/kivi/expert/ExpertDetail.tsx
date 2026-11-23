import { forwardRef } from 'react';
import { Button } from '../button';
import { Dialog, type DialogProps } from '../dialog';
import { Icon } from '../Icon';
import { AssetThumb, Tag } from '../tags-avatar';
import type { SkillItem } from '../generation';
import { cx } from '../utils';
import './expert.css';

export interface ExpertDetailProps extends Omit<DialogProps, 'title' | 'description' | 'children' | 'footer' | 'media' | 'size'> {
  /** 专家名字，弹窗标题 */
  name?: string;
  /** 定位 */
  description?: string;
  /** 头像图 */
  avatar?: string;
  /** 擅长：一排标签 */
  strengths?: string[];
  /** 试试这样说：最多 3 条，点了邀请这位专家、关弹窗、把这句话填进输入框（不发送） */
  examples?: string[];
  /** 预置技能：只读清单（用户不能增删），没有就不显示这一块 */
  skills?: SkillItem[];
  /** 已经邀请了：按钮是「已邀请」 */
  invited?: boolean;
  /** 点「邀请」「已邀请」 */
  onInvitedChange?: (invited: boolean) => void;
  /** 点一条示例提问 */
  onExample?: (text: string) => void;
}

/** 专家详情：点首页的专家横条、选择浮层里的「详情」打开。Dialog 560 */
export const ExpertDetail = forwardRef<HTMLDivElement, ExpertDetailProps>(function ExpertDetail(
  { name, description, avatar, strengths = [], examples = [], skills = [], invited = false, onInvitedChange, onExample, className, ...rest },
  ref,
) {
  return (
    <Dialog ref={ref} size={560} title={name} className={cx('kv-expert-detail', className)} {...rest}>
      <div className="kv-expert-detail__top">
        <AssetThumb size={72} src={avatar} />
        <p className="kv-expert-detail__desc">{description}</p>
        <Button size={36} variant={invited ? 'secondary-muted' : 'primary'} onClick={() => onInvitedChange?.(!invited)}>
          {invited ? '已邀请' : '邀请'}
        </Button>
      </div>
      {strengths.length > 0 && (
        <section className="kv-expert-detail__section">
          <h4>擅长</h4>
          <div className="kv-expert-detail__tags">
            {strengths.map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
        </section>
      )}
      {examples.length > 0 && (
        <section className="kv-expert-detail__section">
          <h4>试试这样说</h4>
          <div className="kv-expert-detail__examples">
            {examples.slice(0, 3).map((t) => (
              <button key={t} type="button" className="kv-expert-detail__example" onClick={() => onExample?.(t)}>
                <span>{t}</span>
                <Icon name="RightArrowSmall" />
              </button>
            ))}
          </div>
        </section>
      )}
      {skills.length > 0 && (
        <section className="kv-expert-detail__section">
          <h4>技能（{skills.length}）</h4>
          <div className="kv-expert-detail__skills">
            {skills.map((s) => (
              <div key={s.id} className="kv-expert-detail__skill">
                <Icon name="Tool" />
                <span>
                  <b>{s.title}</b>
                  {s.description && <span>{s.description}</span>}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </Dialog>
  );
});
ExpertDetail.displayName = 'ExpertDetail';
