'use client';

import { CREATOR_BIBLE_FIELDS, type CreatorBibleField, type CreatorProject } from '@/src/lib/creator-flow';

export default function CreatorProjectBible({
  project,
  zh,
  onFieldChange,
  onToggleLock,
  onApply,
}: {
  project: CreatorProject;
  zh: boolean;
  onFieldChange: (field: CreatorBibleField, value: string) => void;
  onToggleLock: (field: CreatorBibleField) => void;
  onApply: () => void;
}) {
  const labels: Record<CreatorBibleField, string> = zh
    ? { character: '人物 / 身份', scene: '场景', style: '风格', camera: '镜头', motion: '动作' }
    : { character: 'Character / identity', scene: 'Scene', style: 'Style', camera: 'Camera', motion: 'Motion' };
  const summary = CREATOR_BIBLE_FIELDS.reduce((value, field) => ({
    filled: value.filled + (project.bible[field].trim() ? 1 : 0),
    locked: value.locked + (project.bible[field].trim() && project.bible.locks[field] ? 1 : 0),
  }), { filled: 0, locked: 0 });

  return <section className="creator-bible" aria-labelledby="creator-bible-title">
    <div className="creator-bible-copy"><span>03 · {zh ? '项目 Bible' : 'PROJECT BIBLE'}</span><h2 id="creator-bible-title">{zh ? '写下每个镜头都该记住的事。' : 'Record what every shot should remember.'}</h2><p>{zh ? '可保存人物、场景、风格、镜头和动作方向。勾选“锁定”后，带入镜头、套用模板或应用 AI 导演稿时会保留为可见规则。' : 'Save character, scene, style, camera, and motion direction. Locked entries remain visible rules when you apply them to a shot, template, or AI Director draft.'}</p></div>
    <div className="creator-bible-fields" role="group" aria-label={zh ? '项目 Bible 规则' : 'Project Bible rules'}>
      {CREATOR_BIBLE_FIELDS.map(field => <label key={field} className={'creator-bible-field ' + (project.bible.locks[field] ? 'is-locked' : '')}>
        <span>{labels[field]}</span>
        <textarea value={project.bible[field]} maxLength={240} rows={2} onChange={event => onFieldChange(field, event.target.value)} placeholder={zh ? `例如：${field === 'character' ? '同一位短发女主角，深绿色外套' : field === 'scene' ? '雨后街道，暖色路灯' : field === 'style' ? '克制电影感，自然颗粒' : field === 'camera' ? '中近景缓慢推进' : '人物慢步前行，雨水反光'}` : `Add ${labels[field].toLowerCase()} guidance`} />
        <button type="button" className="creator-bible-lock" disabled={!project.bible[field].trim()} aria-pressed={project.bible.locks[field]} onClick={() => onToggleLock(field)}><span aria-hidden="true">{project.bible.locks[field] ? '⌑' : '○'}</span>{project.bible.locks[field] ? (zh ? '已锁定' : 'Locked') : (zh ? '锁定' : 'Lock')}</button>
      </label>)}
    </div>
    <div className="creator-bible-action"><span>{zh ? `已填写 ${summary.filled} 项 · 锁定 ${summary.locked} 项` : `${summary.filled} filled · ${summary.locked} locked`}</span><button type="button" onClick={onApply}>{zh ? '带入当前镜头' : 'Apply to current shot'}<span aria-hidden="true">→</span></button><small>{zh ? '不会自动提交生成。规则会显示在 Motion Prompt 中，可由你继续编辑。' : 'No generation is submitted. Rules appear in the Motion Prompt for you to review and edit.'}</small></div>
  </section>;
}
