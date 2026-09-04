'use client';

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { getOpportunity } from '@/src/lib/mock';
import {
  createIdeaDraftFromCase,
  createViralCaseCorpusBrief,
  emptyViralCaseNotes,
  applyViralPatternToNotes,
  applyViralCaseCorpusCardToNotes,
  applyViralCaseAnalysisToNotes,
  createH3BriefFromCase,
  createViralCaseCanvasHandoff,
  DEFAULT_VIRAL_CASE_ANALYSIS_MODEL,
  VIRAL_CASE_ANALYSIS_MODELS,
  formatViralCaseReport,
  normalizeViralCaseNotes,
  normalizeViralCaseStore,
  VIRAL_CASE_STORAGE_KEY,
  VIRAL_CASE_CANVAS_HANDOFF_KEY,
  type ViralCaseIdeaDraft,
  type ViralCaseAnalysisModelId,
  type ViralCaseNotes,
  type ViralCaseStore,
} from '@/src/lib/viral-case';
import { getViralPattern, viralPatternLibrary, type ViralPattern } from '@/src/lib/viral-patterns';
import { viralCaseCorpus, type ViralCaseCorpusCard } from '@/src/lib/viral-case-corpus';
import { requestViralCaseAnalysis } from '@/src/lib/viral-case-analysis';
import { resolveYouTubeVideo } from '@/src/lib/youtube-video';
import { compileH3Prompt } from '@/src/lib/h3-prompt-compiler';
import type { Video } from '@/src/lib/types';
import type { UiLocale } from '@/src/lib/ui-language';
import type { AccountSession } from '@/src/lib/auth';
import { accountStorageKey } from '@/src/lib/account-storage';

type ViralCaseDeskProps = {
  account: AccountSession | null;
  videos: Video[];
  locale: UiLocale;
  onCreateIdea: (video: Video, draft: ViralCaseIdeaDraft) => void;
  onOpenVideo: (video: Video) => void;
  onOpenLibrary: () => void;
  onDiscover: () => void;
  onOpenCanvas: () => void;
  onImportVideo: (video: Video) => void;
  notify: (message: string) => void;
};

const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
const initialStore: ViralCaseStore = { version: 2, analysisModel: DEFAULT_VIRAL_CASE_ANALYSIS_MODEL, selectedVideoId: null, notesByVideoId: {} };
const beatLabels = ['0–3 秒 · 截停', '3–8 秒 · 规则', '8–17 秒 · 加码', '结尾 · 收口'] as const;
const corpusBucketOptions = ['S', 'A', 'B', 'C'] as const;
const corpusBucketPriority: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
const analysisSteps = ['读取公开证据', '提炼观看机制', '写入分析卡'] as const;
type AnalysisStep = 0 | 1 | 2;

const videoTitle = (video: Video, locale: UiLocale) => locale === 'zh' && video.titleZh?.trim() ? video.titleZh : video.title;

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  return safe < 60 ? `${safe} 秒` : `${Math.floor(safe / 60)} 分 ${String(safe % 60).padStart(2, '0')} 秒`;
}

function youtubeVideoId(sourceUrl?: string) {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const fromQuery = url.searchParams.get('v');
    const fromPath = url.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/i)?.[1] || url.pathname.match(/\/([\w-]{11})$/)?.[1];
    const id = fromQuery || fromPath;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function NoteField({ label, value, placeholder, onChange, rows = 3 }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="viral-case-field"><span>{label}</span><textarea value={value} rows={rows} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>;
}

