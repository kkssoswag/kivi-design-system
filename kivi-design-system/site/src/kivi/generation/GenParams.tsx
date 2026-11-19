import { forwardRef, useState } from 'react';
import { useControllable } from '../hooks';
import { NumberInput } from '../inputs';
import { TabItem, Tabs } from '../navigation';
import { Slider, type SelectOption, type SliderMark } from '../selection';
import { ParamField } from './ParamPanel';
import { ParamPicker, type ParamPickerProps } from './ParamPicker';
import { DEFAULT_MODEL, RATIOS, SIZES, VIDEO_RATIOS, plainOptions, ticks } from './options';

/*
  生成用的参数面板：视频参数、音频高级设置。点触发器弹出 ParamPanel，里面一块块 ParamField。
  画布生成面板和主站输入框共用。
*/

/** 刻度滑块 + 右边的数字输入框（NumberInput），照 Figma「视频参数调整」里的时长（210:1560）；和 LoraSettings 的权重一个做法：拖滑块、输入、失焦夹住都同步 */
function SliderField(p: { label: string; min: number; max: number; step?: number; value: number; unit?: string; precision?: number; marks: SliderMark[]; onChange: (v: number) => void }) {
  const step = p.step ?? 1;
  const precision = p.precision ?? 0;
  const snap = (n: number) => Number(Math.min(p.max, Math.max(p.min, Math.round(n / step) * step)).toFixed(precision));
  // 输入框打字时先留着打的那串（比如「1.」「-」「-.」这种打到一半的），记下当时的值；拖了滑块值变了就用当前值。夹住等失焦（NumberInput）再做
  const [draft, setDraft] = useState<{ text: string; value: number }>();
  const shown = draft !== undefined && draft.value === p.value ? draft.text : p.value.toFixed(precision);
  return (
    <ParamField label={p.label}>
      <Slider aria-label={p.label} min={p.min} max={p.max} step={step} value={p.value} marks={p.marks} onChange={p.onChange} />
      <NumberInput
        aria-label={`${p.label}数值`}
        min={p.min}
        max={p.max}
        precision={precision}
        unit={p.unit}
        value={shown}
        onChange={(v) => {
          // 空、单独的「-」「.」「-.」是中间态，不改值，只留着显示
          const partial = v === '' || Number.isNaN(Number(v));
          const next = partial ? p.value : snap(Number(v));
          setDraft({ text: v, value: next });
          if (!partial) p.onChange(next);
        }}
        onBlur={() => setDraft(undefined)}
      />
    </ParamField>
  );
}

function Segment({ label, value, options, onChange }: { label: string; value: string; options: SelectOption[]; onChange: (v: string) => void }) {
  return (
    <ParamField label={label}>
      <Tabs variant="segment" value={value} onChange={onChange} aria-label={label}>
        {options.map((o) => (
          <TabItem key={o.value} value={o.value}>
            {o.label}
          </TabItem>
        ))}
      </Tabs>
    </ParamField>
  );
}

const ON_OFF: SelectOption[] = [
  { value: 'on', label: '开' },
  { value: 'off', label: '关' },
];

/** 参数面板里选的值，键见 GEN_PARAM_DEFAULTS，值一律是字符串（时长 '5'、语速 '1.0'） */
export type GenParamValues = Record<string, string>;

/** 各类参数的默认值：视频 比例 / 时长（秒）/ 分辨率 / 生成音频，图片 比例 / 分辨率，音频 语速 / 音高 / 情绪 / 稳定性 / 生成字幕 */
export const GEN_PARAM_DEFAULTS = {
  video: { ratio: '16:9', duration: '5', resolution: '720P', sound: 'on' },
  image: { ratio: '1:1', resolution: '2K' },
  audio: { speed: '1.0', pitch: '0', emotion: 'auto', stability: 'natural', subtitle: 'on' },
} satisfies Record<'video' | 'image' | 'audio', GenParamValues>;

/** 模型支持哪些参数值，没写的参数全部支持。参数面板只显示这里有的值；时长要等差（4、6、8），做成刻度滑块的步进 */
export type GenParamLimits = Partial<Record<'ratio' | 'resolution' | 'duration', string[]>>;

/** 参数面板通用的受控三件套：传了 values 就听外面的 */
interface ParamValueProps {
  /** 选的值（受控）。不传就自己存，一开始是默认值 */
  values?: GenParamValues;
  /** 改了任何一项时触发，参数是整组新值 */
  onValuesChange?: (values: GenParamValues) => void;
}

