import { Button, ButtonGroup, IconButton, Minimap, toast, type MinimapRect } from '@kivi';
import { ZOOM_MAX, ZOOM_MIN } from '../../rules/canvas';
import type { CanvasNode } from '../../data/types';
import type { View } from './geometry';

/*
  左下角视图工具栏（照线上 bottom-toolbar，同原来的小画布）：整理画布、小地图、适配画布、吸附、连线，缩小 / 比例 / 放大。
  小地图开着叠在上面。吸附默认关（照线上）。整理画布下一步做。
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
}

export function ViewBar({ className, view, size, nodes, minimap, onMinimap, snap, onSnap, hideLines, onHideLines, onFit, onZoom, onPan }: ViewBarProps) {
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
        <IconButton icon="AutoLayout" label="整理画布" onClick={() => toast.info('整理画布下一步接上')} />
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
