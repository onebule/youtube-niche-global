import {spawn} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';import {access} from 'node:fs/promises';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const executable=process.platform==='win32'?path.join(root,'desktop-dist','win-unpacked','Creator OS.exe'):path.join(root,'desktop-dist',process.arch==='arm64'?'mac-arm64':'mac','Creator OS.app','Contents','MacOS','Creator OS');
await access(executable);
const child=spawn(executable,['--smoke-test','--disable-gpu'],{stdio:'inherit'});
const timeout=setTimeout(()=>{child.kill();console.error('Packaged desktop startup timed out.');process.exitCode=1},90000);
child.on('error',e=>{clearTimeout(timeout);console.error(e.message);process.exitCode=1});child.on('exit',code=>{clearTimeout(timeout);process.exitCode=code??1});
