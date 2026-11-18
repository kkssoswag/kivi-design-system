import type { PlaceholderImageName } from '@kivi';

/*
  创作首页「最近更新」运营位：后台配置的 Banner，只读（不存本机）。图是占位。
*/

export interface Banner {
  title: string;
  image: PlaceholderImageName;
}

export const BANNERS: Banner[] = [
  { title: '精选作品 · 极繁未来', image: 'kivi-future' },
  { title: 'KIVI 新模型上线', image: 'ip-future' },
  { title: 'AI 创意设计大赛', image: 'kiwi-light' },
  { title: '创作者成长计划', image: 'ip-gouache' },
  { title: '节日海报征集', image: 'monstera-dots' },
];
