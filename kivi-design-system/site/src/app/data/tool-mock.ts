import type { ToolId } from './tools';
import { ApiError, listDelay } from './api';
import { demo } from './demo';

/*
  AI 工具页的假后端：上传视频要等一会儿、个别工具第一次生成固定失败（看失败态的样子）。
*/

/** 每个工具第一次生成固定失败一次（11-18 用户定，看效果用）：扩图、视频高清 */
const FAIL_FIRST: ToolId[] = ['expand', 'video-hd'];
const failedOnce = new Set<ToolId>();

/** 这次提交要不要固定失败：每个工具只有第一次是 true，刷新页面后重新来一次 */
export function takeFirstFailure(tool: ToolId): boolean {
  if (!FAIL_FIRST.includes(tool) || failedOnce.has(tool)) return false;
  failedOnce.add(tool);
  return true;
}

/** 假上传：等一会儿（和列表加载一样的时长，慢网更久）；断网报错 */
export function uploadMock(): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (demo.get().offline) reject(new ApiError('network', '网络连接失败，请检查网络后重试'));
      else resolve();
    }, listDelay());
  });
}
