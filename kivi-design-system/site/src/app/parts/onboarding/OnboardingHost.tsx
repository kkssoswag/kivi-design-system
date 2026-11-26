import { useEffect, useState } from 'react';
import { Button, Coachmark, Dialog, Kimo, Prose, placeholderImageSrc } from '@kivi';
import { useDB } from '../../data/db';
import { useDemo } from '../../data/demo';
import {
  INTRO_FLAG,
  dropTip,
  endTour,
  fillHome,
  finishIntro,
  nextStep,
  nextTipStep,
  showTip,
  startPendingTour,
  useGuide,
} from '../../data/onboarding';
import { TIPS, TOURS, type GuideStep } from './steps';
import './onboarding.css';

/*
  新手引导挂在演示站根上（App）：首页的欢迎 / 换新了、首页导览、各页边用边教的提示，同一时间只出一样。
  顺序：欢迎（或换新了）→ 导览 → 提示。导览压暗页面，提示不压暗。数据和规则在 data/onboarding.ts，每一步的文案在 steps.ts。
*/

/** 页面刚切过来、列表刚加载完，目标可能还没出来：每 100ms 找一次，最多等 2 秒 */
const FIND_EVERY = 100;
const FIND_TRIES = 20;
/** 进首页后等页面稳住再出欢迎（点阵氛围、输入框高度动画） */
const INTRO_DELAY = 600;

