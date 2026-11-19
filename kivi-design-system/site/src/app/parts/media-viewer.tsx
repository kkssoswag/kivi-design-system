import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AudioWave, Avatar, Dialog, Divider, Icon, IconButton, ScrollArea, Skeleton, VideoPlayer } from '@kivi';
import { useAudioPlayer } from '@kivi/hooks';

/*
  全站查看大图（11-11 用户定：都和探索页的作品详情一样）。照线上 CardDetailModal 铺满窗口：
  左边作品（完整显示），竖线，右边 440 的信息栏：头（作者或自己 + 日期）和操作、关闭，横线，内容（自己滚），最下面可放一个按钮。
  探索页、创作页记录流、AI 工具历史、资产页生成历史都用它，只填各自的信息。只在模板里拼，不进组件库。
*/

export interface ViewerMedia {
  type: 'image' | 'video' | 'audio';
  src: string;
  /** 视频封面 */
  poster?: string;
  alt?: string;
  /** 音频的名字（大图里写在频谱上面） */
  name?: string;
  /** 音频频谱每条竖条的高度（真接口时是后端算好的一串数）；不传按地址算一组示例 */
  bars?: number[];
}

/** 素材的宽高比，按地址记住：切回看过的那张不用再等加载 */
const RATIOS = new Map<string, number>();
/** 有上下切换时作品右边让出按钮那一列 */
const NAV_SPACE = 96;

