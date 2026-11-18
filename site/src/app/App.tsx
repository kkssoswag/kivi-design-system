import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Notifier, Toaster } from '@kivi';
import { PreviewHost } from '../docs/components/media.demos';
import { TemplateFrame } from '../docs/templates/frame';
import '../docs/templates/templates.css';
import { useDB } from './data/db';
import { FlowHost } from './flows/dialogs';
import { AssetsPage } from './pages/assets';
import { CanvasPage } from './pages/canvas';
import { CreateHome, CreatePage } from './pages/create';
import { ExplorePage, type ExploreTab } from './pages/explore';
import { ToolsPage } from './pages/tools';
import { Sidebar, Wallet, type AppPage, type HistoryKind } from './parts/shell';
import { DemoPanel } from './parts/DemoPanel';
import './app.css';

/*
  演示站（app/）的外壳。结构和规矩见 kivi-design-system-workspace/page-notes/app-architecture.md。
  UI 页面预览：主站整套页面，像线上一样能互相切。
  侧栏只有一个：切页时不重新挂载，收起 / 展开、对话和画布历史都跟着用户走；只换右边主区。
  点侧栏的画布历史进画布页（没有主站侧栏，和线上一样），点画布左上角 Logo 回创作页。
  创作页分两种：没选对话时是创作首页（CreateHome：标题、生成 / 画布、输入框、最近更新或最近项目、广场）；
  首页「生成」提交、点侧栏的对话历史，进对话页（CreatePage：生成记录 + 底部输入框）。
  网站里放在外框里（框里切）；单独开在 #/app/<页>，地址跟着切，浏览器前进后退能用。
*/

const PAGES: AppPage[] = ['create', 'explore', 'tools', 'assets', 'canvas'];
const NONE = { kind: 'chat' as HistoryKind, id: '' };

export function KiviApp({ page, onNavigate }: { page: AppPage; onNavigate: (page: AppPage) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  // 侧栏选中哪条对话 / 画布：进来是创作首页，什么都不选
  const [selected, setSelected] = useState(NONE);
  // 进探索页停在哪个选项卡：创作首页「查看全部」带过来
  const [exploreTab, setExploreTab] = useState<ExploreTab>('discover');
  // 创作首页广场的搜索框里填的字，进探索页时带过去
  const [exploreKeyword, setExploreKeyword] = useState('');
  // 进画布页时带着的技能：探索页技能点「使用」新建画布，Agent 输入框带上技能引用
  const [skill, setSkill] = useState<string | undefined>();

  // 选中的对话被删掉了，回到创作首页
  const chats = useDB((s) => s.chats);
  useEffect(() => {
    if (selected.kind === 'chat' && selected.id && !chats.some((c) => c.id === selected.id)) setSelected(NONE);
  }, [chats, selected]);

  // 去了探索、AI 工具、资产，侧栏不再选中对话；从画布回到创作页，也不再选中那块画布
  useEffect(() => {
    if (page === 'explore' || page === 'tools' || page === 'assets' || (page === 'create' && selected.kind === 'canvas')) {
      setSelected(NONE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const navigate = (next: AppPage) => {
    setSelected(NONE);
    setSkill(undefined);
    if (next === 'explore') {
      setExploreTab('discover');
      setExploreKeyword('');
    }
    onNavigate(next);
  };
  const openCanvas = () => {
    setSelected(NONE);
    setSkill(undefined);
    onNavigate('canvas');
  };

  return (
    <>
      <Toaster />
      <Notifier />
      <PreviewHost />
      <FlowHost />
      {/* 画布页没有主站侧栏；侧栏藏起来不卸载，回来时收起状态、历史都还在 */}
      <div
        className="tpl-ms"
        // 右上角余额、头像按这一页内容的最大宽度对齐：对话页跟记录流，其他跟各页
        data-page={page === 'create' && selected.kind === 'chat' && selected.id ? 'chat' : page}
        style={page === 'canvas' ? { display: 'none' } : undefined}
      >
        <Sidebar
          page={page}
          onNavigate={navigate}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          selected={selected.id}
          onOpen={(kind, id) => {
            setSelected({ kind, id });
            setSkill(undefined);
            onNavigate(kind === 'canvas' ? 'canvas' : 'create');
          }}
        />
        {page === 'create' &&
          (selected.kind === 'chat' && selected.id ? (
            <CreatePage key={selected.id} chatId={selected.id} />
          ) : (
            <CreateHome
              // 提交后进新建的那个对话（侧栏里它排在最前）
              onSubmit={(chatId) => setSelected({ kind: 'chat', id: chatId })}
              onOpenCanvas={openCanvas}
              onExplore={(tab, keyword = '') => {
                setExploreTab(tab);
                setExploreKeyword(keyword);
                onNavigate('explore');
              }}
              onAllCanvases={() => navigate('assets')}
            />
          ))}
        {page === 'explore' && (
          <ExplorePage
            key={`${exploreTab}:${exploreKeyword}`}
            initialTab={exploreTab}
            initialKeyword={exploreKeyword}
            onUseSkill={(name) => {
              setSelected(NONE);
              setSkill(name);
              onNavigate('canvas');
            }}
            onOpenCanvas={openCanvas}
          />
        )}
        {page === 'tools' && <ToolsPage account={<Wallet className="tpl-at__wallet" />} />}
        {page === 'assets' && <AssetsPage />}
        {/* 公共的头：右上角余额和头像，每一页一样的位置（中线离顶 32，和侧栏 Logo 对齐），换页不动。AI 工具页的放进右栏顶上 */}
        {page !== 'tools' && <Wallet />}
      </div>
      {page === 'canvas' && <CanvasPage key={skill ?? 'canvas'} skill={skill} onHome={() => navigate('create')} />}
      <DemoPanel />
    </>
  );
}

/** 网站里的「UI 页面预览」：外框里切页，右上「新 Tab 打开」开当前这一页 */
export function UiPreview() {
  const [page, setPage] = useState<AppPage>('create');
  return (
    <TemplateFrame href={`/app/${page}`}>
      <KiviApp page={page} onNavigate={setPage} />
    </TemplateFrame>
  );
}

/** 单独一个 Tab：#/app/<页>，铺满窗口，没有网站的目录和顶栏 */
export default function KiviAppRoute() {
  const { page } = useParams();
  const go = useNavigate();
  useEffect(() => {
    const prev = document.title;
    document.title = 'KIVI';
    return () => {
      document.title = prev;
    };
  }, []);
  if (!PAGES.includes(page as AppPage)) return <Navigate to="/app/create" replace />;
  return (
    <div className="tpl-app">
      <KiviApp page={page as AppPage} onNavigate={(next) => go(`/app/${next}`)} />
    </div>
  );
}
