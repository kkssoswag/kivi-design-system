import { useState, type ReactNode } from 'react';
import { Avatar, Button, Dialog, Dropdown, EmptyState, ExploreCard, ExploreCover, Input, Menu, Prose, Select, Tag, Tree, placeholderImageSrc, type SkillItem } from '@kivi';
import { SKILLS, SKILL_CATS, SKILL_FILES, SKILL_TREE, skillTreeExpanded, type ExploreSkill } from '../../data/catalog';
import { useDebounced } from '../../hooks/useDebounced';
import { usePaged, type MoreRef } from '../../hooks/usePaged';
import { useLastShown } from '../../parts/media-viewer';
import { CardSkeleton, CategoryTabs } from './shared';

/*
  探索 · 技能：公共技能，卡片点开是详情（名称、作者、封面、描述、技能内容），底部「使用」。
  技能内容默认看 SKILL.md，有别的文件用文件树切过去（需求「公共技能 · 技能详情」）。只匹配名称或描述。
*/

const SKILL_PAGE = 12;

function skillFile(s: SkillItem, file: string): ReactNode {
  if (file === 'SKILL.md')
    return (
      <>
        <h4>{s.title}</h4>
        <p>{s.description}</p>
        <ol>
          <li>先问清楚用途、尺寸和要放的文字。</li>
          <li>按主题出 4 个方向，每个方向一张草图。</li>
          <li>用户挑一个方向后，出完整版本并给出可以调整的地方。</li>
        </ol>
      </>
    );
  if (file.startsWith('references'))
    return (
      <>
        <h4>风格指南</h4>
        <ul>
          <li>主色用品牌绿，大面积留白。</li>
          <li>标题字号不小于画面高度的 8%。</li>
        </ul>
      </>
    );
  return (
    <>
      <h4>示例</h4>
      <p>「帮我做 4 张新春活动海报，竖版，标题写猕猴桃新年礼盒」</p>
    </>
  );
}

export function Skills({ onUse, moreRef, initialKeyword = '' }: { onUse: (s: ExploreSkill) => void; moreRef: MoreRef; initialKeyword?: string }) {
  const [category, setCategory] = useState('all');
  const [keyword, setKeyword] = useState(initialKeyword);
  const k = useDebounced(keyword.trim());
  const [detail, setDetail] = useState<ExploreSkill | null>(null);
  const shownSkill = useLastShown(detail);
  const [file, setFile] = useState(SKILL_FILES[0]);
  // 只匹配名称或描述（需求）
  const list = SKILLS.filter((s) => (category === 'all' || s.category === category) && (!k || s.title.includes(k) || s.description?.includes(k)));
  const { count, loading } = usePaged(list.length, SKILL_PAGE, `${category}|${k}`, moreRef);
  // 公开的技能一定有封面（11-10 用户定）
  const cover = (s: ExploreSkill) => s.poster ?? placeholderImageSrc(s.cover, '16:9');
  const who = (s: ExploreSkill) => s.author ?? { name: 'KIVI' };

  return (
    <>
      <div className="tpl-as__filters">
        <CategoryTabs label="技能分类" value={category} options={SKILL_CATS} onChange={setCategory} />
        <Input leftIcon="Search" clearable placeholder="搜索技能" aria-label="搜索技能" className="tpl-as__search" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <EmptyState size={160} title="没有找到相关技能" className="tpl-as__empty" />
      ) : (
        <div className="tpl-ex__grid">
          {list.slice(0, count).map((s) => (
            <ExploreCard
              key={s.id}
              name={s.title}
              description={s.description ?? ''}
              cover={cover(s)}
              video={s.video}
              author={s.author ?? { name: 'KIVI' }}
              onOpen={() => {
                setFile(SKILL_FILES[0]);
                setDetail(s);
              }}
            />
          ))}
          {loading && Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      )}
      {/* 详情：沿用现有技能详情：名称、作者、封面、描述、技能内容（默认 SKILL.md，可切文件），底部「使用」 */}
      <Dialog
        size={800}
        title={shownSkill?.title}
        open={detail !== null}
        onOpenChange={(v) => !v && setDetail(null)}
        footer={
          shownSkill && (
            <Button
              variant="primary"
              onClick={() => {
                setDetail(null);
                onUse(shownSkill);
              }}
            >
              使用
            </Button>
          )
        }
      >
        {shownSkill && (
          <div className="tpl-ex__skill">
            <span className="tpl-ex__shownSkill-author">
              <Avatar name={who(shownSkill).name} src={who(shownSkill).avatar} size={24} />
              {who(shownSkill).name}
              {shownSkill.recommended && <Tag>官方</Tag>}
            </span>
            <ExploreCover className="tpl-ex__skill-cover" src={cover(shownSkill)} video={shownSkill.video} playing={!!shownSkill.video} />
            <section className="tpl-ex__viewer-section">
              <h4>技能描述</h4>
              <p className="tpl-ex__skill-desc">{shownSkill.description}</p>
            </section>
            <section className="tpl-ex__viewer-section">
              <div className="tpl-ex__skill-files">
                <h4>技能内容</h4>
                <Dropdown
                  haspopup="tree"
                  placement="bottom-end"
                  trigger={
                    <Select variant="plain" leftIcon="File" aria-label="切换文件">
                      {file}
                    </Select>
                  }
                >
                  <Menu role="none">
                    <Tree aria-label="技能文件" items={SKILL_TREE} selected={file} onSelectedChange={setFile} defaultExpanded={skillTreeExpanded(file)} />
                  </Menu>
                </Dropdown>
              </div>
              <Prose className="tpl-ex__skill-content">{skillFile(shownSkill, file)}</Prose>
            </section>
          </div>
        )}
      </Dialog>
    </>
  );
}
