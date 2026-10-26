const assert=require('node:assert/strict');
const fs=require('node:fs');
const M=require('../extension/matcher.js');
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS',name);};
const order=rows=>M.educationOrder({educations:rows});
const rank=education=>M.educationRank({education});

check('Education rank and order helpers are available',()=>{assert.equal(typeof M.educationRank,'function');assert.equal(typeof M.educationOrder,'function');});
check('Known education levels increase from high school to doctorate',()=>{
  const ranks=['高中','专科','本科','硕士','博士'].map(rank);
  assert.ok(ranks.every(Number.isFinite));
  for(let i=1;i<ranks.length;i++)assert.ok(ranks[i]>ranks[i-1]);
});
check('High school and secondary vocational education share a default tier',()=>assert.equal(rank('中专'),rank('高中')));
for(const [label,canonical] of [['硕士研究生','硕士'],['博士研究生','博士'],['大学本科','本科'],['大学专科','专科'],['大专','专科']])check('Explicit education synonym: '+label,()=>assert.equal(rank(label),rank(canonical)));
for(const [degree,education] of [['学士','本科'],['硕士','硕士'],['博士','博士']])check('A clear degree supplies a missing education rank: '+degree,()=>assert.equal(M.educationRank({education:'',degree}),rank(education)));
check('An explicit education level remains primary when degree differs',()=>assert.equal(M.educationRank({education:'本科',degree:'硕士'}),rank('本科')));
check('Unknown or missing education cannot outrank a known school level',()=>{
  for(const row of [{},{education:''},{education:'其他'},{education:'研究经历'},{degree:'无学位'}])assert.ok(M.educationRank(row)<rank('高中'));
});
check('Default allocation returns original indices from low to high education',()=>{
  const rows=[{school:'硕士学校',education:'硕士'},{school:'本科学校',education:'本科'},{school:'博士学校',education:'博士'},{school:'高中学校',education:'高中'},{school:'专科学校',education:'专科'},{school:'中专学校',education:'中专'}];
  assert.deepEqual(order(rows),[3,5,4,1,0,2]);
});
check('Same education level uses earlier start dates first',()=>{
  const rows=[{education:'本科',startDate:'2020-09'},{education:'大学本科',startDate:'2016-09'},{education:'本科',startDate:'2018-03-01'}];
  assert.deepEqual(order(rows),[1,2,0]);
});
check('An earlier date never moves a higher education level before a lower one',()=>assert.deepEqual(order([{education:'硕士',startDate:'2015-09'},{education:'本科',startDate:'2020-09'}]),[1,0]));
check('Equal start dates preserve the original order',()=>assert.deepEqual(order([{education:'本科',startDate:'2020-09'},{education:'大学本科',startDate:'2020-09'},{education:'本科',startDate:'2020-09'}]),[0,1,2]));
check('Missing start dates preserve stable original order within a tier',()=>assert.deepEqual(order([{education:'本科'},{education:'大学本科',startDate:''},{education:'本科'}]),[0,1,2]));
check('Known dates sort before missing dates, whose relative order stays stable',()=>assert.deepEqual(order([{education:'本科',startDate:'2020-09'},{education:'本科'},{education:'本科',startDate:'2016-09'},{education:'本科',startDate:''}]),[2,0,1,3]));
check('Unknown education stays after all known levels, sorted by known start dates',()=>assert.deepEqual(order([{education:'其他',startDate:'2008-09'},{education:'硕士',startDate:'2020-09'},{education:'进修',startDate:'2005-09'},{education:'本科',startDate:'2016-09'}]),[3,1,2,0]));
check('Unknown education records with no dates retain stable order',()=>assert.deepEqual(order([{education:'其他'},{education:''},{education:'进修'}]),[0,1,2]));
check('Only supplied education records are returned; a missing high school is never invented',()=>{
  const rows=[{education:'硕士',school:'仅有硕士'},{education:'本科',school:'仅有本科'}];
  assert.deepEqual(order(rows),[1,0]);assert.equal(order(rows).length,rows.length);
});
check('Ordering never changes the profile array or stored row objects',()=>{
  const rows=[{school:'硕士学校',education:'硕士',startDate:'2024-09',endDate:'2027-06'},{school:'本科学校',education:'本科',startDate:'2020-09',endDate:'2024-06'}];
  const original=[...rows],before=JSON.stringify(rows),profile={educations:rows},result=M.educationOrder(profile);
  assert.equal(profile.educations,rows);assert.equal(rows[0],original[0]);assert.equal(rows[1],original[1]);assert.equal(JSON.stringify(rows),before);assert.deepEqual(result,[1,0]);
  assert.equal(new Set(result).size,rows.length);assert.ok(result.every(i=>Number.isInteger(i)&&i>=0&&i<rows.length));
});
check('Empty and absent education arrays produce no default records',()=>{assert.deepEqual(order([]),[]);assert.deepEqual(M.educationOrder({}),[]);});

fs.mkdirSync('.test-results/education-order-test',{recursive:true});
fs.writeFileSync('.test-results/education-order-test/unit-report.json',JSON.stringify({passed:checks.length,checks,scope:'Pure education rank and default original-index ordering; no storage rewrite or fabricated school records'},null,2));
console.log('PASS education order:',checks.length,'checks');
