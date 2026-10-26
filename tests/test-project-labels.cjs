const assert=require('node:assert/strict');
const fs=require('node:fs');
const M=require('../extension/matcher.js');
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS',name);};
const projects=['科研经历','研究经历','课题研究经历','Research Experience','科研项目','研究项目','科研项目经历','研究项目经历','项目经历','Project Experience'];

for(const title of projects)check('Explicit project or research section: '+title,()=>assert.equal(M.sectionKind(title),'projects'));
for(const title of ['论文发表','发表论文','科研成果','专利','专利情况','研究方向','科研机构','研究领域','Publications','Research Interests','Research Institute','Academic Achievements'])check('Research-related title is not a project section: '+title,()=>assert.notEqual(M.sectionKind(title),'projects'));

const fields=[['项目名称','projects.name'],['课题名称','projects.name'],['承担角色','projects.role'],['项目角色','projects.role'],['职责内容','projects.description'],['主要职责与业绩','projects.description'],['开始日期','projects.startDate'],['结束日期','projects.endDate'],['起始年月','projects.startDate'],['截止年月','projects.endDate']];
for(const [label,key] of fields)check('Project field meaning: '+label,()=>assert.equal(M.fieldKey(label,'projects').key,key));
check('The research section context supplies the same project field family',()=>{
  for(const title of ['科研经历','研究经历','课题研究经历','Research Experience'])for(const [label,key] of fields)assert.equal(M.fieldKey(label,M.sectionKind(title)).key,key,title+' / '+label);
});
for(const label of ['论文标题','论文发表','科研成果','专利','研究方向','科研机构'])check('Research-related fields do not become project data: '+label,()=>assert.ok(!M.fieldKey(label,'projects').key?.startsWith('projects.')));
for(const label of ['家庭成员科研项目名称','家庭成员承担角色','亲属科研经历','推荐人研究项目名称'])check('Other-person research labels remain manual: '+label,()=>{
  assert.equal(M.manualOnly(label),true);assert.equal(M.fieldKey(label,'projects').key,null);
});
check('Unscoped dates and generic roles do not acquire a project context',()=>{
  for(const label of ['开始日期','结束日期','角色','名称','内容'])assert.equal(M.fieldKey(label).key,null,label);
});
check('Research project context cannot receive employer, school or applicant fields as project data',()=>{
  for(const label of ['单位名称','学校名称','研究方向','手机号'])assert.ok(!M.fieldKey(label,'projects').key?.startsWith('projects.'),label);
});
check('Saved project values resolve independently of employment and education',()=>{
  const profile={basic:{name:'申请人示例'},projects:[{name:'科研课题示例',role:'研究助理',description:'课题职责示例',startDate:'2023-09',endDate:'2024-06'}],experiences:[{company:'实习单位示例',role:'实习岗位示例',description:'实习职责示例',startDate:'2024-07',endDate:'2024-08'}],educations:[{school:'学校示例',researchField:'研究方向示例',startDate:'2020-09',endDate:'2024-06'}]};
  assert.deepEqual(['name','role','description','startDate','endDate'].map(field=>M.resolve(profile,'projects.'+field,0)),['科研课题示例','研究助理','课题职责示例','2023-09','2024-06']);
});
check('Existing education and work section families remain separate',()=>{
  assert.equal(M.sectionKind('教育经历'),'educations');assert.equal(M.sectionKind('工作经历'),'experiences');assert.equal(M.sectionKind('实习经历'),'experiences');
});

const manifest=JSON.parse(fs.readFileSync('extension/manifest.json','utf8'));
fs.mkdirSync('.test-results/project-labels-test',{recursive:true});
fs.writeFileSync('.test-results/project-labels-test/unit-report.json',JSON.stringify({version:manifest.version,passed:checks.length,checks,scope:'Explicit project/research section and field semantics; keeps projects separate from papers, patents, research interests and other people'},null,2));
console.log('PASS project labels:',checks.length,'checks');
