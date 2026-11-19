import { createStore, useStore } from '../../../data/store';

/*
  处理器节点（视频剪辑、视频封装）的弹窗开关：节点上的「打开…」按钮调 openProcessor，
  画布页里放一个 <ProcessorHost canvasId /> 负责画弹窗。同一时刻只开一个（照线上：单活跃剪辑器）。
  只在内存里，刷新就关。
*/

const store = createStore<{ nodeId: string } | null>({ init: () => null });

export const openProcessor = (nodeId: string) => store.set({ nodeId });
export const closeProcessor = () => store.set(null);
export const useOpenProcessor = () => useStore(store, (s) => s?.nodeId);
