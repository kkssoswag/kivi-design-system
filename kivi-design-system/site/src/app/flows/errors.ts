import { notify, toast } from '@kivi';
import { ApiError } from '../data/api';
import { openBalanceDialog } from './dialogs';

/*
  出错统一处理（照线上 requestCommon / globalErrorNotifier 的分流）：
  - 余额不足 → 余额不足弹窗
  - 网络、超时 → 右上角常驻通知「服务异常请稍后再试」，同类 5 秒内只弹一次
  - 其他 → Toast 说原因
  页面里 try / catch 后只调 handleError(e)，不自己写提示。
*/

const DEDUPE_MS = 5000;
let lastNetwork = 0;

export function handleError(e: unknown) {
  if (!(e instanceof ApiError)) {
    toast.error('操作失败，请稍后再试');
    console.error(e);
    return;
  }
  switch (e.code) {
    case 'balance':
      openBalanceDialog({ need: Number(e.data?.need ?? 0), balance: Number(e.data?.balance ?? 0) });
      return;
    case 'network': {
      const now = Date.now();
      if (now - lastNetwork < DEDUPE_MS) return;
      lastNetwork = now;
      notify.error('服务异常请稍后再试', { description: e.message });
      return;
    }
    default:
      toast.error(e.message);
  }
}

/** 跑一个动作，出错交给 handleError；成功返回结果，失败返回 undefined */
export async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    handleError(e);
    return undefined;
  }
}
