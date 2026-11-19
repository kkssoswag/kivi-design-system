import { ratioNum } from '../data/mock';
import type { CanvasNode, PackConfig, PackTemplate } from '../data/types';

/*
  视频封装的规则（照线上 nodes/video-project/components/packager-modal：templates 各类型的 config / constants、validation.ts）。
  纯函数，不碰界面。线上读素材的 _metaData 宽高，演示里节点只有比例，按比例换算成名义宽高。
*/

/** 封装类型：顺序照线上（麦圈 / 勋章、礼物 / 座驾、背景、自定义） */
export const PACK_TEMPLATES: { id: PackTemplate; label: string }[] = [
  { id: 'badge', label: '麦圈/勋章' },
  { id: 'vehicle', label: '礼物/座驾' },
  { id: 'background', label: '背景' },
  { id: 'custom', label: '自定义' },
];

/** 素材在封装里的角色：封面（cover）、静态背景（static_gift）、动态视频（animated_gift） */
export type PackRole = 'cover' | 'static' | 'animated';

export const PACK_ROLE_NAME: Record<PackRole, string> = { cover: '封面', static: '静态', animated: '视频' };

interface TemplateRule {
  /** 图片按连接顺序依次扮演的角色 */
  images: PackRole[];
  /** 至少要连几张图、几个视频（不够不能导出；超出不拦） */
  minImages: number;
  minVideos: number;
  /** 各角色要求的比例（宽:高），不写不查 */
  ratios: Partial<Record<PackRole, [number, number]>>;
  /** 右边「尺寸规范」，不写没有 */
  specs: { title: string; rows: { label: string; value: string }[] }[];
}

export const PACK_RULES: Record<PackTemplate, TemplateRule> = {
  badge: {
    images: ['cover'],
    minImages: 1,
    minVideos: 1,
    ratios: { cover: [1, 1], animated: [1, 1] },
    specs: [{ title: '尺寸规范', rows: [{ label: '静态尺寸', value: '400×400' }, { label: '动态尺寸', value: '320×320' }] }],
  },
  vehicle: {
    images: ['cover'],
    minImages: 1,
    minVideos: 1,
    ratios: { cover: [1, 1], animated: [750, 1334] },
    specs: [{ title: '素材规范', rows: [{ label: 'Icon', value: '168×168' }, { label: 'Image', value: '504×504' }, { label: '视频尺寸', value: '750×1334' }] }],
  },
  background: {
    images: ['cover', 'static'],
    minImages: 2,
    minVideos: 1,
    ratios: { cover: [330, 360], static: [1125, 2001], animated: [750, 1334] },
    specs: [{ title: '尺寸规范', rows: [{ label: '封面尺寸', value: '330×360' }, { label: '静态尺寸', value: '1125×2001' }, { label: '动态尺寸', value: '750×1334' }] }],
  },
  custom: {
    images: [],
    minImages: 0,
    minVideos: 1,
    ratios: {},
    specs: [],
  },
};

/** 自定义的封装格式（照线上 CUSTOM_PACKAGER_FORMAT_OPTIONS） */
export const PACK_FORMATS: { value: PackConfig['format']; label: string }[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webp', label: 'WebP' },
  { value: 'apng', label: 'APng' },
  { value: 'mp4-alpha', label: 'Mp4-Alpha' },
];

/** 帧率选项：不能比原视频高（超出的置灰），APng 只有 15 / 10 / 5 */
export const PACK_FPS = [60, 30, 25, 24, 10, 5];
export const PACK_APNG_FPS = [15, 10, 5];
export const PACK_DEFAULT_QUALITY = 80;

/** 一个封装节点刚建出来的设置 */
export const defaultPackConfig = (): PackConfig => ({
  template: 'custom',
  name: '视频封装',
  format: 'mp4',
  fps: 30,
  quality: PACK_DEFAULT_QUALITY,
  vehicleBg: false,
  feather: false,
  strength: 0,
});

/** 导出时的目标尺寸和帧率（预估大小用）：各类型固定，自定义看设置 */
const FIXED: Partial<Record<PackTemplate, { w: number; h: number; fps: number; seconds?: number; mb: number }>> = {
  badge: { w: 320, h: 320, fps: 10, seconds: 3, mb: 1.2 },
  vehicle: { w: 750, h: 1334, fps: 25, mb: 6.5 },
  background: { w: 750, h: 1334, fps: 5, mb: 3.4 },
};

