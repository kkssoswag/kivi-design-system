import { useMemo, useState, type ReactNode } from 'react';
import { Button, FolderCard, ProjectCard, ScrollArea } from '@kivi';
import { useDB } from '../../data/db';
import { deleteFolder } from '../../data/assets';
import { attempt } from '../../flows/errors';
import { HistorySection } from './HistorySection';

/*
  资产管理（我的资产）：照 11-04 交互原型（kivi-prototype 的 assets-home）。
  三块从上到下：我的素材（文件夹）、我的画布、生成历史（全部历史，按今天 / 昨天 / 更早分组）。
  数据读 useDB（素材、文件夹、画布）；文件夹里的数量、封面由素材的 folderIds 算。
  筛选、搜索、时间筛选在生成历史里，是页面状态；收藏、删文件夹走 data/assets.ts。
*/

/** 一块的标题行：左标题，右边「新建」「查看全部」。右边按钮一律无底灰（设计规则 · 布局 · 标题行，11-14） */
function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="tpl-as__head">
      <h2>{title}</h2>
      <div className="tpl-as__head-actions">
        {children}
        <Button size={32} variant="ghost-muted" rightIcon="RightArrowSmall">
          查看全部
        </Button>
      </div>
    </header>
  );
}

/** 文件夹封面最多几张 */
const COVER_MAX = 4;

/** 资产页主区（侧栏在 UI 页面预览的外壳里） */
export function AssetsPage() {
  const assets = useDB((s) => s.assets);
  const allFolders = useDB((s) => s.folders);
  const canvases = useDB((s) => s.canvases);
  // 置顶只是页面上的排序（原来就没存），置顶的排最前面
  const [pinned, setPinned] = useState<string[]>(['f1']);

  // 每个文件夹的数量和封面：数素材（音频没有封面图）
  const folders = useMemo(() => {
    const items = allFolders.map((f) => {
      const inside = assets.filter((a) => a.folderIds.includes(f.id));
      return {
        id: f.id,
        name: f.name,
        count: inside.length,
        covers: inside
          .filter((a) => a.media !== 'audio')
          .slice(0, COVER_MAX)
          .map((a) => a.poster ?? a.src),
        pinned: pinned.includes(f.id),
      };
    });
    return [...items.filter((f) => f.pinned), ...items.filter((f) => !f.pinned)];
  }, [allFolders, assets, pinned]);

  const pin = (id: string, on: boolean) => setPinned((all) => (on ? [...all, id] : all.filter((x) => x !== id)));

  return (
    <ScrollArea className="tpl-as">
      <main className="tpl-as__body">
        <section className="tpl-as__section">
          <SectionHead title="我的素材" />
          <div className="tpl-as__row">
            {folders.map((f) => (
              <FolderCard
                key={f.id}
                name={f.name}
                count={f.count}
                covers={f.covers}
                pinned={f.pinned}
                onPinnedChange={(v) => pin(f.id, v)}
                onDelete={() => void attempt(() => deleteFolder(f.id))}
              />
            ))}
          </div>
        </section>

        <section className="tpl-as__section">
          <SectionHead title="我的画布">
            <Button size={32} variant="ghost-muted" leftIcon="AddSmall">
              新建画布
            </Button>
          </SectionHead>
          <div className="tpl-as__row">
            {canvases.map((c) => (
              <ProjectCard key={c.id} name={c.name} covers={c.covers} updatedAt={c.updatedAt} />
            ))}
          </div>
        </section>

        <HistorySection />
      </main>
    </ScrollArea>
  );
}
