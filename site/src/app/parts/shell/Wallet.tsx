import { Icon } from '@kivi';
import { cx } from '@kivi/utils';
import { useBalance } from '../../data/db';
import { UserMenu } from './UserMenu';

/*
  右上角：余额（猕猴桃，读 db 的余额，生成扣费、失败退回都会变）和头像。
  主站每一页都有（画布页没有），挂在外壳 KiviApp 上，不跟着页面换。
*/

export function Wallet({ className }: { className?: string }) {
  const balance = useBalance();
  return (
    <div className={cx('tpl-ms__wallet', className)}>
      <span className="tpl-ms__balance" aria-label={`余额 ${balance}`}>
        <Icon name="Kiwi" />
        {balance}
      </span>
      <UserMenu />
    </div>
  );
}