/** 节点比例 → 名义宽高（短边 1080） */
export function nominalSize(n: Pick<CanvasNode, 'ratio'>): { w: number; h: number } {
  const r = ratioNum(n.ratio ?? '16:9');
  return r >= 1 ? { w: Math.round(1080 * r), h: 1080 } : { w: 1080, h: Math.round(1080 / r) };
}

/** 「0:05」→ 秒 */
export function toSeconds(d?: string): number {
  if (!d) return 0;
  const [m, s] = d.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

export interface PackMaterial {
  node: CanvasNode;
  role?: PackRole;
}

/** 按封装类型给连进来的素材分角色：图片按连接顺序依次是封面、静态，视频是动态视频；多出来的图片没有角色 */
export function packMaterials(template: PackTemplate, ups: CanvasNode[]): { images: PackMaterial[]; videos: PackMaterial[] } {
  const roles = PACK_RULES[template].images;
  const images = ups.filter((n) => n.type === 'image').map((node, i) => ({ node, role: roles[i] }));
  const videos = ups.filter((n) => n.type === 'video').map((node, i) => ({ node, role: i === 0 ? ('animated' as const) : undefined }));
  return { images, videos };
}

export interface PackValidation {
  /** 能不能导出：素材数量够了 */
  canExport: boolean;
  /** 导出前要不要二次确认：有素材尺寸不符合 */
  needConfirm: boolean;
  /** 右上角的提示（可以并列） */
  errors: string[];
}

export const PACK_ERROR_COUNT = '素材数量不符合要求。';
export const PACK_ERROR_SIZE = '素材尺寸不符合要求。';

const sameRatio = (n: CanvasNode, [w, h]: [number, number]) => {
  const { w: nw, h: nh } = nominalSize(n);
  const want = w / h;
  return Math.abs(nw / nh - want) / want <= 0.05;
};

/** 照线上 validatePackagerInputs：数量不够不能导出；尺寸（比例）不对可以导出但要确认；两个提示可以并列 */
export function validatePack(template: PackTemplate, ups: CanvasNode[]): PackValidation {
  const rule = PACK_RULES[template];
  const { images, videos } = packMaterials(template, ups);
  const countBad = images.length < rule.minImages || videos.length < rule.minVideos;
  const sizeBad = [...images, ...videos].some((m) => {
    const want = m.role && rule.ratios[m.role];
    return want ? !sameRatio(m.node, want) : false;
  });
  return { canExport: !countBad, needConfirm: sizeBad, errors: [...(countBad ? [PACK_ERROR_COUNT] : []), ...(sizeBad ? [PACK_ERROR_SIZE] : [])] };
}

/** 底栏的「时长：N 秒」「大小：N MB（预估）」。线上预估大小逻辑还在调整，这里只给个大概的数 */
export function packMeta(cfg: PackConfig, ups: CanvasNode[]): string[] {
  const video = ups.find((n) => n.type === 'video');
  const seconds = FIXED[cfg.template]?.seconds ?? toSeconds(video?.items?.[0]?.duration);
  const items: string[] = [];
  if (seconds > 0) items.push(`时长：${Math.round(seconds)}秒`);
  if (video) {
    const f = FIXED[cfg.template];
    const base = f ? f.mb : (Math.max(1, (cfg.width ?? 1080) * (cfg.height ?? 1920)) / 1e6) * (cfg.fps / 30) * (cfg.quality / 100) * 4 * Math.max(1, seconds / 5);
    items.push(`大小：${Math.max(0.1, Math.round(base * 10) / 10)}MB（预估）`);
  }
  return items;
}

/** 导出的压缩包文件名 */
export const archiveFileName = (cfg: PackConfig) => `${cfg.name.trim() || '视频封装'}.zip`;

export const PACK_TEXT = {
  confirmTitle: '确认导出该素材吗？',
  confirmDesc: '尺寸不符合当前资源规范，继续导出将会被裁切到正确范围，是否继续导出？',
  needVideo: '连接视频后才能打开视频封装',
  archiveDone: '视频封装完成，选中节点后点击顶部下载',
  nameLabel: '资源名称',
  nameMax: 30,
} as const;
