import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import {
  Button,
  CreateCard,
  Dialog,
  ExploreCard,
  IconButton,
  Input,
  Masonry,
  ProjectCard,
  PromptBox,
  ScrollArea,
  TabItem,
  Tabs,
  placeholderImageSrc,
  type PlaceholderImageName,
  WorkCard,
} from '@kivi';
import { RATIO, SKILLS, WORKS, flowsOf, type ExploreTab } from './explore.demos';
import { AgentComposer } from './composer';
import { SKILL_CATEGORIES, SKILL_ITEMS } from '../business/skill-data';
import { PixelBlast } from './pixel-blast';

type HomeMode = 'generate' | 'canvas';

/*
  创作首页（11-10，照用户的交互原型 kivi-prototype「创作页」：结构和交互照它，样子用组件库）。
  从上到下：标题、「生成 / 画布」切换、输入框、中间一块、广场。
  输入框两种模式各是各的、一样大一样的渐变底（11-10 用户定）：生成是主站提示词框（PromptBox），提交进对话页；画布是画布里 Agent 的输入框，发送新建画布。
  中间一块：生成是「最近更新」（运营位 Banner）；画布换成「最近项目」（新建画布 + 最近 4 个），不照原型放在输入框上面（11-10 用户定）。
  广场：生成是「发现」瀑布流；画布是创作精选 / 技能 / 工作流。切模式时中间一块和广场淡入（150ms ease-out）。
*/

const PICS: PlaceholderImageName[] = ['kivi-future', 'ip-gouache', 'kiwi-light', 'bunny-gouache', 'monstera-dots', 'ip-peek', 'ip-kiwi-pile', 'ip-future'];
const pic = (i: number) => placeholderImageSrc(PICS[i % PICS.length], '1:1');
const HOUR = 60 * 60_000;
/** 最近项目一排几格（新建画布 + 最近 4 个） */
const PROJECT_COLS = 5;

/** 最近项目：最近改过的 4 块画布（和侧栏画布历史、资产页「我的画布」同一批） */
const RECENT = [
  { id: 'c1', name: '深林', covers: [pic(4), pic(5), pic(6), pic(7)], updatedAt: Date.now() - 5 * 60_000 },
  { id: 'c2', name: '笑脸', covers: [pic(1), pic(2), pic(3)], updatedAt: Date.now() - 2 * HOUR },
  { id: 'c3', name: '短剧制作流程图', covers: [pic(6), pic(7), pic(0), pic(1)], updatedAt: Date.now() - 20 * HOUR },
  { id: 'c4', name: '新春海报', covers: [pic(2), pic(3)], updatedAt: Date.now() - 6 * 24 * HOUR },
];

/** 最近更新（运营位）：后台配置，只在生成模式。图是占位 */
const BANNERS: { title: string; image: PlaceholderImageName }[] = [
  { title: '精选作品 · 极繁未来', image: 'kivi-future' },
  { title: 'KIVI 新模型上线', image: 'ip-future' },
  { title: 'AI 创意设计大赛', image: 'kiwi-light' },
  { title: '创作者成长计划', image: 'ip-gouache' },
  { title: '节日海报征集', image: 'monstera-dots' },
];

const SQUARE_TABS: { value: Exclude<ExploreTab, 'discover'>; label: string }[] = [
  { value: 'featured', label: '创作精选' },
  { value: 'skill', label: '技能' },
  { value: 'workflow', label: '工作流' },
];
/** 首页的广场是探索页同一类内容的前几条 */
const HOME_COUNT = 8;
const FEATURED = flowsOf('featured').slice(0, HOME_COUNT);
const WORKFLOWS = flowsOf('workflow').slice(0, HOME_COUNT);
const HOME_SKILLS = SKILLS.slice(0, HOME_COUNT);
/** 发现放够两屏的量，多出来的截掉 */
const HOME_WORKS = WORKS.slice(0, 40);
/** 发现最高几屏（屏 = 首页滚动区的可见高度） */
const DISCOVER_SCREENS = 2;

