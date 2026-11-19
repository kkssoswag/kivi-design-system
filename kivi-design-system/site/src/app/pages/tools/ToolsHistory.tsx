import { useState, type ReactNode } from 'react';
import { Dropdown, EmptyState, IconButton, Menu, MenuItem, ResultTile, ScrollArea, toast } from '@kivi';
import { countdownLabel, useNow } from '../../data/tasks';
import { TOOLS, toolOf, type Media, type ToolId } from '../../data/tools';
import type { HistoryItem } from './history';

/*
  右栏通到顶：上面是余额和头像（11-17 用户定，从公共的头并进来），下面是历史（按工具筛选、右键菜单）。
*/

export interface ToolsHistoryProps {
  /** 右栏顶上的余额和头像（外壳传进来） */
  account?: ReactNode;
  items: HistoryItem[];
  /** 当前工具的类型：只有同类型的能「加入当前工具」 */
  media: Media;
  onPreview: (item: HistoryItem) => void;
  onUseInTool: (item: HistoryItem) => void;
  onRemove: (item: HistoryItem) => void;
}

export function ToolsHistory({ account, items, media, onPreview, onUseInTool, onRemove }: ToolsHistoryProps) {
  const [filter, setFilter] = useState<ToolId | 'all'>('all');
  const shown = filter === 'all' ? items : items.filter((r) => r.tool === filter);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const menuOf = menu ? items.find((r) => r.id === menu.id) ?? null : null;
  const now = useNow(items.some((r) => r.status === 'generating'));

  return (
    <div className="tpl-at__side">
      {account}
      <ScrollArea className="tpl-at__history">
        <aside className="tpl-at__history-body" aria-label="历史记录">
          <div className="tpl-at__history-head">
            <span className="tpl-at__history-title">历史记录</span>
            <Dropdown
              haspopup="listbox"
              placement="bottom-end"
              // 筛选只放图标（11-11 用户定），无底灰（11-18 用户要灰的），筛了某个工具时按钮留选中底色
              trigger={<IconButton icon="Filter" label="按工具筛选" variant="ghost-muted" size={28} selected={filter !== 'all'} />}
            >
              <Menu role="listbox" aria-label="按工具筛选">
                <MenuItem selected={filter === 'all'} onClick={() => setFilter('all')}>
                  全部工具
                </MenuItem>
                {TOOLS.map((t) => (
                  <MenuItem key={t.id} icon={t.icon} selected={filter === t.id} onClick={() => setFilter(t.id)}>
                    {t.name}
                  </MenuItem>
                ))}
              </Menu>
            </Dropdown>
          </div>
          {shown.length === 0 && (
            // 空的时候右栏正中放一个历史图标（窄栏放 IP 不合适，11-18 用户定），不写说明
            <EmptyState className="tpl-at__history-empty" size={96} icon="History" title={filter === 'all' ? '暂无历史记录' : `暂无${toolOf(filter).name}记录`} />
          )}
          {shown.map((r) => {
            const done = r.status === 'done';
            return (
              <figure
                key={r.id}
                className="tpl-at__record"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, id: r.id });
                }}
              >
                <ResultTile
                  type={r.media}
                  status={r.status}
                  src={r.src}
                  poster={r.poster}
                  badge={r.status === 'generating' ? countdownLabel(r.task, now) : undefined}
                  topActions={done ? [{ icon: 'Download', label: '下载', onClick: () => toast.success('已开始下载') }] : undefined}
                  style={{ aspectRatio: '1 / 1', cursor: done && r.media === 'image' ? 'zoom-in' : undefined }}
                  onClick={done && r.media === 'image' ? (e) => !(e.target as HTMLElement).closest('button') && onPreview(r) : undefined}
                  onPreview={done ? () => onPreview(r) : undefined}
                />
              </figure>
            );
          })}
        </aside>
      </ScrollArea>

      {/* 历史的右键菜单 */}
      <Dropdown anchorPoint={menu ?? undefined} open={menu !== null} onOpenChange={(v) => !v && setMenu(null)}>
        <Menu aria-label="历史操作">
          <MenuItem icon="Add" disabled={!menuOf || menuOf.status !== 'done' || menuOf.media !== media} onClick={() => menuOf && onUseInTool(menuOf)}>
            加入当前工具
          </MenuItem>
          <MenuItem icon="Download" disabled={menuOf?.status !== 'done'} onClick={() => toast.success('已开始下载')}>
            下载
          </MenuItem>
          <MenuItem variant="danger" icon="Delete" disabled={!menuOf || menuOf.status === 'generating'} onClick={() => menuOf && onRemove(menuOf)}>
            删除
          </MenuItem>
        </Menu>
      </Dropdown>
    </div>
  );
}
