'use client';

import { useEffect, useState } from 'react';
import { getSession } from '@/src/lib/auth';

export type UpgradePlan = {
  name: 'Pro' | 'Team';
  price: string;
  currency: 'CNY' | 'USD';
  cycle: 'month' | 'quarter' | 'year';
  description: string;
};

type UpgradeModalProps = {
  plan: UpgradePlan;
  onClose: () => void;
};

export default function UpgradeModal({ plan, onClose }: UpgradeModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const account = getSession();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const currencyName = plan.currency === 'USD' ? '美元 USD' : '人民币 CNY';
  const purchaseRequest = `我想开通 SignalCraft ${plan.name}（${plan.price}，${currencyName}）。\n购买账号邮箱：${account?.email || '未登录，请在回复中填写购买账号邮箱'}。\n请确认付款方式和开通周期；美元金额为页面参考价，以管理员最终确认金额为准。`;

  const copyRequest = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(purchaseRequest);
      setCopyError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError(true);
    }
  };

  return <div className="upgrade-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title" onMouseDown={event => event.stopPropagation()}>
      <header className="upgrade-modal-head">
        <div>
          <span className="eyebrow">MANUAL ACTIVATION</span>
          <h2 id="upgrade-modal-title">开通 {plan.name}</h2>
          <p>扫码添加微信客服，确认套餐、付款方式和开通周期。</p>
        </div>
        <button className="upgrade-close" type="button" onClick={onClose} aria-label="关闭开通窗口">×</button>
      </header>

      <div className="upgrade-modal-body">
        <div className="upgrade-instructions">
          <div className="upgrade-plan-chip">
            <span>已选择套餐</span>
            <b>{plan.name}</b>
            <strong>{plan.price}</strong>
          </div>
          <p className="upgrade-plan-copy">{plan.description} · {plan.currency === 'USD' ? '美元参考价' : '人民币报价'}</p>
          <ol className="upgrade-steps">
            <li><b>01</b><span>用微信扫描右侧二维码，添加管理员。</span></li>
            <li><b>02</b><span>发送下方已复制的套餐与购买账号信息。</span></li>
            <li><b>03</b><span>管理员确认付款后，为对应账号人工开通。</span></li>
          </ol>
          <div className="upgrade-account">
            <span>购买账号</span>
            <b>{account?.email || '未登录 · 请在微信中提供注册后要使用的邮箱。'}</b>
          </div>
          <button className="upgrade-copy" type="button" onClick={copyRequest}>{copied ? '已复制开通信息' : '复制开通信息'}</button>
          {copyError && <p className="upgrade-copy-error">无法访问剪贴板，请在微信里说明：{plan.name} · {plan.price} · {currencyName}，并提供购买账号邮箱。</p>}
          <p className="upgrade-boundary">这是人工开通流程：不会在本页自动扣款，也不会收集你的支付信息。美元金额仅用于报价参考，实际付款方式由管理员确认。</p>
        </div>

        <figure className="upgrade-qr">
          <div className="upgrade-qr-frame"><img src="/payment/wechat-service-panwei.jpg" alt="微信客服二维码，潘伟，广东广州" width={1083} height={1470} decoding="async" /></div>
          <figcaption>微信客服 · 潘伟</figcaption>
        </figure>
      </div>
    </section>
  </div>;
}
