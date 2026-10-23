import {draftSubtitles} from './subtitle-draft.mjs';
import {parseSRT,formatSRT} from './composition-options.mjs';
const $=id=>document.getElementById(id);let audio=null,url=null;
document.addEventListener('creator-speech-completed',e=>{audio=e.detail;$('subtitle-audio-duration').disabled=false});
document.addEventListener('creator-media-cleaned',()=>{audio=null;$('subtitle-audio-duration').disabled=true});
$('subtitle-copy-text').onclick=()=>{$('subtitle-draft-text').value=$('speech-text').value};
$('subtitle-audio-duration').onclick=()=>{if(audio)$('subtitle-duration').value=audio.duration.toFixed(3)};
$('subtitle-generate').onclick=()=>{try{const draft=draftSubtitles($('subtitle-draft-text').value,Number($('subtitle-duration').value));if($('subtitles').value.trim()&&!confirm('替换现有字幕时间轴？'))return;$('subtitles').value=draft.srt;$('subtitles').dispatchEvent(new Event('input'));$('subtitle-draft-status').textContent=`已生成 ${draft.cues.length} 条估算字幕，请试听并校准后导出。`}catch(e){$('subtitle-draft-status').textContent=e.message}};
$('subtitle-save').onclick=()=>{try{const cues=parseSRT($('subtitles').value);if(!cues.length)throw Error('请先生成或填写字幕');if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([formatSRT(cues)],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='subtitles.srt';a.click();$('subtitle-draft-status').textContent='已下载当前字幕，请保留并校准时间。'}catch(e){$('subtitle-draft-status').textContent=e.message}};
