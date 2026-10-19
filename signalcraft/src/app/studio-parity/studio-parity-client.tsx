'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './studio-parity.module.css';

type CreationMode = 'agent' | 'image' | 'video' | 'drama' | 'interactive';
type Topic = 'all' | 'shorts' | 'commerce' | 'characters';

const MODES: { id: CreationMode; label: string; hint: string }[] = [
  { id: 'agent', label: 'Agent 创作', hint: '描述目标，先建立可编辑的创作方案' },
  { id: 'image', label: '图片生成', hint: '描述主体、场景、构图与画面风格' },
  { id: 'video', label: '视频生成', hint: '描述镜头、运动、时长和参考素材' },
  { id: 'drama', label: '短剧漫剧', hint: '描述故事、主角和分镜节奏' },
  { id: 'interactive', label: '互动影游', hint: '描述剧情分支与交互节点' },
];

const PRESETS: { id: string; title: string; detail: string; topic: Exclude<Topic, 'all'>; mode: CreationMode; prompt: string; tone: string }[] = [
  {
    id: 'short-hook', title: '短视频开场 Hook', detail: '竖屏 · 30 秒 · 6 镜头',
    topic: 'shorts', mode: 'agent', tone: 'amber',
    prompt: '制作一条 30 秒英文 YouTube Shorts：前 3 秒强 Hook，分为 6 个镜头，先规划脚本和分镜，再检查角色一致性；9:16。',
  },
  {
    id: 'product-video', title: '电商商品广告', detail: '商品图 · 运镜 · 视频成片',
    topic: 'commerce', mode: 'video', tone: 'mint',
    prompt: '基于商品主图生成一条 15 秒 9:16 产品广告：主体形状不变，柔和工作室打光，缓慢环绕运镜，最后定格品牌画面。',
  },
  {
    id: 'character', title: '角色一致性设计', detail: '人物定妆 · 参考图 · 多场景',
    topic: 'characters', mode: 'image', tone: 'violet',
    prompt: '为原创机器人角色设计三视图和四张跨场景参考图：颜色、材质和服饰保持一致，方便下一步多镜头视频生成。',
  },
  {
    id: 'storyboard', title: '短剧分镜策划', detail: '人物 Bible · 故事结构 · 分镜',
    topic: 'shorts', mode: 'drama', tone: 'blue',
    prompt: '设计一条温暖科幻风格的 60 秒短剧：固定一个机器人主角，输出剧情梗概、镜头清单、对白、音效和画面参考约束。',
  },
];

const TOPICS: { id: Topic; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'shorts', label: '短视频' },
  { id: 'commerce', label: '电商广告' },
  { id: 'characters', label: '角色与场景' },
];

