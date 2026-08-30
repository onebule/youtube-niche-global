export type ViralPattern = {
  id: string;
  sourceCaseId: string;
  sourceUrl: string;
  title: string;
  family: string;
  hookType: string;
  formula: string;
  coreMechanism: string;
  tension: string;
  payoff: string;
  emotionalCurve: string;
  visualLanguage: string;
  propsAndSound: string;
  beatTimestamps: [string, string, string, string];
  beats: [string, string, string, string];
  adaptationPrompt: string;
  tags: string[];
};

/**
 * Editorial pattern cards distilled from the supplied public reference pages.
 * These are mechanisms and production prompts, not copied scripts or media.
 */
export const viralPatternLibrary: readonly ViralPattern[] = [
  {
    id: 'kindness-test',
    sourceCaseId: '04170013',
    sourceUrl: 'https://lulujai.com/zh-CN/shorts/viral/04170013',
    title: '得到好运之后，是否愿意分享？',
    family: '假情境善意考题',
    hookType: '神迹角色 + 匮乏状态 + 价值判断预埋',
    formula: '先让主角明显匮乏 → 用超现实手段让她变富足 → 抛出需要帮助的人 → 用明确标签盖章',
    coreMechanism: '把“得到之后怎么选择”做成一眼能懂的视觉考题，并让结尾的善意成为答案。',
    tension: '观众不再关心主角能否得到好运，而是等待她会独享还是把好运传给别人。',
    payoff: '用一个具体帮助动作和清晰的 GOOD / BAD 价值标记完成情绪封口。',
    emotionalCurve: '匮乏 → 被眷顾 → 满足 → 犹豫 → 分享 → 道德确认',
    visualLanguage: '高饱和奇迹特效；先拍空碗/空手，再拍富足道具；选择时停在表情和手部。',
    propsAndSound: '空容器、财富象征、受伤或求助道具；用光效和短促音效托住转折，不依赖长对白。',
    beatTimestamps: ['00:00', '00:12', '00:24', '00:40'],
    beats: ['用明显匮乏让价值问题先成立。', '超现实转折把主角送入富足状态。', '安排一个具体求助对象，迫使主角做选择。', '帮助动作加上明确价值回收，形成可分享的结尾。'],
    adaptationPrompt: '换成你的行业、资源或机会：主角先得到一项稀缺资源，再遇到一个需要它的人；用原创道具和新的价值判断收尾。',
    tags: ['善意', '选择题', '超现实', '强价值结尾'],
  },
  {
    id: 'pet-rule-loophole',
    sourceCaseId: '04170012',
    sourceUrl: 'https://lulujai.com/zh-CN/shorts/viral/04170012',
    title: '它懂规则，只是在研究漏洞',
    family: '宠物漏洞喜剧',
    hookType: '认真准备 + 规则系统 + 宠物试探',
    formula: '主人把规则布置得很清楚 → 宠物像在观察边界 → 主人离场制造悬念 → 微妙事故 + 表情 punchline',
    coreMechanism: '先把规则拍得足够认真，再让角色用“似乎懂了却故意钻空子”连续破坏观众预期。',
    tension: '观众会不断猜它是真的没学会，还是已经看懂规则并在寻找最小代价的违规点。',
    payoff: '不要解释漏洞，让一个精准的事故位置和角色表情替台词完成笑点。',
    emotionalCurve: '认真布置 → 观察试探 → 预感不妙 → 翻车 → 无语 → 表情击中',
    visualLanguage: '固定广角交代规则范围；插入角色视线和脚步特写；结尾留出反应停顿。',
    propsAndSound: '清晰的边界标记、重复使用的训练道具、轻微现场声；笑点靠动作时机而非解释。',
    beatTimestamps: ['00:00', '00:04', '00:10', '00:16'],
    beats: ['把规则和主人认真程度拍到观众一眼看懂。', '让角色逐步试探边界，但不要马上揭示意图。', '主人离场或视线移开，给观众“它要动手了”的悬念。', '用最小、最精准的违规结果和表情收尾。'],
    adaptationPrompt: '把宠物替换成你的角色或产品，把尿垫/训练规则替换成办公、家庭或工具边界；保留“懂规则但钻漏洞”的观看机制。',
    tags: ['宠物', '漏洞', '表情喜剧', '低语言'],
  },
  {
    id: 'kindness-reversal',
    sourceCaseId: '04170003',
    sourceUrl: 'https://lulujai.com/zh-CN/shorts/viral/04170003',
    title: '看起来要被责怪，结果收到具体帮助',
    family: '陌生人善意反转',
    hookType: '事故窘境 + 压迫型对手位 + 反转预埋',
    formula: '先摆出劳动者真实窘境 → 放入一个看似会发火的人 → 让观众预判投诉 → 用实物帮助反转',
    coreMechanism: '让观众先替角色害怕一个负面结果，再用具体、可立即使用的帮助把预期翻成尊重。',
    tension: '冲突不是人物说了什么，而是观众对“这个看起来很强势的人会怎么反应”的错误预判。',
    payoff: '礼物必须被当场使用或带走，让善意变成可见结果，而不是一句空泛的谢谢。',
    emotionalCurve: '事故尴尬 → 压迫感 → 预期责怪 → 礼物出现 → 释然 → 尊重',
    visualLanguage: '单一门口空间；旧物/新物强色彩对比；先用站位制造高低关系，再用交接动作翻转。',
    propsAndSound: '坏掉的工具、现场事故残留、替代性新物件；保留真实环境声，少用解释性对白。',
    beatTimestamps: ['00:00', '00:04', '00:08', '00:14'],
    beats: ['一秒交代谁遇到什么具体麻烦。', '让潜在冲突源检查现场，延长观众的不安。', '用一个看似负面的动作继续误导。', '推出可立即解决问题的实物，立刻投入使用并落版。'],
    adaptationPrompt: '替换成你的职业、工具或服务场景；先让角色害怕丢脸/被罚，再给出一个能马上改变处境的具体解决方案。',
    tags: ['善意', '误导预期', '实物 payoff', '低语言'],
  },
  {
    id: 'interactive-milestone',
    sourceCaseId: '04150005',
    sourceUrl: 'https://lulujai.com/zh-CN/shorts/viral/04150005',
    title: '把观众的订阅动作写进剧情机关',
    family: '高戏剧互动机关',
    hookType: '家庭冲突 + 高低位压制 + 立刻动手',
    formula: '强冲突开场 → 受害方立刻翻成掌控者 → 惩罚规模持续升级 → 订阅目标倒计时 → 按钮成为机关',
    coreMechanism: '把创作者的里程碑从片外 CTA 变成片内倒计时，让观众的点击行为成为剧情中的物理装置。',
    tension: '人物冲突和订阅目标同时升级，观众既想看谁赢，也想看机关什么时候落下。',
    payoff: '最终互动元素必须真的改变画面或动作，否则 CTA 仍然只是贴在结尾的广告。',
    emotionalCurve: '挑衅 → 受害 → 报复升级 → 倒计时 → 压迫峰值 → 互动落地',
    visualLanguage: '室内高低位开战；切到更大的户外空间；让计数大屏和核心机关持续同框。',
    propsAndSound: '倒计时屏、超大按钮、机械装置、明确的状态音；每一拍都让 stakes 变大。',
    beatTimestamps: ['00:00', '00:08', '00:18', '00:32'],
    beats: ['用一个立刻动手的动作把关系变成公开冲突。', '让被压制者切换到更高权力位，完成身份反转。', '把目标数字和惩罚装置放入同一画面，持续加码。', '让观众熟悉的互动按钮真的参与结尾动作。'],
    adaptationPrompt: '把订阅换成你的真实创作者目标、投票或挑战进度；将互动行为设计成剧情装置，避免只在片尾口播求关注。',
    tags: ['互动', '升级', '里程碑', '高戏剧'],
  },
  {
    id: 'anthropomorphic-romance',
    sourceCaseId: '04140039',
    sourceUrl: 'https://lulujai.com/zh-CN/shorts/viral/04140039',
    title: '可爱拟物，突然变得有点疼',
    family: '拟物恋爱反差',
    hookType: '罕见造型 + 甜蜜约会 + 危险道具奇观',
    formula: '用少见拟物情侣抢停留 → 先给甜蜜相处 → 危险道具改变情绪 → 脆弱表情 → 超现实陪伴式收尾',
    coreMechanism: '先用角色造型让观众接受一个新世界，再用“角色本体可能受伤”的危险联想把可爱转成脆弱。',
    tension: '观众不需要理解现实因果，只要感到“这个可爱角色可能会被它代表的东西伤害”。',
    payoff: '用陪伴、远景或宇宙感画面保留悬浮感，不强行解释现实逻辑。',
    emotionalCurve: '甜蜜 → 好奇 → 危险预感 → 害怕 → 陪伴 → 童话收尾',
    visualLanguage: '先稳定并排构图建立情侣关系；中段切近脸和危险道具；结尾用超现实远景拉开。',
    propsAndSound: '角色头套/拟物服装、对应本体的日常道具、轻氛围音乐；靠造型和表情，不靠密集对白。',
    beatTimestamps: ['00:00', '00:05', '00:10', '00:16'],
    beats: ['用一眼少见的拟物造型建立角色和关系。', '用轻松相处让观众先投入可爱感。', '加入会伤害角色本体的道具，让情绪突然变脆。', '保留陪伴关系，用超现实画面完成记忆点。'],
    adaptationPrompt: '选择一个人人认识的食物、工具或物体，把它拟人化成你的原创角色；先让观众觉得可爱，再用本体联想制造危险和陪伴。',
    tags: ['拟物', '恋爱', '超现实', '低语言'],
  },
];

export function getViralPattern(id: string | null | undefined): ViralPattern | null {
  return viralPatternLibrary.find(pattern => pattern.id === id) || null;
}
