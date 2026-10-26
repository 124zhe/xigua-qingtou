(function(){
  'use strict';
  const groups={educations:QT.blankEducation(),experiences:QT.blankExperience(),projects:QT.blankProject()};
  const extras=new Set(['english','cet4Score','cet6Score','skills','introduction','honors','patents']);
  function target(raw={}){
    if(!raw||typeof raw!=='object')raw={};
    const label=typeof raw.label==='string'?raw.label.slice(0,100):'';
    if(raw.key==='recordCustom'){
      const kind=typeof raw.kind==='string'&&Object.hasOwn(groups,raw.kind)?raw.kind:'';
      const index=Number.isInteger(raw.index)&&raw.index>=0&&raw.index<20?raw.index:null;
      const fieldId=typeof raw.fieldId==='string'&&/^q[a-z0-9_-]{1,64}$/i.test(raw.fieldId)?raw.fieldId:'';
      return {page:kind||'basic',recordCustom:true,kind,index,fieldId,label,path:''};
    }
    const [group,field]=String(raw.key||'').split('.');
    if(Object.hasOwn(groups,group)&&field==='customFields')return {page:group,path:'',label};
    if(group==='basic'&&Object.hasOwn(QT.fresh().basic,field))return {page:extras.has(field)?'extras':'basic',path:'basic.'+field,label};
    if(Object.hasOwn(groups,group)&&Object.hasOwn(groups[group],field)&&field!=='sourceSection'){
      const index=Number.isInteger(raw.index)&&raw.index>=0&&raw.index<20?raw.index:null;
      return {page:group,path:index===null?'':`${group}.${index}.${field}`,label,precision:raw.precision==='day'&&['startDate','endDate'].includes(field)?'day':''};
    }
    if(raw.key==='modules')return {page:'modules',moduleId:String(raw.moduleId||''),fieldId:String(raw.fieldId||''),index:Number.isInteger(raw.index)?raw.index:0,label,precision:raw.precision==='day'?'day':''};
    if(QTMatch.identityKey(label))return {page:'basic',path:'basic.'+QTMatch.identityKey(label),label};
    if(label&&!QTMatch.manualOnly(label))return {page:'extras',customLabel:label,label};
    return {page:'basic',label:''};
  }
  function url(base,raw,returnTab){
    const u=new URL(base),t=target(raw);u.hash=t.page;
    for(const [key,value] of Object.entries(raw||{}))if(['key','kind','index','moduleId','fieldId','label','precision'].includes(key)&&value!==undefined)u.searchParams.set('edit_'+key,String(value).slice(0,150));
    if(Number.isInteger(returnTab)&&returnTab>=0)u.searchParams.set('returnTab',String(returnTab));
    return u.href;
  }
  function read(search){
    const p=new URLSearchParams(search),raw={};
    for(const key of ['key','kind','moduleId','fieldId','label','precision'])if(p.has('edit_'+key))raw[key]=p.get('edit_'+key);
    if(p.has('edit_index'))raw.index=/^\d+$/.test(p.get('edit_index'))?Number(p.get('edit_index')):NaN;
    return raw;
  }
  globalThis.QTProfileNav={target,url,read};
})();
