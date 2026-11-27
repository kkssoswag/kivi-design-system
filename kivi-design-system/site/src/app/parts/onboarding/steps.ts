import type { PopoverPlacement } from '@kivi';
import type { ChapterId, HomeMode } from '../../data/onboarding';

/*
  新手引导每一章、每一步指着哪、说什么。目标按 data-tour（页面上标的）或现有的类名、aria-label 找，找不到就跳过那一步。
  文案越短越好：一句说清是什么、什么时候用（11-27 用户定：不要废话）。
*/

export interface GuideStep {
  /** 指着谁：每次现找，页面上没有（或藏着）就返回 null */
  target: () => Element | null;
  title: string;
  /** 一句话说明 */
  description?: string;
  /** 分几项说：「名称」+ 一句话 */
  items?: [string, string][];
  placement: PopoverPlacement;
  /** 主按钮的字，不写就是「下一步」，最后一步「知道了」 */
  nextText?: string;
  /** 讲这一步时让它保持悬停的样子（侧栏标题右边悬停才出的「+」） */
  hover?: () => Element | null;
}

export interface Chapter {
  steps: GuideStep[];
  /** 分章导览压暗页面；单条小提示不压暗 */
  spotlight: boolean;
  /** 创作首页的章：讲之前切到「生成」还是「画布」 */
  mode?: HomeMode;
}

/** 页面上有、而且没藏着 */
const shown = (el: Element | null | undefined) => (el && el.getClientRects().length > 0 ? el : null);
const q = (selector: string) => () => shown(document.querySelector(selector));

/** 首页两套输入框都挂着，只认正在显示的那套 */
const BOX = '[data-tour="home-composer"] .tpl-home__box[data-active]';

/** 侧栏的一段（对话 / 画布）：标题连着下面的列表；标题右边的「+」悬停才出，讲的时候一直亮着 */
const sideLabel = (name: string) => () => shown(document.querySelector(`[data-tour="${name}"]`));
const sideGroup = (name: string) => () => {
  const label = sideLabel(name)();
  return shown(label?.closest('.kv-menu__group') ?? label);
};

/** 对话里最后一条有成品的生成记录，和它里面的东西 */
function doneRecord() {
  const records = [...document.querySelectorAll('.tpl-ms__feed .tpl-record')];
  return records.reverse().find((r) => r.querySelector('.kv-result-tile:not([aria-busy]):not([aria-invalid])')) ?? null;
}
const inRecord = (selector: string) => () => shown(doneRecord()?.querySelector(selector));

/** 对话里最后一个写着这几个字的按钮（Agent 回复下面的「重新生成」） */
const lastButton = (text: string) => () => {
  const buttons = [...document.querySelectorAll('.tpl-ms__feed button')].filter((b) => b.textContent?.trim() === text);
  return shown(buttons[buttons.length - 1]);
};

/** AI 工具历史里第一张出好的结果 */
const firstToolResult = () => {
  const records = [...document.querySelectorAll('.tpl-at__side .tpl-at__record')];
  return shown(records.find((r) => r.querySelector('.kv-result-tile:not([aria-busy]):not([aria-invalid])')));
};

