import { useRef, useState, type ReactNode } from 'react';
import { DropOverlay, toast } from '@kivi';
import { rejectMessage, useFileDrop } from '@kivi/hooks';
import { removeTask, submitTask } from '../../data/tasks';
import { uid } from '../../data/store';
import { TOOLS, toolOf, type Media, type ToolId } from '../../data/tools';
import { attempt } from '../../flows/errors';
import { ToolWorkbench, toolTaskInput, type Source, type ToolJob } from '../../parts/tool-workbench';
import { useToolHistory, type HistoryItem } from './history';
import { ToolsHistory } from './ToolsHistory';
import { ToolsRail } from './ToolsRail';
import { ToolsViewer } from './ToolsViewer';

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

  // 上传：点按钮、拖进来都走这里，放进当前工具。类型和当前工具不一样，就放进那一类的第一个工具并切过去
  const fileRef = useRef<HTMLInputElement>(null);
  const putSource = (m: Media, src: string, ratio: number) => {
    const target = m === media ? tool : TOOLS.find((t) => t.media === m)!.id;
    setSources((s) => ({ ...s, [target]: { id: uid('v'), media: m, src, ratio } }));
    if (target !== tool) setTool(target);
  };
  const addFile = (f: File) => {
    const url = URL.createObjectURL(f);
    if (f.type.startsWith('video')) {
      const el = document.createElement('video');
      el.onloadedmetadata = () => putSource('video', url, el.videoWidth / el.videoHeight || 16 / 9);
      el.src = url;
    } else {
      const el = new Image();
      el.onload = () => putSource('image', url, el.naturalWidth / el.naturalHeight || 1);
      el.src = url;
    }
  };
  const { dragging, rejected, bind } = useFileDrop({
    accept: 'image/*,video/*',
    multiple: false,
    onFiles: ([f]) => addFile(f),
    onReject: (_, reason) => toast.error(rejectMessage(reason)),
  });

  // 生成：舞台不动（原图还在，可以改参数再来一次），结果排在历史最上面
  const generate = (job: ToolJob) => void attempt(() => submitTask(toolTaskInput(job, { page: 'tools' })));

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
            onGenerate={generate}
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
            if (f) addFile(f);
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
        onRemove={(r) => void attempt(() => removeTask(r.id))}
      />

      <ToolsViewer item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
