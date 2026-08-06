export type Locale = 'zh-CN' | 'en';
export const messages = {
  'zh-CN': { discover:'公开发现', radar:'机会雷达', score:'机会评分', save:'保存', createIdea:'创建选题', noData:'数据不足', locked:'此功能需要升级', permissionDenied:'没有权限访问该工作区' },
  en: { discover:'Discover', radar:'Opportunity radar', score:'Opportunity score', save:'Save', createIdea:'Create idea', noData:'Insufficient data', locked:'Upgrade required', permissionDenied:'You do not have access to this workspace' }
} as const;
export const t = (locale:Locale,key:keyof typeof messages['zh-CN']) => messages[locale][key];
