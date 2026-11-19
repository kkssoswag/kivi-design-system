import { useCallback, useMemo, useRef, useState, type DragEvent, type DragEventHandler } from 'react';
import { composeHandlers } from './composeHandlers';

// 组件库内部共用，从 hooks/ 引，不从入口导出。
// 拖文件进来的公用逻辑：PromptBox 的 DropOverlay、画布 Agent 输入框都用它。

/**
 * 为什么拒收：类型不对 / 超过大小 / 时长 / 分辨率 / 宽高比。
 * 后三种要读了媒体信息才知道，hook 自己只判断前两种；业务读完媒体信息后自己用这三种调 rejectMessage
 */
export type FileRejectReason = 'type' | 'size' | 'duration' | 'resolution' | 'dimension' | 'ratio';

/** 拒收文案里要写进去的数字（上限、下限），照线上的上传校验 */
export interface FileLimits {
  /** 单个文件最大多少字节 */
  maxSize?: number;
  /** 时长下限、上限，单位秒 */
  minDuration?: number;
  maxDuration?: number;
  /** 分辨率（短边像素）下限、上限 */
  minResolution?: number;
  maxResolution?: number;
  /** 宽、高都要落在这个范围（像素），文案「上传文件最小宽高 / 最大宽高」 */
  minDimension?: number;
  maxDimension?: number;
  /** 收的格式，写进「文件请上传…格式」，比如 `png、jpg、webp`。不传类型不对就只说「不支持这种文件」 */
  formats?: string;
}

export interface FileRule {
  /** 收哪些文件，写法和 `<input accept>` 一样：`image/*`、`image/png`、`.pdf`，逗号隔开。不传不限 */
  accept?: string;
  /** 单个文件最大多少字节。不传不限 */
  maxSize?: number;
}

const rulesOf = (accept?: string) =>
  (accept ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** 文件类型收不收：和 `<input accept>` 一样，扩展名、`类型/*`、完整类型都认 */
export function matchAccept(file: { name: string; type: string }, accept?: string): boolean {
  const rules = rulesOf(accept);
  if (!rules.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((r) => (r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r));
}

/** 拖的过程中浏览器只给类型、不给文件名和大小：扩展名规则看不出来，先当收；只有按类型写的规则才能提前判断 */
function dragRejected(items: DataTransferItemList | undefined, accept?: string): boolean {
  const rules = rulesOf(accept);
  if (!rules.length || rules.some((r) => r.startsWith('.')) || !items) return false;
  return Array.from(items).some((it) => it.kind === 'file' && it.type !== '' && !matchAccept({ name: '', type: it.type }, accept));
}

/** 把文件分成收的和拒的。拒的里有类型不对的，原因就写 type，否则是 size */
export function filterFiles(files: File[], rule: FileRule): { accepted: File[]; rejected: File[]; reason?: FileRejectReason } {
  const accepted: File[] = [];
  const rejected: File[] = [];
  let reason: FileRejectReason | undefined;
  for (const f of files) {
    if (!matchAccept(f, rule.accept)) {
      rejected.push(f);
      reason = 'type';
    } else if (rule.maxSize != null && f.size > rule.maxSize) {
      rejected.push(f);
      reason ??= 'size';
    } else accepted.push(f);
  }
  return { accepted, rejected, reason };
}

/** 拒收时提示的文字，文案照线上的上传校验：带上限、下限的数字 */
export function rejectMessage(reason: FileRejectReason, limits: FileLimits = {}): string {
  const { maxSize, minDuration, maxDuration, minResolution, maxResolution, minDimension, maxDimension, formats } = limits;
  switch (reason) {
    case 'size': {
      if (maxSize == null) return '不支持这种文件';
      const mb = Math.round((maxSize / 1024 / 1024) * 10) / 10;
      return `上传失败 文件大小不能超过${mb}MB`;
    }
    case 'duration':
      if (maxDuration != null) return `上传失败 时长不能超过${maxDuration}s`;
      if (minDuration != null) return `上传失败 时长不能小于${minDuration}s`;
      return '上传失败 时长不符合要求';
    case 'resolution':
      if (maxResolution != null) return `上传失败 分辨率不能超过${maxResolution}p`;
      if (minResolution != null) return `上传失败 分辨率不能低于${minResolution}p`;
      return '上传失败 分辨率不符合要求';
    case 'dimension':
      if (minDimension != null) return `上传文件最小宽高${minDimension}px`;
      if (maxDimension != null) return `上传文件最大宽高${maxDimension}px`;
      return '上传失败 宽高不符合要求';
    case 'ratio':
      return '上传失败 图片宽高比需在 1:2.5～2.5:1 之间';
    default:
      return formats ? `上传失败 文件请上传${formats}格式` : '不支持这种文件';
  }
}

/** 一类文件的上传要求：类型、大小，加上要读了媒体信息才能判断的时长、宽高、宽高比 */
export interface MediaRule extends FileRule, FileLimits {
  /** 宽高比（宽 / 高）的范围，比如 `[0.4, 2.5]`（1:2.5 ～ 2.5:1） */
  ratio?: [number, number];
}

/** 媒体信息：图片、视频有宽高，视频、音频有时长（秒）。读不出来的项是 undefined */
export interface MediaMeta {
  width?: number;
  height?: number;
  duration?: number;
}

/** 读文件的宽高、时长：图片、视频、音频各用自己的元素读元数据，读不出来（格式浏览器不认）返回空，当作没法判断、不拦 */
export function readMediaMeta(file: File): Promise<MediaMeta> {
  const kind = file.type.split('/')[0];
  if (kind !== 'image' && kind !== 'video' && kind !== 'audio') return Promise.resolve({});
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const done = (meta: MediaMeta) => {
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    if (kind === 'image') {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done({});
      img.src = url;
      return;
    }
    const el = document.createElement(kind);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement;
      done({ width: kind === 'video' ? v.videoWidth : undefined, height: kind === 'video' ? v.videoHeight : undefined, duration: Number.isFinite(el.duration) ? el.duration : undefined });
    };
    el.onerror = () => done({});
    el.src = url;
  });
}

