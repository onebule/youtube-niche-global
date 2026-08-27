import type { CanvasReferenceMode } from './canvas-shot-workspace';
import type { VideoModelId } from './video-generation';

export type CanvasTemplate = {
  id: string;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
  promptZh: string;
  promptEn: string;
  recommendedModel: Exclude<VideoModelId, 'auto'>;
  referenceMode: CanvasReferenceMode;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  tagsZh: string[];
  tagsEn: string[];
};

/**
 * Curated starting points for common commercial shots. A template is only a
 * local preset: applying one changes the draft Prompt and compatible settings
 * but never submits a generation task or silently changes the selected model.
 */
export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'product-reveal',
    labelZh: '产品揭幕',
    labelEn: 'Product reveal',
    descriptionZh: '让产品从静态参考中自然出现，强调材质与轮廓。',
    descriptionEn: 'Bring a product to life while preserving its shape and material.',
    promptZh: '产品保持外观与材质一致，镜头缓慢向前推进并从侧面绕过主体，柔和高光掠过轮廓，背景保持干净，商业广告质感，动作克制自然。',
    promptEn: 'Keep the product shape and material consistent. Slowly push in and arc around the subject as a soft highlight travels across its edges. Keep the background clean with restrained, natural motion and a polished commercial look.',
    recommendedModel: 'seedance-2-5',
    referenceMode: 'omni',
    duration: '6s',
    aspectRatio: '16:9',
    resolution: '1080p',
    tagsZh: ['产品', '广告', '材质'],
    tagsEn: ['Product', 'Ad', 'Material'],
  },
  {
    id: 'vertical-hook',
    labelZh: '竖屏开场钩子',
    labelEn: 'Vertical hook',
    descriptionZh: '适合短视频首 3 秒，主体快速进入画面。',
    descriptionEn: 'A fast first three seconds for vertical short-form content.',
    promptZh: '主体在前 1 秒内明确进入画面，镜头快速但平滑地推近，动作在中段形成一个清晰停顿，保留主体身份与服装细节，竖屏短视频开场节奏。',
    promptEn: 'Bring the subject clearly into frame within the first second. Move in quickly but smoothly, add one readable beat in the middle, and preserve the subject identity and wardrobe details for a vertical short-form hook.',
    recommendedModel: 'seedance-2-5',
    referenceMode: 'omni',
    duration: '6s',
    aspectRatio: '9:16',
    resolution: '720p',
    tagsZh: ['短视频', '开场', '竖屏'],
    tagsEn: ['Shorts', 'Hook', 'Vertical'],
  },
  {
    id: 'character-continuity',
    labelZh: '角色连续动作',
    labelEn: 'Character continuity',
    descriptionZh: '首尾帧之间保持人物身份，适合连续镜头衔接。',
    descriptionEn: 'Keep a character consistent between the start and end frames.',
    promptZh: '保持人物脸部、发型、服装和体态一致，人物从当前姿态自然走向尾帧姿态，镜头轻微跟随，动作连续稳定，不新增人物，不改变场景结构。',
    promptEn: 'Keep the character’s face, hair, wardrobe, and posture consistent. Move naturally from the current pose to the end-frame pose with a gentle follow camera. Preserve the scene structure and do not add characters.',
    recommendedModel: 'minimax-h3',
    referenceMode: 'start-end',
    duration: '8s',
    aspectRatio: '16:9',
    resolution: '768P',
    tagsZh: ['人物', '连续性', '首尾帧'],
    tagsEn: ['Character', 'Continuity', 'Start / end'],
  },
  {
    id: 'brand-atmosphere',
    labelZh: '品牌氛围镜头',
    labelEn: 'Brand atmosphere',
    descriptionZh: '用慢速镜头与光线变化建立品牌情绪。',
    descriptionEn: 'Build a brand mood with a slow camera and controlled light.',
    promptZh: '镜头以电影感的慢速横移观察主体，光线从侧后方逐渐变暖，前景保持轻微层次变化，主体始终清晰稳定，整体克制、可靠、具有品牌片质感。',
    promptEn: 'Use a slow cinematic lateral move to observe the subject. Warm the side-back light gradually, add subtle depth in the foreground, and keep the subject clear and stable with a restrained, trustworthy brand-film feel.',
    recommendedModel: 'minimax-h3',
    referenceMode: 'start-end',
    duration: '10s',
    aspectRatio: '16:9',
    resolution: '2K',
    tagsZh: ['品牌', '氛围', '电影感'],
    tagsEn: ['Brand', 'Mood', 'Cinematic'],
  },
];

export function canvasTemplateById(id: string) {
  return CANVAS_TEMPLATES.find(template => template.id === id) || null;
}
