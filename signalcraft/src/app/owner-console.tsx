'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { AccountSession } from '@/src/lib/auth';
import { loadOwnerOverview, OwnerOverviewError, updateVideoTeamAccess, type OwnerOverview, type TeamAccessDuration } from '@/src/lib/owner-admin';

const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
const dateTime = (value?: string | number | null) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '尚未完成';
const accountDate = (value?: string | null) => value ? dateTime(value) : '尚未登录';
const initials = (value: string) => value.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'SC';

function ServiceState({ label, ready }: { label: string; ready: boolean }) {
  return <div className="owner-service"><span className={ready ? 'ready' : 'missing'}>{ready ? '●' : '○'}</span><b>{label}</b><small>{ready ? '已连接' : '未配置'}</small></div>;
}

type DirectoryUser = OwnerOverview['users']['recent'][number];

function teamAccessLabel(user: DirectoryUser): ReactNode {
  const access = user.teamAccess;
  if (access.status === 'owner') return <span className="team-access-state owner">站点主人</span>;
  if (access.status === 'environment') return <span className="team-access-state configured">部署名单</span>;
  if (access.status === 'active') return <span className="team-access-state active">Team{access.expiresAt ? ` · 至 ${accountDate(access.expiresAt)}` : ' · 长期'}</span>;
  if (access.status === 'expired') return <span className="team-access-state expired">已到期{access.expiresAt ? ` · ${accountDate(access.expiresAt)}` : ''}</span>;
  return <span className="team-access-state none">未开通</span>;
}

function TeamAccessDialog({
  user,
  saving,
  error,
  onClose,
  onSave,
}: {
  user: DirectoryUser;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (action: 'grant' | 'revoke', duration?: TeamAccessDuration) => void;
}) {
  const [duration, setDuration] = useState<TeamAccessDuration>('30d');
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const isActive = user.teamAccess.status === 'active';
  const title = confirmingRevoke ? '确认撤销 Team 权限' : isActive ? '管理 Team 权限' : '开通 Team 权限';

  useEffect(() => { dialogRef.current?.focus(); }, []);

  const keepFocusInDialog = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !saving) { onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled])') || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className="team-access-backdrop" role="presentation">
    <section ref={dialogRef} className="team-access-dialog" role="dialog" aria-modal="true" aria-labelledby="team-access-title" tabIndex={-1} onKeyDown={keepFocusInDialog}>
      <div className="team-access-dialog-head"><div><span className="eyebrow">TEAM ACCESS</span><h2 id="team-access-title">{title}</h2></div><button type="button" className="team-dialog-close" onClick={onClose} disabled={saving} aria-label="关闭权限管理窗口">×</button></div>
      <p className="team-access-account">{user.email}</p>
      {confirmingRevoke ? <p className="team-access-warning">撤销后，该账号重新登录也不能使用 AI 图生视频；以后可再次开通。</p> : <><p className="team-access-copy">此权限只开放 AI 图生视频，不会授予站点管理、数据采集或主人无限积分权限。</p><label className="team-access-duration" htmlFor="team-access-duration">权限有效期<select id="team-access-duration" name="team-access-duration" value={duration} onChange={event => setDuration(event.target.value as TeamAccessDuration)} disabled={saving}><option value="7d">7 天</option><option value="30d">30 天</option><option value="permanent">长期有效</option></select></label>{isActive && <p className="team-access-current">当前状态：{teamAccessLabel(user)}</p>}</>}
      {error && <p className="team-access-error" role="alert">{error}</p>}
      <div className="team-access-actions">
        <button type="button" onClick={onClose} disabled={saving}>取消</button>
        {confirmingRevoke ? <button type="button" className="team-access-danger" onClick={() => onSave('revoke')} disabled={saving}>{saving ? '正在撤销…' : '确认撤销'}</button> : <>{isActive && <button type="button" className="team-access-danger-link" onClick={() => setConfirmingRevoke(true)} disabled={saving}>撤销权限</button>}<button type="button" className="primary" onClick={() => onSave('grant', duration)} disabled={saving}>{saving ? '正在保存…' : isActive ? '更新权限' : '开通 Team 权限'}</button></>}
      </div>
      <p className="team-access-status" aria-live="polite">{saving ? '正在通过服务器更新账号权限…' : ''}</p>
    </section>
  </div>;
}

