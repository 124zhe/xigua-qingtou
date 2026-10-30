(function(){
  'use strict';
  const M=globalThis.QTMatch;
  let cache=null;
  const beginScan=()=>{cache={controls:new WeakMap(),evidence:new WeakMap(),records:new WeakMap(),sections:new WeakMap()};};
  const endScan=()=>{cache=null;};
  const inputSelector='input,textarea,select,[role="combobox"],[contenteditable="true"]';
  const popupSelector='[role="listbox"],.el-select-dropdown,.el-autocomplete-suggestion,.ant-select-dropdown,.atsx-select-dropdown,.ud__select__dropdown,.aui-select-dropdown,.el-picker-panel,.ant-picker-dropdown,.ant-calendar-picker-container,.atsx-date-picker-popup,.jbs_three_layers_wrapper,.el-cascader__dropdown,.ant-cascader-menus';
  const visible=el=>!!el&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'&&!!el.getClientRects().length;
  const feedbackSelector='.el-input__count,.el-input__count-inner,.el-textarea__count,.ant-input-data-count,.ant-input-show-count-suffix,.word-count,.word-counter,.char-count,.char-counter,.character-count,.character-counter,[data-counter],.el-form-item__error,.ant-form-explain,.ant-form-item-explain,.ant-form-item-explain-error,.atsx-form-explain,.ud-formily-item-error-message,.error-message,.validation-error,.validation-message,.invalid-feedback,[data-validation-error],[role="alert"],.checkTip';
  const countText=value=>{const clean=String(value||'').normalize('NFKC').trim().replace(/^[([]\s*|\s*[)\]]$/g,'');return /^(?:(?:已(?:输入|填写|用)|字数)\s*[:：]?\s*)?\d[\d,]*\s*(?:\/|of|out of)\s*\d[\d,]*(?:\s*(?:字|字符|个字符|characters?|chars?))?$/i.test(clean)||/^(?:剩余|还可(?:输入|填写)|最多|不超过|限(?:填)?)\s*\d+\s*(?:字|字符|个字符)$/.test(clean);};
  const text=el=>{if(!el||el.matches?.(feedbackSelector))return '';const copy=el.cloneNode(true);copy.querySelectorAll(inputSelector+',button,svg,small,[role="option"],'+feedbackSelector).forEach(n=>n.remove());const value=M.labelText(copy.textContent);return countText(value)?'':value;};
  const byIds=(el,attr)=>(el.getAttribute(attr)||'').split(/\s+/).map(id=>el.ownerDocument.getElementById(id)).filter(Boolean);
  const placeholder=s=>!M.normalize(s)||/^(请选择|请输入|请填写|选择|未选择|select|selectone|pleasechoose|pleaseselect|choose|搜索|search|--|—)(?:\.{0,3}|…)?$/i.test(String(s||'').trim());
  const labelPlaceholder=s=>placeholder(s)||countText(s);
  function neteaseMonthRange(el){
    const range=el.closest('[id^="resume_education_form_time"],[id^="resume_project_form_time"],[id^="resume_work_form_time"]');
    const match=range?.id.match(/^(resume_(education|project|work)_form)_time\[\d+\]$/);
    if(!match||!range.closest('form#'+match[1]))return null;
    const kind={education:'educations',project:'projects',work:'experiences'}[match[2]];
    const ends=range.querySelectorAll('.u-date-hitherto'),pickers=range.querySelectorAll('.ant-calendar-picker');
    if(ends.length!==1||pickers.length!==2)return null;
    const end=ends[0],start=[...pickers].find(node=>!end.contains(node));
    const startInput=start?.querySelector('input'),endInput=end.querySelector('.hitherto-input input,input.hitherto-input');
    if(!startInput||!endInput)return null;
    if(el===startInput)return {type:'date',library:'ant3-month',root:start,range,kind,side:'startDate',startInput,endInput};
    if(el===endInput)return {type:'date',library:'ant3-month',root:end,range,kind,side:'endDate',startInput,endInput};
    return null;
  }
  function pairedDates(el){
    const picker=el.closest('.ant-calendar-picker'),root=picker?.parentElement;
    if(!root)return null;
    const pickers=[...root.querySelectorAll(':scope > .ant-calendar-picker')];
    if(pickers.length!==2||pickers.some(p=>p.querySelectorAll('input').length!==1))return null;
    const inputs=pickers.map(p=>p.querySelector('input'));
    const start=inputs.filter(n=>/^(开始|起始)(日期|时间)$/.test(n.placeholder)),end=inputs.filter(n=>/^(结束|截止)(日期|时间)$/.test(n.placeholder));
    if(start.length!==1||end.length!==1||start[0]===end[0]||!inputs.includes(el))return null;
    return {range:root,startInput:start[0],endInput:end[0],side:el===start[0]?'startDate':'endDate'};
  }
  function control(el){
    const month=neteaseMonthRange(el);if(month)return month;
    const linked=el.closest('.cascader-plugins-wrap');
    if(linked){const selects=[...linked.querySelectorAll('.ant-select')];return {type:'region',root:linked,library:'ant-linked',selects,multiple:selects.length!==2||selects.some(n=>n.matches('.ant-select-multiple,.ant-select-selection--multiple')||n.querySelector('.ant-select-selection--multiple'))};}
    const layers=el.closest('.jsb_three_layer_container');
    if(layers)return {type:'region',root:layers,library:'jbs',trigger:'.jbs_three_layers_input',popup:'.jbs_three_layers_wrapper',column:'.cascader_panel_menu',option:'.cascader_panel_item',label:'.cascader_item_label',multiple:!layers.querySelector('.jbs_three_layers_input > div:first-child > div')||!!layers.querySelector('.selected-item')};
    const cascader=el.closest('.el-cascader');
    if(cascader)return {type:'region',root:cascader,library:'element',popup:'.el-cascader__dropdown',column:'.el-cascader-menu__list',option:'.el-cascader-node',label:'.el-cascader-node__label',multiple:!!cascader.querySelector('.el-cascader__tags')};
    const antCascader=el.closest('.ant-cascader-picker');
    if(antCascader)return {type:'region',root:antCascader,library:'ant3-cascader',popup:'.ant-cascader-menus',column:'.ant-cascader-menu',option:'.ant-cascader-menu-item',label:'.ant-cascader-menu-item-label',multiple:!!antCascader.querySelector('[role="checkbox"],.ant-select-selection--multiple')};
    const select=el.closest('.el-select');
    if(select)return {type:'select',root:select,library:'element',search:el.matches('input:not([readonly])'),multiple:!!select.querySelector('.el-select__tags'),popup:'.el-select-dropdown',option:'.el-select-dropdown__item'};
    const auto=el.closest('.el-autocomplete');
    if(auto)return {type:'select',root:auto,library:'autocomplete',search:true,popup:'.el-autocomplete-suggestion',option:'li'};
    const date=el.closest('.el-date-editor,.ant-picker');
    if(date&&!date.matches('.el-range-editor,.ant-picker-range'))return {type:'date',root:date,library:date.matches('.ant-picker')?'ant':'element'};
    const oldDate=el.closest('.ant-calendar-picker');
    if(oldDate&&!oldDate.querySelector('.ant-calendar-range-picker-input,.ant-calendar-range-picker-separator'))return {type:'date',root:oldDate,library:'ant3-date',...pairedDates(el)};
    const ant=el.closest('.ant-select');
    // Ant v3 TreeSelect puts the combobox role on the outer span and its
    // search input in the portal, unlike Select's inner combobox element.
    if(ant?.matches('span[role="combobox"]')&&!ant.querySelector('.ant-select-selection[role="combobox"]'))return {type:'region',root:ant,library:'ant3-tree',multiple:!!ant.querySelector('.ant-select-selection--multiple'),popup:'.ant-select-tree-dropdown'};
    if(ant)return {type:'select',root:ant,library:'ant',autocomplete:ant.classList.contains('ant-select-auto-complete'),search:ant.classList.contains('ant-select-auto-complete'),multiple:ant.classList.contains('ant-select-multiple')||!!ant.querySelector('.ant-select-selection--multiple'),popup:'.ant-select-dropdown',option:'.ant-select-dropdown-menu-item,.ant-select-item-option'};
    const atsx=el.closest('.atsx-select');
    if(atsx)return {type:'select',root:atsx,library:'ant',multiple:!!atsx.querySelector('.atsx-select-selection--multiple')||atsx.classList.contains('atsx-select-multiple'),popup:'.atsx-select-dropdown',option:'.atsx-select-dropdown-menu-item'};
    const ud=el.closest('.ud__select');
    if(ud)return {type:'select',root:ud,library:'ant',multiple:!!ud.querySelector('.ud__select__selector-multiple'),popup:'.ud__select__dropdown',option:'.ud__select__list__item'};
    const udRange=el.closest('.throne-biz-date-range-picker-wrapper');
    if(udRange)return {type:'unsupported-date',root:udRange,library:'ud-range'};
    const aria=el.closest('[role="combobox"]');
    if(aria&&!aria.closest('.ant-select,.aui-select'))return {type:'select',root:aria,library:'aria',search:el.matches('input:not([readonly])'),multiple:aria.getAttribute('aria-multiselectable')==='true',popup:'[role="listbox"]',option:'[role="option"]'};
    return null;
  }
  function controls(root=document){
    if(cache?.controls.has(root))return cache.controls.get(root);
    const found=[...root.querySelectorAll(inputSelector)].filter(el=>{
      if(el.closest('#qingtou-host')||el.closest(popupSelector)||['hidden','button','submit','reset','image'].includes(el.type))return false;
      // This MonthPicker is a hidden implementation detail; its visible
      // sibling is the only end-date control and owns the real open callback.
      if(el.closest('form#resume_education_form .u-date-hitherto .hitherto-date-picker,form#resume_project_form .u-date-hitherto .hitherto-date-picker,form#resume_work_form .u-date-hitherto .hitherto-date-picker'))return false;
      if(!visible(el)&&el.type!=='file')return false;
      const c=control(el);
      if(c?.library==='ant-linked'){
        const first=[...c.selects[0]?.querySelectorAll(inputSelector)||[]].find(n=>visible(n)&&!(n.getAttribute('role')==='combobox'&&!n.matches('input,select')&&[...n.querySelectorAll(inputSelector)].some(visible)));
        if(el!==first)return false;
      }
      return !(el.getAttribute('role')==='combobox'&&!el.matches('input,select')&&[...el.querySelectorAll(inputSelector)].some(visible));
    });
    cache?.controls.set(root,found);return found;
  }
  function fieldWrapper(el){return el.closest('.el-form-item,.ant-form-item,.atsx-form-item,.ud-formily-item,.form-item,.form-group,.field,[data-field],td,dd')||el.parentElement;}
  function evidence(el){
    if(cache?.evidence.has(el))return cache.evidence.get(el);
    const result=[],add=(value,source,rank)=>{value=M.labelText(value);if(value&&!labelPlaceholder(value))result.push({label:value,source,rank});};
    add(el.getAttribute('aria-label'),'accessible',100);
    add(byIds(el,'aria-labelledby').map(text).join(' '),'accessible',100);
    if(el.type==='checkbox'&&el.labels?.length){
      for(const label of el.labels)add(text(label),'label',100);
      result.sort((a,b)=>b.rank-a.rank);cache?.evidence.set(el,result);return result;
    }
    for(const label of el.labels||[])if(el.type!=='radio'&&el.type!=='checkbox')add(text(label),'label',100);
    const wrap=fieldWrapper(el);
    if(wrap?.matches('.ud-formily-item')){
      const logical=new Set(controls(wrap).map(node=>control(node)?.root||node));
      const title=wrap.querySelector(':scope > .ud-formily-item-label .ud-formily-item-label-content');
      const field=wrap.getAttribute('data-form-field-name');
      if(field==='mobile'){
        add(control(el)?.root.matches('.ud__select')?'电话区号':text(title),'label',95);
      }else if(field==='identification'){
        add(control(el)?.root.matches('.ud__select')?'证件类型':'证件号码','label',95);
      }else if(logical.size===1){
        add(text(title),'label',95);
        add(el.getAttribute('data-form-field-i18n-name')||wrap.getAttribute('data-form-field-i18n-name'),'label',95);
      }
    }
    // ATSX uses an unassociated label several wrappers above the input.
    // Read only this field's title, leaving descriptions and validation out.
    if(wrap?.matches('.atsx-form-item')){
      const title=wrap.querySelector('.atsx-form-item-label .customResumeForm-fieldName')||wrap.querySelector('.atsx-form-item-label > label');
      const phone=el.closest('.atsx-phone'),identity=el.closest('#id-card-select-component');
      if(phone){
        if(el.matches('input.atsx-phone-input'))add(text(title),'label',95);
        else if(el.closest('.atsx-phone-select'))add('电话区号','label',95);
      }else if(identity){
        if(el.matches('input.id-input'))add('证件号码','label',95);
        else if(el.closest('.id-type-select'))add('证件类型','label',95);
      }else{
        const logical=new Set(controls(wrap).map(node=>control(node)?.root||node));
        if(logical.size===1)add(text(title),'label',95);
      }
    }
    const label=wrap?.querySelector(':scope > label,:scope > .label,:scope > .field-label,.el-form-item__label,.ant-form-item-label');
    const labelTarget=label?.htmlFor?el.ownerDocument.getElementById(label.htmlFor):null;
    const singleControl=label&&new Set(controls(wrap).map(node=>control(node)?.root||node)).size===1;
    // Some component labels keep a prop name in `for` while the actual input
    // has no id. Use that field's one logical control, never a neighboring one.
    const associated=label&&(!label.htmlFor||label.htmlFor===el.id||labelTarget?.contains(el)||!labelTarget&&singleControl)&&(!label.querySelector(inputSelector)||label.contains(el));
    if(associated&&(controls(wrap).length===1||wrap.matches('.el-form-item,.ant-form-item,.form-item,.form-group,.field,[data-field]')))add(text(label),'label',95);
    if(wrap?.tagName==='TD'){
      const prev=wrap.previousElementSibling;
      if(prev?.matches('th,td')&&!prev.querySelector(inputSelector))add(text(prev),'table',85);
    }
    if(wrap?.tagName==='DD'&&wrap.previousElementSibling?.tagName==='DT')add(text(wrap.previousElementSibling),'description-list',85);
    // Component FormItems may contain only the control, with the real title
    // above several wrappers. Ascend only while there is one logical field.
    const controlRoot=control(el)?.root;
    for(let p=el.parentElement,depth=0;p&&p!==document.body&&depth<12;p=p.parentElement,depth++){
      if(controls(p).length!==1)break;
      if(p!==wrap&&p.contains(wrap)&&result.some(item=>item.rank>=90))break;
      if(controlRoot&&(p===controlRoot||controlRoot.contains(p)))continue;
      const described=new Set([...(el.getAttribute('aria-describedby')||'').split(/\s+/),...(el.getAttribute('aria-errormessage')||'').split(/\s+/)].filter(Boolean));
      const referencesElsewhere=node=>[...(node.matches('label[for]')?[node]:[]),...node.querySelectorAll('label[for]')].some(label=>{const target=el.ownerDocument.getElementById(label.htmlFor);return target&&target!==el&&!target.contains(el);});
      const candidates=[...p.children].filter(n=>!n.contains(el)&&!n.matches(inputSelector)&&!n.querySelector(inputSelector)&&!referencesElsewhere(n)&&!described.has(n.id)&&text(n)&&text(n).length<65&&!n.matches('button,svg,small,[role="option"],[role="button"],.brick-select,.aui-select,.ant-select,.el-select'));
      if(candidates.length===1)add(text(candidates[0]),'nearby',80);
    }
    const auto={name:'姓名',email:'邮箱',tel:'手机号','tel-national':'手机号',sex:'性别',bday:'出生日期',url:'个人网站'};
    add(auto[(el.autocomplete||'').split(/\s+/).at(-1)],'autocomplete',75);
    add(el.placeholder,'placeholder',70);
    for(const attr of ['name','id']){
      const raw=el.getAttribute(attr)||'',parts=raw.replace(/([a-z])([A-Z])/g,'$1 $2').split(/[\[\]./_\-\s]+/).filter(x=>x&&!/^\d+$/.test(x));
      add(parts.join(' '),attr,55);
      // Strip only known form/record prefixes, never arbitrary name substrings.
      while(parts.length>1&&/^(form|resume|profile|candidate|basic|education|educations|experience|experiences|project|projects|input|field)$/i.test(parts[0]))parts.shift();
      add(parts.join(' '),attr,55);
    }
    result.sort((a,b)=>b.rank-a.rank);cache?.evidence.set(el,result);return result;
  }
  function infer(el,kind,fallback=''){
    const month=neteaseMonthRange(el);
    if(month&&kind===month.kind){
      const key=kind+'.'+month.side,conflict=evidence(el).find(item=>item.rank>=90&&(M.manualOnly(item.label)||(M.fieldKey(item.label,kind).key&&M.fieldKey(item.label,kind).key!==key)));
      if(conflict)return {key:null,label:conflict.label,blocked:true,reason:'字段标签与日期控件含义冲突，请确认对应资料'};
      return {key,label:kind==='educations'?(month.side==='startDate'?'入学时间':'获得学位证时间'):(kind==='projects'?'项目':'工作')+(month.side==='startDate'?'开始时间':'结束时间'),source:'date-range',rank:95,confidence:'明确'};
    }
    const udRange=el.closest('.throne-biz-date-range-picker-wrapper');
    if(udRange){
      const nodes=[...udRange.querySelectorAll('.throne-biz-date-range-picker-input input')],index=nodes.indexOf(el);
      const title=text(fieldWrapper(el)?.querySelector(':scope > .ud-formily-item-label .ud-formily-item-label-content'));
      if(nodes.length===2&&index>=0&&/^(起止时间|起止日期|起止年月|就读时间|在校时间|工作时间|实习时间|项目时间)$/.test(M.normalize(title))){
        const label=(index===0?'开始':'结束')+'时间';
        return {key:['educations','experiences','projects'].includes(kind)?kind+'.'+(index===0?'startDate':'endDate'):null,label,source:'date-range',rank:95};
      }
    }
    const parts=dateParts(el,kind);
    if(parts){const label=dateGroupLabel(parts.root),mapping=M.fieldKey(label,kind);if(parts.side&&['educations','experiences','projects'].includes(kind))return {key:kind+'.'+parts.side,label:label|| (parts.side==='startDate'?'开始年月':'结束年月'),source:'date-group',rank:95,confidence:'明确'};if(mapping.key)return {...mapping,label,source:'date-group',rank:95,confidence:'明确'};}
    const items=[...evidence(el)];
    // This standalone field lives in the applicant's basic information, not
    // one education record. Its id is on the date-picker span, not the input.
    const graduate=el.closest('.u-Graduate'),graduatePicker=el.closest('.ant-calendar-picker#graduateDate');
    const graduateField=!kind&&graduate&&graduatePicker&&graduate.contains(graduatePicker)&&graduate.closest('.m-resume-base')&&controls(fieldWrapper(el)).length===1;
    const graduateConflict=graduateField&&items.some(item=>item.rank>=90&&!/^(时间|日期|年月)$/.test(M.normalize(item.label))&&M.fieldKey(item.label,kind).key!=='educations.endDate');
    const graduateScope=graduateField&&!graduateConflict;
    if(graduateScope)items.push({label:'预计毕业时间',source:'component',rank:95});
    const feedback=[...(fieldWrapper(el)?.querySelectorAll(feedbackSelector)||[]),...byIds(el,'aria-describedby'),...byIds(el,'aria-errormessage')];
    const fallbackFeedback=fallback&&feedback.some(node=>M.normalize(M.labelText(node.textContent))===M.normalize(M.labelText(fallback)));
    if(fallback&&!labelPlaceholder(fallback)&&!fallbackFeedback)items.push({label:M.labelText(fallback),source:'adapter',rank:90});
    const strong=items.filter(x=>x.rank>=80),matches=items.map(x=>({...x,...M.fieldKey(x.label,kind)}));
    const bestRank=Math.max(0,...matches.filter(x=>x.key).map(x=>x.rank));
    const protectedItem=matches.find(x=>x.rank>=Math.max(70,bestRank)&&M.manualOnly(x.label));
    if(protectedItem)return {...protectedItem,key:null,blocked:true};
    const direct=matches.filter(x=>x.rank>=90&&x.key),unique=[...new Set(direct.map(x=>x.key))];
    if(unique.length>1)return {key:null,label:direct[0].label,blocked:true,reason:'字段标签含义冲突，请确认对应资料'};
    const hit=matches.sort((a,b)=>b.rank-a.rank).find(x=>x.key);
    // An explicit unknown label (e.g. company address) must not be overwritten
    // by a lower-confidence id such as company. Preserve custom module labels.
    if(hit&&(!strong.length||hit.rank>=80))return {...hit,...(graduateScope&&hit.key==='educations.endDate'?{educationScope:'highest'}:{}),confidence:hit.rank>=90?'明确':'辅助识别'};
    const top=matches.find(x=>x.rank>=80)||matches[0];
    return top?{...top,key:top.key||null}:{key:null,label:labelPlaceholder(fallback)||fallbackFeedback?'':fallback,reason:'未确定字段含义'};
  }
  const headingSelector=':scope > legend,:scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > [role="heading"],:scope > .section-title,:scope > .record-title,:scope > .module-header,:scope > header > h2,:scope > header > h3,:scope > .card-header h2,:scope > .card-header h3,:scope > .tit-wrap > .tit > p,:scope > .createFormSection-left > .createFormSection-title > .createFormSection-text,:scope > .left > .moduleName,:scope > .applyFormModuleWrapper-left > .applyFormModuleWrapper-title > .applyFormModuleWrapper-text';
  function heading(root,allowedModuleTitles=[]){
    const explicit=M.labelText(root?.getAttribute('data-section')||root?.getAttribute('data-kind')||text(root?.querySelector(headingSelector)));if(explicit)return explicit;
    // Some component systems render section headings as a direct styled div,
    // without semantic h2/legend markup. Accept a unique, short section title,
    // never a field title ("项目名称"), a nav link, or a wrapper of input values.
    if(root?.matches('.el-form-item,.ant-form-item,.atsx-form-item,.ud-formily-item,.form-item,.form-group,.field,[data-field],label,td,dd'))return '';
    const allowed=new Set((Array.isArray(allowedModuleTitles)?allowedModuleTitles:[]).filter(title=>typeof title==='string').map(M.normalize));
    const titles=[...(root?.children||[])].filter(node=>/\b(?:[\w]+[-_])*(?:title|heading|header)(?:[-_][\w]+)*\b/i.test(String(node.className).replace(/([a-z])([A-Z])/g,'$1-$2'))&&!node.querySelector(inputSelector+',a,button,[role="button"]')&&!node.matches('label,a,button,[role="button"]'))
      .map(node=>text(node)).filter(title=>{
        if(!title||title.length>60||labelPlaceholder(title))return false;
        const normalized=M.normalize(title).replace(/(?:必填|required|选填|optional)$/,'');
        if(allowed.has(M.normalize(title))||allowed.has(normalized))return true;
        if(M.sectionKind(title)&&/(?:经历|背景|经验|履历|信息|资料|experience|background|history|information|details)$/.test(normalized)||/家庭|亲属|推荐人|紧急(?:情况[下时]?)?联[系络]人|(?:个人|承诺|诚信)声明|family|emergency|referencecontact|declaration/i.test(normalized))return true;
        if(/^(?:获奖(?:情况|经历|记录)|奖励(?:荣誉|情况)|荣誉(?:奖项|记录)|语言(?:能力|技能|水平)|专业技能|其他技能(?:证书)?|资格证书|证书(?:信息|记录)?|作品(?:附件|展示|集)?|awards|honors|languages|languageskills|certifications|certificates|skills|portfolio)$/.test(normalized))return true;
        if([undefined,'educations','experiences','projects'].some(kind=>M.fieldKey(title,kind).key))return false;
        return !/(?:名称|姓名|编号|号码|说明|描述|备注|内容|日期|时间|等级|标题|name|description|remarks?|details?|date|time|level|title)$/.test(normalized);
      });
    return titles.length===1?titles[0]:'';
  }
  function explicitRecordOrder(scope,kind){
    if(kind!=='educations')return undefined;
    const instructions=[...scope.root.children].filter(node=>!node.querySelector(inputSelector)).map(node=>text(node)).join(' ');
    return /(?:从最高学历开始[，,\s]*(?:由高到低|由高至低|从高到低)|(?:按|按照)学历从高到低)/.test(instructions)?'descending':undefined;
  }
  function section(el){
    if(cache?.sections.has(el))return cache.sections.get(el);
    let found=null,emergency=null;
    for(let p=el.parentElement,depth=0;p&&p!==document.body&&depth<15;p=p.parentElement,depth++){
      const title=heading(p)||M.labelText(p.getAttribute('aria-label'))||(p.matches('form#resume_education_form')?'教育背景':p.matches('form#resume_project_form')?'项目/活动经历':p.matches('form#resume_work_form')?'工作/实习经历':'');
      if(/家庭|亲属|推荐人|(?:个人|承诺|诚信)声明|family|referencecontact|declaration/i.test(title))return {kind:'sensitive',title,root:p};
      if(/^(?:紧急(?:情况[下时]?)?联[系络]人|应急联系人)(?:信息|资料|联系方式)?$|^emergencycontacts?(?:information|details)?$/i.test(M.normalize(title)))emergency=emergency||{kind:'emergency',title,root:p};
      else if(/紧急(?:情况[下时]?)?联[系络]人|emergency/i.test(title))return {kind:'sensitive',title,root:p};
      const kind=M.sectionKind(title);if(!found&&kind)found={kind,title,root:p};
    }
    const result=emergency||found;cache?.sections.set(el,result);return result;
  }
  function record(el,kind){
    if(cache?.records.has(el))return cache.records.get(el);
    if(!['educations','experiences','projects'].includes(kind))return null;
    const scope=section(el);if(!scope||scope.kind!==kind)return null;
    const netease=el.closest('form#resume_education_form'),row=el.closest('.u-wraps');
    if(kind==='educations'&&netease&&row&&row.closest('form')===netease){
      const schoolNodes=[...row.querySelectorAll('[id^="resume_education_form_schoolId"]')].filter(node=>/^resume_education_form_schoolId\[\d+\]$/.test(node.id));
      // AutoComplete repeats its decorator id on an internal search input.
      const schools=schoolNodes.filter(node=>!schoolNodes.some(other=>other!==node&&other.contains(node)));
      const index=schools.length===1?schools[0].id.match(/\[(\d+)\]$/)?.[1]:null;
      const fields=[...row.querySelectorAll('[id^="resume_education_form_"]')];
      const peers=[...netease.querySelectorAll('.u-wraps')].filter(node=>node.closest('form')===netease);
      if(index!==null&&fields.every(node=>!node.id.match(/\[(\d+)\]$/)||node.id.endsWith('['+index+']'))&&peers.indexOf(row)>=0){
        const info={record:row,block:netease,kind,title:'教育背景',index:peers.indexOf(row),order:'descending',schoolBilingual:true,generic:true};
        for(const node of controls(row))cache?.records.set(node,info);return info;
      }
      return null;
    }
    const project=el.closest('form#resume_project_form');
    if(kind==='projects'&&project&&row&&row.closest('form')===project){
      const names=[...row.querySelectorAll('input[id^="resume_project_form_projectName"]')].filter(node=>/^resume_project_form_projectName\[\d+\]$/.test(node.id));
      const index=names.length===1?names[0].id.match(/\[(\d+)\]$/)?.[1]:null;
      const fields=[...row.querySelectorAll('[id^="resume_project_form_"]')];
      const peers=[...project.querySelectorAll('.u-wraps')].filter(node=>node.closest('form')===project);
      if(index!==null&&fields.every(node=>!node.id.match(/\[(\d+)\]$/)||node.id.endsWith('['+index+']'))&&peers.indexOf(row)>=0){
        const info={record:row,block:project,kind,title:'项目/活动经历',index:peers.indexOf(row),order:'recent-first',dateAnchors:true,generic:true};
        for(const node of controls(row))cache?.records.set(node,info);return info;
      }
      return null;
    }
    const work=el.closest('form#resume_work_form');
    if(kind==='experiences'&&work&&row&&row.closest('form')===work){
      const companyNodes=[...row.querySelectorAll('[id^="resume_work_form_companyName"]')].filter(node=>/^resume_work_form_companyName\[\d+\]$/.test(node.id));
      const companies=companyNodes.filter(node=>!companyNodes.some(other=>other!==node&&other.contains(node)));
      const index=companies.length===1?companies[0].id.match(/\[(\d+)\]$/)?.[1]:null;
      const fields=[...row.querySelectorAll('[id^="resume_work_form_"]')];
      const peers=[...work.querySelectorAll('.u-wraps')].filter(node=>node.closest('form')===work);
      if(index!==null&&fields.every(node=>!node.id.match(/\[(\d+)\]$/)||node.id.endsWith('['+index+']'))&&peers.indexOf(row)>=0){
        const info={record:row,block:work,kind,title:'工作/实习经历',index:peers.indexOf(row),order:'recent-first',dateAnchors:true,generic:true};
        for(const node of controls(row))cache?.records.set(node,info);return info;
      }
      return null;
    }
    const anchor=kind+'.'+{educations:'school',experiences:'company',projects:'name'}[kind];let candidate=null;
    const inner=el.closest('.form-cell-inner');
    if(inner&&inner.parentElement?.classList.contains('form-cell-right')&&scope.root.contains(inner)){
      const nodes=controls(inner),entries=nodes.map(node=>({node,key:infer(node,kind).key})).filter(x=>x.key?.startsWith(kind+'.')),keys=entries.map(x=>x.key);
      const foreign=nodes.some(node=>{const own=section(node);return own&&own.kind!==kind;});
      const repeated=repeatedFields(entries,kind);
      if(!foreign&&!repeated&&keys.filter(key=>key===anchor).length===1&&new Set(keys).size>=2){
        const peers=[...inner.parentElement.children].filter(node=>node.classList.contains('form-cell-inner'));
        const info={record:inner,block:scope.root,kind,title:scope.title,index:peers.indexOf(inner),order:explicitRecordOrder(scope,kind),generic:true};
        for(const node of nodes)cache?.records.set(node,info);return info;
      }
    }
    for(let p=el.parentElement;p&&scope.root.contains(p);p=p.parentElement){
      const nodes=controls(p),entries=nodes.map(node=>({node,key:infer(node,kind).key})).filter(x=>x.key?.startsWith(kind+'.')),keys=entries.map(x=>x.key);
      const count=keys.filter(key=>key===anchor).length,foreign=nodes.some(n=>{const s=section(n);return s&&s.kind!==kind;});
      if(foreign||count>1)break;
      if(count===1&&new Set(keys).size>=2&&!repeatedFields(entries,kind))candidate=p;
      if(p===scope.root)break;
    }
    if(!candidate)return null;
    const block=candidate===scope.root?scope.root.parentElement:scope.root;
    const anchors=controls(block).filter(node=>infer(node,kind).key===anchor);
    const info={record:candidate,block,kind,title:scope.title,index:Math.max(0,anchors.findIndex(node=>candidate.contains(node))),order:explicitRecordOrder(scope,kind),generic:true};
    for(const node of controls(candidate))cache?.records.set(node,info);return info;
  }
  function repeatedFields(entries,kind){
    return [...new Set(entries.map(x=>x.key))].some(key=>{const matches=entries.filter(x=>x.key===key);return matches.length>1&&new Set(matches.map(({node})=>node.type==='radio'?radioGroup(node)?.root:dateParts(node,kind)?.root||control(node)?.root||node)).size>1;});
  }
  function datePartToken(el){
    const labels=[el.getAttribute('data-date-part'),el.getAttribute('aria-label'),...byIds(el,'aria-labelledby').map(text),...[...(el.labels||[])].map(text),el.getAttribute('placeholder')].filter(Boolean).map(M.normalize);
    const parts=[...new Set(labels.map(label=>/^(年|年份|year|yyyy)$/.test(label)?'year':/^(月|月份|month|mm)$/.test(label)?'month':null).filter(Boolean))];
    return parts.length===1?parts[0]:null;
  }
  function dateGroupLabel(root){
    const label=root.querySelector(':scope > legend,:scope > .el-form-item__label,:scope > .ant-form-item-label,:scope > .field-label,:scope > .label,:scope > label:not(:has(input,select,textarea))');
    return M.labelText(root.getAttribute('aria-label')||byIds(root,'aria-labelledby').map(text).join(' ')||text(label));
  }
  function dateParts(el,kind){
    const part=datePartToken(el);if(!part)return null;
    const groups='[data-date-group],[data-date-range],.date-group,.date-parts,.year-month,.date-range,[role="group"],fieldset,.el-form-item,.ant-form-item,.form-item,.form-group,.field,[data-field]';
    for(let root=el.parentElement,depth=0;root&&root!==document.body&&depth<7;root=root.parentElement,depth++){
      if(!root.matches(groups))continue;
      const nodes=controls(root);if(![2,4].includes(nodes.length)||!nodes.includes(el))continue;
      const parts=nodes.map(datePartToken);if(parts.some(x=>!x))continue;
      const label=dateGroupLabel(root),mapping=M.fieldKey(label,kind),dateKey=/\.(startDate|endDate|birthMonth|birthDate)$/.test(mapping.key||''),explicit=root.matches('[data-date-group],[data-date-range],.date-group,.date-parts,.year-month,.date-range');
      if(!explicit&&!dateKey&&!/^(?:(?:就读|在校|工作|实习|项目|起止)(?:起止)?(?:时间|日期|年月))$/.test(M.normalize(label)))continue;
      // Independent field wrappers must never be paired merely because their
      // enclosing record happens to contain one year and one month control.
      if(nodes.some(node=>{const nested=node.closest(groups);if(nested===root||!nested||!root.contains(nested))return false;const label=dateGroupLabel(nested)||text(nested.querySelector(':scope > label'));return !!label&&!/^(年|年份|月|月份|year|month|yyyy|mm)$/.test(M.normalize(label));}))return null;
      if(parts.length===2&&parts[0]==='year'&&parts[1]==='month')return {part,side:/\.(startDate|endDate)$/.test(mapping.key||'')?mapping.key.split('.').at(-1):null,root};
      const range=root.matches('[data-date-range],.date-range')||/起止|就读|在校|工作时间|实习时间|项目时间/.test(label);
      if(parts.join(',')==='year,month,year,month'&&range)return {part,side:nodes.indexOf(el)<2?'startDate':'endDate',root};
      return null;
    }
    return null;
  }
  function radioGroup(el){
    if(el.type!=='radio')return null;
    const group=el.closest('[role="radiogroup"],.el-radio-group,.ant-radio-group,.atsx-radio-group')||(el.name?el.form||document:el.closest('fieldset'));
    if(!group)return null;
    const elements=[...group.querySelectorAll('input[type="radio"]')].filter(x=>!x.disabled&&(!el.name||x.name===el.name));
    return elements.length?{root:group,elements,token:elements[0]}:null;
  }
  function read(el){
    const c=control(el);if(!c)return null;
    // Selecting a Jbs leaf replaces its empty input. Read the control, not the
    // detached search/display input used before the selection.
    if(c.type==='region')return regionValue(c);
    if(c.type==='date')return el.value||'';
    if(c.library==='ant')return antValue(c.root);
    const value=el.matches('input')?el.value:el.querySelector('[data-value],.selected-value')?.textContent||el.textContent;
    return placeholder(value)?'':String(value||'').trim();
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const key=(el,key,code)=>el.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,keyCode:code,which:code,bubbles:true}));
  const type=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  function datePrecision(el){
    const c=control(el),format=[el.getAttribute('data-format'),el.placeholder,c?.root.getAttribute('data-format')].filter(Boolean).join(' ');
    if(c?.library==='ant3-month'||el.type==='month'||/yyyy[\-/]mm(?![\-/]dd)/i.test(format)||c?.root.matches('.el-date-editor--month'))return 'month';
    return 'day';
  }
  function invalid(el){return el.getAttribute('aria-invalid')==='true'||(el.validity&&!el.validity.valid)||!!el.closest('.el-form-item.is-error,.ant-form-item-has-error,.ant-form-item.has-error,.ant-form-item-control.has-error,.ud-formily-item-error')||!!el.closest('.atsx-form-item')?.querySelector('.has-error')||!!pairedDates(el)?.range.matches('[aria-invalid="true"],.is-error,[class^="dateRangePickerError___"],[class*=" dateRangePickerError___"]');}
  function selectionInvalid(el){
    if(!invalid(el))return false;
    if(el.getAttribute('aria-invalid')==='true'||el.validity&&!el.validity.valid)return true;
    const parts=dateParts(el,section(el)?.kind||'');
    if(!parts)return true;
    const error=el.closest('.el-form-item.is-error,.ant-form-item-has-error,.ant-form-item.has-error');
    if(error!==parts.root)return true;
    const pair=controls(parts.root).filter(node=>dateParts(node,section(node)?.kind||'')?.side===parts.side);
    // A required composite date is incomplete immediately after its year is
    // chosen. Verify the option now and the shared date once both parts exist.
    // Individual control errors and complete invalid dates are never deferred.
    return pair.length!==2||pair.every(node=>!placeholder(read(node)??node.value));
  }
  function antValue(root){return M.labelText(root.matches('.ant-select-auto-complete')?root.querySelector('input')?.value:root.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item,.atsx-select-selection-selected-value,.ud__select__selector__selectItem')?.textContent||'');}
  const antDisabled=root=>root.matches('.ant-select-disabled,.atsx-select-disabled,[aria-disabled="true"]')||!!root.querySelector('[aria-disabled="true"],.ud__select__selector-disabled');
  function antPanels(root,seen){
    const selector=root.matches('.ud__select')?'.ud__select__dropdown':root.matches('.atsx-select')?'.atsx-select-dropdown':'.ant-select-dropdown';
    const nodes=[root,...root.querySelectorAll('[aria-controls],[aria-owns]')];
    const owned=[...new Set(nodes.flatMap(n=>[...byIds(n,'aria-controls'),...byIds(n,'aria-owns')]).map(n=>n.closest(selector)||n).filter(n=>n.matches(selector)&&visible(n)))];
    if(owned.length)return owned;
    return [...document.querySelectorAll(selector)].filter(n=>visible(n)&&!seen.has(n));
  }
  async function chooseAnt(root,value,level=null,guard=()=>true,leaf=false){
    if(antDisabled(root))return {error:'此下拉已禁用，请在官网核对'};
    if(root.matches('.ud__select')&&!root.querySelector('.ud__select__selector'))return {error:'此搜索组件需在官网选择，请核对已选结果'};
    const before=antValue(root),input=root.querySelector('input'),queryBefore=input?.value||'',seen=new Set([...document.querySelectorAll('.ant-select-dropdown,.atsx-select-dropdown,.ud__select__dropdown')].filter(visible));
    const autocomplete=root.matches('.ant-select-auto-complete'),inputReadonly=input?.readOnly,searchInput=!!input&&!input.readOnly&&!input.disabled;let expectedQuery=queryBefore;
    const unchanged=()=>root.isConnected&&!antDisabled(root)&&(!input||(input.isConnected&&!input.disabled&&input.readOnly===inputReadonly&&(!searchInput||input.value===expectedQuery)))&&(autocomplete||antValue(root)===before)&&guard();
    const trigger=root.querySelector('.ant-select-selection,.ant-select-selector,.atsx-select-selection,.ud__select__selector')||input||root;
    const close=()=>{if(input){key(input,'Escape',27);input.blur();}key(trigger,'Escape',27);trigger.blur();};
    const options=()=>{const panels=antPanels(root,seen);return panels.length===1?[...panels[0].querySelectorAll('.ant-select-dropdown-menu-item,.ant-select-item-option,.atsx-select-dropdown-menu-item,.ud__select__list__item')].filter(n=>visible(n)&&!n.matches('.ant-select-dropdown-menu-item-disabled,.ant-select-item-option-disabled,.atsx-select-dropdown-menu-item-disabled,.ud__select__list__item-disabled,[aria-disabled="true"],[disabled]')):[];};
    const pick=()=>{
      const items=options().map(el=>({el,label:M.labelText(el.querySelector('.ant-select-item-option-content,.ud__select__list__item__content')?.textContent||el.textContent)}));
      if(level===null)return M.chooseOption(value,items);
      const candidates=items.map(item=>{const used=regionPrefixes(item.label,level).filter(n=>value.startsWith(n)).sort((a,b)=>b.length-a.length)[0];return used===undefined||(leaf&&used.length!==value.length)?null:{...item,used};}).filter(Boolean);
      return candidates.length===1?candidates[0]:null;
    };
    let committed=false;
    try{
      if(!unchanged())return {error:'字段已变化，请重新识别'};
      trigger.focus();trigger.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(50);
      if(!antPanels(root,seen).length)trigger.click();
      let chosen;
      for(let retry=0;retry<15;retry++){await wait(100);if(!unchanged())return {error:'字段已变化，请重新识别'};chosen=pick();if(chosen)break;}
      if(!chosen&&level===null&&input&&!input.readOnly){expectedQuery=value;type(input,value);for(let retry=0;retry<15;retry++){await wait(100);if(!unchanged())return {error:'字段已变化，请重新识别'};chosen=pick();if(chosen)break;}}
      if(!chosen)return {error:'没有唯一对应的下拉选项，请在官网核对'};
      if(!unchanged())return {error:'字段已变化，请重新识别'};
      chosen.el.scrollIntoView({block:'nearest'});chosen.el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));chosen.el.click();
      await wait(350);close();
      const after=antValue(root);committed=root.isConnected&&!antDisabled(root)&&M.optionScore(chosen.label,after)>0&&(level!==null||!selectionInvalid(root.querySelector('input')||root))&&(!(autocomplete||root.matches('.ud__select'))||!antPanels(root,seen).length);
      return committed?{before,after,type:'custom',used:chosen.used}:{error:'网站未确认选项，请在官网核对'};
    }finally{if(!committed&&searchInput&&root.isConnected&&!antDisabled(root)&&input.isConnected&&!input.disabled&&!input.readOnly&&input.value===expectedQuery&&expectedQuery!==queryBefore)type(input,queryBefore);close();}
  }
  const regionText=value=>String(value||'').trim().replace(/[\s/\\,，、>＞·-]+/g,'');
  function regionNames(value){
    const full=regionText(value),base=full.replace(/(?:壮族|回族|维吾尔)?自治区$|特别行政区$|省$|市$/,'');
    return [...new Set([full,base])].filter(Boolean);
  }
  function regionPrefixes(value,level){
    const names=regionNames(value);
    // Some dictionaries display “哈尔滨”, while the profile says “哈尔滨市”.
    // Add suffix variants only when the option itself omits a suffix; never
    // turn an explicitly labelled province into an identically named city.
    if(names.length===1){if(level===0)names.push(names[0]+'省');if(level<2)names.push(names[0]+'市');}
    return names;
  }
  function regionValue(c){
    if(c.library==='ant-linked')return c.selects.map(antValue).filter(Boolean).join(' / ');
    if(c.library==='ant3-tree')return antValue(c.root);
    if(c.library==='ant3-cascader')return M.labelText(c.root.querySelector('.ant-cascader-picker-label')?.textContent||'');
    const input=c.root.querySelector(c.trigger?c.trigger+' input':'input');
    return input&&!placeholder(input.value)?input.value.trim():'';
  }
  function regionPanel(c,el,seen){
    const inside=[...c.root.querySelectorAll(c.popup)].filter(visible);
    if(inside.length===1)return inside[0];
    const ids=[...byIds(el,'aria-controls'),...byIds(el,'aria-owns'),...byIds(c.root,'aria-controls'),...byIds(c.root,'aria-owns')];
    const owned=[...new Set(ids.map(n=>n.closest(c.popup)||n).filter(n=>n.matches(c.popup)&&visible(n)))];
    if(owned.length===1)return owned[0];
    const opened=[...document.querySelectorAll(c.popup)].filter(n=>visible(n)&&!seen.has(n));
    return opened.length===1?opened[0]:null;
  }
  function regionLeaf(c,option){
    if(c.library==='jbs')return option.classList.contains('leaf');
    if(c.library==='ant3-cascader')return !option.matches('.ant-cascader-menu-item-expand')&&!option.querySelector('.ant-cascader-menu-item-expand-icon');
    return !option.querySelector('.el-cascader-node__postfix')&&option.getAttribute('aria-expanded')!=='false'&&option.getAttribute('aria-expanded')!=='true';
  }
  async function closeRegion(c,el,seen){
    const t=c.root.querySelector(c.trigger||'input');if(!t)return;
    key(t,'Escape',27);t.blur();await wait(50);
    // Jbs does not implement Escape; toggle only this control's own popup.
    // A leave transition is already closing: clicking then would reopen it.
    const panel=regionPanel(c,el,seen);
    if(panel&&!/leave-(active|to)/.test(panel.className))t.click();
    for(let i=0;i<20&&regionPanel(c,el,seen);i++)await wait(50);
  }
  async function chooseRegion(el,value,keyName,label=''){
    const c=control(el);
    if(!c||c.type!=='region'||c.multiple)return {error:'此级联控件需手动选择'};
    if(!/^basic\.(nativePlace|city|desiredCity|studentOrigin)$/.test(keyName||'')&&!/籍贯|户籍|居住地|家庭所在地|生源地/.test(label))return {error:'此级联字段尚需手动选择'};
    if(c.library==='ant-linked')return chooseLinkedRegion(c,value);
    if(c.library==='ant3-tree')return chooseTreeRegion(c,el,value);
    const before=regionValue(c);if(before)return {error:'网站已有地区，已保留'};
    let intervened=false;const human=event=>{if(event.isTrusted)intervened=true;};
    const guarded=c.library==='ant3-cascader',events=['input','change','pointerdown','keydown'];
    const unchanged=()=>c.root.isConnected&&(!guarded||!intervened&&regionValue(c)===before&&!c.root.matches('.ant-cascader-picker-disabled,[aria-disabled="true"]')&&!c.root.querySelector('input:disabled'));
    if(!unchanged())return {error:'地区控件已变化或禁用，请重新识别'};
    const seen=new Set([...document.querySelectorAll(c.popup)].filter(visible));
    const trigger=()=>c.root.querySelector(c.trigger||'input');
    let rest=regionText(value),panel,leaf='',path=[],previousChildren=null;
    if(!rest)return {error:'资料没有可用的地区'};
    if(guarded)for(const event of events)document.addEventListener(event,human,true);
    try{
      const t=trigger();t.focus();
      panel=regionPanel(c,el,seen);if(!panel)t.click();
      for(let level=0;level<4;level++){
        let chosen=null;
        for(let retry=0;retry<15;retry++){
          await wait(100);if(!unchanged())return {error:'地区控件已变化，请重新识别'};panel=regionPanel(c,el,seen);
          if(!panel)continue;
          if(panel.querySelector('.el-checkbox,[role="checkbox"]'))return {error:'多选地区请在官网确认'};
          const column=[...panel.querySelectorAll(c.column)].filter(visible)[level];
          if(!column)continue;
          const children=[...column.querySelectorAll(c.option)];
          if(previousChildren&&children.length===previousChildren.length&&children.every((o,i)=>o===previousChildren[i]))continue;
          const candidates=[...column.querySelectorAll(c.option)].filter(o=>visible(o)&&!o.matches('.is-disabled,.disabled,.ant-cascader-menu-item-disabled,[aria-disabled="true"],[disabled]')).map(o=>{
            const name=(o.querySelector(c.label)?.textContent||o.textContent).trim(),isLeaf=regionLeaf(c,o);
            let used=regionPrefixes(name,level).filter(n=>rest.startsWith(n)).sort((a,b)=>b.length-a.length)[0];
            // Municipalities often repeat the same name in both columns.
            if(!rest&&level>0&&/^(北京|上海|天津|重庆|香港|澳门)$/.test(regionNames(path.at(-1)).at(-1))&&regionNames(name).some(n=>regionNames(path.at(-1)).includes(n)))used='';
            if(used===undefined||(isLeaf&&rest.slice(used.length)))return null;
            return {el:o,name,isLeaf,used};
          }).filter(Boolean);
          if(candidates.length>1)return {error:'地区选项存在歧义，请在官网确认'};
          if(candidates.length===1){chosen=candidates[0];break;}
        }
        if(!chosen)return {error:'未找到完整的省市对应选项，请在官网核对'};
        if(!unchanged())return {error:'地区控件已变化，请重新识别'};
        if(!chosen.isLeaf&&!rest.slice(chosen.used.length)&&!/^(北京|上海|天津|重庆|香港|澳门)$/.test(regionNames(chosen.name).at(-1)))return {error:'资料只有上级地区，官网还需要下级地区'};
        const nextColumn=[...panel.querySelectorAll(c.column)].filter(visible)[level+1];
        previousChildren=chosen.el.matches('.active,.in-active-path,[aria-expanded="true"]')?null:nextColumn?[...nextColumn.querySelectorAll(c.option)]:null;
        rest=rest.slice(chosen.used.length);path.push(chosen.name);
        chosen.el.scrollIntoView({block:'nearest'});
        chosen.el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));chosen.el.click();
        if(chosen.isLeaf){leaf=chosen.name;break;}
        // Let Vue replace the child column before inspecting the next level.
        await wait(150);
      }
      if(!leaf||rest)return {error:'地区层级尚未选完，请在官网核对'};
      await wait(100);await closeRegion(c,el,seen);await wait(450);
      const after=regionValue(c),actual=regionText(after),whole=regionText(path.join('/'));
      const committed=c.root.isConnected&&(!guarded||!intervened&&!c.root.matches('.ant-cascader-picker-disabled,[aria-disabled="true"]')&&!c.root.querySelector('input:disabled'))&&!!actual&&(regionNames(leaf).some(n=>regionNames(actual).includes(n))||actual===whole)&&!invalid(c.root.querySelector('input')||el)&&!regionPanel(c,el,seen);
      return committed?{before,after,type:'custom'}:{error:'网站未确认地区选项，请在官网核对'};
    }finally{
      if(guarded)for(const event of events)document.removeEventListener(event,human,true);
      if(regionPanel(c,el,seen))await closeRegion(c,el,seen);
    }
  }
  async function chooseLinkedRegion(c,value){
    const before=regionValue(c);if(before)return {error:'网站已有地区，已保留'};
    let rest=regionText(value);const path=[];
    if(!rest)return {error:'资料没有可用的地区'};
    for(let level=0;level<c.selects.length;level++){
      const root=c.selects[level];
      if(!root.isConnected)return {error:'地区控件已变化，请重新识别'};
      // Direct-administered municipalities repeat their name in the city list.
      if(!rest&&level===1&&/^(北京|上海|天津|重庆|香港|澳门)$/.test(regionNames(path[0]).at(-1)))rest=regionText(path[0]);
      if(!rest)return {error:'资料只有上级地区，官网还需要下级地区'};
      const unchanged=()=>c.root.isConnected&&c.selects.every((node,i)=>node.isConnected&&(i<level?antValue(node)===path[i]:!antValue(node)));
      const result=await chooseAnt(root,rest,level,unchanged,level===c.selects.length-1);
      if(result.error)return result;
      path.push(result.after);rest=rest.slice(result.used.length);
      if(level===0)await wait(200);
    }
    await wait(450);
    if(rest)return {error:'资料含官网未提供的下级地区，请在官网核对'};
    const after=regionValue(c),valid=c.selects.every((root,i)=>root.isConnected&&M.normalize(antValue(root))===M.normalize(path[i])&&!invalid(root));
    return valid?{before,after,type:'custom'}:{error:'网站未确认完整省市选项，请在官网核对'};
  }
  async function chooseTreeRegion(c,el,value){
    const root=c.root,before=regionValue(c);if(before)return {error:'网站已有地区，已保留'};
    if(antDisabled(root))return {error:'此地区树已禁用，请在官网核对'};
    const seen=new Set([...document.querySelectorAll('.ant-select-dropdown')].filter(visible)),trigger=root.querySelector('.ant-select-selection')||root;
    const panel=()=>{const all=antPanels(root,seen);return all.length===1&&all[0].matches('.ant-select-tree-dropdown')?all[0]:null;};
    const unchanged=()=>root.isConnected&&!antDisabled(root)&&!regionValue(c);
    const children=node=>[...(node?.children||[])].filter(n=>n.matches('li[role="treeitem"]'));
    const childTree=node=>[...node.children].find(n=>n.matches('ul.ant-select-tree-child-tree'));
    const close=async()=>{const popup=panel();if(!popup)return;const input=popup.querySelector('input');if(input){key(input,'Escape',27);input.blur();}key(root,'Escape',27);root.blur();await wait(200);if(panel()&&!/leave-(active|to)/.test(popup.className))document.documentElement.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));for(let i=0;i<15&&panel();i++)await wait(50);};
    let rest=regionText(value),leaf='',path=[];
    if(!rest)return {error:'资料没有可用的地区'};
    try{
      trigger.focus();trigger.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(50);if(!panel())trigger.click();
      let popup;for(let i=0;i<15;i++){await wait(100);if(!unchanged())return {error:'地区控件已变化，请重新识别'};if((popup=panel()))break;}
      if(!popup)return {error:'没有唯一对应的地区树，请在官网核对'};
      if(popup.querySelector('.ant-select-tree-checkbox,[role="checkbox"]'))return {error:'多选地区请在官网确认'};
      let nodes=children(popup.querySelector('ul.ant-select-tree'));
      for(let level=0;level<5;level++){
        if(!unchanged())return {error:'地区控件已变化，请重新识别'};
        const matches=nodes.filter(node=>visible(node)&&!node.matches('.ant-select-tree-treenode-disabled,[aria-disabled="true"]')).map(node=>{
          const content=[...node.children].find(n=>n.matches('.ant-select-tree-node-content-wrapper')),name=M.labelText(content?.querySelector('.ant-select-tree-title')?.textContent),switcher=[...node.children].find(n=>n.matches('.ant-select-tree-switcher'));
          if(!content||!name||!switcher)return null;
          const isLeaf=switcher.matches('.ant-select-tree-switcher-noop'),used=regionPrefixes(name,level).filter(n=>rest.startsWith(n)).sort((a,b)=>b.length-a.length)[0];
          if(used===undefined||(isLeaf&&used.length!==rest.length))return null;
          return {node,content,name,switcher,isLeaf,used};
        }).filter(Boolean);
        if(matches.length!==1)return {error:matches.length?'地区选项存在歧义，请在官网确认':'未找到完整的地区树路径，请在官网核对'};
        const chosen=matches[0];rest=rest.slice(chosen.used.length);path.push(chosen.name);
        if(chosen.isLeaf){
          if(rest)return {error:'地区层级尚未选完，请在官网核对'};
          if(!unchanged()||!chosen.content.isConnected)return {error:'地区控件已变化，请重新识别'};
          chosen.content.scrollIntoView({block:'nearest'});chosen.content.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));chosen.content.click();leaf=chosen.name;break;
        }
        if(!rest)return {error:'资料只有上级地区，官网还需要下级地区'};
        if(!chosen.switcher.matches('.ant-select-tree-switcher_open'))chosen.switcher.click();
        nodes=[];for(let retry=0;retry<15;retry++){await wait(100);if(!unchanged())return {error:'地区控件已变化，请重新识别'};nodes=children(childTree(chosen.node));if(nodes.some(visible))break;}
        if(!nodes.length)return {error:'官网尚未提供下级地区，请在官网核对'};
      }
      if(!leaf||rest)return {error:'地区层级尚未选完，请在官网核对'};
      await wait(150);await close();await wait(450);
      const after=regionValue(c),actual=regionText(after),whole=regionText(path.join('/'));
      return root.isConnected&&!antDisabled(root)&&!!actual&&(regionNames(leaf).includes(actual)||actual===whole)&&!invalid(el)&&!panel()?{before,after,type:'custom'}:{error:'网站未确认地区树选项，请在官网核对'};
    }finally{await close();}
  }
  async function choose(el,value){
    const c=control(el);if(!c||c.type!=='select'||c.multiple)return {error:'此控件需手动选择'};
    if(c.library==='ant'){
      const degree=c.root.closest('[id^="resume_education_form_degree"]');
      const known=degree&&/^resume_education_form_degree\[\d+\]$/.test(degree.id)&&degree.closest('form#resume_education_form');
      const fullTime=known?[...degree.querySelectorAll('label')].filter(label=>M.normalize(text(label))==='全日制').map(label=>label.querySelector('input[type="checkbox"]')).filter(Boolean):[];
      const existing=fullTime.length===1&&fullTime[0].checked?fullTime[0]:null;let userChanged=false;
      const changed=event=>{if(event.isTrusted)userChanged=true;};existing?.addEventListener('change',changed);
      try{
        const result=await chooseAnt(c.root,value);
        // The site's degree callback clears this independent existing answer.
        // Restore only a previously checked full-time box, never infer it.
        if(!result.error&&existing&&!userChanged&&existing.isConnected&&!existing.disabled&&!existing.checked){existing.click();await wait(150);if(!existing.checked)return {error:'学历已选择，请核对官网原有的全日制选项'};}
        return result;
      }finally{existing?.removeEventListener('change',changed);}
    }
    const before=read(el),queryBefore=el.value,seen=new Set([...document.querySelectorAll(c.popup)].filter(visible));
    const root=c.root,searchInput=c.search&&el.matches('input:not([readonly])'),inputReadonly=el.readOnly;let committed=false,expectedQuery=queryBefore;
    const enabled=()=>root.isConnected&&el.isConnected&&!el.disabled&&!el.closest('[aria-disabled="true"],.el-select.is-disabled,.el-autocomplete.is-disabled');
    const unchanged=()=>enabled()&&el.readOnly===inputReadonly&&(searchInput?el.value===expectedQuery:read(el)===before);
    const options=()=>{
      const ids=[...byIds(el,'aria-controls'),...byIds(el,'aria-owns'),...byIds(root,'aria-controls'),...byIds(root,'aria-owns')];
      let panels=[...new Set(ids.map(n=>n.closest(c.popup)||n).filter(visible))];
      if(!panels.length)panels=[...root.querySelectorAll(c.popup)].filter(visible);
      if(!panels.length)panels=[...document.querySelectorAll(c.popup)].filter(n=>visible(n)&&!seen.has(n));
      if(panels.length!==1)return [];
      return [...panels[0].querySelectorAll(c.option)].filter(n=>visible(n)&&!n.matches('.is-disabled,[aria-disabled="true"],[disabled]'));
    };
    try{
      if(!unchanged())return {error:'字段已变化，请重新识别'};
      el.focus();el.click();if(el.getAttribute('aria-expanded')==='false')key(el,'ArrowDown',40);
      if(!unchanged())return {error:'字段已变化，请重新识别'};
      if(searchInput){expectedQuery=value;type(el,value);}
      let chosen;
      for(let i=0;i<15;i++){await wait(100);if(!unchanged())return {error:'字段已变化，请重新识别'};chosen=M.chooseOption(value,options().map(el=>({el,label:el.getAttribute('aria-label')||el.querySelector('.el-select-dropdown__item-label')?.textContent||el.textContent})));if(chosen)break;}
      if(!chosen)return {error:'没有唯一对应的选项，请确认后选择'};
      if(!unchanged()||!chosen.el.isConnected)return {error:'字段已变化，请重新识别'};
      chosen.el.scrollIntoView({block:'nearest'});chosen.el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));chosen.el.click();
      key(el,'Escape',27);el.blur();await wait(450);
      committed=enabled()&&el.readOnly===inputReadonly&&M.optionScore(value,read(el))>0&&!selectionInvalid(el);
      return committed?{before,after:read(el),type:'custom'}:{error:'网站未确认选项，请手动核对'};
    }finally{
      if(!committed&&searchInput&&enabled()&&!el.readOnly&&el.value===expectedQuery&&expectedQuery!==queryBefore)type(el,queryBefore||'');
      key(el,'Escape',27);el.blur();
    }
  }
  async function date(el,value,policy,keyName){
    const c=control(el),precision=datePrecision(el);let target=value;
    if(precision==='month'&&/^\d{4}-\d{2}-\d{2}$/.test(target))target=target.slice(0,7);
    if(precision==='day'&&/^\d{4}-\d{2}$/.test(target)&&policy==='first-day'&&/^(educations|experiences|projects)\.(startDate|endDate)$/.test(keyName||''))target+='-01';
    if(c?.library==='ant3-month'&&target==='至今'&&c.side==='endDate')return antMonth(el,target,c);
    if(!M.isFullDate(precision==='month'?target+'-01':target))return {error:'日期格式或精度不明确，请在官网确认'};
    if(c?.library==='ant3-month')return antMonth(el,target,c);
    if(c?.library==='ant3-date')return antDate(el,target,c);
    if(el.readOnly)return {error:'日期格式或精度不明确，请在官网确认'};
    const before=el.value;el.focus();type(el,target);el.dispatchEvent(new Event('change',{bubbles:true}));key(el,'Enter',13);el.blur();await wait(450);
    return el.value===target&&!invalid(el)?{before,after:el.value,type:'custom'}:{error:'网站未确认日期，请手动核对'};
  }
  async function antDate(el,target,c){
    const before=el.value,seen=new Set([...document.querySelectorAll('.ant-calendar-picker-container')].filter(visible));
    let popup,intervened=false;
    const otherInput=c.side==='startDate'?c.endInput:c.startInput,other=otherInput?.value;
    const samePair=()=>{if(!c.range)return true;const pair=pairedDates(el);return pair?.range===c.range&&pair.startInput===c.startInput&&pair.endInput===c.endInput;};
    const unchanged=()=>!intervened&&el.isConnected&&!el.disabled&&el.value===before&&samePair()&&(!c.range||otherInput?.value===other);
    const strict=c.range&&/结束时间需晚于开始时间/.test(c.range.parentElement?.textContent||'');
    if(M.isFullDate(other)&&(c.side==='startDate'?(strict?target>=other:target>other):(strict?target<=other:target<other)))return {error:'起止日期与已有另一端冲突，请核对同一段经历'};
    const userChanged=event=>{if(event.isTrusted)intervened=true;},events=['pointerdown','mousedown','keydown','input','change'];
    for(const name of events)document.addEventListener(name,userChanged,true);
    try{
      if(!unchanged())return {error:'日期字段已变化，请重新识别'};
      el.focus();el.click();
      for(let retry=0;retry<15;retry++){
        await wait(100);if(!unchanged())return {error:'日期字段已变化，请重新识别'};
        const popups=[...document.querySelectorAll('.ant-calendar-picker-container')].filter(node=>visible(node)&&!seen.has(node));
        if(popups.length===1){popup=popups[0];break;}
      }
      const input=popup?.querySelector('.ant-calendar-input:not([readonly]):not([disabled])');
      if(!input||!unchanged())return {error:'没有唯一可输入的日历，请在官网选择日期'};
      input.focus();type(input,target);key(input,'Enter',13);await wait(450);
      const committed=!intervened&&el.isConnected&&!el.disabled&&el.value===target&&samePair()&&(!c.range||otherInput?.value===other)&&!invalid(el)&&!visible(popup);
      return committed?{before,after:el.value,type:'custom'}:{error:'网站未确认日历日期，请手动核对'};
    }finally{for(const name of events)document.removeEventListener(name,userChanged,true);if(!intervened&&popup&&visible(popup)){const input=popup.querySelector('input');if(input){key(input,'Escape',27);input.blur();}}if(!intervened)el.blur();}
  }
  async function antMonth(el,target,c){
    const before=el.value,seen=new Set([...document.querySelectorAll('.ant-calendar-picker-container')].filter(visible));let popup,intervened=false;
    const otherInput=c.side==='startDate'?c.endInput:c.startInput,other=otherInput?.value;
    const unchanged=()=>!intervened&&el.isConnected&&c.range.isConnected&&!el.disabled&&el.value===before&&otherInput?.value===other;
    const now=new Date(),currentMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const comparison=target==='至今'?currentMonth:target,otherMonth=other==='至今'?currentMonth:other;
    if(/^\d{4}-\d{2}$/.test(otherMonth||'')&&(c.side==='startDate'?comparison>otherMonth:comparison<otherMonth))return {error:'开始时间不能晚于结束时间，请在官网核对'};
    // A human can open the other endpoint before this popup is discovered.
    // Stop before any calendar selection instead of adopting that new popup.
    const userChanged=event=>{if(event.isTrusted)intervened=true;};
    const events=['pointerdown','mousedown','keydown','input','change'];
    for(const name of events)document.addEventListener(name,userChanged,true);
    try{
      if(!unchanged())return {error:'日期字段已变化，请重新识别'};
      el.focus();el.click();
      for(let retry=0;retry<15;retry++){
        await wait(100);if(!unchanged())return {error:'日期字段已变化，请重新识别'};
        const panels=[...document.querySelectorAll('.ant-calendar-picker-container')].filter(node=>visible(node)&&!seen.has(node));
        if(panels.length===1){popup=panels[0];break;}
      }
      if(!popup?.querySelector('.ant-calendar-month-panel'))return {error:'没有唯一对应的月份日历，请在官网选择'};
      let choice;
      if(target==='至今'){
        const choices=[...popup.querySelectorAll('.ant-calendar-footer .f-tac')].filter(node=>M.normalize(node.textContent)==='至今');
        if(choices.length===1)choice=choices[0];
      }else{
        const year=Number(target.slice(0,4)),month=Number(target.slice(5,7));
        const readYear=()=>{const label=popup.querySelector('.ant-calendar-month-panel-year-select-content')?.textContent.trim();return /^\d{4}$/.test(label||'')?Number(label):NaN;};
        let current=readYear();if(!Number.isInteger(current)||Math.abs(year-current)>120)return {error:'月份日历年份超出可核对范围，请在官网选择'};
        while(current!==year){
          if(!unchanged()||!visible(popup))return {error:'日期字段已变化，请重新识别'};
          const step=year>current?1:-1,button=popup.querySelector(step>0?'.ant-calendar-month-panel-next-year-btn':'.ant-calendar-month-panel-prev-year-btn');
          if(!button||button.getAttribute('aria-disabled')==='true')return {error:'官网不允许选择此年份，请核对'};
          button.click();await wait(40);const next=readYear();if(next!==current+step)return {error:'官网未切换日历年份，请核对'};current=next;
        }
        const cells=popup.querySelectorAll('.ant-calendar-month-panel-cell');
        const cell=cells.length===12?cells[month-1]:null;
        if(cell&&!cell.matches('.ant-calendar-month-panel-cell-disabled,[aria-disabled="true"]'))choice=cell.querySelector('.ant-calendar-month-panel-month');
      }
      if(!choice||!unchanged()||!visible(popup))return {error:'官网没有可确认的月份选项，请在官网选择'};
      choice.click();await wait(450);
      const complete=!!c.startInput?.value&&!!c.endInput?.value;
      // The range validator reports an incomplete pair after the first end.
      // Once both ends exist, its chronological validation must pass.
      const committed=el.isConnected&&el.value===target&&!visible(popup)&&(!complete||!invalid(el));
      return committed?{before,after:el.value,type:'custom'}:{error:'网站未确认起止月份，请在官网核对'};
    }finally{for(const name of events)document.removeEventListener(name,userChanged,true);if(!intervened&&popup&&visible(popup)){key(el,'Escape',27);key(popup,'Escape',27);}if(!intervened)el.blur();}
  }
  function editors(){
    const allowed=/^(基本信息|个人信息|教育经历|教育背景|学习经历|实习经历|工作经历|项目经历|在校职务|获奖情况|获奖经历|语言水平|附加信息)$/;
    const result=[];
    for(const button of document.querySelectorAll('button,a,[role="button"]')){
      const action=M.labelText(text(button));if(!visible(button)||! /^(编辑|添加|新增|Edit|Add)$/i.test(action))continue;
      if(button.matches('button')&&button.type==='submit'&&button.closest('form'))continue;
      if(button.matches('a[href]')&&! /^(#|javascript:void\(0\);?)$/.test(button.getAttribute('href')))continue;
      for(let p=button.parentElement,depth=0;p&&p!==document.body&&depth<4;p=p.parentElement,depth++){
        const title=heading(p);if(!allowed.test(title))continue;
        if(controls(p).some(n=>n.type!=='file'))break;
        if(!result.some(x=>x.module===p))result.push({module:p,title,button,action});break;
      }
    }
    return result;
  }
  globalThis.QTForm={beginScan,endScan,controls,control,evidence,infer,fieldWrapper,section,heading,record,radioGroup,read,choose,chooseRegion,date,dateParts,datePrecision,invalid,editors,visible};
})();

