import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const name of fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.cjs')).sort()){
  console.log('TEST',name);execFileSync(process.execPath,[path.join(root,'tests',name)],{cwd:root,stdio:'inherit',windowsHide:true});
}
console.log('All public offline suites passed. Browser integration is a separate validation scope.');