function RegisteredUsers({ users, onManage }: { users: OwnerOverview['users']; onManage: (user: DirectoryUser) => void }) {
  let directory: ReactNode;
  if (!users.available) directory = <p className="owner-users-empty">注册账号目录暂时无法读取；采集和额度服务仍独立运行。请刷新后重试。</p>;
  else if (!users.recent.length) directory = <p className="owner-users-empty">暂无已完成注册的账号。</p>;
  else directory = <div className="owner-user-table" role="table" aria-label="最近注册账号"><div className="owner-user-row owner-user-heading" role="row"><span role="columnheader">账号</span><span role="columnheader">登录方式</span><span role="columnheader">注册时间</span><span role="columnheader">最近登录</span><span role="columnheader">AI Studio Team</span><span role="columnheader">操作</span></div>{users.recent.map(user => <div className="owner-user-row" role="row" key={`${user.email}-${user.createdAt || 'unknown'}`}><span className="owner-user-email" role="cell"><i aria-hidden="true">{initials(user.email)}</i><b>{user.email}</b>{user.isOwner && <em>站点主人</em>}</span><span role="cell">{user.provider}</span><time role="cell" dateTime={user.createdAt || undefined}>{accountDate(user.createdAt)}</time><time role="cell" dateTime={user.lastSignInAt || undefined}>{accountDate(user.lastSignInAt)}</time><span role="cell">{teamAccessLabel(user)}</span><span className="owner-user-action" role="cell">{user.isOwner || user.teamAccess.status === 'environment' ? <small>{user.isOwner ? '固定权限' : '部署配置'}</small> : <button type="button" onClick={() => onManage(user)} disabled={!users.teamAccessAvailable}>{user.teamAccess.active ? '管理权限' : '开通权限'}</button>}</span></div>)}</div>;
  return <section className="owner-panel owner-users" aria-labelledby="registered-users-title"><div className="owner-panel-head"><div><span className="eyebrow">ACCOUNT DIRECTORY</span><h2 id="registered-users-title">最近注册账号</h2></div><span className={`status ${users.available && users.teamAccessAvailable ? 'success' : 'warning'}`}>{users.available && users.teamAccessAvailable ? `最近 ${users.recent.length} 个账号` : '授权服务待初始化'}</span></div>{users.available && <p className="team-access-intro">在账号右侧开通 Team 后，该账号刷新页面或重新登录即可使用 AI 图生视频；管理员和主人权限不会随之开放。</p>}{directory}<p className="owner-boundary">仅显示账号邮箱、注册时间、最近登录和登录方式；不会显示密码、访问令牌、用户 ID 或身份资料。部署环境变量名单继续有效，但仅能在部署配置中调整。</p></section>;
}

