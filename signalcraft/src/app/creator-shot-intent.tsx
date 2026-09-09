'use client';

import type { CanvasShotSemantic } from '@/src/lib/canvas-domain';

type IntentField = 'purpose' | 'character' | 'scene' | 'camera' | 'motion';
const fields: IntentField[] = ['purpose', 'character', 'scene', 'camera', 'motion'];

export default function CreatorShotIntent({ shot, zh, onChange, onApply }: {
  shot: CanvasShotSemantic;
  zh: boolean;
  onChange: (field: IntentField, value: string) => void;
  onApply: () => void;
}) {
  const labels: Record<IntentField, string> = zh
    ? { purpose: '这镜要达成什么', character: '人物变化', scene: '场景变化', camera: '镜头语言', motion: '动作节奏' }
    : { purpose: 'Purpose', character: 'Character change', scene: 'Scene change', camera: 'Camera', motion: 'Motion' };
  const placeholder: Record<IntentField, string> = zh
    ? { purpose: '例如：让观众看清产品质感', character: '例如：Lina 从犹豫到决定', scene: '例如：从门口走入咖啡馆', camera: '例如：中近景缓慢推进', motion: '例如：停顿后抬手拿起杯子' }
    : { purpose: 'For example: reveal the product texture', character: 'For example: Lina shifts from unsure to decisive', scene: 'For example: enter the cafe from the doorway', camera: 'For example: slow medium close-in', motion: 'For example: pause, then lift the cup' };
  const filled = fields.filter(field => shot[field].trim()).length;
  return <section className="creator-shot-intent" aria-labelledby="creator-shot-intent-title">
    <div className="creator-shot-intent-copy"><span>04 · {zh ? `镜头意图 / ${String(shot.index).padStart(2, '0')}` : `SHOT INTENT / ${String(shot.index).padStart(2, '0')}`}</span><h2 id="creator-shot-intent-title">{zh ? '先写清这一镜，再让它进入 Prompt。' : 'Name this shot before it enters the Prompt.'}</h2><p>{zh ? '这是当前镜头独有的变化，不会改动项目 Bible，也不会自动提交生成。' : 'This is unique to the current shot. It never changes the Project Bible or submits generation automatically.'}</p></div>
    <div className="creator-shot-intent-fields" role="group" aria-label={zh ? '当前镜头意图' : 'Current shot intent'}>{fields.map(field => <label key={field}><span>{labels[field]}</span><input value={shot[field]} maxLength={field === 'purpose' ? 240 : 160} onChange={event => onChange(field, event.target.value)} placeholder={placeholder[field]} /></label>)}</div>
    <div className="creator-shot-intent-action"><span>{zh ? `已填写 ${filled}/5 项` : `${filled}/5 filled`}</span><button type="button" onClick={onApply}>{zh ? '带入当前 Prompt' : 'Apply to current Prompt'} <span aria-hidden="true">→</span></button><small>{zh ? '规则会以可见文本加入，可继续修改。' : 'Rules are added as visible text and remain editable.'}</small></div>
  </section>;
}
