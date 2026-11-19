import type { ReactNode } from 'react';
import { toast } from '@kivi';
import { confirm, DELETE_CONFIRM } from './dialogs';
import { handleError } from './errors';

/**
 * 删除：先二次确认（DELETE_CONFIRM），确认按钮转圈等 action 做完，成功 Toast「删除成功」。
 * options.description 换说明文案（标题、按钮不变，比如删文件夹）。
 * action 出错交给 handleError，弹窗不关（可再点或取消）。返回是否删了。
 * 页面里所有用户主动删除都走它；发送失败后的回滚这类不是用户删除，不走。
 */
export async function confirmDelete(action: () => Promise<unknown>, options?: { description?: ReactNode }): Promise<boolean> {
  const ok = await confirm({
    ...DELETE_CONFIRM,
    ...options,
    onConfirm: async () => {
      try {
        await action();
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
  });
  if (ok) toast.success('删除成功');
  return ok;
}
