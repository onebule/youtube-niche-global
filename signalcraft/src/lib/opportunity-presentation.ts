export type OpportunityStatus = 'RECOMMENDED' | 'TEST' | 'CAUTION' | 'AVOID';

export type OpportunityStatusCopy = {
  key: OpportunityStatus;
  zh: string;
  en: string;
};

export const OPPORTUNITY_STATUS: Record<OpportunityStatus, OpportunityStatusCopy> = {
  RECOMMENDED: { key: 'RECOMMENDED', zh: '推荐', en: 'Recommended' },
  TEST: { key: 'TEST', zh: '值得测试', en: 'Worth testing' },
  CAUTION: { key: 'CAUTION', zh: '谨慎', en: 'Caution' },
  AVOID: { key: 'AVOID', zh: '不建议', en: 'Not recommended' },
};

type RadarLike = {
  lifecycle: string;
  eventType: string;
  confidence: string;
  independentChannelCount: number;
  sampleVideoCount: number;
  smallCreatorBreakoutCount?: number;
  breakoutCount?: number;
  creatorConcentrationTop3?: number | null;
};

const breakoutCount = (event: RadarLike) => event.smallCreatorBreakoutCount ?? event.breakoutCount ?? 0;

export function opportunityStatusForRadar(event: RadarLike): OpportunityStatusCopy {
  const concentrated = typeof event.creatorConcentrationTop3 === 'number' && event.creatorConcentrationTop3 >= 65;
  if (event.lifecycle === 'CROWDED' || event.lifecycle === 'SATURATING' || event.eventType.includes('CROWDED') || event.eventType.includes('SATURATION')) {
    return OPPORTUNITY_STATUS.AVOID;
  }
  if (event.confidence === 'LOW' || event.independentChannelCount < 2 || event.sampleVideoCount < 5 || concentrated) {
    return OPPORTUNITY_STATUS.CAUTION;
  }
  if (event.confidence === 'HIGH' && event.independentChannelCount >= 3 && breakoutCount(event) > 0) {
    return OPPORTUNITY_STATUS.RECOMMENDED;
  }
  return OPPORTUNITY_STATUS.TEST;
}

export function beginnerAccessForRadar(event: RadarLike, locale: 'zh' | 'en') {
  const count = breakoutCount(event);
  const concentrated = typeof event.creatorConcentrationTop3 === 'number' && event.creatorConcentrationTop3 >= 65;
  if (event.independentChannelCount < 2 || event.sampleVideoCount < 5) return locale === 'zh' ? '证据不足' : 'Evidence thin';
  if (concentrated) return locale === 'zh' ? '较低' : 'Lower';
  if (count > 0) return locale === 'zh' ? '较高' : 'Higher';
  return locale === 'zh' ? '待验证' : 'To validate';
}

export function competitionForRadar(event: RadarLike, locale: 'zh' | 'en') {
  const concentration = event.creatorConcentrationTop3;
  if (typeof concentration !== 'number') return locale === 'zh' ? '未知' : 'Unknown';
  if (concentration >= 65) return locale === 'zh' ? '高' : 'High';
  if (concentration >= 40) return locale === 'zh' ? '中' : 'Medium';
  return locale === 'zh' ? '较低' : 'Lower';
}