/** 一个文件合不合规矩：先看类型、大小，再读媒体信息看时长、宽高、宽高比。合格返回 undefined，不合格返回原因和提示文字（照线上） */
export async function checkFile(file: File, rule: MediaRule): Promise<{ reason: FileRejectReason; message: string } | undefined> {
  const fail = (reason: FileRejectReason) => ({ reason, message: rejectMessage(reason, rule) });
  const basic = filterFiles([file], rule);
  if (basic.reason) return fail(basic.reason);
  const needMeta = rule.minDuration != null || rule.maxDuration != null || rule.minDimension != null || rule.maxDimension != null || rule.ratio != null;
  if (!needMeta) return undefined;
  const { width, height, duration } = await readMediaMeta(file);
  if (duration != null) {
    if (rule.minDuration != null && duration < rule.minDuration) return { reason: 'duration', message: rejectMessage('duration', { minDuration: rule.minDuration }) };
    if (rule.maxDuration != null && duration > rule.maxDuration) return { reason: 'duration', message: rejectMessage('duration', { maxDuration: rule.maxDuration }) };
  }
  if (width && height) {
    if (rule.minDimension != null && Math.min(width, height) < rule.minDimension) return { reason: 'dimension', message: rejectMessage('dimension', { minDimension: rule.minDimension }) };
    if (rule.maxDimension != null && Math.max(width, height) > rule.maxDimension) return { reason: 'dimension', message: rejectMessage('dimension', { maxDimension: rule.maxDimension }) };
    if (rule.ratio && (width / height < rule.ratio[0] || width / height > rule.ratio[1])) return fail('ratio');
  }
  return undefined;
}

/**
 * 一批文件逐个检查：合格的留下，不合格的跳过，message 是第一个不合格的原因（弹 Toast 用）。
 * ruleOf 按文件挑规矩（图片、视频、音频各有各的），返回 undefined 就不检查
 */
export async function checkFiles(files: File[], ruleOf: (file: File) => MediaRule | undefined): Promise<{ accepted: File[]; message?: string }> {
  const accepted: File[] = [];
  let message: string | undefined;
  for (const f of files) {
    const rule = ruleOf(f);
    const bad = rule && (await checkFile(f, rule));
    if (bad) message ??= bad.message;
    else accepted.push(f);
  }
  return { accepted, message };
}

