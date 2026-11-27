import { forwardRef, useEffect, useId, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../button';
import { cx } from '../utils';
import { rectOf, useFloating, useMergedRef, usePresence, type FloatingPlacement } from '../hooks';
import './tooltip.css';

export interface CoachmarkProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 指着哪个元素：页面上已经有的元素（不用包住它）。没有就不出现 */
  anchor: Element | null;
  /** 显示，默认显示 */
  open?: boolean;
  /** 标题，一句话。不写就只有说明（说明本身已经够清楚时） */
  title?: ReactNode;
  /** 说明，一两句 */
  description?: ReactNode;
  /** 第几步，从 1 开始。和 total 一起传，左下角写「2 / 5」 */
  step?: number;
  /** 一共几步 */
  total?: number;
  /** 主按钮的字，默认「下一步」；最后一步一般写「知道了」或要做的事 */
  nextText?: ReactNode;
  /** 点主按钮 */
  onNext?: () => void;
  /** 次按钮的字，默认「跳过」 */
  skipText?: ReactNode;
  /** 点次按钮、按 Esc。不传就没有次按钮，Esc 等于点主按钮 */
  onSkip?: () => void;
  /** 出在目标哪边，默认下方居中；放不下自动翻到对面 */
  placement?: FloatingPlacement;
  /** 压暗页面、只亮出目标（四周留 4，圆角跟着目标再加 4），页面别处点不了。分步导览用；单条提示不压暗 */
  spotlight?: boolean;
}

/** 亮出来的那块比目标四周大多少 */
const PAD = 4;
const EXIT_MS = 150;
/** 换目标时，气泡和亮的那块挪过去的时长（--motion-duration-300） */
const MOVE_MS = 300;

/** 亮出来的那块：目标的位置加四周 PAD，圆角取目标自己的再加 PAD（圆形的目标不超过半边长） */
function holeOf(el: Element) {
  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, radius: Math.min(radius, r.width / 2, r.height / 2) + PAD };
}

/**
 * 引导气泡：新功能、新手引导里指着页面上的某个东西说一句。实色 popup 底、带箭头，标题 + 说明，底下步数和「跳过」「下一步」。
 * 不包触发元素，传 `anchor` 指过去；分步导览由用的地方换 anchor 和文字，气泡和亮的那块会挪过去（300ms ease-in-out）。
 * ref 给气泡本身
 */
export const Coachmark = forwardRef<HTMLDivElement, CoachmarkProps>(function Coachmark(
  {
    anchor,
    open = true,
    title,
    description,
    step,
    total,
    nextText = '下一步',
    onNext,
    skipText = '跳过',
    onSkip,
    placement = 'bottom',
    spotlight = false,
    className,
    ...rest
  },
  ref,
) {
  const shown = open && !!anchor;
  const { mounted, state } = usePresence(shown, EXIT_MS);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const setBubble = useMergedRef(bubbleRef, ref);
  const holeRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // 换目标：这一次定位做成挪过去，不是跳过去。要在定位之前标上（这个 effect 写在 useFloating 前面），直接写在元素上
  const lastAnchor = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const prev = lastAnchor.current;
    lastAnchor.current = anchor;
    if (!prev || prev === anchor) return;
    const els = [bubbleRef.current, holeRef.current].filter((e): e is HTMLDivElement => !!e);
    els.forEach((e) => (e.dataset.moving = ''));
    const t = setTimeout(() => els.forEach((e) => delete e.dataset.moving), MOVE_MS);
    return () => clearTimeout(t);
  }, [anchor]);

  useFloating(mounted, bubbleRef, () => (anchor ? rectOf(anchor) : null), placement, 10, false, anchor);

  // 亮的那块跟着目标：滚动、窗口变化、目标尺寸变了都重新算
  useLayoutEffect(() => {
    if (!mounted || !spotlight || !anchor) return;
    const update = () => {
      const el = holeRef.current;
      if (!el) return;
      const h = holeOf(anchor);
      el.style.left = `${h.left}px`;
      el.style.top = `${h.top}px`;
      el.style.width = `${h.width}px`;
      el.style.height = `${h.height}px`;
      el.style.borderRadius = `${h.radius}px`;
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    ro?.observe(anchor);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [mounted, spotlight, anchor]);

  // 出现时焦点放进气泡（读屏先读标题和说明）；Esc 等于跳过，没有跳过就等于主按钮
  useEffect(() => {
    if (shown) bubbleRef.current?.focus({ preventScroll: true });
  }, [shown, anchor]);
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.stopPropagation();
      (onSkip ?? onNext)?.();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [shown, onSkip, onNext]);

  if (!mounted) return null;
  const steps = step !== undefined && total !== undefined && total > 1;

  return createPortal(
    <>
      {spotlight && (
        <div className="kv-coachmark__scrim" data-state={state} aria-hidden>
          <div ref={holeRef} className="kv-coachmark__hole" />
        </div>
      )}
      <div
        ref={setBubble}
        className={cx('kv-coachmark', className)}
        role="dialog"
        aria-labelledby={title !== undefined ? titleId : undefined}
        aria-describedby={description !== undefined ? descId : undefined}
        aria-label={title === undefined ? '引导' : undefined}
        tabIndex={-1}
        data-state={state}
        {...rest}
      >
        <span className="kv-coachmark__arrow" aria-hidden />
        {title !== undefined && (
          <b id={titleId} className="kv-coachmark__title">
            {title}
          </b>
        )}
        {description !== undefined && (
          <div id={descId} className="kv-coachmark__desc">
            {description}
          </div>
        )}
        <div className="kv-coachmark__foot">
          <span className="kv-coachmark__step">{steps ? `${step} / ${total}` : ''}</span>
          <span className="kv-coachmark__actions">
            {onSkip && (
              <Button size={28} variant="ghost-muted" onClick={onSkip}>
                {skipText}
              </Button>
            )}
            <Button size={28} variant="primary" onClick={onNext}>
              {nextText}
            </Button>
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
});
Coachmark.displayName = 'Coachmark';