/**
 * 输入框的流动底（11-11 用户要看效果，照即梦首页输入框里那层；扩到整屏试过，效果不好撤回了）：Paper Shaders 的 MeshGradient（Apache-2.0），参数照即梦深色那套（颜色换成品牌绿色调），
 * 记录在 page-notes/jimeng-motion-background.md。铺满输入框外壳、在内容下面，准备好了淡入；系统开了「减少动态效果」不出（底是原来的玻璃）
 */
const MOTION = {
  // Figma 没变量：着色器要的颜色。即梦是蓝青调（#151D21 #212A2E #263034 #0F161A），11-11 用户要带品牌绿：
  // 每个色的 OKLCH 色相换成品牌绿 #2BFF75 的（149°）、彩度 × 1.4；用户又要渐变弱一点：四色亮度往平均值收 25%（平均亮度不变）
  colors: ['#172018', '#202A21', '#242E25', '#121A13'],
  // 流动也弱一点（用户定）：即梦是 distortion 0.25、swirl 0.6、speed 1.4
  distortion: 0.2,
  swirl: 0.5,
  scale: 2.8,
  speed: 1.1,
  frame: 9062243.995, // 起始时间固定，每次打开画面一样
  grainMixer: 0,
  grainOverlay: 0,
};

/** 输入框流动底先关掉看看（11-16 用户：背景已经有像素云了），要恢复改成 true */
const SHOW_COMPOSER_MOTION = false;

function ComposerMotion() {
  const [reduce, setReduce] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // 挂上后下一帧再淡入，免得着色器还没画就露出黑块
  useEffect(() => {
    if (reduce) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [reduce]);
  if (reduce) return null;
  return (
    <div className="tpl-home__motion" data-ready={ready || undefined} aria-hidden>
      <MeshGradient className="tpl-home__motion-shader" {...MOTION} />
    </div>
  );
}

/**
 * 输入框后面的背景（11-16 用户定）：先照美图设计室做过一版点阵，后来换成 React Bits 的 Pixel Blast（像素云，白色、不要开场动画），
 * 代码在 pixel-blast.tsx。铺满页面宽，从顶到输入框下面 52，底部渐隐，跟着页面滚走
 */
const ATMOSPHERE_BELOW = 52;

function HomeAtmosphere({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const page = wrap?.parentElement;
    const target = targetRef.current;
    if (!wrap || !page || !target) return;
    const measure = () => setHeight(Math.max(1, target.getBoundingClientRect().bottom - page.getBoundingClientRect().top + ATMOSPHERE_BELOW));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(page);
    ro.observe(target);
    return () => ro.disconnect();
  }, [targetRef]);
  return (
    <div ref={wrapRef} className="tpl-home__atmosphere" style={height != null ? { height } : undefined} aria-hidden>
      {height != null && <PixelBlast className="tpl-home__pixel-blast" />}
    </div>
  );
}

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

