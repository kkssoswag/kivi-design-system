import { nodeSize } from '../rules/canvas';
import { LIP_TEXT, lipCost, lipProblem } from '../rules/lip-sync';
import { addFileNodes, attachTask, connect, getDoc, nodeById, upstreamOf } from './canvas-doc';
import { secondsOf } from './canvas-tools';
import { submitTask } from './tasks';
import type { CanvasDoc, CanvasNode, Ratio } from './types';

/*
  画布「对口型」节点（视频节点的一种预设，node.preset = 'lip-sync'）：连进来的一段视频、一段音频，
  生成走全站的假任务，结果是假的（直接用连进来的那段视频）。规则在 rules/lip-sync.ts。
*/

export type LipSlot = 'audio' | 'video';

export interface LipSyncState {
  audio?: CanvasNode;
  video?: CanvasNode;
  /** 秒，读不到是 undefined */
  audioSeconds?: number;
  videoSeconds?: number;
  cost: number;
  /** 不能生成的原因，能生成是 undefined */
  problem?: string;
}

/** 面板要的一切：两个格子里连着谁、时长、消耗、能不能生成 */
export function lipSyncState(doc: CanvasDoc, node: CanvasNode): LipSyncState {
  const ups = upstreamOf(doc, node.id);
  const audio = ups.find((n) => n.type === 'audio');
  const video = ups.find((n) => n.type === 'video');
  const audioSeconds = secondsOf(audio?.items?.[0]?.duration);
  const videoSeconds = secondsOf(video?.items?.[0]?.duration);
  return {
    audio,
    video,
    audioSeconds,
    videoSeconds,
    cost: lipCost(audioSeconds),
    problem: lipProblem({ hasAudio: !!audio?.items?.[0], hasVideo: !!video?.items?.[0], audio: audioSeconds, video: videoSeconds }),
  };
}

/** 空格子点了选文件：在对口型节点左边新建一个素材节点（上传语义）并连进来 */
export async function addLipSyncSource(canvasId: string, node: CanvasNode, slot: LipSlot, file: File) {
  if (!file.type.startsWith(slot)) return;
  const y = node.y + (slot === 'video' ? 0 : nodeSize('video', '16:9').h + 40);
  const [id] = await addFileNodes(canvasId, [file], { x: node.x - 400, y }, 0);
  if (id) connect(canvasId, id, node.id);
}

/** 点生成：提交假任务（余额不足、断网抛 ApiError，交给 attempt），任务记到节点上；再点一次是重新生成 */
export async function runLipSync(canvasId: string, nodeId: string) {
  const d = getDoc(canvasId);
  const node = nodeById(d, nodeId);
  if (!node) return;
  const st = lipSyncState(d, node);
  if (st.problem || !st.audio || !st.video) return;
  const ratio: Ratio = st.video.ratio ?? node.ratio ?? '16:9';
  const task = await submitTask({
    kind: 'tool',
    media: 'video',
    where: { page: 'canvas', canvasId, nodeId },
    tool: 'lip-sync',
    label: LIP_TEXT.title,
    params: {},
    // 第一项是原视频（任务标签里「原视频」用它），第二项是音频
    refs: [
      { type: 'video', src: st.video.items![0].src },
      { type: 'audio', src: st.audio.items![0].src },
    ],
    ratio,
    cost: st.cost,
    echo: true,
  });
  // 还没有结果的空节点跟着视频的比例改尺寸，有内容的不动
  attachTask(canvasId, nodeId, task.id, !node.items?.length && ratio !== node.ratio ? { ratio, ...nodeSize('video', ratio) } : {});
}
