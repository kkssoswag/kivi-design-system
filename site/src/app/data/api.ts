import { demo } from './demo';

/*
  假接口：所有会「请求后端」的动作都包一层 request，统一模拟网络延迟和出错。
  出错一律抛 ApiError，页面不自己判断，交给 flows/errors.ts 的 handleError 按类型提示（照线上的分流）。
*/

export type ApiErrorCode =
  /** 余额不足（线上错误码 8001）：弹余额不足弹窗 */
  | 'balance'
  /** 网络断了、超时：右上角常驻通知「服务异常请稍后再试」 */
  | 'network'
  /** 画布被别的窗口改了（线上 8006）：Toast 后拉最新数据 */
  | 'conflict'
  /** 模型下架 */
  | 'offline-model'
  /** 其他：Toast 说原因 */
  | 'server';

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    /** 附带的数据，比如余额不足时 { need, balance } */
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const between = (a: number, b: number) => a + Math.random() * (b - a);

/** 模拟一次请求：等一会儿再执行 fn；演示开关开了断网就报错 */
export async function request<T>(fn: () => T | Promise<T>): Promise<T> {
  const d = demo.get();
  await wait(d.slow ? between(1500, 3000) : between(120, 360));
  if (demo.get().offline) throw new ApiError('network', '网络连接失败，请检查网络后重试');
  return fn();
}
