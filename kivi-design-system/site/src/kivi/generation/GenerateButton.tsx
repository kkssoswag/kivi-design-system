import { forwardRef, type MouseEvent, type ReactNode } from 'react';
import { Button, type ButtonProps } from '../button';
import { Popover } from '../tooltip/Popover';

export interface GenerateButtonProps extends Omit<ButtonProps, 'variant' | 'leftIcon' | 'rightIcon' | 'children'> {
  /** 这次生成消耗的猕猴桃数，写在图标右边 */
  cost: number | string;
  /**
   * 现在不能生成的原因，比如「请输入画面描述」「请至少上传 1 个视频」。传了按钮置灰、点了不触发，
   * 悬停、键盘聚焦时上面出 Popover 提示写这句（11-17 用户定）。用 aria-disabled 不用 disabled，禁用的按钮收不到悬停
   */
  disabledReason?: ReactNode;
}

/**
 * 生成按钮：猕猴桃图标加消耗数，品牌渐变底。就是主要类型的 Button，左图标固定 Kiwi，文字固定是消耗数。
 * 默认中号（32），宽度跟着数字走，最小 64。点了等结果时传 loading；条件不满足时传 disabledReason（置灰 + 悬停说为什么），
 * 不用说原因的才直接传 disabled。
 * Figma「模板 · 主站」页「输入框」分区「生成 · 消耗 99」
 */
export const GenerateButton = forwardRef<HTMLButtonElement, GenerateButtonProps>(function GenerateButton(
  { cost, size = 32, disabledReason, onClick, 'aria-label': ariaLabel, ...rest },
  ref,
) {
  const blocked = disabledReason != null && disabledReason !== false && disabledReason !== '';
  const button = (
    <Button
      ref={ref}
      size={size}
      variant="primary"
      leftIcon="Kiwi"
      aria-label={ariaLabel ?? `生成，消耗 ${cost} 个猕猴桃`}
      aria-disabled={blocked || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        // 置灰时点了（含 Enter、Space）什么都不做，连表单提交一起挡住
        if (blocked) return e.preventDefault();
        onClick?.(e);
      }}
      {...rest}
    >
      {cost}
    </Button>
  );
  if (!blocked) return button;
  return (
    <Popover content={disabledReason} placement="top">
      {button}
    </Popover>
  );
});
GenerateButton.displayName = 'GenerateButton';
