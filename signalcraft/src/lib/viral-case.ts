import type { Video } from './types';
import type { ViralPattern } from './viral-patterns';

export const VIRAL_CASE_STORAGE_KEY = 'signalcraft-viral-case-desk-v1';
export const VIRAL_CASE_STORAGE_VERSION = 1;
export const VIRAL_CASE_CANVAS_HANDOFF_KEY = 'signalcraft-viral-case-canvas-handoff-v1';

export type ViralCaseAnalysisConfidence = 'low' | 'medium' | 'high';

export type ViralCaseAnalysis = {
  provider: string;
  generatedAt: string;
  confidence: ViralCaseAnalysisConfidence;
  hook: string;
  rule: string;
  beats: [string, string, string, string];
  beatTimestamps: [string, string, string, string];
  emotionalCurve: string;
  visualLanguage: string;
  propsAndSound: string;
  caveats: string[];
};

export type ViralCaseNotes = {
  referencePatternId: string | null;
  referencePatternTitle: string | null;
  hook: string;
  rule: string;
  beats: [string, string, string, string];
  beatTimestamps: [string, string, string, string];
  emotionalCurve: string;
  visualLanguage: string;
  propsAndSound: string;
  reusableMechanism: string;
  adaptation: string;
  updatedAt: string | null;
  analysis: ViralCaseAnalysis | null;
};

export type ViralCaseStore = {
  version: number;
  selectedVideoId: string | null;
  notesByVideoId: Record<string, ViralCaseNotes>;
};

export type ViralCaseIdeaDraft = Pick<
  import('./types').Idea,
  'title' | 'angle' | 'audience' | 'hypothesis' | 'note'
>;

export type ViralCaseCanvasHandoff = {
  version: 1;
  prompt: string;
  brief: string;
  sourceVideoId: string;
  sourceTitle: string;
  duration: number;
  createdAt: string;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const confidence = (value: unknown): ViralCaseAnalysisConfidence => value === 'high' || value === 'medium' ? value : 'low';

export function normalizeViralCaseAnalysis(value: unknown): ViralCaseAnalysis | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ViralCaseAnalysis>;
  const rawBeats = Array.isArray(raw.beats) ? raw.beats : [];
  const rawBeatTimestamps = Array.isArray(raw.beatTimestamps) ? raw.beatTimestamps : [];
  const rawCaveats = Array.isArray(raw.caveats) ? raw.caveats : [];
  if (!text(raw.hook) && !text(raw.rule) && !text(raw.visualLanguage)) return null;
  return {
    provider: text(raw.provider) || '已配置分析服务',
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    confidence: confidence(raw.confidence),
    hook: text(raw.hook),
    rule: text(raw.rule),
    beats: [text(rawBeats[0]), text(rawBeats[1]), text(rawBeats[2]), text(rawBeats[3])],
    beatTimestamps: [text(rawBeatTimestamps[0]), text(rawBeatTimestamps[1]), text(rawBeatTimestamps[2]), text(rawBeatTimestamps[3])],
    emotionalCurve: text(raw.emotionalCurve),
    visualLanguage: text(raw.visualLanguage),
    propsAndSound: text(raw.propsAndSound),
    caveats: rawCaveats.map(text).filter(Boolean).slice(0, 8),
  };
}

export function emptyViralCaseNotes(): ViralCaseNotes {
  return {
    referencePatternId: null,
    referencePatternTitle: null,
    hook: '',
    rule: '',
    beats: ['', '', '', ''],
    beatTimestamps: ['', '', '', ''],
    emotionalCurve: '',
    visualLanguage: '',
    propsAndSound: '',
    reusableMechanism: '',
    adaptation: '',
    updatedAt: null,
    analysis: null,
  };
}

export function normalizeViralCaseNotes(value: unknown): ViralCaseNotes {
  if (!value || typeof value !== 'object') return emptyViralCaseNotes();
  const raw = value as Partial<ViralCaseNotes>;
  const rawBeats = Array.isArray(raw.beats) ? raw.beats : [];
  const rawBeatTimestamps = Array.isArray(raw.beatTimestamps) ? raw.beatTimestamps : [];
  return {
    referencePatternId: typeof raw.referencePatternId === 'string' ? raw.referencePatternId : null,
    referencePatternTitle: typeof raw.referencePatternTitle === 'string' ? text(raw.referencePatternTitle) : null,
    hook: text(raw.hook),
    rule: text(raw.rule),
    beats: [text(rawBeats[0]), text(rawBeats[1]), text(rawBeats[2]), text(rawBeats[3])],
    beatTimestamps: [text(rawBeatTimestamps[0]), text(rawBeatTimestamps[1]), text(rawBeatTimestamps[2]), text(rawBeatTimestamps[3])],
    emotionalCurve: text(raw.emotionalCurve),
    visualLanguage: text(raw.visualLanguage),
    propsAndSound: text(raw.propsAndSound),
    reusableMechanism: text(raw.reusableMechanism),
    adaptation: text(raw.adaptation),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    analysis: normalizeViralCaseAnalysis(raw.analysis),
  };
}

