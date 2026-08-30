export const H3_PROMPT_MODES = ['T2VA', 'I2VA', 'FL2VA', 'L2VA', 'Ref2VA'] as const;

export type H3PromptMode = (typeof H3_PROMPT_MODES)[number];
export type H3PromptIssueCode =
  | 'brief-required'
  | 'duration-out-of-range'
  | 'start-frame-required'
  | 'end-frame-required'
  | 'canvas-generation-requires-start'
  | 'ref2va-image-required'
  | 'prompt-too-long'
  | 'brief-not-english'
  | 'missing-section'
  | 'missing-alignment-instruction';
export type H3PromptIssue = { code: H3PromptIssueCode; severity: 'error' | 'warning'; section?: string };
export type H3PromptCompilerInput = {
  mode: H3PromptMode;
  brief: string;
  prompt?: string;
  duration: number | string;
  hasStartFrame: boolean;
  hasEndFrame: boolean;
  referenceVideoCount?: number;
  referenceAudioCount?: number;
};
export type H3PromptValidation = { issues: H3PromptIssue[]; isReady: boolean };

const MAX_PROMPT_LENGTH = 7000;
const BASE_SECTIONS = ['integrated_multimodal_description', 'overall_soundscape', 'non_diegetic_music'];
const REFERENCE_SECTIONS = ['subject_definitions', 'summary', 'retention_analysis', 'detailed_description', 'overall_soundscape', 'non_diegetic_music'];

