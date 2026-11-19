import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, CreateCard, ExpertBar, ExpertCard, ExploreCard, Masonry, ProjectCard, PromptBox, ScrollArea, TabItem, Tabs, WorkCard, placeholderImageSrc, toast, type ExpertItem, type GenTask, type PromptBoxSubmit } from '@kivi';
import { EXPERTS, EXPERT_USER, expertOf } from '../../../docs/business/expert-data';
import { SKILL_CATEGORIES, SKILL_ITEMS } from '../../../docs/business/skill-data';
import { RATIO, SKILLS, WORKS, flowsOf } from '../../data/catalog';
import { sendAgent } from '../../data/agent';
import { addChatTask, createChat, deleteChat } from '../../data/chats';
import { useDB } from '../../data/db';
import { submitTask } from '../../data/tasks';
import { attempt } from '../../flows/errors';
import { AgentComposer } from '../../parts/agent-composer';
import { ExpertDetailHost, expertPlaceholder } from '../../parts/expert-session';
import { startExpert } from '../../data/experts';
import type { ExploreTab } from '../explore';
import { ComposerMotion, HomeAtmosphere, SHOW_COMPOSER_MOTION } from './HomeBackdrop';
import { HomeHead, RecentUpdates } from './HomeParts';
import { genTaskInput } from './submit';

type HomeMode = 'generate' | 'canvas';

/*
  创作首页（11-10，照用户的交互原型 kivi-prototype「创作页」：结构和交互照它，样子用组件库）。
  从上到下：标题、「生成 / 画布」切换、输入框、中间一块、广场。
  输入框两种模式各是各的、一样大一样的渐变底（11-10 用户定）：生成是主站提示词框（PromptBox），提交进对话页；画布是画布里 Agent 的输入框，发送新建画布。
  生成提交：新建一个对话（标题取提示词前 20 字，没写字叫「新对话」）→ 在里面提交任务 → 进这个对话页。提交失败（余额不足、断网）把刚建的空对话删掉，留在首页。
  中间一块：生成是「最近更新」（运营位 Banner）；画布换成「最近项目」（新建画布 + 最近 4 个，读 db.canvases），不照原型放在输入框上面（11-10 用户定）。
  广场：生成是「发现」瀑布流；画布是创作精选 / 技能 / 工作流。切模式时中间一块和广场淡入（150ms ease-out）。
*/

/** 最近项目一排几格（新建画布 + 最近 4 个） */
const PROJECT_COLS = 5;

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


