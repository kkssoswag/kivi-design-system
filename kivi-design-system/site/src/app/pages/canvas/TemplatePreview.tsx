import { useLayoutEffect, useRef, useState } from 'react';
import { Connector } from '@kivi';
import type { WorkflowTemplate } from '../../data/types';
import { boundsOf, edgeBox, fitView, inPort, outPort, rectOf } from './geometry';
import { NodeView } from './NodeView';

/*
  工作流预览（照线上 WorkflowPreview：只读的画布，看节点和连线）：整段放进框里居中，最大 100%，不能点、不能拖。
  节点、连线和画布里画的是同一套（NodeView、Connector），应用后看到的一样。
*/

export function TemplatePreview({ template, className }: { template: WorkflowTemplate; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodes = template.nodes.filter((n) => n.type !== 'group');
  const b = boundsOf(nodes.map(rectOf));
  const view = b && size.w ? fitView(b, size.w, size.h, 48, 1, 0.1) : null;
  const byId = (id: string) => nodes.find((n) => n.id === id);

  return (
    <div ref={box} className={`tpl-cb ${className ?? ''}`} {...{ inert: '' }}>
      {view && (
        <div className="tpl-cb__world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          {template.edges.map((e, i) => {
            const a = byId(e.from);
            const z = byId(e.to);
            if (!a || !z) return null;
            const eb = edgeBox(outPort(a), inPort(z));
            return (
              <Connector
                key={i}
                className="tpl-cb__edge"
                width={eb.width}
                height={eb.height}
                direction={eb.direction}
                style={{ left: eb.left, top: eb.top, transform: eb.flip ? 'scaleX(-1)' : undefined }}
              />
            );
          })}
          {nodes.map((n) => (
            <div key={n.id} className="tpl-cb__node" style={{ left: n.x, top: n.y }}>
              <NodeView node={n} now={0} inLinked={template.edges.some((e) => e.to === n.id)} outLinked={template.edges.some((e) => e.from === n.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
