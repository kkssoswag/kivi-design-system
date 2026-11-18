import { DEMO_AUDIO, DEMO_VIDEO, pic } from '../mock';
import type { Asset, DB, Folder } from '../types';

/*
  资产页的种子数据：
  - 文件夹：只存 id、名字、时间。数量、封面由素材的 folderIds 算（页面里数），所以每个文件夹造了和原来显示数字一样多的上传素材。
  - 生成历史：72 条素材，今天 28 条、昨天 18 条，更早的往前铺到约 4 个月前，时间筛选的预设都能筛出东西。
*/

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const TODAY = new Date(new Date().setHours(0, 0, 0, 0));

// ---------- 文件夹 ----------

/** 封面从第几张占位图开始、封面有几张（图片素材，最多 4）、里面一共几条素材（封面之外的是音频，没有封面图） */
const FOLDER_DEFS: { name: string; from: number; covers: number; count: number }[] = [
  { name: '活动文件夹1', from: 0, covers: 4, count: 6 },
  { name: '创作参考', from: 2, covers: 3, count: 6 },
  { name: '灵感收藏', from: 5, covers: 2, count: 6 },
  { name: '品牌物料', from: 7, covers: 4, count: 18 },
  { name: '短剧分镜', from: 1, covers: 4, count: 32 },
  { name: '我的上传', from: 0, covers: 0, count: 0 },
  // 宽屏一排放得下更多，多备几个
  ...['产品白底图', '角色设定', '场景概念', '直播间背景', '节日海报', '短视频素材', '图标草稿', '配色参考', '运营活动', '旧版存档'].map((name, i) => ({ name, from: i, covers: (i % 4) + 1, count: 4 + i * 3 })),
];

const folders: Folder[] = FOLDER_DEFS.map((f, i) => ({ id: `f${i + 1}`, name: f.name, createdAt: NOW - (i + 1) * DAY }));

const folderAssets: Asset[] = FOLDER_DEFS.flatMap((f, i) =>
  Array.from({ length: f.count }, (_, j): Asset => {
    const base = { id: `seed-f${i + 1}-${j}`, ratio: '1:1' as const, createdAt: NOW - (i + 1) * DAY - j * HOUR, source: 'upload' as const, collected: false, folderIds: [`f${i + 1}`] };
    return j < f.covers
      ? { ...base, media: 'image', src: pic(f.from + j), name: `${f.name} ${j + 1}` }
      : { ...base, media: 'audio', src: DEMO_AUDIO, duration: '0:12', name: `${f.name} ${j + 1}` };
  }),
);

// ---------- 生成历史 ----------

const SOURCES = ['create', 'tools', 'canvas'] as const;
const TIMES = ['14:32', '13:18', '11:46', '10:05'];

const history: Asset[] = Array.from({ length: 72 }, (_, i): Asset => {
  const video = i % 4 === 1;
  const daysAgo = i < 28 ? 0 : i < 46 ? 1 : 2 + (i - 46) * 5;
  const [h, m] = TIMES[i % 4].split(':').map(Number);
  return {
    id: `h${i}`,
    media: video ? 'video' : 'image',
    src: video ? DEMO_VIDEO.wide : pic(i),
    poster: video ? pic(i) : undefined,
    ratio: video ? '16:9' : '1:1',
    name: `${video ? '视频' : '图片'}生成 ${String(i + 1).padStart(2, '0')}`,
    createdAt: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - daysAgo, h, m).getTime(),
    source: SOURCES[i % 3],
    collected: i === 2 || i === 7,
    folderIds: [],
  };
});

export const ASSETS_SEED: Pick<DB, 'folders' | 'assets' | 'tasks'> = { folders, assets: [...history, ...folderAssets], tasks: [] };
