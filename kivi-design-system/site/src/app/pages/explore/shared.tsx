import { Skeleton, TabItem, Tabs } from '@kivi';

/*
  探索页几块共用的小零件：分类条、卡片骨架。
*/

/** 分类：「全部」+ 后台配置的分类，一组选项卡 */
export function CategoryTabs({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Tabs value={value} onChange={onChange} aria-label={label}>
      <TabItem value="all">全部</TabItem>
      {options.map((c) => (
        <TabItem key={c} value={c}>
          {c}
        </TabItem>
      ))}
    </Tabs>
  );
}

/** 工作流卡的骨架：16:9 封面 + 标题、作者两行 */
export function CardSkeleton() {
  return (
    <div className="tpl-ex__card-skeleton" aria-hidden>
      <Skeleton style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 0 }} />
      <div className="tpl-ex__card-skeleton-body">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="30%" />
      </div>
    </div>
  );
}
