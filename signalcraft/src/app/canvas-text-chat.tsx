'use client';

import { useEffect, useRef, useState } from 'react';
import type { AccountSession } from '@/src/lib/auth';
import { getSession } from '@/src/lib/auth';
import { accountStorageScope } from '@/src/lib/account-storage';
import { CANVAS_CHAT_LIMITS, canvasChatError, nextCanvasChatMessages, readyClaudeModels, type CanvasChatMessage } from '@/src/lib/canvas-chat';
import { CanvasTextClientError, loadCanvasTextModels, sendCanvasChat, type CanvasTextModel, type CanvasTextModelId } from '@/src/lib/canvas-text-generation';
import type { UiLocale } from '@/src/lib/ui-language';
import styles from './canvas-text-chat.module.css';

type Props = { account: AccountSession | null; locale: UiLocale; onSignIn: () => void };

export default function CanvasTextChat({ account, locale, onSignIn }: Props) {
  const zh = locale === 'zh';
  const copy = (cn: string, en: string) => zh ? cn : en;
  const scope = accountStorageScope(account);
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<CanvasTextModel[]>([]);
  const [selected, setSelected] = useState<CanvasTextModelId | ''>('');
  const [checking, setChecking] = useState(false);
  const [messages, setMessages] = useState<CanvasChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const tail = useRef<HTMLDivElement>(null);
  const available = readyClaudeModels(models);
  const enabled = available.some(model => model.id === selected);
  const full = messages.length >= CANVAS_CHAT_LIMITS.messages;
  const currentAccount = () => Boolean(account && getSession() && accountStorageScope(getSession()) === scope);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (open) tail.current?.scrollIntoView({ block: 'nearest' }); }, [open, messages, pending, errorCode]);

  const checkModels = async () => {
    if (busy.current) return;
    if (!currentAccount()) { setErrorCode('AUTH_REQUIRED'); return; }
    busy.current = true; setChecking(true); setErrorCode('');
    try {
      const result = await loadCanvasTextModels();
      if (!mounted.current || !currentAccount()) return;
      const claude = result.filter(model => model.provider === 'claude');
      setModels(claude);
      setSelected(previous => claude.some(model => model.id === previous) ? previous : readyClaudeModels(claude)[0]?.id || claude[0]?.id || '');
    } catch (cause) {
      if (mounted.current && currentAccount()) setErrorCode(cause instanceof CanvasTextClientError ? cause.code || 'NETWORK' : 'NETWORK');
    } finally { busy.current = false; if (mounted.current) setChecking(false); }
  };
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const send = async () => {
    if (busy.current || !enabled || !selected || !consent) return;
    if (!currentAccount()) { setErrorCode('AUTH_REQUIRED'); return; }
    let turns: CanvasChatMessage[];
    try { turns = nextCanvasChatMessages(messages, question); }
    catch (cause) { setErrorCode(cause instanceof Error ? cause.message : 'CHAT_INPUT'); return; }
    busy.current = true; setPending(question.trim()); setErrorCode(''); setCopied(null);
    const abort = new AbortController(); controller.current = abort;
    // The gateway allows 45s for chat plus discovery, inside its 60s function.
    const timer = setTimeout(() => abort.abort(), 65000);
    try {
      const result = await sendCanvasChat(selected, turns, abort.signal);
      if (!mounted.current || !currentAccount()) return;
      setMessages([...turns, { role: 'assistant', content: result.text }]); setQuestion('');
    } catch (cause) {
      if (mounted.current && currentAccount()) setErrorCode(abort.signal.aborted ? 'TIMEOUT' : cause instanceof CanvasTextClientError ? cause.code || 'RESPONSE_INVALID' : 'NETWORK');
    } finally {
      clearTimeout(timer); busy.current = false; controller.current = null;
      if (mounted.current) setPending('');
    }
  };
  const clear = () => {
    if (busy.current) return;
    if (messages.length && !window.confirm(copy('清空本窗口的对话？不会修改画布项目。', 'Clear this conversation? The canvas project will not change.'))) return;
    setMessages([]); setQuestion(''); setErrorCode(''); setCopied(null);
  };
  const copyAnswer = async (text: string, index: number) => {
    try { await navigator.clipboard.writeText(text); if (mounted.current) setCopied(index); }
    catch { if (mounted.current) setCopied(-1); }
  };

  return <>
    <button ref={launcher} className={styles.launcher} type="button" aria-expanded={open} aria-controls="canvas-claude-chat" onClick={() => {
      if (open) close(); else { setOpen(true); if (!models.length) void checkModels(); }
    }}>{copy('Claude 文本助手', 'Claude text assistant')}</button>
    {open && <aside id="canvas-claude-chat" className={styles.panel} role="dialog" aria-modal="false" aria-labelledby="canvas-claude-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }} onPointerDown={event => event.stopPropagation()}>
      <header className={styles.header}><div><small>{copy('创作对话 · 不操作画布', 'Creator chat · Canvas unchanged')}</small><h2 id="canvas-claude-title">{copy('问 Claude', 'Ask Claude')}</h2></div><button type="button" onClick={close} aria-label={copy('关闭文本助手', 'Close text assistant')}>×</button></header>
      <div className={styles.models}>
        <label htmlFor="canvas-claude-model">{copy('模型', 'Model')}</label>
        <select id="canvas-claude-model" value={selected} disabled={checking || Boolean(pending) || messages.length > 0} onChange={event => setSelected(event.target.value as CanvasTextModelId)}>
          {!models.length && <option value="">{checking ? copy('正在检查…', 'Checking…') : copy('尚未读取型号', 'No models loaded')}</option>}
          {models.map(model => <option key={model.id} value={model.id} disabled={!model.enabled}>{model.label} · {model.enabled ? copy('已就绪', 'Ready') : copy('未就绪', 'Unavailable')}</option>)}
        </select>
        <button type="button" disabled={checking || Boolean(pending)} onClick={() => void checkModels()}>{checking ? copy('检查中', 'Checking') : copy('检查', 'Check')}</button>
        {account && !checking && models.length > 0 && !available.length && <p>{copy('当前没有已就绪的 Claude 型号。请检查服务端配置与服务方模型清单。', 'No Claude model is ready. Check the server configuration and provider model catalog.')}</p>}
      </div>
      <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions text" aria-label={copy('对话消息', 'Conversation')}>
        {!messages.length && !pending && <div className={styles.empty}><b>{copy('把问题写下来。', 'Start with a question.')}</b><p>{copy('可以讨论选题、改写文案或整理镜头思路；回答后可继续追问。', 'Discuss ideas, rewrite copy, or plan shots, then ask follow-up questions.')}</p><small>{copy('仅发送你输入的文本；不会读取画布素材。对话只保留在当前页面，刷新后清空。', 'Only your text is sent, not canvas media. This chat stays in the current page and clears on refresh.')}</small></div>}
        {messages.map((message, index) => <article key={index} className={message.role === 'user' ? styles.user : styles.answer}><b>{message.role === 'user' ? copy('你', 'You') : 'Claude'}</b><div>{message.content}</div>{message.role === 'assistant' && <button type="button" onClick={() => void copyAnswer(message.content, index)}>{copied === index ? copy('已复制', 'Copied') : copy('复制回答', 'Copy answer')}</button>}</article>)}
        {pending && <><article className={styles.user}><b>{copy('你', 'You')}</b><div>{pending}</div></article><p role="status">{copy('Claude 正在回答…', 'Claude is answering…')}</p></>}
        {errorCode && <p className={styles.error} role="alert">{canvasChatError(errorCode, zh)}</p>}
        {full && <p>{canvasChatError('CHAT_LIMIT', zh)}</p>}
        {copied === -1 && <p role="status">{copy('复制失败，可选中回答手动复制。', 'Copy failed. Select the answer to copy it manually.')}</p>}
        <div ref={tail} />
      </div>
      {!account ? <div className={styles.signin}><p>{copy('请先登录。文本助手沿用现有 Team 权限。', 'Sign in first. The text assistant uses the existing Team permissions.')}</p><button type="button" onClick={onSignIn}>{copy('登录', 'Sign in')}</button></div> : <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
        <label htmlFor="canvas-claude-question">{copy('问题或追问', 'Question or follow-up')}</label>
        <textarea ref={input} id="canvas-claude-question" rows={3} maxLength={CANVAS_CHAT_LIMITS.messageCharacters} value={question} disabled={Boolean(pending)} placeholder={copy('输入你想问 Claude 的问题…', 'What would you like to ask Claude?')} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
        <label className={styles.consent}><input type="checkbox" checked={consent} disabled={Boolean(pending)} onChange={event => setConsent(event.target.checked)} />{copy('同意本次对话使用文本 API，可能产生服务方费用。', 'Allow text API calls for this conversation; provider charges may apply.')}</label>
        <div className={styles.actions}><button type="button" disabled={checking || Boolean(pending)} onClick={clear}>{copy('清空对话', 'Clear chat')}</button><span>{copy('Enter 发送 · Shift+Enter 换行', 'Enter to send · Shift+Enter for a new line')}</span><button className={styles.send} type="submit" disabled={!question.trim() || !consent || !enabled || checking || Boolean(pending) || full}>{pending ? copy('回答中…', 'Answering…') : copy('发送', 'Send')}</button></div>
      </form>}
    </aside>}
  </>;
}
