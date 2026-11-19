/*
  功能分支预览（只在预览仓库 q654517651/kivi-design-preview 打包时生效；正式站、本地开发都不传，这里全是空的，什么都不变）：
  - 打包时传 VITE_PREVIEW_BRANCH（这一份是哪个分支）和 VITE_PREVIEW_LINKS（能切到的版本，JSON：[{ name, label, url }]）。
  - 演示开关里多一项「分支」，切过去停在同一页（带上 # 后面的路径）。
  - 本机存的演示数据按分支分开（key 前面加分支名），和正式站不串。
  合进 test 之前删掉这个文件和它的两处引用（parts/DemoPanel.tsx、data/store.ts）。
*/

export interface PreviewLink {
  /** 分支名，正式版是 main */
  name: string;
  /** 显示的名字，比如「正式版」「专家模式」 */
  label: string;
  /** 这个版本网站的地址（不带 #） */
  url: string;
}

export const PREVIEW_BRANCH: string = import.meta.env.VITE_PREVIEW_BRANCH ?? '';

export const PREVIEW_LINKS: PreviewLink[] = (() => {
  try {
    return PREVIEW_BRANCH ? (JSON.parse(import.meta.env.VITE_PREVIEW_LINKS ?? '[]') as PreviewLink[]) : [];
  } catch {
    return [];
  }
})();

/** 本机存储的 key：预览时前面加分支名 */
export const previewKey = (key: string) => (PREVIEW_BRANCH ? `${PREVIEW_BRANCH}:${key}` : key);

/** 切到另一个版本，停在同一页 */
export function switchPreview(name: string) {
  const link = PREVIEW_LINKS.find((l) => l.name === name);
  if (link && name !== PREVIEW_BRANCH) window.location.href = `${link.url}${window.location.hash}`;
}
