'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { accountStorageKey, accountStorageScope } from '@/src/lib/account-storage';
import { getSession } from '@/src/lib/auth';
import {
  createInfiniteNode, createInfiniteProject, normalizeInfiniteWorkspace,
  connectionIssue, connectInfiniteNodes,
  type InfiniteCanvasProject, type InfiniteNodeKind, type InfiniteInputPort,
} from '@/src/lib/infinite-canvas-graph';
import styles from './canvas.module.css';

const DRAFT_PREFIX = 'signalcraft-studio-parity-canvas-sandbox-v1';
const NODE_KINDS: { kind: InfiniteNodeKind; name: string; description: string }[] = [
  { kind: 'text', name: '文本', description: '脚本、提示词和创作方向' },
  { kind: 'storyboard', name: '分镜', description: '单镜头脚本或构图草图' },
  { kind: 'image', name: '图片', description: '结构节点，素材上传暂未接入' },
  { kind: 'video', name: '视频任务', description: '仅编辑参数，不会运行模型' },
  { kind: 'audio', name: '音频', description: '结构节点，音频上传暂未接入' },
  { kind: 'note', name: '便签', description: '留给团队的创作备注' },
];
const PORTS: { id: InfiniteInputPort; name: string }[] = [
  { id: 'prompt', name: '提示词' },
  { id: 'start', name: '首帧' },
  { id: 'end', name: '尾帧' },
  { id: 'reference', name: '参考素材' },
];
const NODE_WIDTH = 264;
const NODE_HEIGHT = 204;
const BOARD_WIDTH = 5000;
const BOARD_HEIGHT = 3500;
type History = { past: InfiniteCanvasProject[]; future: InfiniteCanvasProject[] };
type DragState = { nodeId: string; startX: number; startY: number; originX: number; originY: number; before: InfiniteCanvasProject; moved: boolean };
type PanState = { startX: number; startY: number; x: number; y: number };
type Camera = { x: number; y: number; scale: number };
const defaultCamera: Camera = { x: 94, y: 88, scale: 1 };
const newId = () => crypto.randomUUID();
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const describe = (kind: InfiniteNodeKind) => NODE_KINDS.find(item => item.kind === kind)?.name || kind;

