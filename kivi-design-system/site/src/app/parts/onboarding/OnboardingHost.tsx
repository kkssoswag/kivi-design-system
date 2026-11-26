import { useEffect, useState, type ReactNode } from 'react';
import { Button, Coachmark, Dialog, Kimo } from '@kivi';
import { useDB } from '../../data/db';
import { INTRO_FLAG, endChapter, finishIntro, markShown, nextStep, startChapter, useGuide } from '../../data/onboarding';
import { CHAPTERS, type GuideStep } from './steps';
import './onboarding.css';

/*
  新手引导挂在演示站根上（App）：第一次打开先出 Kimo 欢迎，之后页面叫哪章讲哪章，同一时间只讲一章。
  规则和状态在 data/onboarding.ts，每章每一步在 steps.ts。
*/

/** 页面刚切过来、列表刚加载完，目标可能还没出来：每 100ms 找一次，最多等 2 秒 */
const FIND_EVERY = 100;
const FIND_TRIES = 20;
/** 打开后等页面稳住再出欢迎（点阵氛围、输入框高度动画） */
const INTRO_DELAY = 600;

/** 目标不在屏幕里（首页下面的最近更新、发现，对话里往上的记录）：先滚过去 */
function bringIntoView(el: Element) {
  const r = el.getBoundingClientRect();
  const vh = document.documentElement.clientHeight;
  if (r.top >= 0 && r.bottom <= vh) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: r.height > vh * 0.6 ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' });
}

/** 找到目标再换：文字和指向一起换，气泡挪过去。找不到报 missing（跳过这一步）；指着的东西没了报 gone（换页了，这一章先停）。
    收起时留着上一步的内容，消失动画里不空 */
function useStepTarget(step: GuideStep | undefined, key: string) {
  const [found, setFound] = useState<{ key: string; step: GuideStep; el: Element } | null>(null);
  const [missing, setMissing] = useState('');
  const [gone, setGone] = useState('');
  useEffect(() => {
    setMissing('');
    setGone('');
    if (!step) return;
    let tries = 0;
    const tick = () => {
      const el = step.target();
      if (el) {
        bringIntoView(el);
        setFound({ key, step, el });
      } else if (++tries >= FIND_TRIES) setMissing(key);
      return !!el || tries >= FIND_TRIES;
    };
    if (tick()) return;
    const id = setInterval(() => tick() && clearInterval(id), FIND_EVERY);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // 指着的东西被拿走了（换页、收起）
  useEffect(() => {
    if (!found || found.key !== key) return;
    const id = setInterval(() => {
      if (!found.el.isConnected || found.el.getClientRects().length === 0) setGone(found.key);
    }, 500);
    return () => clearInterval(id);
  }, [found, key]);
  const ready = !!step && found?.key === key;
  return { current: found, ready, missing: !!step && missing === key, gone: ready && gone === key };
}

/** 说明：一句话，或者分几项（名称 + 一句话） */
function describe(step: GuideStep): ReactNode {
  if (!step.items) return step.description;
  return (
    <>
      {step.description && <p className="app-onboard__lead">{step.description}</p>}
      <dl className="app-onboard__items">
        {step.items.map(([term, text]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function OnboardingHost({ home, onGoHome }: { home: boolean; onGoHome: () => void }) {
  const introDone = useDB((s) => !!s.flags[INTRO_FLAG]);
  const pending = useGuide((s) => s.pending);
  const run = useGuide((s) => s.run);
  const homeReq = useGuide((s) => s.home);

  // 重看引导：不在首页先回首页
  useEffect(() => {
    if (homeReq && !home) onGoHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeReq]);

  // 打开后（或重看时）等页面稳住再出欢迎
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), INTRO_DELAY);
    return () => clearTimeout(t);
  }, [homeReq]);
  const showIntro = settled && !introDone;

  // 排着的章一个一个讲；欢迎没点之前都等着
  useEffect(() => {
    if (!settled || !introDone || run || !pending.length) return;
    const id = pending[0];
    startChapter(id, CHAPTERS[id].mode);
  }, [settled, introDone, run, pending]);

  const chapter = run ? CHAPTERS[run.id] : undefined;
  const steps = chapter?.steps ?? [];
  const step = run ? steps[run.step] : undefined;
  const t = useStepTarget(step, run ? `${run.id}:${run.step}` : '');
  // 这一步出来了；找不到就跳到下一步（一步都没出的章不算看过）
  useEffect(() => {
    if (t.ready) markShown();
  }, [t.ready]);
  useEffect(() => {
    if (t.missing) nextStep(steps.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.missing]);
  useEffect(() => {
    if (t.gone) endChapter();
  }, [t.gone]);

  const cur = t.current?.step;
  // 新的一章：上一章留着的那步不出，等这一章第一步找到了再出
  const thisChapter = !!run && !!t.current?.key.startsWith(`${run.id}:`);
  const last = run ? run.step === steps.length - 1 : false;
  const multi = steps.length > 1;

  return (
    <>
      <Dialog
        open={showIntro}
        onOpenChange={(v) => !v && finishIntro(false)}
        size={400}
        aria-label="欢迎来到新版 KIVI"
        footer={
          <>
            <Button size={36} variant="secondary" onClick={() => finishIntro(false)}>
              跳过引导
            </Button>
            <Button size={36} variant="primary" onClick={() => finishIntro(true)}>
              开始
            </Button>
          </>
        }
      >
        <div className="app-onboard__hello">
          <Kimo size={128} />
          <h2>欢迎来到新版 KIVI</h2>
          <p>第一次打开每个页面，我会带你看看这里能做什么。用过旧版？你的对话和画布都已经迁过来了。</p>
        </div>
      </Dialog>

      <Coachmark
        anchor={t.current?.el ?? null}
        open={!!step && thisChapter && !t.gone}
        spotlight={chapter?.spotlight}
        placement={cur?.placement}
        title={cur?.title}
        description={cur ? describe(cur) : undefined}
        step={multi && run ? run.step + 1 : undefined}
        total={multi ? steps.length : undefined}
        nextText={cur?.nextText ?? (last ? '知道了' : '下一步')}
        onNext={() => nextStep(steps.length)}
        onSkip={multi ? endChapter : undefined}
      />
    </>
  );
}
