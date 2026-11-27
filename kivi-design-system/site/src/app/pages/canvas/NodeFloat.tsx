import { useEffect, type CSSProperties } from 'react';
import { NodePanel, type AttachmentItem, type GenNodeType } from '@kivi';
import { addUpstreamFile, disconnectPair, generateNode, reorderInputs, setNodeInputs, stopNodeGen, stopStartOf, upstreamOf, useNodeTask } from '../../data/canvas-doc';
import type { ToolId } from '../../data/tools';
import { attempt } from '../../flows/errors';
import { requestChapter } from '../../data/onboarding';
import { isGenNode } from '../../rules/canvas';
import type { CanvasDoc, CanvasItem, CanvasNode } from '../../data/types';
import { NodeToolbar } from './NodeToolbar';
import type { AnnotationNote } from './AnnotateDialog';
import { LipSyncPanel } from './LipSyncPanel';
import { NodeToolPanel, PANEL_TOOLS } from './NodeToolPanel';
import { LORAS } from '../../../docs/business/lora-data';

/*
  选中一个节点时浮在它上下的东西（照线上，同原来的小画布）：
  - 上面是节点工具栏（NodeToolbar）：图片、视频有结果、不在生成或上传时才出；文字、音频没有。
  - 下面是生成面板：生成节点才有（素材没有），空的、生成中也出（生成中按钮不能点）。
    工具节点（抠图、高清、循环…）下面是它自己的参数面板（NodeToolPanel）；扩图、重绘这类弹窗里编辑的、裁剪出来的没有面板。
  两个都和节点水平居中，大小不跟画布缩放（缩到 50% 以下才跟着小）。
*/

const TOOLBAR_GAP = 40;
const PANEL_GAP = 12;

export interface NodeFloatProps {
  canvasId: string;
  doc: CanvasDoc;
  node: CanvasNode;
  /** 生成中或上传中 */
  busy: boolean;
  /** 画布缩放：浮层不跟着缩（缩到 50% 以下才跟着小） */
  zoom: number;
  onView: (item: CanvasItem) => void;
  onDownload: () => void;
  /** 节点工具栏的框选：把节点加进对话 */
  onAddToChat?: (ids: string[], note?: AnnotationNote) => void;
  /** 双击生成面板里的参考图：画布聚焦到那个节点 */
  onLocate?: (id: string) => void;
}

export function NodeFloat({ canvasId, doc, node, busy, zoom, onView, onDownload, onAddToChat, onLocate }: NodeFloatProps) {
  const fixed = { '--cv-unzoom': 1 / Math.max(zoom, 0.5) } as CSSProperties;
  const center = node.x + node.w / 2;
  const hasResult = node.type === 'text' ? !!node.text : !!node.items?.length;
  // 生成中（有任务在跑，不算上传中）：生成按钮变停止
  const running = useNodeTask(node.taskId)?.status === 'running';
  const toolbar = hasResult && !busy && node.items?.[0] && (node.type === 'image' || node.type === 'video');

  // 参考素材：连进来的上游（文字节点的上游文字拼进提示词，不进附件条）
  const references: AttachmentItem[] = upstreamOf(doc, node.id)
    .filter((n) => n.type !== 'text' && n.type !== 'group')
    .map((n) => ({ id: n.id, type: n.type as AttachmentItem['type'], name: n.name, src: n.items?.[0]?.poster ?? (n.type === 'video' ? undefined : n.items?.[0]?.src), duration: n.items?.[0]?.duration }));
  // 新手引导：第一次选中带参考素材的生成节点，提示单击 @、双击定位
  const genPanel = !node.tool && node.preset !== 'lip-sync' && isGenNode(node);
  const hasRefs = genPanel && references.length > 0;
  useEffect(() => {
    if (hasRefs) requestChapter('canvas-refs');
  }, [hasRefs]);

  return (
    <>
      {toolbar && (
        <div className="cv-float cv-float--toolbar" style={{ ...fixed, left: center, top: node.y - TOOLBAR_GAP }}>
          <NodeToolbar canvasId={canvasId} node={node} onDownload={onDownload} onView={() => onView(node.items![0])} onAddToChat={onAddToChat} />
        </div>
      )}
      {node.tool ? (
        PANEL_TOOLS.includes(node.tool as ToolId) && (
          <div className="cv-float cv-float--panel" style={{ ...fixed, left: center, top: node.y + node.h + PANEL_GAP }}>
            <NodeToolPanel key={node.id} canvasId={canvasId} doc={doc} node={node} busy={busy} />
          </div>
        )
      ) : node.preset === 'lip-sync' ? (
        <div className="cv-float cv-float--panel" style={{ ...fixed, left: center, top: node.y + node.h + PANEL_GAP }}>
          <LipSyncPanel key={node.id} canvasId={canvasId} doc={doc} node={node} busy={busy} />
        </div>
      ) : (
        isGenNode(node) && (
        <div className="cv-float cv-float--panel" style={{ ...fixed, left: center, top: node.y + node.h + PANEL_GAP }}>
          <NodePanel
            key={node.id}
            expand
            type={node.type as GenNodeType}
            references={references}
            defaultValue={node.prompt}
            onChange={(prompt) => setNodeInputs(canvasId, node.id, { prompt })}
            model={node.model}
            onModelChange={(model) => setNodeInputs(canvasId, node.id, { model })}
            refMode={node.refMode}
            onRefModeChange={(refMode) => setNodeInputs(canvasId, node.id, { refMode })}
            params={node.params}
            onParamsChange={(params) => setNodeInputs(canvasId, node.id, { params })}
            count={node.count}
            onCountChange={(count) => setNodeInputs(canvasId, node.id, { count })}
            loras={node.loras}
            onLorasChange={(loras) => setNodeInputs(canvasId, node.id, { loras })}
            loraOptions={LORAS}
            onRemoveReference={(from) => disconnectPair(canvasId, from, node.id)}
            onReorderReference={(from, target) => reorderInputs(canvasId, node.id, from, target)}
            onLocateReference={onLocate}
            onUploadReference={(file) => void addUpstreamFile(canvasId, node.id, file)}
            onGenerate={(s) => attempt(() => generateNode(canvasId, node.id, s))}
            generating={busy}
            stopStartedAt={running ? stopStartOf(node.taskId) : undefined}
            onStop={running ? () => stopNodeGen(canvasId, node.id) : undefined}
          />
        </div>
        )
      )}
    </>
  );
}
