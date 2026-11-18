import { Fragment } from 'react';
import { Divider, ScrollArea, TabItem, Tabs } from '@kivi';
import { TOOLS, type ToolId } from '../../data/tools';

/*
  工具栏：选项卡竖排（图标在上、字在下），图片、视频两组中间一条短线（11-17 用户定，照美图设计室）。
*/

export function ToolsRail({ tool, onChange }: { tool: ToolId; onChange: (t: ToolId) => void }) {
  return (
    <ScrollArea className="tpl-at__tools">
      <Tabs layout="vertical" value={tool} onChange={(v) => onChange(v as ToolId)} aria-label="AI 工具" className="tpl-at__tools-body">
        {(['image', 'video'] as const).map((m) => (
          <Fragment key={m}>
            {m === 'video' && <Divider />}
            {TOOLS.filter((t) => t.media === m).map((t) => (
              <TabItem key={t.id} value={t.id} icon={t.icon}>
                {t.name}
              </TabItem>
            ))}
          </Fragment>
        ))}
      </Tabs>
    </ScrollArea>
  );
}
