import { useMemo, useState, type MouseEvent } from 'react';
import {
  AttachmentStrip,
  Button,
  Divider,
  Dropdown,
  EmptyState,
  GenPrompt,
  IconButton,
  Input,
  Masonry,
  Menu,
  MenuItem,
  MenuLabel,
  Select,
  Skeleton,
  TabItem,
  Tag,
  WorkCard,
  toast,
  type MasonryColumns,
} from '@kivi';
import { CATS, DISCOVER_CATEGORIES, RATIO, WORKS, type Work } from '../../data/catalog';
import { toggleFavorite, useFavorites } from '../../data/favorites';
import { attempt } from '../../flows/errors';
import { useDebounced } from '../../hooks/useDebounced';
import { usePaged, type MoreRef } from '../../hooks/usePaged';
import { MediaViewer, ViewerAuthor, ViewerSection, useLastShown } from '../../parts/media-viewer';
import { CopyPrompt } from '../../parts/asset-info';
import { CategoryTabs } from './shared';

/*
  探索 · 发现：瀑布流，点作品铺满窗口看详情（照线上 CardDetailModal），右键出菜单。
  第一行是大类、小类筛选、我收藏的、搜索（需求「发现页」）；搜索停 0.5 秒再搜，滚到底出骨架再加载下一屏。
  收藏存在 db.favorites；点赞只是本页状态。
*/

const WORK_PAGE = 20;
// 最多 4 列（11-10 用户定：前期作品不多，列少一屏要的作品少、卡也大；1600 宽一张约 400，和即梦 1920 屏、LibTV 一样）
const COLUMNS: MasonryColumns = { default: 4, 1100: 3, 700: 2, 500: 1 };