export default function CanvasClient() {
  const [project, setProject] = useState<InfiniteCanvasProject>(() => createInfiniteProject('sandbox'));
  const projectRef = useRef(project);
  const [camera, setCamera] = useState<Camera>(defaultCamera);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [message, setMessage] = useState('这是隔离画布：支持本地编辑，但不会发送任何模型或付费请求。');
  const [history, setHistory] = useState<History>({ past: [], future: [] });
  const historyRef = useRef(history);
  const [scope, setScope] = useState('');
  const drag = useRef<DragState | null>(null);
  const pan = useRef<PanState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const writeHistory = useCallback((next: History) => {
    historyRef.current = next;
    setHistory(next);
  }, []);
  const apply = useCallback((next: InfiniteCanvasProject, record = true) => {
    const before = projectRef.current;
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    projectRef.current = next;
    setProject(next);
    if (record) writeHistory({ past: [...historyRef.current.past, before].slice(-50), future: [] });
  }, [writeHistory]);

  const undo = useCallback(() => {
    const current = historyRef.current;
    const before = current.past.at(-1);
    if (!before) return;
    const after = projectRef.current;
    projectRef.current = before;
    setProject(before);
    writeHistory({ past: current.past.slice(0, -1), future: [after, ...current.future].slice(0, 50) });
  }, [writeHistory]);

  const redo = useCallback(() => {
    const current = historyRef.current;
    const next = current.future[0];
    if (!next) return;
    const before = projectRef.current;
    projectRef.current = next;
    setProject(next);
    writeHistory({ past: [...current.past, before].slice(-50), future: current.future.slice(1) });
  }, [writeHistory]);

  useEffect(() => {
    const session = getSession();
    const key = accountStorageKey(DRAFT_PREFIX, session);
    const authenticated = accountStorageScope(session) !== 'anonymous';
    const storage = authenticated ? localStorage : sessionStorage;
    setScope(authenticated ? key : '仅当前浏览器标签（未登录）');
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && Array.isArray(parsed.projects)) {
          const restored = normalizeInfiniteWorkspace(parsed);
          const next = restored.projects.find(item => item.id === restored.activeProjectId) || restored.projects[0];
          projectRef.current = next;
          setProject(next);
          setCamera(next.view);
        }
      }
    } catch {
      setMessage('历史草稿无法读取，已保留空白画布。不会覆盖原有工作室内容。');
    }
    // One-shot handoff from the explicit "添加到实验画布" action.
    // Always append to the isolated project; never overwrite old drafts.
    try {
      const pending = sessionStorage.getItem('signalcraft-studio-parity-intent-v1');
      if (pending) {
        const intent = JSON.parse(pending) as { prompt?: unknown; mode?: unknown };
        sessionStorage.removeItem('signalcraft-studio-parity-intent-v1');
        if (typeof intent.prompt === 'string' && intent.prompt.trim()) {
          const text = createInfiniteNode(newId(), 'text',
            130 + (projectRef.current.nodes.length % 4) * 320,
            120 + Math.floor(projectRef.current.nodes.length / 4) * 260);
          text.title = '创作需求 · 待规划';
          text.text = intent.prompt.slice(0, 4000);
          const next = { ...projectRef.current, nodes: [...projectRef.current.nodes, text] };
          projectRef.current = next;
          setProject(next);
          setSelected(text.id);
          setMessage('已从创作入口导入需求。尚未调用 Agent；请继续建立分镜和视频节点。');
        }
      }
    } catch {
      setMessage('临时创作需求读取失败，已保留现有项目。');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const identity = getSession();
    const key = accountStorageKey(DRAFT_PREFIX, identity);
    const authenticated = accountStorageScope(identity) !== 'anonymous';
    try {
      if (scope !== (authenticated ? key : '仅当前浏览器标签（未登录）')) {
        setMessage('检测到账号变化，已停止保存。刷新后按当前账号重新打开。');
        return;
      }
      const next = { ...project, view: camera, updatedAt: new Date().toISOString() };
      const payload = { version: 1, activeProjectId: next.id, projects: [next] };
      (authenticated ? localStorage : sessionStorage).setItem(key, JSON.stringify(payload));
    } catch {
      setMessage('浏览器草稿保存失败。请使用导出 JSON 备份当前项目。');
    }
  }, [project, camera, ready, scope]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const handler = (event: WheelEvent) => {
      if (event.ctrlKey) return; // preserve browser accessibility zoom
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const pointX = event.clientX - rect.left;
      const pointY = event.clientY - rect.top;
      setCamera(before => {
        const scale = clamp(before.scale * (event.deltaY > 0 ? 0.9 : 1.1), .35, 2.2);
        const wx = (pointX - before.x) / before.scale;
        const wy = (pointY - before.y) / before.scale;
        return { x: pointX - wx * scale, y: pointY - wy * scale, scale };
      });
    };
    element.addEventListener('wheel', handler, { passive: false });
    return () => element.removeEventListener('wheel', handler);
  }, [ready]);

  const patchNode = (nodeId: string, changes: Record<string, unknown>) => {
    const current = projectRef.current;
    const next = { ...current, nodes: current.nodes.map(node => node.id === nodeId ? { ...node, ...changes } : node) };
    apply(next);
  };

  const addNode = (kind: InfiniteNodeKind) => {
    if (projectRef.current.nodes.length >= 400) { setMessage('单项目最多保存 400 个节点，请新建项目或导出整理。'); return; }
    const n = createInfiniteNode(newId(), kind, 110 + (projectRef.current.nodes.length % 4) * 320, 125 + Math.floor(projectRef.current.nodes.length / 4) * 260);
    const next = { ...projectRef.current, nodes: [...projectRef.current.nodes, n] };
    apply(next);
    setSelected(n.id);
    setSource(null);
    setMessage(`已添加${describe(kind)}节点。视频仅提供本地规划，不会触发模型。`);
  };
  const addExample = () => {
    const current = projectRef.current;
    if (current.nodes.length > 397) { setMessage('节点数已接近保存上限，不能再追加三节点示例。'); return; }
    if (current.nodes.length > 0 && !window.confirm('示例将在当前画布添加三个节点，不会删除已有节点。继续？')) return;
    const text = createInfiniteNode(newId(), 'text', 130, 180);
    text.title = '创作需求';
    text.text = '制作一条 30 秒 9:16 英文科幻 Shorts：主角 Nilo 在维修店修好一只旧铃铛，6 个镜头，保持角色一致。';
    const board = createInfiniteNode(newId(), 'storyboard', 130, 450);
    board.title = '分镜草案';
    board.text = 'Shot 1: Nilo finds the bell. Shot 2: He repairs it. Shot 3: The bell rings. Keep the same robot design.';
    const video = createInfiniteNode(newId(), 'video', 515, 250);
    video.video = { ...video.video!, mode: 'text', modeSelection: 'manual', prompt: 'Cinematic warm repair shop, gentle dolly-in, detailed 3D animation, vertical 9:16.' };
    let next = { ...current, nodes: [...current.nodes, text, board, video] };
    next = connectInfiniteNodes(next, newId(), text.id, video.id, 'prompt');
    apply(next);
    setSelected(video.id);
    setMessage('已创建三节点示例及提示词连线。尚未生成任何素材。');
  };

  const removeNode = (id: string) => {
    const next = { ...projectRef.current, nodes: projectRef.current.nodes.filter(node => node.id !== id), edges: projectRef.current.edges.filter(edge => edge.source !== id && edge.target !== id) };
    apply(next);
    if (selected === id) setSelected(null);
    if (source === id) setSource(null);
    setMessage('节点及相关连线已移除，可使用撤销恢复。');
  };

  const connect = (targetId: string, port: InfiniteInputPort) => {
    if (projectRef.current.edges.length >= 800) { setMessage('单项目连线已达保存上限 800 条。'); return; }
    if (!source) { setMessage('先选择一个节点的「设为连线起点」。'); return; }
    const reason = connectionIssue(projectRef.current, source, targetId, port);
    if (reason) { setMessage(`无法连接：${reason}`); return; }
    try {
      apply(connectInfiniteNodes(projectRef.current, newId(), source, targetId, port));
      setSource(null);
      setMessage('连线已建立。该连线仅表示输入依赖，不会自动执行模型。');
    } catch { setMessage('连线失败，现有项目未发生变化。'); }
  };

  const unlink = (id: string) => {
    apply({ ...projectRef.current, edges: projectRef.current.edges.filter(edge => edge.id !== id) });
    setMessage('已断开连线，可撤销恢复。');
  };

  const beginDrag = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const node = projectRef.current.nodes.find(item => item.id === id);
    if (!node) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { nodeId: id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y, before: projectRef.current, moved: false };
    setSelected(id);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.startX) / camera.scale;
    const dy = (event.clientY - state.startY) / camera.scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true;
    const next = {
      ...projectRef.current,
      nodes: projectRef.current.nodes.map(node => node.id === state.nodeId
        ? { ...node, x: clamp(Math.round(state.originX + dx), -2000, 4000), y: clamp(Math.round(state.originY + dy), -2000, 3000) }
        : node),
    };
    projectRef.current = next;
    setProject(next);
  };
  const endDrag = () => {
    const state = drag.current;
    if (state?.moved) writeHistory({ past: [...historyRef.current.past, state.before].slice(-50), future: [] });
    drag.current = null;
  };
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-canvas-node],button,input,textarea,select,a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pan.current = { startX: event.clientX, startY: event.clientY, x: camera.x, y: camera.y };
    setSelected(null);
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pan.current) return;
    const p = pan.current;
    setCamera(prev => ({ ...prev, x: p.x + event.clientX - p.startX, y: p.y + event.clientY - p.startY }));
  };

  const exportProject = () => {
    const current = { ...projectRef.current, view: camera, updatedAt: new Date().toISOString() };
    const payload = { version: 1, activeProjectId: current.id, projects: [current] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'signalcraft-parity-canvas.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    setMessage('JSON 项目已导出。仅包含结构和已有资产 ID，不导出私有生成素材。');
  };
  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) { setMessage('JSON 不能超过 1 MB。'); return; }
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== 1 || !Array.isArray((data as { projects?: unknown }).projects)
        || !(data as { projects: unknown[] }).projects.some(p => p && typeof p === 'object'
          && typeof (p as { id?: unknown }).id === 'string' && Array.isArray((p as { nodes?: unknown }).nodes)
          && Array.isArray((p as { edges?: unknown }).edges))) {
        throw new Error('版本不兼容');
      }
      const workspace = normalizeInfiniteWorkspace(data);
      if (!workspace.projects.length) throw new Error('没有可恢复的项目');
      const imported = workspace.projects.find(p => p.id === workspace.activeProjectId) || workspace.projects[0];
      if (!window.confirm('导入会替换当前隔离画布。请先导出需要保留的项目。确认导入？')) return;
      apply(imported);
      setCamera(imported.view);
      setSelected(null);
      setSource(null);
      setMessage('项目已按 SignalCraft v1 数据契约校验并导入。没有上传文件或调用服务端。');
    } catch { setMessage('导入失败：JSON 无效或不是可识别的 SignalCraft v1 项目。'); }
  };

  const activeNode = project.nodes.find(item => item.id === selected) || null;
  const resetView = () => setCamera(defaultCamera);

  return <main className={styles.shell}>
    <header className={styles.bar}>
      <div className={styles.brand}><Link href="/studio-parity">← 工作室入口</Link><strong>SignalCraft <span>／ 无限画布实验台</span></strong></div>
      <div className={styles.barActions}>
        <span className={styles.safePill}>LOCAL · NO GENERATION</span>
        <button type="button" disabled={!history.past.length} onClick={undo}>↶ 撤销</button>
        <button type="button" disabled={!history.future.length} onClick={redo}>↷ 重做</button>
        <button type="button" onClick={exportProject}>导出 JSON</button>
        <label className={styles.importButton}>导入 JSON <input type="file" accept=".json,application/json" onChange={event => { void importProject(event); }} /></label>
      </div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.tools} aria-label="节点工具箱">
        <h2>创作工具</h2>
        <p>点击添加到画布。当前不连接付费模型。</p>
        {NODE_KINDS.map(item => <button key={item.kind} type="button" className={styles.tool}
          onClick={() => addNode(item.kind)}><b>＋ {item.name}</b><small>{item.description}</small></button>)}
        <button className={styles.exampleButton} type="button" onClick={addExample}>✦ 创建 Nilo 示例流程</button>
        <div className={styles.toolDivider} />
        <h3>项目状态</h3>
        <p>{project.nodes.length} 个节点 · {project.edges.length} 条连线</p>
        <p className={styles.storageInfo}>浏览器独立草稿；{scope ? (scope.startsWith('signalcraft-') ? '当前账号隔离' : scope) : '读取中'}</p>
        <Link href="/app/canvas" className={styles.legacyLink}>打开现有生产工作室 ↗</Link>
      </aside>
      <section className={styles.center} aria-label="节点创作画布">
        <div className={styles.canvasTop}>
          <div><b>项目：{project.title}</b><span>可拖动节点标题 · 背景拖动平移 · 滚轮缩放</span></div>
          <div className={styles.zoom}>
            <button type="button" onClick={() => setCamera(v => ({ ...v, scale: clamp(v.scale - .1, .35, 2.2) }))}>−</button>
            <output>{Math.round(camera.scale * 100)}%</output>
            <button type="button" onClick={() => setCamera(v => ({ ...v, scale: clamp(v.scale + .1, .35, 2.2) }))}>＋</button>
            <button type="button" onClick={resetView}>复位</button>
          </div>
        </div>
        <div className={styles.viewport} ref={canvasRef}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={() => { pan.current = null; }}
          onPointerCancel={() => { pan.current = null; }}>
          <div className={styles.world} style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
            <svg className={styles.edges} width={BOARD_WIDTH} height={BOARD_HEIGHT} aria-hidden="true">
              {project.edges.map(edge => {
                const from = project.nodes.find(node => node.id === edge.source);
                const to = project.nodes.find(node => node.id === edge.target);
                if (!from || !to) return null;
                const x1 = from.x + NODE_WIDTH, y1 = from.y + NODE_HEIGHT / 2;
                const x2 = to.x, y2 = to.y + NODE_HEIGHT / 2;
                const curve = Math.max(80, Math.abs(x2 - x1) * .45);
                return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`}
                  fill="none" stroke="#988ce7" strokeWidth="3" strokeLinecap="round" />;
              })}
            </svg>
            {project.nodes.map(node => <article key={node.id} className={selected === node.id ? styles.nodeSelected : styles.node}
              data-canvas-node data-kind={node.kind} style={{ left: node.x, top: node.y }}>
              <div className={styles.nodeHead} onPointerDown={e => beginDrag(node.id, e)}
                onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                role="button" tabIndex={0} aria-label={`选择并拖动 ${node.title}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(node.id); } }}>
                <span className={styles.nodeBadge}>{describe(node.kind)}</span><strong>{node.title}</strong><span className={styles.handle}>⠿</span>
              </div>
              <div className={styles.nodeBody}>
                <p>{node.kind === 'video' ? (node.video?.prompt || '未填写运动指令') : (node.text || '暂无内容，选中后在右侧编辑。')}</p>
                <div className={styles.nodeTags}>
                  <span>{node.kind === 'video' ? '模型未执行' : '本地节点'}</span>
                  {node.kind === 'image' || node.kind === 'audio' ? <span>未接入素材</span> : null}
                </div>
              </div>
              <div className={styles.nodeFooter}>
                <button type="button" onClick={() => { setSource(node.id); setSelected(node.id); setMessage('已选择连线起点。请点击目标视频节点右侧的输入端口。'); }}
                  aria-pressed={source === node.id}>{source === node.id ? '✓ 已选输出' : '◎ 设为连线起点'}</button>
                <button type="button" onClick={() => setSelected(node.id)}>参数 ›</button>
              </div>
            </article>)}
          </div>
          {project.nodes.length === 0 && <div className={styles.empty}><div>✦</div><h2>从一个节点开始创作</h2><p>在左侧添加文本、分镜或视频节点，也可以载入 Nilo 示例。</p><button onClick={addExample} type="button">创建示例流程</button></div>}
        </div>
        <footer className={styles.canvasFooter} role="status">
          <span>{message}</span><span>{ready ? '已启用本地草稿保存' : '正在读取草稿'}</span>
        </footer>
      </section>
      <aside className={styles.inspector} aria-label="节点属性面板">
        <h2>节点检查器</h2>
        {!activeNode ? <div className={styles.placeholder}><span>◎</span><strong>选择画布节点</strong><p>点击任意节点的「参数」，即可修改名称、内容和连线。</p></div> : <>
          <p className={styles.subheading}>{describe(activeNode.kind)} · {activeNode.id.slice(0, 8)}</p>
          <label>节点名称<input key={activeNode.id + '-title'} defaultValue={activeNode.title}
            maxLength={70} onBlur={e => { if (e.target.value.trim() && e.target.value !== activeNode.title) patchNode(activeNode.id, { title: e.target.value.trim() }); }}/></label>
          <label>{activeNode.kind === 'video' ? '运动提示词' : '节点内容'}
            <textarea key={activeNode.id + '-body'} rows={6} defaultValue={activeNode.kind === 'video' ? activeNode.video?.prompt || '' : activeNode.text}
              maxLength={12000} onBlur={e => {
                if (activeNode.kind === 'video' && activeNode.video && e.target.value !== activeNode.video.prompt)
                  patchNode(activeNode.id, { video: { ...activeNode.video, prompt: e.target.value.slice(0, 1200) } });
                if (activeNode.kind !== 'video' && e.target.value !== activeNode.text) patchNode(activeNode.id, { text: e.target.value });
              }} /></label>
          {activeNode.kind === 'video' && activeNode.video && <>
            <label>参考模式<select value={activeNode.video.mode} onChange={e => patchNode(activeNode.id, { video: { ...activeNode.video!, mode: e.target.value as 'text' | 'start-end' | 'omni', modeSelection: 'manual' } })}>
              <option value="text">文生视频</option><option value="start-end">首尾帧</option><option value="omni">全能参考</option>
            </select></label>
            <p className={styles.note}>本实验台只编辑工作流数据。真实视频生成请进入原工作室并单独审批。</p>
            <div className={styles.portBox}><strong>连线输入端口</strong>
              {PORTS.map(port => <button key={port.id} type="button" disabled={!source}
                onClick={() => connect(activeNode.id, port.id)}>{port.name} <span>{source ? '连接 →' : '先选输出'}</span></button>)}
            </div>
          </>}
          <div className={styles.portBox}><strong>连接记录</strong>
            {project.edges.filter(edge => edge.source === activeNode.id || edge.target === activeNode.id).length === 0
              ? <p className={styles.note}>此节点尚无连线。</p>
              : project.edges.filter(edge => edge.source === activeNode.id || edge.target === activeNode.id).map(edge =>
                <div key={edge.id} className={styles.edgeRow}><span>{edge.source.slice(0, 6)} → {edge.target.slice(0, 6)} · {edge.port}</span>
                  <button type="button" onClick={() => unlink(edge.id)} aria-label="断开此连线">断开</button></div>)}
          </div>
          <button className={styles.danger} type="button" onClick={() => removeNode(activeNode.id)}>删除节点（可撤销）</button>
        </>}
        <div className={styles.disclaimer}><b>执行安全</b><p>不发送模型请求、不扣积分、不操作生产数据。这只是第一个可运行的节点编辑切片。</p></div>
      </aside>
    </div>
  </main>;
}
