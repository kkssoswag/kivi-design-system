import { GenPrompt, GenPromptRefs, IconButton, Tag, placeholderImageSrc, toast } from '@kivi';
import { MediaViewer, ViewerAuthor, ViewerSection, useLastShown } from '../../parts/media-viewer';
import { toolOf } from '../../data/tools';
import type { HistoryItem } from './history';

/*
  看大图：全站共用的查看大图（parts/media-viewer.tsx），信息栏写用了哪个工具、原图。
*/

export function ToolsViewer({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  const shown = useLastShown(item);
  return (
    <MediaViewer
      media={item && { type: item.media, src: item.src, poster: item.poster, alt: item.label }}
      onClose={onClose}
      head={<ViewerAuthor name="KIVI" avatar={placeholderImageSrc('ip-peek', '1:1')} date="今天 14:32" />}
      actions={<IconButton icon="Download" label="下载" variant="secondary" size={36} onClick={() => toast.success('已开始下载')} />}
    >
      {shown && (
        <ViewerSection title="参数">
          <GenPrompt>
            <Tag icon={toolOf(shown.tool).icon}>{shown.label}</Tag>
            <GenPromptRefs
              label={shown.media === 'image' ? '原图' : '原视频'}
              items={[{ type: shown.media, src: shown.media === 'image' ? shown.origin : shown.poster }]}
            />
          </GenPrompt>
        </ViewerSection>
      )}
    </MediaViewer>
  );
}
