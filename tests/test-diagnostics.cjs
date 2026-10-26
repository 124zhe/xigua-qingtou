'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../extension/diagnostics.js');
const checks=[],check=(name,fn)=>{fn();checks.push(name);};
const seeds=['隐私假名_张稻谷_7F53','13987654321','440101199001018765','private-canary-982@example.invalid','https://example.invalid/apply?resumeid=TOKEN_51C2','私密自定义问题_C0F3','DOM_PRIVATE_ID_9502','ATTR_PRIVATE_7409'];
const all=seeds.join(' / '),record={name:all,outerHTML:all,toJSON(){throw new Error(all);}},root={classList:{contains:name=>name==='ant-select-disabled'},id:all};
let readForbidden=0,toJSONCalls=0;
const el={tagName:'INPUT',type:'text',readOnly:true,disabled:false,id:seeds[6],name:all,value:seeds[0],placeholder:all,ariaLabel:all,getAttribute:key=>key==='aria-disabled'?'false':all,toJSON(){toJSONCalls++;return all;}};
for(const key of ['outerHTML','innerHTML','textContent'])Object.defineProperty(el,key,{get(){readForbidden++;throw new Error(all);}});
const descriptors=[
  {el,key:'basic.documentNumber',kind:'basic',index:0,value:seeds[2],existing:seeds[1],source:all,label:all,reason:all,profile:{secret:all},state:'ready',toJSON(){toJSONCalls++;return all;}},
  {el:{...el},key:'projects.name',kind:'projects',index:1,value:seeds[0],label:all,recordInfo:{record,kind:'projects',index:0,title:all},state:'ready'},
  {el:{...el},key:'projects.startDate',kind:'projects',index:1,value:'2020-01',reason:all,recordInfo:{record,kind:'projects',index:0,title:all},state:'precision',dateNeedsDay:true},
  {el:{...el},key:'projects.startDate',kind:'projects',index:1,value:'2020-01',recordInfo:{record,kind:'projects',index:0,title:all},state:'ready'},
  {el:{...el,tagName:'PRIVATE-'+seeds[6],type:seeds[1]},key:all,kind:all,index:13987654321,value:all,label:all,reason:all,state:all}
];
const engine={control:()=>({type:'select',library:'ant',root,multiple:false}),invalid:()=>false};
const report=D.build({descriptors,version:'0.5.0',installedVersion:'0.4.5',engine,stateOf:d=>d.state}),json=D.serialize(report);
check('Planted names phones IDs email URL tokens custom labels and attributes never enter JSON',()=>{for(const seed of seeds)assert.equal(json.includes(seed),false,seed);});
check('Only the fixed top-level structure is serialized',()=>assert.deepEqual(Object.keys(report),['schema','version','installedVersion','counts','records','fields']));
check('Known schema keys get fixed titles while unknown keys and labels are replaced',()=>{assert.equal(report.fields[0].label,'证件号码');assert.equal(report.fields[4].key,null);assert.equal(report.fields[4].label,'未识别字段 1');assert.equal(report.fields[4].section,'unknown');});
check('Row positions and bounded source indices remain useful without their text',()=>{assert.equal(report.fields[1].position,2);assert.equal(report.fields[1].profileIndex,1);assert.equal(report.fields[4].profileIndex,null);assert.equal(report.fields[2].record.rowIndex,0);});
check('Object identity yields anonymous record and repeated-field counts',()=>{assert.equal(report.counts.records,1);assert.equal(report.records[0].fieldCount,3);assert.equal(report.records[0].repeatedFieldCount,1);assert.equal(report.fields[2].record.sameKeyCount,2);});
check('Control tag type and library use fixed enums with readonly and disabled flags',()=>{assert.equal(report.fields[0].control.tag,'INPUT');assert.equal(report.fields[0].control.readonly,true);assert.equal(report.fields[0].control.disabled,true);assert.equal(report.fields[4].control.tag,'UNKNOWN');assert.equal(report.fields[4].control.type,'other');});
check('Issue codes and next actions are fixed, not descriptor reasons',()=>{assert.deepEqual(report.fields[2].issues,[{code:'EXACT_DATE_REQUIRED',nextStep:'请补充具体到日的真实日期。'}]);assert.equal(json.includes('2020-01'),false);});
check('No forbidden DOM property or descriptor toJSON is read',()=>{assert.equal(readForbidden,0);assert.equal(toJSONCalls,0);});
check('The completed report retains no references to descriptors or DOM',()=>{descriptors[0].label=all+'changed';el.value='changed-'+all;record.name='changed-'+all;assert.equal(D.serialize(report),json);});
check('Frozen reports reject later arbitrary data injection',()=>{assert.throws(()=>{report.fields[0].label=all;},TypeError);assert.throws(()=>{report.fields.push({label:all});},TypeError);assert.throws(()=>{report.counts.byState.ready=999;},TypeError);});
check('Serialization refuses arbitrary objects, clones and their toJSON functions',()=>{for(const value of [{schema:'qingtou.diagnostics.v1',secret:all,toJSON(){toJSONCalls++;return all;}},JSON.parse(json),all,null])assert.throws(()=>D.serialize(value),/重新生成/);assert.equal(toJSONCalls,0);});
check('Version strings are bounded and reject secrets, object coercion and excessive segments',()=>{for(const value of [all,'0.5.0-'+seeds[1],new String('0.5.0'),'65536.0.0','1.2.3.4.5',13987654321])assert.equal(D.build({version:value,installedVersion:value}).version,'unknown');assert.equal(D.build({version:'65535.0.0.1'}).version,'65535.0.0.1');});
check('Inherited object keys never become canonical schema keys',()=>{for(const key of ['__proto__','constructor','toString'])assert.equal(D.build({descriptors:[{key,el}]}).fields[0].key,null);});
check('Callbacks and property getters may fail without exporting their exception details',()=>{const d={el};Object.defineProperty(d,'key',{get(){throw new Error(all);}});const r=D.build({descriptors:[d],engine:{control(){throw new Error(all);},invalid(){throw new Error(all);}},stateOf(){throw new Error(all);}});assert.equal(r.fields[0].key,null);assert.equal(D.serialize(r).includes(all),false);});
check('Unexpected library state and section text are reduced to fixed unknown enums',()=>{const r=D.build({descriptors:[{el,kind:all}],engine:{control:()=>({type:all,library:all})},stateOf:()=>all});assert.equal(r.fields[0].control.library,'unknown');assert.equal(r.fields[0].control.kind,'unknown');assert.equal(r.fields[0].state,'unknown');assert.equal(r.fields[0].section,'unknown');});
check('Supported compound month pickers retain their fixed diagnostic type without labels or dates',()=>{const r=D.build({descriptors:[{el,label:all,value:'2027-06',key:'projects.endDate'}],engine:{control:()=>({type:'date',library:'ant3-month'})}});assert.equal(r.fields[0].control.library,'ant3-month');assert.equal(r.fields[0].control.kind,'date');assert.equal(D.serialize(r).includes('2027-06'),false);assert.equal(D.serialize(r).includes(all),false);});
check('Recognized but unsupported date ranges stay distinguishable from unknown controls',()=>{const r=D.build({descriptors:[{el,locked:true}],engine:{control:()=>({type:'unsupported-date',library:'ud-range'})}});assert.equal(r.fields[0].control.library,'ud-range');assert.equal(r.fields[0].control.kind,'unsupported-date');assert.equal(r.fields[0].state,'manual');});
check('Large forms are capped without leaking an unbounded original count',()=>{const r=D.build({descriptors:Array.from({length:2003},()=>({key:'basic.name',el}))});assert.equal(r.counts.fields,2000);assert.equal(r.counts.truncated,true);assert.equal(r.fields.length,2000);assert.equal(Object.hasOwn(r.counts,'originalCount'),false);});
check('Inherited website toJSON cannot replace the report during serialization',()=>{const context={module:{exports:{}},exports:{}};vm.createContext(context);vm.runInContext('Object.prototype.toJSON=function(){return "PROTO_PRIVATE_SEED"};Array.prototype.toJSON=function(){return "PROTO_PRIVATE_SEED"}',context);vm.runInContext(fs.readFileSync('extension/diagnostics.js','utf8'),context);const local=context.module.exports;assert.equal(local.serialize(local.build({version:'0.5.0'})).includes('PROTO_PRIVATE_SEED'),false);});
check('Download is unavailable in Node and never falls back to networking',()=>assert.throws(()=>D.download(report),/暂时无法下载/));
fs.mkdirSync('.test-results/diagnostics-test',{recursive:true});fs.writeFileSync('.test-results/diagnostics-test/unit-report.json',JSON.stringify({passed:checks.length,checks,scope:'Synthetic privacy canaries only; no personal data or network'},null,2));
console.log('PASS diagnostics privacy:',checks.length,'checks');