export function applyViralPatternToNotes(notes: ViralCaseNotes, pattern: ViralPattern): Partial<ViralCaseNotes> {
  return {
    referencePatternId: pattern.id,
    referencePatternTitle: pattern.title,
    hook: notes.hook || pattern.hookType,
    rule: notes.rule || pattern.formula,
    beats: notes.beats.map((beat, index) => beat || pattern.beats[index]) as ViralCaseNotes['beats'],
    beatTimestamps: notes.beatTimestamps.map((time, index) => time || pattern.beatTimestamps[index]) as ViralCaseNotes['beatTimestamps'],
    emotionalCurve: notes.emotionalCurve || pattern.emotionalCurve,
    visualLanguage: notes.visualLanguage || pattern.visualLanguage,
    propsAndSound: notes.propsAndSound || pattern.propsAndSound,
    reusableMechanism: notes.reusableMechanism || pattern.coreMechanism,
    adaptation: notes.adaptation || pattern.adaptationPrompt,
  };
}

export function normalizeViralCaseStore(value: unknown): ViralCaseStore {
  if (!value || typeof value !== 'object') {
    return { version: VIRAL_CASE_STORAGE_VERSION, selectedVideoId: null, notesByVideoId: {} };
  }

  const raw = value as Partial<ViralCaseStore>;
  const notesByVideoId = Object.entries(raw.notesByVideoId || {}).reduce<Record<string, ViralCaseNotes>>((result, [videoId, notes]) => {
    result[videoId] = normalizeViralCaseNotes(notes);
    return result;
  }, {});

  return {
    version: VIRAL_CASE_STORAGE_VERSION,
    selectedVideoId: typeof raw.selectedVideoId === 'string' ? raw.selectedVideoId : null,
    notesByVideoId,
  };
}

export function createIdeaDraftFromCase(video: Video, notes: ViralCaseNotes): ViralCaseIdeaDraft {
  const sourceTitle = text(video.titleZh) || video.title;
  const mechanism = text(notes.reusableMechanism) || text(notes.hook) || video.topic || '待验证机制';
  const angle = text(notes.adaptation) || `保留「${mechanism}」的观看机制，替换为自己的角色、场景与结局。`;
  const beatText = notes.beats
    .map((beat, index) => (beat ? `${['0–3 秒', '3–8 秒', '8–17 秒', '结尾'][index]}：${beat}` : null))
    .filter(Boolean)
    .join('\n');

  return {
    title: `复刻验证：${mechanism.slice(0, 30)}`,
    angle,
    audience: `对「${video.topic || '该内容赛道'}」有兴趣、偏好快速理解内容规则的观众。`,
    hypothesis: `如果开头先让观众看见「${text(notes.hook) || mechanism}」，并在中段持续兑现同一规则，可能提升继续观看意愿；需要用自己的发布数据验证。`,
    note: [
      `来源视频：${sourceTitle}`,
      `可复用机制：${mechanism}`,
      notes.rule ? `规则建立：${notes.rule}` : '',
      notes.emotionalCurve ? `情绪节奏：${notes.emotionalCurve}` : '',
      beatText ? `节拍：\n${beatText}` : '',
      '说明：画面、声音与结构字段为创作者研究笔记；公开指标不等同于留存或收益。',
    ].filter(Boolean).join('\n\n'),
  };
}

export function applyViralCaseAnalysisToNotes(notes: ViralCaseNotes): Partial<ViralCaseNotes> {
  if (!notes.analysis) return {};
  return {
    hook: notes.hook || notes.analysis.hook,
    rule: notes.rule || notes.analysis.rule,
    beats: notes.beats.map((beat, index) => beat || notes.analysis?.beats[index]) as ViralCaseNotes['beats'],
    beatTimestamps: notes.beatTimestamps.map((time, index) => time || notes.analysis?.beatTimestamps[index]) as ViralCaseNotes['beatTimestamps'],
    emotionalCurve: notes.emotionalCurve || notes.analysis.emotionalCurve,
    visualLanguage: notes.visualLanguage || notes.analysis.visualLanguage,
    propsAndSound: notes.propsAndSound || notes.analysis.propsAndSound,
  };
}