/** 整组值的受控 / 非受控，返回读一项、改一项 */
function useParamValues(defaults: GenParamValues, values: GenParamValues | undefined, onValuesChange?: (v: GenParamValues) => void) {
  const [all, setAll] = useControllable(values, defaults, onValuesChange);
  const get = (k: string) => all[k] ?? defaults[k];
  const set = (k: string) => (v: string | number) => setAll({ ...defaults, ...all, [k]: String(v) });
  return [get, set] as const;
}

export interface VideoParamsProps extends Omit<ParamPickerProps, 'summary' | 'children'>, ParamValueProps {
  /** 当前模型支持的参数值（比例、分辨率、时长），面板只显示这些。不传全部显示。由 VideoModelControls 按模型传 */
  allowed?: GenParamLimits;
  /** 有没有「生成音频」：Seedance、Kling V3 Omni 有。开着时摘要后面跟一个音量图标，默认没有 */
  audio?: boolean;
}

const VIDEO_RES = ['720P', '1080P'];
const VIDEO_SEC = { min: 4, max: 15 };

/**
 * 视频参数：Figma「模板 · 画布」页「视频参数调整」（210:1514）。比例、时长、分辨率，Seedance 多一个生成音频。
 * 摘要照 Figma 主站输入框写成「分辨率 · 比例 · 时长」；生成音频开着时，后面跟一个音量图标（Figma 画布摘要「智能 · 8s · 2K ·」后面那个）
 */
export const VideoParams = forwardRef<HTMLSpanElement, VideoParamsProps>(function VideoParams({ audio = false, allowed, values, onValuesChange, ...rest }, ref) {
  const [get, set] = useParamValues(GEN_PARAM_DEFAULTS.video, values, onValuesChange);
  const [ratio, setRatio] = [get('ratio'), set('ratio')];
  const [sec, setSec] = [Number(get('duration')), set('duration')];
  const [res, setRes] = [get('resolution'), set('resolution')];
  const [sound, setSound] = [get('sound'), set('sound')];
  // 时长只有几个固定值（Veo 4 / 6 / 8，Sora 4 / 8 / 12）：还是刻度滑块，范围和步进按这几个值
  const secs = allowed?.duration?.map(Number).sort((a, b) => a - b);
  const secMin = secs?.length ? secs[0] : VIDEO_SEC.min;
  const secMax = secs?.length ? secs[secs.length - 1] : VIDEO_SEC.max;
  const secStep = secs && secs.length > 1 ? secs[1] - secs[0] : 1;
  return (
    <ParamPicker
      ref={ref}
      summary={`${res} · ${ratio} · ${sec}s${audio && sound === 'on' ? ' ·' : ''}`}
      summaryIcon={audio && sound === 'on' ? 'VolumeHalf' : undefined}
      {...rest}
    >
      <ParamField label="选择比例">
        <Tabs variant="segment" layout="vertical" value={ratio} onChange={setRatio} aria-label="比例">
          {VIDEO_RATIOS.filter(([v]) => !allowed?.ratio || allowed.ratio.includes(v)).map(([v, icon]) => (
            <TabItem key={v} value={v} icon={icon}>
              {v}
            </TabItem>
          ))}
        </Tabs>
      </ParamField>
      <SliderField
        label="选择视频生成时长"
        min={secMin}
        max={secMax}
        step={secStep}
        value={sec}
        unit="S"
        marks={secs ? ticks(secMin, secMax, secStep, secStep) : ticks(5, 15, 5, 5)}
        onChange={setSec}
      />
      <Segment label="选择分辨率" value={res} options={plainOptions(VIDEO_RES.filter((v) => !allowed?.resolution || allowed.resolution.includes(v)))} onChange={setRes} />
      {audio && <Segment label="生成音频" value={sound} options={ON_OFF} onChange={setSound} />}
    </ParamPicker>
  );
});
VideoParams.displayName = 'VideoParams';

export interface ImageParamsProps extends Omit<ParamPickerProps, 'summary' | 'children'>, ParamValueProps {
  /** 当前模型支持的参数值（比例、分辨率），面板只显示这些。不传全部显示。由 ImageModelControls 按模型传 */
  allowed?: GenParamLimits;
}

