import { Divider, Dropdown, Menu, MenuItem, toast } from '@kivi';
import { moreTools, type TileRef } from './tiles';
import type { ToolId } from '../../data/tools';

/*
  结果格的两个菜单，都锚在点的位置：
  - 「更多」：其余的工具，往上开、右边和按钮对齐（按钮条在右下）
  - 右键：加入参考图在第一个，别的照探索页的作品菜单
*/

export interface TileMenuState {
  x: number;
  y: number;
  tile: TileRef;
}

export interface TileMenusProps {
  more: TileMenuState | null;
  menu: TileMenuState | null;
  onCloseMore: () => void;
  onCloseMenu: () => void;
  onTool: (id: ToolId, t: TileRef) => void;
  onAddRef: (t: TileRef) => void;
  onRemove: (t: TileRef) => void;
}

export function TileMenus({ more, menu, onCloseMore, onCloseMenu, onTool, onAddRef, onRemove }: TileMenusProps) {
  return (
    <>
      <Dropdown anchorPoint={more ?? undefined} placement="top-end" open={more !== null} onOpenChange={(v) => !v && onCloseMore()}>
        <Menu aria-label="更多工具">
          {more &&
            moreTools(more.tile.media).map((t) => (
              <MenuItem key={t.id} icon={t.icon} onClick={() => onTool(t.id, more.tile)}>
                {t.name}
              </MenuItem>
            ))}
        </Menu>
      </Dropdown>

      <Dropdown anchorPoint={menu ?? undefined} open={menu !== null} onOpenChange={(v) => !v && onCloseMenu()}>
        <Menu aria-label="结果操作">
          <MenuItem icon="ImagePlus" onClick={() => menu && onAddRef(menu.tile)}>
            加入参考图
          </MenuItem>
          <MenuItem icon="AddFolder" onClick={() => toast.success('已添加到文件夹')}>
            添加到文件夹
          </MenuItem>
          <Divider />
          {menu?.tile.media === 'image' && (
            <MenuItem icon="Copy" onClick={() => toast.success('已复制')}>
              复制
            </MenuItem>
          )}
          <MenuItem icon="Download" onClick={() => toast.info('已开始下载')}>
            下载
          </MenuItem>
          <Divider />
          <MenuItem variant="danger" icon="Delete" onClick={() => menu && onRemove(menu.tile)}>
            删除
          </MenuItem>
        </Menu>
      </Dropdown>
    </>
  );
}
