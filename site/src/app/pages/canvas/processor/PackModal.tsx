import { useMemo, useState, type CSSProperties } from 'react';
import { Banner, Button, Dialog, Image, Input, NumberInput, Slider, Switch, TabItem, Tabs, Tag, VideoPlayer } from '@kivi';
import { upstreamOf, useCanvasDoc } from '../../../data/canvas-doc';
import { exportPack, setPack } from '../../../data/canvas-processor';
import { ratioNum } from '../../../data/mock';
import { attempt } from '../../../flows/errors';
import { PACK_APNG_FPS, PACK_FORMATS, PACK_FPS, PACK_RULES, PACK_ROLE_NAME, PACK_TEMPLATES, PACK_TEXT, defaultPackConfig, nominalSize, packMaterials, packMeta, validatePack, type PackMaterial } from '../../../rules/packager';
import type { PackConfig, PackTemplate } from '../../../data/types';
import { PickSelect } from './parts';

/*
  视频封装弹窗（照线上 nodes/video-project/components/packager-modal）：
  左边封装类型（麦圈 / 勋章、礼物 / 座驾、背景、自定义），中间连进来的素材（上面图片、下面视频），右边提示和规范、资源名称，
  底栏时长和预估大小 + 「导出」。素材数量不够不能导出；尺寸不对导出前问一句。
  线上还有：弹窗里上传素材（会给封装节点建前序节点）、封面裁剪、从视频提取封面、视频位置缩放、预览蒙版——演示里没做。
*/

/** 原视频帧率（演示的视频都按 30fps） */
const ORIGINAL_FPS = 30;
const APNG_MAX_EDGE = 750;

function Tile({ m, rolesVisible }: { m: PackMaterial; rolesVisible: boolean }) {
  const item = m.node.items?.[0];
  if (!item) return null;
  return (
    <div className="app-pack__tile" style={{ aspectRatio: ratioNum(m.node.ratio ?? '1:1') } as CSSProperties}>
      {rolesVisible && m.role && (
        <Tag variant="on-media" className="app-pack__tag">
          {PACK_ROLE_NAME[m.role]}
        </Tag>
      )}
      {m.node.type === 'video' ? <VideoPlayer variant="card" src={item.src} poster={item.poster} /> : <Image src={item.src} fit="cover" alt={m.node.name} />}
    </div>
  );
}

