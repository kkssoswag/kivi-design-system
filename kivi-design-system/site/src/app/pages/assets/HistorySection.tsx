import { Fragment, useMemo, useState } from 'react';
import {
  Button,
  DateRangeFilter,
  Dropdown,
  EmptyState,
  GenPrompt,
  IconButton,
  Input,
  Menu,
  MenuItem,
  ResultTile,
  Select,
  TabItem,
  Tabs,
  Tag,
  placeholderImageSrc,
  toast,
  type DateRange,
  type SelectOption,
} from '@kivi';
import { setCollected } from '../../data/assets';
import { byId, useDB } from '../../data/db';
import type { Asset } from '../../data/types';
import { attempt } from '../../flows/errors';
import { MediaViewer, ViewerAuthor, ViewerSection, useLastShown } from '../../parts/media-viewer';

/*
  资产页 · 生成历史：全部生成结果（会话、工具、画布来的，上传的不算），按今天 / 昨天 / 更早分组。
  筛选条（来源、类型、时间、收藏、搜索）滚动时吸顶；结果格悬停出收藏；点图用全站查看大图。
*/

const SOURCE_LABEL: Record<string, string> = { create: '会话', tools: '工具', canvas: '画布' };
const SOURCE_OPTIONS: SelectOption[] = [{ value: 'all', label: '全部' }, ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))];
const GROUPS = ['今天', '昨天', '更早'];
const DAY = 24 * 3_600_000;

const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);
/** 属于哪一组：今天 / 昨天 / 更早 */
const groupOf = (createdAt: number) => {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(createdAt)) / DAY);
  return GROUPS[Math.min(Math.max(days, 0), 2)];
};
const timeOf = (t: number) => new Date(t).toTimeString().slice(0, 5);

/** 生成历史的一格：结果格（悬停出收藏，收藏了留一颗星；视频悬停就播，左下是播放器自己的时长）。不挂类型、来源标签，下面不带名字和时间 */
function HistoryCard({ item, onCollect, onOpen }: { item: Asset; onCollect: (v: boolean) => void; onOpen: () => void }) {
  const video = item.media === 'video';
  return (
    <ResultTile
      // 点图看大图（视频点右下「预览」），点的是格子里的按钮就不打开
      style={{ cursor: video ? undefined : 'zoom-in' }}
      onClick={video ? undefined : (e) => !(e.target as HTMLElement).closest('button') && onOpen()}
      onPreview={video ? onOpen : undefined}
      title={item.name}
      type={video ? 'video' : undefined}
      src={item.src}
      poster={video ? item.poster : undefined}
      collect
      collected={item.collected}
      onCollectedChange={onCollect}
    />
  );
}

