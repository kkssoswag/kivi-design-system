import type { IconName } from '@kivi';

/*
  AI 工具的定义：有哪些工具、各自的类型和图标、舞台上没放素材时的介绍。纯数据，工具页和创作页的工具弹窗共用。
*/

export type Media = 'image' | 'video';
export type ToolId = 'cutout' | 'expand' | 'hd' | 'edit' | 'video-hd' | 'loop' | 'stitch' | 'video-cutout';

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: IconName;
  media: Media;
}

/** 工具顺序照线上：图片四个在前，视频在后，分「图片工具」「视频工具」两组（多模态编辑 11-06 用户定不要了）。视频抠图线上 ToolsBox 没有、画布有，11-11 用户定加上，顺序照画布 */
export const TOOLS: ToolDef[] = [
  { id: 'cutout', name: '抠图', icon: 'Rmbg', media: 'image' },
  { id: 'expand', name: '扩图', icon: 'Expand', media: 'image' },
  { id: 'hd', name: '高清修复', icon: 'HD', media: 'image' },
  { id: 'edit', name: '智能编辑', icon: 'SmartEditing', media: 'image' },
  { id: 'loop', name: '视频循环', icon: 'VideoLoop', media: 'video' },
  { id: 'video-hd', name: '视频高清', icon: 'HD', media: 'video' },
  { id: 'stitch', name: '视频拼接', icon: 'Connecting', media: 'video' },
  { id: 'video-cutout', name: '视频抠图', icon: 'Rmbg', media: 'video' },
  /** 对口型：线上在「增长工具」页，演示里放这里，纯演示（11-19 用户说要准备上） */
];
export const toolOf = (id: ToolId) => TOOLS.find((t) => t.id === id)!;

/** 没放素材时舞台上的介绍：示意图 + 一句话说这个工具做什么。示意图先用占位图、演示视频，以后换真素材 */
export const TOOL_INTRO: Record<ToolId, { desc: string; demo: string }> = {
  cutout: { desc: '上传图片，自动识别主体，去掉周围的背景。', demo: 'ip-gouache' },
  expand: { desc: '上传图片，拉框选出要扩的范围，AI 补全画面外面的内容。', demo: 'monstera-dots' },
  hd: { desc: '上传图片，放大 2 倍或 4 倍，补回细节。', demo: 'kiwi-light' },
  edit: { desc: '上传图片，描述想怎么改，或者涂抹要改、要去掉的地方。', demo: 'bunny-gouache' },
  loop: { desc: '上传视频，首尾自然衔接，循环播放看不出断点。', demo: 'video' },
  'video-hd': { desc: '上传视频，提升分辨率和帧率。', demo: 'video' },
  stitch: { desc: '上传两段视频，按顺序拼成一段。', demo: 'video' },
  'video-cutout': { desc: '上传视频，自动识别主体，去掉每一帧的背景。', demo: 'video' },
};
