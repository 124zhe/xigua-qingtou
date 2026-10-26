(function(){
  'use strict';
  // Keep this module independent of profile/storage, page text and URLs.
  // Every exported string is a constant, a checked version or an ordinal.
  const MAX_FIELDS=2000,FILE_NAME='qingtou-diagnostics.json',reports=new WeakSet();
  const titles=Object.create(null);
  const add=(group,fields)=>{for(const [key,label] of Object.entries(fields))titles[group+'.'+key]=label;};
  add('basic',{name:'姓名',phone:'手机号',email:'邮箱',city:'现居住地',gender:'性别',nationality:'国籍',birthDate:'出生日期',birthMonth:'出生年月',ethnicity:'民族',nativePlace:'籍贯',studentOrigin:'生源地',politicalStatus:'政治面貌',english:'英语水平',cet4Score:'四级成绩',cet6Score:'六级成绩',honors:'奖励荣誉',patents:'专利情况',website:'个人网站',skills:'技能',introduction:'自我介绍',desiredRole:'意向岗位',desiredCity:'意向城市',documentType:'证件类型',documentNumber:'证件号码',emergencyName:'紧急联系人姓名',emergencyPhone:'紧急联系电话',emergencyRelation:'与紧急联系人关系'});
  add('educations',{school:'学校名称',college:'学院或系',major:'专业',education:'学历',degree:'学位',studyMode:'教育类型',degreeCategory:'学位分类',studyLength:'学制',schoolRegion:'学校所在国家或地区',startDate:'入学日期',endDate:'毕业日期',gpa:'绩点',courses:'核心课程',gradeRank:'成绩排名',laboratory:'实验室',researchField:'研究方向',supervisor:'导师'});
  add('experiences',{company:'公司或单位',department:'任职部门',role:'职位',startDate:'开始日期',endDate:'结束日期',description:'工作内容',experienceType:'经历类型',sourceSection:'经历来源栏目'});
  add('projects',{name:'项目名称',role:'项目角色',startDate:'项目开始日期',endDate:'项目结束日期',description:'项目内容'});
  Object.assign(titles,{custom:'自定义问答',recordCustom:'经历自定义字段',modules:'自定义模块',attachment:'简历附件'});Object.freeze(titles);
  const states=new Set(['ready','record','conflict','precision','missing','failed','filled','kept','skip','manual','unknown','attachment']);
  const sections=new Set(['basic','educations','experiences','projects','emergency','sensitive','modules']);
  const recordKinds=new Set(['educations','experiences','projects','modules']);
  const tags=new Set(['INPUT','TEXTAREA','SELECT','DIV','SPAN','BUTTON','A']);
  const inputTypes=new Set(['text','search','tel','email','url','number','password','date','month','week','time','datetime-local','checkbox','radio','file','hidden','button','submit','reset','image','color','range','select-one','select-multiple','textarea']);
  const libraries=new Set(['native','ant-linked','jbs','element','autocomplete','ant3-date','ant3-month','ant3-tree','ant3-autocomplete','ant','aria','ud-range']);
  const controlKinds=new Set(['select','date','region','unsupported-date']);
  const steps=Object.freeze({
    UNRECOGNIZED_FIELD:'请在预览中选择对应资料，或补充这一项。',
    MISSING_PROFILE_DATA:'请先补充这一项资料，再更新预览。',
    RECORD_SELECTION_REQUIRED:'请为这一整段选择一条资料。',
    RECORD_NOT_DETECTED:'暂时没认出这一整段，请在网页上核对。',
    ANSWER_CONFLICT:'请确认应该使用哪条答案。',
    EXACT_DATE_REQUIRED:'请补充具体到日的真实日期。',
    WRITE_NOT_CONFIRMED:'网页没有确认填写结果，请重新识别并核对。',
    EXISTING_VALUE_PRESERVED:'网页已有内容，已保留。',
    NO_MATCHING_RECORD:'没有更多资料，这一段可以留空。',
    MANUAL_REVIEW:'请在网页上填写或核对这一项。',
    ATTACHMENT_CONFIRMATION:'如需上传附件，请先在预览中单独勾选。',
    CONTROL_CHANGED:'网页上的控件已变化，请重新识别。',
    MULTIPLE_SELECTION_MANUAL:'请在网页上确认多选内容。',
    WEBSITE_VALIDATION:'网页提示这一项需要检查，请核对后再试。'
  });
  const stateIssues=Object.freeze({unknown:'UNRECOGNIZED_FIELD',missing:'MISSING_PROFILE_DATA',record:'RECORD_SELECTION_REQUIRED',conflict:'ANSWER_CONFLICT',precision:'EXACT_DATE_REQUIRED',failed:'WRITE_NOT_CONFIRMED',kept:'EXISTING_VALUE_PRESERVED',skip:'NO_MATCHING_RECORD',manual:'MANUAL_REVIEW',attachment:'ATTACHMENT_CONFIRMATION'});
  const read=(object,key)=>{try{return object?.[key];}catch{return undefined;}};
  const bool=(object,key)=>read(object,key)===true;
  const object=value=>value!==null&&(typeof value==='object'||typeof value==='function');
  const ordinal=value=>Number.isInteger(value)&&value>=-1&&value<=99?value:null;
  function version(value){
    if(typeof value!=='string'||value.length>23||!/^\d{1,5}(?:\.\d{1,5}){2,3}$/.test(value))return 'unknown';
    return value.split('.').every(part=>Number(part)<=65535)?value:'unknown';
  }
  function attributeFlag(node,name){try{return node?.getAttribute?.(name)==='true';}catch{return false;}}
  function disabledFlag(node){
    if(bool(node,'disabled')||attributeFlag(node,'aria-disabled'))return true;
    try{return ['ant-select-disabled','is-disabled'].some(name=>node?.classList?.contains(name)===true);}catch{return false;}
  }
  function fallbackState(d){
    const outcome=read(d,'outcome');if(outcome==='filled'||outcome==='failed')return outcome;
    if(bool(d,'stale'))return 'failed';if(bool(d,'occupied'))return 'kept';if(bool(d,'dateNeedsDay'))return 'precision';if(bool(d,'locked'))return 'manual';
    if(bool(d,'answerConflict'))return 'conflict';if(bool(d,'noRecord')||bool(d,'skip'))return 'skip';if(read(d,'type')==='file')return 'attachment';
    // Only presence is used to infer status; the value never enters the report.
    const value=read(d,'value');if(typeof value==='string'&&value.length)return 'ready';
    if(bool(d,'needsRecord'))return 'record';return bool(d,'recognized')?'missing':'unknown';
  }
  function freeze(value){
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      for(const child of Object.values(value))freeze(child);
      // Prevent an inherited website/library toJSON from rewriting our report.
      Object.defineProperty(value,'toJSON',{value:undefined,enumerable:false});Object.freeze(value);
    }return value;
  }
  function build(options={}){
    const descriptors=read(options,'descriptors'),list=Array.isArray(descriptors)?descriptors:[],length=Math.min(list.length,MAX_FIELDS),engine=read(options,'engine'),stateOf=read(options,'stateOf');
    const rows=[],recordMap=new Map(),controlMap=new Map(),recordRows=[];let unknown=0;
    for(let index=0;index<length;index++){
      const d=read(list,index)||{},el=read(d,'el');let c=null;
      try{const control=read(engine,'control');if(typeof control==='function'&&object(el))c=control.call(engine,el);}catch{}
      const rawKey=read(d,'key'),key=typeof rawKey==='string'&&Object.hasOwn(titles,rawKey)?rawKey:null;
      let state;try{state=typeof stateOf==='function'?stateOf(d):undefined;}catch{}
      state=typeof state==='string'&&states.has(state)?state:fallbackState(d);
      const rawTag=read(el,'tagName'),tag=typeof rawTag==='string'&&tags.has(rawTag.toUpperCase())?rawTag.toUpperCase():'UNKNOWN';
      const rawType=read(el,'type')??read(d,'type'),type=typeof rawType==='string'&&inputTypes.has(rawType)?rawType:'other';
      const rawLibrary=read(c,'library'),library=c?(typeof rawLibrary==='string'&&libraries.has(rawLibrary)?rawLibrary:'unknown'):'native';
      const rawControlKind=read(c,'type'),kind=typeof rawControlKind==='string'&&controlKinds.has(rawControlKind)?rawControlKind:c?'unknown':'native';
      const rawSection=read(d,'kind'),section=typeof rawSection==='string'&&sections.has(rawSection)?rawSection:'unknown';
      const controlIdentity=object(read(c,'root'))?read(c,'root'):object(el)?el:null;
      if(controlIdentity&&!controlMap.has(controlIdentity))controlMap.set(controlIdentity,controlMap.size+1);
      const info=read(d,'recordInfo'),record=read(info,'record'),rawRecordKind=read(info,'kind'),recordKind=typeof rawRecordKind==='string'&&recordKinds.has(rawRecordKind)?rawRecordKind:'unknown';
      const detected=object(record)&&recordKind!=='unknown';
      if(detected&&!recordMap.has(record)){
        const data={group:recordMap.size+1,kind:recordKind,fieldCount:0,repeatedFieldCount:0};
        recordMap.set(record,{data,keys:new Map()});recordRows.push(data);
      }
      const group=detected?recordMap.get(record):null;if(group){group.data.fieldCount++;if(key)group.keys.set(key,(group.keys.get(key)||0)+1);}
      const readonly=bool(el,'readOnly')||attributeFlag(el,'aria-readonly'),disabled=disabledFlag(el)||disabledFlag(read(c,'root')),multiple=bool(el,'multiple')||bool(c,'multiple');
      let invalid=false;try{const check=read(engine,'invalid');if(typeof check==='function'&&object(el))invalid=check.call(engine,el)===true;}catch{}
      const codes=new Set();if(stateIssues[state])codes.add(stateIssues[state]);
      if(bool(d,'stale'))codes.add('CONTROL_CHANGED');if(bool(d,'answerConflict'))codes.add('ANSWER_CONFLICT');if(bool(d,'dateNeedsDay'))codes.add('EXACT_DATE_REQUIRED');
      if(bool(d,'needsRecord'))codes.add('RECORD_SELECTION_REQUIRED');if(multiple)codes.add('MULTIPLE_SELECTION_MANUAL');if(invalid)codes.add('WEBSITE_VALIDATION');
      if(!detected&&bool(d,'locked')&&key&&/^(educations|experiences|projects)\./.test(key))codes.add('RECORD_NOT_DETECTED');
      rows.push({position:index+1,key,label:key?titles[key]:'未识别字段 '+(++unknown),state,section,profileIndex:ordinal(read(d,'index')),control:{group:controlIdentity?controlMap.get(controlIdentity):null,tag,type,kind,library,readonly,disabled,multiple,invalid},record:{detected,group:group?group.data.group:null,kind:recordKind,rowIndex:ordinal(read(info,'index')),fieldCount:0,sameKeyCount:0},issues:[...codes].map(code=>({code,nextStep:steps[code]}))});
    }
    const groups=[...recordMap.values()];for(const group of groups)group.data.repeatedFieldCount=[...group.keys.values()].reduce((sum,count)=>sum+Math.max(0,count-1),0);
    for(const row of rows)if(row.record.group){const group=groups[row.record.group-1];row.record.fieldCount=group.data.fieldCount;row.record.sameKeyCount=row.key?group.keys.get(row.key)||0:0;}
    const byState={};for(const state of states)byState[state]=0;for(const row of rows)byState[row.state]++;
    const result=freeze({schema:'qingtou.diagnostics.v1',version:version(read(options,'version')),installedVersion:version(read(options,'installedVersion')),counts:{fields:rows.length,knownFields:rows.filter(row=>row.key!==null).length,unknownFields:unknown,records:recordRows.length,controls:controlMap.size,truncated:list.length>MAX_FIELDS,byState},records:recordRows,fields:rows});
    reports.add(result);return result;
  }
  function serialize(report){
    if(!object(report)||!reports.has(report))throw new TypeError('请重新生成脱敏诊断报告。');
    return JSON.stringify(report,null,2)+'\n';
  }
  function download(report){
    const json=serialize(report);
    if(typeof document==='undefined'||typeof Blob==='undefined'||typeof URL==='undefined'||typeof URL.createObjectURL!=='function')throw new Error('当前页面暂时无法下载诊断文件。');
    const blob=new Blob([json],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=FILE_NAME;link.hidden=true;
    try{(document.body||document.documentElement).append(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    return Object.freeze({fileName:FILE_NAME,fieldCount:report.counts.fields,recordCount:report.counts.records});
  }
  const api=Object.freeze({build,serialize,download});globalThis.QTDiagnostics=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
