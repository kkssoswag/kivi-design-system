import { placeholderImageSrc, type PlaceholderImageName, type PlaceholderImageRatio } from '@kivi';
import type { Media, Ratio } from './types';

/*
  假素材：占位图、演示视频、演示音频都从这里拿，页面和种子数据不再各写一份图片列表。
*/

/** 轮流用的占位图 */
export const PICS: PlaceholderImageName[] = ['kivi-future', 'ip-gouache', 'kiwi-light', 'bunny-gouache', 'monstera-dots', 'ip-peek', 'ip-kiwi-pile', 'ip-future'];

const RATIOS: PlaceholderImageRatio[] = ['1:1', '3:4', '16:9', '9:16'];

export const ratioNum = (r: string) => {
  const [w, h] = r.split(':').map(Number);
  return w / h || 1;
};

/** 任意比例 → 最接近的占位图比例 */
export const nearestRatio = (r: number): Ratio =>
  RATIOS.reduce((a, b) => (Math.abs(Math.log(ratioNum(b) / r)) < Math.abs(Math.log(ratioNum(a) / r)) ? b : a));

/** 第 i 张占位图 */
export const pic = (i: number, ratio: Ratio = '1:1') => placeholderImageSrc(PICS[((i % PICS.length) + PICS.length) % PICS.length], ratio);

export const DEMO_VIDEO = { wide: './placeholders/video/kivi-demo-16x9.mp4', tall: './placeholders/video/kivi-demo-9x16.mp4' };
/** 演示音频：先用演示视频的音轨 */
export const DEMO_AUDIO = './placeholders/video/kivi-demo-9x16.mp4';

/** 视频结果的封面：配对应比例的占位图 */
export const videoPoster = (ratio: Ratio) => placeholderImageSrc(ratioNum(ratio) < 1 ? 'ip-gouache' : 'kivi-future', ratioNum(ratio) < 1 ? '9:16' : '16:9');

let turn = 0;
/** 假生成的一格结果 */
export function mockOutput(media: Media, ratio: Ratio): { src: string; poster?: string; duration?: string } {
  if (media === 'video') return { src: ratioNum(ratio) < 1 ? DEMO_VIDEO.tall : DEMO_VIDEO.wide, poster: videoPoster(ratio), duration: '0:05' };
  if (media === 'audio') return { src: DEMO_AUDIO, duration: '0:12' };
  return { src: pic(turn++, ratio) };
}

/** 假生成的一段文字（画布文字节点）：照提示词开个头，后面接一段示例 */
export function mockText(prompt?: string): string {
  const head = prompt?.trim() ? `「${prompt.trim().slice(0, 40)}」\n\n` : '';
  return `${head}画面以清晨的猕猴桃果园为主场景，薄雾里透出暖金色的逆光。镜头从叶片上的露珠缓缓推进，切到一颗被剖开的猕猴桃，果肉翠绿、籽粒清晰。整体色调清新明亮，节奏舒缓，结尾落在品牌标志上。`;
}
