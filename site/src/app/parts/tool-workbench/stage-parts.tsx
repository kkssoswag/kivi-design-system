import { Loading } from '@kivi';

/*
  舞台上的状态：只剩视频上传中。任务不锁舞台（11-19 用户定），生成中、失败都只在页面的历史里，舞台上不出。
*/

/** 视频上传中（图片不出） */
export function StageUploading() {
  return (
    <div className="tpl-at__state">
      <Loading size={40}>视频上传中...</Loading>
    </div>
  );
}
