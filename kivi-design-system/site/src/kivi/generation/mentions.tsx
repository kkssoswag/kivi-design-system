import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MentionChip, type MentionChipType } from '../reference/MentionChip';

/*
  提示词输入框（PromptInput，contentEditable）里的 @ 引用：插一个 MentionChip、读出纯文字、素材换了顺序或删了以后跟着改。
  主站 PromptBox 和画布 NodePanel 共用（11-18 用户定：快捷 @ 照线上，点参考缩略图插进提示词）。
  引用标签上挂 data-ref-id（素材 id），名字跟着素材走：素材改名（换了顺序重新编号）标签跟着改，素材删了标签也删。
*/

export interface MentionSource {
  /** 素材 id，标签上记它 */
  id: string;
  /** 图片 / 视频 / 音频 */
  type: string;
  /** 名字，比如「图片1」 */
  name: string;
  /** 缩略图：图片、视频封面 */
  src?: string;
}

const chipType = (t: string): MentionChipType => (t === 'video' ? 'video' : t === 'audio' ? 'audio' : 'image');

/** 渲染出 MentionChip 的 HTML（插进 contentEditable 用，组件只写一份） */
function chipHTML(m: MentionSource) {
  const box = document.createElement('div');
  const root = createRoot(box);
  flushSync(() =>
    root.render(
      <MentionChip type={chipType(m.type)} src={m.type === 'audio' ? undefined : m.src} data-ref-id={m.id}>
        {m.name}
      </MentionChip>,
    ),
  );
  const html = box.innerHTML;
  root.unmount();
  return html;
}

// 每个输入框最后一次的光标位置：点缩略图时焦点离开了输入框，插在离开前光标在的地方
const lastRange = new WeakMap<HTMLElement, Range>();

/** 记住输入框里的光标位置。PromptInput 挂上时调用，返回取消函数 */
export function trackCaret(el: HTMLElement) {
  const onChange = () => {
    const sel = window.getSelection();
    if (sel?.rangeCount && el.contains(sel.getRangeAt(0).startContainer)) lastRange.set(el, sel.getRangeAt(0).cloneRange());
  };
  document.addEventListener('selectionchange', onChange);
  return () => document.removeEventListener('selectionchange', onChange);
}

/** 在光标处（没有就在最后）插一个 @ 引用，后面带一个空格。传了 replace 就替换掉这一段（打的「@名字」）。用 insertHTML：触发 input 事件、能撤销 */
export function insertMention(el: HTMLElement | null, m: MentionSource, replace?: Range) {
  if (!el) return;
  el.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (!sel) return;
  const saved = lastRange.get(el);
  let range: Range;
  if (replace) range = replace;
  else if (saved && el.contains(saved.startContainer)) range = saved;
  else {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
  const html = `${chipHTML(m)} `;
  if (document.execCommand('insertHTML', false, html)) return;
  // insertHTML 不可用时手动插
  const frag = range.createContextualFragment(html);
  const last = frag.lastChild;
  range.deleteContents();
  range.insertNode(frag);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const BLOCK = new Set(['DIV', 'P']);

/** 读出输入框里的文字：@ 引用写成「@图片1」，换行照原样 */
export function promptText(el: HTMLElement | null): string {
  if (!el) return '';
  const walk = (node: Node, first: boolean): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node as Text).data;
    if (!(node instanceof HTMLElement)) return '';
    if (node.dataset.refId) return `@${node.textContent ?? ''}`;
    if (node.tagName === 'BR') return '\n';
    const inner = Array.from(node.childNodes)
      .map((c, i) => walk(c, i === 0))
      .join('');
    // 回车新起的一行（浏览器包成 div）前面补换行
    return BLOCK.has(node.tagName) && !first ? `\n${inner}` : inner;
  };
  return Array.from(el.childNodes)
    .map((c, i) => walk(c, i === 0))
    .join('')
    .replace(/\n$/, '');
}

/** 换成一段纯文字（外面改了受控的提示词时用，原来的 @ 标签不留） */
export function setPromptText(el: HTMLElement | null, text: string) {
  if (el) el.textContent = text;
}

/** 素材变了以后同步 @ 标签：改了名的跟着改，删掉的素材标签也删。有改动返回 true */
export function syncMentions(el: HTMLElement | null, sources: MentionSource[]): boolean {
  if (!el) return false;
  let changed = false;
  el.querySelectorAll<HTMLElement>('[data-ref-id]').forEach((chip) => {
    const m = sources.find((s) => s.id === chip.dataset.refId);
    if (!m) {
      chip.remove();
      changed = true;
      return;
    }
    // 名字是标签里最后一段文字
    const text = Array.from(chip.childNodes).reverse().find((c): c is Text => c.nodeType === Node.TEXT_NODE);
    if (text && text.data !== m.name) {
      text.data = m.name;
      changed = true;
    }
  });
  return changed;
}
