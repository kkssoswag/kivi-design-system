import { useEffect } from 'react';
import { GENERATION_FAILED_TITLE, toast } from '@kivi';
import { onTaskSettled } from '../../data/tasks';

/*
  工具页的任务结果提示。舞台只用来提交任务（11-19 用户定）：提交了还能接着改、接着提交，生成中、结果、失败都只在右侧历史里，
  舞台不盖生成中、不出失败、不把结果放回来，成功了也不动舞台（扩图框不回默认）。
  出结果时弹 Toast：「图片生成成功」「视频生成成功」，失败「生成失败，消耗猕猴桃已退回」。
*/

export function useToolResultToasts() {
  useEffect(() => {
    const off = onTaskSettled((t) => {
      if (t.where.page !== 'tools') return;
      if (t.status === 'failed') return void toast.error(GENERATION_FAILED_TITLE);
      if (t.status === 'done') toast.success(t.media === 'video' ? '视频生成成功' : '图片生成成功');
    });
    return () => void off();
  }, []);
}