export function CreateHome({
  onSubmit,
  onOpenCanvas,
  onExplore,
  onAllCanvases,
  expert = 'none',
  onExpertChange,
}: {
  /** 当前专家（专家模式）：生成、画布两个入口共用一个，记住用户最近一次的选择，Agent 提交时带进新对话、新画布 */
  expert?: string;
  onExpertChange?: (id: string) => void;
  /** 生成：对话建好、任务提交后，进这个对话页（参数是新对话的 id） */
  onSubmit: (chatId: string) => void;
  /** 画布：新建画布、打开最近项目、提交想法，都进画布页 */
  onOpenCanvas: () => void;
  /** 广场搜索框回车（带着关键词）、点作品：去探索页对应选项卡 */
  onExplore: (tab: ExploreTab, keyword?: string) => void;
  /** 最近项目「查看全部」：去我的资产看全部画布 */
  onAllCanvases: () => void;
}) {
  const [mode, setMode] = useState<HomeMode>('generate');
  // 专家模式：生成入口的任务类型受控（邀请专家时切到 Agent）；专家详情；示例提问填进输入框（生成入口按 key 重新挂上输入框）
  const [task, setTask] = useState<GenTask>('agent');
  const [detail, setDetail] = useState<ExpertItem | null>(null);
  const [fill, setFill] = useState<{ text: string; key: number; mode: HomeMode }>();
  const invite = (id: string, on: boolean) => {
    onExpertChange?.(on ? id : 'none');
    if (!on) return;
    // 图片、视频、音频模式下点「邀请」：任务类型切到 Agent
    if (mode === 'generate') setTask('agent');
    toast.success(`已邀请${expertOf(id).name}`);
  };
  const expertBar = <ExpertBar experts={EXPERTS} user={EXPERT_USER} value={expert} onValueChange={(id) => onExpertChange?.(id)} onDetail={setDetail} placement="bottom-start" />;
  // 最近项目：最近改过的 4 块画布（和侧栏画布历史、资产页「我的画布」同一批）
  const canvases = useDB((s) => s.canvases);
  const recent = useMemo(() => [...canvases].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, PROJECT_COLS - 1), [canvases]);
  // 提交中不重复提交（新建对话和提交任务各有一次请求的延迟）
  const submitting = useRef(false);
  const submit = async (s: PromptBoxSubmit) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const chat = await attempt(() => createChat(s.text.trim().slice(0, 20) || '新对话'));
      if (!chat) return;
      // Agent：把这句话（连同参考区的素材）发出去，进对话页看它回复。首页的专家带进新对话（留「XX 加入对话」）
      if (s.task === 'agent') {
        startExpert({ kind: 'chat', id: chat.id }, expert);
        const sent = await attempt(() =>
          sendAgent(chat.id, { text: s.text, refs: s.references.map((r) => ({ type: r.type, src: r.src ?? '', name: r.name, duration: r.duration })) }),
        );
        if (!sent) {
          await attempt(() => deleteChat(chat.id));
          return;
        }
        onSubmit(chat.id);
        return;
      }
      const input = genTaskInput(s, { page: 'create', chatId: chat.id });
      if (input) {
        const task = await attempt(() => submitTask(input));
        if (!task) {
          await attempt(() => deleteChat(chat.id));
          return;
        }
        addChatTask(chat.id, task.id);
      }
      onSubmit(chat.id);
    } finally {
      submitting.current = false;
    }
  };
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
          <div className="tpl-home__project-grid" data-create-span={Math.max(1, PROJECT_COLS - recent.length)}>
            {/* 一排 5 格：新建画布占掉最近项目没占的格子，一个画布都没有时铺满整排（11-10 用户定，照即梦） */}
<CreateCard variant="canvas" label="新建画布" onClick={onOpenCanvas} />
            {recent.map((c) => (
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
                <PromptBox
                  key={fill?.mode === 'generate' ? fill.key : undefined}
                  defaultValue={fill?.mode === 'generate' ? fill.text : undefined}
                  task={task}
                  onTaskChange={setTask}
                  placement="bottom-start"
                  onSubmit={submit}
                  skills={SKILL_ITEMS}
                  skillCategories={SKILL_CATEGORIES}
                  agentHeader={expertBar}
                  agentPlaceholder={expertPlaceholder(expert)}
                />
              </div>
              <div ref={canvasBox} className="tpl-home__box" data-active={mode === 'canvas' || undefined} style={generateHeight != null ? { minHeight: generateHeight } : undefined}>
                <AgentComposer
                  className="tpl-home__agent"
                  placement="bottom-start"
                  onSend={onOpenCanvas}
                  header={expertBar}
                  placeholder={expertPlaceholder(expert)}
                  fill={fill?.mode === 'canvas' ? fill : undefined}
                />
              </div>
            </div>
          </div>

          {/* 专家卡片：生成、画布两个入口都有，在输入框和最近更新 / 最近项目之间。「无需专家」不占卡片 */}
          <section className="tpl-home__section" aria-label="邀请专家">
            <header className="tpl-home__head">
              <h2>邀请专家</h2>
            </header>
            <div className="tpl-home__experts">
              {EXPERTS.filter((e) => e.avatar).map((e) => (
                <ExpertCard
                  key={e.id}
                  name={e.name}
                  description={e.description}
                  avatar={e.avatar}
                  skillCount={e.skills?.length}
                  invited={expert === e.id}
                  onInvitedChange={(on) => invite(e.id, on)}
                  onOpen={() => setDetail(e)}
                />
              ))}
            </div>
          </section>
          <ExpertDetailHost
            detail={detail}
            current={expert}
            onClose={() => setDetail(null)}
            onInvite={(e, on) => invite(e.id, on)}
            onExample={(e, text) => {
              onExpertChange?.(e.id);
              if (mode === 'generate') setTask('agent');
              setFill({ text, key: Date.now(), mode });
            }}
          />

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
