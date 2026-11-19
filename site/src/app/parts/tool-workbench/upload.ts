import { UPLOAD_SPECS, toast } from '@kivi';
import { checkFiles } from '@kivi/hooks';
import { uploadMock } from '../../data/tool-mock';
import { handleError } from '../../flows/errors';
import type { Media } from '../../data/tools';

/*
  工具上传：工具页和视频拼接的第二个位共用。校验照线上工具页（图 ≤10MB、宽高 360–4096px；视频 mp4 ≤20MB），
  视频要等一会儿（假上传，慢网更久），图片直接放进来。
*/

export interface LoadedFile {
  media: Media;
  src: string;
  /** 宽 / 高 */
  ratio: number;
  /** 视频时长（秒） */
  duration?: number;
}

export const mediaOfFile = (f: File): Media => (f.type.startsWith('video') ? 'video' : 'image');

/** 校验，不合格弹 Toast 并返回 null */
export async function checkToolFile(f: File): Promise<File | null> {
  const { accepted, message } = await checkFiles([f], (file) => UPLOAD_SPECS.tools[mediaOfFile(file)]);
  if (message) toast.error(message);
  return accepted[0] ?? null;
}

/** 视频等假上传，再读宽高、时长；图片直接读宽高。失败（断网）按统一出错提示，返回 null */
export async function loadToolFile(f: File): Promise<LoadedFile | null> {
  const media = mediaOfFile(f);
  if (media === 'video') {
    try {
      await uploadMock();
    } catch (e) {
      handleError(e);
      return null;
    }
  }
  const url = URL.createObjectURL(f);
  return new Promise((resolve) => {
    if (media === 'video') {
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.onloadedmetadata = () =>
        resolve({ media, src: url, ratio: el.videoWidth / el.videoHeight || 16 / 9, duration: Number.isFinite(el.duration) ? el.duration : undefined });
      el.onerror = () => resolve({ media, src: url, ratio: 16 / 9 });
      el.src = url;
    } else {
      const el = new Image();
      el.onload = () => resolve({ media, src: url, ratio: el.naturalWidth / el.naturalHeight || 1 });
      el.onerror = () => resolve({ media, src: url, ratio: 1 });
      el.src = url;
    }
  });
}
