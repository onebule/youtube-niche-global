'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { scopedStorageKey } from '@/src/lib/account-storage';
import { normalizeProfile, PROFILE_OPTIONS, recommend, entryWindow, marketDecision, creatorFit, differentiation, firstTests, buildProductionHandoff, type CreatorProfile, type OpportunityUnit, type ProductionHandoff, type Decision } from '@/src/lib/product-convergence';
import type { UiLocale } from '@/src/lib/ui-language';
import './discovery-workbench.css';

const ProfileContext = createContext<{ profile: CreatorProfile; ready: boolean; setProfile: (profile: CreatorProfile) => void; persisted: boolean }>({ profile: {}, ready: false, setProfile: () => {}, persisted: false });
export function DiscoveryProfileProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [profile, setValue] = useState<CreatorProfile>({});
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const key = scopedStorageKey('signalcraft:creator-profile:v1', scope);
  useEffect(() => {
    const sync = () => { try { setValue(normalizeProfile(JSON.parse(localStorage.getItem(key) || '{}'))); } catch { setValue({}); } setReady(true); };
    const timer = setTimeout(sync, 0);
    const changed = (event: StorageEvent) => { if (event.key === key) sync(); };
    window.addEventListener('storage', changed);
    return () => { clearTimeout(timer); window.removeEventListener('storage', changed); };
  }, [key]);
  const setProfile = (next: CreatorProfile) => {
    const normalized = normalizeProfile(next); setValue(normalized);
    try { localStorage.setItem(key, JSON.stringify(normalized)); setPersisted(true); } catch { setPersisted(false); }
  };
  return <ProfileContext.Provider value={{ profile, ready, setProfile, persisted }}>{children}</ProfileContext.Provider>;
}
export const useCreatorProfile = () => useContext(ProfileContext);
const copy: Record<string, [string, string]> = {
  RECOMMENDED: ['强烈值得尝试', 'Worth pursuing'], TEST: ['建议测试', 'Test first'], WATCH: ['继续观察', 'Watch'], DEPRIORITIZE: ['降低优先级', 'Lower priority'], AVOID: ['不建议进入', 'Avoid entry'], INSUFFICIENT: ['证据不足', 'Insufficient evidence'],
  OPEN: ['可以切入', 'Open'], NARROWING: ['窗口收窄', 'Narrowing'], CLOSED: ['暂不切入', 'Closed'], UNDETERMINED: ['窗口待确认', 'Undetermined'],
  LOW: ['低', 'Low'], MEDIUM: ['中', 'Medium'], HIGH: ['高', 'High'], VERY_HIGH: ['很高', 'Very high'], MODERATE: ['中', 'Moderate'], UNKNOWN: ['未知', 'Unknown'],
  SHORTS: ['Shorts', 'Shorts'], LONG_FORM: ['长视频', 'Long-form'], BOTH: ['两种都考虑', 'Both'], FACELESS: ['不出镜', 'Faceless'], ON_CAMERA: ['可以出镜', 'On camera'], EITHER: ['都可以', 'Either'],
  BEGINNER: ['刚开始', 'Beginner'], INTERMEDIATE: ['能独立使用', 'Intermediate'], ADVANCED: ['熟练', 'Advanced'], ADS: ['广告', 'Ads'], AFFILIATE: ['带货佣金', 'Affiliate'], SPONSOR: ['品牌合作', 'Sponsorship'], PRODUCT: ['自有产品', 'Product'], TRAFFIC: ['引流', 'Traffic'], BRAND: ['个人品牌', 'Brand'], UNSURE: ['还没决定', 'Undecided'],
  ALIGNED: ['已知条件适配', 'Known conditions align'], CONSTRAINED: ['存在条件冲突', 'Known constraints'], ACCELERATING: ['加速', 'Accelerating'], GROWING: ['增长', 'Growing'], STABLE: ['稳定', 'Stable'], DILUTING: ['模式效果稀释', 'Diluting'], DECLINING: ['回落', 'Declining'],
};
export const discoveryLabel = (key: string, locale: UiLocale) => copy[key]?.[locale === 'zh' ? 0 : 1] || key;
export function CreatorProfileFilters({ locale }: { locale: UiLocale }) {
  const { profile, setProfile, ready, persisted } = useCreatorProfile(); const zh = locale === 'zh';
  const questions: Array<[keyof CreatorProfile, string, string]> = [['format', '想做什么形态？', 'Content format?'], ['presence', '愿意出镜吗？', 'On camera?'], ['weeklyTime', '每周可投入时间？', 'Weekly time?'], ['aiSkill', 'AI 使用熟练度？', 'AI experience?'], ['budget', '可投入预算？', 'Budget?'], ['goal', '最想实现什么？', 'Primary goal?']];
  return <details className="discovery-profile"><summary>{zh ? '你的创作条件' : 'Your creator profile'} <small>{Object.keys(profile).length}/6 · {zh ? '可跳过，随时调整' : 'optional, editable'}</small></summary><p>{zh ? '只影响推荐顺序，不改变市场事实。保存在本机当前账号下；未填写或缺少制作要求时，适配保持未知。' : 'Changes ranking, never market facts. Saved locally for this account. Missing profile or requirements stay unknown.'}</p><div className="discovery-profile-fields">{questions.map(([key, cn, en]) => <label key={key}>{zh ? cn : en}<select disabled={!ready} value={profile[key] || ''} onChange={e => setProfile({ ...profile, [key]: e.target.value })}><option value="">{zh ? '暂不填写' : 'Skip'}</option>{PROFILE_OPTIONS[key].map(value => <option key={value} value={value}>{discoveryLabel(value, locale)}</option>)}</select></label>)}</div>{!persisted && <p role="status">{zh ? '浏览器未允许保存；本次选择仅在当前页面有效。' : 'Storage is unavailable; choices apply to this page only.'}</p>}</details>;
}
export function GoldenPath({ step, locale }: { step: number; locale: UiLocale }) {
  const items = locale === 'zh' ? ['发现方向', '判断机会', '确定做法', '选择测试', '进入制作'] : ['Find', 'Decide', 'Differentiate', 'Test', 'Produce'];
  return <ol className="discovery-path" aria-label={locale === 'zh' ? '创作路径' : 'Creator journey'}>{items.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}><span>0{index + 1}</span>{label}</li>)}</ol>;
}
function RadarVideoEvidence({ unit, locale }: { unit: OpportunityUnit; locale: UiLocale }) {
  const zh = locale === 'zh';
  if (!unit.representativeVideos?.length) return null;
  return <div className="discovery-video-evidence"><b>{zh ? '代表视频 · 打开核验' : 'Representative videos · verify at source'}</b><ul>{unit.representativeVideos.map(video => <li key={video.videoId}><a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer">{video.title || (zh ? '无标题视频' : 'Untitled video')} ↗</a><small>{video.channelTitle || (zh ? '频道未提供' : 'Channel unavailable')}{video.views !== null ? ` · ${video.views.toLocaleString()} ${zh ? '次播放' : 'views'}` : ''}</small></li>)}</ul></div>;
}
function radarSignal(value: number | null | undefined, bands: Array<[number, string]>, fallback: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return bands.find(([minimum]) => value >= minimum)?.[1] || fallback;
}
function RadarSignalRow({ unit, locale }: { unit: OpportunityUnit; locale: UiLocale }) {
  const zh = locale === 'zh';
  const opportunity = radarSignal(unit.market.opportunityScore, [[70, zh ? '较强' : 'Stronger'], [45, zh ? '可观察' : 'Watch'], [0, zh ? '有限' : 'Limited']], zh ? '待确认' : 'Review');
  const growth = radarSignal(unit.market.growth, [[25, zh ? '快' : 'Fast'], [1, zh ? '增长' : 'Growing']], zh ? '待确认' : 'Review');
  const competition = radarSignal(unit.market.concentration, [[75, zh ? '偏高' : 'Higher'], [45, zh ? '中等' : 'Medium'], [0, zh ? '偏低' : 'Lower']], zh ? '待确认' : 'Review');
  const smallCreator = radarSignal(unit.market.smallCreatorBreakouts, [[2, zh ? '较高' : 'High'], [1, zh ? '存在' : 'Present'], [0, zh ? '未见' : 'None']], zh ? '待确认' : 'Review');
  return <dl className="discovery-signal-row">
    <div><dt>{zh ? '机会' : 'Opportunity'}</dt><dd>{opportunity}</dd></div>
    <div><dt>{zh ? '增长' : 'Growth'}</dt><dd>{growth}</dd></div>
    <div><dt>{zh ? '竞争' : 'Competition'}</dt><dd>{competition}</dd></div>
    <div><dt>{zh ? '小频道机会' : 'Small creator'}</dt><dd>{smallCreator}</dd></div>
    <div><dt>{zh ? 'AI 适配' : 'AI fit'}</dt><dd>{zh ? '待评估' : 'Review'}</dd></div>
    <div><dt>{zh ? '变现' : 'Monetization'}</dt><dd>{zh ? '暂无数据' : 'No data'}</dd></div>
  </dl>;
}
export function DiscoveryCards({ units, format, locale, onEvaluate, marketOnly = false }: { units: OpportunityUnit[]; format: OpportunityUnit['format']; locale: UiLocale; onEvaluate: (unit: OpportunityUnit) => void; marketOnly?: boolean }) {
  const { profile } = useCreatorProfile(); const zh = locale === 'zh';
  const [tab, setTab] = useState('MARKET');
  const feed = useMemo(() => recommend(units, profile, format), [units, profile, format]);
  const active = marketOnly ? 'MARKET' : tab;
  const shown = active === 'PERSONAL' ? [...feed.top, ...(feed.explore ? [feed.explore] : [])] : active === 'MARKET' ? feed.market : active === 'EXPLORE' ? (feed.explore ? [feed.explore] : []) : feed.market.filter(item => ['CONFIRMED', 'GROWING'].includes(item.unit.market.lifecycle) && !['AVOID', 'INSUFFICIENT'].includes(item.decision));
  const pending = feed.pending;
  return <section className="discovery-feed">
    <p className="discovery-caption" role="status">{zh ? `已形成 ${feed.market.length} 条可评估的细分方向 · 当前显示 ${shown.length} 条。另有 ${pending.length} 条信号仍在识别，不会被当成推荐赛道。` : `${feed.market.length} actionable micro-niches · ${shown.length} shown. ${pending.length} signals are still being classified and are not recommendations.`}</p>
    {active === 'PERSONAL' && !shown.length && feed.market.length > 0 && <p className="discovery-caption">{zh ? `市场数据没有消失：${feed.market.filter(item => item.fit.level === 'CONSTRAINED').length} 条与你的创作条件冲突，其余可能尚未达到优先推荐门槛。切换“市场机会”可查看全部证据。` : 'Market evidence is still available. Profile conflicts or insufficient evidence exclude these leads from personal priorities; switch to Market to inspect them.'}</p>}
    {!marketOnly && <nav className="discovery-tabs" aria-label={zh ? '机会浏览方式' : 'Discovery lens'}>{[['PERSONAL', '为你推荐', 'For you'], ['MARKET', '市场机会', 'Market'], ['BREAKOUT', '正在爆发', 'Breaking out'], ['EXPLORE', '值得探索', 'Explore']].map(([key, cn, en]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{zh ? cn : en}</button>)}</nav>}
    {active === 'PERSONAL' && <p className="discovery-caption">{zh ? '最多 3 个优先方向 + 1 个探索方向。资料不足时按公开证据筛选，不凑数。' : 'Up to 3 priorities + 1 exploration. Public evidence first; never pad missing opportunities.'}</p>}
    <div className="discovery-card-grid">{shown.map(({ unit, decision, fit }) => <article key={unit.id} className="discovery-card"><div className="discovery-eyebrow"><span>{discoveryLabel(unit.format, locale)} · {active === 'PERSONAL' && feed.explore?.unit.id === unit.id ? (zh ? '探索方向' : 'Explore') : (zh ? '可评估细分方向' : 'Actionable micro-niche')}</span><b data-decision={decision}>{discoveryLabel(decision, locale)} · {zh ? `可信度 ${discoveryLabel(unit.market.confidence, locale)}` : `${discoveryLabel(unit.market.confidence, locale)} confidence`}</b></div><h2>{unit.subNiche}</h2><p className="discovery-caption">{zh ? `来源分类：${unit.niche}` : `Source category: ${unit.niche}`}{unit.durationBucket ? ` · ${unit.durationBucket.replace(/M_PLUS$/, '+ 分钟').replace(/M$/, ' 分钟').replace(/_/g, '–')}` : ''}</p><p className="discovery-pattern">{zh ? `推荐切入：${unit.pattern?.label}` : `Recommended entry: ${unit.pattern?.label}`}</p><RadarSignalRow unit={unit} locale={locale}/><div className="discovery-why"><b>{zh ? '为什么现在值得关注' : 'Why now'}</b>{unit.market.facts.slice(0, 2).map(fact => <p key={fact}>{fact}</p>)}{fit.reasons.slice(0, 1).map(reason => <p key={reason.field}>{reason.text} <small>{reason.source === 'EXPLICIT_PROFILE' ? (zh ? '· 你的选择' : '· your profile') : (zh ? '· 公开证据' : '· public evidence')}</small></p>)}</div><details><summary>{zh ? `查看证据 · ${unit.representativeVideos?.length || 0}` : `View evidence · ${unit.representativeVideos?.length || 0}`}</summary><RadarVideoEvidence unit={unit} locale={locale}/>{unit.market.facts.slice(2, 5).map(fact => <p key={fact}>{fact}</p>)}<p>{unit.market.provenance} · {unit.market.capturedAt || 'UNKNOWN'}</p>{fit.whyNot.map(r => <p key={r.field}>{zh ? '暂不优先：' : 'Not prioritized: '}{r.text} · {r.evidence}</p>)}<p>{zh ? '竞争只反映当前样本中的频道集中度；AI 适配与变现没有可靠数据时保持待评估。' : 'Competition reflects creator concentration in this cohort only; AI fit and monetization remain unassessed without reliable data.'}</p></details><button className="discovery-primary" type="button" onClick={() => onEvaluate(unit)}>{zh ? '评估这个赛道' : 'Evaluate this niche'} →</button></article>)}</div>
    {!shown.length && <div className="discovery-empty"><h3>{zh ? '暂时没有可直接评估的细分赛道' : 'No actionable micro-niche yet'}</h3><p>{zh ? '当前信号仍停留在平台分类或未验证形式。系统不会把它们包装成“现在就能做”的频道方向。' : 'Current signals are still categories or unverified formats. They are not presented as ready-to-make channel directions.'}</p></div>}
    {pending.length > 0 && <details className="discovery-classification-queue"><summary>{zh ? `赛道仍在识别 · ${pending.length} 条信号` : `Still classifying · ${pending.length} signals`}</summary><p>{zh ? '它们保留真实公开样本，但不会进入推荐、排序或制作流程。' : 'These retain real public evidence but never enter recommendations, ranking, or production until classification is specific enough.'}</p><div>{pending.slice(0, 12).map(unit => <article key={unit.id}><b>{unit.niche}</b><span>{unit.pattern?.label || (zh ? '形式待识别' : 'Format pending')}</span><small>{unit.market.videos} {zh ? '条样本 · ' : 'samples · '}{unit.market.creators} {zh ? '个频道' : 'creators'}</small><em>{unit.classification?.reason}</em></article>)}</div></details>}
    {!marketOnly && active !== 'MARKET' && <button type="button" className="discovery-link" onClick={() => setTab('MARKET')}>{zh ? '查看全部市场机会' : 'View all market opportunities'} →</button>}
  </section>;
}

export function DecisionWorkbench({ unit, locale, onCreate, creating = false, bridgeNote }: { unit: OpportunityUnit; locale: UiLocale; onCreate?: (handoff: ProductionHandoff) => void; creating?: boolean; bridgeNote?: string }) {
  const { profile } = useCreatorProfile(); const zh = locale === 'zh';
  const [selected, setSelected] = useState(''); const [reviewed, setReviewed] = useState(false); const [alternative, setAlternative] = useState(false);
  const tests = firstTests(unit), decision: Decision = marketDecision(unit), fit = creatorFit(unit, profile);
  const selectedTest = tests.find(test => test.id === selected);
  const originality = selectedTest?.originalityRisk ? { risk: selectedTest.originalityRisk, reason: selectedTest.originalityReason || unit.originality.reason } : unit.originality;
  const changes = differentiation({ ...unit, originality }, alternative);
  const handoff = buildProductionHandoff(unit, profile, selected, reviewed, alternative);
  const headings = zh ? ['市场判断', '对你适配', '推荐做法', '差异化建议'] : ['Market', 'Creator fit', 'Recommended pattern', 'Differentiation'];
  return <section className="decision-workbench"><GoldenPath step={1} locale={locale}/><header className="decision-heading"><span className="discovery-eyebrow">{discoveryLabel(unit.format, locale)} · {zh ? '赛道评估' : 'Niche evaluation'}</span><h1>{unit.subNiche || unit.niche}</h1>{unit.subNiche && <small>{zh ? `来源分类：${unit.niche}` : `Source category: ${unit.niche}`}</small>}<strong data-decision={decision}>{discoveryLabel(decision, locale)}</strong><p>{!unit.subNiche ? (zh ? '尚缺可核验的子赛道。先补足具体受众问题，再承诺制作。' : 'A grounded sub-niche is missing. Establish a specific audience question before production.') : (zh ? '先选择一个有证据来源的测试，再进入制作。' : 'Select one evidence-backed test before production.')}</p></header>
    <div className="decision-sections"><section><h2>01 {headings[0]}</h2><p>{unit.market.videos} {zh ? '条公开样本，来自' : 'public samples from'} {unit.market.creators} {zh ? '个独立频道' : 'independent creators'}</p><p>{discoveryLabel(entryWindow(unit), locale)} · {zh ? '可信度' : 'Confidence'} {discoveryLabel(unit.market.confidence, locale)}</p><small>{zh ? '收益潜力：未知。没有可靠估算，不展示 RPM 或收入数字。' : 'Monetization potential: unknown. No unsupported RPM or earnings.'}</small></section><section><h2>02 {headings[1]}</h2><b>{discoveryLabel(fit.level, locale)}</b>{fit.reasons.map(r => <p key={r.field}>{r.text}<small> · {r.source === 'EXPLICIT_PROFILE' ? (zh ? '显式选择' : 'Explicit profile') : (zh ? '公开证据' : 'Public evidence')}</small></p>)}{fit.whyNot.map(r => <p key={r.field}>{r.text}</p>)}<small>{zh ? '缺少研究成本、出镜或预算要求时，不推断“很适合你”。' : 'Unknown time, presence, and budget requirements are not inferred as a fit.'}</small></section><section><h2>03 {headings[2]}</h2><b>{unit.pattern?.label || (zh ? '机制证据不足' : 'Insufficient pattern evidence')}</b><p>{zh ? '模式趋势：' : 'Pattern trend: '}{discoveryLabel(unit.pattern?.trend || 'INSUFFICIENT', locale)}</p><p>{zh ? '保留可复用机制，不复制具体案例。标题元数据不能证明镜头、剪辑、音频或留存机制。' : 'Retain the mechanism, not the case. Titles do not establish editing, audio, or retention mechanisms.'}</p></section><section><h2>04 {headings[3]}</h2><p>{zh ? '原创性风险：' : 'Originality risk: '}{discoveryLabel(originality.risk, locale)}</p>{changes.axes.map(axis => <p key={axis.axis}><b>{axis.axis}</b> · {axis.suggestion}</p>)}<button type="button" className="discovery-link" onClick={() => { setAlternative(!alternative); setReviewed(false); }}>{zh ? '换一组差异化建议' : 'Try alternative differentiation'}</button><small>{zh ? '规则建议，不是已验证的市场空白。' : 'Rule-based suggestions, not verified market gaps.'}</small></section></div>
    <details className="decision-evidence"><summary>{zh ? '查看依据、代表视频与数据详情' : 'Evidence, proof videos and data details'}</summary><RadarVideoEvidence unit={unit} locale={locale}/><p>{unit.originality.reason}</p>{unit.market.facts.map(fact => <p key={fact}>{fact}</p>)}<p>{unit.market.provenance} · {unit.market.capturedAt || 'UNKNOWN'}</p><p>{zh ? '阈值状态：需校准。市场事实不会被个人条件改写。' : 'CALIBRATION_REQUIRED. Personal conditions never rewrite market facts.'}</p><div>{unit.market.evidenceVideoIds.slice(0, 8).filter(id => /^[\w-]{11}$/.test(id)).map(id => <a key={id} href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">{zh ? '公开视频' : 'Public video'} · {id} ↗</a>)}</div></details>
    <section className="decision-tests"><h2>{zh ? '建议先测试' : 'Test first'} · {unit.format === 'SHORTS' ? 'First 10' : 'First 3'}</h2><p>{zh ? `${tests.length} 条有来源方向；不足时保留空缺，不拼凑标题。` : `${tests.length} grounded directions; missing tests are not padded.`} {unit.format === 'SHORTS' ? (zh ? '目标结构 4 个核心 / 3 个适配 / 3 个探索，以实际证据为限。' : 'Target: 4 core / 3 adaptation / 3 exploration, evidence permitting.') : (zh ? '保持核心机制稳定，只改变问题、角度或主题。' : 'Keep the core pattern stable; vary question, angle, or subject.')}</p>{tests.length ? <fieldset><legend>{zh ? '选择一个测试方向' : 'Select one test'}</legend>{tests.map(test => <label key={test.id} className="decision-test"><input type="radio" name={`test-${unit.id}`} checked={selected === test.id} onChange={() => { setSelected(test.id); setReviewed(false); }}/><span><b>{test.audienceQuestion}</b><small>{test.direction}</small><span>{test.promise}</span><details><summary>{zh ? '测试设计与风险' : 'Test design and risks'}</summary><p>{zh ? '机制：' : 'Pattern: '}{test.pattern}</p><p>{test.differentiation.join('；')}</p><p>{test.evidenceNeeded.join('；')}</p><p>{test.visualDirection}</p><p>{zh ? '验证成本：' : 'Validation cost: '}{discoveryLabel(test.difficulty, locale)}</p><p>{test.mainRisk}</p><p>{test.whyTest}</p><small>{test.provenance} · {test.sourceVideoIds.join(', ')}</small></details></span></label>)}</fieldset> : <div className="discovery-empty">{zh ? '现有数据尚未提供有具体受众问题和来源的测试。先核验内容模式与案例，不自动拼出十条相似标题。' : 'No sourced audience-question tests are available. Verify patterns and cases before generating test directions.'}</div>}</section>
    {changes.requiresReview && <div className="decision-originality" role="status"><b>{zh ? '进入制作前，先确认差异化' : 'Review differentiation before production'}</b><p>{zh ? `保留“${changes.retain}”；改变具体对象、证据和结论。` : `Retain “${changes.retain}”; change the subject, evidence, and payoff.`}</p><label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>{zh ? '我已检查上述改动，不复用原案例的具体表达' : 'I reviewed the changes and will not duplicate the source expression'}</label></div>}
    <footer className="decision-footer"><div><b>{zh ? '下一步：只制作选中的一个测试' : 'Next: produce only the selected test'}</b><small>{bridgeNote || (zh ? '只创建方案，不触发视频生成、付费调用或 Canvas。' : 'Plan only. No video generation, paid call, or Canvas action.')}</small></div><button type="button" className="discovery-primary" disabled={!handoff || !onCreate || creating} onClick={() => { if (handoff) onCreate?.(handoff); }}>{creating ? (zh ? '创建中…' : 'Creating…') : (zh ? '创建制作方案' : 'Create production plan')} →</button></footer>
  </section>;
}
