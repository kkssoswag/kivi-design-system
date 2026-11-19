import { type CSSProperties, type ReactElement } from 'react';
import { Button, ButtonGroup, Divider, IconButton, NodePanel, toast, type AttachmentItem, type GenNodeType } from '@kivi';
import { disconnectPair, generateNode, reorderInputs, setNodeInputs, upstreamOf } from '../../data/canvas-doc';
import { attempt } from '../../flows/errors';
import type { CanvasDoc, CanvasItem, CanvasNode } from '../../data/types';

/*
  选中一个节点时浮在它上下的东西（照线上，同原来的小画布）：
  - 上面是节点工具栏：有结果、不在生成或上传时才出；文字节点没有（编辑文字以后做）；音频没有。
  - 下面是生成面板：生成节点才有（素材没有），空的、生成中也出（生成中按钮不能点）。
  两个都和节点水平居中，大小不跟画布缩放（缩到 50% 以下才跟着小）。
  工具栏里的工具（抠图、扩图、视频高清…）下一步接，现在点了提示一声。
*/

const TOOLBAR_GAP = 40;
const PANEL_GAP = 12;

const soon = () => toast.info('这个工具下一步接上');

function toolbarOf(node: CanvasNode, onDownload: () => void, onView: () => void): ReactElement | null {
  const tail = (
    <>
      <Divider orientation="vertical" />
      <IconButton icon="ImageToText" label={node.type === 'video' ? '视频推词' : '图推词'} onClick={soon} />
      <IconButton icon="Download" label="下载" onClick={onDownload} />
      <IconButton icon="FullScreen" label="全屏" onClick={onView} />
    </>
  );
  if (node.type === 'image') {
    return (
      <ButtonGroup variant="glass" size={44} aria-label="节点工具栏">
        {(
          [
            ['Rmbg', '抠图'],
            ['Crop', '裁剪'],
            ['Expand', '扩图'],
            ['HD', '高清'],
            ['SmartEditing', '重绘'],
            ['RemoveEle', '元素去除'],
            ['DragSelect', '框选'],
            ['TextEditing', '编辑文字'],
          ] as const
        ).map(([icon, label]) => (
          <Button key={label} variant="ghost" leftIcon={icon} onClick={soon}>
            {label}
          </Button>
        ))}
        {tail}
      </ButtonGroup>
    );
  }
  if (node.type === 'video') {
    return (
      <ButtonGroup variant="glass" size={44} aria-label="节点工具栏">
        {(
          [
            ['VideoLoop', '循环'],
            ['HD', '高清'],
            ['Connecting', '拼接'],
            ['Rmbg', '抠图'],
            ['Pack', '封装'],
            ['Cutting', '剪辑'],
          ] as const
        ).map(([icon, label]) => (
          <Button key={label} variant="ghost" leftIcon={icon} onClick={soon}>
            {label}
          </Button>
        ))}
        {tail}
      </ButtonGroup>
    );
  }
  return null;
}

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
}

export function NodeFloat({ canvasId, doc, node, busy, zoom, onView, onDownload }: NodeFloatProps) {
  const fixed = { '--cv-unzoom': 1 / Math.max(zoom, 0.5) } as CSSProperties;
  const center = node.x + node.w / 2;
  const hasResult = node.type === 'text' ? !!node.text : !!node.items?.length;
  const toolbar = hasResult && !busy && node.items?.[0] ? toolbarOf(node, onDownload, () => onView(node.items![0])) : null;

  // 参考素材：连进来的上游（文字节点的上游文字拼进提示词，不进附件条）
  const references: AttachmentItem[] = upstreamOf(doc, node.id)
    .filter((n) => n.type !== 'text' && n.type !== 'group')
    .map((n) => ({ id: n.id, type: n.type as AttachmentItem['type'], name: n.name, src: n.items?.[0]?.poster ?? n.items?.[0]?.src, duration: n.items?.[0]?.duration }));

  return (
    <>
      {toolbar && (
        <div className="cv-float cv-float--toolbar" style={{ ...fixed, left: center, top: node.y - TOOLBAR_GAP }}>
          {toolbar}
        </div>
      )}
      {!node.upload && node.type !== 'group' && (
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
            onRemoveReference={(from) => disconnectPair(canvasId, from, node.id)}
            onReorderReference={(from, target) => reorderInputs(canvasId, node.id, from, target)}
            onGenerate={(s) => void attempt(() => generateNode(canvasId, node.id, s))}
            generating={busy}
          />
        </div>
      )}
    </>
  );
}