function HomeHead({ title, onMore, search, children }: { title?: string; onMore: () => void; search?: { placeholder: string; onSearch: (keyword: string) => void }; children?: React.ReactNode }) {
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
function RecentUpdates() {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [open, setOpen] = useState<(typeof BANNERS)[number] | null>(null);

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

export function CreateHome({
  onSubmit,
  onOpenCanvas,
  onExplore,
  onAllCanvases,
}: {
  /** 生成：提交进对话页 */
  onSubmit: () => void;
  /** 画布：新建画布、打开最近项目、提交想法，都进画布页 */
  onOpenCanvas: () => void;
  /** 广场搜索框回车（带着关键词）、点作品：去探索页对应选项卡 */
  onExplore: (tab: ExploreTab, keyword?: string) => void;
  /** 最近项目「查看全部」：去我的资产看全部画布 */
  onAllCanvases: () => void;
}) {
  const [mode, setMode] = useState<HomeMode>('generate');
  // 外壳高度跟着显示的那套走：两套高度不一样时（画布里加了附件），切换时高度做动画，下面的内容跟着挪
  const generateBox = useRef<HTMLDivElement>(null);
  /** 点阵氛围画到输入框下面 52，要量它 */
  const composerRef = useRef<HTMLDivElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  // 画布那套至少和生成那套一样高：什么都没加时两套一样高，切换时外壳高度不动；画布里加了附件才比生成高
  const [generateHeight, setGenerateHeight] = useState<number>();
  useLayoutEffect(() => {
    const el = generateBox.current;
    if (!el) return;
    const measure = () => setGenerateHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [shellHeight, setShellHeight] = useState<number>();
  const [shellReady, setShellReady] = useState(false);
  useLayoutEffect(() => {
    const active = mode === 'generate' ? generateBox.current : canvasBox.current;
    if (!active) return;
    const measure = () => setShellHeight(active.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(active);
    return () => ro.disconnect();
  }, [mode]);
  // 第一次量完不做动画，之后才有
  useEffect(() => {
    if (shellHeight == null) return;
    const id = window.setTimeout(() => setShellReady(true), 50);
    return () => window.clearTimeout(id);
  }, [shellHeight != null]);
  const [square, setSquare] = useState<Exclude<ExploreTab, 'discover'>>('featured');
  // 一屏多高：量首页滚动区的可见高度，发现最高两屏
  const scrollRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<number>();
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setScreen(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  // 中间一块（最近更新 / 最近项目）和广场，按模式出内容
  const swapContent = (m: HomeMode) => (
    <>
      {m === 'generate' ? (
        <RecentUpdates />
      ) : (
        <section className="tpl-home__section" aria-label="最近项目">
          <HomeHead title="最近项目" onMore={onAllCanvases} />
          <div className="tpl-home__project-grid" data-create-span={Math.max(1, PROJECT_COLS - RECENT.length)}>
            {/* 一排 5 格：新建画布占掉最近项目没占的格子，一个画布都没有时铺满整排（11-10 用户定，照即梦） */}
<CreateCard variant="canvas" label="新建画布" onClick={onOpenCanvas} />
            {RECENT.map((c) => (
              <ProjectCard key={c.id} name={c.name} covers={c.covers} updatedAt={c.updatedAt} onOpen={onOpenCanvas} />
            ))}
          </div>
        </section>
      )}

      <section className="tpl-home__section" aria-label={m === 'canvas' ? '画布推荐内容' : '生成推荐内容'}>
        {m === 'generate' ? (
          <>
            <HomeHead title="发现" onMore={() => onExplore('discover')} search={{ placeholder: '搜索提示词、模型、作者', onSearch: (k) => onExplore('discover', k) }} />
            {/* 最高约两屏，下面压着的截掉，底部正中「更多」去探索页发现（11-17 用户定） */}
            <div className="tpl-home__discover" style={screen ? { maxHeight: screen * DISCOVER_SCREENS } : undefined}>
              <Masonry columns={{ default: 4, 1100: 3, 700: 2, 500: 1 }} gap={2} ratios={HOME_WORKS.map((w) => RATIO[w.ratio])}>
                {HOME_WORKS.map((w) => (
                  <WorkCard
                    key={w.id}
                    type={w.video ? 'video' : 'image'}
                    src={w.src}
                    poster={w.poster}
                    ratio={w.ratio}
                    title={w.prompt}
                    author={w.author}
                    likes={w.likes}
                    onOpen={() => onExplore('discover')}
                  />
                ))}
              </Masonry>
              <Button size={36} variant="on-media" rightIcon="RightArrowSmall" className="tpl-home__discover-more" onClick={() => onExplore('discover')}>
                更多
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* 右边回到「查看全部」（11-17 用户定，11-16 换过搜索框），去探索页对应选项卡 */}
            <HomeHead onMore={() => onExplore(square)}>
              <Tabs size={36} value={square} onChange={(v) => setSquare(v as typeof square)} aria-label="画布内容分类">
                {SQUARE_TABS.map((t) => (
                  <TabItem key={t.value} value={t.value}>
                    {t.label}
                  </TabItem>
                ))}
              </Tabs>
            </HomeHead>
            <div className="tpl-ex__grid">
              {square === 'skill'
                ? HOME_SKILLS.map((s) => (
                    <ExploreCard
                      key={s.id}
                      name={s.title}
                      description={s.description}
                      cover={s.poster ?? placeholderImageSrc(s.cover, '16:9')}
                      video={s.video}
                      author={s.author ?? { name: 'KIVI' }}
                      onOpen={() => onExplore('skill')}
                    />
                  ))
                : (square === 'featured' ? FEATURED : WORKFLOWS).map((f) => (
                    <ExploreCard key={f.id} name={f.name} cover={f.cover} video={f.video} showTime author={f.author} onOpen={() => onExplore(square)} />
                  ))}
            </div>
          </>
        )}
      </section>
    </>
  );

  return (
    <main className="tpl-home">
      <ScrollArea className="tpl-home__scroll" viewportRef={scrollRef}>
        <div className="tpl-home__page">
        <HomeAtmosphere targetRef={composerRef} />
        <div className="tpl-home__inner">
          <div className="tpl-home__intro">
            <h1>今天想在 KIVI 创作什么？</h1>
            {/* 分段自己的底是白 10%，压在点阵上会透出来，外面垫一层玻璃（11-16 用户定），不改分段本身 */}
            <div className="tpl-home__mode-glass">
              <Tabs variant="segment" size={36} value={mode} onChange={(v) => setMode(v as HomeMode)} aria-label="创作方式" className="tpl-home__mode">
                <TabItem value="generate">生成</TabItem>
                <TabItem value="canvas">画布</TabItem>
              </Tabs>
            </div>
          </div>

          {/* 生成：主站提示词框，提交进对话页；画布：画布里 Agent 的输入框，发送新建画布。两个一样大、一样的渐变底，内容各是各的 */}
          {/* 外壳只有一个（渐变底、描边、圆角）不动；两套内容叠在同一格里都挂着，切换时交叉淡化，框的大小位置不变、打的字也还在。
              一格的高度取两套里高的那个，所以两个一样高 */}
          <div ref={composerRef} className="tpl-home__composer">
            <div className="tpl-home__shell" data-ready={shellReady || undefined} style={shellHeight != null ? { height: shellHeight } : undefined}>
              {SHOW_COMPOSER_MOTION && <ComposerMotion />}
              <div ref={generateBox} className="tpl-home__box" data-active={mode === 'generate' || undefined}>
                <PromptBox placement="bottom-start" onSubmit={onSubmit} skills={SKILL_ITEMS} skillCategories={SKILL_CATEGORIES} />
              </div>
              <div ref={canvasBox} className="tpl-home__box" data-active={mode === 'canvas' || undefined} style={generateHeight != null ? { minHeight: generateHeight } : undefined}>
                <AgentComposer className="tpl-home__agent" placement="bottom-start" onSend={onOpenCanvas} />
              </div>
            </div>
          </div>

          {/* 切模式：中间一块和广场换掉，淡入 */}
          {/* 切模式：中间一块和广场直接换，不做淡入淡出（淡入要从全透明起，中间会空一帧、页面闪） */}
          {/* 两套都挂着，只显示当前的（hidden）：不卸载，图片加载过的不用再从占位图重新加载，选项卡等状态也还在 */}
          <div hidden={mode !== 'generate'}>{swapContent('generate')}</div>
          <div hidden={mode !== 'canvas'}>{swapContent('canvas')}</div>
        </div>
        </div>
      </ScrollArea>
    </main>
  );
}