export function formatViralCaseReport(video: Video, notes: ViralCaseNotes): string {
  const report = notes.analysis;
  const sourceTitle = text(video.titleZh) || video.title;
  const beatLabels = ['0–3 秒 · 截停', '3–8 秒 · 规则', '8–17 秒 · 加码', '结尾 · 收口'];
  const lines = [
    `# 爆款拆解：${sourceTitle}`,
    '',
    `- 来源：${video.sourceUrl || `https://www.youtube.com/watch?v=${video.id}`}`,
    `- 主题：${video.topic || '未标注'}`,
    `- 报告来源：${report?.provider || '手动研究'}`,
    `- 报告置信度：${report?.confidence || '—'}`,
    `- 参考模式：${notes.referencePatternTitle || notes.referencePatternId || '手动研究'}`,
    '',
    '## 公开证据',
    '',
    '公开播放、频道规模与发布时间请回到 SignalCraft 样本卡核对；这些指标不等同留存、CTR 或收益。',
    '',
    '## 观察层',
    '',
    `- Hook：${notes.hook || report?.hook || '待填写'}`,
    `- 规则：${notes.rule || report?.rule || '待填写'}`,
    `- 情绪 / 期待曲线：${notes.emotionalCurve || report?.emotionalCurve || '待填写'}`,
    `- 镜头、道具与声音：${[notes.visualLanguage || report?.visualLanguage, notes.propsAndSound || report?.propsAndSound].filter(Boolean).join(' · ') || '待填写'}`,
    '',
    '## 节拍',
    '',
    ...notes.beats.map((beat, index) => `- ${notes.beatTimestamps[index] || report?.beatTimestamps[index] || '--:--'} ${beatLabels[index]}：${beat || report?.beats[index] || '待填写'}`),
    '',
    '## 改写层',
    '',
    `- 可复用机制：${notes.reusableMechanism || '待填写'}`,
    `- 我的改写角度：${notes.adaptation || '待填写'}`,
    '',
    '## 复核提醒',
    '',
    ...(report?.caveats.length ? report.caveats.map(item => `- ${item}`) : ['- 自动报告必须逐项对照原视频确认。']),
  ];
  return lines.join('\n');
}

export function createH3BriefFromCase(video: Video, notes: ViralCaseNotes): string {
  const beatText = notes.beats
    .map((beat, index) => beat ? `${notes.beatTimestamps[index] || '--:--'} ${['opening hook', 'rule reveal', 'escalation', 'ending'][index]}: ${beat}` : '')
    .filter(Boolean)
    .join('; ');
  return [
    `Create an original vertical short video for the ${video.topic || 'selected content'} audience.`,
    'Keep the viewing mechanism and escalation logic, but replace every source-specific person, setting, prop, line, pose, and ending with original creative choices; do not recreate the source video.',
    `Original adaptation angle: ${notes.adaptation || 'invent a new character, setting, prop system, and ending around the mechanism'}.`,
    `Reusable mechanism: ${notes.reusableMechanism || 'a clear visual rule that becomes increasingly difficult or surprising'}.`,
    `Hook observation: ${notes.hook || 'show a concrete visual anomaly immediately'}.`,
    `Rule observation: ${notes.rule || 'make the repeatable rule legible within the first few seconds'}.`,
    beatText ? `Planned timing cues from research notes: ${beatText}.` : 'Use a fast opening, a legible rule reveal, two escalating beats, and a decisive visual ending.',
    `Visual and audio direction: ${[notes.visualLanguage, notes.propsAndSound].filter(Boolean).join('; ') || 'live-action clarity, readable props, physical action sounds, and restrained non-diegetic music'}.`,
    'Use distinct original subjects and locations, with a clean vertical composition and actions that remain fully visible.',
  ].join(' ');
}

export function createViralCaseCanvasHandoff(video: Video, notes: ViralCaseNotes, prompt: string): ViralCaseCanvasHandoff {
  return {
    version: 1,
    prompt: text(prompt).slice(0, 7000),
    brief: createH3BriefFromCase(video, notes).slice(0, 1800),
    sourceVideoId: text(video.id),
    sourceTitle: text(video.titleZh) || text(video.title),
    duration: Math.min(15, Math.max(4, Math.round(video.durationSeconds || 8))),
    createdAt: new Date().toISOString(),
  };
}

export function normalizeViralCaseCanvasHandoff(value: unknown): ViralCaseCanvasHandoff | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ViralCaseCanvasHandoff>;
  const prompt = text(raw.prompt).slice(0, 7000);
  const brief = text(raw.brief).slice(0, 1800);
  if (raw.version !== 1 || !prompt || !brief) return null;
  const duration = typeof raw.duration === 'number' && Number.isFinite(raw.duration) ? Math.min(15, Math.max(4, Math.round(raw.duration))) : 8;
  return {
    version: 1,
    prompt,
    brief,
    sourceVideoId: text(raw.sourceVideoId).slice(0, 160),
    sourceTitle: text(raw.sourceTitle).slice(0, 240),
    duration,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}
