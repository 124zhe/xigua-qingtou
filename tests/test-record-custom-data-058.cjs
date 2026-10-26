const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
globalThis.crypto??=require('node:crypto').webcrypto;
const root=path.resolve(__dirname,'..'),extension=path.join(root,'extension'),out=path.join(root,'.test-results/record-custom-data-058');
fs.mkdirSync(out,{recursive:true});
for(const name of ['common.js','matcher.js','resume-parser.js'])require(path.join(extension,name));
const checks=[],pass=name=>{checks.push(name);console.log('PASS',name);};
const clone=value=>structuredClone(value),groups=['educations','experiences','projects'];
const fields=profile=>groups.flatMap(group=>profile[group].flatMap(row=>row.customFields));
const item=(id,label,value,aliases=[])=>({id,label,value,aliases});
const fresh=()=>{const p=QT.fresh();for(const group of groups)p[group]=[];return p;};
const row=(group,name,customFields=[])=>({...({educations:QT.blankEducation,experiences:QT.blankExperience,projects:QT.blankProject}[group])(),[group==='educations'?'school':group==='experiences'?'company':'name']:name,customFields});
const report=extra=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.length,checks,scope:'Pure Node tests of product sanitization, record-scoped matching and resume merging; fictional data, no browser, network, profile storage or application submission',...extra},null,2));
try{
  const legacy=QT.sample();for(const group of groups)for(const entry of legacy[group])delete entry.customFields;
  const migrated=QT.sanitize(legacy);assert.ok(groups.every(group=>migrated[group].every(entry=>Array.isArray(entry.customFields)&&entry.customFields.length===0)));assert.equal(migrated.educations[0].school,legacy.educations[0].school);assert.deepEqual(QT.sanitize(migrated),migrated);
  pass('Legacy records acquire empty arrays without changing their scalar data, and sanitization is idempotent');

  for(const factory of [QT.blankEducation,QT.blankExperience,QT.blankProject]){const a=factory(),b=factory();a.customFields.push(item('qisolated','虚构字段','值'));assert.deepEqual(b.customFields,[]);}
  assert.ok(groups.every(group=>QT.sample()[group].every(entry=>Array.isArray(entry.customFields))));
  pass('Factories and raw samples provide independent arrays instead of shared custom-field state');

  const original=fresh();for(const [i,group] of groups.entries())original[group]=[row(group,'虚构记录甲',[item('q'+group+'first','记录说明','第一段内容'+i,['说明别名'])]),row(group,'虚构记录乙',[item('q'+group+'second','记录说明','第二段内容'+i,['说明别名'])])];
  original.custom=[{label:'记录说明',value:'全局内容',aliases:['说明别名']}];
  const sanitized=QT.sanitize(original),roundtrip=QT.sanitize(JSON.parse(JSON.stringify(sanitized)));assert.deepEqual(roundtrip,sanitized);assert.deepEqual(fields(roundtrip).map(field=>field.id),fields(original).map(field=>field.id));
  pass('Backup JSON round-trips all three record kinds with stable IDs, aliases and distinct per-record values');

  for(const group of groups){assert.equal(QTMatch.recordCustomMatch(roundtrip,group,0,'说明别名').value,roundtrip[group][0].customFields[0].value);assert.equal(QTMatch.recordCustomMatch(roundtrip,group,1,'记录说明').value,roundtrip[group][1].customFields[0].value);assert.equal(QTMatch.recordCustomMatch(roundtrip,group,2,'记录说明').value,'');}
  assert.equal(QTMatch.recordCustomMatch(roundtrip,'basic',0,'记录说明').value,'');assert.equal(QTMatch.customMatch({...roundtrip,custom:[]},'记录说明').value,'');assert.equal(QTMatch.customMatch(roundtrip,'记录说明').value,'全局内容');
  pass('Record aliases resolve only within the requested kind and index and never enter global custom answers');

  const malformed=fresh();malformed.educations=[row('educations','虚构重复甲',[item('qduplicate','甲','A'),item('qduplicate','乙','B'),item('bad-id','丙','C'),item('q'+'x'.repeat(65),'丁','D')])];malformed.projects=[row('projects','虚构重复乙',[item('qduplicate','戊','E')])];
  const repaired=QT.sanitize(malformed),ids=fields(repaired).map(field=>field.id);assert.equal(ids[0],'qduplicate');assert.equal(new Set(ids).size,ids.length);assert.ok(ids.every(id=>/^q[a-z0-9_-]{1,64}$/i.test(id)));assert.deepEqual(QT.sanitize(repaired),repaired);assert.deepEqual(fields(repaired).map(field=>field.value),['A','B','C','D','E']);
  pass('Duplicate or malformed IDs are repaired across the whole profile once without losing values');

  const capped=QT.sanitizeRecordFields(Array.from({length:27},(_,i)=>item('qcap'+i,'标'.repeat(150),'内'.repeat(21000),[' 别名 ','别名',null,23,{},...Array.from({length:35},(_,j)=>'别名'+j+'长'.repeat(120))])));
  assert.equal(capped.length,25);assert.equal(capped[0].label.length,100);assert.equal(capped[0].value.length,20000);assert.equal(capped[0].aliases.length,30);assert.equal(capped[0].aliases[0],'别名');assert.ok(capped[0].aliases.every(alias=>typeof alias==='string'&&alias.length<=100));assert.equal(new Set(capped[0].aliases).size,30);
  pass('Field, name, value and alias limits are enforced with trimmed deduplicated string aliases');

  for(const raw of [null,undefined,'[object Object]',42,{}])assert.deepEqual(QT.sanitizeRecordFields(raw),[]);
  const odd=QT.sanitizeRecordFields([null,{},'wrong',item('qsafe',{bad:1},['bad'],{bad:1})]);assert.equal(odd.length,4);assert.ok(odd.every(field=>field.label===''&&field.value===''&&Array.isArray(field.aliases)&&!field.aliases.length));
  const safeJson=JSON.parse('{"schemaVersion":1,"educations":[{"school":"虚构JSON学校","customFields":[{"id":"__proto__","label":"<img src=x onerror=alert(1)>","value":"</textarea><script>bad()</script>","aliases":["<b>别名</b>"],"__proto__":{"polluted":true}}]}]}');
  const safe=QT.sanitize(safeJson);assert.equal({}.polluted,undefined);assert.equal(safe.educations[0].customFields[0].label,'<img src=x onerror=alert(1)>');assert.equal(safe.educations[0].customFields[0].value,'</textarea><script>bad()</script>');assert.ok(/^q/.test(safe.educations[0].customFields[0].id));
  pass('Malformed arrays and values stay typed safely; hostile text is retained as data without prototype mutation');

  const deleted=clone(roundtrip),untouched=clone(deleted.experiences);deleted.educations[0].customFields.splice(0,1);const afterDelete=QT.sanitize(deleted);assert.deepEqual(afterDelete.educations[0].customFields,[]);assert.deepEqual(afterDelete.educations[1],roundtrip.educations[1]);assert.deepEqual(afterDelete.experiences,untouched);assert.deepEqual(afterDelete.custom,roundtrip.custom);
  pass('Removing a field from one record leaves all other records and global answers unchanged');

  for(const group of groups){
    const current=fresh(),draft=fresh();current[group]=[row(group,'虚构合并甲',[item('q'+group+'kept','项目内备注','已确认内容',['旧别名']),item('q'+group+'blank','其他说明','')]),row(group,'虚构合并乙',[item('q'+group+'other','项目内备注','另一段内容')])];current.custom=[{label:'项目内备注',value:'全局不同内容',aliases:[]}];
    draft[group]=[row(group,'虚构合并甲',[item('q'+group+'incoming','项目内备注','新来源内容',['新别名']),item('q'+group+'blankincoming','其他说明','补齐内容'),item('q'+group+'new','附加指标','新字段内容',['指标别名'])])];
    const before=JSON.stringify(current),draftBefore=JSON.stringify(draft),kept=QTResume.merge(current,draft).profile,list=kept[group][0].customFields;
    assert.equal(list.find(field=>field.label==='项目内备注').id,'q'+group+'kept');assert.equal(list.find(field=>field.label==='项目内备注').value,'已确认内容');assert.deepEqual(list.find(field=>field.label==='项目内备注').aliases,['旧别名','新别名']);assert.equal(list.find(field=>field.label==='其他说明').value,'补齐内容');assert.equal(list.find(field=>field.label==='附加指标').value,'新字段内容');assert.deepEqual(kept[group][1],QT.sanitize(current)[group][1]);assert.deepEqual(kept.custom,current.custom);assert.equal(JSON.stringify(current),before);assert.equal(JSON.stringify(draft),draftBefore);
    pass(group+': merge preserves confirmed values and IDs, fills blanks and adds fields only to the matching record');
    const overwritten=QTResume.merge(current,draft,{overwrite:true}).profile;assert.equal(overwritten[group][0].customFields.find(field=>field.label==='项目内备注').value,'新来源内容');assert.equal(overwritten[group][0].customFields.find(field=>field.label==='项目内备注').id,'q'+group+'kept');assert.deepEqual(overwritten[group][1],QT.sanitize(current)[group][1]);assert.deepEqual(overwritten.custom,current.custom);
    pass(group+': explicit overwrite changes the matched field value while preserving identity and unrelated records');
    const skipped=QTResume.merge(current,draft,{rows:{educations:[],experiences:[],projects:[]}}).profile;assert.deepEqual(skipped,QT.sanitize(current));
    pass(group+': unselected record imports leave all record custom fields unchanged');
    for(const [label,value,aliases] of [['仅有名称','',[]],['','只有值',[]],['','',['只有别名']]]){const occupied=fresh(),incoming=fresh();occupied[group]=[row(group,'',[item('qcustomonly',label,value,aliases)])];incoming[group]=[row(group,'虚构新增记录',[item('qnewimport','新字段','新内容')])];const merged=QTResume.merge(occupied,incoming).profile;assert.equal(merged[group].length,2);assert.deepEqual(merged[group][0],QT.sanitize(occupied)[group][0]);assert.equal(merged[group][1].customFields[0].value,'新内容');}
    pass(group+': rows containing only a custom label, value or alias are not consumed as empty placeholders');
    const empty=fresh(),incoming=fresh();empty[group]=[row(group,'')];incoming[group]=[row(group,'虚构占位复用',[item('qplaceholder','保留字段','内容')])];const merged=QTResume.merge(empty,incoming).profile;assert.equal(merged[group].length,1);assert.equal(merged[group][0].customFields[0].value,'内容');assert.ok(Array.isArray(merged[group][0].customFields));
    pass(group+': a genuinely blank row is reused without turning the custom array into text');
  }

  const full=fresh(),extra=fresh();full.educations=[row('educations','虚构容量学校',Array.from({length:25},(_,i)=>item('qexisting'+i,'字段'+i,'值'+i)))];extra.educations=[row('educations','虚构容量学校',[item('qoverflow','新增第26项','值')])];const fullBefore=JSON.stringify(full);assert.throws(()=>QTResume.merge(full,extra),/25/);assert.equal(JSON.stringify(full),fullBefore);
  pass('Import exceeding a record field limit fails atomically without removing existing fields');

  const ambiguous=fresh(),update=fresh();ambiguous.projects=[row('projects','虚构同名字段项目',[item('qfirstduplicate','任务指标','甲值'),item('qsecondduplicate','任务指标','乙值')])];update.projects=[row('projects','虚构同名字段项目',[item('qnewduplicate','任务指标','新值')])];const beforeAmbiguous=JSON.stringify(ambiguous);assert.throws(()=>QTResume.merge(ambiguous,update),/多个同名自定义字段/);assert.equal(JSON.stringify(ambiguous),beforeAmbiguous);
  pass('Ambiguous same-record duplicate fields reject import instead of silently replacing one answer');
  report();console.log('TOTAL',checks.length);
}catch(error){report({error:error.stack});throw error;}