export default function OwnerConsole({ account, onSignIn }: { account: AccountSession | null; onSignIn: () => void }) {
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(Boolean(account));
  const [teamTarget, setTeamTarget] = useState<DirectoryUser | null>(null);
  const [teamError, setTeamError] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);
  const accessToken = account?.accessToken;

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try { setOverview(await loadOwnerOverview()); }
    catch (reason) {
      setOverview(null);
      setAccessDenied(reason instanceof OwnerOverviewError && reason.status === 403);
      setError(reason instanceof Error ? reason.message : '无法读取站点管理概览。');
    }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    const task = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(task);
  }, [refresh]);

  const saveTeamAccess = useCallback(async (action: 'grant' | 'revoke', duration?: TeamAccessDuration) => {
    if (!teamTarget) return;
    setTeamSaving(true);
    setTeamError('');
    try {
      await updateVideoTeamAccess({ email: teamTarget.email, action, duration });
      setOverview(await loadOwnerOverview());
      setTeamTarget(null);
    } catch (reason) {
      setTeamError(reason instanceof Error ? reason.message : '无法更新 Team 权限。');
    } finally {
      setTeamSaving(false);
    }
  }, [teamTarget]);

  if (!account) return <main className="page owner-console"><section className="owner-gate"><span className="eyebrow">OWNER ACCESS</span><h1>先登录，再验证站点主人权限。</h1><p>管理台不会根据浏览器里的邮箱显示权限；它会在服务器验证你的 Google / Supabase 会话和主人白名单。</p><button className="primary" onClick={onSignIn}>使用 Google 登录</button></section></main>;

  if (loading) return <main className="page owner-console"><section className="owner-gate"><span className="eyebrow">OWNER ACCESS</span><h1>正在验证管理权限…</h1><p>正在通过服务器检查当前登录账号。</p></section></main>;

  if (accessDenied) return <main className="page owner-console"><section className="owner-gate owner-denied"><span className="eyebrow">ACCESS DENIED</span><h1>这个账号不是站点管理账号。</h1><p>{error || '请使用已加入主人白名单的 Google 账号登录。'}</p><p className="owner-hint">站点主人需要在后端环境变量 <code>OWNER_EMAILS</code> 中配置；此限制由服务端执行，不能由浏览器绕过。</p></section></main>;

  if (error || !overview) return <main className="page owner-console"><section className="owner-gate"><span className="eyebrow">SERVICE UNAVAILABLE</span><h1>管理服务暂时无法读取。</h1><p>{error || '请稍后刷新重试。'}</p><button className="primary" onClick={refresh}>重新读取管理状态</button><p className="owner-hint">这不会影响已采集的公开样本、注册账号或用户查询额度；它只表示本次管理概览请求没有完成。</p></section></main>;

  const latest = overview.collection.latestRun;
  return <main className="page owner-console">
    <section className="owner-header"><div><span className="eyebrow">SITE ADMINISTRATION</span><h1>站点管理台</h1><p>当前主人：{overview.owner.email}。这里显示采集、样本库、账号目录和额度服务的运行状态；密钥始终只保留在服务器环境变量中。</p></div><button onClick={refresh}>刷新状态</button></section>
    <section className="owner-identity" aria-label="当前登录管理账号"><div className="owner-identity-profile"><span className="owner-avatar" aria-hidden="true">{initials(account.name || account.email)}</span><div><span className="eyebrow">CURRENT ADMIN SESSION</span><h2>{account.name || '站点主人'}</h2><p>{account.email}</p></div></div><dl className="owner-identity-facts"><div><dt>登录方式</dt><dd>Google 账号</dd></div><div><dt>权限身份</dt><dd><span className="owner-role">✓ 已验证站点主人</span></dd></div><div><dt>会话状态</dt><dd>{account.expiresAt ? `有效至 ${dateTime(account.expiresAt)}` : '当前会话有效'}</dd></div></dl><p className="owner-identity-boundary">当前会话和注册账号目录分开显示；账号目录仅由服务器在主人权限通过后读取。</p></section>
    <section className="owner-summary"><article><span>公开视频样本</span><b>{overview.collection.videos === null ? '—' : compact.format(overview.collection.videos)}</b><small>按市场去重后的最新记录</small></article><article><span>历史快照</span><b>{overview.collection.snapshots === null ? '—' : compact.format(overview.collection.snapshots)}</b><small>用于累计增长曲线的时间点</small></article><article><span>已注册账号</span><b>{overview.users.total === null ? '—' : compact.format(overview.users.total)}</b><small>Supabase Auth 中的真实账号</small></article><article><span>主人账号</span><b>{overview.owner.ownerCount}</b><small>由后端白名单控制</small></article></section>
    <RegisteredUsers users={overview.users} onManage={user => { setTeamError(''); setTeamTarget(user); }} />
    <section className="owner-grid"><article className="owner-panel collection-panel"><div className="owner-panel-head"><div><span className="eyebrow">COLLECTION</span><h2>每日采集</h2></div><span className={`status ${latest?.status === 'success' ? 'success' : 'warning'}`}>{latest?.status || '未运行'}</span></div><dl><div><dt>计划</dt><dd>每天 02:00 UTC（Vercel Cron）</dd></div><div><dt>最近开始</dt><dd>{dateTime(latest?.started_at)}</dd></div><div><dt>最近完成</dt><dd>{dateTime(latest?.finished_at)}</dd></div><div><dt>最近采集</dt><dd>{latest ? `${compact.format(latest.videos_seen || 0)} 条候选样本` : '暂无记录'}</dd></div><div><dt>市场</dt><dd>{latest?.markets?.join(' · ') || '暂无记录'}</dd></div></dl>{latest?.note && <p className="owner-note">{latest.note}</p>}<p className="owner-boundary">手动采集不会放在浏览器管理台中，避免公开页面触发 YouTube 搜索额度；采集仍由受保护的定时任务执行。</p></article><article className="owner-panel"><div className="owner-panel-head"><div><span className="eyebrow">SERVICES</span><h2>服务边界</h2></div></div><div className="owner-services"><ServiceState label="YouTube Data API" ready={overview.services.youtubeDataApi}/><ServiceState label="信号数据库" ready={overview.services.signalStore}/><ServiceState label="用户查询额度" ready={overview.services.quotaService}/></div><div className="owner-limits"><span>游客</span><b>{overview.services.guestDailyLimit} 次 / 日</b><span>登录用户</span><b>{overview.services.signedInDailyLimit} 次 / 日</b><span className="owner-limit">当前主人</span><b className="owner-limit">不计入额度</b></div><p className="owner-boundary">当前主人查询不会消耗每日用户额度；仍只读取已采集的公开样本，采集任务继续由受保护的定时任务执行。</p><p className="owner-boundary">此页面只显示是否已配置，不会显示 YouTube Key、Supabase service-role key 或采集密钥。</p></article></section>
    {teamTarget && <TeamAccessDialog user={teamTarget} saving={teamSaving} error={teamError} onClose={() => { if (!teamSaving) { setTeamError(''); setTeamTarget(null); } }} onSave={saveTeamAccess} />}
  </main>;
}
