import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Dialog, GenPrompt, IconButton, PromptBox, ScrollArea, placeholderImageSrc, referenceName, toast, type PromptBoxSubmit, type ReferenceStackItem } from '@kivi';
import { SKILL_CATEGORIES, SKILL_ITEMS } from '../../../docs/business/skill-data';
import { activeTurnOf, sendAgent, stopAgent } from '../../data/agent';
import { removeAssets, setCollected } from '../../data/assets';
import { addChatTask } from '../../data/chats';
import { byId, useDB } from '../../data/db';
import { ratioNum } from '../../data/mock';
import { removeOutput } from '../../data/outputs';
import { CREATE_COMPOSER_REFS } from '../../data/seed/create';
import { submitTask, type TaskInput } from '../../data/tasks';
import { uid } from '../../data/store';
import { toolOf, type ToolId } from '../../data/tools';
import type { Chat, Where } from '../../data/types';
import { attempt } from '../../flows/errors';
import { MediaViewer, ViewerAuthor, ViewerSection, useLastShown, type ViewerMedia } from '../../parts/media-viewer';
import { ToolWorkbench, toolTaskInput, type Source, type ToolJob } from '../../parts/tool-workbench';
import { toolCost, toolParams } from '../../parts/tool-workbench/options';
import { INITIAL_STATE } from '../../parts/tool-workbench/types';
import { RecordFeed } from './RecordFeed';
import { TileMenus, type TileMenuState } from './TileMenus';
import { genTaskInput } from './submit';
import type { TileContext, TileRef, ViewerInfo } from './tiles';

/*
  创作页（对话页）主区：生成记录 + 底部输入框，侧栏在外壳里。
  记录读 db 里这个对话的任务和素材；输入框、工具弹窗、抠图这些「生成」都走 submitTask，结果到点自己出，排在记录流最后。
  点完成的图全屏看大图；收藏、删除改的是素材本身，资产页同步。
*/

/** 离底多近算「在底部」：在底部时内容变高跟着滚 */
const FOLLOW_GAP = 80;

/** 对话页：对话被删掉了就什么都不画（外壳会回创作首页） */
export function CreatePage({ chatId }: { chatId: string }) {
  const chat = useDB((s) => byId(s.chats, chatId));
  return chat ? <ChatView chat={chat} /> : null;
}

