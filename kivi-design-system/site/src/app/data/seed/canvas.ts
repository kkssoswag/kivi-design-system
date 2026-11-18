import { pic } from '../mock';
import type { CanvasMeta, DB } from '../types';

/** 画布列表的种子数据（名字、封面、更新时间）。画布里的节点以后单独存 */

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

export const CANVAS_SEED: Pick<DB, 'canvases'> = { canvases };
