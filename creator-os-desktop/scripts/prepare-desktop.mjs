import {mkdir,copyFile,cp,readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist=path.join(root,'node_modules','@tabler','icons-webfont','dist');
await mkdir(path.join(root,'vendor'),{recursive:true});
await copyFile(path.join(dist,'tabler-icons.min.css'),path.join(root,'vendor','tabler-icons.min.css'));
await cp(path.join(dist,'fonts'),path.join(root,'vendor','fonts'),{recursive:true});
console.log('Desktop assets prepared locally.');

const require=createRequire(import.meta.url);
await mkdir(path.join(root,'tools'),{recursive:true});
for(const [name,source] of [['ffmpeg',require('ffmpeg-static')],['ffprobe',require('@ffprobe-installer/ffprobe').path]]){await copyFile(source,path.join(root,'tools',name+(process.platform==='win32'?'.exe':'')))}
console.log('Bundled local video tools for '+process.platform+'/'+process.arch);

const ffmpegDir=path.join(root,'node_modules','ffmpeg-static');
for(const [suffix,dest] of [['LICENSE','FFmpeg-LICENSE.txt'],['README','FFmpeg-BUILD.txt']]){try{await copyFile(path.join(ffmpegDir,'ffmpeg'+(process.platform==='win32'?'.exe':'')+'.'+suffix),path.join(root,'tools',dest))}catch{}}
await writeFile(path.join(root,'tools','THIRD-PARTY.txt'),'Video tools run as separate local executables.\nFFmpeg static distribution: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1\nSource and build scripts: https://github.com/eugeneware/ffmpeg-static/tree/b6.1.1\nFFprobe distribution and source/build links: https://github.com/descriptinc/ffprobe-static\nFFprobe installer metadata: https://www.npmjs.com/package/@ffprobe-installer/ffprobe\nSee the accompanying FFmpeg LICENSE and build notes.\n');
