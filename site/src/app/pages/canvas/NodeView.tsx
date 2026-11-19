import { type ReactElement } from 'react';
import { Button, IconButton, NodeCard, NodeMedia, NodeStack, NodeStackToggle, NodeWrapper, type NodeMediaType, type NodeWrapperRatio } from '@kivi';
import { countdownLabel } from '../../data/tasks';
import type { CanvasItem, CanvasNode, Task } from '../../data/types';

/*
  一个节点画成什么样（照原来的小画布，状态从数据来）：
  - 素材节点：完成，右上全屏、下载、「上传」（换一个文件），上传中左上转圈。
  - 生成节点：没内容是引导；任务生成中是生成中（有旧结果当底图、倒计时）；任务失败是失败；有内容是完成。
  - 多张结果叠放（NodeStack），点「张数」展开，点别的设为主图。
*/

const RATIOS: NodeWrapperRatio[] = ['1:1', '3:4', '16:9', '4:3', '9:16'];
/** NodeWrapper 只有这几种比例；别的比例按宽高最接近的 */
export function wrapperRatio(n: CanvasNode): NodeWrapperRatio | undefined {
  if (n.type === 'audio') return '4:3';
  if (n.type === 'text') return '1:1';
  const r = n.ratio as NodeWrapperRatio | undefined;
  return r && RATIOS.includes(r) ? r : undefined;
}

export interface NodeViewProps {
  node: CanvasNode;
  task?: Task;
  uploading?: boolean;
  now: number;
  selected?: boolean;
  /** 左右连接点：有线连着就是已连接 */
  inLinked?: boolean;
  outLinked?: boolean;
  /** 正在拖连线、悬停在这个节点上并且能连：左边入口高亮 */
  inHighlight?: boolean;
  /** 多张结果展开了没有 */
  stackOpen?: boolean;
  onStackOpenChange?: (open: boolean) => void;
  /** 多张里点了别的：设为主图 */
  onSetMain?: (index: number) => void;
  /** 素材节点点「上传」 */
  onReplace?: () => void;
  /** 全屏看 */
  onView?: (item: CanvasItem) => void;
  onDownload?: () => void;
  /** 引导里选了一项（自己编写内容…） */
  onGuideSelect?: (option: string) => void;
}

function mediaOf(node: CanvasNode, item?: CanvasItem) {
  const type = node.type as NodeMediaType;
  if (type === 'text') return <NodeMedia type="text">{node.text}</NodeMedia>;
  if (type === 'audio') return <NodeMedia type="audio" src={item?.src} />;
  if (type === 'video') return <NodeMedia type="video" src={item?.src} />;
  return <NodeMedia type="image" src={item?.src} />;
}

export function NodeView({ node, task, uploading, now, selected, inLinked, outLinked, inHighlight, stackOpen, onStackOpenChange, onSetMain, onReplace, onView, onDownload, onGuideSelect }: NodeViewProps) {
  const type = node.type as NodeMediaType;
  const items = node.items ?? [];
  const media = type === 'image' || type === 'video';
  const viewButtons = (item: CanvasItem) => (
    <>
      <IconButton icon="FullScreen" label="全屏" onClick={() => onView?.(item)} />
      <IconButton icon="Download" label="下载" onClick={onDownload} />
    </>
  );

  let body: ReactElement;
  if (node.upload) {
    body = (
      <NodeCard
        status="done"
        type={type}
        uploading={uploading || undefined}
        iconButton={items[0] && viewButtons(items[0])}
        textButton={
          <Button leftIcon="Upload" disabled={uploading} onClick={onReplace}>
            上传
          </Button>
        }
      >
        {mediaOf(node, items[0])}
      </NodeCard>
    );
  } else if (task?.status === 'running') {
    body = <NodeCard status="generating" type={type} cover={media ? items[0]?.poster ?? items[0]?.src : undefined} countdown={countdownLabel(task, now)} />;
  } else if (task?.status === 'failed') {
    body = <NodeCard status="failed" type={type} failedTitle={task.error} />;
  } else if (type === 'text' ? !node.text : !items.length) {
    body = <NodeCard status="guide" type={type} onGuideSelect={onGuideSelect} />;
  } else if (items.length > 1) {
    body = (
      <NodeStack expanded={stackOpen}>
        {items.map((item, i) => (
          <NodeCard
            key={`${i}:${item.src}`}
            status="done"
            type={type}
            hoverActions={media || undefined}
            collect={media || undefined}
            iconButton={viewButtons(item)}
            textButton={
              i === 0 ? (
                <NodeStackToggle count={items.length} expanded={stackOpen} onClick={() => onStackOpenChange?.(!stackOpen)} />
              ) : (
                <Button onClick={() => onSetMain?.(i)}>设为主图</Button>
              )
            }
            onClick={i === 0 ? undefined : (e) => !(e.target as HTMLElement).closest('button') && onSetMain?.(i)}
          >
            {mediaOf(node, item)}
          </NodeCard>
        ))}
      </NodeStack>
    );
  } else {
    body = (
      <NodeCard status="done" type={type} hoverActions={media || undefined} collect={media || undefined} iconButton={media && items[0] ? viewButtons(items[0]) : undefined}>
        {mediaOf(node, items[0])}
      </NodeCard>
    );
  }

  return (
    <NodeWrapper
      ratio={wrapperRatio(node)}
      name={node.name}
      leftDot={node.upload ? undefined : inHighlight ? 'highlight' : inLinked ? 'connected' : 'default'}
      rightDot={outLinked ? 'connected' : 'default'}
      selected={selected || undefined}
      style={{ width: node.w, height: node.h }}
    >
      {body}
    </NodeWrapper>
  );
}
