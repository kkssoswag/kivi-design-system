import { createStore, useStore } from './store';

/*
  演示开关：右下角小面板里切，用来演示出错的样子。存进本机。
  - failNext：下一次生成到点失败（只管一次，用完自动关）
  - lowBalance：提交生成时一律报余额不足
  - offline：所有请求报网络错误
  - slow：所有请求慢 1.5–3 秒（看加载态）
  - fast：生成 3 秒出结果（平时按任务类型估时：图片 20 秒、视频 60 秒、音频 15 秒）
  - askQuestion：Agent 每次回复先出问题卡（换掉输入框），答完或忽略再接着回复
  - larkAuth：Agent 每次回复先要飞书授权（换掉输入框），授权或取消后接着回复
  问题卡和飞书授权互斥，开一个关一个（Agent 一次只等用户回一张卡）。画布手动模式的生成确认不用开关，每次生成前都会问
*/

export interface DemoSwitches {
  failNext: boolean;
  lowBalance: boolean;
  offline: boolean;
  slow: boolean;
  fast: boolean;
  askQuestion: boolean;
  larkAuth: boolean;
}

export const demo = createStore<DemoSwitches>({
  key: 'kivi-app-demo',
  version: 1,
  init: () => ({ failNext: false, lowBalance: false, offline: false, slow: false, fast: true, askQuestion: false, larkAuth: false }),
});

export const useDemo = () => useStore(demo, (s) => s);

export function setDemo(patch: Partial<DemoSwitches>) {
  demo.set((s) => ({ ...s, ...patch }));
}