function seconds(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function keyframeInstruction(mode: H3PromptMode, duration: number) {
  const finalSecond = duration.toFixed(2);
  if (mode === 'I2VA') return 'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.';
  if (mode === 'FL2VA') return `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the ${finalSecond}-second mark of the target video.`;
  if (mode === 'L2VA') return `How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the ${finalSecond}-second mark of the target video.`;
  return '';
}

function referenceDefinitions(input: H3PromptCompilerInput) {
  const lines: string[] = [];
  if (input.hasStartFrame) lines.push('<Picture 1> is the reference image for [Shot 1], preserving its subject, composition, and visual anchors.');
  for (let index = 0; index < (input.referenceVideoCount || 0); index += 1) lines.push(`<Video ${index + 1}> is a motion reference for [Shot 1], preserving useful movement and timing cues.`);
  for (let index = 0; index < (input.referenceAudioCount || 0); index += 1) lines.push(`<Audio ${index + 1}> is an audio reference for [Shot 1], preserving voice, delivery, and sound cues.`);
  if (input.hasEndFrame) lines.push(`<Picture ${input.hasStartFrame ? '2' : '1'}> is the ending reference for the final moment, preserving its composition and visible state.`);
  return lines.length ? lines.join('\n') : 'Add each bound reference image, video, or audio source here before generation.';
}

function retentionAnalysis(input: H3PromptCompilerInput) {
  const lines: string[] = [];
  if (input.hasStartFrame) lines.push('<Picture 1> ([Shot 1] reference image): fully_preserved - its visible composition and subject identity anchor the result.');
  for (let index = 0; index < (input.referenceVideoCount || 0); index += 1) lines.push(`<Video ${index + 1}> ([Shot 1] motion reference): selectively_preserved - retain its useful motion and timing cues.`);
  for (let index = 0; index < (input.referenceAudioCount || 0); index += 1) lines.push(`<Audio ${index + 1}> ([Shot 1] audio reference): selectively_preserved - retain its voice, delivery, and sound cues.`);
  if (input.hasEndFrame) lines.push(`<Picture ${input.hasStartFrame ? '2' : '1'}> (final frame): fully_preserved - its composition and visible state anchor the ending.`);
  return lines.length ? lines.join('\n') : 'Add a retention relationship for every reference asset before generation.';
}

export function compileH3Prompt(input: H3PromptCompilerInput) {
  const brief = input.brief.trim();
  const duration = seconds(input.duration);
  if (!brief) return { prompt: '', validation: validateH3Prompt({ ...input, prompt: '' }) };

  const prompt = input.mode === 'Ref2VA'
    ? [
        'subject_definitions:',
        referenceDefinitions(input),
        '',
        'summary:',
        `[reference generation] ${brief}`,
        '',
        'retention_analysis:',
        retentionAnalysis(input),
        '',
        'detailed_description:',
        `The target video follows the bound reference material. [Shot 1] ${brief}`,
        '',
        'overall_soundscape:',
        'N/A',
        '',
        'non_diegetic_music:',
        'N/A',
      ].join('\n')
    : [
        keyframeInstruction(input.mode, duration),
        keyframeInstruction(input.mode, duration) ? '' : null,
        `integrated_multimodal_description: [Shot 1] ${brief}`,
        '',
        'overall_soundscape: N/A',
        '',
        'non_diegetic_music: N/A',
      ].filter((line): line is string => line !== null).join('\n');

  return { prompt, validation: validateH3Prompt({ ...input, prompt }) };
}

export function validateH3Prompt(input: H3PromptCompilerInput): H3PromptValidation {
  const issues: H3PromptIssue[] = [];
  const brief = input.brief.trim();
  const prompt = input.prompt?.trim() || '';
  const duration = seconds(input.duration);
  const requiredSections = input.mode === 'Ref2VA' ? REFERENCE_SECTIONS : BASE_SECTIONS;

  if (!brief) issues.push({ code: 'brief-required', severity: 'error' });
  if (duration < 4 || duration > 15 || !Number.isInteger(duration)) issues.push({ code: 'duration-out-of-range', severity: 'error' });
  if (input.mode === 'I2VA' || input.mode === 'FL2VA') {
    if (!input.hasStartFrame) issues.push({ code: 'start-frame-required', severity: 'error' });
  }
  if (input.mode === 'FL2VA' || input.mode === 'L2VA') {
    if (!input.hasEndFrame) issues.push({ code: 'end-frame-required', severity: 'error' });
  }
  if ((input.mode === 'T2VA' || input.mode === 'L2VA') && !input.hasStartFrame) issues.push({ code: 'canvas-generation-requires-start', severity: 'warning' });
  if (input.mode === 'Ref2VA' && !input.hasStartFrame && !(input.referenceVideoCount || 0)) issues.push({ code: 'ref2va-image-required', severity: 'error' });
  if (brief && /[\u3400-\u9fff]/.test(brief)) issues.push({ code: 'brief-not-english', severity: 'warning' });
  if (prompt.length > MAX_PROMPT_LENGTH) issues.push({ code: 'prompt-too-long', severity: 'error' });
  if (prompt) {
    if (input.mode !== 'T2VA' && input.mode !== 'Ref2VA' && !prompt.includes(input.mode === 'I2VA' ? 'For the target video, at 0.00 seconds' : 'How the reference pictures align with the target video')) issues.push({ code: 'missing-alignment-instruction', severity: 'error' });
    for (const section of requiredSections) {
      if (!prompt.includes(`${section}:`)) issues.push({ code: 'missing-section', severity: 'error', section });
    }
  }
  return { issues, isReady: !issues.some(issue => issue.severity === 'error') };
}

export function describeH3PromptIssue(issue: H3PromptIssue, locale: 'zh' | 'en') {
  const zh = locale === 'zh';
  switch (issue.code) {
    case 'brief-required': return zh ? '请先填写创作描述。' : 'Add a creative brief first.';
    case 'duration-out-of-range': return zh ? 'H3 仅支持 4–15 秒的整数时长。' : 'H3 supports whole-number durations from 4–15 seconds.';
    case 'start-frame-required': return zh ? '此模式需要 START 首帧。' : 'This mode requires a START frame.';
    case 'end-frame-required': return zh ? '此模式需要 END 尾帧。' : 'This mode requires an END frame.';
    case 'canvas-generation-requires-start': return zh ? '当前画布生成接口仍要求 START 首帧；本次仅可编译 T2VA/L2VA Prompt。' : 'The current canvas generation API still requires a START frame; this only compiles the T2VA/L2VA prompt.';
    case 'ref2va-image-required': return zh ? 'Ref2VA 至少需要一张参考图片或一个参考视频；请先上传素材。' : 'Ref2VA needs at least one reference image or video; upload an asset first.';
    case 'prompt-too-long': return zh ? '编译后的 Prompt 超过 H3 的 7,000 字符上限。' : 'The compiled prompt exceeds H3’s 7,000-character limit.';
    case 'brief-not-english': return zh ? '技能规范建议将最终 Prompt 编辑为英文；对话和画面文字可保留原语言。' : 'The skill recommends editing the final prompt in English; dialogue and visible text may keep their original language.';
    case 'missing-section': return zh ? `缺少 H3 必填段落：${issue.section}。` : `Missing required H3 section: ${issue.section}.`;
    case 'missing-alignment-instruction': return zh ? '缺少当前模式要求的首帧/尾帧对齐指令；请重新编译或手工补齐。' : 'The mode-specific frame-alignment instruction is missing; compile again or add it manually.';
  }
}
