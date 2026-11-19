import { Divider, Menu, MenuItem, MenuLabel, type IconName } from '@kivi';
import { CANVAS_TEXT, inputRoom } from '../../rules/canvas';
import type { CanvasDoc, CanvasNodeType } from '../../data/types';

/*
  画布的菜单：添加节点（底部「添加」、双击空白、连线拖到空白松手都是它），右键菜单（空白处、节点）。
  照线上 node-list / context-menu-plugin。视频剪辑节点还没做，先不放。
*/

export const ADD_NODES: { type: Exclude<CanvasNodeType, 'group'>; icon: IconName; label: string }[] = [
  { type: 'text', icon: 'Text', label: '文本生成' },
  { type: 'image', icon: 'ImageGeneration', label: '图片生成' },
  { type: 'video', icon: 'VideoGeneration', label: '视频生成' },
  { type: 'audio', icon: 'Audio', label: '音频生成' },
];

export interface AddNodeMenuProps {
  doc: CanvasDoc;
  /** 连线拖出来的：标题「引用该节点生成」，不能再接这种上游的类型置灰，没有上传 */
  from?: string;
  onPick: (type: Exclude<CanvasNodeType, 'group'>) => void;
  /** 上传（双击空白的面板里有，连线拖出来的没有） */
  onUpload?: () => void;
}

export function AddNodeMenu({ doc, from, onPick, onUpload }: AddNodeMenuProps) {
  const source = from ? doc.nodes.find((n) => n.id === from) : undefined;
  return (
    <Menu width={200}>
      <MenuLabel>{source ? CANVAS_TEXT.quoteTitle : '添加节点'}</MenuLabel>
      {ADD_NODES.map((n) => {
        // 拖出来的那个节点接不进这种节点（比如图片接不进音频生成之外的…），置灰
        const full = !!source && source.type !== 'group' && !inputRoom(doc, { id: '', type: n.type, name: '', x: 0, y: 0, w: 0, h: 0 }, source.type);
        return (
          <MenuItem key={n.type} icon={n.icon} disabled={full} onClick={() => onPick(n.type)}>
            {n.label}
          </MenuItem>
        );
      })}
      {onUpload && !source && (
        <>
          <Divider />
          <MenuItem icon="Upload" onClick={onUpload}>
            上传
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

export interface BlankMenuProps {
  canUndo: boolean;
  canPaste: boolean;
  onUpload: () => void;
  onUndo: () => void;
  onPaste: () => void;
}

/** 右键空白处：上传、撤销、粘贴（不能用时置灰）。右键菜单不带图标（图标库没有撤销、粘贴、副本） */
export function BlankMenu({ canUndo, canPaste, onUpload, onUndo, onPaste }: BlankMenuProps) {
  return (
    <Menu width={200}>
      <MenuItem onClick={onUpload}>
        上传
      </MenuItem>
      <MenuItem shortcut="⌘Z" disabled={!canUndo} onClick={onUndo}>
        撤销
      </MenuItem>
      <MenuItem shortcut="⌘V" disabled={!canPaste} onClick={onPaste}>
        粘贴
      </MenuItem>
    </Menu>
  );
}

export interface NodeMenuProps {
  /** 选中的节点里有忙的（生成中、上传中）：复制、副本、删除、展开、添加到对话置灰 */
  busy: boolean;
  /** 单选一个有多张图的节点才有「展开所有图片」 */
  canScatter: boolean;
  /** 「复制文本」/「复制图片」：单选文字或图片节点才有 */
  copyLabel?: string;
  /** 能不能添加到对话（文字、图片、视频、音频节点） */
  canChat: boolean;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyContent: () => void;
  onScatter: () => void;
  onChat: () => void;
}

/** 右键节点：复制节点、创建副本、删除、复制文本 / 图片、展开所有图片、添加到对话 */
export function NodeMenu({ busy, canScatter, copyLabel, canChat, onCopy, onDuplicate, onDelete, onCopyContent, onScatter, onChat }: NodeMenuProps) {
  return (
    <Menu width={200}>
      <MenuItem shortcut="⌘C" disabled={busy} onClick={onCopy}>
        复制节点
      </MenuItem>
      <MenuItem shortcut="⌘D" disabled={busy} onClick={onDuplicate}>
        创建副本
      </MenuItem>
      <MenuItem shortcut="⌫" disabled={busy} onClick={onDelete}>
        删除
      </MenuItem>
      {(copyLabel || canScatter || canChat) && <Divider />}
      {copyLabel && (
        <MenuItem onClick={onCopyContent}>
          {copyLabel}
        </MenuItem>
      )}
      {canScatter && (
        <MenuItem disabled={busy} onClick={onScatter}>
          展开所有图片
        </MenuItem>
      )}
      {canChat && (
        <MenuItem disabled={busy} onClick={onChat}>
          添加到对话
        </MenuItem>
      )}
    </Menu>
  );
}
