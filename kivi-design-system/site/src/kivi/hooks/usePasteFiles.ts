import { useMemo, useRef, type ClipboardEvent, type ClipboardEventHandler } from 'react';
import { matchAccept } from './useFileDrop';

// 组件库内部共用，从 hooks/ 引，不从入口导出。
// 粘贴文件的公用逻辑：焦点在输入框里时 ⌘V / Ctrl V 粘贴文件，PromptBox 用它。

export interface UsePasteFilesOptions {
  /** 收哪些文件，写法同 `<input accept>`。不传不限 */
  accept?: string;
  /** 禁用：不处理粘贴 */
  disabled?: boolean;
  /** 剪贴板里有符合的文件，参数是第一个（照线上只取第一个） */
  onFile?: (file: File) => void;
  /** 剪贴板里有文件、但一个都不符合 */
  onUnsupported?: () => void;
}

/**
 * 粘贴文件：返回 `onPasteCapture`，铺到输入框外面的容器上（用捕获：赶在输入框自己的粘贴文字之前，
 * 免得复制的文件在输入框里还多贴出一段文件名）。
 * 剪贴板里有符合的文件，只取第一个，拦住默认行为；没有文件（粘的是字）不拦、不提示，照常粘贴文字。
 */
export function usePasteFiles(options: UsePasteFilesOptions) {
  const latest = useRef(options);
  latest.current = options;
  return useMemo<{ onPasteCapture: ClipboardEventHandler<HTMLElement> }>(
    () => ({
      onPasteCapture: (e: ClipboardEvent<HTMLElement>) => {
        const { accept, disabled, onFile, onUnsupported } = latest.current;
        if (disabled) return;
        const files = Array.from(e.clipboardData?.files ?? []);
        if (!files.length) return;
        const file = files.find((f) => matchAccept(f, accept));
        // 文件和文字一起复制（比如在访达里复制文件）时都会带文字：有文件就当文件处理
        e.preventDefault();
        e.stopPropagation();
        if (file) onFile?.(file);
        else onUnsupported?.();
      },
    }),
    [],
  );
}