export default function ViralCaseDesk({ account, videos, locale, onCreateIdea, onOpenVideo, onOpenLibrary, onDiscover, onOpenCanvas, onImportVideo, notify }: ViralCaseDeskProps) {
  const storageKey = accountStorageKey(VIRAL_CASE_STORAGE_KEY, account);
  const handoffStorageKey = accountStorageKey(VIRAL_CASE_CANVAS_HANDOFF_KEY, account);
  const [store, setStore] = useState<ViralCaseStore>(() => {
    if (typeof window === 'undefined') return initialStore;
    try {
      return normalizeViralCaseStore(JSON.parse(localStorage.getItem(storageKey) || 'null'));
    } catch {
      return initialStore;
    }
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<'idle' | 'running'>('idle');
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [h3Prompt, setH3Prompt] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importState, setImportState] = useState<'idle' | 'loading'>('idle');
  const [activePatternId, setActivePatternId] = useState(viralPatternLibrary[0]?.id || '');
  const [corpusQuery, setCorpusQuery] = useState('');
  const [corpusBucket, setCorpusBucket] = useState('all');
  const [corpusSort, setCorpusSort] = useState<'priority' | 'source' | 'title'>('priority');
  const [corpusVisibleCount, setCorpusVisibleCount] = useState(24);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(store));
        setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        setSavedAt(null);
      }
    }, 240);
    return () => window.clearTimeout(timer);
  }, [storageKey, store]);

  const selectedVideo = useMemo(() => {
    if (!videos.length) return null;
    return videos.find(video => video.id === store.selectedVideoId) || videos[0];
  }, [store.selectedVideoId, videos]);
  const notes = selectedVideo ? normalizeViralCaseNotes(store.notesByVideoId[selectedVideo.id]) : emptyViralCaseNotes();
  const signal = selectedVideo ? getOpportunity(selectedVideo) : null;
  const embedId = selectedVideo ? youtubeVideoId(selectedVideo.sourceUrl) : null;
  const analysisStatus = analysisState === 'running' ? 'running' : analysisError ? 'error' : notes.analysis ? 'success' : 'ready';
  const canCreateIdea = Boolean(notes.reusableMechanism.trim());
  const activePattern = getViralPattern(activePatternId) || viralPatternLibrary[0] || null;
  const deferredCorpusQuery = useDeferredValue(corpusQuery);
  const corpusBucketCounts = useMemo(() => viralCaseCorpus.reduce<Record<string, number>>((counts, card) => ({ ...counts, [card.bucket]: (counts[card.bucket] || 0) + 1 }), {}), []);
  const corpusMatches = useMemo(() => {
    const query = deferredCorpusQuery.trim().toLowerCase();
    const matches = viralCaseCorpus.filter(card => {
      const matchesBucket = corpusBucket === 'all' || card.bucket === corpusBucket;
      if (!matchesBucket) return false;
      if (!query) return true;
      return [card.sourceCaseId, card.title, card.summary, card.metrics, card.formula, card.emotion].join(' ').toLowerCase().includes(query);
    });
    if (corpusSort === 'title') return [...matches].sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
    if (corpusSort === 'priority') return matches.map((card, index) => ({ card, index })).sort((left, right) => (corpusBucketPriority[left.card.bucket] ?? 9) - (corpusBucketPriority[right.card.bucket] ?? 9) || left.index - right.index).map(item => item.card);
    return matches;
  }, [corpusBucket, corpusSort, deferredCorpusQuery]);
  const visibleCorpusCards = corpusMatches.slice(0, corpusVisibleCount);

  const selectVideo = (selectedVideoId: string) => {
    setStore(current => ({ ...current, selectedVideoId }));
  };

  const patchNotes = (patch: Partial<ViralCaseNotes>) => {
    if (!selectedVideo) return;
    setStore(current => {
      const currentNotes = normalizeViralCaseNotes(current.notesByVideoId[selectedVideo.id]);
      return {
        ...current,
        selectedVideoId: selectedVideo.id,
        notesByVideoId: {
          ...current.notesByVideoId,
          [selectedVideo.id]: { ...currentNotes, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    });
  };

  const saveNotes = () => {
    if (!selectedVideo) return;
    try {
      const next = { ...store, selectedVideoId: selectedVideo.id };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      notify('拆解已保存在当前账号');
    } catch {
      notify('当前账号无法保存研究笔记，请检查浏览器存储权限。');
    }
  };

  const requestAnalysis = async () => {
    if (!selectedVideo || analysisState === 'running') return;
    if (!selectedVideo.sourceUrl) {
      notify('该样本没有公开原视频地址，暂不能请求自动分析。');
      return;
    }
    setAnalysisError(null);
    setAnalysisState('running');
    setAnalysisStep(0);
    const progressTimers = [
      window.setTimeout(() => setAnalysisStep(1), 1200),
      window.setTimeout(() => setAnalysisStep(2), 3000),
    ];
    try {
      const result = await requestViralCaseAnalysis(selectedVideo, store.analysisModel);
      setStore(current => {
        const currentNotes = normalizeViralCaseNotes(current.notesByVideoId[selectedVideo.id]);
        return {
          ...current,
          selectedVideoId: selectedVideo.id,
          notesByVideoId: {
            ...current.notesByVideoId,
            [selectedVideo.id]: { ...currentNotes, analysis: result.analysis, updatedAt: new Date().toISOString() },
          },
        };
      });
      notify('自动分析已返回，请逐项对照原视频确认。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '自动视频分析暂不可用。';
      setAnalysisError(message);
      notify(message);
    } finally {
      progressTimers.forEach(timer => window.clearTimeout(timer));
      setAnalysisState('idle');
      setAnalysisStep(0);
    }
  };

  const useAnalysisAsNotes = () => {
    if (!selectedVideo || !notes.analysis) return;
    patchNotes(applyViralCaseAnalysisToNotes(notes));
    notify('自动报告已填入观察层，请对照原视频修正。');
  };

  const copyReport = async () => {
    if (!selectedVideo) return;
    try {
      await navigator.clipboard?.writeText(formatViralCaseReport(selectedVideo, notes));
      notify('拆解报告已复制为 Markdown');
    } catch {
      notify('当前浏览器不允许复制，请使用系统分享或手动选择文本。');
    }
  };

  const downloadReport = () => {
    if (!selectedVideo) return;
    const blob = new Blob([formatViralCaseReport(selectedVideo, notes)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `signalcraft-case-${selectedVideo.id}.md`;
    link.click();
    URL.revokeObjectURL(url);
    notify('拆解报告已下载');
  };

  const createH3Prompt = () => {
    if (!selectedVideo || !notes.reusableMechanism.trim()) {
      notify('先填写“真正可复用的机制”，再生成原创 H3 Prompt。');
      return;
    }
    const duration = Math.min(15, Math.max(4, Math.round(selectedVideo.durationSeconds || 8)));
    const result = compileH3Prompt({ mode: 'T2VA', brief: createH3BriefFromCase(selectedVideo, notes), duration, hasStartFrame: false, hasEndFrame: false });
    setH3Prompt(result.prompt);
    notify(result.validation.issues.length ? `H3 Prompt 已生成；${result.validation.issues.length} 项需要编辑确认。` : '原创 H3 Prompt 已生成。');
  };

  const copyH3Prompt = async () => {
    if (!h3Prompt) return;
    try {
      await navigator.clipboard?.writeText(h3Prompt);
      notify('H3 Prompt 已复制');
    } catch {
      notify('当前浏览器不允许复制，请手动选择 Prompt。');
    }
  };

  const openCanvasWithPrompt = () => {
    if (!selectedVideo || !h3Prompt) return;
    try {
      localStorage.setItem(handoffStorageKey, JSON.stringify(createViralCaseCanvasHandoff(selectedVideo, notes, h3Prompt)));
      onOpenCanvas();
      notify('原创 Prompt 已带入无限画布；请先确认模型、素材、时长和成本。');
    } catch {
      notify('当前账号无法准备画布草稿，请先复制 Prompt。');
    }
  };

  const importVideo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (importState === 'loading') return;
    setImportState('loading');
    try {
      const video = await resolveYouTubeVideo(importUrl);
      onImportVideo(video);
      setStore(current => ({ ...current, selectedVideoId: video.id }));
      setImportUrl('');
      notify('公开视频已解析并加入爆款拆解。');
    } catch (error) {
      notify(error instanceof Error ? error.message : '公开视频解析失败。');
    } finally {
      setImportState('idle');
    }
  };

  const applyPattern = (pattern: ViralPattern | null) => {
    if (!pattern) return;
    setActivePatternId(pattern.id);
    if (!selectedVideo) {
      notify('先导入或保存一个视频，再把参考模式带入拆解卡。');
      return;
    }
    patchNotes(applyViralPatternToNotes(notes, pattern));
    notify(`已把「${pattern.family}」填入空白观察项；人工内容保持不变。`);
  };

  const applyCorpusCard = (card: ViralCaseCorpusCard) => {
    if (!selectedVideo) {
      notify('先导入或保存一个视频，再把案例机制带入拆解卡。');
      return;
    }
    patchNotes(applyViralCaseCorpusCardToNotes(notes, card));
    notify(`已带入「${card.title}」的公开拆解信号；时间点和画面仍需人工核对。`);
  };

  const copyCorpusCard = async (card: ViralCaseCorpusCard) => {
    try {
      await navigator.clipboard?.writeText(createViralCaseCorpusBrief(card));
      notify('机制摘要已复制，可直接放进选题或创作提示词。');
    } catch {
      notify('当前浏览器不允许复制，请打开原拆解页手动选择。');
    }
  };

  const importPanel = <form className="viral-case-import" onSubmit={importVideo}>
    <div><span className="eyebrow">DIRECT PUBLIC SOURCE</span><b>粘贴 YouTube 链接，直接建立研究样本</b><small>只读取公开视频元数据、播放量、频道订阅数和原始链接；缺失字段不会用演示值补齐。</small></div>
    <div className="viral-case-import-controls"><input type="url" value={importUrl} onChange={event => setImportUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." aria-label="YouTube 视频链接" required /><button type="submit" className="primary" disabled={importState === 'loading'}>{importState === 'loading' ? '解析中…' : '解析并加入'}</button></div>
  </form>;

  const patternLibrary = <section className="viral-pattern-library" aria-label="爆款参考模式库">
    <div className="viral-pattern-library-heading">
      <div>
        <span className="eyebrow">REFERENCE PATTERN LIBRARY · 5 CASES</span>
        <h2>把案例压缩成可调用的创作机制。</h2>
        <p>参考案例只提供结构启发：先看它怎样抢停留、制造期待、抬高 stakes，再换成自己的角色、场景、道具和结尾。</p>
      </div>
      <div className="viral-pattern-count"><b>5</b><span>种观看机制</span></div>
    </div>
    <div className="viral-pattern-tabs" role="tablist" aria-label="选择参考模式">
      {viralPatternLibrary.map((pattern, index) => <button key={pattern.id} type="button" role="tab" aria-selected={activePattern?.id === pattern.id} className={activePattern?.id === pattern.id ? 'active' : ''} onClick={() => setActivePatternId(pattern.id)}>
        <span>{String(index + 1).padStart(2, '0')}</span><b>{pattern.title}</b><small>{pattern.family}</small>
      </button>)}
    </div>
    {activePattern && <article className="viral-pattern-detail">
      <div className="viral-pattern-detail-main">
        <div className="viral-pattern-meta"><span>{activePattern.family}</span>{activePattern.tags.map(tag => <i key={tag}>{tag}</i>)}</div>
        <h3>{activePattern.title}</h3>
        <p className="viral-pattern-formula">{activePattern.formula}</p>
        <div className="viral-pattern-columns">
          <div><span>核心机制</span><p>{activePattern.coreMechanism}</p></div>
          <div><span>观众期待</span><p>{activePattern.tension}</p></div>
          <div><span>结尾 payoff</span><p>{activePattern.payoff}</p></div>
        </div>
      </div>
      <aside className="viral-pattern-detail-side">
        <div><span>四拍结构</span>{activePattern.beats.map((beat, index) => <p key={beat}><b>{activePattern.beatTimestamps[index]}</b>{beat}</p>)}</div>
        <div className="viral-pattern-adaptation"><span>原创改写提示</span><p>{activePattern.adaptationPrompt}</p></div>
        <div className="viral-pattern-source"><span>参考来源</span><a href={activePattern.sourceUrl} target="_blank" rel="noreferrer">案例 {activePattern.sourceCaseId} · 查看原拆解 ↗</a><button type="button" onClick={() => applyPattern(activePattern)} disabled={!selectedVideo}>带入当前拆解卡</button></div>
      </aside>
    </article>}
  </section>;

  const corpusLibrary = <section className="viral-case-corpus" aria-label="全量公开案例索引">
    <div className="viral-case-corpus-heading">
      <div>
        <span className="eyebrow">PUBLIC CASE CORPUS · {viralCaseCorpus.length} CASES</span>
        <h2>把案例页的全部公开拆解信号收进一个研究索引。</h2>
        <p>这里保留案例标题、公开指标、公式和情绪线索，并为每条记录保留原拆解链接；它们是研究线索，不是对原视频画面、留存或收益的替代判断。</p>
      </div>
      <div className="viral-pattern-count"><b>{corpusMatches.length}</b><span>条匹配结果</span></div>
    </div>
    <div className="viral-case-corpus-controls">
      <label><span>搜索案例</span><input value={corpusQuery} onChange={event => { setCorpusQuery(event.target.value); setCorpusVisibleCount(24); }} placeholder="标题、公式、情绪或案例编号" aria-label="搜索全量案例" /></label>
      <label><span>机会分桶</span><select value={corpusBucket} onChange={event => { setCorpusBucket(event.target.value); setCorpusVisibleCount(24); }} aria-label="按机会分桶筛选"><option value="all">全部分桶</option>{corpusBucketOptions.map(bucket => <option key={bucket} value={bucket}>{bucket} · {bucket === 'S' ? '核心样本' : bucket === 'A' ? '优先研究' : bucket === 'B' ? '值得观察' : '先补证据'}</option>)}</select></label>
      <label><span>结果排序</span><select value={corpusSort} onChange={event => { setCorpusSort(event.target.value as typeof corpusSort); setCorpusVisibleCount(24); }} aria-label="选择案例排序"><option value="priority">研究优先级</option><option value="source">源站顺序</option><option value="title">标题顺序</option></select></label>
    </div>
    <div className="viral-case-corpus-quick-filters" aria-label="快速选择案例分桶"><span>快速分桶</span><button type="button" className={corpusBucket === 'all' ? 'active' : ''} onClick={() => { setCorpusBucket('all'); setCorpusVisibleCount(24); }}>全部 <b>{viralCaseCorpus.length}</b></button>{corpusBucketOptions.map(bucket => <button key={bucket} type="button" className={corpusBucket === bucket ? 'active' : ''} onClick={() => { setCorpusBucket(bucket); setCorpusVisibleCount(24); }}>{bucket} <b>{corpusBucketCounts[bucket] || 0}</b></button>)}</div>
    <div className="viral-case-corpus-list">
      {visibleCorpusCards.map(card => <article key={card.sourceCaseId} className="viral-case-corpus-card">
        <div className="viral-case-corpus-card-top"><span>{card.sourceCaseId} · {card.bucket} 桶</span><a href={card.sourceUrl} target="_blank" rel="noreferrer">原拆解 ↗</a></div>
        <h3>{card.title || '未命名案例'}</h3>
        <p className="viral-case-corpus-summary">{card.summary || '案例摘要待回到来源页核对。'}</p>
        <div className="viral-case-corpus-signals"><div><span>公开信号</span><b>{card.metrics || '未提供'}</b></div><div><span>结构公式</span><p>{card.formula || '未提供'}</p></div><div><span>情绪线</span><p>{card.emotion || '未提供'}</p></div></div>
        <div className="viral-case-corpus-actions"><button type="button" onClick={() => copyCorpusCard(card)}>复制机制摘要</button><button type="button" className="primary" onClick={() => applyCorpusCard(card)} disabled={!selectedVideo}>带入当前拆解卡</button></div>
      </article>)}
    </div>
    {corpusMatches.length === 0 && <p className="viral-case-corpus-empty">没有匹配结果。换一个关键词或切回全部分桶。</p>}
    {corpusVisibleCount < corpusMatches.length && <button type="button" className="viral-case-corpus-more" onClick={() => setCorpusVisibleCount(count => count + 24)}>继续查看（还剩 {corpusMatches.length - corpusVisibleCount} 条）</button>}
    <p className="viral-case-corpus-footnote">索引来源：<a href="https://lulujai.com/zh-CN/shorts/cases" target="_blank" rel="noreferrer">lulujai 案例页 ↗</a> · 只做机制研究与原创改写，不复制原脚本、原画面或原媒体文件。</p>
  </section>;

  if (!videos.length) {
    return <main className="app-page viral-case-page">
      {patternLibrary}
      {corpusLibrary}
      <section className="viral-case-empty">
        <span>✦</span>
        <p className="eyebrow">VIRAL CASE DESK</p>
        <h1>先带回一个真实样本，再开始拆解。</h1>
        <p>爆款拆解只处理你在发现、排行榜或趋势雷达中保存的公开视频。这样每条笔记都能回到原视频与公开信号，不会被演示数据污染。</p>
        {importPanel}
        <button className="primary" onClick={onDiscover}>去发现真实视频</button>
      </section>
    </main>;
  }

  return <main className="app-page viral-case-page">
    <section className="viral-case-intro">
      <div>
        <p className="eyebrow">VIRAL CASE DESK · PUBLIC BETA</p>
        <h1>把“看过”变成可验证、<em>可改写</em>的创作机制。</h1>
      <p>SignalCraft 将公开表现信号与创作者逐帧观察分开保存：数据告诉你什么值得研究，笔记告诉你下一条该怎么做。</p>
      </div>
      <aside>
        <b>证据 ≠ 结论</b>
        <span>播放、频道规模与发布时间来自公开数据；Hook、镜头与情绪曲线需要在原视频中核对后记录。</span>
      </aside>
    </section>
    {patternLibrary}
    {corpusLibrary}

    <section className="viral-case-selector" aria-label="选择研究样本">
      <div>
        <span>当前样本</span>
        <select value={selectedVideo?.id || ''} onChange={event => selectVideo(event.target.value)}>
          {videos.map(video => <option key={video.id} value={video.id}>{videoTitle(video, locale)}</option>)}
        </select>
      </div>
      <p>{videos.length} 个已保存样本 · 笔记仅存于当前账号</p>
      <button type="button" onClick={onOpenLibrary}>管理样本</button>
    </section>
    {importPanel}

    {selectedVideo && signal && <>
      <section className="viral-case-evidence">
        <div className="viral-case-source">
          {selectedVideo.thumbnail ? <Image src={selectedVideo.thumbnail} alt={`${videoTitle(selectedVideo, locale)} 缩略图`} width={320} height={180} unoptimized /> : <div className="viral-case-thumb-empty">无公开缩略图</div>}
          <div>
            <span className="eyebrow">PUBLIC SOURCE</span>
            <h2>{videoTitle(selectedVideo, locale)}</h2>
            <p>{selectedVideo.topic} · {selectedVideo.format === 'short' ? '短视频' : selectedVideo.format === 'long' ? '长视频' : '待复核'} · {formatDuration(selectedVideo.durationSeconds)}</p>
            <div className="viral-case-source-actions">
              <button type="button" className="primary" onClick={() => onOpenVideo(selectedVideo)}>查看证据</button>
              {selectedVideo.sourceUrl && <a href={selectedVideo.sourceUrl} target="_blank" rel="noreferrer">打开原视频 ↗</a>}
            </div>
          </div>
        </div>
        {embedId && <div className="viral-case-player">
          <div><span className="eyebrow">FRAME REVIEW</span><b>在原视频上核对时间点与动作变化</b><small>播放器来自 YouTube 原始公开视频；自动报告不能替代人工复核。</small></div>
          <iframe src={`https://www.youtube-nocookie.com/embed/${embedId}?rel=0`} title={`${videoTitle(selectedVideo, locale)} 原视频播放器`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>}
        <dl className="viral-case-metrics">
          <div><dt>公开播放</dt><dd>{compact.format(selectedVideo.snapshots.at(-1)?.views || 0)}</dd></div>
          <div><dt>播放 / 订阅</dt><dd>{signal.viewsPerSubscriber}×</dd></div>
          <div><dt>机会评分</dt><dd>{signal.opportunityScore}<small>/100</small></dd></div>
          <div><dt>公开快照</dt><dd>{selectedVideo.snapshots.length}<small> 个时间点</small></dd></div>
        </dl>
        <p className="viral-case-evidence-note">可验证：{signal.reasons.join('；')}。{selectedVideo.snapshots.length > 1 ? '当前已具备多次公开快照，可观察采集期间的变化；仍不等同于留存、CTR 或实际收益。' : '当前只有一次公开快照，只能看累计相对信号，不能判断真实增长趋势、留存、CTR 或收益。'}</p>
      </section>

      <section className={`viral-case-analysis-strip ${analysisState === 'running' ? 'is-running' : ''}`} aria-label="自动视频分析">
        <div className="viral-case-analysis-head">
          <div className="viral-case-analysis-title-row">
            <span className="eyebrow">AUTOMATED ANALYSIS ADAPTER</span>
            <span className={`viral-case-analysis-status status-${analysisStatus}`} aria-live="polite">
              <i aria-hidden="true" />
              {analysisStatus === 'running' ? '正在整理证据' : analysisStatus === 'success' ? '已完成 · 待复核' : analysisStatus === 'error' ? '需要处理' : '就绪 · 公开证据'}
            </span>
          </div>
          <h2>{notes.analysis ? '自动报告已返回，逐项对照原视频。' : '先把公开证据整理成一张可复核的分析卡。'}</h2>
          <p>{notes.analysis ? `来源：${notes.analysis.provider} · 置信度：${notes.analysis.confidence === 'high' ? '高' : notes.analysis.confidence === 'medium' ? '中' : '低'} · ${new Date(notes.analysis.generatedAt).toLocaleString('zh-CN')}` : '只读取标题、时长和缩略图；输出 Hook、观看规则、4 段节拍与视觉线索。时间点、字幕、音频仍由你在原视频中核对。'}</p>
        </div>
        <div className="viral-case-analysis-rail" aria-label="自动分析范围">
          <div><span>输入</span><b>标题 · 时长 · 缩略图</b></div>
          <div><span>输出</span><b>8 项结构化字段</b></div>
          <div><span>边界</span><b>低置信度 · 人工复核</b></div>
        </div>
        {analysisState === 'running' && <ol className="viral-case-analysis-progress" aria-label="分析进度" aria-live="polite">
          {analysisSteps.map((step, index) => <li key={step} className={index < analysisStep ? 'is-done' : index === analysisStep ? 'is-active' : ''} aria-current={index === analysisStep ? 'step' : undefined}><span aria-hidden="true">{index < analysisStep ? '✓' : String(index + 1).padStart(2, '0')}</span>{step}</li>)}
        </ol>}
        <div className="viral-case-analysis-controls">
          <label><span>分析模型</span><select aria-label="自动分析模型" value={store.analysisModel} onChange={event => { setAnalysisError(null); setStore(current => ({ ...current, analysisModel: event.target.value as ViralCaseAnalysisModelId })); }}>{VIRAL_CASE_ANALYSIS_MODELS.map(model => <option key={model.id} value={model.id}>{model.label} · {model.provider}</option>)}</select><small>服务端按所选模型调用对应 Key；失败不会自动切换或重试。</small></label>
          <div className="viral-case-analysis-action">
            <button type="button" className="primary" onClick={requestAnalysis} disabled={analysisState === 'running' || !selectedVideo.sourceUrl}>{analysisState === 'running' ? '分析中…' : notes.analysis ? '重新分析' : '请求自动分析'}</button>
            {notes.analysis && analysisState !== 'running' && <small>上次结果已写入当前账号</small>}
          </div>
        </div>
        {analysisError && <p className="viral-case-analysis-error" role="alert">分析失败：{analysisError}</p>}
      </section>

      {notes.analysis && <section className="viral-case-analysis-report" aria-label="自动分析报告">
        <div className="viral-case-section-heading"><div><span className="eyebrow">MODEL REPORT · REVIEW REQUIRED</span><h2>自动报告</h2></div><small>先核对原视频，再把可信内容写入观察层。</small></div>
        <div className="viral-case-report-grid">
          <div><b>Hook</b><p>{notes.analysis.hook || '服务未返回'}</p></div>
          <div><b>规则</b><p>{notes.analysis.rule || '服务未返回'}</p></div>
          <div><b>情绪曲线</b><p>{notes.analysis.emotionalCurve || '服务未返回'}</p></div>
          <div><b>视觉 / 声音</b><p>{[notes.analysis.visualLanguage, notes.analysis.propsAndSound].filter(Boolean).join(' · ') || '服务未返回'}</p></div>
        </div>
        <div className="viral-case-report-beats">{notes.analysis.beats.map((beat, index) => <div key={`${index}-${beat}`}><span>{notes.analysis?.beatTimestamps[index] || '--:--'} · {beatLabels[index]}</span><p>{beat || '服务未返回'}</p></div>)}</div>
        {notes.analysis.caveats.length > 0 && <p className="viral-case-analysis-caveats">复核提醒：{notes.analysis.caveats.join('；')}</p>}
        <div className="viral-case-report-actions"><button type="button" className="primary" onClick={useAnalysisAsNotes}>填入观察层</button><button type="button" onClick={copyReport}>复制 Markdown</button><button type="button" onClick={downloadReport}>下载报告</button></div>
      </section>}

      <div className="viral-case-workbench">
        <section className="viral-case-notes">
          <div className="viral-case-section-heading"><div><span className="eyebrow">OBSERVATION LAYER</span><h2>逐段拆解</h2></div><small>先看原视频，再填这张卡。</small></div>
          <NoteField label="0–3 秒 Hook" value={notes.hook} placeholder="第一个画面为什么让人停下来？写可见动作、物体或反差。" onChange={hook => patchNotes({ hook })} />
          <NoteField label="观众何时看懂规则" value={notes.rule} placeholder="例如：一句固定口头禅、一次明确对比、一个重复动作。" onChange={rule => patchNotes({ rule })} />
          <div className="viral-case-beats">
            {beatLabels.map((label, index) => <div className="viral-case-beat-field" key={label}>
              <label className="viral-case-timestamp"><span>证据时间</span><input value={notes.beatTimestamps[index]} placeholder="00:00" inputMode="numeric" onChange={event => {
                const beatTimestamps = [...notes.beatTimestamps] as ViralCaseNotes['beatTimestamps'];
                beatTimestamps[index] = event.target.value;
                patchNotes({ beatTimestamps });
              }} /></label>
              <NoteField label={label} value={notes.beats[index]} placeholder={index === 0 ? '第一眼看到什么？' : index === 3 ? '最强画面如何收口或循环？' : '这一段新增了什么信息或反差？'} rows={2} onChange={value => {
                const beats = [...notes.beats] as ViralCaseNotes['beats'];
                beats[index] = value;
                patchNotes({ beats });
              }} />
            </div>)}
          </div>
          <div className="viral-case-two-column">
            <NoteField label="情绪 / 期待曲线" value={notes.emotionalCurve} placeholder="好奇 → 看懂规则 → 加码 → 结尾满足" onChange={emotionalCurve => patchNotes({ emotionalCurve })} />
            <NoteField label="镜头、道具与声音" value={`${notes.visualLanguage}${notes.visualLanguage && notes.propsAndSound ? '\n' : ''}${notes.propsAndSound}`} placeholder="固定广角 / 快切 / 道具识别度 / 口头禅或音效" onChange={value => {
              const [visualLanguage = '', ...rest] = value.split('\n');
              patchNotes({ visualLanguage, propsAndSound: rest.join('\n') });
            }} />
          </div>
        </section>

        <aside className="viral-case-translation">
          <div className="viral-case-section-heading"><div><span className="eyebrow">ADAPTATION LAYER</span><h2>不要复制，改写机制。</h2></div></div>
          <NoteField label="真正可复用的机制" value={notes.reusableMechanism} placeholder="例如：一眼可懂的物体动作 → 人体模仿 → 每次更离谱" onChange={reusableMechanism => patchNotes({ reusableMechanism })} rows={4} />
          <NoteField label="你的改写角度" value={notes.adaptation} placeholder="替换角色、场景、道具或结局；保留观看机制，不复刻原有画面。" onChange={adaptation => patchNotes({ adaptation })} rows={4} />
          <div className="viral-case-action-stack">
            <button className="primary" type="button" onClick={saveNotes}>保存拆解</button>
            <button type="button" disabled={!canCreateIdea} title={canCreateIdea ? undefined : '先填写“真正可复用的机制”'} onClick={() => onCreateIdea(selectedVideo, createIdeaDraftFromCase(selectedVideo, notes))}>生成选题卡</button>
            <button type="button" disabled={!canCreateIdea} title={canCreateIdea ? undefined : '先填写“真正可复用的机制”'} onClick={createH3Prompt}>生成原创 H3 Prompt</button>
            <small>{savedAt ? `已自动保存于 ${savedAt} · 仅存当前账号` : '编辑后会自动保存到当前账号'}</small>
          </div>
          <div className="viral-case-boundary">
            <b>当前能力边界</b>
            <p>这里不会把公开标题、播放数据伪装成画面理解。自动提取关键帧、字幕与音频，必须在后续接入合规视频分析服务后才会开启。</p>
          </div>
        </aside>
      </div>
      {h3Prompt && <section className="viral-case-h3-output" aria-label="原创 H3 Prompt">
        <div className="viral-case-section-heading"><div><span className="eyebrow">H3 T2VA · ORIGINAL ADAPTATION</span><h2>原创生成草稿</h2></div><small>这是从研究机制生成的编辑底稿，不是原视频复刻指令。</small></div>
        <textarea value={h3Prompt} readOnly rows={12} aria-label="原创 H3 Prompt 文本" />
        <div className="viral-case-report-actions"><button type="button" className="primary" onClick={copyH3Prompt}>复制 H3 Prompt</button><button type="button" onClick={openCanvasWithPrompt}>带入无限画布</button><small>当前按 H3 的 4–15 秒约束编译；中文研究笔记仍建议在生成前编辑成英文。</small></div>
      </section>}
    </>}
  </main>;
}
