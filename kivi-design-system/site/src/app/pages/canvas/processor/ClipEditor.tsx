import { useEffect, useMemo, useState } from 'react';
import { AttachmentStrip, Button, Dialog, Image, NodeMedia, VideoPlayer, toast, type AttachmentItem } from '@kivi';
import { composeClip, clipSources, setClip } from '../../../data/canvas-processor';
import { disconnectPair, useCanvasDoc } from '../../../data/canvas-doc';
import { ratioNum } from '../../../data/mock';
import { toSeconds } from '../../../rules/packager';
import { attempt } from '../../../flows/errors';
import type { CanvasNode, ClipConfig } from '../../../data/types';
import { PickSelect, type PickOption } from './parts';

/*
  视频剪辑弹窗（线上是 @ai-design/video-editor 整个剪辑器：预览画布、时间轴、合成，代码 123 个文件）。
  演示里做到能看出流程：把连进来的图片、视频、音频摆上时间轴（拖着排顺序、点哪个预览哪个、删了就断开那条连线），
  选画布比例和帧率，「合成」后在节点右边出成片（假任务）。剪切、缩放、字幕、转场这些没做。
  文案、按钮照线上 locales：视频剪辑 / 退出 / 合成 / 原图比例 / 帧率。
*/

const RATIOS: PickOption<string>[] = [
  { value: 'auto', label: '原图比例', icon: 'AutoAspect' },
  { value: '1:1', label: '1:1', icon: 'Square11' },
  { value: '3:4', label: '3:4', icon: 'Square34' },
  { value: '4:3', label: '4:3', icon: 'Square43' },
  { value: '16:9', label: '16:9', icon: 'Square169' },
  { value: '9:16', label: '9:16', icon: 'Square916' },
];
const FPS: PickOption<number>[] = [24, 25, 30, 50, 60].map((v) => ({ value: v, label: `${v}fps` }));

/** 图片放在时间轴上默认占几秒 */
const IMAGE_SECONDS = 3;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const seconds = (n: CanvasNode) => (n.type === 'image' ? IMAGE_SECONDS : toSeconds(n.items?.[0]?.duration) || IMAGE_SECONDS);

const toItem = (n: CanvasNode): AttachmentItem => ({
  id: n.id,
  type: n.type as AttachmentItem['type'],
  name: n.name,
  src: n.items?.[0]?.poster ?? n.items?.[0]?.src,
  duration: n.type === 'image' ? undefined : n.items?.[0]?.duration,
});

export function ClipEditor({ canvasId, nodeId, onClose }: { canvasId: string; nodeId: string; onClose: () => void }) {
  const doc = useCanvasDoc(canvasId);
  const node = doc.nodes.find((n) => n.id === nodeId);
  const sources = useMemo(() => (node ? clipSources(doc, node).filter((n) => n.items?.[0]) : []), [doc, node]);
  const picture = sources.filter((n) => n.type !== 'audio');
  const audio = sources.filter((n) => n.type === 'audio');
  const cfg: ClipConfig = node?.clip ?? { order: [], ratio: 'auto', fps: 30 };
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const playing = sources.find((n) => n.id === current) ?? picture[0] ?? audio[0];

  // 素材都删光了：回到画布（线上素材连线没了，编辑器里也没有东西可剪）
  useEffect(() => {
    if (node && !sources.length) onClose();
  }, [node, sources.length, onClose]);
  if (!node) return null;

  const save = (patch: Partial<ClipConfig>) => setClip(canvasId, nodeId, { ...cfg, order: sources.map((n) => n.id), ...patch });
  // 时间轴排序：画面和音频各排各的，存的顺序是「画面在前、音频在后」
  const reorder = (list: CanvasNode[], other: CanvasNode[], picture_: boolean) => (from: number, to: number) => {
    const next = [...list];
    next.splice(to, 0, ...next.splice(from, 1));
    save({ order: (picture_ ? [...next, ...other] : [...other, ...next]).map((n) => n.id) });
  };
  const remove = (id: string) => disconnectPair(canvasId, id, nodeId);

  const ratioValue = cfg.ratio === 'auto' ? picture.find((n) => n.type === 'video')?.ratio ?? picture[0]?.ratio ?? '16:9' : cfg.ratio;
  const total = sources.reduce((s, n) => (n.type === 'audio' ? s : s + seconds(n)), 0);

  const compose = async () => {
    setBusy(true);
    try {
      const ok = await attempt(() => composeClip(canvasId, nodeId));
      if (ok !== undefined) {
        toast.success('开始合成');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="full"
      title="视频剪辑"
      closeOnMaskClick={false}
      onOpenChange={(o) => !o && onClose()}
      footer={
        <>
          <Button size={36} variant="secondary" onClick={onClose}>
            退出
          </Button>
          <Button size={36} variant="primary" loading={busy} disabled={!picture.length && !audio.length} onClick={() => void compose()}>
            合成
          </Button>
        </>
      }
    >
      <div className="app-clip">
        <div className="app-clip__stage">
          <div className="app-clip__frame" style={{ '--app-clip-ratio': ratioNum(ratioValue) } as React.CSSProperties}>
            {playing?.type === 'video' && <VideoPlayer key={playing.id} variant="preview" src={playing.items![0].src} poster={playing.items![0].poster} />}
            {playing?.type === 'image' && <Image key={playing.id} src={playing.items![0].src} fit="contain" alt={playing.name} />}
            {playing?.type === 'audio' && <NodeMedia key={playing.id} type="audio" src={playing.items![0].src} />}
          </div>
        </div>

        <div className="app-clip__bar">
          <PickSelect label="画布比例" value={cfg.ratio} options={RATIOS} onChange={(ratio) => save({ ratio })} placement="top-start" />
          <PickSelect label="帧率" value={cfg.fps} options={FPS} onChange={(fps) => save({ fps })} placement="top-start" />
          <span className="app-clip__bar-spacer" />
          <span className="app-clip__time">总时长 {clock(total)}</span>
        </div>

        <div className="app-clip__tracks">
          <div className="app-clip__track">
            <span className="app-clip__track-name">画面</span>
            <div className="app-clip__track-items">
              {picture.length ? (
                <AttachmentStrip
                  items={picture.map(toItem)}
                  onRemove={(id) => remove(id)}
                  onItemClick={(item) => setCurrent(item.id)}
                  onReorder={reorder(picture, audio, true)}
                  labels
                />
              ) : (
                <span className="app-clip__track-empty">连接图片或视频素材后可打开画布预览</span>
              )}
            </div>
          </div>
          <div className="app-clip__track">
            <span className="app-clip__track-name">音频</span>
            <div className="app-clip__track-items">
              {audio.length ? (
                <AttachmentStrip
                  items={audio.map(toItem)}
                  onRemove={(id) => remove(id)}
                  onItemClick={(item) => setCurrent(item.id)}
                  onReorder={reorder(audio, picture, false)}
                  labels
                />
              ) : (
                <span className="app-clip__track-empty">没有音频</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
