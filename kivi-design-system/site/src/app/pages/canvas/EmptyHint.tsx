import { Button } from '@kivi';
import { addNodes, makeNode } from '../../data/canvas-doc';
import { pic } from '../../data/mock';
import type { CanvasNode } from '../../data/types';
import type { Pt } from './geometry';

/*
  空画布（照线上 canvas-overlay）：正中「双击 画布添加节点」，下面 4 个快捷标签，点了插一段预置的节点和连线：
  文生图（文本 → 图片生成 1:1 2K 4 张）、图生图（上传图 → 图片生成）、图生视频（上传图 → 视频生成）、首尾帧（上传图 × 2 → 视频生成）。
  演示里「上传图」放一张示例图。
*/

interface Preset {
  label: string;
  build: (at: Pt) => { nodes: CanvasNode[]; edges: { from: string; to: string }[] };
}

const GAP = 140;

const PRESETS: Preset[] = [
  {
    label: '文生图',
    build: (at) => {
      const text = makeNode('text', { x: at.x - 256 - GAP / 2, y: at.y - 128 }, { text: '一颗剖开的猕猴桃，清晨逆光，清新绿色海报' });
      const image = makeNode('image', { x: at.x + GAP / 2, y: at.y - 128 }, { params: { ratio: '1:1', resolution: '2K' }, count: '4' });
      return { nodes: [text, image], edges: [{ from: text.id, to: image.id }] };
    },
  },
  {
    label: '图生图',
    build: (at) => {
      const src = makeNode('image', { x: at.x - 256 - GAP / 2, y: at.y - 128 }, { name: '参考图', upload: true, items: [{ src: pic(1) }] });
      const image = makeNode('image', { x: at.x + GAP / 2, y: at.y - 128 });
      return { nodes: [src, image], edges: [{ from: src.id, to: image.id }] };
    },
  },
  {
    label: '图生视频',
    build: (at) => {
      const src = makeNode('image', { x: at.x - 256 - GAP / 2, y: at.y - 128 }, { name: '参考图', upload: true, items: [{ src: pic(4) }] });
      const video = makeNode('video', { x: at.x + GAP / 2, y: at.y - 128 });
      return { nodes: [src, video], edges: [{ from: src.id, to: video.id }] };
    },
  },
  {
    label: '首尾帧',
    build: (at) => {
      const a = makeNode('image', { x: at.x - 256 - GAP / 2, y: at.y - 256 - 20 }, { name: '首帧', upload: true, items: [{ src: pic(1) }] });
      const b = makeNode('image', { x: at.x - 256 - GAP / 2, y: at.y + 20 }, { name: '尾帧', upload: true, items: [{ src: pic(5) }] });
      const video = makeNode('video', { x: at.x + GAP / 2, y: at.y - 128 }, { refMode: 'frames' });
      return { nodes: [a, b, video], edges: [{ from: a.id, to: video.id }, { from: b.id, to: video.id }] };
    },
  },
];

export interface EmptyHintProps {
  canvasId: string;
  /** 视口中心（世界坐标）：预置节点围着它摆 */
  at: () => Pt;
  onInserted: (ids: string[]) => void;
}

export function EmptyHint({ canvasId, at, onInserted }: EmptyHintProps) {
  return (
    <div className="tpl-cb__empty tpl-cb__ui">
      <div className="tpl-cb__empty-text">
        <span>双击</span>画布添加节点
      </div>
      <div className="tpl-cb__empty-tags">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="secondary-muted"
            onClick={() => {
              const { nodes, edges } = p.build(at());
              onInserted(addNodes(canvasId, nodes, edges));
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
