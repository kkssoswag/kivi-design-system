import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DropOverlay, toast } from '@kivi';
import { matchAccept, rejectMessage, useFileDrop } from '@kivi/hooks';
import { removeTask, submitTask } from '../../data/tasks';
import { takeFirstFailure } from '../../data/tool-mock';
import { uid } from '../../data/store';
import { TOOLS, toolOf, type ToolId } from '../../data/tools';
import { confirmDelete } from '../../flows/delete';
import { attempt } from '../../flows/errors';
import { ToolWorkbench, checkToolFile, loadToolFile, mediaOfFile, toolTaskInput, type Source, type ToolJob } from '../../parts/tool-workbench';
import { useToolHistory, type HistoryItem } from './history';
import { ToolsHistory } from './ToolsHistory';
import { ToolsRail } from './ToolsRail';
import { ToolsViewer } from './ToolsViewer';
import { useToolRuntime } from './useToolRuntime';

/*
  AI 工具页：左边切工具（图片、视频不分开），中间是舞台，右边是历史。
  每个工具各管各的：自己的原图、舞台（扩图框、涂抹）、提示词，切走再切回来还在；生成的结果不回舞台，只进右边的历史。
  历史放所有工具生成的结果（上传的原图不进），点了全屏看；右键可以「加入当前工具」，把它当成当前工具的原图接着改。
  生成走 submitTask（假任务，到点出结果），历史就是全站任务里工具页的那些。讨论和待定记在 page-notes/ai-tools.md。
*/

/** account：右栏顶上的余额和头像（主站外壳传进来） */
export function ToolsPage({ account }: { account?: ReactNode }) {
  const [tool, setTool] = useState<ToolId>('expand');
  const media = toolOf(tool).media;
  // 每个工具一张原图，切走再切回来还在（页面状态，不进 db）
  const [sources, setSources] = useState<Partial<Record<ToolId, Source>>>({});
  const history = useToolHistory();
  const { runtimeOf, clearFailed, clearStitchResult } = useToolRuntime();

  // 上传：点按钮、拖进来都走这里，放进当前工具。类型和当前工具不一样，就放进那一类的第一个工具并切过去。
  // 视频要等一会儿（假上传），这时舞台出「视频上传中...」，传完才能生成；图片直接放进来
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Partial<Record<ToolId, boolean>>>({});
  const take = async (f: File) => {
    const ok = await checkToolFile(f);
    if (!ok) return;
    const m = mediaOfFile(ok);
    const target = m === media ? tool : TOOLS.find((t) => t.media === m)!.id;
    if (target !== tool) setTool(target);
    setUploading((u) => ({ ...u, [target]: true }));
    try {
      const r = await loadToolFile(ok);
      if (!r) return;
      setSources((s) => ({ ...s, [target]: { id: uid('v'), ...r } }));
      clearFailed(target);
      if (target === 'stitch') clearStitchResult();
    } finally {
      setUploading((u) => ({ ...u, [target]: false }));
    }
  };
  // 视频拼接的位自己收文件时，页面这层不抢（只在视频1已经有了时让开）
  const { dragging, rejected, bind } = useFileDrop({
    accept: 'image/*,video/*',
    multiple: false,
    disabled: tool === 'stitch' && !!sources.stitch,
    onFiles: ([f]) => void take(f),
    onReject: (_, reason) => toast.error(rejectMessage(reason)),
  });
  // 粘贴上传（照线上工具页）：页面上 ⌘V 粘贴图片、视频，只取第一个；焦点在输入框里（提示词）时不管，照常粘文字
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => matchAccept(f, 'image/*,video/*'));
      if (!file) return;
      e.preventDefault();
      void take(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  // 生成：舞台盖生成中的样子，参数照常能改、能再提交（不限并发），结果排在历史最上面。扩图、视频高清每个工具第一次固定失败一次
  const generate = (job: ToolJob) => {
    clearFailed(job.tool);
    void attempt(() => submitTask({ ...toolTaskInput(job, { page: 'tools' }), forceFail: takeFirstFailure(job.tool) }));
  };
  const removeSource = (id: ToolId) => {
    setSources((s) => ({ ...s, [id]: undefined }));
    clearFailed(id);
    if (id === 'stitch') clearStitchResult();
  };

  const [preview, setPreview] = useState<HistoryItem | null>(null);
  const useInTool = (r: HistoryItem) => setSources((s) => ({ ...s, [tool]: { id: uid('v'), media: r.media, src: r.src, ratio: r.ratio } }));

  return (
    <div className="tpl-at" {...bind}>
      <ToolsRail tool={tool} onChange={setTool} />

      <div className="tpl-at__main">
        {TOOLS.map((t) => (
          <ToolWorkbench
            key={t.id}
            tool={t.id}
            hidden={t.id !== tool}
            source={sources[t.id] ?? null}
            onUpload={() => fileRef.current?.click()}
            onRemove={() => removeSource(t.id)}
            onFile={(f) => void take(f)}
            onGenerate={generate}
            runtime={runtimeOf(t.id, {
              uploading: !!uploading[t.id],
              onContinue: (r) => (setSources((s) => ({ ...s, stitch: r })), clearStitchResult()),
            })}
          />
        ))}
        <DropOverlay active={dragging} rejected={rejected} />
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={media === 'image' ? 'image/*' : 'video/*'}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void take(f);
            e.target.value = '';
          }}
        />
      </div>

      <ToolsHistory
        account={account}
        items={history}
        media={media}
        onPreview={setPreview}
        onUseInTool={useInTool}
        onRemove={(r) => void confirmDelete(() => removeTask(r.id))}
      />

      <ToolsViewer item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
