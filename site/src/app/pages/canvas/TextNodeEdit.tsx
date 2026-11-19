import { useEffect, useRef } from 'react';
import { NodeCard, NodeMedia, NodeWrapper, ScrollArea } from '@kivi';
import type { CanvasNode } from '../../data/types';
import './canvas-extra.css';

/*
  文字节点原地改字（照线上 nodes/text：双击进入编辑，点别处结束）。线上是富文本，这里只有纯文字：
  粘贴进来的只取文字，回车换行，Esc 或点到节点外面结束，结束时才写回（撤销一步回到改之前）。
  外框、连接点照 NodeView 的文字节点画，编辑时里面换成能打字的一块，超出了能滚。
*/

export interface TextNodeEditProps {
  node: CanvasNode;
  selected?: boolean;
  inLinked?: boolean;
  outLinked?: boolean;
  inHighlight?: boolean;
  /** 结束编辑：改后的文字（没改也给） */
  onDone: (text: string) => void;
}

export function TextNodeEdit({ node, selected, inLinked, outLinked, inHighlight, onDone }: TextNodeEditProps) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone((ref.current?.innerText ?? '').replace(/\n$/, ''));
  };
  // 进来就聚焦，光标放最后
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, []);

  return (
    <NodeWrapper
      name={node.name}
      leftDot={node.upload ? (inLinked ? 'connected' : undefined) : inHighlight ? 'highlight' : inLinked ? 'connected' : 'default'}
      rightDot={outLinked ? 'connected' : 'default'}
      selected={selected || undefined}
      style={{ width: node.w, height: node.h }}
    >
      <NodeCard status="done" type="text">
        <NodeMedia type="text">
          <ScrollArea className="app-cv-text-edit">
            <div
              ref={ref}
              className="app-cv-text-edit__input"
              contentEditable="plaintext-only"
              suppressContentEditableWarning
              spellCheck={false}
              role="textbox"
              aria-multiline
              aria-label={node.name}
              onBlur={finish}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  finish();
                }
              }}
            >
              {node.text ?? ''}
            </div>
          </ScrollArea>
        </NodeMedia>
      </NodeCard>
    </NodeWrapper>
  );
}
