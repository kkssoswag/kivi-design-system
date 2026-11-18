import type { Media, Ratio } from './types';

/*
  Agent 的假回复剧本。每次发送随机挑一个（11-18 用户定），一步步播出来：思考、说话、工具调用、生成（不出确认卡）、等结果（创作页没有推荐问题，11-18 用户定）。
  文字里的 {prompt} 换成用户发的话（截短），{refs} 换成附件的说法。加剧本只改这里。
*/

export interface ScriptGenerate {
  media: Media;
  count: number;
  ratio: Ratio;
  /** 模型 id（generation/options.ts） */
  model: string;
  params: Record<string, string>;
  /** 每张多少猕猴桃 */
  unitCost: number;
}

export type Beat =
  | { think: string }
  | { say: string }
  | { tools: { icon: string; action: string; object?: string }[] }
  /** 直接提交生成（扣费），等结果出来再往下走 */
  | { generate: ScriptGenerate };

export interface AgentScript {
  id: string;
  beats: Beat[];
}

export const AGENT_SCRIPTS: AgentScript[] = [
  {
    id: 'poster',
    beats: [
      { think: '用户想要一组海报。先确认风格方向：{refs}主体放中间，留出标题位置，竖版更适合手机传播。一次出 4 张，风格略有差别方便挑。' },
      { say: '好的，我先看看需求和参考。' },
      {
        tools: [
          { icon: 'Skill', action: '加载技能', object: '海报设计' },
          { icon: 'ScanEye', action: '查看参考内容', object: '参考图' },
          { icon: 'SquareLibrary', action: '查询知识库', object: '品牌规范' },
        ],
      },
      { say: '风格定了：主体居中、冷暖对比、顶部留标题区。下面按这个方向生成 4 张竖版海报。' },
      { generate: { media: 'image', count: 4, ratio: '9:16', model: 'seedream-4.5', params: { resolution: '2K', ratio: '9:16' }, unitCost: 4 } },
      { say: '4 张海报生成好了，第 2 张的构图最稳，第 4 张颜色更跳。需要的话可以选一张继续细化。' },
    ],
  },
  {
    id: 'video',
    beats: [
      { think: '这是一个短视频需求。镜头节奏要轻快，5 秒左右，开头 1 秒内给出主体，结尾留品牌露出。{refs}' },
      {
        tools: [
          { icon: 'Skill', action: '加载技能', object: '短视频脚本' },
          { icon: 'Brain', action: '读取记忆', object: '偏好：横版 16:9' },
        ],
      },
      { say: '我把镜头拆成三段：推近主体、主体动作、品牌定格。按你之前偏好的横版来生成。' },
      { generate: { media: 'video', count: 1, ratio: '16:9', model: 'seedance-2.0-fast', params: { resolution: '720P', ratio: '16:9', duration: '5' }, unitCost: 30 } },
      { say: '视频好了。如果节奏偏慢，我可以把第一段缩短，或者再出一个竖版。' },
    ],
  },
  {
    id: 'advice',
    beats: [
      { think: '用户在问思路，不需要马上生成。先给出可执行的方向，再问要不要直接出图。' },
      { tools: [{ icon: 'SquareLibrary', action: '查询知识库', object: '设计案例' }] },
      {
        say: '关于「{prompt}」，可以从三个方向入手：\n1. 主体突出：画面只留一个视觉重点，背景做减法。\n2. 情绪先行：先定颜色和光线，再放内容，整体更统一。\n3. 系列感：同一套版式换不同主体，适合连续发布。\n要我按其中一个方向直接出图吗？',
      },
    ],
  },
  {
    id: 'edit',
    beats: [
      { say: '收到，我先看一下要改的地方。' },
      {
        tools: [
          { icon: 'ScanEye', action: '查看参考内容', object: '原图' },
          { icon: 'Skill', action: '加载技能', object: '智能编辑' },
        ],
      },
      { think: '保持原图构图和主体不变，只调整背景和光线；出 2 张方便对比。' },
      { say: '我会保留主体和构图，只换背景、统一光线，出 2 张给你对比。' },
      { generate: { media: 'image', count: 2, ratio: '1:1', model: 'nano-banana-2', params: { resolution: '2K', ratio: '1:1' }, unitCost: 5 } },
      { say: '改好了，左边偏自然光，右边偏棚拍质感。' },
    ],
  },
  {
    id: 'brainstorm',
    beats: [
      { think: '先发散几个方向，用户挑了再落地，避免一次生成浪费猕猴桃。' },
      { say: '先给你几个方向，挑一个我再出图：\n· 清新：浅绿底、大量留白、手写字标题\n· 潮流：高饱和撞色、粗体字、贴纸元素\n· 质感：深色背景、产品打光、极简排版' },
    ],
  },
];

export const scriptOf = (id: string) => AGENT_SCRIPTS.find((s) => s.id === id) ?? AGENT_SCRIPTS[0];

/** 随机挑一个剧本；传了 avoid 尽量不和它重复（重新生成时换一个） */
export function pickScript(avoid?: string) {
  const pool = AGENT_SCRIPTS.filter((s) => s.id !== avoid);
  return pool[Math.floor(Math.random() * pool.length)].id;
}