export default function StudioParityClient() {
  const [mode, setMode] = useState<CreationMode>('agent');
  const [prompt, setPrompt] = useState('');
  const [topic, setTopic] = useState<Topic>('all');
  const [copyState, setCopyState] = useState('');

  const current = MODES.find(item => item.id === mode) || MODES[0];
  const visiblePresets = useMemo(
    () => PRESETS.filter(item => topic === 'all' || item.topic === topic),
    [topic],
  );

  const setCreationMode = (value: CreationMode) => {
    setMode(value);
    setCopyState('');
  };

  const usePreset = (id: string) => {
    const preset = PRESETS.find(item => item.id === id);
    if (!preset) return;
    setMode(preset.mode);
    setPrompt(preset.prompt);
    setCopyState('已填入上方创作需求。预览页不执行付费任务。');
    document.getElementById('studio-parity-composer')?.focus();
  };

  const copyPrompt = async () => {
    if (!prompt.trim()) {
      setCopyState('请先填写创作需求，或选择一个下方模板。');
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyState('当前浏览器不支持自动复制。请手动选中文本后复制。');
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt.trim());
      setCopyState('已复制。可点击「进入现有画布」手动粘贴；这里尚未执行 AI 生成。');
    } catch {
      setCopyState('浏览器拒绝剪贴板权限，请手动复制文本。');
    }
  };

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="AI Studio 预览导航">
        <Link className={styles.logo} href="/app">
          <span className={styles.logoMark}>S</span>
          <span><strong>SignalCraft</strong><small>AI CREATION STUDIO</small></span>
        </Link>
        <p className={styles.sideLabel}>创作空间</p>
        <div className={styles.sideActions}>
          {MODES.map(item => (
            <button
              className={mode === item.id ? styles.sideActive : styles.sideButton}
              key={item.id} type="button" onClick={() => setCreationMode(item.id)}
              aria-pressed={mode === item.id}
            >
              <span className={styles.navDot} aria-hidden="true" />{item.label}
            </button>
          ))}
        </div>
        <p className={styles.sideLabel}>已有能力</p>
        <nav className={styles.sideLinks} aria-label="SignalCraft 已有工具">
          <Link href="/app/canvas">无限画布 <span>↗</span></Link>
          <Link href="/app/image-to-video">图生视频 <span>↗</span></Link>
          <Link href="/app/ideas">选题项目 <span>↗</span></Link>
        </nav>
        <div className={styles.sidebarEnd}>
          <span className={styles.previewDot} />
          <span>隔离预览 · 不调用模型</span>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>创作工作室 <span>/</span> 对标实验台</div>
          <div className={styles.topActions}>
            <span className={styles.previewPill}>Phase 0 · 预览</span>
            <Link className={styles.backLink} href="/app/canvas">打开现有工作室 ↗</Link>
          </div>
        </header>

        <div className={styles.mainColumn}>
          <section className={styles.hero} aria-labelledby="rh-preview-title">
            <span className={styles.eyebrow}><span className={styles.sparkle}>✦</span> CREATIVE WORKSPACE</span>
            <h1 id="rh-preview-title">今天，想创作什么？</h1>
            <p className={styles.lead}>从一句想法开始，在同一空间里完成创意、素材、分镜与视频制作。</p>
            <div className={styles.modeBar} aria-label="选择创作方式">
              {MODES.map(item => (
                <button key={item.id} type="button" aria-pressed={mode === item.id}
                  className={mode === item.id ? styles.modeActive : styles.modeButton}
                  onClick={() => setCreationMode(item.id)}>{item.label}</button>
              ))}
            </div>
            <div className={styles.composer}>
              <div className={styles.composerTop}>
                <span className={styles.modeTag}>✧ {current.label}</span>
                <span className={styles.manualTag}>手动确认模式</span>
              </div>
              <label className={styles.srOnly} htmlFor="studio-parity-composer">创作需求</label>
              <textarea
                id="studio-parity-composer" className={styles.prompt} rows={5}
                placeholder={current.hint} value={prompt}
                onChange={event => { setPrompt(event.target.value); setCopyState(''); }}
                maxLength={4000}
              />
              <div className={styles.composerBottom}>
                <span className={styles.helper}>预览模式：仅保存于当前输入框，不会执行生成或产生费用</span>
                <button type="button" className={styles.primaryButton} onClick={() => { void copyPrompt(); }}>
                  复制创作需求 ↗
                </button>
              </div>
              {copyState && <p className={styles.inlineStatus} role="status">{copyState}</p>}
            </div>
            <div className={styles.heroSub}>
              <span>✦ AI Agent 规划</span>
              <span>▧ 无限画布</span>
              <span>◉ 多模型工作流</span>
              <span>◷ 历史记录</span>
            </div>
          </section>

          <section className={styles.projects} aria-labelledby="recent-title">
            <div className={styles.sectionHeading}>
              <div><span className={styles.smallEyebrow}>WORKSPACE</span><h2 id="recent-title">最近项目</h2></div>
              <Link href="/app/canvas" className={styles.textLink}>所有项目 →</Link>
            </div>
            <div className={styles.projectGrid}>
              <Link href="/app/canvas" className={styles.newProject}>
                <span className={styles.plus}>＋</span><strong>新建画布项目</strong>
                <small>在现有 SignalCraft 画布中继续创作</small>
              </Link>
              <div className={styles.projectNote}>
                <span className={styles.infoIcon} aria-hidden="true">i</span>
                <div><strong>尚未接入跨设备项目同步</strong><p>不会伪造最近项目。现有画布项目仍保存在原工作室中，后续将通过兼容迁移统一展示。</p></div>
              </div>
            </div>
          </section>

          <section className={styles.inspiration} aria-labelledby="inspiration-title">
            <div className={styles.sectionHeading}>
              <div><span className={styles.smallEyebrow}>EXPLORE</span><h2 id="inspiration-title">灵感与工作流</h2></div>
              <span className={styles.sectionHelp}>本地创作预设 · 不是社区作品</span>
            </div>
            <div className={styles.filterBar} aria-label="筛选创作预设">
              {TOPICS.map(item => (
                <button key={item.id} type="button" aria-pressed={topic === item.id}
                  className={topic === item.id ? styles.filterActive : styles.filterButton}
                  onClick={() => setTopic(item.id)}>{item.label}</button>
              ))}
            </div>
            <div className={styles.templateGrid}>
              {visiblePresets.map(item => (
                <article className={styles.templateCard} key={item.id}>
                  <div className={styles.templateArtwork} data-tone={item.tone} aria-hidden="true">
                    <span className={styles.templateSymbol}>{item.mode === 'image' ? '✦' : item.mode === 'drama' ? '▣' : '▶'}</span>
                    <span className={styles.templateAccent} />
                  </div>
                  <div className={styles.templateBody}>
                    <strong>{item.title}</strong><p>{item.detail}</p>
                    <button type="button" onClick={() => usePreset(item.id)}>使用这个预设 →</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.roadmap} aria-label="后续复刻计划">
            <div><strong>后续对标：Agent 执行、画布、快捷创作、AI Apps、ComfyUI</strong>
              <p>这些模块需逐项进行真实交互验收；目前尚未以预览页替代原有系统。</p>
            </div>
            <Link href="/app/canvas">进入现有画布 →</Link>
          </section>
        </div>
      </div>
    </main>
  );
}