export function HistorySection() {
  const assets = useDB((s) => s.assets);
  const [source, setSource] = useState<string | null>('all');
  const [type, setType] = useState('all');
  const [onlyCollected, setOnlyCollected] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  // 看大图：全站共用的查看大图（media-viewer.tsx），信息栏写名字、来源和时间
  const [view, setView] = useState<Asset | null>(null);
  const shownView = useLastShown(view);

  const k = keyword.trim();
  // 历史：生成出来的，新的在前
  const history = useMemo(() => assets.filter((a) => a.source !== 'upload').sort((a, b) => b.createdAt - a.createdAt), [assets]);
  const list = useMemo(
    () =>
      history.filter((h) => {
        const day = startOfDay(h.createdAt);
        return (
          (source === 'all' || h.source === source) &&
          (type === 'all' || h.media === type) &&
          (!onlyCollected || h.collected) &&
          (!range.start || day >= range.start.getTime()) &&
          (!range.end || day <= range.end.getTime()) &&
          (!k || (h.name ?? '').includes(k))
        );
      }),
    [history, source, type, onlyCollected, range, k],
  );
  const reset = () => {
    setSource('all');
    setType('all');
    setOnlyCollected(false);
    setKeyword('');
    setRange({ start: null, end: null });
  };
  const collect = (ids: string[], v: boolean) => void attempt(() => setCollected(ids, v));
  // 查看大图里的收藏状态跟着数据走
  const viewCollected = shownView ? (byId(assets, shownView.id)?.collected ?? shownView.collected) : false;

  return (
    <Fragment>
      <section className="tpl-as__section">
        <header className="tpl-as__head">
          <h2>生成历史</h2>
        </header>
        {/* 筛选条：滚动时吸顶 */}
        <div className="tpl-as__filters">
          <span className="tpl-as__label">来源</span>
          <Dropdown
            haspopup="listbox"
            trigger={
              <Select variant="plain" leftIcon={SOURCE_OPTIONS.find((o) => o.value === source)?.icon} aria-label="生成历史来源">
                {SOURCE_OPTIONS.find((o) => o.value === source)?.label}
              </Select>
            }
          >
            <Menu role="listbox" aria-label="生成历史来源">
              {SOURCE_OPTIONS.map((o) => (
                <MenuItem key={o.value} icon={o.icon} selected={o.value === source} disabled={o.disabled} onClick={() => setSource(o.value)}>
                  {o.label}
                </MenuItem>
              ))}
            </Menu>
          </Dropdown>
          <span className="tpl-as__label">类型</span>
          <Tabs value={type} onChange={setType} aria-label="生成历史类型">
            <TabItem value="all">全部</TabItem>
            <TabItem value="image">图片</TabItem>
            <TabItem value="video">视频</TabItem>
          </Tabs>
          <span className="tpl-as__label">时间</span>
          <DateRangeFilter value={range} onChange={setRange} placeholder="全部" aria-label="生成历史时间" />
          {/* 收藏是开关，不是「类型」那组选项卡里的一项：和前面的筛选隔 16，不用分割线（11-18 用户定） */}
          <TabItem
            className="tpl-as__collect"
            icon={onlyCollected ? 'CollectSolid' : 'Collect'}
            selected={onlyCollected}
            role="checkbox"
            aria-selected={undefined}
            aria-checked={onlyCollected}
            data-collected={onlyCollected || undefined}
            onClick={() => setOnlyCollected(!onlyCollected)}
          >
            收藏
          </TabItem>
          <Input
            leftIcon="Search"
            clearable
            placeholder="搜索生成记录"
            aria-label="搜索生成记录"
            className="tpl-as__search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {list.length === 0 ? (
          <EmptyState
            type={onlyCollected ? 'favorite' : 'empty'}
            size={160}
            title={onlyCollected ? '暂无符合条件的收藏' : '没有找到相关生成记录'}
            action={
              <Button variant="secondary-muted" onClick={reset}>
                重置筛选
              </Button>
            }
            className="tpl-as__empty"
          />
        ) : (
          GROUPS.map((g) => {
            const items = list.filter((h) => groupOf(h.createdAt) === g);
            if (!items.length) return null;
            return (
              <section key={g} className="tpl-as__day" aria-label={`${g}的生成记录`}>
                <header>
                  <h3>{g}</h3>
                </header>
                <div className="tpl-as__grid">
                  {items.map((h) => (
                    <HistoryCard key={h.id} item={h} onCollect={(v) => collect([h.id], v)} onOpen={() => setView(h)} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </section>

      <MediaViewer
        media={view && { type: view.media === 'video' ? 'video' : 'image', src: view.src, poster: view.media === 'video' ? view.poster : undefined, alt: view.name ?? '' }}
        onClose={() => setView(null)}
        head={shownView && <ViewerAuthor name="KIVI" avatar={placeholderImageSrc('ip-peek', '1:1')} date={`${groupOf(shownView.createdAt)} ${timeOf(shownView.createdAt)}`} />}
        actions={
          shownView && (
            <>
              <IconButton icon="Download" label="下载" variant="secondary" size={36} onClick={() => toast.info('已开始下载')} />
              <IconButton
                icon={viewCollected ? 'CollectSolid' : 'Collect'}
                label={viewCollected ? '取消收藏' : '收藏'}
                variant="secondary"
                size={36}
                data-collected={viewCollected || undefined}
                onClick={() => collect([shownView.id], !viewCollected)}
              />
            </>
          )
        }
      >
        {shownView && (
          <ViewerSection title="来源">
            <GenPrompt>
              <Tag icon={shownView.media === 'video' ? 'VideoGeneration' : 'ImageGeneration'}>{shownView.name}</Tag>
              <Tag>{SOURCE_LABEL[shownView.source]}</Tag>
            </GenPrompt>
          </ViewerSection>
        )}
      </MediaViewer>
    </Fragment>
  );
}
