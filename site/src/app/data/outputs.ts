import { request } from './api';
import { db } from './db';

/*
  删任务里的一格失败的结果（失败的格子没有素材，removeAssets 删不到它）。
  一格都不剩的任务整个删。
*/

export function removeOutput(taskId: string, index: number) {
  return request(() =>
    db.set((s) => ({
      ...s,
      tasks: s.tasks
        .map((t) => (t.id === taskId ? { ...t, outputs: t.outputs.filter((_, i) => i !== index) } : t))
        .filter((t) => t.id !== taskId || t.outputs.length > 0),
    })),
  );
}
