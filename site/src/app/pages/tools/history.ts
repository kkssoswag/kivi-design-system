import { useMemo } from 'react';
import { useDB } from '../../data/db';
import { ratioNum, videoPoster } from '../../data/mock';
import type { Media, ToolId } from '../../data/tools';
import type { Task } from '../../data/types';

/*
  工具页右侧的历史：从全站任务里取工具页生成的，新的在上。格子的图从任务的结果素材里找。
*/

export interface HistoryItem {
  /** 任务 id */
  id: string;
  task: Task;
  tool: ToolId;
  media: Media;
  src: string;
  /** 视频的封面 */
  poster?: string;
  /** 宽 / 高 */
  ratio: number;
  /** 卡片下面写的名字：扩图、局部重绘… */
  label: string;
  status: 'done' | 'generating' | 'failed';
  /** 用的原图 / 原视频，看大图的信息栏里显示 */
  origin: string;
}

export function useToolHistory(): HistoryItem[] {
  const tasks = useDB((s) => s.tasks);
  const assets = useDB((s) => s.assets);
  return useMemo(() => {
    const list: HistoryItem[] = [];
    const mine = tasks.filter((t) => t.where.page === 'tools' && t.status !== 'cancelled');
    for (const t of [...mine].sort((a, b) => b.createdAt - a.createdAt)) {
      const origin = t.refs[0]?.src ?? '';
      const media = t.media as Media;
      const base = { id: t.id, task: t, tool: t.tool as ToolId, media, label: t.label ?? '', origin };
      if (t.status === 'done') {
        const asset = assets.find((a) => a.id === t.outputs[0]?.assetId);
        if (!asset) continue;
        list.push({ ...base, src: asset.src, poster: asset.poster, ratio: ratioNum(asset.ratio), status: 'done' });
      } else {
        // 生成中、失败：先用原图垫着
        list.push({
          ...base,
          src: origin,
          poster: media === 'video' ? videoPoster(t.ratio) : undefined,
          ratio: ratioNum(t.ratio),
          status: t.status === 'failed' ? 'failed' : 'generating',
        });
      }
    }
    return list;
  }, [tasks, assets]);
}
