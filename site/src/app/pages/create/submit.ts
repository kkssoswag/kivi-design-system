import { REF_MODES, genCost, type PromptBoxSubmit } from '@kivi';
import { nearestRatio, ratioNum } from '../../data/mock';
import type { TaskInput } from '../../data/tasks';
import type { Task, Where } from '../../data/types';

/*
  把输入框交出来的选择（PromptBoxSubmit）转成生成任务的入参，创作首页、对话页共用。
  Agent 返回 null（Agent 还没做假后端，提交不做事）。
  参考：首尾帧用两张帧图，别的用参考区里的图片、视频、音频；视频记下参考方式的名字（「全能参考」「首尾帧」）。
  比例：参数里的比例换成最接近的占位图比例（四种之一），音频固定 1:1。
*/
export function genTaskInput(s: PromptBoxSubmit, where: Where): TaskInput | null {
  if (s.task === 'agent') return null;
  const media = s.task;
  const refs: Task['refs'] = [];
  if (media === 'video' && s.refMode === 'frames') {
    if (s.frames.first) refs.push({ type: 'image', src: s.frames.first, label: '首帧' });
    if (s.frames.last) refs.push({ type: 'image', src: s.frames.last, label: '尾帧' });
  } else {
    for (const r of s.references) {
      if (r.type === 'image' || r.type === 'video' || r.type === 'audio') refs.push({ type: r.type, src: r.src ?? r.video ?? '', label: r.name });
    }
  }
  return {
    kind: 'gen',
    media,
    where,
    prompt: s.text,
    model: s.model,
    params: s.params,
    refs,
    refLabel: media === 'video' && refs.length ? REF_MODES.find((m) => m.value === s.refMode)?.label : undefined,
    refMode: media === 'video' ? s.refMode : undefined,
    ratio: media === 'audio' ? '1:1' : nearestRatio(ratioNum(s.params.ratio ?? '1:1')),
    count: s.count,
    cost: genCost(media, s.model) * s.count,
  };
}