function ChatView({ chat }: { chat: Chat }) {
  const tasks = useDB((s) => s.tasks);
  const assets = useDB((s) => s.assets);
  const agentTurns = useDB((s) => s.agentTurns);
  // Agent 正在回复（或等确认）：发送按钮变停止
  const active = activeTurnOf(agentTurns, chat.id);
  const where: Where = { page: 'create', chatId: chat.id };

  // 看大图：全站共用的查看大图（media-viewer.tsx），信息栏放这条记录的提示词和参数
  const [view, setView] = useState<{ media: ViewerMedia; info: ViewerInfo; assetId?: string } | null>(null);
  const shownView = useLastShown(view);
  // 没有素材的格子（Agent 那一轮）收藏只记在页面里
  const [viewCollected, setViewCollected] = useState<string[]>([]);
  const [refs, setRefs] = useState<ReferenceStackItem[]>(CREATE_COMPOSER_REFS);
  const [removed, setRemoved] = useState<string[]>([]);
  const [tool, setTool] = useState<{ id: ToolId; source: Source } | null>(null);
  // 「更多」和右键各一个菜单，锚在点的位置
  const [more, setMore] = useState<TileMenuState | null>(null);
  const [menu, setMenu] = useState<TileMenuState | null>(null);

  const feed = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const [composerH, setComposerH] = useState(220);

  /** 提交一个任务：成功后排到对话最后（出错交给 attempt） */
  const run = async (input: TaskInput) => {
    const t = await attempt(() => submitTask(input));
    if (t) addChatTask(chat.id, t.id);
  };

  const addRef = (t: TileRef) =>
    setRefs((list) => [
      ...list,
      { id: uid('c'), type: t.media, name: referenceName(list, t.media), src: t.media === 'video' ? t.poster : t.src, duration: t.media === 'video' ? '5s' : undefined },
    ]);

  // 弹窗里点生成：关弹窗，记录流最后多一条工具任务（只有参数，没有提示词）
  const runJob = (job: ToolJob) => {
    setTool(null);
    void run(toolTaskInput(job, where));
  };
  // 抠图、视频抠图不开弹窗，点了直接生成（11-11 用户定）；视频抠图用默认输出模式透明视频
  const openTool = (id: ToolId, t: TileRef) => {
    const ratio = ratioNum(t.ratio);
    if (id === 'cutout' || id === 'video-cutout') {
      runJob({ tool: id, label: toolOf(id).name, media: t.media, src: t.src, ratio, targetRatio: ratio, params: toolParams(id, INITIAL_STATE), cost: toolCost(id, INITIAL_STATE) });
    } else setTool({ id, source: { id: uid('v'), media: t.media, src: t.src, ratio } });
  };

  const remove = (t: TileRef) => {
    if (t.assetId) void attempt(() => removeAssets([t.assetId!]));
    else if (t.taskId !== undefined && t.index !== undefined) void attempt(() => removeOutput(t.taskId!, t.index!));
    else setRemoved((l) => [...l, t.key]);
  };

  const ctx: TileContext = {
    removed,
    view: (t) => setView({ media: { type: t.media, src: t.src, poster: t.poster }, info: t.info, assetId: t.assetId }),
    addRef,
    openTool,
    openMore: (t, at) => setMore({ ...at, tile: t }),
    openMenu: (t, at) => setMenu({ ...at, tile: t }),
    remove,
    collect: (t, v) => t.assetId && void attempt(() => setCollected([t.assetId!], v)),
  };

  /** 发给 Agent：带上参考区的素材，发出去后参考区清空（像聊天发附件） */
  const ask = async (text: string, withRefs = refs) => {
    const sent = await attempt(() =>
      sendAgent(chat.id, { text, refs: withRefs.map((r) => ({ type: r.type, src: r.src ?? '', name: r.name, duration: r.duration })) }),
    );
    if (sent && withRefs.length) setRefs([]);
  };

  const submit = (s: PromptBoxSubmit) => {
    if (s.task === 'agent') {
      void ask(s.text, s.references);
      return;
    }
    const input = genTaskInput(s, where);
    if (input) void run(input);
  };

  // 输入框浮在记录流上，记录流底部留出它的高度；输入框变高（加参考、打长字）跟着变
  useLayoutEffect(() => {
    const el = composer.current;
    if (!el) return;
    const measure = () => setComposerH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 和线上一样，进来停在最新一条（最下面）；新加了一项平滑滚到最下面
  useLayoutEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  // Agent 回复往下长（逐字、出卡、出结果）时跟着滚到底；用户往上翻了（离底超过 80）就不跟
  const column = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = feed.current;
    const inner = column.current;
    if (!el || !inner) return;
    let atBottom = true;
    const onScroll = () => {
      atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_GAP;
    };
    const ro = new ResizeObserver(() => {
      if (atBottom) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(inner);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);
  const count = chat.items.length;
  const prevCount = useRef(count);
  useEffect(() => {
    const el = feed.current;
    if (el && count > prevCount.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    prevCount.current = count;
  }, [count]);

  // 看大图里的收藏：有素材的看素材，没有的看页面里记的
  const viewAsset = shownView?.assetId ? assets.find((a) => a.id === shownView.assetId) : undefined;
  const viewCollectedNow = viewAsset ? viewAsset.collected : !!shownView && viewCollected.includes(shownView.media.src);
  const toggleViewCollected = () => {
    if (!shownView) return;
    if (viewAsset) void attempt(() => setCollected([viewAsset.id], !viewAsset.collected));
    else setViewCollected((l) => (l.includes(shownView.media.src) ? l.filter((x) => x !== shownView.media.src) : [...l, shownView.media.src]));
  };

  return (
    <>
      <main className="tpl-ms__main" style={{ '--tpl-composer-h': `${composerH}px` } as CSSProperties}>
        <ScrollArea className="tpl-ms__feed" viewportRef={feed}>
          <div ref={column} className="tpl-ms__column">
            <RecordFeed chat={chat} tasks={tasks} assets={assets} agentTurns={agentTurns} ctx={ctx} />
          </div>
        </ScrollArea>
        <div ref={composer} className="tpl-ms__composer">
          <PromptBox
            references={refs}
            onReferencesChange={setRefs}
            skills={SKILL_ITEMS}
            skillCategories={SKILL_CATEGORIES}
            onSubmit={submit}
            generating={!!active}
            onStop={() => active && stopAgent(active.id)}
          />
        </div>
      </main>

      <TileMenus
        more={more}
        menu={menu}
        onCloseMore={() => setMore(null)}
        onCloseMenu={() => setMenu(null)}
        onTool={openTool}
        onAddRef={addRef}
        onRemove={remove}
      />

      {/* 工具弹窗：每个工具一个，所有工具一个大小（宽 800、高 640），里面和 AI 工具页同一套舞台和参数面板 */}
      <Dialog
        size={800}
        className="tpl-tool-dlg"
        title={tool ? toolOf(tool.id).name : undefined}
        open={tool !== null}
        onOpenChange={(v) => !v && setTool(null)}
      >
        {tool && <ToolWorkbench key={tool.source.id} tool={tool.id} source={tool.source} onGenerate={runJob} promptBar />}
      </Dialog>

      <MediaViewer
        media={view?.media ?? null}
        onClose={() => setView(null)}
        head={<ViewerAuthor name="KIVI" avatar={placeholderImageSrc('ip-peek', '1:1')} date="今天 14:32" />}
        actions={
          shownView && (
            <>
              <IconButton icon="Download" label="下载" variant="secondary" size={36} onClick={() => toast.info('已开始下载')} />
              <IconButton
                icon={viewCollectedNow ? 'CollectSolid' : 'Collect'}
                label={viewCollectedNow ? '取消收藏' : '收藏'}
                variant="secondary"
                size={36}
                data-collected={viewCollectedNow || undefined}
                onClick={toggleViewCollected}
              />
            </>
          )
        }
      >
        {shownView && (
          <ViewerSection title={shownView.info.prompt ? '提示词' : '参数'}>
            <GenPrompt prompt={shownView.info.prompt}>{shownView.info.tags}</GenPrompt>
          </ViewerSection>
        )}
      </MediaViewer>
    </>
  );
}
