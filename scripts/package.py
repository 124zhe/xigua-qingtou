from pathlib import Path
import json, zipfile, hashlib, subprocess
root=Path(__file__).resolve().parent.parent
subprocess.run(['node',str(root/'scripts/check.mjs')],check=True,cwd=root)
version=json.loads((root/'extension/manifest.json').read_text(encoding='utf-8'))['version']
files=sorted(p for p in (root/'extension').rglob('*') if p.is_file())
files += [root/n for n in ['README.md','LICENSE','THIRD_PARTY_NOTICES.md']]
files += sorted(p for p in (root/'docs').rglob('*.md'))
destination=root/'dist';destination.mkdir(exist_ok=True)
archive=destination/f'xigua-qingtou-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in files:z.write(file,Path('xigua-qingtou')/file.relative_to(root))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for file in files:assert hashlib.sha256(z.read((Path('xigua-qingtou')/file.relative_to(root)).as_posix())).digest()==hashlib.sha256(file.read_bytes()).digest()
print(json.dumps({'archive':archive.name,'files':len(files),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
