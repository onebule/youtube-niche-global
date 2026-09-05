'use client';

import { useEffect, useState } from 'react';
import { contextFromQuery, saveNicheAnalysisContext, buildTrendRadarHref, type NicheAnalysisContext } from '@/src/lib/niche-analysis-context';
import { addReviewedShortTest, type ProductionHandoff, type TestDirection } from '@/src/lib/product-convergence';
import { CreatorProfileFilters, DecisionWorkbench } from './discovery-workbench';
import { discoveryNavigate } from './converged-radar';
import type { UiLocale } from '@/src/lib/ui-language';

export default function ShortformNicheEvaluation({ locale, onCreate }: { locale: UiLocale; onCreate?: (handoff: ProductionHandoff) => void }) {
  const zh = locale === 'zh';
  const [context, setContext] = useState<NicheAnalysisContext | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const sync = () => { setContext(contextFromQuery(new URLSearchParams(window.location.search))); setReady(true); };
    const timer = setTimeout(sync, 0);
    window.addEventListener('popstate', sync); window.addEventListener('signalcraft:navigate', sync);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', sync); window.removeEventListener('signalcraft:navigate', sync); };
  }, []);
  const unit = context?.discovery?.unit;
  if (!ready) return <main className="discovery-workbench"><p role="status">{zh ? '正在读取所选方向…' : 'Reading selected direction…'}</p></main>;
  if (!unit || unit.format !== 'SHORTS') return <main className="discovery-workbench"><h1>{zh ? '从 Shorts 雷达选择一个方向' : 'Select a Shorts direction first'}</h1><p>{zh ? '当前账号没有这个方向的完整证据。旧链接或另一账号的数据不会被自动接入。' : 'Full evidence is unavailable for this account. Legacy or another account’s context is not reused.'}</p><button type="button" onClick={() => discoveryNavigate('/short-radar')}>{zh ? '打开 Shorts 趋势雷达' : 'Open Shorts Radar'} →</button></main>;
  return <main className="discovery-workbench"><button type="button" className="discovery-link" onClick={() => discoveryNavigate(buildTrendRadarHref(context!, true))}>← {zh ? '返回趋势雷达' : 'Back to Radar'}</button><CreatorProfileFilters locale={locale}/>
    <DecisionWorkbench key={unit.id + ':' + unit.tests.length} unit={unit} locale={locale} onCreate={onCreate} bridgeNote={zh ? '所选测试保存到当前账号的选题工作区，作为轻量制作入口；不复制长视频全链。' : 'Save the selected test in this account’s Ideas workspace as a lightweight production entry.'}/>
    {unit.pattern && <details className="discovery-profile"><summary>{zh ? '补充有依据的测试假设' : 'Add an evidence-backed test hypothesis'}</summary><p>{zh ? '先打开来源视频核验，再确认具体问题。这里只保存你的假设，不宣称它已经验证成功。' : 'Review the source video, then confirm the audience question. This saves a hypothesis, not a proven result.'}</p><form onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const next = addReviewedShortTest(unit, { id: crypto.randomUUID(), subNiche: String(form.get('subNiche') || ''), question: String(form.get('question') || ''), promise: String(form.get('promise') || ''), sourceVideoId: String(form.get('sourceVideoId') || ''), group: String(form.get('group') || 'CORE') as TestDirection['group'] });
      if (!next) { setMessage(zh ? '请填写不同于大类的具体方向、观众问题、承诺和有效来源；不要重复已有问题。' : 'Provide a specific direction, unique question, promise, and valid source.'); return; }
      const updated = { ...context!, discovery: { ...context!.discovery!, unit: next } }; saveNicheAnalysisContext(updated); setContext(updated); setMessage(zh ? '已保存这条待测试假设。' : 'Test hypothesis saved.');
    }}><div className="discovery-profile-fields"><label>{zh ? '具体受众 / 子方向' : 'Specific audience / sub-niche'}<input name="subNiche" required maxLength={200} defaultValue={unit.subNiche || ''}/></label><label>{zh ? '要验证的观众问题' : 'Audience question'}<input name="question" required maxLength={400}/></label><label>{zh ? '本条视频的承诺' : 'Video promise'}<input name="promise" required maxLength={400}/></label><label>{zh ? '来源视频' : 'Source video'}<select name="sourceVideoId" required>{unit.market.evidenceVideoIds.slice(0, 20).map(id => <option key={id}>{id}</option>)}</select></label><label>{zh ? '测试角色' : 'Test role'}<select name="group"><option value="CORE">{zh ? '核心机制' : 'Core'}</option><option value="ADAPTATION">{zh ? '受众适配' : 'Adaptation'}</option><option value="EXPLORE">{zh ? '探索角度' : 'Explore'}</option></select></label></div><button className="discovery-link" type="submit">{zh ? '保存测试假设' : 'Save test hypothesis'}</button></form><p role="status">{message}</p></details>}
  </main>;
}
