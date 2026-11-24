import { forwardRef } from 'react';
import { Button } from '../button';
import { Dialog, type DialogProps } from '../dialog';
import { Icon } from '../Icon';
import { placeholderImageSrc } from '../placeholder-image';
import { SKILL_DEFAULT_COVER } from '../agent';
import { AssetThumb } from '../tags-avatar';
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
  /** 擅长：先不显示（和简介重复，11-24 用户定），数据留着 */
  strengths?: string[];
  /** 试试这样说：最多 3 条，点了邀请这位专家、关弹窗、把这句话填进输入框（不发送） */
  examples?: string[];
  /** 预置技能：只读清单（用户不能增删），一位专家一般七八个；没有就不显示这一块 */
  skills?: SkillItem[];
  /** 已经邀请了：按钮是「已邀请」 */
  invited?: boolean;
  /** 点「邀请」「已邀请」 */
  onInvitedChange?: (invited: boolean) => void;
  /** 点一条示例提问 */
  onExample?: (text: string) => void;
}

/** 专家详情：点首页的专家横条、选择浮层里的「详情」打开。Dialog 800：标题栏是头像 72 + 名字 + 简介（关闭在右上），「邀请」在底栏（弹窗规范：按钮在底栏靠右） */
export const ExpertDetail = forwardRef<HTMLDivElement, ExpertDetailProps>(function ExpertDetail(
  { name, description, avatar, strengths: _strengths, examples = [], skills = [], invited = false, onInvitedChange, onExample, className, ...rest },
  ref,
) {
  return (
    <Dialog
      ref={ref}
      size={800}
      title={
        <div className="kv-expert-detail__top">
          <AssetThumb size={72} src={avatar} />
          <div className="kv-expert-detail__intro">
            <span className="kv-expert-detail__name">{name}</span>
            {description && <p className="kv-expert-detail__desc">{description}</p>}
          </div>
        </div>
      }
      footer={
        <Button size={36} variant={invited ? 'secondary-muted' : 'primary'} onClick={() => onInvitedChange?.(!invited)}>
          {invited ? '已邀请' : '邀请'}
        </Button>
      }
      className={cx('kv-expert-detail', className)}
      {...rest}
    >
      {examples.length > 0 && (
        <section className="kv-expert-detail__section">
          <h4>试试这样说</h4>
          <div className="kv-expert-detail__examples">
            {examples.slice(0, 3).map((t) => (
              <button key={t} type="button" className="kv-expert-detail__example" onClick={() => onExample?.(t)}>
                <span>{t}</span>
                <Icon name="Message" />
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
                <AssetThumb size={72} src={s.cover ? placeholderImageSrc(s.cover, '1:1') : SKILL_DEFAULT_COVER} />
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