export function PackModal({ canvasId, nodeId, onClose }: { canvasId: string; nodeId: string; onClose: () => void }) {
  const doc = useCanvasDoc(canvasId);
  const node = doc.nodes.find((n) => n.id === nodeId);
  const ups = useMemo(() => (node ? upstreamOf(doc, nodeId).filter((n) => n.items?.[0]) : []), [doc, node, nodeId]);
  const [cfg, setCfg] = useState<PackConfig>(() => node?.pack ?? defaultPackConfig());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (!node) return null;

  const update = (p: Partial<PackConfig>) => {
    const next = { ...cfg, ...p };
    setCfg(next);
    setPack(canvasId, nodeId, next);
  };

  const { images, videos } = packMaterials(cfg.template, ups);
  const check = validatePack(cfg.template, ups);
  const rule = PACK_RULES[cfg.template];
  const video = videos[0]?.node;
  const original = video ? nominalSize(video) : { w: 1080, h: 1920 };
  // 自定义：尺寸默认原视频，只能缩小不能放大；比例锁死
  const width = Math.min(cfg.width ?? original.w, original.w);
  const height = Math.min(cfg.height ?? original.h, original.h);
  const apngBlocked = width > APNG_MAX_EDGE || height > APNG_MAX_EDGE;
  const fpsOptions = (cfg.format === 'apng' ? PACK_APNG_FPS : PACK_FPS).map((v) => ({ value: v, label: `${v}fps`, disabled: v > ORIGINAL_FPS }));
  const setWidth = (v: string) => {
    const w = Math.min(original.w, Math.max(1, Math.round(Number(v) || 1)));
    update({ width: w, height: Math.min(original.h, Math.max(1, Math.round((w * original.h) / original.w))) });
  };
  const setHeight = (v: string) => {
    const h = Math.min(original.h, Math.max(1, Math.round(Number(v) || 1)));
    update({ height: h, width: Math.min(original.w, Math.max(1, Math.round((h * original.w) / original.h))) });
  };

  const doExport = async () => {
    setConfirming(false);
    setBusy(true);
    try {
      const out = await attempt(() => exportPack(canvasId, nodeId));
      if (out) onClose();
    } finally {
      setBusy(false);
    }
  };
  const onExport = () => (check.needConfirm ? setConfirming(true) : void doExport());

  return (
    <>
      <Dialog
        open
        size={1200}
        title="封装类型"
        closeOnMaskClick={false}
        onOpenChange={(o) => !o && onClose()}
        footer={
          <div className="app-pack__foot">
            <div className="app-pack__meta">
              {packMeta(cfg, ups).map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <Button size={36} variant="primary" loading={busy} disabled={!check.canExport || busy} onClick={onExport}>
              {busy ? '导出中' : '导出'}
            </Button>
          </div>
        }
      >
        <div className="app-pack">
          <Tabs className="app-pack__nav" layout="vertical" value={cfg.template} onChange={(v) => update({ template: v as PackTemplate })} aria-label="封装类型">
            {PACK_TEMPLATES.map((t) => (
              <TabItem key={t.id} value={t.id}>
                {t.label}
              </TabItem>
            ))}
          </Tabs>

          <div className="app-pack__stage">
            {cfg.template !== 'custom' && (
              <div className="app-pack__group">
                {images.length ? images.map((m) => <Tile key={m.node.id} m={m} rolesVisible />) : <span className="app-pack__empty">连接图片节点作为封面</span>}
              </div>
            )}
            <div className="app-pack__group">
              {videos.length ? <Tile m={videos[0]} rolesVisible={cfg.template !== 'custom'} /> : <span className="app-pack__empty">连接视频节点</span>}
            </div>
          </div>

          <div className="app-pack__side">
            {check.errors.map((e) => (
              <Banner key={e} type="warning">
                {e}
              </Banner>
            ))}
            {rule.specs.map((s) => (
              <section key={s.title} className="app-pack__section">
                <h3 className="app-pack__title">{s.title}</h3>
                {s.rows.map((r) => (
                  <div key={r.label} className="app-pack__row">
                    <span>{r.label}：</span>
                    <em>{r.value}</em>
                  </div>
                ))}
              </section>
            ))}

            {cfg.template === 'vehicle' && (
              <section className="app-pack__section">
                <Switch checked={cfg.vehicleBg} onChange={(vehicleBg) => update({ vehicleBg })}>
                  素材背景
                </Switch>
                <Switch checked={cfg.feather} onChange={(feather) => update({ feather, strength: feather ? cfg.strength : 0 })}>
                  羽化
                </Switch>
                {cfg.feather && <Slider aria-label="羽化强度" value={cfg.strength} min={0} max={100} onChange={(strength) => update({ strength })} />}
              </section>
            )}

            {cfg.template === 'custom' && (
              <section className="app-pack__section">
                <h3 className="app-pack__title">视频尺寸</h3>
                <div className="app-pack__size">
                  <NumberInput value={width} min={1} max={original.w} unit="W" onChange={setWidth} aria-label="宽" />
                  <NumberInput value={height} min={1} max={original.h} unit="H" onChange={setHeight} aria-label="高" />
                </div>
                <h3 className="app-pack__title">封装格式</h3>
                <PickSelect
                  label="封装格式"
                  value={cfg.format}
                  options={PACK_FORMATS.map((f) => ({ ...f, disabled: f.value === 'apng' && apngBlocked }))}
                  onChange={(format) => update({ format, fps: Math.min(cfg.fps, format === 'apng' ? 15 : ORIGINAL_FPS) })}
                />
                <h3 className="app-pack__title">帧速率</h3>
                <PickSelect label="帧速率" value={cfg.fps} options={fpsOptions} onChange={(fps) => update({ fps })} />
                <h3 className="app-pack__title">质量大小</h3>
                <Slider aria-label="质量大小" value={cfg.quality} min={1} max={100} onChange={(quality) => update({ quality })} />
              </section>
            )}

            <section className="app-pack__section">
              <h3 className="app-pack__title">{PACK_TEXT.nameLabel}</h3>
              <Input value={cfg.name} maxLength={PACK_TEXT.nameMax} onChange={(e) => update({ name: e.target.value.slice(0, PACK_TEXT.nameMax) })} aria-label={PACK_TEXT.nameLabel} />
            </section>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirming}
        size={400}
        title={PACK_TEXT.confirmTitle}
        description={PACK_TEXT.confirmDesc}
        onOpenChange={(o) => !o && setConfirming(false)}
        footer={
          <>
            <Button size={36} variant="secondary" onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button size={36} variant="primary" onClick={() => void doExport()}>
              确定
            </Button>
          </>
        }
      />
    </>
  );
}

