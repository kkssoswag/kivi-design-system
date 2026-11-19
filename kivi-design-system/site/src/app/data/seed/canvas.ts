import { DEMO_AUDIO, DEMO_VIDEO, pic, videoPoster } from '../mock';
import type { CanvasDoc, CanvasMeta, DB } from '../types';

/** 画布列表的种子数据（名字、封面、更新时间），和每块画布里的节点、连线（只给前两块摆了内容，其余是空画布） */

const HOUR = 3_600_000;
const NOW = Date.now();
const covers = (from: number, n: number) => Array.from({ length: n }, (_, i) => pic(from + i));

const canvases: CanvasMeta[] = [
  { id: 'c1', name: '深林', covers: covers(4, 4), updatedAt: NOW - 5 * 60_000 },
  { id: 'c2', name: '笑脸', covers: covers(1, 3), updatedAt: NOW - 2 * HOUR },
  { id: 'c3', name: '短剧制作流程图', covers: covers(6, 4), updatedAt: NOW - 20 * HOUR },
  { id: 'c4', name: '短剧制作流程图', covers: covers(3, 1), updatedAt: NOW - 6 * 24 * HOUR },
  { id: 'c5', name: '新春海报', covers: covers(2, 2), updatedAt: NOW - 8 * 24 * HOUR },
  { id: 'c6', name: '未命名画布', covers: [], updatedAt: NOW - 12 * 24 * HOUR },
  ...['角色三视图', '产品主图', '分镜脚本', '直播间布置', '节日活动', '品牌延展', '图标探索', '概念设定', '电商详情页', '旧版画布'].map((name, i) => ({
    id: `c${i + 7}`,
    name,
    covers: covers(i + 3, (i % 4) + 1),
    updatedAt: NOW - (14 + i * 3) * 24 * HOUR,
  })),
];

/** 深林：文案 + 参考图 → 主视觉（4 张）→ 配乐一起 → 短视频，照原来的演示 */
const forest: CanvasDoc = {
  nodes: [
    {
      id: 'n1',
      type: 'text',
      name: '文案',
      x: 0,
      y: 0,
      w: 256,
      h: 256,
      text: '清晨的猕猴桃果园，薄雾里透出暖金色的逆光。镜头从叶片上的露珠缓缓推进，切到一颗被剖开的猕猴桃，果肉翠绿、籽粒清晰。整体色调清新明亮，结尾落在品牌标志上。',
    },
    { id: 'n2', type: 'image', name: '参考图', x: 0, y: 340, w: 256, h: 256, ratio: '1:1', upload: true, items: [{ src: pic(1) }] },
    {
      id: 'n3',
      type: 'image',
      name: '主视觉',
      x: 400,
      y: 0,
      w: 256,
      h: 256,
      ratio: '1:1',
      prompt: '猕猴桃饮料主视觉，清新绿色，逆光',
      items: [{ src: pic(2) }, { src: pic(0) }, { src: pic(6) }, { src: pic(4) }],
    },
    { id: 'n4', type: 'audio', name: '配乐', x: 400, y: 340, w: 341, h: 256, prompt: '轻快的木吉他，清晨氛围', items: [{ src: DEMO_AUDIO, duration: '0:12' }] },
    {
      id: 'n5',
      type: 'video',
      name: '短视频',
      x: 880,
      y: 170,
      w: 455,
      h: 256,
      ratio: '16:9',
      prompt: '镜头缓缓推进，果汁倒入杯中',
      items: [{ src: DEMO_VIDEO.wide, poster: videoPoster('16:9'), duration: '0:05' }],
    },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n3' },
    { id: 'e2', from: 'n2', to: 'n3' },
    { id: 'e3', from: 'n3', to: 'n5' },
    { id: 'e4', from: 'n4', to: 'n5' },
  ],
};

/** 笑脸：两张参考图 → 首尾帧视频，还没生成 */
const smile: CanvasDoc = {
  nodes: [
    { id: 'n1', type: 'image', name: '首帧', x: 0, y: 0, w: 256, h: 341, ratio: '3:4', upload: true, items: [{ src: pic(1, '3:4') }] },
    { id: 'n2', type: 'image', name: '尾帧', x: 0, y: 420, w: 256, h: 341, ratio: '3:4', upload: true, items: [{ src: pic(5, '3:4') }] },
    { id: 'n3', type: 'video', name: '视频生成', x: 400, y: 252, w: 256, h: 341, ratio: '3:4', refMode: 'frames' },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n3' },
    { id: 'e2', from: 'n2', to: 'n3' },
  ],
};

export const CANVAS_SEED: Pick<DB, 'canvases' | 'canvasDocs' | 'canvasChats'> = { canvases, canvasDocs: { c1: forest, c2: smile }, canvasChats: [] };