/**
  图片、视频一样大（11-18 用户定）：按素材自己的比例，在作品那一栏里放下能放的最大框，图片、视频都撑满这个框
  （小图也放大；视频播放器跟着画面比例，不留黑边）。图片加载完、视频第一帧出来之前先出骨架屏（按默认比例：图 1:1、视频 16:9），出来时淡入，免得黑着等、先出封面再黑一下
*/
function useFitBox(src: string, reserve: number, fallback: number) {
  // 弹窗打开时作品那一栏才挂上，用回调 ref 记进 state 再去量
  const [el, ref] = useState<HTMLDivElement | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState(() => RATIOS.get(src) ?? 0);
  // 出来了没有：每换一个都重新等（看过的比例记住了、框先摆好，但画面还是等加载完再淡入）
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    setRatio(RATIOS.get(src) ?? 0);
    setReady(false);
  }, [src]);
  useLayoutEffect(() => {
    if (!el) return;
    // 先同步量一次，不等 ResizeObserver 下一帧（不然第一帧框是 0）
    const r = el.getBoundingClientRect();
    setArea({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  const measure = (w: number, h: number) => {
    if (!w || !h) return;
    RATIOS.set(src, w / h);
    setRatio(w / h);
    setReady(true);
  };
  // 加载失败也算出来了（播放器、图片自己显示失败），不能一直挂着骨架屏
  const fail = () => setReady(true);
  // 比例还不知道（第一次看、还在加载）先按默认比例摆骨架屏
  const r = ratio || fallback;
  const availW = Math.max(0, area.w - reserve);
  const width = Math.min(availW, area.h * r);
  const box = { width: Math.round(width), height: Math.round(width / r) };
  return { ref, box, ready, measure, fail };
}

/** 关的时候弹窗还在淡出，内容留着上一次的，不闪空 */
export function useLastShown<T>(value: T | null) {
  const last = useRef(value);
  if (value !== null) last.current = value;
  return value ?? last.current;
}

export interface MediaViewerProps {
  /** 要看的图或视频，null 就是关着 */
  media: ViewerMedia | null;
  onClose: () => void;
  /** 头左边：作者（或自己）+ 日期，用 ViewerAuthor */
  head?: ReactNode;
  /** 头右边、关闭前面的操作：下载、收藏这类，IconButton 次要 36 */
  actions?: ReactNode;
  /** 内容：一节一节的 ViewerSection */
  children?: ReactNode;
  /** 最下面撑满宽的按钮（探索页是点赞），可以不放 */
  footer?: ReactNode;
  /** 能上下切的那一串（记录流里的所有结果、资产列表）：多于 1 个时作品右边出上一个 / 下一个，↑ ↓（← →）也能切（照即梦，11-18 用户定） */
  group?: ViewerMedia[];
  /** 现在看的是第几个 */
  index?: number;
  onIndexChange?: (index: number) => void;
}

export function MediaViewer({ media, onClose, head, actions, children, footer, group, index = 0, onIndexChange }: MediaViewerProps) {
  const shown = useLastShown(media);
  const many = !!group && group.length > 1;
  // 关的时候外面已经把「第几个」清掉了，弹窗还在淡出：用上一次的，不然播放器的 key 一变就重新挂载、先闪一下封面
  const shownIndex = useLastShown(media ? index : null) ?? 0;
  const fit = useFitBox(shown?.src ?? '', many ? NAV_SPACE : 0, shown?.type === 'video' ? 16 / 9 : 1);
  // ↑ ↓、← → 切上一个、下一个；焦点在播放器、输入框里时不抢（播放器自己用 ← → 快进快退）
  useEffect(() => {
    if (media === null || !many || !group) return;
    const onKey = (e: KeyboardEvent) => {
      const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
      if (!step) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable="true"], .kv-video-player, .kv-audio-wave')) return;
      const next = index + step;
      if (next < 0 || next >= group.length) return;
      e.preventDefault();
      onIndexChange?.(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media, many, group, index, onIndexChange]);
  return (
    <Dialog size="full" aria-label="查看大图" open={media !== null} onOpenChange={(v) => !v && onClose()}>
      {shown && (
        <div className="tpl-viewer">
          <div className="tpl-viewer__media" ref={fit.ref}>
            {shown.type === 'audio' ? (
              <ViewerAudio key={`${shownIndex}:${shown.src}`} media={shown} />
            ) : (
              <div
                className="tpl-viewer__frame"
                style={fit.box}
                data-ready={fit.ready ? '' : undefined}
                // 视频等第一帧解码好再出（不然先出封面、再黑一下才有画面，看着闪）；loadeddata 不冒泡，在外面用捕获拿宽高
                onLoadedDataCapture={(e) => {
                  const v = e.target as HTMLVideoElement;
                  fit.measure(v.videoWidth, v.videoHeight);
                }}
                onErrorCapture={fit.fail}
              >
                {/* 没加载好先出骨架屏，画面出来淡入盖上 */}
                {!fit.ready && <Skeleton className="tpl-viewer__skeleton" />}
                {shown.type === 'video' ? (
                  <VideoPlayer key={`${shownIndex}:${shown.src}`} variant="preview" src={shown.src} poster={shown.poster} autoPlay loop />
                ) : (
                  <img key={shown.src} src={shown.src} alt={shown.alt ?? ''} onLoad={(e) => fit.measure(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />
                )}
              </div>
            )}
            {many && (
              <div className="tpl-viewer__nav">
                <IconButton icon="UpArrowSmall" label="上一个" variant="ghost" size={36} disabled={index <= 0} onClick={() => onIndexChange?.(index - 1)} />
                <IconButton icon="DownArrowSmall" label="下一个" variant="ghost" size={36} disabled={!group || index >= group.length - 1} onClick={() => onIndexChange?.(index + 1)} />
              </div>
            )}
          </div>
          <Divider orientation="vertical" />
          <aside className="tpl-viewer__info">
            <header className="tpl-viewer__head">
              {head ?? <span />}
              <span className="tpl-viewer__actions">
                {actions}
                <IconButton icon="Close" label="关闭" variant="secondary" size={36} onClick={onClose} />
              </span>
            </header>
            <Divider />
            <ScrollArea className="tpl-viewer__body">
              <div className="tpl-viewer__content">{children}</div>
            </ScrollArea>
            {footer && <div className="tpl-viewer__footer">{footer}</div>}
          </aside>
        </div>
      )}
    </Dialog>
  );
}

/** 头左边：头像 32 + 名字 / 日期 */
export function ViewerAuthor({ name, avatar, date }: { name: string; avatar?: string; date: string }) {
  return (
    <span className="tpl-viewer__author">
      <Avatar name={name} src={avatar} size={32} />
      <span>
        <span className="tpl-viewer__name">{name}</span>
        <span className="tpl-viewer__date">{date}</span>
      </span>
    </span>
  );
}

/** 信息栏里的一节：小标题 + 内容 */
export function ViewerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tpl-viewer__section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (sec: number) => `${pad(Math.floor(sec / 60))}:${pad(Math.floor(sec % 60))}`;

/** 没给频谱时按地址算一组示例高度（72 条，最高 69），同一个音频每次一样，不同音频不重样 */
function sampleBars(seed: string): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: 72 }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const wave = Math.sin((i / 72) * Math.PI * 3 + (h % 7)) * 0.5 + 0.5;
    return Math.max(1, Math.round((wave * 0.6 + ((h >>> 16) % 100) / 250) * 69));
  });
}

/**
 * 音频的大图（11-18 先摆的样子）：名字 + 一大块频谱（和画布音频节点同一个 AudioWave，能点、能拖跳转）+ 时间和播放。
 * 进来不自动播，点播放才放；切到别的音频就停（key 换了重新挂）
 */
function ViewerAudio({ media }: { media: ViewerMedia }) {
  const player = useAudioPlayer({ src: media.src });
  const { duration, currentTime, status } = player;
  const failed = status === 'error';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const time = failed ? '加载失败' : `${clock(currentTime)} / ${clock(duration)}`;
  return (
    <div className="tpl-viewer__audio">
      <audio ref={player.audioRef} {...player.audioProps} />
      <div className="tpl-viewer__audio-name">
        <Icon name="Music" size={20} />
        <span>{media.name ?? media.alt}</span>
      </div>
      <div className="tpl-viewer__audio-wave">
        <AudioWave
          progress={progress}
          bars={media.bars ?? sampleBars(media.src)}
          disabled={failed || duration <= 0}
          valueText={time}
          step={duration > 0 ? Math.min(100, (5 / duration) * 100) : 5}
          onProgressChange={(v) => player.seek((v / 100) * duration)}
        />
      </div>
      <div className="tpl-viewer__audio-bar">
        <span className="tpl-viewer__audio-time" data-failed={failed || undefined}>
          {time}
        </span>
        <IconButton icon={player.playing ? 'Pause' : 'Play'} label={player.playing ? '暂停' : '播放'} tooltip={false} variant="secondary" size={36} disabled={failed} onClick={player.toggle} />
      </div>
    </div>
  );
}
