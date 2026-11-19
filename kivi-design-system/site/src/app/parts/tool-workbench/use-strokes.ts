import { useState } from 'react';
import { UNDO_STEPS } from './options';
import type { Stroke } from './mask-layer';

/*
  涂抹的笔迹：撤销、重做，撤销最多 30 步（更早的笔迹留在图上，只是撤不掉了）。
*/

interface State {
  strokes: Stroke[];
  redo: Stroke[];
  /** 还能撤销几步 */
  undoable: number;
}
const EMPTY: State = { strokes: [], redo: [], undoable: 0 };

export function useStrokes() {
  const [s, setS] = useState<State>(EMPTY);
  return {
    strokes: s.strokes,
    canUndo: s.undoable > 0,
    canRedo: s.redo.length > 0,
    add: (stroke: Stroke) => setS((p) => ({ strokes: [...p.strokes, stroke], redo: [], undoable: Math.min(UNDO_STEPS, p.undoable + 1) })),
    undo: () =>
      setS((p) => (p.undoable ? { strokes: p.strokes.slice(0, -1), redo: [p.strokes[p.strokes.length - 1], ...p.redo], undoable: p.undoable - 1 } : p)),
    redo: () => setS((p) => (p.redo.length ? { strokes: [...p.strokes, p.redo[0]], redo: p.redo.slice(1), undoable: p.undoable + 1 } : p)),
    reset: () => setS(EMPTY),
  };
}
