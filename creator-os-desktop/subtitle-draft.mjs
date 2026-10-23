import {formatSRT} from './composition-options.mjs';
export function draftSubtitles(text,seconds){
 if(typeof text!=='string'||!text.trim()||text.length>20000)throw Error('字幕文案需为 1 至 20000 字');
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<1||seconds>7200)throw Error('总时长应为 1 至 7200 秒');
 if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))throw Error('文案包含不支持的控制字符');
 const sentences=text.trim().match(/[^。！？!?\n]+[。！？!?]?/gu)||[];
 const parts=sentences.flatMap(s=>{const chars=Array.from(s.trim());const chunks=[];while(chars.length)chunks.push(chars.splice(0,36).join(''));return chunks}).filter(Boolean);
 const total=Math.round(seconds*1000);if(!parts.length||parts.length>2000||total<parts.length*300)throw Error('字幕过密，请增加总时长或缩短文案');
 const weights=parts.map(p=>Array.from(p).length),sum=weights.reduce((a,b)=>a+b,0),extra=total-parts.length*300;let end=0,weight=0;
 const cues=parts.map((part,i)=>{const start=end;weight+=weights[i];end=(i+1)*300+Math.round(extra*weight/sum);return {start,end,text:part}});
 return {cues,srt:formatSRT(cues)};
}
