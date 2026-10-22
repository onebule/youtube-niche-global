// Limits mirrored from the original site's generation preflight contract.
// The original backend remains authoritative for account and provider readiness.
const limits={
 'seedance-2':{min:5,max:15,resolutions:['480p','720p','1080p']},
 'seedance-2-5':{min:4,max:30,resolutions:['480p','720p','1080p']},
 'minimax-h3':{min:4,max:15,resolutions:['768P','2K']},
 'kling-3':{min:3,max:15,resolutions:['720p','1080p','4K']},
 'veo-3.1-lite':{min:8,max:8,resolutions:['720p','1080p','4K']},
};
export function modelOptions(kind,model){if(kind==='image')return {sizes:model?.sizes?.length?model.sizes:['16:9','9:16','1:1'],resolutions:model?.resolutions?.length?model.resolutions:['1k','2k'],maxPrompt:12000};return {...limits[model?.id],sizes:['16:9','9:16','1:1'],maxPrompt:1200}}
export function validateGeneration(kind,input,model){if(!model?.enabled)throw Error('请选择已就绪的模型。');const c=modelOptions(kind,model);if(!input.prompt?.trim())throw Error('请先填写提示词。');if(input.prompt.length>c.maxPrompt)throw Error(`提示词不能超过 ${c.maxPrompt} 个字符。`);if(!c.resolutions?.includes(input.resolution))throw Error('此模型不支持所选分辨率。');if(!c.sizes.includes(input.size||input.aspectRatio))throw Error('此模型不支持所选画幅。');if(kind==='video'){const seconds=Number(input.duration);if(!Number.isInteger(seconds)||seconds<c.min||seconds>c.max)throw Error(`此模型时长须为 ${c.min}–${c.max} 秒的整数。`)}return c}
