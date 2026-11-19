import { Button, EmptyState, GENERATION_FAILED_TITLE, Loading, ResultTile, Tag, type CropRect } from '@kivi';
import { countdownLabel, useNow } from '../../data/tasks';
import type { Media } from '../../data/tools';
import type { Task } from '../../data/types';

/*
  舞台上的几种状态：生成中（原素材 + 遮罩 + 模糊 + 点阵，中间写倒计时）、失败（重试 / 取消）、视频上传中。
*/

/** 生成中：和 ResultTile 生成中带原素材同一套，盖在图的位置上，中间写「59s 生成中」 */
export function StageGenerating({ media, src, poster, box, task }: { media: Media; src: string; poster?: string; box: CropRect; task: Task }) {
  const now = useNow();
  return (
    <>
      <ResultTile
        className="tpl-at__gen"
        type={media === 'video' ? 'video' : 'image'}
        status="generating"
        src={src}
        poster={poster}
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      />
      <span className="tpl-at__gen-label" style={{ left: box.x + box.w / 2, top: box.y + box.h / 2 }}>
        <Tag variant="on-media">{countdownLabel(task, now)}</Tag>
      </span>
    </>
  );
}

/** 失败：舞台上只剩 EmptyState 生成失败 · 96，下面「重试」（原参数再提交）「取消」（回到原图） */
export function StageFailed({ onRetry, onCancel }: { onRetry: () => void; onCancel: () => void }) {
  return (
    <EmptyState
      className="tpl-at__state"
      type="failed"
      size={96}
      title={GENERATION_FAILED_TITLE}
      action={
        <div className="tpl-at__state-actions">
          <Button variant="secondary-muted" onClick={onRetry}>
            重试
          </Button>
          <Button variant="secondary-muted" onClick={onCancel}>
            取消
          </Button>
        </div>
      }
    />
  );
}

/** 视频上传中（图片不出） */
export function StageUploading() {
  return (
    <div className="tpl-at__state">
      <Loading size={40}>视频上传中...</Loading>
    </div>
  );
}
