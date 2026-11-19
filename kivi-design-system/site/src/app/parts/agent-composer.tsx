import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttachmentStrip, DropOverlay, Dropdown, Menu, MenuItem, UPLOAD_SPECS, referenceTypeOf, GenModelPicker, IconButton, MentionChip, PromptInput, SendButton, SkillPicker, placeholderImageSrc, toast, type AttachmentItem, type IconName, type PlaceholderImageName } from '@kivi';
import { checkFiles, rejectMessage, useControllable, useFileDrop, usePasteFiles } from '@kivi/hooks';
import { SKILL_CATEGORIES, SKILL_ITEMS } from '../../docs/business/skill-data';

// Agent 输入框：画布页右侧 Agent、创作首页「画布」、技能面板模板共用这一份。
// 传了 onSend 才能发：发出去后输入框和附件条清空；回复中发送按钮变停止

/** 发出去的东西：文字和附件（附件按附件条里的顺序） */
export interface AgentComposerMessage {
  text: string;
  attachments: AttachmentItem[];
  /** 手动（生成前先确认）/ 自动生成 */
  mode: AgentMode;
}

export type AgentMode = 'manual' | 'auto';

export interface AgentComposerProps {
  /** 附件（受控）：画布里「添加到对话」往这里加 */
  attachments?: AttachmentItem[];
  /** 一开始已经添加的附件（非受控），不传就没有附件条 */
  defaultAttachments?: AttachmentItem[];
  /** 附件变了（加、删、发送后清空） */
  onAttachmentsChange?: (attachments: AttachmentItem[]) => void;
  /** Agent 正在回复：发送按钮变停止 */
  generating?: boolean;
  /** 回复中点了停止 */
  onStop?: () => void;
  /** 技能面板一进来就开着（技能面板模板用） */
  skillOpen?: boolean;
  /** 一进来输入框里就带着这个技能的引用（探索页技能点「使用」进来的） */
  skill?: string;
  /** 模型偏好、技能面板往哪边弹：贴底部时往上（默认），创作首页在上面往下 */
  placement?: 'top-start' | 'bottom-start';
  /** 点发送（有字时）。不传就只能看 */
  onSend?: (message: AgentComposerMessage) => void;
  /** 输入框顶上一行：专家条（ExpertBar） */
  header?: ReactNode;
  /** 占位文字，默认「描述任何你想要生成的内容」；邀请了专家换成「告诉 XX 你想做什么，可以上传参考」 */
  placeholder?: string;
  /** 把这句话填进输入框（专家详情里点示例提问，不发送），key 变了才填 */
  fill?: { text: string; key: number };
  className?: string;
}

/** 拖进来的视频没有封面，用占位图顶 */
const DROP_COVERS: PlaceholderImageName[] = ['ip-peek', 'bunny-gouache', 'monstera-dots', 'kivi-future', 'ip-gouache'];

// Agent 输入框贴在侧栏底部：模型偏好、技能面板都往上弹（Dropdown 默认往下，用的地方改方向；放不下自己翻）
const UP = 'top-start' as const;