export const CHAPTERS: Record<ChapterId, Chapter> = {
  // 创作首页：生成和画布、四种模式、输入框里的专家 / 模型 / 技能、发现、侧栏对话和画布、账号
  home: {
    spotlight: true,
    mode: 'generate',
    steps: [
      {
        target: q('[data-tour="home-mode"]'),
        title: '生成和画布',
        items: [
          ['生成', '一句话出图、视频、音频，适合单次产出'],
          ['画布', '用节点串起多步流程，适合成套物料、反复调整'],
        ],
        placement: 'bottom',
      },
      {
        target: q(`${BOX} [aria-label="任务类型"]`),
        title: '四种模式',
        items: [
          ['Agent', '说需求，它拆步骤、选模型'],
          ['图片生成', '自己选模型、比例、参考图'],
          ['视频生成', '全能参考、首尾帧、编辑、延长'],
          ['音频生成', '文字转语音，选音色'],
        ],
        placement: 'bottom-start',
      },
      {
        target: q(`${BOX} [aria-label="当前专家"]`),
        title: '专家',
        description: '按领域请专家来做；需求不对口时会提醒你换。',
        placement: 'bottom-start',
      },
      {
        target: q(`${BOX} [aria-label="选择模型"]`),
        title: '模型',
        description: '指定生成用的模型，不选由 Agent 挑。',
        placement: 'bottom-start',
      },
      {
        target: q(`${BOX} [aria-label="技能"]`),
        title: '技能',
        description: '现成的做法，选上就按它来；输入「/」也能调出。',
        placement: 'bottom-start',
      },
      {
        target: q('section[aria-label="生成推荐内容"] .tpl-home__head'),
        title: '发现',
        description: '大家公开的作品，点开看提示词，可加入参考。',
        placement: 'bottom',
      },
      {
        target: sideGroup('side-chats'),
        hover: sideLabel('side-chats'),
        title: '对话',
        description: '每次提交新建一个对话，右边按钮也能新建。旧版创作页的记录合成一个对话，置顶。',
        placement: 'right-start',
      },
      {
        target: sideGroup('side-canvases'),
        hover: sideLabel('side-canvases'),
        title: '画布',
        description: '「+」新建画布，「全部」看所有画布。旧版的画布都在这里。',
        placement: 'right-start',
      },
      {
        target: q('.tpl-ms__avatar'),
        title: '账号',
        description: '复制 Key、教程、反馈、语言；重看引导也在这里。',
        placement: 'bottom-end',
        nextText: '开始创作',
      },
    ],
  },
  // 对话页：有了生成结果才讲
  chat: {
    spotlight: true,
    steps: [
      {
        target: inRecord('.kv-gen-prompt'),
        title: '生成记录',
        description: '提示词和参数都记在这里。',
        placement: 'bottom-start',
      },
      {
        target: inRecord('.kv-result-tile:not([aria-busy]):not([aria-invalid])'),
        title: '结果',
        description: '点开看大图；悬停可下载、加入参考、用工具处理。',
        placement: 'right',
      },
      {
        target: inRecord('.tpl-row'),
        title: '接着改',
        items: [
          ['重新编辑', '填回输入框，改完再生成'],
          ['再次生成', '原参数再出一次'],
        ],
        placement: 'bottom-start',
      },
    ],
  },
  // 对话里 Agent 第一次回完：不压暗
  'chat-agent': {
    spotlight: false,
    steps: [
      {
        target: lastButton('重新生成'),
        title: '接着说就行',
        description: '想改哪里直接说；不满意点「重新生成」。',
        placement: 'top-start',
      },
    ],
  },
  // 画布：切换和新建画布、新建对话、分享、Agent 输入框下面那排按钮
  canvas: {
    spotlight: true,
    steps: [
      {
        target: q('.kv-canvas-header__canvas'),
        title: '画布',
        description: '点开切换画布，「+」新建。',
        placement: 'bottom-start',
      },
      {
        target: q('.tpl-ca__panel [aria-label="新对话"]'),
        title: '新建对话',
        description: '一块画布可以有多个对话，点左边对话名切换。',
        placement: 'bottom-end',
      },
      {
        target: q('.app-cv-corner [aria-label="分享"]'),
        title: '分享',
        description: '复制链接，别人打开就能看这块画布。',
        placement: 'bottom-end',
      },
      {
        target: q('.tpl-ca__composer-slot .tpl-cv__tools > div:first-child'),
        title: 'Agent 输入框',
        items: [
          ['＋', '加图片、视频、音频作参考'],
          ['模型', '指定生成用的模型'],
          ['技能', '选一个现成做法'],
          ['手动 / 自动', '生成前要不要先确认'],
          ['记忆', '管理 Agent 记住的偏好'],
          ['专家', '换领域专家'],
        ],
        placement: 'top-end',
        nextText: '开始创作',
      },
    ],
  },
  // 画布里选中的节点有参考素材（连进来的上游）：不压暗
  'canvas-refs': {
    spotlight: false,
    steps: [
      {
        target: q('.kv-node-panel__strip'),
        title: '参考素材',
        description: '单击 @ 进提示词，双击定位到那个节点。',
        placement: 'top-start',
      },
    ],
  },
  // 画布里第一次等确认：不压暗
  'canvas-confirm': {
    spotlight: false,
    steps: [
      {
        target: () => {
          const cards = document.querySelectorAll('.tpl-ca__confirm');
          return shown(cards[cards.length - 1]);
        },
        title: '确认了才生成',
        description: '点「确认生成」才开始、才扣猕猴桃。',
        placement: 'left',
      },
    ],
  },
  // AI 工具：历史里第一次有出好的图片：不压暗
  tools: {
    spotlight: false,
    steps: [
      {
        target: firstToolResult,
        title: '接着处理',
        description: '右键结果 →「加入当前工具」，用它接着处理。',
        placement: 'left-start',
      },
    ],
  },
};
