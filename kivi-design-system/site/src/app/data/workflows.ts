import { request } from './api';
import { db, useDB } from './db';
import { uid } from './store';
import type { CanvasNode, WorkflowTemplate } from './types';

export { officialWorkflows, templateOf, WORKFLOW_CATEGORIES } from './seed/workflows';

/*
  画布底部「工作流」（照线上 left-toolbar/workflow-panel）：官方工作流（按分类）和我的工作流。
  官方的是演示数据（和探索页「工作流」同一批），我的存在 db.workflows。
  一个工作流就是一段节点和连线（template，坐标从 0 开始），「应用」时整段复制进画布（canvas-doc.ts 的 insertTemplate）。
  演示数据在 seed/workflows.ts。
*/

export const useMyWorkflows = () => useDB((s) => s.workflows);

/** 删除我的工作流 */
export function deleteWorkflow(id: string) {
  return request(() => db.set((s) => ({ ...s, workflows: s.workflows.filter((w) => w.id !== id) })));
}

/** 改名（预览里点标题改，只有我的能改） */
export function renameWorkflow(id: string, name: string) {
  return request(() => db.set((s) => ({ ...s, workflows: s.workflows.map((w) => (w.id === id ? { ...w, name } : w)) })));
}

/** 这个工作流的节点：每次应用都是新的一份（id 重新起） */
export function cloneTemplate(t: WorkflowTemplate): { nodes: CanvasNode[]; edges: { from: string; to: string }[] } {
  const ids = new Map(t.nodes.map((n) => [n.id, uid('n')]));
  return {
    nodes: t.nodes.map((n) => ({ ...n, id: ids.get(n.id)!, taskId: undefined, parentId: n.parentId && ids.get(n.parentId) })),
    edges: t.edges.flatMap((e) => (ids.has(e.from) && ids.has(e.to) ? [{ from: ids.get(e.from)!, to: ids.get(e.to)! }] : [])),
  };
}