export interface UseFileDropOptions extends FileRule {
  /** 一次能收几个：false 只收第一个。默认 true */
  multiple?: boolean;
  /** 禁用：拖进来也不收（还是拦着，不让浏览器把文件打开） */
  disabled?: boolean;
  /** 拖拽中（受控）。不传由 hook 自己根据拖拽判断；文档里摆静态样子用 */
  dragging?: boolean;
  /** 拖进来的东西不收（受控）。不传由 hook 根据 accept 判断；文档里摆静态样子用 */
  rejected?: boolean;
  /** 放下后，收下的文件 */
  onFiles?: (files: File[]) => void;
  /** 放下后，被拒的文件和原因 */
  onReject?: (files: File[], reason: FileRejectReason) => void;
}

export interface FileDropHandlers<T extends HTMLElement = HTMLElement> {
  onDragEnter: DragEventHandler<T>;
  onDragOver: DragEventHandler<T>;
  onDragLeave: DragEventHandler<T>;
  onDrop: DragEventHandler<T>;
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * 拖文件进来：数 dragenter / dragleave 的次数，鼠标在里面的子元素之间移动时不会一闪一闪。
 * 返回 `dragging`（有文件在上面）、`rejected`（拖的类型不收）、`bind`（四个拖拽事件，铺到根元素上）、
 * `receive`（点选文件走同一套检查：选完把文件列表交给它）。
 */
export function useFileDrop(options: UseFileDropOptions) {
  const depth = useRef(0);
  const [over, setOver] = useState({ dragging: false, rejected: false });
  const latest = useRef(options);
  latest.current = options;

  const reset = useCallback(() => {
    depth.current = 0;
    setOver((o) => (o.dragging || o.rejected ? { dragging: false, rejected: false } : o));
  }, []);

  const receive = useCallback((list: Iterable<File> | ArrayLike<File> | null | undefined) => {
    const { multiple = true, accept, maxSize, disabled, onFiles, onReject } = latest.current;
    if (disabled || !list) return;
    const all = Array.from(list);
    if (!all.length) return;
    const { accepted, rejected, reason } = filterFiles(multiple ? all : all.slice(0, 1), { accept, maxSize });
    if (rejected.length && reason) onReject?.(rejected, reason);
    if (accepted.length) onFiles?.(accepted);
  }, []);

  const bind = useMemo<FileDropHandlers>(() => {
    const sync = (e: DragEvent) => {
      const { disabled, accept } = latest.current;
      const rejected = !disabled && dragRejected(e.dataTransfer?.items, accept);
      setOver((o) => (o.dragging && o.rejected === rejected ? o : { dragging: !disabled, rejected }));
    };
    return {
      onDragEnter: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        sync(e);
      },
      onDragOver: (e) => {
        if (!hasFiles(e)) return;
        // 不拦着的话浏览器会把文件当网页打开，把整页换掉
        e.preventDefault();
        const { disabled, accept } = latest.current;
        e.dataTransfer.dropEffect = disabled || dragRejected(e.dataTransfer.items, accept) ? 'none' : 'copy';
        sync(e);
      },
      onDragLeave: (e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) reset();
      },
      onDrop: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        reset();
        receive(e.dataTransfer.files);
      },
    };
  }, [receive, reset]);

  return {
    dragging: options.dragging ?? over.dragging,
    rejected: options.rejected ?? over.rejected,
    bind,
    receive,
  };
}

/** 组件自己的拖拽处理和外面传的合并（外面先调，调了 preventDefault 就不再走组件自己的） */
export function composeDropHandlers<T extends HTMLElement>(
  theirs: Partial<FileDropHandlers<T>>,
  ours: FileDropHandlers,
): FileDropHandlers<T> {
  return {
    onDragEnter: composeHandlers(theirs.onDragEnter, ours.onDragEnter),
    onDragOver: composeHandlers(theirs.onDragOver, ours.onDragOver),
    onDragLeave: composeHandlers(theirs.onDragLeave, ours.onDragLeave),
    onDrop: composeHandlers(theirs.onDrop, ours.onDrop),
  };
}
