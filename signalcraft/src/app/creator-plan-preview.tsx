'use client';

import { creatorBibleSummary, type CreatorProject } from '@/src/lib/creator-flow';
import type { VideoGenerationPlan } from '@/src/lib/video-generation';

export default function CreatorPlanPreview({ plan, project, shotTitle, shotNumber, zh }: {
  plan: VideoGenerationPlan;
  project: CreatorProject;
  shotTitle: string;
  shotNumber: number;
  zh: boolean;
}) {
  const bible = creatorBibleSummary(project.bible);
  const shotLabel = shotTitle.trim() || `${zh ? '镜头' : 'Shot'} ${String(shotNumber).padStart(2, '0')}`;
  const credits = plan.estimatedCredits === null
    ? (zh ? '暂不可计算' : 'Not available')
    : `${plan.estimatedCredits} ${zh ? '积分（预估）' : 'credits estimated'}`;

  return <section className="creator-plan-preview" aria-labelledby="creator-plan-preview-title">
    <div className="creator-plan-preview-copy"><span>04 · {zh ? '计划预览' : 'PLAN PREVIEW'}</span><h3 id="creator-plan-preview-title">{zh ? '先看清会发生什么，再决定是否采用。' : 'See the change before deciding to use it.'}</h3><p>{zh ? 'AI 导演只给出当前镜头的文字方案；没有任务已经提交。' : 'AI Director has proposed text for this shot only. No task has been submitted.'}</p></div>
    <dl className="creator-plan-preview-facts">
      <div><dt>{zh ? '影响范围' : 'Affects'}</dt><dd>{zh ? `镜头 ${String(shotNumber).padStart(2, '0')} · ${shotLabel}` : `Shot ${String(shotNumber).padStart(2, '0')} · ${shotLabel}`}</dd></div>
      <div><dt>{zh ? '拟用规格' : 'Proposed output'}</dt><dd>{plan.modelLabel} · {plan.duration} · {plan.aspectRatio || '—'} · {plan.resolution}</dd></div>
      <div><dt>{zh ? '预计资源' : 'Estimated resources'}</dt><dd>{credits}</dd></div>
      <div><dt>{zh ? '任务状态' : 'Task status'}</dt><dd>{zh ? '0 个已提交 · 需你确认' : '0 submitted · your confirmation required'}</dd></div>
    </dl>
    <footer>{zh ? `项目 Bible：${bible.filled} 项方向，其中 ${bible.locked} 项已锁定。锁定项会保留在你应用后的 Prompt 中。` : `Project Bible: ${bible.filled} directions, ${bible.locked} locked. Locked rules remain in the Prompt after you apply it.`}</footer>
  </section>;
}
