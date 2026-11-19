import { genCost } from '@kivi';
import { DEMO_AUDIO, DEMO_VIDEO, pic } from '../mock';
import type { Asset, DB, Folder, Task } from '../types';

/*
  资产页的种子数据：
  - 文件夹：只存 id、名字、时间。数量、封面由素材的 folderIds 算（页面里数），所以每个文件夹造了和原来显示数字一样多的上传素材。
  - 生成历史：72 条素材，今天 28 条、昨天 18 条，更早的往前铺到约 4 个月前，时间筛选的预设都能筛出东西。
    每条都配一个生成它的任务（查看大图的信息栏照线上 CardDetailModal / GenInfo 显示：提示词、类型、模型、参考、参数），11-19 用户要的：
    图片生成轮流带 0–4 张参考图，一次出 1–4 张（同一次的几张是一个任务，大图第一排能切），提示词有短有长（现在生图提示词大多很长）；视频生成轮流是全能参考（图、视频、音频都有）/ 首尾帧 / 视频编辑 / 纯文字；工具来的记工具名和原图。
    任务挂在不存在的对话、画布上（seed-history），只给大图看，不出现在创作页、画布、AI 工具页的记录里。
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

const IMAGE_PROMPTS = [
  '一颗剖开的猕猴桃，清晨逆光，清新绿色海报，加一点雾气',
  // 现在的生图提示词大多很长（11-19 用户要多几条长的）
  '电商主图，一瓶玻璃瓶装的猕猴桃果汁立在湿润的青苔石头上，瓶身挂着细密的水珠，背景是虚化的热带雨林和穿过树叶的丁达尔光束。画面左侧散落几片切开的猕猴桃，果肉晶莹、籽清晰可见。整体色调以翠绿和浅金为主，柔和的侧逆光勾出瓶身轮廓，高级、干净、有呼吸感。商业摄影质感，85mm 镜头，浅景深，8K 超清细节，不要出现任何文字和水印。',
  '极繁主义的未来城市，霓虹灯牌写着 KIVI，宽银幕电影构图',
  '一张品牌春季活动的竖版海报：画面中央是一只圆滚滚的绿色猕猴桃吉祥物，戴着草帽、背着小竹篮，正踮起脚去够树枝上的果子；四周是层层叠叠的果园和远处的雪山，天空有大朵的积云。插画风格偏日系绘本，线条柔软、颜色清透，带一点纸张纹理和水彩晕染。顶部留出三分之一的干净天空给标题排版，底部留出放活动信息的位置。整体温暖、治愈、适合在小红书和朋友圈传播。',
  '白底产品图，玻璃瓶装猕猴桃果汁，柔光，高级质感',
  '把参考图1里的人物换成参考图2的服装：一件宽松的墨绿色连帽卫衣，胸前印着小小的猕猴桃刺绣，袖口有磨毛；人物的脸、发型、姿势和光线都保持不变。背景换成参考图3那样的午后果园，阳光从左上方照进来，地面有斑驳的树影。画面比例保持原图，皮肤质感自然、不要磨皮过度，服装褶皱要符合人物动作，衣服和身体接触的地方要有自然的阴影。',
  '赛博朋克风格的猕猴桃海报，荧光绿和紫色撞色',
  '为一款面向年轻人的气泡水设计三视图包装展示：正面、侧面、45 度角各一个易拉罐，并排放在浅灰色的无缝背景上。罐身主色是哑光的奶油白，用大面积的荧光绿色块和手写体的「KIVI SPARKLING」做视觉重心，侧面有成分表和小图标。每个罐子下面有柔和的接触阴影，顶光加两侧补光，材质要看得出铝罐的金属拉丝和哑光涂层的区别。风格参考 Behance 上的包装设计提案，干净、留白多、构图严格对称。',
]
const VIDEO_PROMPTS = [
  '猕猴桃从空中落进果汁杯，溅起水花，镜头慢慢推近，夏日清爽的广告质感',
  '第一个镜头：清晨的果园，薄雾还没散，镜头贴着地面缓缓前移，穿过一排排挂满果子的猕猴桃藤架；第二个镜头：一只手摘下一颗猕猴桃，特写果皮上的细绒毛和露珠；第三个镜头：刀落下，果子被剖成两半，慢动作，果汁溅起，画面定格在翠绿的横切面上。全程暖色自然光，色调清新，节奏由慢到快，最后一秒出现品牌标志，适合做 15 秒的电商开屏广告。',
  'KIVI 吉祥物从屏幕边缘探出头，眨眼打招呼，竖版短视频',
  '让参考图里的角色跟着参考音频的节奏点头、轻轻晃动身体，嘴型自然地跟着哼唱；镜头保持固定机位，人物占画面中间三分之二。背景是参考视频里的夜晚街道，霓虹灯牌随着鼓点一闪一闪，地面的积水倒映出彩色的光。人物的服装、发型和五官要和参考图保持一致，动作幅度不要太大，整体氛围轻松、有点复古的港风 MV 感觉。',
]
const IMAGE_MODELS: { model: string; resolution: string }[] = [
  { model: 'nano-banana-2', resolution: '2K' },
  { model: 'seedream-4.5', resolution: '4K' },
  { model: 'gpt-image-2', resolution: '1K' },
  { model: 'nano-banana-pro', resolution: '2K' },
  { model: 'seedream-5-lite', resolution: '2K' },
];
const VIDEO_MODELS: { model: string; resolution: string; duration: string }[] = [
  { model: 'seedance-2.0-fast', resolution: '720P', duration: '8' },
  { model: 'kling-v3-omni', resolution: '1080P', duration: '5' },
  { model: 'veo-3.1-fast', resolution: '1080P', duration: '8' },
  { model: 'seedance-2.0', resolution: '1080P', duration: '10' },
];
/** 工具来的：图片、视频各轮流几种工具，参数照 AI 工具页记进任务的写法 */
const IMAGE_TOOLS: { tool: string; label: string; params: Record<string, string> }[] = [
  { tool: 'expand', label: '扩图', params: { 比例: '原比例', 倍数: '1.5x', 分辨率: '2K' } },
  { tool: 'hd', label: '高清修复', params: { 放大倍数: '2 倍' } },
  { tool: 'cutout', label: '抠图', params: {} },
  { tool: 'edit', label: '智能重绘', params: { 模型: 'Nano Banana 2' } },
];
const VIDEO_TOOLS: { tool: string; label: string; params: Record<string, string> }[] = [
  { tool: 'video-hd', label: '视频高清', params: { 分辨率: '1080P', 帧速率: '30fps' } },
  { tool: 'loop', label: '视频循环', params: { 过渡时长: '自动' } },
  { tool: 'video-cutout', label: '视频抠图', params: { 输出模式: '透明视频' } },
  { tool: 'stitch', label: '视频拼接', params: {} },
];

