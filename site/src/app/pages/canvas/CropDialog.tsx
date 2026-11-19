import { useLayoutEffect, useRef, useState } from 'react';
import { Button, CropHandles, Dialog, Dropdown, Menu, MenuItem, Select, type CropRect } from '@kivi';
import { ratioNum } from '../../data/mock';
import { EXPAND_RATIOS } from '../../parts/tool-workbench/options';
import './node-tools.css';

/*
  裁剪（照线上 crop-image-plugin：在图上拉框、选比例，确认后出裁剪节点）。
  线上是在画布上原地裁，这里是弹窗：画布缩放后拖框的坐标不好算，弹窗里的舞台和扩图用同一套 CropHandles。
  确认交出相对原图的框（0–1），由调用的人真的裁出一张。
*/

/** 把宽高比为 ratio 的东西放进 w × h 里，居中 */
function fit(ratio: number, w: number, h: number): CropRect {
  const fw = Math.min(w, h * ratio);
  const fh = fw / ratio;
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
}

export interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  /** 原图宽 / 高 */
  ratio: number;
  /** 点确认：相对原图的框，0–1 */
  onConfirm: (rel: { x: number; y: number; w: number; h: number }) => void;
}

export function CropDialog({ open, onOpenChange, src, ratio, onConfirm }: CropDialogProps) {
  return (
    <Dialog size={800} className="app-stage-dlg" title="裁剪" open={open} onOpenChange={onOpenChange}>
      {open && <CropStage src={src} ratio={ratio} onConfirm={onConfirm} onCancel={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function CropStage({ src, ratio, onConfirm, onCancel }: Omit<CropDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect = fit(ratio, area.w, area.h);
  // 框按原图的比例记，舞台大小变了也对得上；一开始是整张图
  const [rel, setRel] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [pick, setPick] = useState('free');
  const frame: CropRect = { x: rect.x + rel.x * rect.w, y: rect.y + rel.y * rect.h, w: rel.w * rect.w, h: rel.h * rect.h };
  const setFrame = (f: CropRect) => setRel({ x: (f.x - rect.x) / rect.w, y: (f.y - rect.y) / rect.h, w: f.w / rect.w, h: f.h / rect.h });

  const pickRatio = (v: string) => {
    setPick(v);
    if (v === 'free') return;
    // 框的宽高比 = v，在原图里取最大的、居中
    const r = ratioNum(v);
    const w = r >= ratio ? 1 : r / ratio;
    const h = r >= ratio ? ratio / r : 1;
    setRel({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };
  const current = EXPAND_RATIOS.find((o) => o.value === pick);

  return (
    <>
      <div ref={areaRef} className="app-stage">
        {area.w > 0 && (
          <>
            <img className="app-stage__img" src={src} alt="" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
            <CropHandles
              aria-label="裁剪框"
              value={frame}
              onValueChange={setFrame}
              ratio={pick === 'free' ? null : ratioNum(pick)}
              bounds={rect}
              min={16}
              onConfirm={() => onConfirm(rel)}
              onCancel={onCancel}
            />
          </>
        )}
      </div>
      <div className="app-stage__bar">
        <div className="app-stage__bar-left">
          <Dropdown
            haspopup="listbox"
            placement="top-start"
            trigger={
              <Select variant="plain" leftIcon={current?.icon} aria-label="裁剪比例">
                {current?.label}
              </Select>
            }
          >
            <Menu role="listbox" aria-label="裁剪比例">
              {EXPAND_RATIOS.map((o) => (
                <MenuItem key={o.value} icon={o.icon} selected={o.value === pick} onClick={() => pickRatio(o.value as string)}>
                  {o.label}
                </MenuItem>
              ))}
            </Menu>
          </Dropdown>
        </div>
        <div className="app-stage__bar-right">
          <Button variant="secondary-muted" onClick={onCancel}>
            取消
          </Button>
          <Button variant="primary" onClick={() => onConfirm(rel)}>
            确认
          </Button>
        </div>
      </div>
    </>
  );
}
