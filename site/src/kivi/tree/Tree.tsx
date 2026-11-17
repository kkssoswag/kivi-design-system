import { forwardRef, useRef, type CSSProperties, type ReactElement, type HTMLAttributes, type KeyboardEvent, type MouseEvent } from 'react';
import { Collapse } from '../collapse';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { fileIcon } from '../reference/fileIcon';
import { cx } from '../utils';
import { composeHandlers, useControllable, useMergedRef } from '../hooks';
import './tree.css';

export interface TreeNode {
  /** 唯一标识，文件树用路径（`references/风格指南.md`） */
  id: string;
  /** 名字，一行省略 */
  name: string;
  /** 下一层：写了（空数组也算）就是文件夹，点了展开收起；不写是文件，点了选中 */
  children?: TreeNode[];
  /** 图标：不写时文件夹用 Folder，文件按扩展名（和参考格同一份对照，认不出的用 File） */
  icon?: IconName;
}

export interface TreeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue'> {
  /** 数据：一层一层的节点，按给的顺序排 */
  items: TreeNode[];
  /** 选中的文件 id（受控）。只有文件能选中，文件夹点了是展开收起 */
  selected?: string | null;
  /** 默认选中的文件 id（非受控） */
  defaultSelected?: string | null;
  /** 选中变化：点文件、回车、空格 */
  onSelectedChange?: (id: string) => void;
  /** 展开的文件夹 id（受控） */
  expanded?: string[];
  /** 默认展开的文件夹 id（非受控）。文件选择器一般传选中文件的上层文件夹 */
  defaultExpanded?: string[];
  /** 展开收起变化 */
  onExpandedChange?: (ids: string[]) => void;
}

