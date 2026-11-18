import { useMemo, useState } from 'react';
import { Avatar, Button, Dialog, EmptyState, ExploreCard, Input } from '@kivi';
import { MiniCanvas } from '../../../docs/business/canvas.demos';
import { flowsOf, FLOW_CATEGORIES, type Flow } from '../../data/catalog';
import { useDebounced } from '../../hooks/useDebounced';
import { usePaged, type MoreRef } from '../../hooks/usePaged';
import { useLastShown } from '../../parts/media-viewer';
import { CardSkeleton, CategoryTabs } from './shared';

/*
  探索 · 创作精选、工作流：同一张卡（ExploreCard）。点卡片出画布预览，「克隆」进画布页（需求「创作精选」「公共工作流」）。
  只匹配标题或描述；滚到底先出骨架再加载下一屏。
*/

/** 一屏 12 条（4 列 3 行） */
const FLOW_PAGE = 12;

export function FlowGallery({ kind, onClone, moreRef, initialKeyword = '' }: { kind: 'featured' | 'workflow'; onClone: () => void; moreRef: MoreRef; initialKeyword?: string }) {
  const noun = kind === 'featured' ? '案例' : '工作流';
  const items = useMemo(() => flowsOf(kind), [kind]);
  const [category, setCategory] = useState('all');
  const [keyword, setKeyword] = useState(initialKeyword);
  const k = useDebounced(keyword.trim());
  const [view, setView] = useState<Flow | null>(null);
  const shownView = useLastShown(view);
  // 只匹配标题或描述（需求）
  const list = items.filter((f) => (category === 'all' || f.category === category) && (!k || f.name.includes(k) || f.description.includes(k)));
  const { count, loading } = usePaged(list.length, FLOW_PAGE, `${category}|${k}`, moreRef);

  return (
    <>
      <div className="tpl-as__filters">
        <CategoryTabs label={`${noun}分类`} value={category} options={FLOW_CATEGORIES} onChange={setCategory} />
        <Input leftIcon="Search" clearable placeholder={`搜索${noun}`} aria-label={`搜索${noun}`} className="tpl-as__search" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <EmptyState size={160} title={`没有找到相关${noun}`} className="tpl-as__empty" />
      ) : (
        <div className="tpl-ex__grid">
          {list.slice(0, count).map((f) => (
            <ExploreCard key={f.id} name={f.name} cover={f.cover} video={f.video} showTime author={f.author} onOpen={() => setView(f)} />
          ))}
          {loading && Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      )}
      {/* 画布预览：标题、作者、画布快照（只读小画布：能看节点、缩放、适配画布），关闭和「克隆」。克隆进画布页（需求「创作精选」「公共工作流」） */}
      <Dialog
        size={1200}
        title={shownView?.name}
        description={
          shownView && (
            <span className="tpl-ex__detail-author">
              <Avatar name={shownView.author.name} src={shownView.author.avatar} size={24} />
              {shownView.author.name}
            </span>
          )
        }
        open={view !== null}
        onOpenChange={(v) => !v && setView(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setView(null)}>
              关闭
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setView(null);
                onClone();
              }}
            >
              克隆
            </Button>
          </>
        }
      >
        {shownView && <MiniCanvas chrome={false} fake={false} viewBar phases={{ video: 'done' }} className="tpl-ex__canvas-preview" />}
      </Dialog>
    </>
  );
}

