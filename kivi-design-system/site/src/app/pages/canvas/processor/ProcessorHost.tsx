import { useCanvasDoc } from '../../../data/canvas-doc';
import { ClipEditor } from './ClipEditor';
import { PackModal } from './PackModal';
import { closeProcessor, useOpenProcessor } from './state';
import './processor.css';

/**
 * 处理器节点的弹窗：画布页里放一个。节点上点「打开视频剪辑 / 打开视频封装」就开对应的弹窗（线上同一个 processor 节点按 action 分）。
 */
export function ProcessorHost({ canvasId }: { canvasId: string }) {
  const nodeId = useOpenProcessor();
  const doc = useCanvasDoc(canvasId);
  const node = nodeId ? doc.nodes.find((n) => n.id === nodeId) : undefined;
  if (!node) return null;
  if (node.type === 'clip') return <ClipEditor key={node.id} canvasId={canvasId} nodeId={node.id} onClose={closeProcessor} />;
  if (node.type === 'pack') return <PackModal key={node.id} canvasId={canvasId} nodeId={node.id} onClose={closeProcessor} />;
  return null;
}
