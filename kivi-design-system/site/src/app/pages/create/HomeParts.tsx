import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, IconButton, Input, ScrollArea, placeholderImageSrc } from '@kivi';
import { BANNERS, type Banner } from '../../data/banners';

/*
  创作首页的小块：广场标题行（HomeHead，右边是搜索框或「查看全部」）和最近更新（运营位 Banner 横排）。搬自原来的 create-home.tsx，没改样子。
*/

/** 广场标题行右边的搜索框：回车带着关键词去探索页对应选项卡，在那边搜（11-16 用户定） */
function HomeSearch({ placeholder, onSearch }: { placeholder: string; onSearch: (keyword: string) => void }) {
  const [keyword, setKeyword] = useState('');
  return (
    <Input
      leftIcon="Search"
      clearable
      placeholder={placeholder}
      aria-label={placeholder}
      className="tpl-home__search"
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSearch(keyword.trim());
      }}
    />
  );
}

export function HomeHead({ title, onMore, search, children }: { title?: string; onMore: () => void; search?: { placeholder: string; onSearch: (keyword: string) => void }; children?: ReactNode }) {
  return (
    <header className="tpl-home__head">
      {title ? <h2>{title}</h2> : children}
      {search ? (
        <HomeSearch {...search} />
      ) : (
        <Button size={32} variant="ghost-muted" rightIcon="RightArrowSmall" onClick={onMore}>
          查看全部
        </Button>
      )}
    </header>
  );
}

/** 最近更新：横排 Banner，一排 4 张，放不下左右翻（翻一屏），到头那边的按钮禁用；都放得下就不出按钮 */
export function RecentUpdates() {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [open, setOpen] = useState<Banner | null>(null);

  useLayoutEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, []);

  const page = (dir: number) => {
    const el = rail.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section className="tpl-home__section" aria-label="最近更新">
      <header className="tpl-home__head">
        <h2>最近更新</h2>
        {!(edges.start && edges.end) && (
          <span className="tpl-home__pager">
            <IconButton icon="LeftArrowSmall" label="上一组" variant="ghost-muted" size={28} disabled={edges.start} onClick={() => page(-1)} />
            <IconButton icon="RightArrowSmall" label="下一组" variant="ghost-muted" size={28} disabled={edges.end} onClick={() => page(1)} />
          </span>
        )}
      </header>
      <ScrollArea orientation="horizontal" className="tpl-home__rail" viewportRef={rail} viewportProps={{ className: 'tpl-home__rail-viewport' }}>
        <div className="tpl-home__rail-track">
          {BANNERS.map((b) => (
            <button key={b.title} type="button" className="tpl-home__banner" aria-label={`查看：${b.title}`} onClick={() => setOpen(b)}>
              <img src={placeholderImageSrc(b.image, '16:9')} alt="" draggable={false} />
            </button>
          ))}
        </div>
      </ScrollArea>
      <Dialog size={800} title={open?.title} open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        {open && <img className="tpl-home__banner-preview" src={placeholderImageSrc(open.image, '16:9')} alt={open.title} />}
      </Dialog>
    </section>
  );
}
