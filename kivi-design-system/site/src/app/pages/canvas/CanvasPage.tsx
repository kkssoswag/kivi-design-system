import { useRef, useState } from 'react';
import type { AttachmentItem } from '@kivi';
import { ButtonGroup, CanvasHeader, Dropdown, IconButton, placeholderImageSrc, toast, type CanvasItem as HeaderItem } from '@kivi';
import { insertTemplate, placeAsset, useCanvasDoc } from '../../data/canvas-doc';
import { syncCanvasList } from '../../data/canvases';
import type { AgentComposerMessage } from '../../parts/agent-composer';
import { useDB } from '../../data/db';
import type { CanvasItem, CanvasNode } from '../../data/types';
import { MediaViewer, ViewerAuthor, ViewerSection, useLastShown } from '../../parts/media-viewer';
import { CanvasAgent, nodeAttachment, useAgentSelect } from './CanvasAgent';
import { CanvasBoard, type CanvasBoardHandle } from './CanvasBoard';
import { HistoryPanel } from './HistoryPanel';
import { ProcessorHost } from './processor/ProcessorHost';
import { AddNodeMenu } from './menus';
import { ShareButton } from './ShareButton';
import { WorkflowPanel } from './WorkflowPanel';

/*
  画布页：左边画布（左上角画布切换、底部画布工具栏、左下角视图工具栏），右边 Agent 侧栏。
  新建画布在进来之前就建好了（App 里），这里只管打开。点左上角 Logo 回创作页。
*/

export interface CanvasPageProps {
  /** 打开哪块画布 */
  canvasId: string;
  /** 换了画布（画布切换、新建） */
  onCanvasChange?: (id: string) => void;
  /** 探索页技能「使用」进来：Agent 输入框带着这个技能 */
  skill?: string;
  /** 创作首页「画布」输入框里发的那句话：进来 Agent 接着发 */
  intro?: AgentComposerMessage;
  onHome?: () => void;
}

export function CanvasPage({ canvasId: id, onCanvasChange, skill, intro, onHome }: CanvasPageProps) {
  const canvases = useDB((s) => s.canvases);
  const doc = useCanvasDoc(id);
  const board = useRef<CanvasBoardHandle>(null);
  const [viewing, setViewing] = useState<{ item: CanvasItem; node: CanvasNode } | null>(null);
  const shown = useLastShown(viewing);
  const list: HeaderItem[] = canvases.map((c) => ({ id: c.id, name: c.name }));
  // 「添加到对话」的节点：进 Agent 输入框的附件条，按节点去重（照线上）
  const [chatAttachments, setChatAttachments] = useState<AttachmentItem[]>([]);
  const addToChat = (ids: string[]) => {
    const add = ids.map((nid) => nodeAttachment(id, nid)).filter((a): a is AttachmentItem => !!a);
    if (!add.length) return;
    setChatAttachments((list) => [...list, ...add.filter((a) => !list.some((x) => x.id === a.id))]);
    toast.success('已添加到对话');
  };
  // 底部「工作流」面板、「历史」弹窗
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Agent 建了节点：画布选中它
  useAgentSelect(id, (ids) => board.current?.select(ids));

  return (
    <div className="tpl-cv">
      <div className="tpl-cv__main">
        <CanvasBoard key={id} ref={board} canvasId={id} onView={(item, node) => setViewing({ item, node })} onAddToChat={addToChat} />
        {/* 左上角：Logo｜工作区｜画布切换 */}
        <CanvasHeader
          className="tpl-cv__header"
          workspace="KIVI 工作区"
          canvases={list}
          onCanvasesChange={syncCanvasList}
          value={id}
          onChange={(next) => onCanvasChange?.(next)}
          onLogoClick={onHome}
        />
        {/* 右上角：分享 */}
        <ShareButton canvasId={id} />
        {/* 底部正中：画布工具栏（ButtonGroup 实色 · 56）：添加（主要）、工作流、上传、历史 */}
        <ButtonGroup variant="surface" size={56} aria-label="画布工具栏" className="tpl-cv__toolbar">
          <Dropdown placement="top-start" trigger={<IconButton icon="Add" label="添加" variant="primary" />}>
            <AddNodeMenu doc={doc} onPick={(type, preset) => board.current?.addAtCenter(type, preset)} />
          </Dropdown>
          <WorkflowPanel
            open={workflowOpen}
            onOpenChange={setWorkflowOpen}
            onApply={(wf) => {
              // 照线上：整段套进一个以工作流名命名的组，选中这个组
              const ids = insertTemplate(id, wf.template, wf.name);
              // 下一帧再定位：等新节点画出来
              requestAnimationFrame(() => board.current?.focus(ids));
            }}
          >
            <IconButton icon="Template" label="工作流" selected={workflowOpen} tooltip={!workflowOpen} />
          </WorkflowPanel>
          <IconButton icon="Upload" label="上传" onClick={() => board.current?.upload()} />
          <IconButton icon="History" label="历史" onClick={() => setHistoryOpen(true)} />
        </ButtonGroup>
      </div>
      <CanvasAgent
        canvasId={id}
        skill={skill}
        onLocate={(ids) => board.current?.focus(ids)}
        intro={intro}
        attachments={chatAttachments}
        onAttachmentsChange={setChatAttachments}
      />

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onApply={(asset) => {
          const nid = placeAsset(id, asset);
          requestAnimationFrame(() => board.current?.select([nid]));
        }}
      />

      <ProcessorHost canvasId={id} />

      <MediaViewer
        media={viewing && { type: viewing.node.type === 'video' ? 'video' : viewing.node.type === 'audio' ? 'audio' : 'image', src: viewing.item.src, poster: viewing.item.poster, name: viewing.node.name }}
        onClose={() => setViewing(null)}
        head={<ViewerAuthor name="KIVI" avatar={placeholderImageSrc('ip-peek', '1:1')} date="今天" />}
        actions={<IconButton icon="Download" label="下载" variant="secondary" size={36} onClick={() => toast.success('已开始下载')} />}
      >
        {shown?.node.prompt && <ViewerSection title="提示词">{shown.node.prompt}</ViewerSection>}
      </MediaViewer>
    </div>
  );
}
