import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, GenerateButton, Input, Loading, ScrollArea, toast } from '@kivi';
import './node-tools.css';

/*
  编辑文字（照线上 image-text-plugin、doc/infinite-canvas/image-text-editing.md）：识别图里的文字（识别中），
  识别出来列成一排，改了哪几处提交哪几处；一处都没改点提交提示「请修改文字后再提交」。
  线上是原地弹层 + 工具节点面板，这里是弹窗；识别是假的，固定识别出三处文字，框的位置是示意。
*/

interface Found {
  text: string;
  /** 相对图的框，0–1 */
  box: { x: number; y: number; w: number; h: number };
}

const FOUND: Found[] = [
  { text: 'KIVI', box: { x: 0.08, y: 0.1, w: 0.26, h: 0.1 } },
  { text: '猕猴桃新品上市', box: { x: 0.08, y: 0.44, w: 0.6, h: 0.1 } },
  { text: '限时优惠', box: { x: 0.08, y: 0.78, w: 0.34, h: 0.08 } },
];

/** 识别多久（毫秒） */
const SCAN_MS = 1200;
/** 编辑文字一次消耗（和智能编辑一样，示例单价） */
export const TEXT_EDIT_COST = 8;

export interface TextEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  /** 原图宽 / 高 */
  ratio: number;
  /** 提交：改了几处，每处原文和新文 */
  /** 提交改了的几处。返回请求的 Promise 时，等它的时候生成按钮转圈 */
  onSubmit: (items: { original: string; replacement: string }[]) => void | Promise<unknown>;
}

export function TextEditDialog({ open, onOpenChange, src, ratio, onSubmit }: TextEditDialogProps) {
  return (
    <Dialog size={800} className="app-stage-dlg" title="编辑文字" open={open} onOpenChange={onOpenChange}>
      {open && <TextEditBody src={src} ratio={ratio} onSubmit={onSubmit} />}
    </Dialog>
  );
}

function TextEditBody({ src, ratio, onSubmit }: Pick<TextEditDialogProps, 'src' | 'ratio' | 'onSubmit'>) {
  const [scanning, setScanning] = useState(true);
  const [values, setValues] = useState(() => FOUND.map((f) => f.text));
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setScanning(false), SCAN_MS);
    return () => window.clearTimeout(t);
  }, []);

  // 图在舞台里放多大：按比例放进去
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = Math.min(box.w, box.h * ratio);
  const h = w / ratio;

  const changed = FOUND.map((f, i) => ({ original: f.text, replacement: values[i].trim() })).filter((x) => x.original.trim() !== x.replacement);
  const submit = () => {
    // 照线上：一处都没改，提示后不提交
    if (!changed.length) return void toast.info('请修改文字后再提交');
    return onSubmit(changed);
  };

  return (
    <div className="app-textedit">
      <div ref={stageRef} className="app-textedit__stage">
        {w > 0 && (
          <div className="app-textedit__frame" style={{ width: w, height: h }}>
            <img src={src} alt="" />
            {!scanning &&
              FOUND.map((f, i) => (
                <div
                  key={f.text}
                  className="app-textedit__box"
                  data-active={active === i || undefined}
                  style={{ left: `${f.box.x * 100}%`, top: `${f.box.y * 100}%`, width: `${f.box.w * 100}%`, height: `${f.box.h * 100}%` }}
                />
              ))}
          </div>
        )}
      </div>
      <div className="app-textedit__side">
        {scanning ? (
          <div className="app-textedit__scan" role="status">
            <Loading size={16} />
            识别中
          </div>
        ) : (
          <ScrollArea className="app-textedit__scroll" style={{ flex: 1, minHeight: 0 }}>
            <div className="app-textedit__list">
              {FOUND.map((f, i) => (
                <div key={f.text} className="app-textedit__item">
                  <span className="app-textedit__label">原文：{f.text}</span>
                  <Input
                    aria-label={`替换「${f.text}」`}
                    value={values[i]}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        <Button variant="ghost" disabled={scanning || !changed.length} onClick={() => setValues(FOUND.map((f) => f.text))}>
          恢复原文
        </Button>
        <GenerateButton cost={TEXT_EDIT_COST} disabled={scanning} onClick={submit} style={{ alignSelf: 'flex-end' }} />
      </div>
    </div>
  );
}
