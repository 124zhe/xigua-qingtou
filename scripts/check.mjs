import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),ext=path.join(root,'extension');
const manifest=JSON.parse(fs.readFileSync(path.join(ext,'manifest.json'),'utf8'));
for(const name of [manifest.action.default_popup,manifest.options_page,manifest.background.service_worker,...Object.values(manifest.icons)])assert.ok(fs.existsSync(path.join(ext,name)),name);
for(const name of fs.readdirSync(ext)){
  if(/\.(js|mjs)$/.test(name))execFileSync(process.execPath,['--check',path.join(ext,name)],{stdio:'pipe',windowsHide:true});
  if(name.endsWith('.html'))for(const match of fs.readFileSync(path.join(ext,name),'utf8').matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(/^(?:https?:|chrome:|edge:)/.test(match[1]))continue;
    assert.ok(fs.existsSync(path.join(ext,match[1].split(/[?#]/)[0])),name+': '+match[1]);
  }
}
for(const name of ['pdfjs/LICENSE','pdfjs/cmaps/LICENSE','pdfjs/standard_fonts/LICENSE_FOXIT','pdfjs/standard_fonts/LICENSE_LIBERATION','jszip/LICENSE.markdown','jszip/LICENSE_PAKO'])assert.ok(fs.existsSync(path.join(ext,'vendor',name)),name);
assert.deepEqual([...manifest.permissions].sort(),['activeTab','scripting','storage']);
assert.ok(!manifest.host_permissions?.length);
console.log('PASS resource references, product syntax, licenses and expected permissions:',manifest.version);
