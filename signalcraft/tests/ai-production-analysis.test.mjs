import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_PRODUCTION_ANALYSIS_VERSION, normalizeAiProductionAnalysis } from '../src/lib/ai-production-analysis.ts';

const reason = { text: '结构可由 AI 辅助，但仍需发布验证。', stance: 'POSITIVE', sourceType: 'INFERENCE', evidenceRef: 'LLM_INFERENCE' };
const metric = (score = 82) => ({ score, level: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW', confidence: 72, reasons: [reason] });
const workflow = [{ stage: 'RESEARCH', label: '研究', why: '核验事实。', sourceType: 'INFERENCE', evidenceRef: 'LLM_INFERENCE' }, { stage: 'SCRIPT', label: '脚本', why: '形成结构。', sourceType: 'INFERENCE', evidenceRef: 'LLM_INFERENCE' }, { stage: 'REVIEW', label: '复核', why: '检查原创与事实。', sourceType: 'LOW_CONFIDENCE', evidenceRef: 'MISSING_COMMENT_TEXT' }];
const claim = text => ({ text, sourceType: 'INFERENCE', evidenceRef: 'LLM_INFERENCE' });
const format = index => ({ name: `Format ${index}`, description: '可验证的具体形式。', sourceType: 'INFERENCE', evidenceRef: 'LLM_INFERENCE', productionFit: metric(82 - index), productionAdvantage: metric(80 - index), originalityCapacity: metric(70 - index), confidence: 68, shortsSuitability: 'MEDIUM', longFormSuitability: 'HIGH', reasons: [claim('结构可拆解。')], risks: [claim('避免同质化。')], workflow });
const payload = {
  subject: 'Economic explanation', productionFit: metric(), productionAdvantage: metric(86), originalityCapacity: metric(76),
  productionPattern: { scriptability: { value: 84, level: 'HIGH', confidence: 70, sourceType: 'INFERENCE', evidenceRef: 'LLM_INFERENCE', reason: '已有内容机制支持推断。' } },
  risks: [{ text: '可能同质化。', severity: 'MEDIUM', sourceType: 'INFERENCE', evidenceRef: 'LLM_INFERENCE', mitigation: '增加原创证据。' }],
  recommendedWorkflow: workflow, formats: Array.from({ length: 5 }, (_, index) => format(index + 1)),
  evidence: [{ source: 'PUBLIC_YOUTUBE_METADATA', sourceType: 'DATA_BACKED', description: '公开元数据存在。' }],
};

test('normalizes the client AI production contract without changing scores', () => {
  const result = normalizeAiProductionAnalysis(payload);
  assert.equal(result.version, AI_PRODUCTION_ANALYSIS_VERSION);
  assert.equal(result.productionFit.score, 82);
  assert.equal(result.formats.length, 5);
  assert.equal(result.evidence[0].sourceType, 'DATA_BACKED');
});

test('rejects an incomplete analysis instead of filling fake defaults', () => {
  assert.throws(() => normalizeAiProductionAnalysis({ ...payload, formats: [] }), /缺少内容形式/);
  assert.throws(() => normalizeAiProductionAnalysis({ ...payload, productionFit: { ...metric(), confidence: 140 } }), /productionFit 无效/);
});

test('keeps the AI production-fit entry visible before a micro-niche exists', () => {
  const workbench = readFileSync(new URL('../src/app/discovery-workbench.tsx', import.meta.url), 'utf8');
  const longform = readFileSync(new URL('../src/app/longform-opportunities.tsx', import.meta.url), 'utf8');
  assert.match(workbench, /export function AiProductionFitEmptyState/);
  assert.match(workbench, /等待细分方向生成/);
  assert.match(workbench, /AI 制作适配度.*AI 制作优势.*原创空间.*主要风险.*推荐生产方式/s);
  assert.match(longform, /opportunities\.length[\s\S]*AiProductionFitEmptyState locale=\{locale\}/);
});
