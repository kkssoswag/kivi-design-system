import { useSyncExternalStore, type ReactNode } from 'react';
import { Button, Dialog, Icon } from '@kivi';

/*
  全站共用的弹窗流程，任何地方一句话调用，不用每页自己放 Dialog：
  - confirm({...})：二次确认，返回 Promise<boolean>。传了 onConfirm 就在确认按钮上转圈等它做完再关
  - openBalanceDialog({ need, balance })：余额不足（照线上 BalanceModal 的文案）
  App 里放一个 <FlowHost />。
*/

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  /** 确认按钮的字，默认「确定」 */
  confirmText?: string;
  /** 危险操作（删除）：确认按钮用危险类型。默认 true */
  danger?: boolean;
  /** 确认后要做的事：做完才关弹窗，期间按钮转圈；抛错就不关（错误自己处理） */
  onConfirm?: () => Promise<unknown>;
}

type State =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void; busy: boolean }
  | { kind: 'balance'; need: number; balance: number }
  | null;

let state: State = null;
const listeners = new Set<() => void>();
const setState = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

/** 删除这类操作前问一下 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => setState({ kind: 'confirm', options, resolve, busy: false }));
}

/** 删除确认的固定文案（照线上） */
export const DELETE_CONFIRM = { title: '确认删除该内容吗？', description: '删除后，内容将无法找回', confirmText: '删除' } as const;

export function openBalanceDialog({ need, balance }: { need: number; balance: number }) {
  setState({ kind: 'balance', need, balance });
}

export function FlowHost() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

  const closeConfirm = (ok: boolean) => {
    if (s?.kind !== 'confirm' || s.busy) return;
    s.resolve(ok);
    setState(null);
  };
  const doConfirm = async () => {
    if (s?.kind !== 'confirm') return;
    const { onConfirm } = s.options;
    if (!onConfirm) return closeConfirm(true);
    setState({ ...s, busy: true });
    try {
      await onConfirm();
      s.resolve(true);
      setState(null);
    } catch {
      setState({ ...s, busy: false });
    }
  };

  return (
    <>
      <Dialog
        open={s?.kind === 'confirm'}
        onOpenChange={(v) => !v && closeConfirm(false)}
        title={s?.kind === 'confirm' ? s.options.title : undefined}
        description={s?.kind === 'confirm' ? s.options.description : undefined}
        footer={
          s?.kind === 'confirm' && (
            <>
              <Button size={36} variant="secondary" disabled={s.busy} onClick={() => closeConfirm(false)}>
                取消
              </Button>
              <Button size={36} variant={s.options.danger === false ? 'primary' : 'danger'} loading={s.busy} onClick={doConfirm}>
                {s.options.confirmText ?? '确定'}
              </Button>
            </>
          )
        }
      />
      <Dialog
        open={s?.kind === 'balance'}
        onOpenChange={(v) => !v && setState(null)}
        title="剩余数量不足"
        description="你没有足够的次数进行此操作请下周再来尝试"
        footer={
          <Button size={36} variant="primary" onClick={() => setState(null)}>
            确认
          </Button>
        }
      >
        {s?.kind === 'balance' && (
          <dl className="app-balance">
            <dt>剩余数量</dt>
            <dd>
              <Icon name="Kiwi" size={16} />
              {s.balance}
            </dd>
            <dt>需要数量</dt>
            <dd>
              <Icon name="Kiwi" size={16} />
              {s.need}
            </dd>
          </dl>
        )}
      </Dialog>
    </>
  );
}