/** 找到目标再换：文字和指向一起换，气泡挪过去；找不到报 missing */
function useStepTarget(step: GuideStep | undefined, key: string) {
  const [found, setFound] = useState<{ key: string; step: GuideStep; el: Element } | null>(null);
  const [missing, setMissing] = useState('');
  useEffect(() => {
    setMissing('');
    if (!step) return;
    let tries = 0;
    const tick = () => {
      const el = step.target();
      if (el) setFound({ key, step, el });
      else if (++tries >= FIND_TRIES) setMissing(key);
      return !!el || tries >= FIND_TRIES;
    };
    if (tick()) return;
    const id = setInterval(() => tick() && clearInterval(id), FIND_EVERY);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // 目标被拿走了（切页、收起）：当作找不到
  useEffect(() => {
    if (!found || !step) return;
    const id = setInterval(() => {
      if (!found.el.isConnected || found.el.getClientRects().length === 0) setMissing(found.key);
    }, 500);
    return () => clearInterval(id);
  }, [found, step]);
  // 收起时还留着上一步的内容，消失动画里不空
  return { current: found, missing: !!step && missing === key };
}

export function OnboardingHost({ home, onGoHome }: { home: boolean; onGoHome: () => void }) {
  const { oldUser } = useDemo();
  const introDone = useDB((s) => !!s.flags[INTRO_FLAG]);
  const tour = useGuide((s) => s.tour);
  const step = useGuide((s) => s.step);
  const pending = useGuide((s) => s.pending);
  const tip = useGuide((s) => s.tip);
  const homeReq = useGuide((s) => s.home);
  const startAfterHome = useGuide((s) => s.startAfterHome);

  // 重看引导、账号菜单「新手引导」：不在首页先回首页
  useEffect(() => {
    if (homeReq && !home) onGoHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeReq]);

  // 到了首页、稳住了才出欢迎和导览
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (!home) return;
    const t = setTimeout(() => setSettled(true), INTRO_DELAY);
    return () => clearTimeout(t);
  }, [home, homeReq]);
  useEffect(() => {
    if (settled && startAfterHome) startPendingTour();
  }, [settled, startAfterHome]);

  const showIntro = home && settled && !introDone && !tour;

  // 导览：一步一步，目标找不到的跳过
  const steps = tour ? TOURS[tour] : [];
  const tourStep = home ? steps[step] : undefined;
  const t = useStepTarget(tourStep, `${tour}:${step}`);
  useEffect(() => {
    if (t.missing) nextStep(steps.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.missing]);
  // 导览走到一半离开了首页：算看完
  useEffect(() => {
    if (tour && !home) endTour();
  }, [tour, home]);

  // 边用边教：没有欢迎、导览时，排着的提示一个一个出
  const busy = showIntro || !!tour;
  useEffect(() => {
    if (!busy && !tip && pending.length) showTip(pending[0]);
  }, [busy, tip, pending]);
  const tipSteps = tip ? TIPS[tip.id] : [];
  const tipStep = tip && !busy ? tipSteps[tip.step] : undefined;
  const p = useStepTarget(tipStep, tip ? `${tip.id}:${tip.step}` : '');
  useEffect(() => {
    if (p.missing && tip) dropTip(tip.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.missing]);

  const last = step === steps.length - 1;
  const cur = t.current?.step;
  const tipLast = tip ? tip.step === tipSteps.length - 1 : false;
  const tipCur = p.current?.step;

  return (
    <>
      {/* 新用户：Kimo 打个招呼 */}
      <Dialog
        open={showIntro && !oldUser}
        onOpenChange={(v) => !v && finishIntro(false)}
        size={400}
        aria-label="欢迎来到 KIVI"
        footer={
          <>
            <Button size={36} variant="secondary" onClick={() => finishIntro(false)}>
              我自己逛逛
            </Button>
            <Button size={36} variant="primary" onClick={() => finishIntro(true)}>
              带我认识一下
            </Button>
          </>
        }
      >
        <div className="app-onboard__hello">
          <Kimo size={128} />
          <h2>嗨，我是 Kimo</h2>
          <p>在 KIVI 说一句需求，就能出图、出视频、做活动物料。花 30 秒认识一下这里？</p>
        </div>
      </Dialog>

      {/* 老用户：先说哪几处变了 */}
      <Dialog
        open={showIntro && oldUser}
        onOpenChange={(v) => !v && finishIntro(false)}
        size={560}
        media={<img src={placeholderImageSrc('kivi-future', '16:9')} alt="" />}
        title="KIVI 换新了"
        description="这几处和以前不一样，先看一眼："
        footer={
          <>
            <Button size={36} variant="secondary" onClick={() => finishIntro(false)}>
              知道了
            </Button>
            <Button size={36} variant="primary" onClick={() => finishIntro(true)}>
              带我看看
            </Button>
          </>
        }
      >
        <Prose>
          <ul>
            <li>
              <strong>生成都在对话里</strong>：首页每次提交都新建一个对话，结果、重新编辑、再次生成都在对话里，左侧随时找回。
            </li>
            <li>
              <strong>新的画布入口</strong>：多步骤的活在画布里搭，最近的画布就在首页。
            </li>
            <li>
              <strong>可以请专家</strong>：给 Agent 请视觉、礼物、品牌专家，各有自己的做法和技能。
            </li>
            <li>
              <strong>下载不再自动公开</strong>：想放到发现，在结果的「更多」里点「公开到发现」。
            </li>
            <li>
              <strong>以前的生成记录</strong>：在「我的资产 · 生成历史」里。
            </li>
          </ul>
        </Prose>
      </Dialog>

      {/* 首页导览：压暗，只亮出这一步说的东西 */}
      <Coachmark
        anchor={t.current?.el ?? null}
        open={!!tourStep && !!t.current}
        spotlight
        placement={cur?.placement}
        title={cur?.title}
        description={cur?.description}
        step={step + 1}
        total={steps.length}
        nextText={cur?.nextText ?? (last ? '知道了' : '下一步')}
        skipText={cur?.skipText}
        onNext={() => {
          if (cur?.fill) fillHome(cur.fill);
          nextStep(steps.length);
        }}
        onSkip={endTour}
      />

      {/* 边用边教：不压暗，看完不再出 */}
      <Coachmark
        anchor={p.current?.el ?? null}
        open={!!tipStep && !!p.current}
        placement={tipCur?.placement}
        title={tipCur?.title}
        description={tipCur?.description}
        step={tip ? tip.step + 1 : undefined}
        total={tipSteps.length}
        nextText={tipLast ? '知道了' : '下一步'}
        onNext={() => nextTipStep(tipSteps.length)}
      />
    </>
  );
}
