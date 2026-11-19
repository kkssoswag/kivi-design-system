import { Button, ButtonGroup, DropOverlay, EmptyState, Icon, IconButton, UPLOAD_SPECS, VideoPlayer, toast } from '@kivi';
import { rejectMessage, useFileDrop } from '@kivi/hooks';
import { StageUploading } from './stage-parts';
import type { Source } from './types';

/*
  视频拼接的舞台：并排两个上传位（视频1、视频2），各自点了选文件、也能拖进对应的位；传完是播放器，右上角能删。
  两个位一样大（11-18 用户嫌铺满坑太大）：固定 3:4 竖卡（照线上），在各占一半的坑里放下、再缩到 80%，并排居中。
  传了视频位也不变大小，视频在里面按比例放下（11-19 用户定，原来跟着视频1 的比例变）。
  工具一打开就露出两个位（照线上，11-18 用户定），不先出工具介绍；中间一个「+」表示前后接上
*/

/** 两个位之间的间距（中间放 32 的「+」，两边各留 8）、比放满时再缩多少 */
const GAP = 48;
const SCALE = 0.8;
/** 位的比例，固定 */
const SLOT_RATIO = 3 / 4;

interface SlotProps {
  title: string;
  source: Source | null;
  uploading?: boolean;
  /** 点「上传视频」 */
  onPick?: () => void;
  /** 拖进来一个文件 */
  onFile?: (file: File) => void;
  /** 右上角删除；不传就没有（创作页弹窗里视频1是带进来的，不能删） */
  onRemove?: () => void;
  /** 位的大小（StitchStage 算好传进来） */
  size?: { width: number; height: number };
}

function Slot({ title, source, uploading, onPick, onFile, onRemove, size }: SlotProps) {
  const { dragging, rejected, bind } = useFileDrop({
    accept: 'video/*',
    multiple: false,
    disabled: !onFile,
    onFiles: ([f]) => onFile?.(f),
    // 和页面上传同一句（类型不对：请上传 mp4）
    onReject: (_, reason) => toast.error(rejectMessage(reason, UPLOAD_SPECS.tools.video)),
  });
  return (
    <div className="tpl-at__slot" aria-label={title} style={size} {...bind}>
      {uploading ? (
        <StageUploading />
      ) : source ? (
        <>
          <VideoPlayer key={source.id} variant="preview" src={source.src} fit="contain" loop />
          {onRemove && (
            <ButtonGroup className="tpl-at__slot-remove">
              <IconButton icon="Delete" label={`删除${title}`} onClick={onRemove} />
            </ButtonGroup>
          )}
        </>
      ) : (
        <div className="tpl-at__state">
          <EmptyState
            size={96}
            icon="Video"
            title={`上传${title}`}
            description="MP4 视频不超过 20M"
            action={
              onPick && (
                <Button variant="secondary-muted" onClick={onPick}>
                  上传视频
                </Button>
              )
            }
          />
        </div>
      )}
      <DropOverlay active={dragging} rejected={rejected} />
    </div>
  );
}

export interface StitchStageProps {
  first: SlotProps;
  second: SlotProps;
  /** 坑的大小 */
  area: { w: number; h: number };
}

export function StitchStage({ first, second, area }: StitchStageProps) {
  const ratio = SLOT_RATIO;
  const halfW = Math.max(0, (area.w - GAP) / 2);
  const fit = Math.min(halfW / ratio, area.h);
  const size = { width: Math.round(fit * ratio * SCALE), height: Math.round(fit * SCALE) };
  return (
    <div className="tpl-at__slots">
      <Slot {...first} size={size} />
      <span className="tpl-at__slots-join" aria-hidden>
        <Icon name="Add" size={16} />
      </span>
      <Slot {...second} size={size} />
    </div>
  );
}
