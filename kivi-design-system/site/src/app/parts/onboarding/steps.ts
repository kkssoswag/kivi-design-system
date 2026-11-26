import type { PopoverPlacement } from '@kivi';
import type { Audience, TipId } from '../../data/onboarding';

/*
  新手引导每一步指着哪、说什么。目标按 data-tour（页面上标的）或现有的类名、aria-label 找，找不到（比如侧栏收起、在画布模式下没有任务类型）就跳过这一步。
  文案原则：一步只说一件事，先说能干什么，再说在哪；不写「点击这里」。
*/

export interface GuideStep {
  /** 指着谁：每次现找，页面上没有（或藏着）就返回 null */
  target: () => Element | null;
  title: string;
  description: string;
  placement: PopoverPlacement;
  /** 主按钮的字，不写就是「下一步」，最后一步「知道了」 */
  nextText?: string;
  /** 次按钮的字，不写就是「跳过」 */
  skipText?: string;
  /** 点主按钮时顺便做的事：把示例填进首页输入框 */
  fill?: string;
}

/** 页面上有、而且没藏着 */
const shown = (el: Element | null) => (el && el.getClientRects().length > 0 ? el : null);
const q = (selector: string) => () => shown(document.querySelector(selector));

const COMPOSER = '[data-tour="home-composer"]';
/** 首页两套输入框都挂着，只认正在显示的那套 */
const ACTIVE_BOX = `${COMPOSER} .tpl-home__box[data-active]`;

/** 对话里最后一个写着这几个字的按钮：生成记录下面的「重新编辑」、Agent 回复下面的「重新生成」 */
const lastButton = (text: string) => () => {
  const buttons = [...document.querySelectorAll('.tpl-ms__feed button')].filter((b) => b.textContent?.trim() === text);
  return shown(buttons[buttons.length - 1] ?? null);
};
/** 侧栏「对话」这一段：标题连着下面的列表（MenuLabel 带条目时外面包一层 kv-menu__group） */
function chatsGroup() {
  const label = document.querySelector('[data-tour="side-chats"]');
  return shown(label?.closest('.kv-menu__group') ?? label);
}

/** 导览最后一步填进输入框的示例 */
export const EXAMPLE = '做一张中秋活动主视觉，面向中东用户';

export const TOURS: Record<Audience, GuideStep[]> = {
  // 新用户：首页从上到下认一遍，最后给一句能直接发的
  new: [
    {
      target: q('[data-tour="home-mode"]'),
      title: '生成，还是画布',
      description: '生成：说一句话直接出图、出视频，结果在对话里。画布：把几步连成流程，适合要反复调的活。',
      placement: 'bottom',
    },
    {
      target: q(COMPOSER),
      title: '在这里说需求',
      description: '默认交给 Agent：它会拆需求、挑模型。参考图直接拖进来，打「/」用技能，打「@」引用素材。',
      placement: 'bottom',
    },
    {
      target: q(`${ACTIVE_BOX} [aria-label="任务类型"]`),
      title: '自己定模型和参数',
      description: '切到图片、视频、音频就是直接生成：模型、比例、张数自己选，消耗显示在生成按钮旁边。',
      placement: 'bottom-start',
    },
    {
      target: q(`${ACTIVE_BOX} [aria-label="当前专家"]`),
      title: '请一位专家',
      description: '视觉、礼物、品牌专家各有一套做法和技能，下面的横条点开能看详情。需求更适合别的专家时，会提醒你换。',
      placement: 'bottom-start',
    },
    {
      target: chatsGroup,
      title: '做过的都在这儿',
      description: '首页每提交一次就新建一个对话，结果都留在里面；画布在下面。生成的素材统一在「我的资产」。',
      placement: 'right-start',
    },
    {
      target: q(COMPOSER),
      title: '从一句话开始',
      description: `不知道写什么？先试这句：「${EXAMPLE}」。`,
      placement: 'bottom',
      nextText: '填进输入框',
      skipText: '我自己写',
      fill: EXAMPLE,
    },
  ],
  // 老用户：只看变了的地方
  old: [
    {
      target: q(COMPOSER),
      title: '生成都从这里发',
      description: '图片、视频、音频和 Agent 合进了一个输入框。每次提交新建一个对话，重新编辑、再次生成都在对话里。',
      placement: 'bottom',
    },
    {
      target: q('[data-tour="home-mode"]'),
      title: '新的画布入口',
      description: '多步骤的活切到画布，说一句需求就能新建；最近的画布在下面。',
      placement: 'bottom',
    },
    {
      target: q(`${ACTIVE_BOX} [aria-label="当前专家"]`),
      title: '新增专家',
      description: '给 Agent 请视觉、礼物、品牌专家，各有自己的做法和技能。',
      placement: 'bottom-start',
    },
    {
      target: chatsGroup,
      title: '对话和画布都在侧栏',
      description: '随时回到之前的对话接着改。',
      placement: 'right-start',
    },
    {
      target: q('[data-tour="nav-assets"]'),
      title: '以前的生成记录',
      description: '改版前的生成记录都在「我的资产 · 生成历史」，收藏和筛选也在那儿。',
      placement: 'right',
    },
  ],
};

/** 边用边教：到了那个时机出一次，不压暗 */
export const TIPS: Record<TipId, GuideStep[]> = {
  'chat-agent': [
    {
      target: lastButton('重新生成'),
      title: '接着说就行',
      description: '想改哪里直接在下面接着说，Agent 会接着这轮改；不满意也可以「重新生成」。赞和踩会让它更懂你。',
      placement: 'top-start',
    },
  ],
  'chat-result': [
    {
      target: lastButton('重新编辑'),
      title: '结果不满意？',
      description: '「重新编辑」把这次的提示词和参数填回输入框；悬停图片还能加入参考、做成视频、进 AI 工具。',
      placement: 'top-start',
    },
  ],
  canvas: [
    {
      target: q('.tpl-cv__toolbar [aria-label="添加"]'),
      title: '加节点',
      description: '点「+」或双击画布加节点；把节点连起来，上一步的结果会传给下一步。',
      placement: 'right',
    },
    {
      target: q('.tpl-ca__composer-slot .tpl-cv__composer'),
      title: '交给 Agent 也行',
      description: '说想做什么，Agent 会帮你建节点、连好线，生成前先问你。',
      placement: 'left',
    },
  ],
  'canvas-confirm': [
    {
      target: q('.tpl-ca__confirm'),
      title: '确认了才生成',
      description: 'Agent 把要生成的节点列在这里，点「确认生成」才开始、才消耗猕猴桃。',
      placement: 'left',
    },
  ],
};
