import { toast } from '@kivi';
import { isGenNode } from '../rules/canvas';
import { GROUP_TEXT, groupExecutionRestriction } from '../rules/canvas-group';
import { attempt } from '../flows/errors';
import { request } from './api';
import { executeNode, getDoc, isBusy, nodeById } from './canvas-doc';
import { db } from './db';
import { pic } from './mock';
import { createStore, uid, useStore } from './store';
import { cancelTask } from './tasks';
import type { CanvasDoc, CanvasNode, Workflow, WorkflowTemplate } from './types';

/*
  组的动作（照线上 components/group/components/topbar.tsx）：整组执行 / 取消、保存工作流（存进「我的工作流」）。
  打组、解组、排列在 canvas-doc.ts、canvas-layout.ts。
  整组执行（照线上 runtime：组里除了上传的素材都执行）：按连线先后一波一波跑，上游出了结果下游再提交；
  上游失败了，下游不跑。演示里只跑文 / 图 / 视 / 音生成节点，工具节点、剪辑封装这些不跟着跑。
  执行状态只在内存里（刷新后各节点自己的任务照常倒计时）。
*/

/** 组里的节点（组不套组，只有一层） */
export const childrenOf = (doc: CanvasDoc, groupId: string) => doc.nodes.filter((n) => n.parentId === groupId);

/** 组里有忙的（生成中、上传中） */
export const groupBusy = (doc: CanvasDoc, groupId: string) => childrenOf(doc, groupId).some(isBusy);

// ---------- 整组执行 ----------

interface Run {
  canvasId: string;
  /** 还没提交的 */
  pending: string[];
  /** 提交了、等结果的：节点 id → 任务 id */
  running: Record<string, string>;
  /** 这次出了结果的 */
  done: string[];
  cancelling?: boolean;
}
const runs = createStore<Record<string, Run>>({ init: () => ({}) });
const setRun = (groupId: string, run: Run | undefined) =>
  runs.set((s) => {
    const next = { ...s };
    if (run) next[groupId] = run;
    else delete next[groupId];
    return next;
  });

/** 这个组在整组执行吗；cancelling 是正在取消 */
export const useGroupRun = (groupId: string) => useStore(runs, (s) => s[groupId]);

/**
 * 演示里能跟着整组执行的：生成节点。上传的素材、自己写的文字（有字没提示词，线上 node_input）不跑（照线上）；
 * 工具节点、剪辑封装演示里不跟着跑
 */
const runnable = (n: CanvasNode) => isGenNode(n) && !n.tool && !(n.type === 'text' && !!n.text && !n.prompt);

/** 推一步：上游都出了结果的提交；有在跑的就等；都没了就结束 */
async function step(groupId: string) {
  const run = runs.get()[groupId];
  if (!run || run.cancelling) return;
  const doc = getDoc(run.canvasId);
  const ids = new Set([...run.pending, ...Object.keys(run.running), ...run.done]);
  const ready: string[] = [];
  const blocked: string[] = [];
  for (const id of run.pending) {
    const ups = doc.edges.filter((e) => e.to === id && ids.has(e.from)).map((e) => e.from);
    if (ups.every((u) => run.done.includes(u))) ready.push(id);
    // 上游失败了（既没在跑、也没在等、也没出结果）：下游不跑
    else if (ups.some((u) => !run.done.includes(u) && !run.running[u] && !run.pending.includes(u))) blocked.push(id);
  }
  if (!ready.length && !blocked.length) {
    if (!Object.keys(run.running).length) setRun(groupId, undefined);
    return;
  }
  const pending = run.pending.filter((id) => !ready.includes(id) && !blocked.includes(id));
  setRun(groupId, { ...run, pending });
  const running: Record<string, string> = {};
  for (const id of ready) {
    const ok = await attempt(() => executeNode(run.canvasId, id).then(() => true));
    // 余额不足、断网：停下来，已经提交的照常跑
    if (ok === undefined) {
      const cur = runs.get()[groupId];
      if (cur) setRun(groupId, { ...cur, pending: [] });
      break;
    }
    const taskId = nodeById(getDoc(run.canvasId), id)?.taskId;
    if (taskId) running[id] = taskId;
  }
  const cur = runs.get()[groupId];
  if (!cur) return;
  const next = { ...cur, running: { ...cur.running, ...running } };
  setRun(groupId, next);
  if (!Object.keys(next.running).length) void step(groupId);
}

