import {readFile,writeFile,stat} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {createHash} from 'node:crypto';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));const directory=path.resolve(process.argv[2]||'release');const repository='onebule/youtube-niche-global';const tag='creator-os-v'+version;
const notes=`Creator OS ${version}\n\n新增软件在线更新：启动时检查正式版本，手动下载、显示进度，下载后及安装前校验 SHA-256。Windows 可备份后退出并安装；Mac 未签名，先支持应用内下载并打开 DMG，手动覆盖安装。\n\n首次使用更新功能需安装本版本。更新保留本机数据，并在安装前自动保存磁盘备份。原有图片视频生成、资源库和热点功能继续可用。\n\n安装包尚未签名/公证，系统可能提示未验证发布者。跨版本安装仍建议先自行备份。`;
const assets={};const files=[];const hashes=[];
for(const [platform,arch,os,extension] of [['win32','x64','win','exe'],['darwin','arm64','mac','dmg'],['darwin','x64','mac','dmg']]){const name=`Creator-OS-${version}-${os}-${arch}.${extension}`,file=path.join(directory,name);const info=await stat(file);if(!info.isFile()||info.size<1000000)throw Error('缺少有效安装包：'+name);const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);const sha256=hash.digest('hex');assets[platform+'-'+arch]={url:`https://github.com/${repository}/releases/download/${tag}/${name}`,size:info.size,sha256};hashes.push(sha256+'  '+name);files.push(file)}
const manifest={schema:1,version,releasedAt:new Date().toISOString(),notes,assets};const manifestFile=path.join(directory,'creator-update.json');await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');const hashFile=path.join(directory,'SHA256SUMS.txt');await writeFile(hashFile,hashes.join('\n')+'\n');const notesFile=path.join(directory,'release-notes.txt');await writeFile(notesFile,notes);
function gh(args){const result=spawnSync('gh',args,{stdio:'inherit'});if(result.status!==0)throw Error('发布命令失败：'+args.slice(0,2).join(' '))}
if(process.argv.includes('--manifest-only')){console.log('Verified manifests prepared for '+tag);process.exit(0)}
if(!process.env.GITHUB_SHA)throw Error('发布必须从已验证的 CI 构建执行');
gh(['release','create',tag,'--repo',repository,'--target',process.env.GITHUB_SHA,'--title','Creator OS '+version,'--draft','--notes-file',notesFile]);
gh(['release','upload',tag,'--repo',repository,...files,manifestFile,hashFile]);
gh(['release','edit',tag,'--repo',repository,'--draft=false','--latest']);
console.log('Published '+tag);
