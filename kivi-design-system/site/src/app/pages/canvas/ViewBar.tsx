import { Button, ButtonGroup, IconButton, Minimap, Popover, type MinimapRect } from '@kivi';
import { GROUP_TEXT } from '../../rules/canvas-group';
import './canvas-extra.css';
import { ZOOM_MAX, ZOOM_MIN } from '../../rules/canvas';
import type { CanvasNode } from '../../data/types';
import type { View } from './geometry';

/*
  左下角视图工具栏（照线上 bottom-toolbar，同原来的小画布）：整理画布、小地图、适配画布、吸附、连线，缩小 / 比例 / 放大。
  小地图开着叠在上面。吸附默认关（照线上）。
  整理画布（照线上）：点了先整理出来给你看，按钮上方问「是否保留此次整理结果？」，取消回到原位、确定保留；问着的时候再点会照现在的位置再整理一遍。
*/

export interface ViewBarProps {
  className?: string;
  view: View;
  size: { w: number; h: number };
  nodes: CanvasNode[];
  minimap: boolean;
  onMinimap: (on: boolean) => void;
  snap: boolean;
  onSnap: (on: boolean) => void;
  hideLines: boolean;
  onHideLines: (on: boolean) => void;
  onFit: () => void;
  /** 1 放大、-1 缩小、0 回 100% */
  onZoom: (dir: 1 | -1 | 0) => void;
  /** 小地图上拖视口框：视口中心挪到这个世界坐标（Minimap 给的就是中心） */
  onPan: (center: { x: number; y: number }) => void;
  /** 整理画布预览中（在问保不保留） */
  tidying: boolean;
  onTidy: () => void;
  onTidyCancel: () => void;
  onTidyKeep: () => void;
}

export function ViewBar({ className, view, size, nodes, minimap, onMinimap, snap, onSnap, hideLines, onHideLines, onFit, onZoom, onPan, tidying, onTidy, onTidyCancel, onTidyKeep }: ViewBarProps) {
  const area: MinimapRect = { x: -view.x / view.k, y: -view.y / view.k, width: size.w / view.k || 1, height: size.h / view.k || 1 };
  return (
    <div className={['cv-view', className].filter(Boolean).join(' ')}>
      {minimap && (
        <Minimap
          nodes={nodes.filter((n) => n.type !== 'group').map((n) => ({ x: n.x, y: n.y, width: n.w, height: n.h }))}
          viewport={area}
          onViewportChange={onPan}
        />
      )}
      <ButtonGroup variant="glass" aria-label="视图">
        <Popover
          variant="panel"
          on="click"
          placement="top-start"
          open={tidying}
          // 只能点「取消」「确定」关（照线上），点外面、Esc 不关
          onOpenChange={() => undefined}
          onInteractOutside={(e) => e.preventDefault()}
          content={
            <div className="app-cv-tidy" role="dialog" aria-label={GROUP_TEXT.tidy}>
              <p>{GROUP_TEXT.tidyConfirm}</p>
              <div className="app-cv-actions">
                <Button onClick={onTidyCancel}>取消</Button>
                <Button variant="primary" onClick={onTidyKeep}>
                  确定
                </Button>
              </div>
            </div>
          }
        >
          <IconButton icon="AutoLayout" label={GROUP_TEXT.tidy} tooltip={!tidying} onClick={onTidy} />
        </Popover>
        <IconButton icon="Map" label="小地图" selected={minimap} onClick={() => onMinimap(!minimap)} />
        <IconButton icon="FitContent" label="适配画布" onClick={onFit} />
        <IconButton icon={snap ? 'Snap' : 'DisableSnap'} label={snap ? '关闭网格吸附' : '开启网格吸附'} onClick={() => onSnap(!snap)} />
        <IconButton icon={hideLines ? 'HideConnections' : 'ShowConnections'} label={hideLines ? '显示节点连线' : '隐藏节点连线'} onClick={() => onHideLines(!hideLines)} />
        <IconButton icon="SubtractSmall" label="缩小" disabled={view.k <= ZOOM_MIN + 0.001} onClick={() => onZoom(-1)} />
        <Button style={{ minWidth: 48 }} onClick={() => onZoom(0)}>
          {Math.round(view.k * 100)}%
        </Button>
        <IconButton icon="AddSmall" label="放大" disabled={view.k >= ZOOM_MAX - 0.001} onClick={() => onZoom(1)} />
      </ButtonGroup>
    </div>
  );
}
