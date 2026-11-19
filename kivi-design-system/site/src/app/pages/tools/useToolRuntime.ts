import { useEffect, useMemo, useState } from 'react';
import { toast } from '@kivi';
import { db, useDB } from '../../data/db';
import { ratioNum } from '../../data/mock';
import { uid } from '../../data/store';
import { onTaskSettled, retryTask } from '../../data/tasks';
import type { ToolId } from '../../data/tools';
import type { Task } from '../../data/types';
import { handleError } from '../../flows/errors';
import type { Source, ToolRuntime } from '../../parts/tool-workbench';

/*
  工具页每个工具的运行状态：有没有在生成（舞台盖生成中）、刚失败的（舞台出重试 / 取消）、成功几次、拼接的结果。
  任务出结果时在这里弹 Toast：「图片生成成功」「视频生成成功」。
*/

export function useToolRuntime() {
  const tasks = useDB((s) => s.tasks);
  // 每个工具最近一条生成中的任务
  const running = useMemo(() => {
    const map: Partial<Record<ToolId, Task>> = {};
    for (const t of tasks) {
      if (t.where.page !== 'tools' || t.status !== 'running' || t.hold) continue;
      const id = t.tool as ToolId;
      if (!map[id] || map[id]!.createdAt < t.createdAt) map[id] = t;
    }
    return map;
  }, [tasks]);

  const [failed, setFailed] = useState<Partial<Record<ToolId, Task | null>>>({});
  const [successes, setSuccesses] = useState<Partial<Record<ToolId, number>>>({});
  const [stitchResult, setStitchResult] = useState<Source | null>(null);

  useEffect(() => {
    const off = onTaskSettled((t) => {
      if (t.where.page !== 'tools') return;
      const id = t.tool as ToolId;
      if (t.status === 'failed') return setFailed((f) => ({ ...f, [id]: t }));
      if (t.status !== 'done') return;
      toast.success(t.media === 'video' ? '视频生成成功' : '图片生成成功');
      setSuccesses((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
      if (id === 'stitch') {
        const asset = db.get().assets.find((a) => a.id === t.outputs[0]?.assetId);
        if (asset) setStitchResult({ id: uid('v'), media: 'video', src: asset.src, ratio: ratioNum(asset.ratio) });
      }
    });
    return () => void off();
  }, []);

  const clearFailed = (id: ToolId) => setFailed((f) => ({ ...f, [id]: null }));
  const retry = async (id: ToolId) => {
    const t = failed[id];
    if (!t) return;
    try {
      await retryTask(t.id);
      clearFailed(id);
    } catch (e) {
      handleError(e);
    }
  };

  /** 给某个工具的工作区的运行状态 */
  const runtimeOf = (id: ToolId, extra: Pick<ToolRuntime, 'uploading' | 'onContinue'>): ToolRuntime => ({
    running: running[id],
    failed: failed[id],
    onRetry: () => void retry(id),
    onCancelFail: () => clearFailed(id),
    successCount: successes[id] ?? 0,
    stitchResult: id === 'stitch' ? stitchResult : undefined,
    ...extra,
  });

  return { runtimeOf, clearFailed, clearStitchResult: () => setStitchResult(null) };
}
