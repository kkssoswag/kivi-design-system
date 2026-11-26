import type { PopoverPlacement } from '@kivi';
import type { ChapterId, HomeMode } from '../../data/onboarding';

/*
  新手引导每一章、每一步指着哪、说什么。目标按 data-tour（页面上标的）或现有的类名、aria-label 找，找不到就跳过那一步。
  文案：先说是什么、适合什么时候用，再说怎么用；一步只讲一块，句子尽量短。
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

const COMPOSER = '[data-tour="home-composer"]';
/** 首页两套输入框都挂着，只认正在显示的那套 */
const BOX = `${COMPOSER} .tpl-home__box[data-active]`;

/** 侧栏的一段（对话 / 画布）：标题连着下面的列表 */
const sideGroup = (name: string) => () => {
  const label = document.querySelector(`[data-tour="${name}"]`);
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

export const CHAPTERS: Record<ChapterId, Chapter> = {
  // 创作首页 · 生成：入口、四种生成方式、输入框里的东西、首页下面两块、侧栏对话、右上角
  home: {
    spotlight: true,
    mode: 'generate',
    steps: [
      {
        target: q('[data-tour="home-mode"]'),
        title: '生成和画布',
        items: [
          ['生成', '一句话直接出图、出视频、配音，每次提交新建一个对话。适合目标明确的单次产出。'],
          ['画布', '把步骤连成节点，上一步的结果自动传给下一步。适合多步骤、成套物料、要反复调整的活。'],
        ],
        placement: 'bottom',
      },
      {
        target: q(`${BOX} [aria-label="任务类型"]`),
        title: '四种生成方式',
        items: [
          ['Agent', '说需求就行，它拆步骤、选模型、给方案。适合还没想好怎么做。'],
          ['图片生成', '自己选模型、比例、分辨率，可加参考图、LoRA。'],
          ['视频生成', '全能参考、首尾帧、视频编辑、视频延长几种方式。'],
          ['音频生成', '文字转语音，选音色。'],
        ],
        placement: 'bottom-start',
      },
      {
        target: q(`${BOX} [aria-label="添加参考素材"]`),
        title: '参考素材',
        description: '上传或拖入图片、视频、音频作参考；在文字里输入「@」指明用哪一个。',
        placement: 'bottom-start',
      },
      {
        target: q(`${BOX} [aria-label="当前专家"]`),
        title: '专家',
        description: '给 Agent 请一位领域专家（视觉、礼物、品牌），按它的方法和技能做。默认是通用专家；需求更适合别的专家时会提醒你切换。下方横条能看各专家详情。',
        placement: 'bottom-start',
      },
      {
        target: q(`${BOX} [aria-label="选择模型"]`),
        title: '模型',
        description: '指定 Agent 出图、出视频用的模型，选几个各出一份；不选就由 Agent 挑。',
        placement: 'bottom-start',
      },
      {
        target: q(`${BOX} [aria-label="技能"]`),
        title: '技能',
        description: '现成的方法包，比如活动主视觉、礼物分镜。选上后这条消息一定会用；输入「/」也能调出。',
        placement: 'bottom-start',
      },
      {
        target: q('.tpl-ms__wallet [aria-label="素材库"]'),
        title: '素材库',
        description: '随时打开你的素材，挑了直接加进输入框作参考。',
        placement: 'bottom-end',
      },
      {
        target: q('section[aria-label="最近更新"]'),
        title: '最近更新',
        description: '新模型、新功能和活动，点开看详情或直接体验。',
        placement: 'top',
      },
      {
        target: q('section[aria-label="生成推荐内容"] .tpl-home__head'),
        title: '发现',
        description: '大家公开的作品。点开看提示词和参数，可以加入参考；右边能搜索，「查看全部」去探索页。',
        placement: 'bottom',
      },
      {
        target: sideGroup('side-chats'),
        title: '对话',
        description: '首页每次提交都新建一个对话，结果都留在里面。改版前创作页的记录合成了一个对话，置顶在最上面。',
        placement: 'right-start',
      },
      {
        target: q('.tpl-ms__balance'),
        title: '猕猴桃余额',
        description: '生成会消耗猕猴桃，这里是剩余额度。',
        placement: 'bottom-end',
      },
      {
        target: q('.tpl-ms__avatar'),
        title: '账号',
        description: '复制用户 Key、看教程、提意见、换语言；想再看一遍引导也在这里。',
        placement: 'bottom-end',
        nextText: '开始创作',
      },
    ],
  },
  // 创作首页 · 画布：画布的快速输入、最近项目、广场、侧栏画布
  'home-canvas': {
    spotlight: true,
    mode: 'canvas',
    steps: [
      {
        target: q(COMPOSER),
        title: '从一句话开一块画布',
        description: '说想做什么，就新建一块画布，画布里的 Agent 接着帮你搭节点、生成。',
        placement: 'bottom',
      },
      {
        target: q('section[aria-label="最近项目"]'),
        title: '最近项目',
        description: '最近编辑的画布，点开接着做；「新建画布」从空白开始，「查看全部」管理全部画布。',
        placement: 'top',
      },
      {
        target: q('section[aria-label="画布推荐内容"] .tpl-home__head'),
        title: '创作精选、技能、工作流',
        items: [
          ['创作精选', '完整的优秀画布，预览后可克隆成自己的。'],
          ['技能', '现成的方法包，「使用」后带进 Agent 输入框。'],
          ['工作流', '可复用的节点流程，「应用」后在新画布里打开。'],
        ],
        placement: 'bottom-start',
      },
      {
        target: sideGroup('side-canvases'),
        title: '画布',
        description: '你的全部画布，改版前的画布也都在这里，一块一条。',
        placement: 'right-start',
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
        description: '每次生成一条记录，写着提示词和参数（模型、比例等）。',
        placement: 'bottom-start',
      },
      {
        target: inRecord('.kv-result-tile:not([aria-busy]):not([aria-invalid])'),
        title: '结果',
        description: '点开看大图。悬停：右上删除、下载；右下加入参考、抠图、高清和更多工具。右键还能加进文件夹。',
        placement: 'right',
      },
      {
        target: inRecord('.tpl-row'),
        title: '接着改',
        items: [
          ['重新编辑', '提示词、参数、参考填回输入框，改完再生成。'],
          ['再次生成', '原参数再出一次。'],
          ['⋯', '删除整组。'],
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
        description: '想改哪里直接在下面接着说，Agent 接着这轮改；不满意可以「重新生成」。赞和踩会让它更懂你。',
        placement: 'top-start',
      },
    ],
  },
  // 画布：工具栏、视图、右侧 Agent
  canvas: {
    spotlight: true,
    steps: [
      {
        target: q('.tpl-cv__toolbar'),
        title: '画布工具',
        items: [
          ['添加', '文本、图片、视频、音频生成节点，还有视频剪辑、对口型。双击空白处也能加。'],
          ['工作流', '存下常用的节点流程，下次直接套用。'],
          ['上传', '把本地素材放上画布。'],
          ['历史', '这块画布的生成记录。'],
          ['素材库', '从你的素材里挑，放上画布。'],
        ],
        placement: 'right',
      },
      {
        target: q('[aria-label="视图"]'),
        title: '视图',
        description: '整理画布、小地图、适配画布、网格吸附、显示或隐藏连线、缩放。',
        placement: 'top-start',
      },
      {
        target: q('.tpl-ca__title'),
        title: '画布 Agent 的对话',
        description: '每块画布有自己的 Agent 对话。点对话名切换历史对话，右边新建对话或收起面板。',
        placement: 'bottom-start',
      },
      {
        target: q('.tpl-ca__composer-slot .tpl-cv__composer'),
        title: '交给 Agent',
        description: '说想做什么，它会建节点、连线、生成。可加附件、请专家、选模型偏好和技能；「手动」生成前先请你确认，「自动」直接生成。',
        placement: 'left',
        nextText: '开始创作',
      },
    ],
  },
  // 画布里第一次等确认：不压暗
  'canvas-confirm': {
    spotlight: false,
    steps: [
      {
        target: q('.tpl-ca__confirm'),
        title: '确认了才生成',
        description: 'Agent 把要生成的节点列在这里，点「确认生成」才开始、才消耗猕猴桃。',
        placement: 'left',
      },
    ],
  },
  explore: {
    spotlight: true,
    steps: [
      {
        target: q('[aria-label="探索"]'),
        title: '探索',
        items: [
          ['发现', '大家公开的作品，点开看提示词和参数，可加入参考。'],
          ['创作精选', '完整的优秀画布，预览、克隆。'],
          ['技能', '现成的方法包，看详情、使用。'],
          ['工作流', '可复用的节点流程，预览、应用到新画布。'],
        ],
        placement: 'bottom-start',
      },
      {
        target: q('.tpl-ex__inner .tpl-as__filters'),
        title: '找内容',
        description: '按分类筛选、只看「我收藏的」，或者搜提示词、模型、作者。',
        placement: 'bottom',
        nextText: '知道了',
      },
    ],
  },
  tools: {
    spotlight: true,
    steps: [
      {
        target: q('.tpl-at__tools'),
        title: 'AI 工具',
        items: [
          ['图片', '抠图、扩图、高清修复、智能编辑。'],
          ['视频', '视频循环、视频高清、视频拼接、视频抠图。'],
        ],
        description: '选一个工具，在中间上传素材、调参数生成。',
        placement: 'right-start',
      },
      {
        target: q('.tpl-at__side'),
        title: '历史记录',
        description: '所有工具的结果都在这里，可以按工具筛选；右键能加入当前工具接着处理。',
        placement: 'left-start',
        nextText: '知道了',
      },
    ],
  },
  assets: {
    spotlight: true,
    steps: [
      {
        target: q('[data-tour="assets-folders"]'),
        title: '我的素材',
        description: '用文件夹整理素材；生成的结果在右键菜单里加进文件夹。',
        placement: 'bottom',
      },
      {
        target: q('[data-tour="assets-canvases"]'),
        title: '我的画布',
        description: '你的全部画布，点开接着做；「查看全部」管理。',
        placement: 'bottom',
      },
      {
        target: q('[data-tour="assets-history"]'),
        title: '生成历史',
        description: '对话、画布、AI 工具生成的全部结果。按来源、类型、时间筛选，看收藏、搜索；「批量编辑」一次处理多张。',
        placement: 'bottom',
        nextText: '知道了',
      },
    ],
  },
};
