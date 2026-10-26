(function () {
  'use strict';
  const blankEducation = () => ({ school: '', college: '', major: '', education: '', degree: '', studyMode: '', degreeCategory: '', studyLength: '', schoolRegion: '', startDate: '', endDate: '', gpa: '', courses: '', gradeRank: '', laboratory: '', researchField: '', supervisor: '', customFields: [] });
  const blankExperience = () => ({ company: '', department: '', role: '', startDate: '', endDate: '', description: '', experienceType: '', sourceSection: '', customFields: [] });
  const blankProject = () => ({ name: '', role: '', startDate: '', endDate: '', description: '', customFields: [] });
  const fresh = () => ({ schemaVersion: 1, basic: { name: '', phone: '', email: '', city: '', gender: '', nationality: '', birthDate: '', birthMonth: '', ethnicity: '', nativePlace: '', studentOrigin: '', politicalStatus: '', english: '', cet4Score: '', cet6Score: '', honors: '', patents: '', website: '', skills: '', introduction: '', desiredRole: '', desiredCity: '', documentType: '', documentNumber: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '' }, educations: [{ ...blankEducation(), endDate: '2027-06' }], experiences: [], projects: [], custom: [], modules: [], attachment: null });
  const sample = () => ({ schemaVersion: 1, basic: { name: '林示例', phone: '13800000000', email: 'lin@example.com', city: '上海', gender: '女', birthDate: '2004-03-12', politicalStatus: '共青团员', english: 'CET-6', website: 'https://example.com', skills: 'Python、SQL、Excel', introduction: '这是用于测试填写功能的虚构资料。', desiredRole: '数据分析', desiredCity: '上海' }, educations: [{ school: '示例大学', major: '统计学', education: '本科', degree: '学士', startDate: '2023-09', endDate: '2027-06', gpa: '3.6/4.0', customFields: [] }, { school: '示例学院', major: '数据科学', education: '本科', degree: '学士', startDate: '2025-02', endDate: '2025-07', gpa: '', customFields: [] }], experiences: [{ company: '示例科技有限公司', role: '数据分析实习生', startDate: '2026-06', endDate: '2026-08', description: '【虚构示例】整理业务数据，搭建周报并记录指标口径。', customFields: [] }], projects: [{ name: '校园问卷分析', role: '项目成员', startDate: '2025-10', endDate: '2025-12', description: '【虚构示例】完成问卷清洗、分析与结果展示。', customFields: [] }], custom: [], attachment: null });
  const text = x => typeof x === 'string' ? x.slice(0, 20000) : '';
  const newId = () => 'q' + crypto.randomUUID().replaceAll('-', '');
  const fieldTypes = { text:'短文本', textarea:'长文本', month:'年月', date:'完整日期', number:'数字', url:'链接', select:'单选' };
  const stringList = x => [...new Set((Array.isArray(x)?x:[]).map(v=>text(v).trim().slice(0,100)).filter(Boolean))].slice(0,30);
  function sanitizeRecordFields(raw,ids=new Set()) {
    return (Array.isArray(raw)?raw:[]).slice(0,25).map(field=>{
      let id=typeof field?.id==='string'&&/^q[a-z0-9_-]{1,64}$/i.test(field.id)&&!ids.has(field.id)?field.id:newId();
      while(ids.has(id))id=newId();ids.add(id);
      return {id,label:text(field?.label).slice(0,100),value:text(field?.value),aliases:stringList(field?.aliases)};
    });
  }
  const awardAliases=['奖励荣誉','获奖经历','获奖情况','奖励情况','荣誉奖项','个人荣誉','awards','honors'];
  const awardFields={name:['奖项名称','获奖名称','奖励名称','awardname'],date:['获奖时间','获奖日期','获得时间','获得日期','awardtime','awarddate'],description:['获奖说明','奖项描述','获奖描述','说明','awarddescription']};
  const awardNorm=s=>String(s||'').replace(/[\s:：]/g,'').toLowerCase();
  const isAwardModule=m=>[m.name,...(m.aliases||[])].some(n=>awardAliases.some(a=>awardNorm(a)===awardNorm(n)));
  const awardFieldKind=f=>Object.keys(awardFields).find(k=>[f.label,...(f.aliases||[])].some(n=>awardFields[k].some(a=>awardNorm(a)===awardNorm(n))));
  const awardTemplate={name:'奖励荣誉',aliases:awardAliases.slice(1),fields:[['奖项名称','text','获奖名称、奖励名称'],['奖项级别','select','获奖级别',['国家级','省市级','院校级','其他']],['获奖时间','month','获奖日期、获得时间、获得日期'],['颁奖单位','text','颁发机构'],['获奖说明','textarea','奖项描述、获奖描述、说明']]};
  function awardDate(value){
    const m=String(value||'').trim().match(/^((?:19|20)\d{2})[.年/\-](\d{1,2})(?:[.月/\-](\d{1,2})日?)?月?$/);if(!m)return '';
    const date=m[1]+'-'+m[2].padStart(2,'0')+(m[3]?'-'+m[3].padStart(2,'0'):''),parsed=new Date((m[3]?date:date+'-01')+'T00:00:00Z');
    return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,m[3]?10:7)===date?date:'';
  }
  function splitAwardList(line){
    const pairs={'（':'）','(':')','[':']','【':'】','《':'》','“':'”','「':'」','『':'』'},stack=[],parts=[];let start=0;
    for(let i=0;i<line.length;i++){
      const ch=line[i];if(pairs[ch])stack.push(pairs[ch]);else if(ch===stack.at(-1))stack.pop();
      else if(ch==='、'&&!stack.length){parts.push(line.slice(start,i));start=i+1;}
    }
    parts.push(line.slice(start));return parts;
  }
  function awardLines(raw){
    const lines=String(raw||'').split(/\r?\n/),out=[],level=/^(国家级|省市级|省级|市级|院校级|校级|院级)\s*[:：]\s*(.*)$/;
    const labelled=/^(?:奖项名称|获奖名称|奖励名称|获奖时间|获奖日期|获得时间|获得日期|奖项级别|获奖级别|颁奖单位|颁发机构|获奖说明|奖项描述)\s*[:：]/;
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim(),heading=line.match(level);
      if(heading&&heading[2]){
        // Inline level headings often introduce a list wrapped across PDF lines.
        // Only join it when explicit enumeration separators establish a list.
        const body=[heading[2]];let end=i;
        while(end+1<lines.length){const next=lines[end+1].trim();if(!next||level.test(next)||labelled.test(next)||/^[•●⚫◼▪◆·*\-]\s*/.test(next))break;body.push(next);end++;}
        const joined=body.reduce((a,b)=>a+(/[A-Za-z0-9]$/.test(a)&&/^[A-Za-z0-9]/.test(b)?' ':'')+b),parts=splitAwardList(joined);
        out.push(heading[1]+'：',...(parts.length>1?parts:body));i=end;
      }else out.push(...(labelled.test(line)?[line]:splitAwardList(line)));
    }
    return out.flatMap(line=>line.split(/[;；]+/));
  }
  function awardRows(raw){
    const rows=[];let level='',structured=null;
    for(let line of awardLines(raw)){
      line=line.trim().replace(/^[•●⚫◼▪◆·*\-]\s*/,'').replace(/[。；;]+$/,'').trim();if(!line)continue;
      const heading=line.match(/^(国家级|省市级|省级|市级|院校级|校级|院级)[：:]?$/);
      if(heading){level=/省|市/.test(heading[1])?'省市级':/院|校/.test(heading[1])?'院校级':'国家级';continue;}
      const labels={奖项名称:'name',获奖名称:'name',奖励名称:'name',获奖时间:'date',获奖日期:'date',获得时间:'date',获得日期:'date',奖项级别:'level',获奖级别:'level',颁奖单位:'issuer',颁发机构:'issuer',获奖说明:'description',奖项描述:'description'};
      const hits=[...line.matchAll(/(?:^|[\s|丨])(奖项名称|获奖名称|奖励名称|获奖时间|获奖日期|获得时间|获得日期|奖项级别|获奖级别|颁奖单位|颁发机构|获奖说明|奖项描述)\s*[:：]\s*/g)];
      if(hits.length){
        if(!structured||hits.some(h=>labels[h[1]]==='name'&&structured.name)){structured={name:'',date:'',level};rows.push(structured);}
        hits.forEach((hit,i)=>{const key=labels[hit[1]],value=line.slice(hit.index+hit[0].length,hits[i+1]?.index).replace(/[|丨\s]+$/,'');structured[key]=key==='date'?(awardDate(value)||value):value;});
        continue;
      }
      structured=null;
      let date='',name=line;
      // A leading explicitly separated date is evidence; a year in a prize's
      // name (e.g. "2023发明选拔赛") is not its award date.
      const m=line.match(/^((?:19|20)\d{2})[.年/\-](\d{1,2})(?:[.月/\-](\d{1,2})日?)?月?(?:\s+|\s*[|丨:：]\s*)(.+)$/);
      if(m){const candidate=m[1]+'-'+m[2].padStart(2,'0')+(m[3]?'-'+m[3].padStart(2,'0'):'');const d=new Date((m[3]?candidate:candidate+'-01')+'T00:00:00Z');if(Number.isFinite(+d)&&d.toISOString().slice(0,m[3]?10:7)===candidate){date=candidate;name=m[4].trim();}}
      if(name)rows.push({name,date,level});
    }
    return rows.filter(r=>r.name).slice(0,50);
  }
  function awardModuleFromText(raw,prefix=newId()){
    const fields=awardTemplate.fields.map(([label,type,aliases,options],i)=>({id:prefix+'f'+i,label,type,aliases:aliases.split('、'),options:options||[]}));
    const entries=awardRows(raw).map((r,i)=>({id:prefix+'e'+i,values:{[fields[0].id]:r.name,[fields[1].id]:r.level,[fields[2].id]:r.date,[fields[3].id]:r.issuer||'',[fields[4].id]:r.description||''}}));
    return {id:prefix,name:awardTemplate.name,aliases:awardTemplate.aliases.slice(),fields,entries};
  }
  function sanitizeModules(raw) {
    const ids=new Set();
    const id = value => { const safe=/^q[a-z0-9_-]{1,64}$/i.test(value||'')&&!ids.has(value)?value:newId();ids.add(safe);return safe; };
    return (Array.isArray(raw)?raw:[]).slice(0,20).map(m=>{
      const fieldIds=new Set(), fields=(Array.isArray(m?.fields)?m.fields:[]).slice(0,25).map(f=>{
        const fid=id(f?.id);fieldIds.add(fid);
        return {id:fid,label:text(f?.label).slice(0,100),type:Object.hasOwn(fieldTypes,f?.type)?f.type:'text',aliases:stringList(f?.aliases),options:stringList(f?.options),sourceId:f?.id};
      });
      const entries=(Array.isArray(m?.entries)?m.entries:[]).slice(0,50).map(e=>({id:id(e?.id),values:Object.fromEntries(fields.map(f=>[f.id,text(e?.values?.[f.sourceId])]))}));
      const module={id:id(m?.id),name:text(m?.name).slice(0,100),aliases:stringList(m?.aliases),fields:fields.map(({sourceId,...f})=>f),entries};
      if(isAwardModule(module)){
        module.aliases=stringList([...module.aliases,...awardAliases]);
        for(const field of module.fields){const kind=awardFieldKind(field);if(kind)field.aliases=stringList([...field.aliases,...awardFields[kind]]);}
      }
      return module;
    });
  }
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.schemaVersion !== 1) throw new Error('请选择轻投导出的版本 1 资料备份。');
    const p = fresh();
    p.preferences={monthOnlyDates:raw.preferences?.monthOnlyDates==='ask'?'ask':'first-day',awardsMigrated:true};
    for (const k of Object.keys(p.basic)) p.basic[k] = text(raw.basic?.[k]);
    const recordFieldIds=new Set();
    for (const [list, factory] of [['educations', blankEducation], ['experiences', blankExperience], ['projects', blankProject]]) {
      p[list] = (Array.isArray(raw[list]) ? raw[list] : []).slice(0, 20).map(row => ({...Object.fromEntries(Object.keys(factory()).filter(k=>k!=='customFields').map(k => [k, text(row?.[k])])),customFields:sanitizeRecordFields(row?.customFields,recordFieldIds)}));
    }
    for(const row of p.experiences)if(!['实习','正式工作','其他实践'].includes(row.experienceType))row.experienceType='';
    p.custom = (Array.isArray(raw.custom) ? raw.custom : []).slice(0, 100).map(x => ({ label: text(x?.label).slice(0, 100), value: text(x?.value), aliases:stringList(x?.aliases) }));
    p.modules = sanitizeModules(raw.modules);
    if(!raw.preferences?.awardsMigrated&&p.basic.honors&&!p.modules.some(isAwardModule)&&p.modules.length<20){
      const ids=new Set(p.modules.flatMap(m=>[m.id,...m.fields.map(f=>f.id),...m.entries.map(e=>e.id)]));
      let prefix='qlegacyawards',n=1;while([...ids].some(id=>id.startsWith(prefix)))prefix='qlegacyawards'+(++n);
      const module=awardModuleFromText(p.basic.honors,prefix);if(module.entries.length)p.modules=sanitizeModules([...p.modules,module]);
    }
    if (raw.attachment && /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(raw.attachment.data || '') && raw.attachment.data.length < 6000000) p.attachment = { name: text(raw.attachment.name), type: 'application/pdf', data: raw.attachment.data, size: Number(raw.attachment.size) || 0 };
    return p;
  }
  const isExtension = !!globalThis.chrome?.storage?.local;
  async function read(key, fallback) { if (isExtension) return (await chrome.storage.local.get(key))[key] ?? fallback; try { return JSON.parse(localStorage.getItem('qingtou:' + key)) ?? fallback; } catch { return fallback; } }
  async function write(key, value) { if (isExtension) await chrome.storage.local.set({ [key]: value }); else localStorage.setItem('qingtou:' + key, JSON.stringify(value)); }
  function download(name, content, type = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
  const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
  const safeUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const completeness = p => [p.basic.name, p.basic.email, p.basic.phone, p.educations[0]?.school, p.educations[0]?.major, p.educations[0]?.endDate, p.basic.desiredRole, p.basic.skills].filter(Boolean).length;
  globalThis.QT = { fresh, sample, sanitize, read, write, download, today, safeUrl, completeness, blankEducation, blankExperience, blankProject, isExtension, newId, fieldTypes, sanitizeModules,sanitizeRecordFields,awardTemplate,awardRows,awardModuleFromText,isAwardModule,awardFieldKind };
})();
