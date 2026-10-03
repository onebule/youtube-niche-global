import type { CanvasTextModel } from './canvas-text-generation';

export type CanvasChatMessage = { role: 'user' | 'assistant'; content: string };
export const CANVAS_CHAT_LIMITS = { messages: 24, messageCharacters: 12000, totalCharacters: 48000 } as const;

export function readyClaudeModels(models: CanvasTextModel[]): CanvasTextModel[] {
  return models.filter(model => model.provider === 'claude' && model.enabled);
}

/** Never silently discard earlier turns: a full conversation starts afresh. */
export function nextCanvasChatMessages(history: CanvasChatMessage[], question: string): CanvasChatMessage[] {
  const messages: CanvasChatMessage[] = [...history, { role: 'user', content: question.trim() }];
  if (messages.length > CANVAS_CHAT_LIMITS.messages || messages.reduce((sum, message) => sum + message.content.length, 0) > CANVAS_CHAT_LIMITS.totalCharacters) {
    throw new Error('CHAT_LIMIT');
  }
  if (messages.some((message, index) => message.role !== (index % 2 ? 'assistant' : 'user') || !message.content.trim() || message.content.length > CANVAS_CHAT_LIMITS.messageCharacters)) {
    throw new Error('CHAT_INPUT');
  }
  return messages;
}

export function canvasChatError(code: string | undefined, zh: boolean): string {
  const copy = {
    AUTH_REQUIRED: ['登录已失效，请重新登录后发送。', 'Your session expired. Sign in again to send.'],
    TEAM_ONLY: ['文本助手当前仅向 Team 成员开放。', 'The text assistant is currently available to Team members only.'],
    TEXT_MODEL_NOT_READY: ['所选 Claude 型号未就绪，请重新检查模型。', 'This Claude model is not ready. Check models again.'],
    TEXT_MODEL_UNSUPPORTED: ['请选择服务端支持的 Claude 型号。', 'Choose a Claude model supported by the server.'],
    TEXT_CHAT_INVALID: ['对话过长或格式不正确，请清空后重新提问。', 'The conversation is too long or invalid. Start a new chat.'],
    CHAT_LIMIT: ['对话已达长度上限，请清空后开始新对话。', 'The conversation limit was reached. Clear it to start a new chat.'],
    CHAT_INPUT: ['请输入问题，每条最多 12000 个字符。', 'Enter a question of up to 12,000 characters.'],
    TIMEOUT: ['等待超时，未自动重试。服务方可能已计费，请勿连续重复发送。', 'The request timed out without retrying. The provider may have charged it; avoid repeated submissions.'],
    NETWORK: ['文本服务连接失败，未自动重试。请检查网络后再发送。', 'Could not connect to the text service. No automatic retry was made.'],
    RESPONSE_INVALID: ['服务未返回可用的 Claude 回答，请稍后重试。', 'The service did not return a usable Claude answer.'],
  };
  const entry = copy[code as keyof typeof copy];
  return entry ? entry[zh ? 0 : 1] : zh ? '文本调用未完成，未自动重试。请稍后检查服务或额度。' : 'The text request failed without retrying. Check the service or allowance later.';
}