/** Agent 输入框：附件条、PromptInput、工具条（添加 / 模型偏好 / 技能 / 手 / 切换对话模型）、发送。拖文件进来盖一层「松手上传」 */
export function AgentComposer({
  attachments: attachmentsProp,
  defaultAttachments = [],
  onAttachmentsChange,
  generating,
  onStop,
  skillOpen,
  skill,
  placement = UP,
  onSend,
  header,
  placeholder = '描述任何你想要生成的内容',
  fill,
  className,
}: AgentComposerProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachmentsRaw] = useControllable(attachmentsProp, defaultAttachments, onAttachmentsChange);
  const latestAttachments = useRef(attachments);
  latestAttachments.current = attachments;
  const setAttachments = (fn: (list: AttachmentItem[]) => AttachmentItem[]) => setAttachmentsRaw(fn(latestAttachments.current));
  // 手动（生成前先出确认卡，默认）/ 自动生成：手的按钮点了选（照线上 AgentModeSelector）
  const [mode, setMode] = useState<AgentMode>('manual');
  // 输入框是 contentEditable：模型、技能插进去是 MentionChip（data-model 记值），删了标签就不算，用来判断每组选满没有
  const input = useRef<HTMLDivElement>(null);
  const [models, setModels] = useState<string[]>([]);
  const sync = () => {
    const el = input.current;
    if (!el) return;
    setModels([...el.querySelectorAll<HTMLElement>('[data-model]')].map((c) => c.dataset.model!));
    setText((el.textContent ?? '').trim() || (el.querySelector('.kv-mention-chip') ? '@' : ''));
  };
  const insertChip = (chip: ReactElement) => {
    const el = input.current;
    if (!el) return;
    const box = document.createElement('div');
    box.innerHTML = renderToStaticMarkup(chip);
    el.append(...box.childNodes, document.createTextNode(' '));
    el.focus();
    sync();
  };
  const insertModel = (m: { value: string; label: string; icon?: IconName }) =>
    insertChip(
      <MentionChip type="model" icon={m.icon} data-model={m.value}>
        {m.label}
      </MentionChip>,
    );

  // 带进来的技能：挂上就插一个技能引用，只插一次（开发模式挂载时 effect 会跑两遍）
  const skillInserted = useRef(false);
  useEffect(() => {
    if (!skill || skillInserted.current) return;
    skillInserted.current = true;
    insertChip(
        <MentionChip type="skill" data-skill={skill}>
          {skill}
        </MentionChip>,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 专家详情里点示例提问：这句话换掉输入框里的字（不发送）
  useEffect(() => {
    const el = input.current;
    if (!fill || !el) return;
    el.textContent = fill.text;
    el.focus();
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill]);

  const send = () => {
    const el = input.current;
    const value = (el?.textContent ?? '').trim();
    if (!value || !onSend) return;
    onSend({ text: value, attachments, mode });
    // 发出去就清空（对话输入框的习惯）
    if (el) el.textContent = '';
    setText('');
    setModels([]);
    setAttachments(() => []);
  };

  // 加附件（拖进来、粘贴）：先过上传校验（通用那套：图 ≤50MB、视频 ≤50MB ≤600s、音频 ≤15MB 2–600s），不合格弹 Toast 不加。
  // 合格的加进附件条（图片、音频用本地文件，视频缩略图用占位图）
  const addFiles = async (files: File[]) => {
    const { accepted, message } = await checkFiles(files, (f) => UPLOAD_SPECS.general[referenceTypeOf(f)]);
    if (message) toast.error(message);
    if (!accepted.length) return;
    setAttachments((list) => {
      const next = [...list];
      accepted.forEach((f, i) => {
        const type = referenceTypeOf(f);
        const src = type === 'video' ? placeholderImageSrc(DROP_COVERS[(next.length + i) % DROP_COVERS.length], '1:1') : URL.createObjectURL(f);
        next.push({ id: `drop-${Date.now()}-${i}`, type, name: f.name, src, video: type === 'video' ? URL.createObjectURL(f) : undefined });
      });
      return next;
    });
  };
  // 把文件拖到输入框上：盖一层「松手上传」，不收的类型提示不支持
  const { dragging, rejected, bind } = useFileDrop({
    accept: 'image/*,video/*,audio/*',
    onFiles: (files) => void addFiles(files),
    onReject: (_, reason) => toast.error(rejectMessage(reason)),
  });
  // 粘贴文件（照线上只取第一个）；粘的是字照常进输入框
  const paste = usePasteFiles({
    accept: 'image/*,video/*,audio/*',
    onFile: (f) => void addFiles([f]),
    onUnsupported: () => toast.error('剪贴板中的文件类型不支持，请检查文件格式'),
  });

  return (
    <div className={className ? `tpl-cv__composer ${className}` : 'tpl-cv__composer'} {...bind} {...paste}>
      {header}
      {attachments.length > 0 && <AttachmentStrip items={attachments} onRemove={(id) => setAttachments((list) => list.filter((a) => a.id !== id))} />}
      <PromptInput
        ref={input}
        className="tpl-cv__input"
        placeholder={placeholder}
        onInput={sync}
        // 回车发送，Shift + 回车换行；输入法选字时不算
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || !onSend) return;
          e.preventDefault();
          if (!generating) send();
        }}
      />
      <div className="tpl-cv__tools">
        <div>
          <IconButton icon="Add" label="添加" variant="ghost" />
          <GenModelPicker placement={placement} picked={models} onPick={insertModel} />
          <SkillPicker
            placement={placement}
            defaultOpen={skillOpen}
            items={SKILL_ITEMS}
            categories={SKILL_CATEGORIES}
            onPick={(sk) =>
              insertChip(
                <MentionChip type="skill" data-skill={sk.title}>
                  {sk.title}
                </MentionChip>,
              )
            }
          />
          <Dropdown placement={placement} trigger={<IconButton icon="Hand" label={mode === 'manual' ? '手动模式：生成前先确认' : '自动生成：不再询问'} variant="ghost" />}>
            <Menu width={200}>
              <MenuItem selected={mode === 'manual'} description="每次生成前先确认" onClick={() => setMode('manual')}>
                手动模式
              </MenuItem>
              <MenuItem selected={mode === 'auto'} description="Agent 完全自动生成" onClick={() => setMode('auto')}>
                自动生成
              </MenuItem>
            </Menu>
          </Dropdown>
          {/* 切换对话用的大模型（GPT、Claude、千问…）：内部测试用的隐藏功能，图标是当前模型的厂商 Logo */}
          <IconButton icon="Openai" label="切换对话模型（内部测试）" variant="ghost" />
        </div>
        {/* 没传 onSend 只能看：有字也发不出去 */}
        <SendButton disabled={!generating && !text.trim()} generating={generating} onClick={generating ? onStop : send} />
      </div>
      <DropOverlay active={dragging} rejected={rejected} />
    </div>
  );
}
