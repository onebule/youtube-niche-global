'use client';

import { useEffect, useState } from 'react';
import type { AccountSession } from '@/src/lib/auth';
import { loadOwnerOverview, type OwnerOverview } from '@/src/lib/owner-admin';

const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '尚未完成';

function ServiceState({ label, ready }: { label: string; ready: boolean }) {
  return <div className="owner-service"><span className={ready ? 'ready' : 'missing'}>{ready ? '●' : '○'}</span><b>{label}</b><small>{ready ? '已连接' : '未配置'}</small></div>;
}

export default function OwnerConsole({ account, onSignIn }: { account: AccountSession | null; onSignIn: () => void }) {
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(account));

  const refresh = async () => {
    if (!account) return;
    setLoading(true);
    setError('');
    try { setOverview(await loadOwnerOverview()); }
    catch (reason) { setOverview(null); setError(reason instanceof Error ? reason.message : '无法读取站点管理概览。'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [account?.accessToken]);

  if (!account) return <main className="page owner-console"><section className="owner-gate"><span className="eyebrow">OWNER ACCESS</span><h1>先登录，再验证站点主人权限。</h1><p>管理台不会根据浏览器里的邮箱显示权限；它会在服务器验证你的 Google / Supabase 会话和主人白名单。</p><button className="primary" onClick={onSignIn}>使用 Google 登录</button></section></main>;

  if (loading) return <main className="page owner-console"><section className="owner-gate"><span className="eyebrow">OWNER ACCESS</span><h1>正在验证管理权限…</h1><p>正在通过服务器检查当前登录账号。</p></section></main>;

  if (error || !overview) return <main className="page owner-console"><section className="owner-gate owner-denied"><span className="eyebrow">ACCESS DENIED</span><h1>这个账号不是站点管理账号。</h1><p>{error || '请使用已加入主人白名单的 Google 账号登录。'}</p><p className="owner-hint">站点主人需要在后端环境变量 <code>OWNER_EMAILS</code> 中配置；此限制由服务端执行，不能由浏览器绕过。</p></section></main>;

  const latest = overview.collection.latestRun;
  return <main className="page owner-console"><section className="owner-header"><div><span className="eyebrow">SITE ADMINISTRATION</span><h1>站点管理台</h1><p>当前主人：{overview.owner.email}。这里显示采集、样本库和额度服务的运行状态；密钥始终只保留在服务器环境变量中。</p></div><button onClick={refresh}>刷新状态</button></section><section className="owner-summary"><article><span>公开视频样本</span><b>{overview.collection.videos === null ? '—' : compact.format(overview.collection.videos)}</b><small>按市场去重后的最新记录</small></article><article><span>历史快照</span><b>{overview.collection.snapshots === null ? '—' : compact.format(overview.collection.snapshots)}</b><small>用于累计增长曲线的时间点</small></article><article><span>主人账号</span><b>{overview.owner.ownerCount}</b><small>由后端白名单控制</small></article></section><section className="owner-grid"><article className="owner-panel collection-panel"><div className="owner-panel-head"><div><span className="eyebrow">COLLECTION</span><h2>每日采集</h2></div><span className={`status ${latest?.status === 'success' ? 'success' : 'warning'}`}>{latest?.status || '未运行'}</span></div><dl><div><dt>计划</dt><dd>每天 02:00 UTC（Vercel Cron）</dd></div><div><dt>最近开始</dt><dd>{dateTime(latest?.started_at)}</dd></div><div><dt>最近完成</dt><dd>{dateTime(latest?.finished_at)}</dd></div><div><dt>最近采集</dt><dd>{latest ? `${compact.format(latest.videos_seen || 0)} 条候选样本` : '暂无记录'}</dd></div><div><dt>市场</dt><dd>{latest?.markets?.join(' · ') || '暂无记录'}</dd></div></dl>{latest?.note && <p className="owner-note">{latest.note}</p>}<p className="owner-boundary">手动采集不会放在浏览器管理台中，避免公开页面触发 YouTube 搜索额度；采集仍由受保护的定时任务执行。</p></article><article className="owner-panel"><div className="owner-panel-head"><div><span className="eyebrow">SERVICES</span><h2>服务边界</h2></div></div><div className="owner-services"><ServiceState label="YouTube Data API" ready={overview.services.youtubeDataApi}/><ServiceState label="信号数据库" ready={overview.services.signalStore}/><ServiceState label="用户查询额度" ready={overview.services.quotaService}/></div><div className="owner-limits"><span>游客</span><b>{overview.services.guestDailyLimit} 次 / 日</b><span>登录用户</span><b>{overview.services.signedInDailyLimit} 次 / 日</b></div><p className="owner-boundary">此页面只显示是否已配置，不会显示 YouTube Key、Supabase service-role key 或采集密钥。</p></article></section></main>;
}