/** 视频生成的参考，轮流四种：全能参考（图、视频、音频）/ 首尾帧 / 视频编辑 / 纯文字 */
function videoRefs(n: number, i: number): Pick<Task, 'refs' | 'refLabel' | 'refMode'> {
  switch (n % 4) {
    case 0:
      return {
        refLabel: '全能参考',
        refMode: 'omni',
        refs: [
          { type: 'image', src: pic(i + 3), label: '图片1' },
          { type: 'image', src: pic(i + 5), label: '图片2' },
          { type: 'video', src: pic(i + 7, '16:9'), label: '视频1' },
          { type: 'audio', src: DEMO_AUDIO, label: '音频1' },
        ],
      };
    case 1:
      return {
        refLabel: '首尾帧',
        refMode: 'frames',
        refs: [
          { type: 'image', src: pic(i + 2, '16:9'), label: '首帧' },
          { type: 'image', src: pic(i + 4, '16:9'), label: '尾帧' },
        ],
      };
    case 2:
      return { refLabel: '视频编辑', refMode: 'edit', refs: [{ type: 'video', src: pic(i + 6, '16:9'), label: '视频1' }] };
    default:
      return { refs: [] };
  }
}

const history: Asset[] = [];
const historyTasks: Task[] = [];
/** 工具来的图片、视频各数到第几条（轮流换工具） */
const toolCount = { image: 0, video: 0 };
/** 图片生成一次出几张，轮流（线上一次 1–4 张）：同一次的几张进同一个任务，看大图时第一排能切 */
const BATCH = [4, 1, 4, 2, 3];
/** 创作、画布各自还没装满的那一次图片生成 */
const openBatch: Partial<Record<'create' | 'canvas', { task: Task; size: number; day: number }>> = {};
let batchCount = 0;
for (let i = 0; i < 72; i++) {
  const video = i % 4 === 1;
  const daysAgo = i < 28 ? 0 : i < 46 ? 1 : 2 + (i - 46) * 5;
  const [h, m] = TIMES[i % 4].split(':').map(Number);
  const createdAt = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - daysAgo, h, m).getTime();
  const source = SOURCES[i % 3];
  const media: 'image' | 'video' = video ? 'video' : 'image';
  const ratio: '16:9' | '1:1' = video ? '16:9' : '1:1';
  const taskId = `ht${i}`;
  history.push({
    id: `h${i}`,
    media,
    src: video ? DEMO_VIDEO.wide : pic(i),
    poster: video ? pic(i) : undefined,
    ratio,
    name: `${video ? '视频' : '图片'}生成 ${String(i + 1).padStart(2, '0')}`,
    createdAt,
    source,
    taskId,
    collected: i === 2 || i === 7,
    folderIds: [],
  });
  const common = {
    id: taskId,
    media,
    // 挂在不存在的对话、画布上：只给大图的信息栏用，不进各页的记录（Where 没有「无处」，借一个不存在的 id）
    where: source === 'create' ? { page: 'create' as const, chatId: 'seed-history' } : { page: 'canvas' as const, canvasId: 'seed-history' },
    ratio,
    outputs: [{ status: 'done' as const, assetId: `h${i}` }],
    createdAt,
    dueAt: createdAt,
    status: 'done' as const,
  };
  if (source === 'tools') {
    const t = (video ? VIDEO_TOOLS : IMAGE_TOOLS)[toolCount[media]++ % 4];
    historyTasks.push({ ...common, kind: 'tool', tool: t.tool, label: t.label, params: t.params, refs: [{ type: media, src: pic(i + 1, ratio) }], cost: 6 });
  } else if (video) {
    const v = VIDEO_MODELS[Math.floor(i / 4) % VIDEO_MODELS.length];
    historyTasks.push({
      ...common,
      kind: 'gen',
      prompt: VIDEO_PROMPTS[Math.floor(i / 4) % VIDEO_PROMPTS.length],
      model: v.model,
      params: { resolution: v.resolution, ratio, duration: v.duration },
      ...videoRefs(Math.floor(i / 4), i),
      cost: genCost('video', v.model),
    });
  } else {
    // 接着这一来源上一次没装满的图片生成：素材挂进那个任务，时间跟它一样
    const open = openBatch[source as 'create' | 'canvas'];
    if (open && open.day === daysAgo && open.task.outputs.length < open.size) {
      const a = history[history.length - 1];
      a.taskId = open.task.id;
      a.createdAt = open.task.createdAt;
      open.task.outputs.push({ status: 'done', assetId: a.id });
      continue;
    }
    const g = IMAGE_MODELS[i % IMAGE_MODELS.length];
    const n = i % 5;
    historyTasks.push({
      ...common,
      kind: 'gen',
      prompt: IMAGE_PROMPTS[i % IMAGE_PROMPTS.length],
      model: g.model,
      params: { resolution: g.resolution, ratio },
      refs: Array.from({ length: n }, (_, k) => ({ type: 'image' as const, src: pic(i + k + 2), label: `图片${k + 1}` })),
      refLabel: n ? '参考图' : undefined,
      cost: genCost('image', g.model),
    });
    openBatch[source as 'create' | 'canvas'] = { task: historyTasks[historyTasks.length - 1], size: BATCH[batchCount++ % BATCH.length], day: daysAgo };
  }
}

export const ASSETS_SEED: Pick<DB, 'folders' | 'assets' | 'tasks'> = { folders, assets: [...history, ...folderAssets], tasks: historyTasks };
