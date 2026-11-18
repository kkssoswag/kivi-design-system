import { request } from './api';
import { db } from './db';
import { uid } from './store';
import type { CanvasMeta } from './types';

/*
  画布列表的动作：新建、重命名、置顶、删除。侧栏的画布历史、资产页「我的画布」读 db.canvases。
  画布里的节点以后单独存，这里只管名字、封面、置顶这些列表信息。
*/

const patchCanvas = (id: string, fn: (c: CanvasMeta) => CanvasMeta) => db.set((s) => ({ ...s, canvases: s.canvases.map((c) => (c.id === id ? fn(c) : c)) }));

/** 新建一块空画布 */
export function createCanvas(name: string): Promise<CanvasMeta> {
  return request(() => {
    const canvas: CanvasMeta = { id: uid('c'), name, updatedAt: Date.now(), covers: [] };
    db.set((s) => ({ ...s, canvases: [canvas, ...s.canvases] }));
    return canvas;
  });
}

/** 重命名（不动更新时间，列表不跳） */
export function renameCanvas(id: string, name: string) {
  return request(() => patchCanvas(id, (c) => ({ ...c, name })));
}

/** 置顶 / 取消置顶（翻转） */
export function pinCanvas(id: string) {
  return request(() => patchCanvas(id, (c) => ({ ...c, pinned: !c.pinned })));
}

export function deleteCanvas(id: string) {
  return request(() => db.set((s) => ({ ...s, canvases: s.canvases.filter((c) => c.id !== id) })));
}
