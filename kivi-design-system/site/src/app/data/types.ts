import type { PlaceholderImageRatio } from '@kivi';

/*
  全站数据的形状。只放纯数据（能存进本机、能 JSON），不放 ReactNode：
  标签、图标这些由页面按数据画（比如任务的参数在页面里画成一排 Tag）。
*/

export type Media = 'image' | 'video' | 'audio';
export type Ratio = PlaceholderImageRatio;

/** 生成发生在哪：决定结果出现在哪一页 */
export type Where =
  | { page: 'create'; chatId: string }
  | { page: 'tools' }
  | { page: 'canvas'; canvasId: string; nodeId?: string };

/** 一次生成里的一格结果 */
export interface Output {
  status: 'running' | 'done' | 'failed';
  /** 成功后对应的素材 */
  assetId?: string;
}

/** 一次生成任务（主站一条记录、工具页一条历史、画布一次节点生成） */
export interface Task {
  id: string;
  kind: 'gen' | 'tool';
  media: Media;
  where: Where;
  /** 提示词，工具任务没有 */
  prompt?: string;
  /** 模型 id（generation/options.ts 里的 value） */
  model?: string;
  /** 工具 id（data/tools.ts），kind = tool 时有 */
  tool?: string;
  /** 显示的名字：工具名、智能编辑的编辑方式；生成任务不写 */
  label?: string;
  /** 参数，按显示顺序：比如 { 分辨率: '2K', 比例: '1:1', 时长: '5s' } */
  params: Record<string, string>;
  /** 参考素材 / 原图（工具任务的第一项是原图） */
  refs: { type: Media; src: string; label?: string }[];
  /** 参考方式的名字，比如「全能参考」「首尾帧」，没有不写 */
  refLabel?: string;
  ratio: Ratio;
  /** 每一格的结果 */
  outputs: Output[];
  cost: number;
  createdAt: number;
  /** 什么时候出结果 */
  dueAt: number;
  /** 假生成时结果直接用原图 refs[0]（抠图、高清这类，画面不变）；不写就按比例换一张占位图 */
  echo?: boolean;
  /** 演示用：一直停在生成中（种子数据里摆样子的） */
  hold?: boolean;
  /** hold 时角标上固定显示的剩余秒数（摆「59s 生成中」的样子），不写只显示「生成中」 */
  holdLeft?: number;
  /** 演示开关「下次生成失败」打开时提交的，到点失败 */
  willFail?: boolean;
  /** 整个任务的状态：生成中 / 完成（可能有几格失败） / 失败 / 取消 */
  status: 'running' | 'done' | 'failed' | 'cancelled';
  /** 失败文案 */
  error?: string;
}

/** 一个素材：生成出来的，或者上传的 */
export interface Asset {
  id: string;
  media: Media;
  src: string;
  /** 视频封面 */
  poster?: string;
  ratio: Ratio;
  /** 音频、视频时长，比如 '0:05' */
  duration?: string;
  name?: string;
  createdAt: number;
  /** 哪来的：会话（主站）/ 工具 / 画布 / 上传 */
  source: 'create' | 'tools' | 'canvas' | 'upload';
  /** 生成它的任务 */
  taskId?: string;
  collected: boolean;
  folderIds: string[];
  /** 本次上传的本地文件（blob 地址），不存进本机 */
  local?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

/** 主站对话里的一项：一次生成，或者一轮 Agent */
export type ChatItem = { kind: 'task'; taskId: string } | { kind: 'agent'; id: string };

export interface Chat {
  id: string;
  title: string;
  pinned?: boolean;
  updatedAt: number;
  items: ChatItem[];
}

export interface CanvasMeta {
  id: string;
  name: string;
  updatedAt: number;
  /** 封面：最近几张结果 */
  covers: string[];
  pinned?: boolean;
}

// ---------- Agent ----------

/** 用户发给 Agent 的一条消息 */
export interface AgentUserMessage {
  text: string;
  /** 带的素材（附件 / 参考），照发送时输入框里的顺序 */
  refs: { type: Media; src: string; name?: string; duration?: string }[];
}

/** Agent 回复里的一块，按顺序画 */
export type AgentBlock =
  /** 思考：done 前展开、扫光，done 后自动收起 */
  | { kind: 'thinking'; text: string; done: boolean }
  /** 一段回复文字：shown 是已经打出来的字数（逐字出） */
  | { kind: 'text'; text: string; shown: number }
  /** 一组工具调用：shown 是已经出现的行数 */
  | { kind: 'tools'; steps: { icon: string; action: string; object?: string }[]; shown: number; done: boolean }
  /** 生成的结果：一个任务（走 submitTask，和普通生成一样进素材） */
  | { kind: 'task'; taskId: string }
  /** 出错 */
  | { kind: 'error'; text: string };

export interface AgentTurn {
  id: string;
  chatId: string;
  user: AgentUserMessage;
  /** 用的哪个剧本（data/agent-scripts.ts） */
  script: string;
  /** 剧本走到第几步 */
  step: number;
  /** 这一步什么时候开始的（思考、工具调用按时间走） */
  beatAt: number;
  /** 回复中 / 等用户确认 / 完成 / 用户停止 / 出错 */
  status: 'running' | 'done' | 'stopped' | 'failed';
  blocks: AgentBlock[];
  createdAt: number;
}

export interface DB {
  /** 猕猴桃余额 */
  balance: number;
  tasks: Task[];
  assets: Asset[];
  folders: Folder[];
  chats: Chat[];
  canvases: CanvasMeta[];
  /** Agent 的每一轮（对话里 ChatItem kind = agent 指向它） */
  agentTurns: AgentTurn[];
  /** 探索页收藏的作品、技能、工作流 id */
  favorites: string[];
  /** 一次性的标记：新手引导看过没、余额提醒哪天弹过 */
  flags: Record<string, string | boolean>;
}