/** 文件夹的 id：选中文件的所有上层，给 defaultExpanded 用 */
export function treeAncestors(items: TreeNode[], id: string): string[] {
  const walk = (nodes: TreeNode[], path: string[]): string[] | null => {
    for (const n of nodes) {
      if (n.id === id) return path;
      if (n.children) {
        const hit = walk(n.children, [...path, n.id]);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(items, []) ?? [];
}

const ROW = '[role="treeitem"]';
/** 行高 36 + 行间距 4：给 Collapse 算展开的距离 */
const ROW_STEP = 40;

/** 展开后看得见的行数：算 Collapse 的距离用 */
function visibleCount(nodes: TreeNode[], open: Set<string>): number {
  return nodes.reduce((sum, n) => sum + 1 + (n.children && open.has(n.id) ? visibleCount(n.children, open) : 0), 0);
}

/**
 * 树：一层一层能展开的列表，比如技能包里的文件。文件夹点了展开收起，文件点了选中。
 * 键盘照 WAI-ARIA tree：上下走、右展开 / 进下一层、左收起 / 回上一层、Home / End、回车空格选中。
 * Figma 还没有
 */
export const Tree = forwardRef<HTMLDivElement, TreeProps>(function Tree(
  {
    items,
    selected: selectedProp,
    defaultSelected = null,
    onSelectedChange,
    expanded: expandedProp,
    defaultExpanded = [],
    onExpandedChange,
    className,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const [selected, setSelected] = useControllable<string | null>(selectedProp, defaultSelected, (v) => v != null && onSelectedChange?.(v));
  const [expanded, setExpanded] = useControllable(expandedProp, defaultExpanded, onExpandedChange);
  const open = new Set(expanded);
  const rootRef = useRef<HTMLDivElement>(null);
  const setRoot = useMergedRef(rootRef, ref);

  const toggle = (id: string, to = !open.has(id)) => {
    if (to === open.has(id)) return;
    setExpanded(to ? [...expanded, id] : expanded.filter((x) => x !== id));
  };

  // 能 Tab 进来的只有一行（roving tabindex）：选中的那行看得见就是它，不然是第一行
  const visibleIds: string[] = [];
  const collect = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      visibleIds.push(n.id);
      if (n.children && open.has(n.id)) collect(n.children);
    });
  collect(items);
  const tabStop = selected != null && visibleIds.includes(selected) ? selected : visibleIds[0];

  /** 看得见的行（收起的文件夹里的不算） */
  const rows = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>(ROW) ?? []).filter((el) => !el.closest('[data-tree-hidden]'));
  const focusRow = (el?: HTMLElement | null) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  };

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>(ROW);
    if (!row || !e.currentTarget.contains(row)) return;
    const list = rows();
    const i = list.indexOf(row);
    const id = row.dataset.id!;
    const folder = row.hasAttribute('aria-expanded');
    const isOpen = row.getAttribute('aria-expanded') === 'true';
    const level = Number(row.getAttribute('aria-level'));
    switch (e.key) {
      case 'ArrowDown':
        focusRow(list[i + 1]);
        break;
      case 'ArrowUp':
        focusRow(list[i - 1]);
        break;
      case 'Home':
        focusRow(list[0]);
        break;
      case 'End':
        focusRow(list[list.length - 1]);
        break;
      case 'ArrowRight':
        if (!folder) return;
        if (!isOpen) toggle(id, true);
        // 已展开：进到第一个子项
        else if (Number(list[i + 1]?.getAttribute('aria-level')) > level) focusRow(list[i + 1]);
        break;
      case 'ArrowLeft':
        if (folder && isOpen) toggle(id, false);
        // 回到上一层的文件夹
        else for (let j = i - 1; j >= 0; j--) if (Number(list[j].getAttribute('aria-level')) < level) return void (e.preventDefault(), focusRow(list[j]));
        break;
      case 'Enter':
      case ' ':
        // 走点击：放在下拉里时，点了文件下拉会关
        row.click();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const render = (nodes: TreeNode[], level: number): ReactElement[] =>
    nodes.map((n, i) => {
      const folder = n.children !== undefined;
      const isOpen = folder && open.has(n.id);
      const isSelected = !folder && n.id === selected;
      const distance = folder ? visibleCount(n.children!, open) * ROW_STEP : 0;
      const click = (e: MouseEvent<HTMLDivElement>) => {
        e.currentTarget.focus({ preventScroll: true });
        if (folder) toggle(n.id);
        else setSelected(n.id);
      };
      return (
        <div key={n.id} className="kv-tree__node" role="none">
          <div
            role="treeitem"
            className="kv-tree__item"
            data-id={n.id}
            aria-level={level}
            aria-setsize={nodes.length}
            aria-posinset={i + 1}
            aria-expanded={folder ? isOpen : undefined}
            aria-selected={folder ? undefined : isSelected}
            tabIndex={n.id === tabStop ? 0 : -1}
            // 箭头转动和下面这块展开同一个时长（Collapse 的取法：100 以内 200ms，再长 300ms）
            style={{ '--kv-tree-level': level - 1, '--kv-tree-duration': `var(--motion-duration-${distance > 100 ? 300 : 200})` } as CSSProperties}
            onClick={click}
          >
            {/* 文件没有箭头，留出同样宽的空，图标和同层文件夹的图标对齐 */}
            <span className="kv-tree__arrow" aria-hidden>
              {folder && <Icon name="RightArrowSmall" />}
            </span>
            <Icon name={n.icon ?? (folder ? 'Folder' : fileIcon(n.name.split('.').pop()))} />
            <span className="kv-tree__name">{n.name}</span>
          </div>
          {folder && (
            <Collapse
              role="group"
              className="kv-tree__group"
              expanded={isOpen}
              gap={4}
              distance={distance}
              data-tree-hidden={isOpen ? undefined : ''}
            >
              <div className="kv-tree__list">{render(n.children!, level + 1)}</div>
            </Collapse>
          )}
        </div>
      );
    });

  return (
    <div ref={setRoot} role="tree" className={cx('kv-tree', className)} onKeyDown={composeHandlers(onKeyDown, keys)} {...rest}>
      <div className="kv-tree__list">{render(items, 1)}</div>
    </div>
  );
});
Tree.displayName = 'Tree';
