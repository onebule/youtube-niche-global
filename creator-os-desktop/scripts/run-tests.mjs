import {spawn} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const child=spawn(process.execPath,['--test','research.test.mjs','library.test.mjs','server.test.mjs','workflow.test.mjs','compose.test.mjs','frontend.test.mjs','generation-config.test.mjs','backups.test.mjs','launcher.test.mjs','installer.test.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,PATH:path.join(root,'tools')+path.delimiter+(process.env.PATH||'')}});
child.on('error',e=>{console.error(e.message);process.exitCode=1});child.on('exit',code=>process.exitCode=code??1);