// 任务有变化：在跑的出了结果（或失败、取消），挪到 done，再推一步
db.subscribe(() => {
  const { tasks } = db.get();
  for (const [groupId, run] of Object.entries(runs.get())) {
    const settled = Object.entries(run.running).filter(([, taskId]) => tasks.find((t) => t.id === taskId)?.status !== 'running');
    if (!settled.length) continue;
    const running = { ...run.running };
    const done = [...run.done];
    for (const [nodeId, taskId] of settled) {
      delete running[nodeId];
      if (tasks.find((t) => t.id === taskId)?.status === 'done') done.push(nodeId);
    }
    setRun(groupId, { ...run, running, done });
    void step(groupId);
  }
});

/** 整组执行：有限制的节点就提示原因（照线上 group-execution-policy） */
export function executeGroup(canvasId: string, groupId: string) {
  if (runs.get()[groupId]) return;
  const kids = childrenOf(getDoc(canvasId), groupId);
  const reason = groupExecutionRestriction(kids);
  if (reason) {
    toast.warning(reason);
    return;
  }
  const pending = kids.filter(runnable).map((n) => n.id);
  if (!pending.length) return;
  setRun(groupId, { canvasId, pending, running: {}, done: [] });
  void step(groupId);
}

/** 取消整组执行：在跑的任务都取消（退回猕猴桃），没提交的不再提交 */
export async function cancelGroup(groupId: string) {
  const run = runs.get()[groupId];
  if (!run || run.cancelling) return;
  setRun(groupId, { ...run, pending: [], cancelling: true });
  await attempt(() => Promise.all(Object.values(run.running).map((id) => cancelTask(id))));
  setRun(groupId, undefined);
}

// ---------- 保存工作流 ----------

/** 组 → 一段工作流：组和它里面的节点、它们之间的连线，坐标从组的左上角算起；生成状态不带 */
export function groupTemplate(doc: CanvasDoc, groupId: string): WorkflowTemplate {
  const group = nodeById(doc, groupId);
  if (!group) return { nodes: [], edges: [] };
  const list = [group, ...childrenOf(doc, groupId)];
  const ids = new Set(list.map((n) => n.id));
  return {
    nodes: list.map((n) => ({ ...n, x: n.x - group.x, y: n.y - group.y, taskId: undefined })),
    edges: doc.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ from: e.from, to: e.to })),
  };
}

/** 组的封面：组里第一张图（视频用封面），没有就用默认图（照线上 getNodeCover） */
export function groupCover(doc: CanvasDoc, groupId: string): string {
  for (const n of childrenOf(doc, groupId)) {
    const item = n.items?.[0];
    if ((n.type === 'image' || n.type === 'video') && item) return item.poster ?? item.src;
  }
  return pic(0, '16:9');
}

/** 创建新工作流：存进「我的工作流」（底部「工作流」面板里看得到） */
export function createWorkflow(canvasId: string, groupId: string, name: string, cover: string): Promise<Workflow> {
  const template = groupTemplate(getDoc(canvasId), groupId);
  return request(() => {
    const wf: Workflow = { id: uid('wf'), name, cover, scope: 'private', createdAt: Date.now(), template };
    db.set((s) => ({ ...s, workflows: [wf, ...s.workflows] }));
    return wf;
  });
}

/** 更新历史工作流：用这个组的内容换掉选中的那个（名字、封面不变） */
export function updateWorkflow(canvasId: string, groupId: string, workflowId: string): Promise<void> {
  const template = groupTemplate(getDoc(canvasId), groupId);
  return request(() => {
    db.set((s) => ({ ...s, workflows: s.workflows.map((w) => (w.id === workflowId ? { ...w, template } : w)) }));
  });
}