/**
 * 图片参数：比例、分辨率放进一个参数面板，交互照视频参数（11-11 用户定，原来是分辨率、比例两个下拉）。
 * 摘要写成「分辨率 · 比例」；比例 11 个，竖排分段一排 6 个
 */
export const ImageParams = forwardRef<HTMLSpanElement, ImageParamsProps>(function ImageParams({ allowed, values, onValuesChange, ...props }, ref) {
  const [get, set] = useParamValues(GEN_PARAM_DEFAULTS.image, values, onValuesChange);
  const [ratio, setRatio] = [get('ratio'), set('ratio')];
  const [size, setSize] = [get('resolution'), set('resolution')];
  return (
    <ParamPicker ref={ref} summary={`${size} · ${ratio}`} {...props}>
      <ParamField label="选择比例">
        <Tabs variant="segment" layout="vertical" columns={6} value={ratio} onChange={setRatio} aria-label="比例">
          {RATIOS.filter((o) => !allowed?.ratio || allowed.ratio.includes(o.value)).map((o) => (
            <TabItem key={o.value} value={o.value} icon={o.icon}>
              {o.label}
            </TabItem>
          ))}
        </Tabs>
      </ParamField>
      <Segment label="选择分辨率" value={size} options={SIZES.filter((o) => !allowed?.resolution || allowed.resolution.includes(o.value))} onChange={setSize} />
    </ParamPicker>
  );
});
ImageParams.displayName = 'ImageParams';

export interface AudioParamsProps extends Omit<ParamPickerProps, 'summary' | 'children'>, ParamValueProps {
  /** 音频模型的值，面板里有什么跟着它变：MiniMax 多情绪，Eleven 多稳定性，Seed 和 Eleven 有生成字幕。默认 Seed Audio */
  model?: string;
}

/**
 * 音频高级设置：样子照 Figma「音频参数调整」（211:1528），内容照线上：语速、音高都有；
 * MiniMax 多情绪，Eleven 多稳定性，Seed 和 Eleven 有生成字幕。触发器写「高级设置」
 */
export const AudioParams = forwardRef<HTMLSpanElement, AudioParamsProps>(function AudioParams({ model = DEFAULT_MODEL.audio, values, onValuesChange, ...rest }, ref) {
  const [get, set] = useParamValues(GEN_PARAM_DEFAULTS.audio, values, onValuesChange);
  const [speed, setSpeed] = [Number(get('speed')), (v: number) => set('speed')(v.toFixed(1))];
  const [pitch, setPitch] = [Number(get('pitch')), set('pitch')];
  const [emotion, setEmotion] = [get('emotion'), set('emotion')];
  const [stability, setStability] = [get('stability'), set('stability')];
  const [subtitle, setSubtitle] = [get('subtitle'), set('subtitle')];
  return (
    <ParamPicker ref={ref} summary="高级设置" {...rest}>
      <SliderField label="语速" min={0.5} max={2} step={0.1} precision={1} value={speed} unit="x" marks={ticks(0.5, 2, 0.25, 0.5, (v) => `${v.toFixed(1)}x`)} onChange={setSpeed} />
      <SliderField label="音高" min={-12} max={12} value={pitch} marks={ticks(-12, 12, 4, 12)} onChange={setPitch} />
      {model === 'minimax-speech-2.8-hd' && (
        <Segment
          label="情绪"
          value={emotion}
          options={[
            { value: 'auto', label: '自动' },
            { value: 'happy', label: '开心' },
            { value: 'sad', label: '悲伤' },
            { value: 'angry', label: '愤怒' },
            { value: 'fearful', label: '害怕' },
            { value: 'disgusted', label: '厌恶' },
            { value: 'surprised', label: '惊讶' },
            { value: 'neutral', label: '中性' },
          ]}
          onChange={setEmotion}
        />
      )}
      {model === 'eleven-v4' && (
        <Segment
          label="稳定性"
          value={stability}
          options={[
            { value: 'lively', label: '活泼' },
            { value: 'natural', label: '自然' },
            { value: 'stable', label: '稳定' },
          ]}
          onChange={setStability}
        />
      )}
      {model !== 'minimax-speech-2.8-hd' && <Segment label="生成字幕" value={subtitle} options={ON_OFF} onChange={setSubtitle} />}
    </ParamPicker>
  );
});
AudioParams.displayName = 'AudioParams';
