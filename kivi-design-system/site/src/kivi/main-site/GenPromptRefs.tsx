import { forwardRef, Fragment, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { useMergedRef } from '../hooks';
import { ReferenceItem } from '../reference';
import { AssetThumb } from '../tags-avatar';
import { cx } from '../utils';
import './main-site.css';

export interface GenPromptRefItem {
  /** 素材类型：图片 / 视频（用首帧）/ 音频 */
  type: 'image' | 'video' | 'audio';
  /** 图片或视频首帧的地址，音频不用 */
  src?: string;
  /** 视频时长，比如 0:06，只在悬停浮层里显示 */
  duration?: string;
}

export interface GenPromptRefsProps extends HTMLAttributes<HTMLDivElement> {
  /** 所有参考素材，图片、视频、音频可以混排。参考区最多露 5 格，超过 5 个第 5 个渐隐；悬停时下面的浮层显示全部（右边放不下往左挪，下面放不下翻到上面） */
  items: GenPromptRefItem[];
  /** 参考方式文字，比如「全能参考」「参考图」「原图」 */
  label: ReactNode;
}

/** GenPrompt 参数里的参考区：缩略图 + 参考方式文字，悬停弹出浮层显示全部素材。Figma「生成记录」页 GenPrompt 里的一块 */
export const GenPromptRefs = forwardRef<HTMLDivElement, GenPromptRefsProps>(function GenPromptRefs(
  { items, label, className, onPointerEnter, onFocus, ...rest },
  ref,
) {
  const selfRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRef(ref, selfRef);
  const popRef = useRef<HTMLDivElement>(null);
  // 出来之前量一下：浮层右边放不下就往左挪、下面放不下就翻到上面。按最近几层会裁切的祖先（滚动区）和窗口算，离边 8
  const place = () => {
    const root = selfRef.current;
    const pop = popRef.current;
    if (!root || !pop) return;
    root.style.removeProperty('--kv-gen-prompt-refs-shift');
    delete root.dataset.placement;
    let clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    for (let el = root.parentElement; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const r = el.getBoundingClientRect();
      clip = { left: Math.max(clip.left, r.left), top: Math.max(clip.top, r.top), right: Math.min(clip.right, r.right), bottom: Math.min(clip.bottom, r.bottom) };
    }
    const gap = 8;
    const p = pop.getBoundingClientRect();
    const shift = Math.max(0, Math.min(p.right - (clip.right - gap), p.left - (clip.left + gap)));
    if (shift > 0) root.style.setProperty('--kv-gen-prompt-refs-shift', `${shift}px`);
    if (p.bottom > clip.bottom - gap && root.getBoundingClientRect().top - clip.top >= p.height + gap * 2) root.dataset.placement = 'top';
  };
  const overflow = items.length > 5;
  const shown = items.slice(0, 5);
  const thumb = (item: GenPromptRefItem) =>
    item.type === 'audio' ? <AssetThumb size={16} type="icon" icon="Music" /> : <AssetThumb size={16} type="image" src={item.src} />;

  return (
    <div
      ref={mergedRef}
      className={cx('kv-gen-prompt-refs', className)}
      tabIndex={0}
      onPointerEnter={(e) => {
        place();
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        place();
        onFocus?.(e);
      }}
      {...rest}
    >
      <span className="kv-gen-prompt-refs__thumbs">
        {shown.map((item, i) =>
          overflow && i === 4 ? (
            <span key={i} className="kv-gen-prompt-refs__thumb--fade">
              {thumb(item)}
            </span>
          ) : (
            <Fragment key={i}>{thumb(item)}</Fragment>
          ),
        )}
      </span>
      {label}
      <div
        ref={popRef}
        className="kv-gen-prompt-refs__popover"
        role="tooltip"
        style={{ '--kv-gen-prompt-refs-cols': Math.min(items.length, 5) } as CSSProperties}
      >
        {items.map((item, i) => (
          <ReferenceItem key={i} size={72} type={item.type === 'audio' ? 'audio' : 'image'} src={item.src} duration={item.duration} />
        ))}
      </div>
    </div>
  );
});
GenPromptRefs.displayName = 'GenPromptRefs';