export function Discover({ moreRef, initialKeyword = '' }: { moreRef: MoreRef; initialKeyword?: string }) {
  const [category, setCategory] = useState('all');
  const [subs, setSubs] = useState<string[]>([]);
  const [onlyCollected, setOnlyCollected] = useState(false);
  const [keyword, setKeyword] = useState(initialKeyword);
  const k = useDebounced(keyword.trim());
  // 收藏在 db.favorites，先变后请求，失败退回
  const collected = useFavorites();
  const [liked, setLiked] = useState<string[]>(['w4']);
  const [detail, setDetail] = useState<Work | null>(null);
  const shownDetail = useLastShown(detail);
  const [menu, setMenu] = useState<{ x: number; y: number; work: Work } | null>(null);

  const list = useMemo(
    () =>
      WORKS.filter(
        (w) =>
          (category === 'all' || w.category === category) &&
          (!subs.length || subs.includes(w.sub)) &&
          (!onlyCollected || collected.includes(w.id)) &&
          (!k || w.prompt.includes(k) || w.author.name.includes(k) || w.model.includes(k)),
      ),
    // 只看收藏时，取消收藏会立刻从列表里拿掉
    [category, subs, onlyCollected, collected, k],
  );
  const { count, loading, done } = usePaged(list.length, WORK_PAGE, `${category}|${subs.join()}|${onlyCollected}|${k}`, moreRef);
  const shown = list.slice(0, count);
  const skeletons = loading ? 8 : 0;

  const toggle = (set: typeof setLiked, id: string, on: boolean) => set((all) => (on ? [...all, id] : all.filter((x) => x !== id)));
  const collect = (id: string, on: boolean) => void attempt(() => toggleFavorite(id, on));
  const likesOf = (w: Work) => w.likes + (liked.includes(w.id) ? 1 : 0);
  // 小类：当前大类下的；「全部」时按大类分组列出
  const subGroups = category === 'all' ? CATS : [category];

  return (
    <>
      {/* 第一行：大类、小类筛选、我收藏的、搜索（需求「发现页」：去掉最新 / 热门，一套内容流） */}
      <div className="tpl-as__filters">
        <CategoryTabs
          label="素材分类"
          value={category}
          options={CATS}
          onChange={(v) => {
            setCategory(v);
            setSubs([]);
          }}
        />
        <Divider orientation="vertical" />
        <Dropdown
          haspopup="menu"
          closeOnSelect={false}
          trigger={
            <Select variant="plain" leftIcon="Configuration" aria-label="筛选小类">
              {subs.length ? `筛选 · ${subs.length}` : '筛选'}
            </Select>
          }
        >
          <Menu aria-label="筛选小类">
            {subGroups.map((c, gi) => (
              <div key={c} role="group" aria-label={c}>
                {gi > 0 && <Divider />}
                {category === 'all' && <MenuLabel>{c}</MenuLabel>}
                {DISCOVER_CATEGORIES[c].map((s) => (
                  <MenuItem key={s} checked={subs.includes(s)} onClick={() => setSubs((all) => (all.includes(s) ? all.filter((x) => x !== s) : [...all, s]))}>
                    {s}
                  </MenuItem>
                ))}
              </div>
            ))}
          </Menu>
        </Dropdown>
        <TabItem
          icon={onlyCollected ? 'CollectSolid' : 'Collect'}
          selected={onlyCollected}
          role="checkbox"
          aria-selected={undefined}
          aria-checked={onlyCollected}
          data-collected={onlyCollected || undefined}
          onClick={() => setOnlyCollected(!onlyCollected)}
        >
          我收藏的
        </TabItem>
        <Input leftIcon="Search" clearable placeholder="搜索提示词、模型、作者" aria-label="搜索作品" className="tpl-as__search" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>

      {list.length === 0 ? (
        onlyCollected && category === 'all' && !subs.length && !k ? (
          <EmptyState type="favorite" size={160} title="暂无收藏" description="在作品上点收藏，就会出现在这里" className="tpl-as__empty" />
        ) : (
          <EmptyState size={160} title="没有搜索到符合条件的内容" className="tpl-as__empty" />
        )
      ) : (
        <Masonry columns={COLUMNS} gap={2} ratios={[...shown.map((w) => RATIO[w.ratio]), ...Array.from({ length: skeletons }, (_, i) => (i % 2 ? 1 : 3 / 4))]}>
          {shown.map((w) => (
            <WorkCard
              key={w.id}
              type={w.video ? 'video' : 'image'}
              src={w.src}
              poster={w.poster}
              ratio={w.ratio}
              title={w.prompt}
              author={w.author}
              likes={likesOf(w)}
              liked={liked.includes(w.id)}
              onLikedChange={(v) => toggle(setLiked, w.id, v)}
              collected={collected.includes(w.id)}
              onCollectedChange={(v) => collect(w.id, v)}
              onDownload={() => toast.info('已开始下载')}
              onOpen={() => setDetail(w)}
              onContextMenu={(e: MouseEvent) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, work: w });
              }}
            />
          ))}
          {Array.from({ length: skeletons }, (_, i) => (
            <Skeleton key={`s${i}`} style={{ width: '100%', aspectRatio: i % 2 ? '1 / 1' : '3 / 4' }} />
          ))}
        </Masonry>
      )}
      {!loading && done && shown.length > 0 && <p className="tpl-ex__end">没有更多内容了</p>}

      {/* 右键菜单：复制、下载、收藏、添加到参考图、添加到文件夹（需求「发现页」）。只能看，点了出一条提示 */}
      <Dropdown anchorPoint={menu ?? undefined} open={menu !== null} onOpenChange={(v) => !v && setMenu(null)}>
        <Menu aria-label="作品操作">
          <MenuItem icon="Copy" onClick={() => toast.success('已复制')}>
            复制
          </MenuItem>
          <MenuItem icon="Download" onClick={() => toast.info('已开始下载')}>
            下载
          </MenuItem>
          {menu && (
            <MenuItem
              icon={collected.includes(menu.work.id) ? 'CollectSolid' : 'Collect'}
              data-collected={collected.includes(menu.work.id) || undefined}
              onClick={() => collect(menu.work.id, !collected.includes(menu.work.id))}
            >
              {collected.includes(menu.work.id) ? '取消收藏' : '收藏'}
            </MenuItem>
          )}
          <Divider />
          <MenuItem icon="ImagePlus" onClick={() => toast.success('已添加到参考图')}>
            添加到参考图
          </MenuItem>
          <MenuItem icon="AddFolder" onClick={() => toast.success('已添加到文件夹')}>
            添加到文件夹
          </MenuItem>
        </Menu>
      </Dropdown>

      {/* 详情：全站共用的查看大图（media-viewer.tsx）。头是作者和下载、收藏，内容是提示词和参数、参考图，最下面点赞。没有一键同款（11-09 用户定） */}
      <MediaViewer
        media={detail && { type: detail.video ? 'video' : 'image', src: detail.src, poster: detail.poster, alt: detail.prompt }}
        onClose={() => setDetail(null)}
        head={shownDetail && <ViewerAuthor name={shownDetail.author.name} avatar={shownDetail.author.avatar} date={shownDetail.date} />}
        actions={
          shownDetail && (
            <>
              <IconButton icon="Download" label="下载" variant="secondary" size={36} onClick={() => toast.info('已开始下载')} />
              <IconButton
                icon={collected.includes(shownDetail.id) ? 'CollectSolid' : 'Collect'}
                label={collected.includes(shownDetail.id) ? '取消收藏' : '收藏'}
                variant="secondary"
                size={36}
                data-collected={collected.includes(shownDetail.id) || undefined}
                onClick={() => collect(shownDetail.id, !collected.includes(shownDetail.id))}
              />
            </>
          )
        }
        footer={
          shownDetail && (
            <Button
              size={36}
              variant="secondary"
              leftIcon={liked.includes(shownDetail.id) ? 'ThumbsUpFill' : 'ThumbsUp'}
              onClick={() => toggle(setLiked, shownDetail.id, !liked.includes(shownDetail.id))}
            >
              {likesOf(shownDetail)}
            </Button>
          )
        }
      >
        {shownDetail && (
          <>
            <ViewerSection title="提示词" action={<CopyPrompt text={shownDetail.prompt} />}>
              <p className="tpl-viewer__prompt">{shownDetail.prompt}</p>
            </ViewerSection>
            <ViewerSection title="参数">
              <GenPrompt>
                <Tag>{shownDetail.video ? '视频生成' : '图片生成'}</Tag>
                <Tag>{shownDetail.model}</Tag>
                <Tag>{shownDetail.ratio}</Tag>
              </GenPrompt>
            </ViewerSection>
            {/* 参考图：只放参考图（线上还有图生图、控制图、Lora 等，这里不做），多张放在一个容器里，悬停看大图 */}
            {shownDetail.refs.length > 0 && (
              <ViewerSection title="参考图">
                <div className="tpl-viewer__refs">
                  <AttachmentStrip items={shownDetail.refs} />
                </div>
              </ViewerSection>
            )}
          </>
        )}
      </MediaViewer>
    </>
  );
}
