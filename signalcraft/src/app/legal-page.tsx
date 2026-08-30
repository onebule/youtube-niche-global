import Link from 'next/link';

type LegalKind = 'privacy' | 'terms';

const copy = {
  privacy: {
    eyebrow: 'PRIVACY POLICY · 隐私政策',
    title: '你的研究数据，保持在清晰的边界内。',
    intro: '这是 SignalCraft 当前版本的隐私说明，帮助你了解账号、公开数据和创作素材分别如何被使用。',
    sections: [
      ['我们收集什么', '登录时会使用账号邮箱和必要的会话信息来建立账户。公开发现、排行榜和频道诊断读取的是 YouTube 公开数据，不读取你的 YouTube 私有数据。'],
      ['创作素材如何处理', '你主动提交的 Prompt、参考图片和生成任务参数只用于完成对应功能。第三方模型密钥保存在服务端，不会发送到浏览器；生成媒体会按当前存储策略保存，便于你在历史记录中复用。'],
      ['本地保存与删除', '部分工作室草稿和界面偏好保存在当前设备。你可以退出账号、清理浏览器数据，或通过站点管理者申请删除账户相关数据。'],
    ],
  },
  terms: {
    eyebrow: 'TERMS OF SERVICE · 服务条款',
    title: '用公开信号做判断，把最终决定留给你。',
    intro: '使用 SignalCraft 即表示你理解以下服务边界，并会对自己提交的内容和使用方式负责。',
    sections: [
      ['服务范围', 'SignalCraft 提供 YouTube 公开信号整理、研究工具和 AI 创作辅助。评分、机会和模型输出用于研究与创作参考，不构成收益、增长或版权保证。'],
      ['内容与版权', '请确保你上传的图片、脚本、视频和 Prompt 具备必要的使用权，不要提交违法、侵权或违反第三方平台规则的内容。'],
      ['积分与生成任务', '生成任务会遵循页面显示的模型、耗时和积分规则。第三方服务失败时不应向用户结算；服务可能因供应商、网络或容量变化而暂时不可用。'],
    ],
  },
} satisfies Record<LegalKind, { eyebrow: string; title: string; intro: string; sections: [string, string][] }>;

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const page = copy[kind];
  return <main className="legal-page">
    <Link className="legal-back" href="/">← 返回 SignalCraft</Link>
    <article className="legal-card">
      <span className="eyebrow">{page.eyebrow}</span>
      <h1>{page.title}</h1>
      <p className="legal-intro">{page.intro}</p>
      <div className="legal-sections">
        {page.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
      </div>
      <p className="legal-updated">当前版本：2026 年 8 月 · {kind === 'privacy' ? 'Privacy policy' : 'Terms of service'}</p>
    </article>
  </main>;
}
