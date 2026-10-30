(function () {
  'use strict';
  if (globalThis.__qingtou?.version === '0.5.11') return;
  if (globalThis.__qingtou?.isBusy?.()) return;
  globalThis.__qingtou?.dispose?.();
  document.getElementById('qingtou-host')?.remove();
  const M = globalThis.QTMatch, F = globalThis.QTForm;
  const contactQuestions={'basic.emergencyName':'紧急联系人姓名','basic.emergencyPhone':'紧急联系电话','basic.emergencyRelation':'与紧急联系人关系'};
  if(!M||!F)throw new Error('通用表单引擎未加载，请在扩展管理页重新加载轻投，再刷新招聘页面。');
  let panelHost, history = [], busy = false, currentProfile, cleanupPanel=()=>{};
  let sequentialRecords=new WeakMap(),sequentialMembers=new WeakMap(),mappingProfile;
  const runtime=globalThis.chrome?.runtime?.id?chrome.runtime:null;
  const runtimeInfo=()=>{
    let runtimeReady=false;
    try{runtimeReady=!!runtime?.getManifest()?.version;}catch{}
    return {version:'0.5.11',panelOpen:!!panelHost?.isConnected,busy:!!busy,runtimeReady};
  };
  const installedVersion=()=>{try{return runtime?.getManifest()?.version||'';}catch{return '';}};
  const syncSavedProfile=!!runtime&&/^https?:$/.test(location.protocol);
  function mergeSourceMetadata(next,previous){
    // Older profiles recover source sections from the saved PDF in the popup.
    // Keep that transient hint only when the underlying record still matches.
    for(const row of next.experiences||[]){
      if(row.experienceType||row.sourceSection)continue;
      const same=(previous?.experiences||[]).filter(old=>['company','role','startDate','endDate'].every(k=>old[k]===row[k]));
      if(same.length===1&&same[0].sourceSection)row.sourceSection=same[0].sourceSection;
    }
    return next;
  }
  async function latestProfile(){
    if(runtime){const result=await runtime.sendMessage({type:'qingtou:get-profile'});if(!result?.ok)throw new Error(result?.error||'资料读取失败');return mergeSourceMetadata(result.profile,currentProfile);}
    if(globalThis.QT)return QT.sanitize(await QT.read('profile',currentProfile));
    return currentProfile;
  }
  async function editProfile(target,status){
    if(busy)return;
    try{
      if(runtime){const result=await runtime.sendMessage({type:'qingtou:edit-profile',target});if(!result?.ok)throw new Error(result?.error||'无法打开资料页');}
      else if(globalThis.QT){const u=new URL('dashboard.html',location.href);u.searchParams.set('edit_key',target.key||'');for(const [k,v] of Object.entries(target))if(v!==undefined&&v!==null)u.searchParams.set('edit_'+k,String(v));u.hash='basic';window.open(u.href,'qingtou-profile-editor');}
      else throw new Error('请点击浏览器工具栏的轻投，打开“编辑网申资料”。');
      status.textContent='已打开资料页；保存后返回，或点击“更新资料”继续填写。';
    }catch(e){status.textContent=e.message?.includes('context invalidated')?'插件已更新，请从工具栏打开轻投，点击“更新当前页预览”。网页未保存的内容会保留。':e.message||'无法打开资料页，请从工具栏打开轻投。';}
  }
  function profileMessage(message,sender,respond){
    if(sender.id!==runtime?.id||message?.type!=='qingtou:profile-updated')return;
    if(busy){respond({ok:false,error:'正在填写，请完成后点击“更新资料”。'});return;}
    if(!panelHost?.isConnected){respond({ok:false,error:'填写预览已关闭，请在招聘页重新打开轻投。'});return;}
    open(mergeSourceMetadata(message.profile,currentProfile)).then(()=>{
      panelHost.shadowRoot.querySelector('.status').textContent='资料已更新，请核对后点击“填写所选项”。';
      respond({ok:true});
    },()=>respond({ok:false,error:'预览更新失败，请重新打开轻投。'}));
    return true;
  }
  runtime?.onMessage?.addListener(profileMessage);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && !!el.getClientRects().length; };
  const classStarts=(el,prefix)=>!!el?.classList&&[...el.classList].some(c=>c.startsWith(prefix));
  function closestClass(el,prefix){for(let p=el;p&&p!==document.body;p=p.parentElement)if(classStarts(p,prefix))return p;return null;}
  const directClass=(el,prefix)=>[...(el?.children||[])].find(c=>classStarts(c,prefix));
  const mokaField=el=>closestClass(el,'apply-field-');
  const mokaBlock=el=>closestClass(el,'apply-block-');
  const mokaSelect=el=>closestClass(el,'sd-Select-container-');
  const isCtrip=location.hostname==='careers.ctrip.com';
  const isBaidu=location.hostname==='talent.baidu.com';
  const isHuawei=location.hostname==='career.huawei.com';
  const isCeair=location.hostname==='job.ceair.com';
  const is51job=location.hostname==='xyz.51job.com'&&location.pathname.startsWith('/consumer/pc/resume/');
  const job51Module=el=>is51job?el.closest('.resume-module'):null;
  const job51Title=el=>cleanLabel(job51Module(el)?.querySelector(':scope > .resume-module-header > .left > .title')?.textContent);
  const job51Select=el=>is51job?el.closest('.el-select'):null;
  const job51Date=el=>is51job?el.closest('.el-date-editor'):null;
  const job51Suggest=el=>is51job?el.closest('.jbs_suggest .el-autocomplete'):null;
  const job51Label=el=>is51job?cleanLabel(el.closest('.el-form-item')?.querySelector(':scope > .el-form-item__label > span:first-child')?.textContent):'';
  const job51FormControls=()=>is51job?[...document.querySelectorAll('form.basic-wrapper')].flatMap(form=>F.controls(form)):[];
  async function job51Choose(d){
    const el=d.el,select=job51Select(el),suggest=job51Suggest(el),before=selectedText(el);
    el.focus();el.click();
    if(suggest)typeInput(el,d.value);
    let options=[];
    for(let i=0;i<12;i++){
      await wait(100);
      const owner=suggest||select,ids=[owner?.getAttribute('aria-owns'),owner?.getAttribute('aria-controls'),el.getAttribute('aria-controls')].filter(Boolean);
      const linked=ids.map(id=>document.getElementById(id)).find(node=>node&&visible(node));
      const panel=linked||[...document.querySelectorAll(suggest?'.el-autocomplete-suggestion':'.el-select-dropdown')].filter(visible);
      const roots=Array.isArray(panel)?panel:[panel];
      if(roots.length!==1)continue;
      options=[...roots[0].querySelectorAll(suggest?'li':'.el-select-dropdown__item')].filter(o=>visible(o)&&!o.classList.contains('is-disabled')&&o.getAttribute('aria-disabled')!=='true');
      if(options.length)break;
    }
    const chosen=M.chooseOption(d.value,options.map(el=>({el,label:cleanLabel(el.textContent)})));
    if(!chosen){if(suggest)nativeValue(el,before);el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true}));el.blur();return '没有唯一对应的官网选项，请手动选择';}
    chosen.el.click();el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true}));el.blur();await wait(350);
    if(!M.optionScore(d.value,selectedText(el)))return '官网未确认选项，请核对';
    history.push({el,type:'custom',before,after:selectedText(el)});return '';
  }
  async function job51FillDate(d){
    let value=d.value;
    if(/^\d{4}-\d{2}$/.test(value)){
      if(d.datePolicy==='ask'||! /^(educations|experiences|projects)\.(startDate|endDate)$/.test(d.key||''))return '请在官网选择日期，或补充完整日期后重新填写';
      value+='-01';
    }
    if(!M.isFullDate(value))return '资料不是有效日期，请在官网确认';
    const el=d.el,before=el.value;el.focus();nativeValue(el,value);
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}));el.blur();await wait(220);
    const after=el.value;
    if(after!==value&&after!==value.slice(0,7))return '官网未确认日期，请手动核对';
    history.push({el,type:'text',before,after});return '';
  }
  function job51Editors(){
    if(!is51job)return [];
    const allowed=/^(基本信息|个人信息|教育经历|教育背景|实习经历|工作经历|工作经验|项目经历|项目经验|在校职务|校园经历|获奖情况|获奖经历|语言水平|语言能力|附加信息)$/;
    return [...document.querySelectorAll('.resume-module')].flatMap(module=>{
      const title=job51Title(module),buttons=[...module.querySelectorAll(':scope > .resume-module-header > .right .custom-button')].filter(b=>visible(b)&&/^(编辑|添加)$/.test(cleanLabel(b.textContent)));
      return allowed.test(title)&&buttons.length===1?[{module,title,button:buttons[0],action:cleanLabel(buttons[0].textContent)}]:[];
    });
  }
  function job51Record(el,kind){
    const block=job51Module(el),record=el.closest('form.basic-wrapper');
    if(!block||!record||!['educations','experiences','projects'].includes(kind))return null;
    const cards=[...block.querySelectorAll('.field-list-box')],previous=record.parentElement.previousElementSibling;
    const editing=cards.includes(previous)?previous:null;
    return {block,record,kind,title:job51Title(el),index:editing?cards.indexOf(editing):cards.length,editing};
  }
  function job51Assignments(profile,controls){
    const infos=new Map(),result=new Map();
    if(!is51job)return result;
    for(const el of controls){const info=job51Record(el,contextOf(el));if(info&&visible(el))infos.set(info.record,info);}
    const used=new Map(),inspectedCards=new Set(),uncertainBlocks=new Set();
    for(const info of infos.values()){
      const rows=profile[info.kind],anchor={educations:'school',experiences:'company',projects:'name'}[info.kind];
      const values=root=>[...root.querySelectorAll('.field-item')].map(item=>({key:M.fieldKey(item.querySelector('.field-item-label')?.textContent,info.kind).key,value:cleanLabel(item.querySelector('.field-item-value')?.textContent)}));
      const match=value=>rows.map((row,index)=>({row,index})).filter(x=>M.normalize(x.row[anchor])===M.normalize(value));
      if(!used.has(info.block))used.set(info.block,new Set());
      const taken=used.get(info.block);let uncertain=uncertainBlocks.has(info.block);
      // Saved display cards also occupy records, even though they have no inputs.
      for(const card of info.block.querySelectorAll('.field-list-box')){
        if(card===info.editing)continue;
        if(inspectedCards.has(card))continue;inspectedCards.add(card);
        const entries=values(card),value=entries.find(x=>x.key===info.kind+'.'+anchor)?.value;
        const matches=info.kind==='educations'?(entries.some(educationAnchor)?educationCandidates(profile,entries,taken).map(index=>({index})):[]):value?match(value):[];
        if(matches.length&&(info.kind==='educations'||matches.length===1))taken.add(matches[0].index);else {uncertain=true;uncertainBlocks.add(info.block);const position=rows.findIndex((_,i)=>!taken.has(i));if(position>=0)taken.add(position);}
      }
      const field=[...info.record.querySelectorAll('input,textarea,select')].find(e=>M.fieldKey(labelOf(e),info.kind).key===info.kind+'.'+anchor);
      const existing=field&&selectedText(field),matches=existing?match(existing):[];
      if(info.kind==='educations'){
        const entries=educationValues(info.record);
        if(entries.some(educationAnchor)){
          const candidates=educationCandidates(profile,entries,taken);
          if(candidates.length){taken.add(candidates[0]);result.set(info.record,{index:candidates[0],source:'与官网已有教育资料对应，同校按简历顺序'});}
          else result.set(info.record,{needsRecord:true,reason:'网站已有教育资料与保存记录不一致，请核对这一整段'});
          continue;
        }
      }
      if(existing){
        if(matches.length===1&&!taken.has(matches[0].index)){taken.add(matches[0].index);result.set(info.record,{index:matches[0].index,source:'与网站已有名称对应'});}
        else result.set(info.record,{needsRecord:true,reason:'网站已有名称无法唯一对应资料，请确认这一整段'});
        continue;
      }
      if(uncertain||info.editing){result.set(info.record,{needsRecord:true,reason:'已有经历尚未明确对应，请在本段上方选择资料'});continue;}
      const target=info.kind==='experiences'?M.sectionExperienceType(info.title):'';
      const order=rows.map((_,i)=>i);
      const candidates=order.map(index=>({row:rows[index],index})).filter(x=>!taken.has(x.index)&&(!target||M.experienceType(x.row).type===target));
      if(candidates.length){const index=candidates[0].index;taken.add(index);result.set(info.record,{index,source:'按简历顺序，排除官网已有记录后对应'});}
      else {
        const alternatives=target==='实习'?rows.map((row,index)=>({row,index})).filter(x=>!taken.has(x.index)&&M.experienceType(x.row).type==='其他实践').map(x=>x.index):[];
        const unknown=target&&rows.some((row,index)=>!taken.has(index)&&!M.experienceType(row).type);
        result.set(info.record,{needsRecord:!!unknown||alternatives.length>0,noRecord:!unknown&&!alternatives.length,alternatives,reason:unknown||alternatives.length?'请选择这一段对应的经历':'资料没有更多对应经历，此栏可留空'});
      }
    }
    for(const info of infos.values()){
      const assignment=result.get(info.record);if(!assignment?.needsRecord||assignment.alternatives?.length)continue;
      const taken=used.get(info.block),rows=profile[info.kind],target=info.kind==='experiences'?M.sectionExperienceType(info.title):'';
      const candidates=rows.map((row,index)=>({row,index})).filter(x=>!taken.has(x.index)&&(!target||!M.experienceType(x.row).type||M.experienceType(x.row).type===target));
      const candidate=candidates.find(x=>x.index===info.index)||candidates[0];
      if(candidate){taken.add(candidate.index);result.set(info.record,{index:candidate.index,source:'按简历第 '+(candidate.index+1)+' 条补填',reviewNote:'已有记录未能明确对应，按网页位置及简历顺序补填，请核对；原内容保留。'});}
      else result.set(info.record,{index:null,noRecord:true,reason:'资料没有更多对应经历，此栏可留空'});
    }
    return result;
  }
  const ceairSelect=el=>isCeair&&el.matches('.select_box,.select_box2')?el:null;
  const ceairGender=el=>isCeair&&el.id==='spMan';
  const ceairDate=el=>isCeair&&el.matches('input[onfocus*="WdatePicker"]');
  function listFieldLabel(el){
    // Older forms put a title in the first list item, outside the control's li.
    const wrap=el.closest('ul.selectWrap,ul.selectWrap2');
    if(!wrap)return '';
    return cleanLabel(wrap.querySelector(':scope > li:first-child > .words')?.textContent);
  }
  function ceairInfo(el,profile){
    if(!isCeair)return null;
    const id=ceairSelect(el)?el.querySelector(':scope > ul')?.id:el.id;
    const basic={txtName:'name',txtBirty:'birthDate',txtMobile:'phone',txtEmail:'email',selCountry:'nationality',txtCountry:'nationality',spMan:'gender'};
    if(basic[id])return {key:'basic.'+basic[id],index:0};
    const top={selTopEducation:'education',txtTopEducationZhuanYe:'major',selTopEducationType:'degreeCategory',selTopEduCreditSystem:'studyLength'};
    let field=top[id],scope=field?'最高学历':'';
    const m=(id||'').match(/^(?:txt|sel)(BK|YJS|YJ|BS)(Name|Start|End|Type|Sx|CreditSystem)$/);
    if(m){scope={BK:'本科',YJS:'硕士',YJ:'硕士',BS:'博士'}[m[1]];field={Name:'school',Start:'startDate',End:'endDate',Type:'studyMode',Sx:'schoolRegion',CreditSystem:'studyLength'}[m[2]];}
    if(!field)return null;
    const rank=e=>['高中','专科','本科','硕士','博士'].findIndex(level=>M.optionScore(e.education,level)>0);
    const highest=Math.max(-1,...profile.educations.map(rank));
    const matches=profile.educations.map((row,index)=>({row,index})).filter(x=>scope==='最高学历'?highest>=0&&rank(x.row)===highest:M.optionScore(x.row.education,scope)>0);
    const one=matches.length===1?matches[0]:null;
    return {key:'educations.'+field,index:one?.index??-1,scope,source:one?scope+' · '+(one.row.school||'未填写学校'):'',reason:matches.length>1?scope+'有多条资料，请在资料页明确对应记录或手动指定':!one?'资料中没有'+scope+'记录，请先补充该段教育经历':'',ambiguous:matches.length>1};
  }
  const huaweiSelect=el=>isHuawei&&el.closest('.aui-select:not(.aui-select__multiple)');
  const huaweiPicker=el=>isHuawei&&el.closest('[data-tag="we-datepicker"],.aui-date-container');
  const huaweiRecord=el=>isHuawei&&el.closest('.educationExperienceModule,.workExperienceModule,.projectExperienceModule');
  const huaweiSelection=new WeakMap();
  function huaweiKind(el){const r=huaweiRecord(el);return !r?'':r.classList.contains('educationExperienceModule')?'educations':r.classList.contains('workExperienceModule')?'experiences':'projects';}
  function huaweiLabel(el){
    if(!isHuawei)return '';
    const field=el.closest('.aui-form-item'),label=cleanLabel(field?.querySelector(':scope > .aui-form-item__label')?.textContent);
    if(label==='证件')return huaweiSelect(el)?'证件类型':'证件号码';
    return label;
  }
  function baiduField(el){
    if(!isBaidu)return null;
    for(let p=el;p&&p!==document.body;p=p.parentElement)for(const c of p.classList||[]){const m=c.match(/^field-[\d.]+-([a-zA-Z]+)(\d*)$/);if(m)return {el:p,name:m[1],index:m[2]===''?null:Number(m[2])};}
    return null;
  }
  const baiduPicker=el=>isBaidu&&el.closest('.brick-date-picker');
  const baiduMonthPicker=el=>baiduPicker(el)&&['graduateDate','edudate','workdate','subjectDate'].includes(baiduField(el)?.name);
  function baiduLabel(el){
    const f=baiduField(el);if(!f)return '';
    if(['edudate','workdate','subjectDate'].includes(f.name)){
      const inputs=[...f.el.querySelectorAll('.brick-date-picker input')];if(inputs.length!==2)return '';
      return (f.name==='edudate'?(inputs.indexOf(el)===0?'入学':'毕业'):(inputs.indexOf(el)===0?'开始':'结束'))+'日期';
    }
    return {cardNum:'证件号码',graduateDate:'毕业日期',school:'学校',academic:'学历',major:'专业',scoreRank:'成绩排名',companyName:'公司名称',positionName:'职位名称',positionDesc:'工作职责',workDesc:'工作职责',subjectName:'项目名称',subjectDesc:'项目描述',name:'姓名',mobile:'手机号',email:'邮箱',sex:'性别'}[f.name]||'';
  }
  const antSelect=el=>el.matches('input.ant-select-selection-search-input')?el.closest('.ant-select-single:not(.ant-select-multiple)'):null;
  const ctripPicker=el=>isCtrip?el.closest('.ant-picker'):null;
  const needsFullDate=el=>ceairDate(el)||!!ctripPicker(el)||!!(huaweiPicker(el)&&(el.closest('[data-tag="we-datepicker"]')||el.closest('.aui-date-editor--date')))||el.type==='date'||!!(F?.control(el)?.type==='date'&&F.datePrecision(el)==='day');
  const ctripPhone=el=>isCtrip&&el.matches('input.number-input[type="tel"]')&&!!el.closest('.phone-editing #contryCode .number-input-wrapper');
  const ctripRegionSearch=el=>isCtrip&&el.matches('input.search-input')&&!!el.closest('.phone-editing #contryCode .country-select');
  // Ctrip renders a plain title div BEFORE Form.Item, inside the same grid column.
  function ctripLabel(el){
    if(!isCtrip)return '';
    if(ctripPhone(el))return '手机号';
    if(ctripRegionSearch(el))return '国家或区号搜索';
    if(el.id==='basicInfo_idType')return '证件类型';
    if(el.id==='basicInfo_idNumber')return '证件号码';
    const item=el.closest('.ant-form-item'),column=item?.parentElement;
    if(!column?.classList.contains('ant-col'))return '';
    const title=item.previousElementSibling;
    return title&&!title.querySelector('input,select,textarea')?textWithoutControls(title):'';
  }
  function ctripTitle(el){return isCtrip?cleanLabel(el.closest('.moduleBlock')?.querySelector(':scope > .titles')?.textContent):'';}
  const controlsSelector='input,textarea,select,[role="combobox"],[contenteditable="true"]';
  const cleanLabel=s=>String(s||'').replace(/[\uE000-\uF8FF]/g,'').replace(/^[*＊\s]+|[*＊:：\s]+$/g,'').replace(/\s*[（(](必填|选填|required|optional)[）)]/gi,'').trim();
  const genericLabel=s=>/^(请选择|请选择\.\.\.|请输入|请填写|选择|年|月|日|select|please select|choose|year|month|day)$/i.test(cleanLabel(s));
  const useful=s=>!!cleanLabel(s)&&!genericLabel(s);
  function textWithoutControls(el){if(!el)return '';const copy=el.cloneNode(true);copy.querySelectorAll('input,select,textarea,button,[role="option"],[class*="display-value"],svg,small').forEach(n=>n.remove());return cleanLabel(copy.textContent);}
  function fieldWrap(el){return mokaField(el)||el.closest('.ant-form-item,.atsx-form-item,.el-form-item,.aui-form-item,.tiny-form-item,.form-item,.form-group,[data-field],.field')||el.parentElement;}
  function mokaTitle(el){const b=mokaBlock(el),t=directClass(b,'blockTitle-');return cleanLabel(t?.querySelector('[class^="text-"]')?.textContent||textWithoutControls(t));}
  const contentValue=value=>String(value??'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim()?String(value):'';
  function selectedText(el){if(F?.control(el)?.type==='region')return F.read(el);if(ceairSelect(el)){const t=cleanLabel(el.querySelector(':scope > .select_span,:scope > .select_span2')?.textContent);return genericLabel(t)?'':t;}if(ceairGender(el))return cleanLabel(el.parentElement.querySelector('span[value]')?.textContent);const hw=huaweiSelect(el);if(hw){const known=huaweiSelection.get(hw);return contentValue(known&&known.display===el.value?known.label:el.closest('.aui-form-item.is-error')?'':el.value);}const ant=antSelect(el);if(ant)return cleanLabel(ant.querySelector('.ant-select-selection-item')?.textContent);const select=mokaSelect(el);if(!select&&F?.read(el)!==null&&F?.read(el)!==undefined)return F.read(el);return select?cleanLabel(select.querySelector('[class^="sd-Input-display-value-"]')?.textContent):contentValue(el.isContentEditable?el.textContent:el.value);}
  function atsxIdentityIssue(el,profile){
    const group=el.closest('#id-card-select-component,.ud-formily-item[data-form-field-name="identification"]');
    let type=group?.querySelector('.id-type-select,.ud__select');
    if(!group){
      // Separate type/number rows still belong to one identity when their
      // nearest shared container contains exactly one of each semantic key.
      for(let p=el.parentElement,depth=0;p&&p!==document.body&&depth<12;p=p.parentElement,depth++){
        const fields=F.controls(p).map(node=>({node,key:F.infer(node,contextOf(node)).key}));
        const numbers=fields.filter(item=>item.key==='basic.documentNumber'),types=fields.filter(item=>item.key==='basic.documentType');
        if(numbers.length>1||types.length>1)break;
        if(numbers.length===1&&types.length===1){type=types[0].node;break;}
      }
      if(!type)return '';
    }
    const selected=type&&(F.read(type)??(type.tagName==='SELECT'?type.selectedOptions[0]?.textContent:type.value)),intended=M.identityValue(profile,'basic.documentType');
    if(!intended)return '请先在基本资料中补充本人的证件类型，再填写号码';
    return selected&&M.optionScore(intended,selected)?'':'证件类型不一致或尚未选中，请先在官网选择对应类型，再填写号码';
  }
  function labelOf(el, radio = false) {
    const wrap = fieldWrap(el);
    if(el.type==='checkbox')return cleanLabel(el.labels?.[0]?.textContent||el.getAttribute('aria-label')||el.name);
    if (radio) { const group=F?.radioGroup(el)?.root,legend = el.closest('fieldset')?.querySelector(':scope > legend'),labelled=(group?.getAttribute?.('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ');return M.labelText(group?.getAttribute?.('aria-label')||labelled||wrap?.querySelector('.atsx-form-item-label .customResumeForm-fieldName')?.textContent||wrap?.querySelector('.ant-form-item-label,.atsx-form-item-label,.el-form-item__label,.field-label')?.textContent || legend?.textContent || el.name || ''); }
    if(!isCtrip&&!isBaidu&&!isHuawei&&!isCeair&&!is51job&&!mokaField(el))return F.infer(el,contextOf(el)).label||'';
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    const explicit = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]')?.textContent : '';
    const wrapping = el.closest('label');
    const wrappingText = wrapping && !mokaSelect(el) && wrapping.querySelectorAll('input,select,textarea').length === 1 ? textWithoutControls(wrapping) : '';
    const candidates=[el.getAttribute('aria-label'),labelled,explicit,job51Label(el),listFieldLabel(el),huaweiLabel(el),baiduLabel(el),ctripLabel(el),directClass(mokaField(el),'title-')?.textContent,wrap?.querySelector(':scope > label,.ant-form-item-label,.el-form-item__label,.aui-form-item__label,.tiny-form-item__label,.field-label')?.textContent,wrappingText];
    for(let p=el.parentElement,depth=0;p&&p!==document.body&&depth<6;p=p.parentElement,depth++){
      if(p.querySelectorAll(controlsSelector).length>1)break;
      const nodes=[...p.children].filter(n=>!n.contains(el)&&!n.matches(controlsSelector)&&!n.querySelector(controlsSelector)&&n.matches('label,.label,.field-label,[class*="form-label"],[class*="field-label"],[class^="label-"],[class^="title-"]'));
      if(nodes.length===1)candidates.push(textWithoutControls(nodes[0]));
    }
    candidates.push(F?.infer(el,contextOf(el)).label,el.placeholder,el.name);return M.labelText(candidates.find(useful)||'');
  }
  function contextOf(el) {
    if(is51job){const title=job51Title(el);if(/家庭|亲属|个人声明/.test(title))return 'sensitive';const kind=M.sectionKind(title);if(kind)return kind;}
    const generic=F?.section(el);if(generic?.kind==='sensitive')return 'sensitive';
    if(generic?.kind==='emergency')return 'emergency';
    if(M.isCampusSection(generic?.title)&&M.moduleContexts(mappingProfile||currentProfile||{modules:[]},generic.title).length)return '';
    let kind=huaweiKind(el)||(isBaidu?(el.closest('#resume-edu-info')?'educations':el.closest('#resume-work-info')?'experiences':el.closest('#resume-project-info')?'projects':''):'');
    for (let p = el.parentElement, depth = 0; p && depth < 14 && p !== document.body; p=p.parentElement, depth++) {
      const text = [p.getAttribute('data-section'), p.getAttribute('data-kind'), p.querySelector(':scope > legend,:scope > h2,:scope > h3,:scope > h4,:scope > .section-title,:scope > .module-header,:scope > .record-title')?.textContent, isCtrip?p.querySelector(':scope > .titles')?.textContent:'',textWithoutControls(directClass(p,'blockTitle-')), p.className].filter(x=>typeof x==='string').join(' ');
      if (/家庭|亲属|紧急(?:情况[下时]?)?联[系络]人|推荐人|family|emergency|referencecontact/i.test(text)) return 'sensitive';
      if(!kind)kind=M.sectionKind(text);
    }
    return kind||generic?.kind||sequentialRecords.get(el)?.kind||'';
  }
  function dateParts(el){const field=mokaField(el);if(!field||!['年','月'].includes(el.placeholder))return F.dateParts?.(el,contextOf(el))||null;const list=[...field.querySelectorAll('input')].filter(e=>['年','月'].includes(e.placeholder));const i=list.indexOf(el);if(i<0||![2,4].includes(list.length))return null;return {part:el.placeholder==='年'?'year':'month',side:list.length===4?(i<2?'startDate':'endDate'):null};}
  function splitDate(value,part){if(!part)return value;return /^\d{4}-\d{2}(?:-\d{2})?$/.test(value)?value.split('-')[part==='year'?0:1]:'';}
  function mokaRecordInfo(el,kind){if(!['educations','experiences','projects'].includes(kind))return null;const block=mokaBlock(el),record=closestClass(el,'apply-fields-');if(!block||!record)return null;const peers=[...block.children].filter(e=>classStarts(e,'apply-fields-'));const title=mokaTitle(el);return {block,record,index:peers.indexOf(record),kind,title};}
  // Generic fallback needs an explicit record wrapper and a unique identity field.
  // Repeated identity fields mean this is an outer section, not one experience.
  function semanticRecordInfo(el,kind){
    if(!['educations','experiences','projects'].includes(kind))return null;
    const selector='[data-record],[data-entry],.record,.record-item,.experience-item,fieldset,.module-container';
    const record=el.closest(selector);if(!record)return null;
    const title=cleanLabel(record.querySelector(':scope > legend,:scope > h2,:scope > h3,:scope > h4,:scope > .module-header,:scope > .record-title')?.textContent||record.getAttribute('data-kind')||record.getAttribute('data-section'));
    if(M.sectionKind(title)!==kind)return null;
    const keys=[...record.querySelectorAll('input,textarea,select')].map(node=>M.fieldKey(labelOf(node),kind).key).filter(key=>key?.startsWith(kind+'.'));
    const anchor=kind+'.'+{educations:'school',experiences:'company',projects:'name'}[kind];
    if(keys.filter(key=>key===anchor).length!==1||new Set(keys).size<2||keys.length!==new Set(keys).size)return null;
    const block=record.parentElement,peers=[...block.children].filter(p=>p.matches(selector)&&contextOf(p.querySelector('input,textarea,select')||p)===kind);
    return {record,block,index:peers.indexOf(record),kind,title};
  }
  function explicitRecordOf(el,kind){
    if(is51job)return job51Record(el,kind);
    const moka=mokaRecordInfo(el,kind);if(moka)return moka;
    if(isHuawei){
      const record=huaweiRecord(el);if(!record||kind!==huaweiKind(el))return semanticRecordInfo(el,kind);
      const cls={educations:'educationExperienceModule',experiences:'workExperienceModule',projects:'projectExperienceModule'}[kind];
      const block=record.closest('.step-main')||record.parentElement,peers=[...block.querySelectorAll('.'+cls)];
      return {record,block,index:peers.indexOf(record),kind,title:{educations:'教育经历',experiences:'工作/实习经历',projects:'项目经历'}[kind]};
    }
    if(isBaidu&&['educations','experiences','projects'].includes(kind)){
      const block=el.closest({educations:'#resume-edu-info',experiences:'#resume-work-info',projects:'#resume-project-info'}[kind]);if(!block)return null;
      let record=el;while(record.parentElement&&record.parentElement!==block)record=record.parentElement;
      const peers=[...block.children].filter(p=>p.querySelector('[class^="form-title__"]'));
      if(!peers.includes(record))return null;
      return {block,record,index:peers.indexOf(record),kind,title:{educations:'教育经历',experiences:'工作经历',projects:'项目经历'}[kind]};
    }
    if(!isCtrip)return semanticRecordInfo(el,kind)||F?.record(el,kind);
    if(!['educations','experiences','projects'].includes(kind))return null;
    const block=el.closest('.moduleBlock'),record=el.closest('.blockContainer');
    if(!block||!record||record.closest('.moduleBlock')!==block||!record.parentElement.matches('.reSubBlock'))return null;
    const peers=[...record.parentElement.children].filter(p=>p.matches('.blockContainer'));
    return {block,record,index:peers.indexOf(record),kind,title:ctripTitle(el)};
  }
  function recordOf(el,kind){return explicitRecordOf(el,kind)||sequentialRecords.get(el)||null;}
  const recordCustomKnown=(profile,kind,label)=>(profile?.[kind]||[]).some((_,index)=>M.recordCustomMatch(profile,kind,index,label).recognized);
  function prepareSequentialRecords(controls,profile){
    sequentialRecords=new WeakMap();sequentialMembers=new WeakMap();
    const kinds=['educations','experiences','projects'],groups=new Map();
    const active=controls.filter(el=>visible(el)&&!['hidden','button','submit','reset','checkbox','file','password'].includes(el.type));
    const entries=active.map(el=>{
      const ownScope=F.section(el);if(M.isCampusSection(ownScope?.title)&&M.moduleContexts(profile,ownScope.title).length)return null;
      const context=contextOf(el),mapping=F.infer(el,context),kind=kinds.includes(context)?context:mapping.key?.split('.')[0];
      if(!kinds.includes(kind)||['sensitive','emergency'].includes(context)||mapping.blocked||M.manualOnly(mapping.label))return null;
      const scope=F.section(el),block=scope?.kind===kind?scope.root:el.closest('section,fieldset,form')||document.body;
      const parts=F.dateParts(el,kind),key=parts?.side?kind+'.'+parts.side:mapping.key|| (recordCustomKnown(profile,kind,mapping.label)?kind+'.recordCustom.'+M.normalize(mapping.label):null);
      if(!key?.startsWith(kind+'.')||mapping.educationScope==='highest'||/^最高(?:学历|学位)/.test(mapping.label)||baiduField(el)?.name==='graduateDate')return null;
      // Malformed decorated records are an explicit conflict, not missing
      // structural evidence. Never bypass the precise adapter's rejection.
      if(el.closest('form#resume_education_form .u-wraps,form#resume_project_form .u-wraps,form#resume_work_form .u-wraps'))return null;
      return {el,kind,key,parts,block,title:scope?.title||{educations:'教育经历',experiences:'工作/实习经历',projects:'项目经历'}[kind],explicit:explicitRecordOf(el,kind)};
    }).filter(Boolean);
    for(const entry of entries){
      if(!groups.has(entry.block))groups.set(entry.block,new Map());
      const byKind=groups.get(entry.block);if(!byKind.has(entry.kind))byKind.set(entry.kind,[]);byKind.get(entry.kind).push(entry);
    }
    for(const byKind of groups.values())for(const list of byKind.values()){
      const {block,kind,title}=list[0],pending=list.filter(e=>!e.explicit);if(!pending.length)continue;
      const logical=e=>e.parts?.root||F.radioGroup(e.el)?.root||F.control(e.el)?.root||e.el;
      const grouped=nodes=>{const keys=new Map();for(const e of nodes){if(!keys.has(e.key))keys.set(e.key,new Set());keys.get(e.key).add(logical(e));}return keys;};
      const within=root=>list.filter(e=>root.contains(e.el));
      const valid=nodes=>nodes.length&&!nodes.some(e=>e.explicit)&&[...grouped(nodes).values()].every(set=>set.size===1);
      const done=new Set(),records=[];
      // Prefer sibling record containers, even when they have no standard
      // class or omit the usual school/company/name field.
      for(const entry of pending){
        if(done.has(entry.el))continue;let candidate=null;
        for(let p=entry.el.parentElement;p&&p!==block&&block.contains(p);p=p.parentElement){
          const members=within(p);if(!valid(members))break;
          const siblings=[...p.parentElement.children].map(within).filter(nodes=>nodes.length);
          const peerRecords=siblings.length>1&&siblings.every(valid)&&siblings.some(nodes=>grouped(nodes).size>=2);
          if(peerRecords&&!entries.some(e=>e.kind!==kind&&p.contains(e.el)))candidate=p;
        }
        if(candidate){const members=within(candidate);records.push(members);members.forEach(e=>done.add(e.el));}
      }
      const rest=pending.filter(e=>!done.has(e.el));
      if(rest.length){
        const keys=grouped(rest),anchor=kind+'.'+{educations:'school',experiences:'company',projects:'name'}[kind];
        const startKey=keys.has(anchor)?anchor:rest[0].key,starts=rest.filter(e=>e.key===startKey);
        const startTokens=new Set(starts.map(logical));
        // Flat forms use a repeated leading identity field. Without one,
        // only a single logical field (e.g. two degree inputs) is unambiguous.
        if(keys.size===1){for(const token of new Set(rest.map(logical)))records.push(rest.filter(e=>logical(e)===token));}
        else if(startTokens.size>1&&rest[0].key===startKey){
          const chunks=[];let chunk=[];let previousStart=null;
          for(const e of rest){if(e.key===startKey&&logical(e)!==previousStart){if(chunk.length)chunks.push(chunk);chunk=[];previousStart=logical(e);}chunk.push(e);}if(chunk.length)chunks.push(chunk);
          if(chunks.every(valid)&&chunks.every(nodes=>nodes[0].key===startKey))records.push(...chunks);
        }else if(valid(rest)&&rest.length===list.length)records.push(rest);
        else {
          // A missing leading field is still a usable partial record. Learn
          // the field order from first appearances, then start the next row
          // at a repeated/backward field; mark this inference for review.
          const order=[...keys.keys()],chunks=[];let chunk=[],last=-1,lastToken=null;
          for(const e of rest){const rank=order.indexOf(e.key),token=logical(e);if(chunk.length&&token!==lastToken&&rank<=last){chunks.push(chunk);chunk=[];}chunk.push(e);last=rank;lastToken=token;}if(chunk.length)chunks.push(chunk);
          // If a late first-seen field precedes a duplicate, it belongs to
          // the next partial row (name A, desc A, role B, desc B).
          for(let i=1;i<chunks.length;i++){const previous=chunks[i-1],next=chunks[i],rank=order.indexOf(next[0].key);while(previous.length>1&&/\.(role|department|college|major)$/.test(previous.at(-1).key)&&/\.description$/.test(next.at(-1).key)&&order.indexOf(previous.at(-1).key)>rank)next.unshift(previous.pop());}
          records.push(...chunks.filter(valid));
        }
      }
      records.sort((a,b)=>controls.indexOf(a[0].el)-controls.indexOf(b[0].el));
      for(const members of records){
        const record=members[0].el,info={record,block,kind,title,index:list.indexOf(members[0]),sequence:true};
        sequentialMembers.set(record,members.map(e=>e.el));for(const entry of members)sequentialRecords.set(entry.el,info);
      }
      // The ordinal is for the webpage, independent of the chosen resume row.
      const identities=[...new Set(list.map(e=>e.explicit?.record||sequentialRecords.get(e.el)?.record).filter(Boolean))];
      for(const e of list){const info=sequentialRecords.get(e.el);if(info)info.index=identities.indexOf(info.record);}
    }
  }
  function highestEducation(profile){const order=M.educationOrder(profile).filter(i=>M.educationRank(profile.educations[i]));return order.at(-1)??0;}
  const educationAnchor=entry=>entry.value&&['educations.school','educations.education','educations.degree','educations.startDate','educations.endDate'].includes(entry.key);
  const datePartNumber=(label,part)=>{const found=String(label).trim().match(part==='year'?/^(\d{4})年?$/:/^(0?[1-9]|1[0-2])月?$/);return found?Number(found[1]):null;};
  const existingPart=el=>el.tagName==='SELECT'?(el.value?cleanLabel(el.selectedOptions[0]?.textContent):''):selectedText(el);
  const recordAnchorFields={educations:['school','education','degree','startDate','endDate'],experiences:['company','role','startDate','endDate'],projects:['name','startDate','endDate']};
  function belongsToRecord(el,kind,profile){const label=labelOf(el),mapping=F.infer(el,kind,label),parts=dateParts(el);return !mapping.blocked&&!M.manualOnly(label)&&!/^最高(?:学历|学位)/.test(label)&&mapping.educationScope!=='highest'&&baiduField(el)?.name!=='graduateDate'&&(mapping.key?.startsWith(kind+'.')||!!parts?.side||!mapping.key&&recordCustomKnown(profile,kind,label));}
  function recordAnchorValues(record,kind){return (sequentialMembers.get(record)||F.controls(record)).map(el=>{
    const parts=dateParts(el),mapping=F.infer(el,kind,labelOf(el));
    const key=mapping.blocked?null:parts?.side?kind+'.'+parts.side:(mapping.key||M.fieldKey(labelOf(el),kind).key);
    return {key,part:parts?.part,value:el.tagName==='SELECT'?(el.value&&!/^(?:请选择|选择|select|choose)/i.test(cleanLabel(el.selectedOptions[0]?.textContent))?cleanLabel(el.selectedOptions[0]?.textContent):''):selectedText(el)};
  }).filter(entry=>entry.value&&recordAnchorFields[kind]?.some(field=>entry.key===kind+'.'+field));}
  const educationValues=record=>recordAnchorValues(record,'educations');
  function anchorDate(value){
    const raw=String(value||'').normalize('NFKC').trim();if(/^(?:至今|present|current|ongoing|now)$/i.test(raw))return '至今';
    const numeric=raw.match(/^([1-9]\d{3})([-/.])(\d{1,2})(?:\2(\d{1,2}))?$/),chinese=raw.match(/^([1-9]\d{3})年(\d{1,2})月(?:(\d{1,2})日)?$/);
    if(!numeric&&!chinese)return '';
    const [year,month,day]=numeric?[numeric[1],numeric[3],numeric[4]]:[chinese[1],chinese[2],chinese[3]];
    const canonical=year+'-'+month.padStart(2,'0')+(day?'-'+day.padStart(2,'0'):'');
    return M.isFullDate(day?canonical:canonical+'-01')?canonical:'';
  }
  function dateAnchorMatches(value,entry){
    if(entry.part)return datePartNumber(entry.value,entry.part)!==null&&datePartNumber(entry.value,entry.part)===Number(splitDate(anchorDate(value),entry.part));
    const saved=anchorDate(value),existing=anchorDate(entry.value);if(!saved||!existing)return false;
    if(saved==='至今'||existing==='至今')return saved===existing;
    // Keep every known day when both sides have it; a month-only control can
    // only constrain the month and must not invent a conflicting day.
    return saved.length===10&&existing.length===10?saved===existing:saved.slice(0,7)===existing.slice(0,7);
  }
  function recentRecordOrder(rows){
    return rows.map((row,index)=>({index,date:anchorDate(row.startDate)})).sort((a,b)=>{
      const aKnown=!!a.date&&a.date!=='至今',bKnown=!!b.date&&b.date!=='至今';
      return Number(bKnown)-Number(aKnown)||(aKnown&&bKnown?b.date.localeCompare(a.date):0)||a.index-b.index;
    }).map(item=>item.index);
  }
  function educationRecordOrder(profile,info={}){
    const order=M.educationOrder(profile);
    if(info.order!=='descending'&&info.order!=='ascending')return profile.educations.map((_,index)=>index);
    if(info.order==='ascending')return order;
    // Unknown levels stay after known qualifications instead of moving to the
    // front when the website explicitly asks for the highest education first.
    return order.map((index,position)=>({index,position,rank:M.educationRank(profile.educations[index])}))
      .sort((a,b)=>Number(!a.rank)-Number(!b.rank)||b.rank-a.rank||a.position-b.position).map(item=>item.index);
  }
  function educationCandidates(profile,entries,used=new Set(),highest=false,info={}){
    const order=highest?[highestEducation(profile)]:educationRecordOrder(profile,info);
    const bilingual=!!info.schoolBilingual&&!!info.record?.closest('form#resume_education_form');
    return order.filter(index=>profile.educations[index]&&(highest||!used.has(index))&&entries.filter(educationAnchor).every(entry=>{
      const field=entry.key.split('.')[1],value=profile.educations[index][field]||'';
      if(field==='school'){
        if(M.normalize(value)===M.normalize(entry.value))return true;
        if(!bilingual)return false;
        const names=String(entry.value).split(/[|｜]/).map(M.normalize).filter(Boolean);
        return names.length===2&&names.includes(M.normalize(value));
      }
      if(field.endsWith('Date'))return dateAnchorMatches(value,entry);
      return M.optionScore(value,entry.value)>0;
    }));
  }
  function experienceAssignments(profile,controls){
    const records=new Map(),assignments=new Map(),types=profile.experiences.map(M.experienceType),used=new Set(),anchored=[];
    for(const el of controls){
      const info=recordOf(el,contextOf(el));if(info?.kind!=='experiences'||!belongsToRecord(el,'experiences',profile))continue;
      records.set(info.record,info);
    }
    const allFor=info=>(info.order==='recent-first'?recentRecordOrder(profile.experiences):profile.experiences.map((_,index)=>index)).map(index=>({row:profile.experiences[index],index}));
      for(const info of records.values()){
        const anchors=recordAnchorValues(info.record,'experiences');if(!anchors.length)continue;
        // Existing company/role identifies a record even when the user placed a
        // personal practice in an internship section. Keep its original type.
        const matches=allFor(info).filter(x=>anchors.every(entry=>{const field=entry.key.split('.')[1];return field.endsWith('Date')?dateAnchorMatches(x.row[field],entry):M.normalize(x.row[field])===M.normalize(entry.value);}));
        anchored.push({info,matches});
      }
      // Reserve uniquely identified rows before ambiguous, compatible names
      // use the first remaining resume entry.
      for(const {info,matches} of anchored.sort((a,b)=>(a.matches.length===1?0:1)-(b.matches.length===1?0:1))){
        const candidate=matches.find(x=>!used.has(x.index));
        if(candidate){used.add(candidate.index);assignments.set(info.record,{index:candidate.index,source:(types[candidate.index].type||'类型待确认')+' · 与网站已有公司／岗位／日期对应'+(matches.length>1?'，同名记录按简历顺序':''),reviewNote:matches.length>1?'有多段同名经历，已按简历顺序对应，请核对。':''});}
        else assignments.set(info.record,{index:null,needsRecord:true,reason:'网站已有公司、岗位或日期与可用资料不一致，请确认这一整段'});
      }
      // Explicit internship/work categories get first choice, across the
      // whole page. Unknown types then fill remaining slots without reuse.
      for(const allowUnknown of [false,true])for(const info of records.values())if(!assignments.has(info.record)||assignments.get(info.record).needsRecord){
        const target=M.sectionExperienceType(info.title),all=allFor(info);
        const uncertain=assignments.get(info.record);
        const candidate=all.find(x=>!used.has(x.index)&&(!target||types[x.index].type===target||allowUnknown&&!types[x.index].type));
        if(candidate){used.add(candidate.index);assignments.set(info.record,{index:candidate.index,source:(target?target+' · ':'')+(info.order==='recent-first'?'按经历开始时间从近到远对应':'按简历顺序对应'),reviewNote:uncertain||target&&!types[candidate.index].type?'归属或经历类型未能确定，按简历第 '+(candidate.index+1)+' 条补填，请核对。':''});}
        else if(allowUnknown){
          const alternatives=target==='实习'?all.filter(x=>types[x.index].type==='其他实践'&&!used.has(x.index)).map(x=>x.index):[];
          const needsRecord=alternatives.length>0;
          assignments.set(info.record,{index:null,needsRecord,noRecord:!needsRecord,alternatives,reason:alternatives.length?'还有'+alternatives.length+'段其他实践，可在本段上方选择填入；原经历类型保持不变':'资料没有更多'+(target||'对应')+'经历，此栏可留空'});
        }
      }
    return assignments;
  }
  function educationAssignments(profile,controls){
    const records=new Map(),assignments=new Map(),used=new Set(),anchored=[];
    for(const el of controls){const info=recordOf(el,contextOf(el));if(info?.kind==='educations'&&belongsToRecord(el,'educations',profile))records.set(info.record,info);}
    for(const info of records.values()){
      const baiduSchool=isBaidu?[...info.record.querySelectorAll('.brick-select')].find(el=>baiduField(el)?.name==='school'):null;
      const entries=educationValues(info.record),highest=info.order!=='descending'&&/最高(?:学历|学位)/.test(info.title);
      const baiduValue=baiduSchool&&cleanLabel(baiduSchool.querySelector('.brick-select-selection-selected')?.textContent);if(baiduValue&&!entries.some(e=>e.key==='educations.school'))entries.push({key:'educations.school',value:baiduValue});
      if(!entries.length&&!highest)continue;
      const matches=educationCandidates(profile,entries,new Set(),highest,info);anchored.push({info,matches,highest});
    }
    for(const {info,matches,highest} of anchored.sort((a,b)=>(a.matches.length===1?0:1)-(b.matches.length===1?0:1))){
      const index=matches.find(i=>highest||!used.has(i));
      if(index!==undefined){if(!highest)used.add(index);assignments.set(info.record,{index,source:highest?'本栏明确要求最高学历':'与网站已有教育资料对应'+(matches.length>1?'，兼容记录按'+(info.order==='descending'?'学历从高到低':info.order==='ascending'?'学历从低到高':'简历顺序'):''),reviewNote:matches.length>1?'有多段兼容的教育资料，已按默认顺序对应，请核对。':''});}
      else assignments.set(info.record,{index:null,needsRecord:!!profile.educations.length,noRecord:!profile.educations.length,reason:'网站已有教育资料与保存记录不一致，请核对这一整段'});
    }
    for(const info of records.values())if(!assignments.has(info.record)||assignments.get(info.record).needsRecord){
      const uncertain=assignments.get(info.record);
      const index=educationRecordOrder(profile,info).find(i=>!used.has(i));
      if(index!==undefined){used.add(index);assignments.set(info.record,{index,source:info.order==='descending'?'按学历从高到低对应':info.order==='ascending'?'按学历从低到高对应':'按简历顺序对应',reviewNote:uncertain?'已有信息不能确定归属，按简历第 '+(index+1)+' 条补填，请核对。':''});}
      else assignments.set(info.record,{index:null,noRecord:true,reason:'资料没有更多教育经历，此栏可留空'});
    }
    return assignments;
  }
  function projectAssignments(profile,controls){
    const records=new Map(),assignments=new Map(),used=new Set(),anchored=[];
    for(const el of controls){const info=recordOf(el,contextOf(el));if(info?.kind==='projects'&&belongsToRecord(el,'projects',profile))records.set(info.record,info);}
    const projectOrder=info=>info.order==='recent-first'?recentRecordOrder(profile.projects):profile.projects.map((_,index)=>index);
    for(const info of records.values()){
      const anchors=recordAnchorValues(info.record,'projects');if(!anchors.length)continue;
      const matches=projectOrder(info).map(index=>({row:profile.projects[index],index})).filter(x=>anchors.every(entry=>{
        const field=entry.key.split('.')[1];return field==='name'?M.normalize(x.row.name)===M.normalize(entry.value):dateAnchorMatches(x.row[field],entry);
      }));
      anchored.push({info,matches});
    }
    for(const {info,matches} of anchored.sort((a,b)=>(a.matches.length===1?0:1)-(b.matches.length===1?0:1))){
      const candidate=matches.find(x=>!used.has(x.index));
      if(candidate){
        used.add(candidate.index);assignments.set(info.record,{index:candidate.index,source:'与网站已有项目名称／日期对应'+(matches.length>1?'，同名记录按'+(info.order==='recent-first'?'官网时间顺序':'简历顺序'):''),reviewNote:matches.length>1?'有多段同名项目，已按默认顺序对应，请核对。':''});
      }else assignments.set(info.record,{index:null,needsRecord:true,reason:matches.length?'这个项目已用于其他栏，请核对当前项目资料':'网站已有项目名称或日期与保存记录不一致，请核对这一整段'});
    }
    for(const info of records.values())if(!assignments.has(info.record)||assignments.get(info.record).needsRecord){
      const uncertain=assignments.get(info.record);
      const index=projectOrder(info).find(i=>!used.has(i));
      if(index!==undefined){used.add(index);assignments.set(info.record,{index,source:info.order==='recent-first'?'按项目开始时间从近到远对应':'按简历顺序对应',reviewNote:uncertain?'已有信息不能确定归属，按简历第 '+(index+1)+' 条补填，请核对。':''});}
      else assignments.set(info.record,{index:null,noRecord:true,reason:'资料没有更多项目经历，此栏可留空'});
    }
    return assignments;
  }
  function huaweiRecordIssue(d){
    if(!isHuawei||!d.recordInfo||d.needsRecord||d.noRecord||!d.occupied||!d.value||!d.key?.startsWith(d.recordInfo.kind+'.'))return '';
    if(/\.(startDate|endDate)$/.test(d.key)&&monthValue(d.existing)===monthValue(d.fullValue)&&/^\d{4}-\d{2}$/.test(d.fullValue))return '';
    if(M.optionScore(d.value,d.existing))return '';
    return '网站已有内容与本段资料不一致，请核对；若为串填，清空此项后重新填写。\n本段资料：'+d.value;
  }
  const hasPresent=el=>!!mokaField(el)&&[...mokaField(el).querySelectorAll('input[type="checkbox"]')].some(x=>labelOf(x)==='至今');
  function assignRecordValue(d,value){
    d.fullValue=value;d.value=d.present?(value==='至今'?'至今':''):splitDate(value,d.part);
    d.skip=!!((d.present&&/^\d{4}-\d{2}(?:-\d{2})?$/.test(value))||(d.part&&value==='至今'&&hasPresent(d.el)));
    if(d.present&&d.skip)d.reason='这段经历已结束，无需勾选“至今”';
    else if(d.part&&value==='至今')d.reason=hasPresent(d.el)?'将勾选“至今”，结束年月留空':'请在官网选择“至今”';
    if(needsFullDate(d.el)){
      if(d.dateNeedsDay)d.locked=false;
      d.dateConvention='';
      if(d.datePolicy!=='ask'&&(/^(educations|experiences|projects)\.(startDate|endDate)$/.test(d.key||'')||d.moduleDateSide)&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&M.isFullDate(value+'-01')){
        d.value=value+'-01';d.dateConvention=`填写约定：原资料为 ${value}，按当月 1 日填写。`;
      }
      d.dateNeedsDay=!!value&&!M.isFullDate(d.value);
      if(d.dateNeedsDay){d.value='';d.locked=true;d.reason=value==='至今'?'资料为“至今”，请确认结束日期；已有日期可补充后复用':`已知 ${value}，官网要求年月日。补充具体日期，保存后即可自动填写。`;}
    }
  }
  const displayValue=d=>d.value?((d.identity&&d.key!=='basic.documentType'?d.value.slice(0,3)+'••••'+d.value.slice(-4):d.value)+(d.dateConvention?'\n'+d.dateConvention:'')):d.reason;
  function moduleContextOf(el,profile) {
    if(is51job){const title=job51Title(el),root=job51Module(el);if(/家庭|亲属|个人声明/.test(title))return {blocked:true,root};const modules=M.moduleContexts(profile,title);if(modules.length)return {modules,root};}
    let found=null;
    for(let p=el.parentElement,depth=0;p&&p!==document.body&&depth<12;p=p.parentElement,depth++) {
      const headings=[F?.heading(p,(profile.modules||[]).flatMap(m=>[m.name,...m.aliases])),p.getAttribute('data-section'),p.getAttribute('data-kind'),isCtrip?p.querySelector(':scope > .titles')?.textContent:'',textWithoutControls(directClass(p,'blockTitle-')),...[...p.querySelectorAll(':scope > legend,:scope > h2,:scope > h3,:scope > h4,:scope > .section-title,:scope > .card-header h2,:scope > .card-header h3')].map(x=>x.textContent)].filter(Boolean);
      if(headings.some(t=>/家庭|亲属|紧急(?:情况[下时]?)?联[系络]人|推荐人|family|emergency/i.test(t)))return {blocked:true,root:p};
      if(!found){const matches=[...new Map(headings.flatMap(t=>M.moduleContexts(profile,t)).map(m=>[m.id,m])).values()];if(matches.length)found={modules:matches,root:p};}
    }
    return found;
  }
  function moduleRecordRoot(el,root,module) {
    if(is51job&&el.closest('form.basic-wrapper'))return el.closest('form.basic-wrapper');
    const count=p=>[...p.querySelectorAll('input,textarea,select,[role="combobox"],[contenteditable="true"]')].filter(x=>visible(x)&&M.moduleFields(module,labelOf(x,x.type==='radio')).length===1).length;
    for(let p=el.parentElement;p&&p!==root&&root.contains(p);p=p.parentElement) {
      if(p.matches('[data-record],[data-entry],.module-record,.record,.record-item,.entry,.repeat-item,.experience-item,fieldset')||classStarts(p,'apply-fields-')||(isCtrip&&p.matches('.blockContainer')))return p;
      if(p.tagName==='FORM'&&[...p.parentElement.children].filter(s=>s.tagName==='FORM').length>1)return p;
      if(count(p)>=2&&[...p.parentElement.children].some(s=>s!==p&&s.tagName===p.tagName&&count(s)>=2))return p;
    }
    return root;
  }
  function moduleAssignments(profile,controls) {
    const assignments=new Map(),groups=new Map();
    if(!profile.modules?.length)return assignments;
    for(const el of controls) {
      if(el.closest('#qingtou-host')||!visible(el)||['hidden','button','submit','reset','image'].includes(el.type))continue;
      const context=moduleContextOf(el,profile);if(!context)continue;
      if(context.blocked){assignments.set(el,{blocked:true,reason:'此字段由你手动填写'});continue;}
      if(context.modules.length!==1){assignments.set(el,{reason:'多个自定义模块对应这个栏目，请手动指定'});continue;}
      const module=context.modules[0],fields=M.moduleFields(module,labelOf(el,el.type==='radio'));
      const root=moduleRecordRoot(el,context.root,module);
      if(!groups.has(module.id))groups.set(module.id,new Map());
      const records=groups.get(module.id);
      if(!records.has(root))records.set(root,{items:[],fields:new Map()});
      const record=records.get(root),a={el,module,contextRoot:context.root,field:fields.length===1?fields[0]:null,record,reason:fields.length>1?'模块内有多个同名字段，请手动指定':fields.length===0?'自定义模块中没有对应字段，请手动指定':''};
      record.items.push(a);assignments.set(el,a);
      if(a.field){const seen=record.fields.get(a.field.id)||new Set();seen.add(el.type==='radio'?'radio:'+el.name:dateParts(el)?(mokaField(el)||dateParts(el).root):el);record.fields.set(a.field.id,seen);}
    }
    for(const group of groups.values()) {
      let index=0;const used=new Set(),anchored=new Map(),candidates=new Map(),conflicts=new Set(),dated=new Set();
      const module=[...group.values()][0].items[0].module,isCampus=[module.name,...module.aliases].some(M.isCampusSection),isAward=M.moduleContexts({modules:[module]},'获奖经历').length===1,isNamed=isAward||isCampus;
      // Some forms omit record wrappers. Repeated award names establish row
      // boundaries; a repeated generic description alone does not.
      const names=M.moduleFields(module,isCampus?'活动名称':'获奖名称'),nameId=names.length===1?names[0].id:null;
      const records=[...group.values()].flatMap(record=>{
        if(!isAward||!nameId||record.fields.get(nameId)?.size<2||record.items.find(a=>a.field)?.field.id!==nameId)return [record];
        const parts=[];let part;
        for(const a of record.items){
          if(!part||a.field?.id===nameId){part={items:[],fields:new Map()};parts.push(part);}
          part.items.push(a);a.record=part;
          if(a.field){const seen=part.fields.get(a.field.id)||new Set();seen.add(a.el.type==='radio'?'radio:'+a.el.name:dateParts(a.el)?(mokaField(a.el)||dateParts(a.el).root):a.el);part.fields.set(a.field.id,seen);}
        }
        return parts;
      }).filter(record=>!isAward||record.fields.size);
      if(isNamed){
        const dateLabels=isCampus?['开始日期','结束日期']:['获奖时间'];
        const dates=dateLabels.flatMap(label=>{const fields=M.moduleFields(module,label);return fields.length===1?fields:[];}),dateIds=new Set(dates.map(f=>f.id));
        for(const record of records){
          if([...record.fields.values()].some(seen=>seen.size>1))continue;
          const anchors=record.items.filter(a=>a.field&&(a.field.id===nameId||dateIds.has(a.field.id))).map(a=>({id:a.field.id,value:existingPart(a.el),part:dateParts(a.el)?.part})).filter(a=>a.value&&!/^(?:请选择|选择|select|choose)/i.test(a.value));
          if(!anchors.length)continue;
          if(anchors.some(a=>dateIds.has(a.id)))dated.add(record);
          const matches=module.entries.map((e,i)=>({e,i})).filter(({e})=>anchors.every(a=>dateIds.has(a.id)?dateAnchorMatches(e.values[a.id],a):M.normalize(e.values[a.id])===M.normalize(a.value)));
          candidates.set(record,matches.map(x=>x.i));
          if(matches.length===1&&!used.has(matches[0].i)){anchored.set(record,matches[0].i);used.add(matches[0].i);}
          else if(!matches.length&&anchors.some(a=>dateIds.has(a.id)))conflicts.add(record);
        }
      }
      for(const record of records) {
        const ambiguous=[...record.fields.values()].some(seen=>seen.size>1);
        const compatible=candidates.get(record)?.find(i=>!used.has(i));
        const exhaustedDate=dated.has(record)&&!anchored.has(record)&&!conflicts.has(record)&&compatible===undefined;
        let matched=isNamed?(ambiguous||conflicts.has(record)||exhaustedDate?-1:anchored.has(record)?anchored.get(record):compatible??module.entries.findIndex((e,i)=>!used.has(i))):index;
        if(is51job){
          const first=record.items[0],block=job51Module(first.el),form=first.el.closest('form.basic-wrapper'),editing=form?.parentElement.previousElementSibling;
          let unknown=false;
          for(const card of block?.querySelectorAll('.field-list-box')||[]){
            if(card===editing)continue;
            const anchors=[...card.querySelectorAll('.field-item')].flatMap(item=>{
              const fields=M.moduleFields(module,item.querySelector('.field-item-label')?.textContent),value=cleanLabel(item.querySelector('.field-item-value')?.textContent);
              return fields.length===1&&value?[{id:fields[0].id,value}]:[];
            });
            const matches=module.entries.map((entry,i)=>({entry,i})).filter(({entry})=>anchors.length&&anchors.every(a=>M.normalize(entry.values[a.id])===M.normalize(a.value)));
            if(matches.length===1)used.add(matches[0].i);else unknown=true;
          }
          const current=record.items.filter(a=>a.field&&selectedText(a.el)).map(a=>({id:a.field.id,value:selectedText(a.el)}));
          const matches=current.length?module.entries.map((entry,i)=>({entry,i})).filter(({entry})=>current.every(a=>M.normalize(entry.values[a.id])===M.normalize(a.value))):[];
          matched=current.length?(matches.length===1?matches[0].i:-1):unknown||editing?.matches('.field-list-box')?-1:module.entries.findIndex((_,i)=>!used.has(i));
          if(matched>=0)used.add(matched);
        }
        if(isNamed&&matched>=0)used.add(matched);
        for(const a of record.items){
          a.index=matched;
          if(ambiguous||conflicts.has(record)){a.field=null;a.reason=ambiguous?'重复记录结构不明确，请手动指定对应记录':isCampus?'已有活动名称或日期与校园资料冲突，请核对；内容不跨活动借用':'已有奖项名称或日期与资料冲突，请核对；日期和说明不跨奖项借用';}
          else if(exhaustedDate){a.field=null;a.reason='这条记录已对应其他网页记录，没有更多兼容资料，请核对重复项';}
          else if(isNamed&&matched>=0&&!anchored.has(record))a.reviewNote='按简历第 '+(matched+1)+' 条'+(isCampus?'校园经历':'奖项')+'补填，请核对对应关系；网页已有内容保留。';
        }
        index++;
      }
    }
    return assignments;
  }
  function scan(profile) {
    mappingProfile=profile;
    F?.beginScan();
    const descriptors=[], counters={}, radioSeen=new Set();
    const controls=[...(F?F.controls():document.querySelectorAll(controlsSelector)),...(isCeair?document.querySelectorAll('.select_box,.select_box2,#spMan'):[])];
    prepareSequentialRecords(controls,profile);
    const moduleMap=moduleAssignments(profile,controls);
    const experienceMap=experienceAssignments(profile,controls);
    const educationMap=educationAssignments(profile,controls);
    const projectMap=projectAssignments(profile,controls);
    const job51Map=job51Assignments(profile,controls);
    for (const el of controls) {
      if (el.closest('#qingtou-host')||(isHuawei&&el.closest('.aui-select-dropdown,.aui-picker-panel'))||(is51job&&el.closest('.el-select-dropdown,.el-picker-panel,.jbs_three_layers_wrapper'))) continue;
      const type=(el.type || '').toLowerCase();
      if (['hidden','button','submit','reset','image'].includes(type) || el.matches(':disabled') || el.closest('[inert],[aria-disabled="true"]') || antSelect(el)?.classList.contains('ant-select-disabled') || F?.control(el)?.root.matches('.atsx-select-disabled') || F?.control(el)?.root.querySelector('.ud__select__selector-disabled') || (el.readOnly&&!mokaField(el)&&!mokaSelect(el)&&!antSelect(el)&&!ctripPicker(el)&&!huaweiSelect(el)&&!job51Select(el)&&!F?.control(el)) || (!visible(el) && type!=='file')) continue;
      if (el.getAttribute('role')==='combobox' && !['INPUT','SELECT'].includes(el.tagName) && [...el.querySelectorAll('input,select,[role="combobox"]')].some(visible)) continue;
      const isRadio=type==='radio';
      let elements=[el];
      if (isRadio) {
        const group=F?.radioGroup(el),token=group?.token||el.name;
        if(!token||radioSeen.has(token))continue;radioSeen.add(token);
        elements=group?.elements||[...(el.form||document).querySelectorAll('input[type="radio"]')].filter(x=>x.name===el.name&&!x.disabled);
      }
      const airline=ceairInfo(el,profile);
      let label=labelOf(el,isRadio);const kind=airline?.key.startsWith('educations.')?'educations':contextOf(el),dateInfo=dateParts(el),recordInfo=recordOf(el,kind);
      const adapterLabel=job51Label(el)||huaweiLabel(el)||baiduLabel(el)||ctripLabel(el)||directClass(mokaField(el),'title-')?.textContent||'';
      const genericMapping=!isRadio&&!airline?F?.infer(el,kind,adapterLabel):null;
      const useGeneric=!!genericMapping&&!isCtrip&&!isBaidu&&!isHuawei&&!isCeair&&!is51job&&!mokaField(el);
      if(useGeneric||genericMapping?.key||genericMapping?.blocked)label=genericMapping.label||'';
      const present=type==='checkbox'&&label==='至今'&&!!recordInfo&&/起止时间|就读时间/.test(directClass(mokaField(el),'title-')?.textContent||'');
      const assignment=job51Map.get(recordInfo?.record)||experienceMap.get(recordInfo?.record)||educationMap.get(recordInfo?.record)||projectMap.get(recordInfo?.record);
      const moduleInfo=moduleMap.get(el),mapping=airline|| (present?{key:kind+'.endDate'}:moduleInfo?{key:null,reason:moduleInfo.reason}:dateInfo?.side&&['educations','experiences','projects'].includes(kind)?{key:kind+'.'+dateInfo.side}:(useGeneric||genericMapping?.key||genericMapping?.blocked?genericMapping:M.fieldKey(label,kind)));
      let key=mapping.key, value='', reason=mapping.reason || '', index=0, source='',customInfo=null;
      const recordCustomKind=recordInfo&&!moduleInfo&&!mapping.blocked&&!M.manualOnly(label)&&(!key||key.startsWith(recordInfo.kind+'.'))?recordInfo.kind:null;
      const recordCustomIndex=assignment?(Number.isInteger(assignment.index)?assignment.index:-1):recordInfo?.index??-1;
      let ownCustom=recordCustomKind?M.recordCustomMatch(profile,recordCustomKind,recordCustomIndex,label):null;
      let customFieldId='',customReview='';
      const moduleField=moduleInfo?.field?moduleInfo:(!moduleInfo&&!key&&!ownCustom?.recognized?M.unscopedModuleField(profile,label):null);
      if(moduleField){const m=moduleField.module,f=moduleField.field;index=moduleField.index??0;key='modules';value=m.entries[index]?.values[f.id]||'';const nameField=M.moduleFields(m,'获奖名称');const title=nameField.length===1?m.entries[index]?.values[nameField[0].id]:'';source=m.name+' · '+(title||(index<0?'未对应记录':'第 '+(index+1)+' 条'))+' · '+f.label;reason=value?'':index<0?'资料没有更多对应记录，请先在资料页添加':'这条模块记录尚未填写此项';}
      else if (key) { index=key.startsWith('basic.')?0:recordInfo?.index??(counters[key] || 0);if(/^最高(?:学历|学位)/.test(label)||baiduField(el)?.name==='graduateDate'||genericMapping?.educationScope==='highest'){index=highestEducation(profile);}else if(!key.startsWith('basic.')&&!recordInfo)counters[key]=index+1; value=M.resolve(profile,key,index);if(genericMapping?.educationScope==='highest')source='最高学历'+(profile.educations[index]?.school?' · '+profile.educations[index].school:''); if(!value)reason=M.identityKey(label)?'请补充本人的证件资料；存在不同号码时请在基本信息中明确选择':'已识别字段，资料中没有填写这一项'; }
      if(airline){
        index=airline.index;value=index>=0?M.resolve(profile,key,index):'';source=airline.source||'';
        reason=airline.reason||(!value?'资料中没有填写这一项，请补充后再填写':'');
        if(ceairSelect(el)&&key==='educations.education'&&value){
          const options=[...el.querySelectorAll(':scope > ul > li')].map(o=>cleanLabel(o.textContent));
          if(options.some(o=>/^(非)?全日制/.test(o))){
            const mode=profile.educations[index]?.studyMode;
            if(mode)value=mode+value;else{value='';key='educations.studyMode';reason='官网区分全日制和非全日制，请补充这段教育经历的教育类型';}
          }
        }
      }
      const needsRecord=!!assignment?.needsRecord,noRecord=!!assignment?.noRecord;
      const explicitEducation=!!airline||/^最高(?:学历|学位)/.test(label)||baiduField(el)?.name==='graduateDate'||genericMapping?.educationScope==='highest';
      if(assignment&&key?.startsWith(recordInfo.kind+'.')&&!explicitEducation){
        index=assignment.index??-1;value=index>=0?M.resolve(profile,key,index):'';
        source=index>=0?`${profile[recordInfo.kind][index].school||profile[recordInfo.kind][index].company||profile[recordInfo.kind][index].name||'资料第 '+(index+1)+' 条'} · ${assignment.source}`:'';
        reason=index<0?assignment.reason:value?'':'这段经历的资料中没有填写此项';
      }
      if(recordCustomKind&&!moduleField){
        if(!key)index=recordCustomIndex;
        ownCustom=M.recordCustomMatch(profile,recordCustomKind,index,label);
        if(ownCustom?.recognized){
          if(value){if(ownCustom.conflict||ownCustom.value&&ownCustom.value!==value)customReview='内置资料与这段经历的自定义字段内容不同，先使用内置资料，请核对。';}
          else {key=key||'recordCustom';value=ownCustom.value;reason=value?'':ownCustom.reason||reason;customFieldId=ownCustom.fieldId;customReview=ownCustom.reviewNote||'';customInfo=ownCustom;source=(profile[recordCustomKind]?.[index]?.school||profile[recordCustomKind]?.[index]?.company||profile[recordCustomKind]?.[index]?.name||'资料第 '+(index+1)+' 条')+' · '+(ownCustom.source||'自定义字段');}
        }else if(!key){reason=recordCustomIndex<0?'资料没有更多对应经历':'这段经历尚未添加此字段，可点击“补充此项”保存';}
      }
      if(!moduleInfo&&!moduleField&&!recordCustomKind&&!mapping.blocked&&!M.manualOnly(label)&&(kind!=='emergency'||key?.startsWith('basic.emergency'))&&(!key||(key.startsWith('basic.')&&!value&&!M.identityKey(label)))){
        // Preserve the contact meaning established by the section, even when
        // the visible label is only "姓名" or "电话".
        customInfo=M.customMatch(profile,contactQuestions[key]||label);
        if(customInfo.value){value=customInfo.value;if(!key){key='custom';index=customInfo.index;}reason='';source=customInfo.source;}
        else if(customInfo.recognized)reason=customInfo.reason||reason;
      }
      if (type==='file') { value=''; key='attachment'; reason='请在此行勾选，单独授权上传'; if (/简历|resume|curriculum|\bcv\b/i.test(label) && profile.attachment) value=profile.attachment.name; }
      const protectedField=(type==='checkbox'&&!present)||type==='password'||(type==='search'&&!antSelect(el)&&!huaweiSelect(el)&&!['select','region'].includes(F?.control(el)?.type))||ctripRegionSearch(el)||kind==='sensitive'||moduleInfo?.blocked||mapping.blocked||F?.control(el)?.multiple||M.manualOnly(label)||!!(job51Select(el)?.querySelector('.el-select__tags'))||!!(is51job&&el.closest('.el-form-item')?.querySelector('.el-form-item-mask'));
      if(protectedField){value='';key=null;reason=mapping.blocked?mapping.reason||'字段含义需要确认':'此字段由你手动填写';}
      const identityIssue=key==='basic.documentNumber'?atsxIdentityIssue(el,profile):'';
      if(identityIssue){value='';reason=identityIssue;}
      const fullValue=value;
      if(dateInfo){value=splitDate(value,dateInfo.part);if(fullValue&&!value)reason=fullValue==='至今'?'请在官网勾选“至今”，结束年月保留为空':'资料没有可用的完整年月';label=(dateInfo.side?(kind==='educations'?(dateInfo.side==='startDate'?'入学':'毕业'):(dateInfo.side==='startDate'?'开始':'结束')):label)+' · '+(dateInfo.part==='year'?'年':'月');}
      const customReadonly=F?.control(el)?.library==='ud-range'||el.readOnly&&!mokaSelect(el)&&!antSelect(el)&&!ctripPicker(el)&&!huaweiSelect(el)&&!job51Select(el)&&!['select','region'].includes(F?.control(el)?.type)&&!['ant3-date','ant3-month'].includes(F?.control(el)?.library);
      if(customReadonly){reason=ctripPicker(el)&&value==='至今'?'资料为“至今”，请在官网确认结束日期':ctripPicker(el)&&/^\d{4}-\d{2}$/.test(value)?'资料只有年月，携程要求年月日，请在官网补充具体日期':key==='basic.birthDate'&&profile.basic.birthMonth&&!profile.basic.birthDate?'资料只有出生年月，请在官网补充具体日期':'日期控件需在官网手动选择';value='';}
      const existing=isRadio?elements.find(x=>x.checked)?.value || '':type==='checkbox'?(el.checked?'已勾选':''):type==='file'?(el.files?.length?'已有文件':''):selectedText(el);
      const placeholderSelected=el.tagName==='SELECT' && /请选择|select|choose/i.test(el.selectedOptions[0]?.textContent || '');
      const occupied=!!existing && !placeholderSelected;
      const descriptor={id:String(descriptors.length),el,elements,type,label:label||'未命名字段',kind,key,index,value,fullValue,part:dateInfo?.part,present,recordInfo,needsRecord,noRecord,moduleId:moduleField?.module?.id,fieldId:moduleField?.field?.id,recordCustomKind,customFieldId,recognized:!!key||!!mapping.recognized||!!moduleField||!!customInfo?.recognized,reason,source,occupied,existing,datePolicy:profile.preferences?.monthOnlyDates||'first-day',locked:customReadonly||protectedField||!!identityIssue};
      descriptor.reviewNote=[moduleInfo?.reviewNote,assignment?.reviewNote||(recordInfo?.sequence&&index>=0?'按网页字段顺序推测为简历第 '+(index+1)+' 条，请核对整段归属。':''),customReview].filter(Boolean).join(' ');
      if(!moduleInfo&&M.isCampusSection(F.section(el)?.title)&&key?.startsWith('projects.'))descriptor.reviewNote=[descriptor.reviewNote,'校园经历使用对应项目资料补填，请核对这段活动是否适合该栏目。'].filter(Boolean).join(' ');
      descriptor.alternatives=assignment?.alternatives||[];
      descriptor.answerConflict=!!customInfo?.conflict;
      descriptor.customLabel=contactQuestions[key]||label;
      descriptor.identity=!!M.identityKey(label);
      descriptor.moduleRecord=moduleInfo?.record;
      descriptor.moduleContextId=moduleInfo?.module?.id;
      descriptor.moduleDefinition=moduleField?.module;
      descriptor.moduleDateSide=moduleField&&[moduleField.module.name,...moduleField.module.aliases].some(M.isCampusSection)?['startDate','endDate'].find((side,i)=>M.moduleFields(moduleField.module,i?'结束日期':'开始日期').some(f=>f.id===moduleField.field.id)):undefined;
      descriptor.moduleRoot=moduleInfo?.contextRoot;
      descriptor.moduleLabel=moduleField?labelOf(el,isRadio):'';
      descriptor.awardDate=!!moduleField&&M.moduleContexts({modules:[moduleField.module]},'获奖经历').length===1&&M.moduleFields(moduleField.module,'获奖时间').some(f=>f.id===moduleField.field.id);
      descriptor.fieldContainer=F?.fieldWrapper(el);
      descriptor.evidence=genericMapping?.key?genericMapping.source:'';
      if(ctripPhone(el))descriptor.phoneColumn=el.closest('.phone-editing');
      if(present||dateInfo||needsFullDate(el))assignRecordValue(descriptor,fullValue);
      if(customReadonly||protectedField)descriptor.value='';
      const recordHint={educations:'教育经历',experiences:'实习或工作经历',projects:'项目'}[key?.split('.')[0]];
      const recordReason='这组'+(recordHint||'经历')+'字段的分段边界存在冲突，无法安全按简历顺序对应。请展开完整表单后重新识别，或在官网核对。';
      if(isHuawei&&/^(educations|experiences|projects)\./.test(key||'')&&!recordInfo){descriptor.locked=true;descriptor.value='';descriptor.reason=recordReason;}
      const keyGroup=key?.split('.')[0];
      if(!isHuawei&&!isCtrip&&!isBaidu&&!isCeair&&!is51job&&!airline&&['educations','experiences','projects'].includes(keyGroup)&&!recordInfo&&(profile[keyGroup]?.length||0)>1&&!/^最高(?:学历|学位)/.test(label)&&genericMapping?.educationScope!=='highest'){descriptor.locked=true;descriptor.value='';descriptor.reason=recordReason;}
      descriptors.push(descriptor);
    }
    const splitGroups=new Map();
    for(const d of descriptors.filter(d=>d.part)){
      const parts=dateParts(d.el);if(!parts)continue;
      if(!splitGroups.has(parts.root))splitGroups.set(parts.root,new Map());
      const sides=splitGroups.get(parts.root),side=parts.side||d.key||'date';if(!sides.has(side))sides.set(side,[]);sides.get(side).push(d);
    }
    for(const sides of splitGroups.values())for(const group of sides.values()){
      const conflict=group.some(d=>d.occupied&&d.fullValue&&datePartNumber(existingPart(d.el),d.part)!==Number(splitDate(d.fullValue,d.part)));
      if(conflict)for(const d of group.filter(d=>!d.occupied)){d.locked=true;d.value='';d.reason='网站已有年月与保存日期不一致，请核对这一组日期；已有内容会保留。';}
    }
    const recordDates=new Map();for(const d of descriptors.filter(d=>d.recordInfo&&/\.(startDate|endDate)$/.test(d.key||''))){const token=d.recordInfo.record;if(!recordDates.has(token))recordDates.set(token,[]);recordDates.get(token).push(d);}
    for(const [token,dates] of recordDates){
      const existingDates=recordAnchorValues(token,dates[0].recordInfo.kind);
      const sideValue=side=>{
        const fields=dates.filter(d=>d.key.endsWith('.'+side)),parts=fields.filter(d=>d.part);if(!fields.length){const existing=existingDates.filter(e=>e.key.endsWith('.'+side)),year=existing.find(e=>e.part==='year'),month=existing.find(e=>e.part==='month');if(year&&month){const y=datePartNumber(year.value,'year'),m=datePartNumber(month.value,'month');return {value:y&&m?String(y)+'-'+String(m).padStart(2,'0'):'',invalid:!y||!m};}const raw=existing.find(e=>!e.part)?.value,value=anchorDate(raw);return {value,invalid:!!raw&&!value};}
        if(parts.length){const year=parts.find(d=>d.part==='year'),month=parts.find(d=>d.part==='month');if(!year||!month)return {value:''};const read=d=>d.occupied?existingPart(d.el):splitDate(d.fullValue,d.part),y=read(year),m=read(month);if(!y||!m)return {value:''};const yn=datePartNumber(y,'year'),mn=datePartNumber(m,'month');return {value:yn&&mn?String(yn)+'-'+String(mn).padStart(2,'0'):'',invalid:!yn||!mn};}
        const field=fields[0],raw=field.occupied?existingPart(field.el):field.fullValue,value=anchorDate(raw);return {value,invalid:!!raw&&!value};
      };
      const start=sideValue('startDate'),end=sideValue('endDate'),precision=start.value.length===10&&end.value.length===10?10:7;
      const reason=start.invalid||end.invalid?'日期不是有效年月或日期，请核对；其他资料继续补填。':start.value&&end.value&&start.value!=='至今'&&end.value!=='至今'&&start.value.slice(0,precision)>end.value.slice(0,precision)?'开始时间晚于结束时间，请核对；其他资料继续补填。':'';
      if(reason)for(const d of dates.filter(d=>!d.occupied)){d.locked=true;d.value='';d.reason=reason;d.reviewNote=reason;}
    }
    F?.endScan();return descriptors;
  }
  function liveElement(d){
    if(d.el.isConnected)return d.el;
    // Ctrip remounts the number input when its empty/nonempty state changes.
    // Rebind only the unique phone input in the original, still-connected column.
    if(d.phoneColumn?.isConnected){
      const candidates=[...d.phoneColumn.querySelectorAll('input')].filter(ctripPhone);
      if(candidates.length===1){d.el=candidates[0];d.elements=[d.el];return d.el;}
    }
    if(d.fieldContainer?.isConnected){
      const candidates=F.controls(d.fieldContainer).filter(el=>{
        if(el.tagName!==d.el.tagName||el.type!==d.type)return false;
        const inferred=F.infer(el,d.kind);
        if(d.key==='modules'){
          if(inferred.blocked||!d.moduleRoot?.isConnected||M.normalize(labelOf(el,d.type==='radio'))!==M.normalize(d.moduleLabel))return false;
          const context=moduleContextOf(el,{modules:[d.moduleDefinition]}),fields=M.moduleFields(d.moduleDefinition,labelOf(el,d.type==='radio'));
          return context?.root===d.moduleRoot&&!context.blocked&&context.modules?.length===1&&fields.length===1&&fields[0].id===d.fieldId;
        }
        return d.key==='recordCustom'?!inferred.blocked&&contextOf(el)===d.kind&&M.normalize(inferred.label)===M.normalize(d.label):inferred.key===d.key;
      });
      if(candidates.length===1){d.el=candidates[0];d.elements=[d.el];return d.el;}
    }
    return null;
  }
  function currentField(d){
    const el=liveElement(d);if(!el)return null;
    const value=d.type==='radio'?d.elements.find(x=>x.checked)?.value||'':d.type==='checkbox'?(el.checked?'已勾选':''):d.type==='file'?(el.files?.length?'已有文件':''):selectedText(el);
    const placeholder=el.tagName==='SELECT'&&/请选择|select|choose/i.test(el.selectedOptions[0]?.textContent||'');
    return {value,occupied:!!value&&!placeholder};
  }
  function nativeValue(el,value) {
    if (el.isContentEditable) el.textContent=value;
    else {
      const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if(setter)setter.call(el,value);else el.value=value;
    }
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    el.dispatchEvent(new Event('blur',{bubbles:true}));
  }
  const radioLabel = el => (el.labels?.[0]?.textContent || el.getAttribute('aria-label') || '').trim();
  function mokaOptions(root){
    const candidates=[...root.querySelectorAll('[class*="sd-Menu-container-"],[class*="sd-Select-common-item-"]')]
      .filter(el=>(classStarts(el,'sd-Menu-container-')||classStarts(el,'sd-Select-common-item-'))&&closestClass(el,'sd-Dropdown-container-')===root&&visible(el));
    return candidates.filter(el=>{
      // Some selects wrap each menu row. Keep its inner clickable row only.
      if(candidates.some(other=>other!==el&&el.contains(other)))return false;
      for(let p=el;p&&p!==root;p=p.parentElement){
        if(p.matches('[aria-disabled="true"],[disabled]')||[...p.classList].some(c=>/disabled/i.test(c)))return false;
      }
      return true;
    });
  }
  const mokaOptionText=el=>cleanLabel(el.querySelector('[data-key="sugar.select.label"],[class*="option-label-"]')?.textContent||el.textContent);
  async function mokaChoose(d){
    const el=d.el,root=closestClass(el,'sd-Dropdown-container-'),before=selectedText(el),queryBefore=el.value;
    if(!root)return '下拉结构已变化，请重新识别';
    const choices=()=>mokaOptions(root);
    const pick=items=>{const options=items.map((x,index)=>({label:mokaOptionText(x),index}));if(d.part){const values=options.filter(o=>/^\d{1,4}[年月]?$/.test(o.label)&&Number(o.label.replace(/[年月]/g,''))===Number(d.value));return values.length===1?values[0]:null;}return M.chooseOption(d.value,options);};
    const close=()=>{el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));el.blur();};
    el.click();let items=[],picked;
    for(let i=0;i<8;i++){await wait(90);items=choices();picked=pick(items);if(picked)break;}
    if(!picked&&!el.readOnly&&/学校|专业/.test(d.label)){
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,d.value);el.dispatchEvent(new Event('input',{bubbles:true}));
      for(let i=0;i<12;i++){await wait(100);items=choices();picked=pick(items);if(picked)break;}
    }
    if(!picked){if(el.value!==queryBefore){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,queryBefore);el.dispatchEvent(new Event('input',{bubbles:true}));}close();return '没有唯一匹配的下拉选项，请手动选择';}
    items[picked.index].scrollIntoView({block:'nearest',inline:'nearest'});items[picked.index].click();
    const accepts=value=>d.part?/^\d{1,4}[年月]?$/.test(value)&&Number(value.replace(/[年月]/g,''))===Number(d.value):M.optionScore(d.value,value)>0;
    let after='',accepted=false;for(let i=0;i<10;i++){await wait(80);after=selectedText(el);if(accepts(after)){accepted=true;break;}}close();
    if(!accepted)return '网站未确认选项，请手动核对';history.push({el,type:'custom',before,after});return '';
  }
  // rc-select has hidden accessibility options as well as visible virtual rows.
  // Follow this input's listbox ID, and select only visible, enabled rows in that popup.
  function antOptions(el){
    const ids=(el.getAttribute('aria-controls')||el.getAttribute('aria-owns')||'').split(/\s+/).filter(Boolean);
    const popups=[...new Set(ids.map(id=>document.getElementById(id)?.closest('.ant-select-dropdown')).filter(p=>p&&visible(p)))];
    if(popups.length!==1)return [];
    return [...popups[0].querySelectorAll('.ant-select-item-option')].filter(p=>visible(p)&&!p.matches('.ant-select-item-option-disabled,[aria-disabled="true"],[disabled]'));
  }
  const antOptionText=el=>cleanLabel(el.querySelector('.ant-select-item-option-content')?.textContent||el.textContent);
  const typeInput=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  async function antChoose(d){
    const el=d.el,root=antSelect(el),before=selectedText(el),queryBefore=el.value;
    const close=()=>{el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));el.blur();};
    const pick=items=>M.chooseOption(d.value,items.map((x,index)=>({label:antOptionText(x),index})));
    el.focus();const selector=root.querySelector('.ant-select-selector');
    selector?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(100);
    if(el.getAttribute('aria-expanded')!=='true')el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',keyCode:40,which:40,bubbles:true}));
    let items=[],picked;
    try{
      for(let i=0;i<8;i++){await wait(100);items=antOptions(el);picked=pick(items);if(picked)break;}
      // Searching is needed to bring schools into the visible virtual list.
      if(!picked&&!el.readOnly&&root.classList.contains('ant-select-show-search')){
        typeInput(el,d.value);
        for(let i=0;i<16;i++){await wait(100);items=antOptions(el);picked=pick(items);if(picked)break;}
      }
      if(!picked)return '没有唯一匹配的下拉选项，请在官网选择';
      const target=items[picked.index];target.scrollIntoView({block:'nearest'});
      target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));target.click();
      for(let i=0;i<12;i++){await wait(100);const after=selectedText(el);if(M.optionScore(d.value,after)>0){history.push({el,type:'custom',before,after});return '';}}
      return '网站尚未确认选项，请手动核对';
    }finally{
      // A search term is not a saved selection; clear it on unsuccessful attempts.
      if(!selectedText(el)&&el.value!==queryBefore&&!el.readOnly)typeInput(el,queryBefore);
      close();
    }
  }
  async function ctripDate(d){
    const el=d.el,value=d.value;
    if(!M.isFullDate(value))return '携程要求有效的年月日，请补充具体日期';
    const before=el.value;
    el.focus();el.click();await wait(100);
    if(el.readOnly){el.blur();return '此日期控件不能输入，请在官网手动选择';}
    typeInput(el,value);await wait(150);
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));
    el.blur();await wait(250);
    if(el.value!==value||el.closest('.ant-form-item-has-error'))return '网站未确认日期，请手动核对';
    history.push({el,type:'custom',before,after:value});return '';
  }
  const monthValue=value=>/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(value||'')&&M.isFullDate(value.length===7?value+'-01':value)?value.slice(0,7):'';
  async function closeHuaweiPopup(el){
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));
    for(const type of ['mousedown','mouseup','click'])document.body.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0}));
    el.blur();await wait(260);
  }
  async function openHuaweiSelect(el){
    await closeHuaweiPopup(el);
    const before=new Set([...document.querySelectorAll('.aui-select-dropdown')].filter(visible));
    el.click();await wait(260);
    const opened=[...document.querySelectorAll('.aui-select-dropdown')].filter(x=>visible(x)&&!before.has(x));
    return opened.length===1?opened[0]:null;
  }
  const huaweiOptionText=el=>cleanLabel(el.querySelector('.aui-select-dropdown__item-label')?.textContent||el.textContent);
  async function readHuaweiSelection(el,popup,expected){
    if(!popup.querySelector('.aui-select-dropdown__item.selected')&&expected&&huaweiSelect(el)?.classList.contains('aui-select__filterable')){
      await searchHuaweiOptions(el,popup,expected);
    }
    const selected=[...popup.querySelectorAll('.aui-select-dropdown__item.selected')];
    return selected.length===1?huaweiOptionText(selected[0]):'';
  }
  async function searchHuaweiOptions(el,popup,value){
    const search=popup.querySelector('input:not([readonly]):not([disabled])')||(!el.readOnly?el:null);
    if(!search)return;
    typeInput(search,value);await wait(50);search.dispatchEvent(new KeyboardEvent('keyup',{key:'End',code:'End',bubbles:true}));await wait(450);
  }
  async function auditHuaweiSelects(){
    for(const root of document.querySelectorAll('.aui-select')){
      const el=root.querySelector('input');if(!el||el.disabled||!visible(el)||!el.value||!M.fieldKey(huaweiLabel(el),huaweiKind(el)).key)continue;
      const expected=el.value,popup=await openHuaweiSelect(el);
      const label=popup?await readHuaweiSelection(el,popup,expected):null;
      await closeHuaweiPopup(el);
      if(label!==null)huaweiSelection.set(root,{display:el.value,label});
    }
  }
  async function huaweiChoose(d){
    const el=d.el,root=huaweiSelect(el),before=el.value,popup=await openHuaweiSelect(el);
    if(!popup)return '未能确定这个下拉框的选项，请手动选择';
    try{
      let choices=()=>[...popup.querySelectorAll('.aui-select-dropdown__item')].filter(e=>visible(e)&&!e.classList.contains('is-disabled'));
      let picked=M.chooseOption(d.value,choices().map(el=>({label:huaweiOptionText(el),el})));
      if(!picked&&root.classList.contains('aui-select__filterable')){
        await searchHuaweiOptions(el,popup,d.value);
        for(let i=0;i<12&&!picked;i++){await wait(120);picked=M.chooseOption(d.value,choices().map(el=>({label:huaweiOptionText(el),el})));}
      }
      if(!picked)return '没有唯一匹配的官网选项；请确认院校地区或在官网选择';
      picked.el.click();await wait(180);
      const verification=await openHuaweiSelect(el),confirmed=verification?await readHuaweiSelection(el,verification,d.value):'';
      await closeHuaweiPopup(el);huaweiSelection.set(root,{display:el.value,label:confirmed});
      if(!M.optionScore(d.value,confirmed)||!M.optionScore(confirmed,el.value))return '下拉选项尚未被网站确认，请手动核对';
      history.push({el,type:'custom',before,after:el.value});return '';
    }finally{await closeHuaweiPopup(el);}
  }
  async function huaweiDate(d){
    const el=d.el,before=el.value;
    if(!M.isFullDate(d.value))return '请补充有效日期后重试';
    el.focus();typeInput(el,d.value);await wait(120);el.dispatchEvent(new Event('change',{bubbles:true}));await wait(120);
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));
    el.dispatchEvent(new FocusEvent('blur',{bubbles:true}));await closeHuaweiPopup(el);await wait(120);
    if(el.value!==d.value||el.closest('.aui-form-item.is-error'))return '网站未确认日期，请手动核对';
    history.push({el,type:'custom',before,after:el.value});return '';
  }
  function baiduRangeIssue(el){
    const f=baiduField(el);if(!f||!['edudate','workdate','subjectDate'].includes(f.name))return '';
    const inputs=[...f.el.querySelectorAll('.brick-date-picker input')],values=inputs.map(x=>monthValue(x.value));
    return values.length===2&&values.every(Boolean)&&values[0]>=values[1]?'开始时间须早于结束时间；请清空错误日期后重新填写':'';
  }
  async function baiduDate(d,profile){
    const el=d.el,value=monthValue(d.value),before=el.value;
    if(!value)return '资料不是有效年月，请补充后重试';
    const f=baiduField(el),pair=f&&[...f.el.querySelectorAll('.brick-date-picker input')];
    if(pair?.length===2){
      const current=pair.map(x=>x===el?value:monthValue(x.value));
      const group=d.key?.split('.')[0],record=profile[group]?.[d.index],start=monthValue(record?.startDate),end=monthValue(record?.endDate);
      if((current.every(Boolean)&&current[0]>=current[1])||(start&&end&&start>=end))return '起止日期顺序不正确，请核对这段经历';
    }
    try{
      // Brick's input/change handler commits the value without opening a calendar.
      // Avoid racing its lazy year-list scrolling against popup teardown.
      typeInput(el,value);await wait(120);
      // Brick checks nativeEvent.code, and blur alone intentionally leaves open=true.
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));
      el.blur();await wait(180);
    }finally{
      // The component closes on document mousedown outside its input and popup.
      (panelHost||document.body).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
      el.blur();await wait(100);
    }
    if(el.value!==value)return '网站未确认日期，请手动核对';
    history.push({el,type:'custom',before,after:value});return '';
  }
  async function ceairChoose(d){
    const el=d.el,before=selectedText(el),trigger=el.querySelector(':scope > .hidden_span,:scope > .hidden_span2');
    if(!trigger)return '未找到下拉控件的展开按钮';
    trigger.click();await wait(120);
    const options=[...el.querySelectorAll(':scope > ul > li')].filter(o=>visible(o)&&!o.matches('.disabled,[aria-disabled="true"]'));
    const picked=M.chooseOption(d.value,options.map(o=>({label:cleanLabel(o.textContent),el:o})));
    if(!picked){document.body.click();return '没有唯一匹配的下拉选项，请核对教育类型等资料';}
    picked.el.click();await wait(120);
    const after=selectedText(el);
    if(!M.optionScore(d.value,after))return '网站未确认选项，请手动核对';
    history.push({el,type:'custom',before,after});return '';
  }
  async function fillOne(d,profile) {
    const el=liveElement(d);
    if (!el || el.matches(':disabled') || el.closest('[inert],[aria-disabled="true"]') || (el.readOnly&&!mokaSelect(el)&&!antSelect(el)&&!ctripPicker(el)&&!huaweiSelect(el)&&!job51Select(el)&&!F?.control(el))) return '字段已变化，请重新识别';
    if(d.key==='basic.documentNumber'){
      const issue=atsxIdentityIssue(el,profile);if(issue)return issue;
    }
    if(isBaidu&&d.key==='basic.documentNumber'){
      const selected=baiduField(el)?.el.querySelector('.brick-select-selection-selected')?.textContent?.trim();
      const intended=M.identityValue(profile,'basic.documentType');
      if(selected&&intended&&!M.optionScore(intended,selected))return '证件类型不一致，请先在官网选择对应类型，再填写号码';
    }
    if(isHuawei&&d.key==='basic.documentNumber'){
      const type=el.closest('.aui-form-item')?.querySelector('.aui-select input'),selected=type&&selectedText(type),intended=M.identityValue(profile,'basic.documentType');
      if(type&&intended&&!M.optionScore(intended,selected))return '证件类型不一致或尚未选中，请先选择对应类型，再填写号码';
    }
    if(d.present){
      if(d.fullValue!=='至今')return '结束时间未明确为至今';
      const before=el.checked;el.click();await wait(120);
      if(!el.checked)return '网站未保留“至今”，请核对';
      history.push({el,type:'present',before,after:true});return '';
    }
    if (d.type==='file') {
      if(!profile.attachment)return '没有简历附件';
      if(el.files.length)return '已有附件，已保留';
      const raw=atob(profile.attachment.data.split(',')[1]), bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
      const file=new File([bytes],profile.attachment.name,{type:'application/pdf'}), dt=new DataTransfer();dt.items.add(file);
      el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));
      if(el.files[0]?.name!==file.name)return '网站未接受附件，请手动上传';
      history.push({el,type:'file',after:file.name});return '';
    }
    if(d.type==='radio') {
      const picked=M.chooseOption(d.value,d.elements.map((x,i)=>({label:radioLabel(x),index:i})));
      if(!picked)return '没有唯一对应的选项';
      const before=d.elements.map(x=>x.checked),target=d.elements[picked.index];
      target.click();await wait(120);
      if(!target.checked)return '网站未保留选项';
      history.push({el:target,elements:d.elements,type:'radio',before,after:target.value});return '';
    }
    if(ceairSelect(el))return ceairChoose(d);
    if(ceairGender(el)){
      const opts=[...el.parentElement.querySelectorAll('#spMan,#spWoman')];
      const picked=M.chooseOption(d.value,opts.map(el=>({el,label:cleanLabel(el.textContent)})));
      if(!picked)return '没有唯一对应的性别选项';
      const before=selectedText(el);picked.el.click();await wait(100);
      const after=selectedText(el);if(!M.optionScore(d.value,after))return '网站未确认性别选项';
      history.push({el,type:'custom',before,after});return '';
    }
    if(F.control(el)?.type==='region'){
      const result=await F.chooseRegion(el,d.value,d.key,d.label);
      if(result.error)return result.error;const target=liveElement(d)||el;history.push({el:target,...result});return '';
    }
    if(job51Select(el)||job51Suggest(el))return job51Choose(d);
    if(job51Date(el))return job51FillDate(d);
    if(mokaSelect(el))return mokaChoose(d);
    if(antSelect(el))return antChoose(d);
    if(huaweiSelect(el))return huaweiChoose(d);
    if(huaweiPicker(el))return huaweiDate(d);
    if(ctripPicker(el))return ctripDate(d);
    if(baiduMonthPicker(el))return baiduDate(d,profile);
    const driver=F?.control(el);
    if(driver){
      const result=driver.type==='date'?await F.date(el,d.value,d.datePolicy,d.key):await F.choose(el,d.value);
      if(result.error)return result.error;history.push({el,...result});return '';
    }
    let value=d.value;
    if(el.tagName==='SELECT') {
      const options=[...el.options].filter(o=>!o.disabled&&!o.closest('optgroup[disabled]')).map(o=>({label:o.textContent.trim(),value:o.value}));
      const matching=d.part?options.filter(o=>datePartNumber(o.label,d.part)!==null&&datePartNumber(o.label,d.part)===Number(value)):[];
      const picked=d.part?(matching.length===1?matching[0]:null):M.chooseOption(value,options);
      if(!picked)return '没有唯一对应的选项';value=picked.value;
    }
    if(d.type==='date' && /^\d{4}-\d{2}$/.test(value))return '资料只有年月，请补充具体日期';
    if(d.type==='month') {
      if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value))return value==='至今'?'请在网站手动选择“至今”':'资料不是有效年月，请手动填写';
      value=value.slice(0,7);
    }
    if(el.maxLength>0 && value.length>el.maxLength)return '超过网站字数限制，请手动精简';
    const before=el.isContentEditable?el.textContent:el.value;
    let intervened=false;
    const userChanged=e=>{if(e.isTrusted&&(e.target===el||e.target===liveElement(d)))intervened=true;};
    document.addEventListener('input',userChanged,true);document.addEventListener('change',userChanged,true);
    try{nativeValue(el,value);if(isCeair||is51job)el.dispatchEvent(new FocusEvent('blur'));await wait(450);}
    finally{document.removeEventListener('input',userChanged,true);document.removeEventListener('change',userChanged,true);}
    if(intervened)return '检测到你已修改此项，已保留你的内容，请核对';
    const target=liveElement(d);
    if(!target)return '字段已变化，请重新识别';
    const after=target.isContentEditable?target.textContent:target.value;
    if(target!==el&&after!==value)return '网站重新生成了输入框，请核对后重新填写';
    if(after!==value){nativeValue(el,before);return '网站未保留填写结果';}
    if((target.validity && !target.validity.valid)||F?.invalid(target)){nativeValue(target,before);return '不符合网站的格式要求';}
    history.push({el:target,type:'text',before,after});return '';
  }
  async function undo() {
    let restored=0,manual=0;
    for(const h of history.toReversed()) {
      if(!h.el.isConnected){manual++;continue;}
      if(h.type==='file'){if(h.el.files?.[0]?.name===h.after){h.el.value='';h.el.dispatchEvent(new Event('change',{bubbles:true}));restored++;}else manual++;}
      else if(h.type==='radio') {if(h.el.checked){h.elements.forEach((x,i)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked').set;setter.call(x,h.before[i]);x.dispatchEvent(new Event('change',{bubbles:true}));});restored++;}else manual++;}
      else if(h.type==='custom'){manual++;}
      else if(h.type==='present'){if(h.el.checked===h.after){h.el.click();restored++;}else manual++;}
      else if((h.el.isContentEditable?h.el.textContent:h.el.value)===h.after){nativeValue(h.el,h.before);restored++;}else manual++;
    }
    history=[];return {restored,manual};
  }
  function mappings(profile) {
    const names={'basic':'基本信息','educations':'教育','experiences':'实习 / 工作','projects':'项目'};
    const fields={name:'姓名 / 名称',phone:'手机号',email:'邮箱',city:'现居城市',gender:'性别',birthDate:'出生日期',birthMonth:'出生年月',ethnicity:'民族',nativePlace:'籍贯',studentOrigin:'生源地',cet4Score:'四级成绩',cet6Score:'六级成绩',honors:'奖励荣誉',patents:'专利情况',college:'学院 / 院系',courses:'核心课程',politicalStatus:'政治面貌',english:'英语水平',website:'个人网站',skills:'技能',introduction:'自我介绍',desiredRole:'意向岗位',desiredCity:'意向城市',school:'学校',major:'专业',education:'学历',degree:'学位',gpa:'绩点',startDate:'开始年月',endDate:'结束年月',company:'公司',department:'任职部门',role:'角色 / 职位',description:'描述'};
    const result=[];
    Object.assign(fields,{experienceType:'经历类型',gradeRank:'成绩排名',laboratory:'实验室',researchField:'领域方向',supervisor:'导师'});
    Object.assign(fields,{nationality:'国籍',studyMode:'教育类型',degreeCategory:'学位分类',studyLength:'学制',schoolRegion:'学校所在国家或地区'});
    Object.assign(fields,{documentType:'证件类型',documentNumber:'证件号码'});
    Object.assign(fields,{emergencyName:'紧急联系人姓名',emergencyPhone:'紧急联系电话',emergencyRelation:'与紧急联系人关系'});
    for(const group of ['basic','educations','experiences','projects'])for(const [i,row] of (group==='basic'?[profile.basic]:profile[group]).entries())for(const [key,value] of Object.entries(row))if(value&&fields[key])result.push({key:group+'.'+key,index:i,value,label:names[group]+(group==='basic'?'':' '+(i+1))+' · '+fields[key]});
    for(const kind of ['educations','experiences','projects'])profile[kind].forEach((row,index)=>(row.customFields||[]).forEach(f=>{if(f.label&&f.value&&!M.manualOnly(f.label))result.push({key:'recordCustom',kind,index,fieldId:f.id,value:f.value,label:names[kind]+' '+(index+1)+' · 自定义 · '+f.label});}));
    profile.custom.forEach((c,i)=>{if(c.label&&c.value)result.push({key:'custom',index:i,value:c.value,label:'自定义 · '+c.label});});
    result.push(...M.moduleMappings(profile));
    return result;
  }
  function fieldState(d){
    if(huaweiRecordIssue(d))return 'failed';
    if(baiduRangeIssue(d.el))return 'failed';
    if(d.stale)return 'failed';
    if(d.validationIssue)return 'failed';
    if(d.outcome==='filled')return 'filled';
    if(d.outcome==='failed')return 'failed';
    if(d.occupied)return 'kept';
    if(d.dateNeedsDay)return 'precision';
    if(d.locked)return 'manual';
    if(d.answerConflict&&!d.value)return 'conflict';
    if(d.noRecord||d.skip)return 'skip';
    if(d.type==='file')return 'attachment';
    if(d.value)return 'ready';
    if(d.needsRecord&&d.recordInfo&&d.key?.startsWith(d.recordInfo.kind+'.'))return 'record';
    return d.recognized?'missing':'unknown';
  }
  const completedStates=new Set(['filled','kept','skip']);
  function issueDetails(d){
    const state=fieldState(d);
    if(d.stale)return ['页面已变化','点击“重新识别”，核对新的输入框。'];
    if(d.rangeIssue||d.recordIssue)return ['已有内容需核对','定位到网页核对已有内容，修正后重新识别。'];
    if(d.validationIssue)return ['网站校验未通过','定位到网页查看校验提示，修正内容后再核对。'];
    if(state==='failed')return ['填写未完成','定位到网页核对选项或校验提示；需要时在官网填写。'];
    if(state==='record')return ['对应经历待确认','在这一段上方选择对应的整段资料。'];
    if(state==='conflict')return ['资料答案有冲突','点击“补充此项”，确认并统一已保存的答案。'];
    if(state==='precision')return ['日期缺少具体日','点击“补充完整日期”，保存真实日期后返回。'];
    if(state==='missing')return ['已识别，资料缺少内容','点击“补充此项”，保存后返回继续填写。'];
    if(state==='unknown')return ['字段含义待指定','选择对应资料项，或点击“补充此项”保存这个问题。'];
    if(state==='attachment')return ['附件待确认','核对文件后单独勾选；上传由网站处理。'];
    if(state==='manual')return ['需要在官网核对','定位到网页查看此项要求，再在官网处理。'];
    return ['', ''];
  }
  function previewSection(d){
    if(d.recordInfo)return {key:d.recordInfo.record,title:(d.recordInfo.title||{'educations':'教育经历','experiences':'实习与工作经历','projects':'项目经历'}[d.recordInfo.kind]||'经历')+' · 第 '+(d.recordInfo.index+1)+' 段'};
    const anchor=d.type==='file'?[...(d.el.labels||[])].find(node=>visible(node)&&node.getBoundingClientRect().height>0)||d.el:d.el;
    for(let node=anchor.parentElement,depth=0;node&&node!==document.body&&depth<18;node=node.parentElement,depth++){
      const card=node.querySelector(':scope > .ant-card-head > .ant-card-head-wrapper > .ant-card-head-title');
      const title=F.heading(node)||(card&&visible(card)?M.labelText(textWithoutControls(card)):'');
      if(title&&title.length<=80)return {key:node,title};
    }
    return {key:d.el.form||d.el.closest('main')||document.body,title:'当前表单'};
  }
  function previewPosition(d,index){
    const el=liveElement(d)||d.el,target=F.control(el)?.root||el,wrapper=F.fieldWrapper(el);
    const box=node=>{if(!node?.isConnected||!visible(node))return null;const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0?rect:null;};
    let rect=box(target),field=box(wrapper),anchor=target;
    if(d.type!=='file'&&wrapper&&F.controls(wrapper).length>1&&!wrapper.matches('.ant-form-item,.el-form-item,.ud-formily-item,.atsx-form-item'))field=box(el.closest('label'))||rect;
    if(d.type==='file'){
      // Upload inputs may be hidden or absolutely positioned at the top of
      // the page. Their visible field/associated label is the page position.
      const label=[...(el.labels||[])].find(node=>box(node));
      if(label){rect=field=box(label);anchor=label;}
      else{
        for(let node=wrapper,depth=0;node&&node!==document.body&&depth<8;node=node.parentElement,depth++)if(box(node)){field=rect=box(node);anchor=node;break;}
      }
    }
    rect=rect||field;field=field||rect;
    return {d,index,anchor,top:field?Math.round((field.top+scrollY)*2)/2:Infinity,left:rect?rect.left:Infinity};
  }
  function previewOrder(descriptors){
    return descriptors.map(previewPosition).sort((a,b)=>a.top-b.top||a.left-b.left||a.index-b.index).map(item=>item.d);
  }
  async function open(profile) {
    if(busy)return;
    currentProfile=profile;
    cleanupPanel();
    if(isHuawei&&panelHost?.isConnected)panelHost.shadowRoot.querySelector('.status').textContent='正在核对官网的下拉选项…';
    if(isHuawei){busy=true;try{await auditHuaweiSelects();}finally{busy=false;}}
    panelHost?.remove();
    panelHost=document.createElement('div');panelHost.id='qingtou-host';document.documentElement.append(panelHost);
    const shadow=panelHost.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      :host{all:initial;position:fixed;z-index:2147483647;right:18px;top:18px;bottom:18px;width:390px;font:13px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;color:#263c37}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}.panel{height:100%;display:flex;flex-direction:column;background:#fffdf8;border:1px solid #dadfd3;border-radius:18px;box-shadow:0 12px 70px #172f3738;overflow:hidden}header{padding:20px 20px 13px;border-bottom:1px solid #e8e9df;display:flex;justify-content:space-between;align-items:center}h2{font-size:19px;margin:0}small{color:#718078}.close{border:0;background:transparent;font-size:23px;color:#708075}.intro{padding:14px 20px 10px;background:#f5f7ef}.summary{font-size:16px;font-weight:650;margin-bottom:6px}.list{padding:4px 20px;overflow:auto;flex:1}.row{padding:13px 0;border-bottom:1px solid #e8eadf}.line{display:flex;gap:8px;align-items:flex-start}.line input{accent-color:#28694e;margin-top:5px}.label{font-weight:650;flex:1}.hint{font-size:12px;color:#8c6a2d}.value{margin:6px 0 4px 22px;white-space:pre-wrap;max-height:80px;overflow:auto;color:#52635b;word-break:break-word}.row select{width:calc(100% - 22px);margin:6px 0 0 22px;padding:6px;border:1px solid #dbe1d5;border-radius:7px;background:white;color:#52635b}.ok{color:#246b4d}.fail{color:#9b5b30}.foot{padding:15px 20px;border-top:1px solid #e2e5dc}.actions{display:flex;gap:8px}.primary{flex:1;color:white;background:#246b4d;border:1px solid #246b4d;border-radius:9px;padding:10px}.secondary{background:white;border:1px solid #d2dbcf;border-radius:9px;color:#365647;padding:10px}.status{margin:10px 0 0;color:#63756a;font-size:12px}.note{margin:0 0 8px;font-size:12px;color:#717b6b}@media(max-width:600px){:host{left:8px;right:8px;top:8px;bottom:8px;width:auto}}
      .correction{margin:6px 0 0 22px;color:#65756b;font-size:12px}.correction summary{cursor:pointer}.correction select{margin:6px 0 0;width:100%}.value{display:block}.value:empty{display:none}.list{min-height:0;overflow-x:hidden}.line{flex-wrap:wrap}.label{min-width:0;overflow-wrap:anywhere}.hint{max-width:100%;overflow-wrap:anywhere;flex-shrink:1}.row select{min-width:0;max-width:100%;text-overflow:ellipsis}.counts{display:flex;gap:5px 10px;flex-wrap:wrap;margin-bottom:8px;font-size:12px}.counts span[data-state="ready"]{color:#246b4d;font-weight:650}.counts span[data-state="failed"]{color:#9b5b30}.choose-records{border:0;padding:0;background:transparent;color:#246b4d;text-decoration:underline;margin-bottom:8px}
      .profile-tools{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.profile-tools button{padding:7px 10px;font-weight:600;font-size:12px}.supplement{margin:8px 0 0 22px;padding:3px 0;border:0;background:transparent;color:#246b4d;text-decoration:underline}.intro{max-height:42%;overflow-y:auto;flex-shrink:0}.foot{flex-shrink:0}.record-note{margin:8px 0;color:#687768;font-size:12px}.use-practice{width:100%;text-align:left;overflow-wrap:anywhere;margin:4px 0}
      .view-tools{display:flex;gap:6px;margin-top:8px;align-items:center}.view-tools button{font-size:12px;padding:5px 9px;border:1px solid #d6ded2;border-radius:7px;color:#365647;background:#fff}.view-tools button[aria-pressed="true"]{background:#e2eee4;border-color:#80a98e;font-weight:650}.view-tools .diagnostics{margin-left:auto}.view-note{font-size:12px;color:#68796c;margin:7px 0 0}.preview-section{margin:12px 0 6px}.section-title{font-size:14px;margin:0;padding:7px 9px;background:#f0f4e9;border-radius:7px}.completed{margin:7px 0;color:#6b786c}.completed>summary{cursor:pointer;padding:6px 0;font-size:12px}.completed .row{opacity:.85}.issue{margin:7px 0 0 22px;color:#805d2e;font-size:12px}.issue b{display:block;font-weight:600}.locate{margin:6px 0 0 22px;padding:2px 0;border:0;background:transparent;color:#396a56;font-size:12px;text-decoration:underline}.version-note{font-size:11px;color:#748073}.row[hidden],.completed[hidden]{display:none!important}.row:focus-within{background:#f7f9f1}.record-picker{border-bottom:1px dashed #d9e0d1}
      </style><section class="panel" aria-label="轻投填写预览"><header><div><h2>轻投 <small> / 填写预览</small></h2><small>检查内容，再写入当前页面 · <span class="runtime-version">0.5.11</span></small></div><button class="close" aria-label="关闭轻投">×</button></header><div class="intro"><div class="summary"></div><div class="counts" aria-live="polite"></div><div class="profile-tools"><button class="primary edit-profile">＋ 补充资料</button><button class="secondary refresh-profile">更新资料</button></div><button class="choose-records" hidden>去确认对应经历 →</button><div class="note">缺少内容可点击“补充此项”；保存后返回继续填写。</div><div class="warning note"></div><div class="view-tools"><button type="button" class="view-pending" aria-pressed="true">待处理</button><button type="button" class="view-all" aria-pressed="false">全部</button><button type="button" class="diagnostics">导出诊断</button></div><p class="view-note"></p><p class="version-note"></p></div><div class="list"></div><div class="foot"><div class="actions"><button class="primary apply">填写所选项</button><button class="secondary rescan">重新识别</button><button class="secondary undo">撤销</button></div><p class="status" role="status">保留已有内容，附件需单独勾选；提交由你完成。</p></div></section>`;
    const descriptors=scan(profile),available=mappings(profile), rows=new Map(),recordSelectors=new Map(),recordBoxes=new Map(),sections=new Map();
    const bindingEntries=()=>descriptors.filter(d=>d.part||d.key==='modules'&&d.moduleId||d.recordInfo&&recordAnchorFields[d.recordInfo.kind]?.some(field=>d.key===d.recordInfo.kind+'.'+field)).map(d=>[d.id,currentField(d)?.value??null]);
    const bindingSnapshot=()=>JSON.stringify(bindingEntries());
    let reviewedBindings=bindingSnapshot();
    const status=shadow.querySelector('.status'), apply=shadow.querySelector('.apply');
    const readout=document.createElement('details');readout.className='profile-readout note';
    const readoutTitle=document.createElement('summary');readoutTitle.textContent='查看本次读取的教育资料';readoutTitle.style.cursor='pointer';readout.append(readoutTitle);
    const version=document.createElement('p');version.textContent='轻投 0.5.11 · '+(profile.preferences?.monthOnlyDates==='ask'?'年月缺少具体日时等待补充':'经历年月按当月 1 日填写');readout.append(version);
    profile.educations.forEach((e,i)=>{const item=document.createElement('p');item.style.overflowWrap='anywhere';item.textContent=`${i+1}. ${e.school||'未填写学校'} · ${e.major||'未填写专业'}\n学院：${e.college||'未填写'}\n毕业年月／日期：${e.endDate||'未填写'}\n学历：${e.education||'未填写'}`;item.style.whiteSpace='pre-wrap';readout.append(item);});
    if(!profile.educations.length){const empty=document.createElement('p');empty.textContent='当前资料没有教育经历。';readout.append(empty);}
    shadow.querySelector('.intro').append(readout);
    let viewMode='all',locatorTimer,locator;
    const sectionFor=group=>{
      if(sections.has(group.id))return sections.get(group.id);
      const section=document.createElement('section');section.className='preview-section';
      const title=document.createElement('h3');title.className='section-title';title.textContent=group.title;
      const pending=document.createElement('div');pending.className='pending-rows';
      section.append(title,pending);
      const entry={section,title,pending};sections.set(group.id,entry);return entry;
    };
    const placeChildren=(parent,nodes)=>{
      let next=parent.firstChild;
      for(const node of nodes){if(node===next)next=next.nextSibling;else parent.insertBefore(node,next);}
      while(next){const stale=next;next=next.nextSibling;stale.remove();}
    };
    const updateLayout=()=>{
      let remaining=0;const groups=[],shownRecords=new Set(),active=new Set();
      for(const d of previewOrder(descriptors)){
        if(!rows.has(d.id))continue;
        const scope=previewSection(d);let group=groups.at(-1);
        // A section that appears again later on the page must stay there,
        // rather than pulling all of its fields into its first occurrence.
        if(!group||group.key!==scope.key){group={...scope,id:d.id,items:[]};groups.push(group);}
        group.items.push(d);
      }
      for(const group of groups){
        const entry=sectionFor(group),nodes=[];let pending=0;active.add(group.id);entry.title.textContent=group.title;
        for(const d of group.items){
          const ui=rows.get(d.id);if(!ui)continue;
          const state=fieldState(d),done=completedStates.has(state)&&!d.reviewNote;ui.row.dataset.state=state;
          const [category,next]=issueDetails(d);ui.issue.replaceChildren();
          if(category){const name=document.createElement('b');name.textContent=category;const action=document.createElement('span');action.textContent=next;ui.issue.append(name,action);}
          ui.issue.hidden=!category;
          if(d.recordInfo&&!shownRecords.has(d.recordInfo.record)){
            const box=recordBoxes.get(d.recordInfo.record);
            if(box){box.hidden=viewMode==='pending'&&!descriptors.some(item=>item.recordInfo?.record===d.recordInfo.record&&(!completedStates.has(fieldState(item))||item.reviewNote));nodes.push(box);}
            shownRecords.add(d.recordInfo.record);
          }
          ui.row.hidden=viewMode==='pending'&&done;
          if(!done){remaining++;pending++;}nodes.push(ui.row);
        }
        entry.section.hidden=viewMode==='pending'&&!pending;placeChildren(entry.pending,nodes);
      }
      for(const [id,entry] of sections)if(!active.has(id)){entry.section.remove();sections.delete(id);}
      if(groups.length)placeChildren(shadow.querySelector('.list'),groups.map(group=>sections.get(group.id).section));
      shadow.querySelector('.view-pending').setAttribute('aria-pressed',String(viewMode==='pending'));
      shadow.querySelector('.view-all').setAttribute('aria-pressed',String(viewMode==='all'));
      shadow.querySelector('.view-note').textContent=!descriptors.length?'请先打开网站的编辑表单。':viewMode==='all'?'按网页顺序显示全部字段，已填内容保留在原位置。':remaining?'待处理 '+remaining+' 项；按网页顺序显示，已完成项暂时隐藏。':'本页已处理；点击“全部”按原位置核对已填内容。';
    };
    const locateField=d=>{
      if(busy)return;
      const el=liveElement(d),target=el&&(d.type==='file'?previewPosition(d,0).anchor:F.control(el)?.root||el);
      if(!target?.isConnected||!visible(target)){status.textContent='这一项的输入框已变化或收起，请展开表单后重新识别。';return;}
      // Scroll and a pointer-transparent outline only: focus/click may open a
      // picker or mutate a website field, so location deliberately emits neither.
      target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      clearTimeout(locatorTimer);locator?.remove();locator=document.createElement('div');locator.id='qingtou-locator';locator.setAttribute('aria-hidden','true');
      const rect=target.getBoundingClientRect();locator.style.cssText=`position:fixed;pointer-events:none;z-index:2147483646;border:3px solid #d88e26;border-radius:5px;left:${rect.left-4}px;top:${rect.top-4}px;width:${rect.width+8}px;height:${rect.height+8}px;box-shadow:0 0 0 4px #fff5;`;
      document.documentElement.append(locator);locatorTimer=setTimeout(()=>locator?.remove(),2400);
      status.textContent='已用橙框标出网页中的“'+d.label+'”。';
    };
    shadow.querySelector('.view-pending').onclick=()=>{viewMode='pending';updateLayout();};
    shadow.querySelector('.view-all').onclick=()=>{viewMode='all';updateLayout();};
    shadow.querySelector('.diagnostics').onclick=()=>{
      if(busy)return;
      if(!globalThis.QTDiagnostics){status.textContent='诊断模块未加载，请从工具栏更新当前页预览后重试。';return;}
      try{const report=QTDiagnostics.build({descriptors,version:'0.5.11',installedVersion:installedVersion(),engine:F,stateOf:fieldState});QTDiagnostics.download(report);status.textContent='已在本地导出脱敏诊断：仅含字段类型、状态和数量，不含填写内容。';}
      catch{status.textContent='诊断未能导出，请更新当前页预览后重试。';}
    };
    const installed=installedVersion();shadow.querySelector('.version-note').textContent=installed?'已安装 '+installed+' · 当前页 '+runtimeInfo().version:'当前页 '+runtimeInfo().version+' · 安装版本请从工具栏查看';
    const stateLabels={ready:'可填',record:'待确认归属',conflict:'待确认答案',precision:'缺完整日期',missing:'缺资料',failed:'失败待核对',filled:'已填',kept:'已保留',skip:'无需填写',manual:'需手动',unknown:'待指定',attachment:'附件'};
    const updateSummary=()=>{
      const counts={};descriptors.forEach(d=>{const key=fieldState(d);counts[key]=(counts[key]||0)+1;});
      shadow.querySelector('.summary').textContent=`找到 ${descriptors.length} 项 · 已识别 ${descriptors.filter(d=>d.recognized).length} 项`;
      const container=shadow.querySelector('.counts');container.replaceChildren();
      for(const [key,label] of Object.entries(stateLabels))if(counts[key]||key==='ready'){const span=document.createElement('span');span.dataset.state=key;span.textContent=`${label} ${counts[key]||0} 项`;container.append(span);}
      const reviews=descriptors.filter(d=>d.reviewNote).length;if(reviews){const span=document.createElement('span');span.style.color='#916019';span.textContent='待核对 '+reviews+' 项';container.append(span);}
      shadow.querySelector('.choose-records').hidden=!counts.record;
      shadow.querySelector('.choose-records').textContent=descriptors.some(d=>d.needsRecord&&d.alternatives.length)?'去选择其他实践 →':'去确认对应经历 →';
      updateLayout();
    };updateSummary();
    const notices=[];if(isHuawei)notices.push('按整段对应教育、工作与项目资料。已有内容与本段资料不一致时会提示核对；确认为串填后，清空错误项即可重新填写。');if(isBaidu)notices.push('已支持百度起止年月填写与日历收起；日期按每段经历配对。证件号码会读取已保存资料。');if(descriptors.some(d=>d.dateConvention))notices.push('经历日期只有年月时，按当月 1 日填写；已有完整日期优先。可在资料页更改此约定。');else if(isCtrip)notices.push('已支持携程的学校、学历下拉框与教育分组；缺完整日期时可补充保存后复用。');if(document.querySelector('iframe'))notices.push('当前页包含嵌入页面，其中的表单可能需要打开独立链接后识别。');if(descriptors.some(d=>d.needsRecord))notices.push('已自动对应明确的经历；归属不明的记录只需在整段上方确认一次。');if(profile.preparationWarning)notices.push(profile.preparationWarning);if(!profile.basic.name)notices.push('插件里尚未填写姓名，请先打开“编辑网申资料”导入简历；网页预览与插件的资料分开保存。');if(descriptors.some(d=>mokaSelect(d.el)))notices.push('年月随对应经历自动填写；简历写明“至今”时可自动勾选。');for(const module of profile.modules.filter(m=>M.moduleContexts({modules:[m]},'获奖经历').length===1)){
      const slots=new Set(descriptors.filter(d=>d.moduleContextId===module.id).map(d=>d.moduleRecord).filter(Boolean)).size;
      if(slots&&module.entries.length>slots)notices.push('资料有 '+module.entries.length+' 条获奖记录，官网当前只有 '+slots+' 条。需要全部填写时，请先在官网添加获奖经历，再重新识别。');
    }shadow.querySelector('.warning').textContent=notices.join(' ');
    if(!descriptors.length){
      const list=shadow.querySelector('.list'),editors=is51job?job51Editors():F?.editors()||[],message=document.createElement('p');
      message.textContent=editors.length?'当前是简历展示页，输入框还未展开。选择下面的栏目打开编辑，轻投会自动识别出现的字段。':is51job?'暂未发现展开的编辑表单。请在官网点击相应栏目的“编辑”或“添加”；表单出现后会自动识别。':'尚未找到可填写字段。若当前是简历展示页，请先打开相应栏目的“编辑／添加”，表单出现后会自动识别。';
      list.append(message);
      for(const editor of editors){
        const button=document.createElement('button');button.className='secondary editor-shortcut';button.style.cssText='display:block;width:100%;margin:10px 0;text-align:left';button.textContent=editor.action+' '+editor.title+' →';
        button.onclick=()=>{
          if(busy)return;
          const fresh=(is51job?job51Editors():F?.editors()||[]).filter(x=>x.module===editor.module&&x.title===editor.title);
          if(fresh.length!==1){status.textContent='页面入口已变化，请点击“重新识别”。';return;}
          fresh[0].button.scrollIntoView({block:'center'});fresh[0].button.click();status.textContent='已打开'+editor.title+'入口，等待表单加载后自动识别。';
        };list.append(button);
      }
      if(is51job||editors.length){const hint=document.createElement('p');hint.className='note';hint.textContent='填写后请在官网核对并保存这一栏，再添加下一段经历。';list.append(hint);apply.disabled=true;apply.textContent='请先打开编辑';shadow.querySelector('.summary').textContent=editors.length?'选择要填写的栏目':'等待打开编辑表单';shadow.querySelector('.counts').style.display='none';}
    }
    for(const d of descriptors){
      if(d.recordInfo&&!recordSelectors.has(d.recordInfo.record)){
        const info=d.recordInfo,box=document.createElement('div');box.className='row record-picker';const title=document.createElement('strong');title.textContent=info.title+' · 第 '+(info.index+1)+' 段';box.append(title);const picker=document.createElement('select');picker.setAttribute('aria-label',info.title+'第'+(info.index+1)+'段对应记录');picker.add(new Option(d.noRecord?'没有对应经历，可留空':'选择这段对应的资料…',''));profile[info.kind].forEach((r,i)=>picker.add(new Option((i+1)+' · '+(r.school||r.company||r.name||'未命名记录')+(r.role?' / '+r.role:'')+(r.startDate?' / '+r.startDate:'')+(info.kind==='experiences'?' / '+(M.experienceType(r).type||'类型待确认'):''),String(i))));picker.value=d.needsRecord||d.noRecord?'':profile[info.kind][d.index]?String(d.index):'';
        picker.onchange=()=>{
          if(busy)return;const chosen=picker.value!==''?Number(picker.value):null;
          for(const item of descriptors.filter(x=>x.recordInfo?.record===info.record&&(!x.locked||x.dateNeedsDay)&&!x.occupied&&x.outcome!=='filled'&&(x.key?.startsWith(info.kind+'.')||x.recordCustomKind===info.kind))){
            item.index=chosen??-1;item.needsRecord=chosen===null;item.noRecord=false;item.outcome=null;item.reason=chosen===null?'请确认这一整段对应的经历':'资料中没有填写这一项';
            const base=chosen!==null&&item.key?.startsWith(info.kind+'.')?M.resolve(profile,item.key,chosen):'',custom=M.recordCustomMatch(profile,info.kind,item.index,item.label);
            item.customFieldId=!base?custom.fieldId||'':'';item.recordCustomKind=info.kind;item.answerConflict=!!custom.conflict;
            item.reviewNote=base&&(custom.conflict||custom.value&&custom.value!==base)?'内置资料与这段经历的自定义字段内容不同，先使用内置资料，请核对。':custom.reviewNote||'';
            if(custom.recognized&&!item.key)item.key='recordCustom';item.recognized=!!item.key||custom.recognized;
            assignRecordValue(item,base||custom.value||'');if(!item.value&&custom.reason)item.reason=custom.reason;
            item.source=chosen===null?'':info.title+' · 资料第 '+(chosen+1)+' 条'+(!base&&custom.source?' · '+custom.source:'')+(info.kind==='experiences'?' · '+(M.experienceType(profile.experiences[chosen]).type||'类型待确认'):'');
            const ui=rows.get(item.id);if(ui){ui.value.textContent=displayValue(item);ui.source.textContent=item.source?'来源：'+item.source:'';ui.check.checked=!!item.value&&!item.locked;ui.check.disabled=item.locked||!item.value;ui.hint.className='hint';ui.hint.textContent=item.dateNeedsDay?'缺完整日期':item.locked?'需手动':item.value?'待填写':item.skip?'无需填写':chosen===null?'待确认归属':'资料缺少';ui.review.textContent=item.reviewNote?'待核对：'+item.reviewNote:'';ui.review.hidden=!item.reviewNote;}
          }updateSummary();
        };box.append(picker);
        if(d.alternatives.length){
          const note=document.createElement('p');note.className='record-note';note.textContent='自媒体等经历归为“其他实践”。如要填写在网站的“'+info.title+'”，选择整段即可带入所有字段，不用修改经历类型。';box.append(note);
          for(const index of d.alternatives){
            const entry=profile.experiences[index],button=document.createElement('button');button.className='secondary use-practice';button.textContent='使用这段：'+(entry.company||entry.role||'其他实践')+(entry.role&&entry.company?' / '+entry.role:'');
            button.onclick=()=>{
              if(busy)return;
              const duplicate=descriptors.find(x=>x.recordInfo?.block===info.block&&x.recordInfo.record!==info.record&&x.key?.startsWith('experiences.')&&x.index===index&&!x.needsRecord&&!x.noRecord);
              if(duplicate){status.textContent='这段资料已用于本栏第 '+(duplicate.recordInfo.index+1)+' 段，请选择其他记录。';return;}
              picker.value=String(index);picker.onchange();status.textContent='已选择整段其他实践，核对后点击“填写所选项”。';
            };box.append(button);
          }
        }
        recordBoxes.set(info.record,box);recordSelectors.set(info.record,picker);
      }
      const row=document.createElement('div');row.className='row';
      const line=document.createElement('label');line.className='line';
      const check=document.createElement('input');check.type='checkbox';check.checked=!!d.value&&!d.occupied&&d.type!=='file';check.disabled=d.locked||d.occupied||!d.value;
      const label=document.createElement('span');label.className='label';label.textContent=d.label;
      const hint=document.createElement('span');hint.className='hint';hint.textContent=d.occupied?'已填 · 保留':d.dateNeedsDay?'缺完整日期':d.locked?'需手动':d.answerConflict&&!d.value?'待确认答案':d.noRecord||d.skip?'无需填写':d.value?'待填写':d.needsRecord?'待确认归属':d.recognized?'待补充资料':'待指定';
      line.append(check,label,hint);row.append(line);
      const value=document.createElement('div');value.className='value';value.textContent=d.occupied?'网站已有内容，将保留':displayValue(d);row.append(value);
      const rangeIssue=baiduRangeIssue(d.el);d.rangeIssue=rangeIssue;
      if(rangeIssue){hint.className='hint fail';hint.textContent='日期顺序需核对';value.textContent=rangeIssue;}
      d.recordIssue=huaweiRecordIssue(d);if(d.recordIssue){hint.className='hint fail';hint.textContent='对应记录需核对';value.textContent=d.recordIssue;}
      const source=document.createElement('small');source.className='value';source.textContent=d.source?'来源：'+d.source:'';row.append(source);
      const review=document.createElement('p');review.className='review-note';review.style.cssText='color:#916019;background:#fff4d6;border-left:3px solid #d69c37;padding:9px 11px;line-height:1.6;margin-left:24px;';review.textContent=d.reviewNote?'待核对：'+d.reviewNote:'';review.hidden=!d.reviewNote;row.append(review);
      if(['missing','unknown','precision','conflict'].includes(fieldState(d))){
        const supplement=document.createElement('button');supplement.className='supplement';supplement.textContent=d.dateNeedsDay?'补充完整日期 →':'补充此项 →';supplement.setAttribute('aria-label','补充'+d.label);
        supplement.onclick=()=>editProfile(d.customFieldId||d.recordCustomKind&&!d.key||d.key==='recordCustom'?{key:'recordCustom',kind:d.recordCustomKind,index:d.index,fieldId:d.customFieldId,label:d.label}:{key:d.key,index:d.index,moduleId:d.moduleId,fieldId:d.fieldId,label:d.label,precision:needsFullDate(d.el)&&(d.awardDate||/\.(startDate|endDate)$/.test(d.key||''))?'day':undefined},status);row.append(supplement);
      }
      if(!d.locked&&!d.occupied&&!d.needsRecord&&!d.noRecord&&!d.skip&&d.type!=='file'){
        const select=document.createElement('select');select.setAttribute('aria-label',d.label+'对应资料');
        select.add(new Option(d.value?'已自动对应，可选择其他资料…':'选择对应资料项…',''));
        available.forEach((m,i)=>select.add(new Option(m.label,String(i))));
        select.onchange=()=>{
          if(busy||select.value===''||d.outcome==='filled')return;
          const m=available[Number(select.value)];let selected=m.value,answer=null;
          if(m.key==='custom'){
            const question=profile.custom[m.index],query=d.customLabel||d.label;
            const candidate=M.customMatch({custom:[question]},query);
            if(M.questionRelation(question,query)||candidate.conflict){answer=candidate;selected=candidate.value;}
          }
          Object.assign(d,{key:m.key,index:m.index,customFieldId:m.key==='recordCustom'?m.fieldId:'',recordCustomKind:m.key==='recordCustom'?m.kind:d.recordCustomKind,recognized:true,needsRecord:false,noRecord:false,answerConflict:!!answer?.conflict,outcome:null});
          assignRecordValue(d,selected);d.reason=answer?.reason||'';
          value.textContent=displayValue(d)||d.reason||'所选资料不是完整年月，请重新选择';source.textContent='来源：'+m.label;check.disabled=!d.value;check.checked=!!d.value;hint.className='hint';hint.textContent=d.value?'手动指定':answer?.conflict?'待确认答案':'需核对';updateSummary();
        };
        if(d.value){const details=document.createElement('details');details.className='correction';const summary=document.createElement('summary');summary.textContent='调整此字段的对应资料';details.append(summary,select);row.append(details);}else row.append(select);
      }
      const issue=document.createElement('p');issue.className='issue';row.append(issue);
      const locate=document.createElement('button');locate.type='button';locate.className='locate';locate.textContent='定位到网页';locate.setAttribute('aria-label','定位'+d.label);locate.onclick=()=>locateField(d);row.append(locate);
      rows.set(d.id,{row,issue,locate,check,hint,value,source,review,select:row.querySelector('select'),correction:row.querySelector('.correction')});
    }
    updateLayout();
    const syncPage=()=>{
      let changed=false;
      for(const d of descriptors){
        const current=currentField(d),stale=!current,rangeIssue=baiduRangeIssue(d.el),recordIssue=huaweiRecordIssue(current?{...d,existing:current.value,occupied:current.occupied}:d),validationIssue=!stale&&d.outcome==='filled'&&!!F.invalid(d.el);
        if(!stale&&d.existing===current.value&&d.occupied===current.occupied&&!d.stale&&d.rangeIssue===rangeIssue&&d.recordIssue===recordIssue&&!!d.validationIssue===validationIssue)continue;
        if(stale&&d.stale)continue;
        changed=true;const previous=fieldState(d);d.stale=stale;d.rangeIssue=rangeIssue;d.recordIssue=recordIssue;d.validationIssue=validationIssue;
        if(current){
          if(d.existing!==current.value){d.outcome=null;d.validationIssue=false;}
          d.existing=current.value;d.occupied=current.occupied;
        }
        const ui=rows.get(d.id),state=fieldState(d);
        ui.hint.className=state==='failed'?'hint fail':state==='filled'?'hint ok':'hint';
        ui.hint.textContent=stale?'页面字段已更新，请重新识别':d.validationIssue?'网站校验未通过':state==='filled'?'已填写':state==='kept'?'已填 · 保留':state==='ready'?'待填写':stateLabels[state];
        ui.value.textContent=stale?'原输入框已被页面替换，请重新识别。':rangeIssue||recordIssue||(d.occupied?'网站已有内容，将保留':displayValue(d));
        ui.check.disabled=stale||!!d.outcome||d.locked||d.occupied||!d.value;
        if(ui.check.disabled)ui.check.checked=false;
        else if(state==='ready'&&previous!=='ready')ui.check.checked=d.type!=='file';
        if(ui.select)ui.select.disabled=stale||d.occupied||d.outcome==='filled';
      }
      if(changed)updateSummary();
    };
    let syncTimer,profileTimer,checkingProfile,checkingApply=false;
    const thisHost=panelHost;
    // Script arguments can omit a null attachment; messaging can reorder keys.
    // Neither changes the reviewed data or grants permission to upload a file.
    const profileSignature=p=>JSON.stringify({...p,attachment:p.attachment||null},(key,value)=>key==='preparationWarning'?undefined:value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
    const checkSavedProfile=async()=>{
      if(!syncSavedProfile)return false;
      if(checkingProfile)return checkingProfile;
      checkingProfile=(async()=>{
        const next=await latestProfile();
        if(panelHost!==thisHost||!thisHost.isConnected||busy)return true;
        if(profileSignature(next)===profileSignature(currentProfile))return false;
        const scroll=shadow.querySelector('.list').scrollTop,expanded=readout.open;
        await open(next);
        panelHost.shadowRoot.querySelector('.list').scrollTop=scroll;
        panelHost.shadowRoot.querySelector('.profile-readout').open=expanded;
        panelHost.shadowRoot.querySelector('.status').textContent='资料已更新，已读取刚保存的内容。请核对后点击“填写所选项”。';
        return true;
      })();
      try{return await checkingProfile;}finally{checkingProfile=null;}
    };
    const returnedToPage=()=>{
      if(!syncSavedProfile||document.visibilityState==='hidden')return;
      clearTimeout(profileTimer);profileTimer=setTimeout(()=>{if(!busy&&thisHost.isConnected)checkSavedProfile().catch(()=>{if(thisHost.isConnected)status.textContent='最新资料暂时读取失败，请点击“更新资料”重试。';});},450);
    };
    const getControls=()=>is51job?job51FormControls():F?.controls()||[];
    let formControls=getControls();
    const structureIds=new WeakMap(),descriptorStructureIds=new Map();let structureSequence=0;
    const structureId=node=>{if(!node)return 0;if(!structureIds.has(node))structureIds.set(node,++structureSequence);return structureIds.get(node);};
    const structureSnapshot=()=>{
      // Reuse only an already-supported, unique field rebind. A framework may
      // remount a text input after our write without changing its meaning.
      for(const d of descriptors){
        const next=liveElement(d);if(!next)continue;
        if(!descriptorStructureIds.has(d))descriptorStructureIds.set(d,structureId(next));
        structureIds.set(next,descriptorStructureIds.get(d));
      }
      F.beginScan();
      // Ordinary checkboxes are never filled. Degree widgets may add a
      // full-time/minor checkbox after a valid selection; it must be reviewed
      // on the next scan without interrupting the already-reviewed fields.
      const currentControls=getControls();prepareSequentialRecords(currentControls,profile);
      try{return JSON.stringify(currentControls.filter(el=>el.type!=='checkbox'||descriptors.some(d=>d.el===el&&d.present)).map(el=>{
        const airline=ceairInfo(el,profile),kind=airline?.key.startsWith('educations.')?'educations':contextOf(el),c=F.control(el),record=recordOf(el,kind),parts=dateParts(el);
        const adapter=job51Label(el)||huaweiLabel(el)||baiduLabel(el)||ctripLabel(el)||directClass(mokaField(el),'title-')?.textContent||'';
        const generic=el.type!=='radio'&&!airline?F.infer(el,kind,adapter):null;
        const useGeneric=!!generic&&!isCtrip&&!isBaidu&&!isHuawei&&!isCeair&&!is51job&&!mokaField(el);
        const label=useGeneric||generic?.key||generic?.blocked?generic.label||'':labelOf(el,el.type==='radio');
        const mapping=airline|| (parts?.side&&['educations','experiences','projects'].includes(kind)?{key:kind+'.'+parts.side}:useGeneric||generic?.key||generic?.blocked?generic:M.fieldKey(label,kind));
        const supportsReadonly=!!(mokaSelect(el)||antSelect(el)||ctripPicker(el)||huaweiSelect(el)||job51Select(el)||['select','region'].includes(c?.type)||['ant3-date','ant3-month'].includes(c?.library));
        const moduleContext=profile.modules.length?moduleContextOf(el,profile):null;
        const placeholder=c?.library==='ant3-cascader'&&genericLabel(el.placeholder)?'':el.placeholder||'';
        return [structureId(el),el.tagName,el.type,el.name,el.matches(':disabled'),!!el.closest('[inert],[aria-disabled="true"]'),!!el.readOnly&&!supportsReadonly,!!el.multiple,placeholder,kind,mapping.key||'',label,parts?.part||'',!!mapping.blocked,c?.type||'',c?.library||'',!!c?.multiple,structureId(record?.record),record?.kind||'',record?.title||'',record?.index??null,!!moduleContext?.blocked,structureId(moduleContext?.root),(moduleContext?.modules||[]).map(m=>m.id).sort()];
      }));}finally{F.endScan();}
    };
    const reviewedStructure=structureSnapshot();
    const structureChanged=()=>reviewedStructure!==structureSnapshot();
    const scheduleSync=()=>{clearTimeout(syncTimer);syncTimer=setTimeout(()=>{
      if(busy||panelHost!==thisHost||!thisHost.isConnected)return;
      const next=getControls();
      if((is51job||F)&&(next.length!==formControls.length||next.some((el,i)=>el!==formControls[i]))){
        if(next.length===formControls.length&&!structureChanged()){
          // A verified same-field remount must retain its failure/success and
          // checkbox state. Reopening would erase a rejected-write warning.
          formControls=next;syncPage();updateLayout();return;
        }
        open(currentProfile).then(()=>{if(panelHost?.isConnected)panelHost.shadowRoot.querySelector('.status').textContent=next.length?'已识别展开的表单，请核对资料后点击“填写所选项”。':'这一栏的编辑已关闭，可继续打开其他栏目。';});return;
      }
      if(structureChanged()){
        open(currentProfile).then(()=>{if(panelHost?.isConnected)panelHost.shadowRoot.querySelector('.status').textContent='网页问题或控件已变化，已更新预览，请核对后再填写。';});return;
      }
      syncPage();
      updateLayout();
    },240);};
    const inputChanged=e=>{if(e.target!==panelHost)scheduleSync();};
    document.addEventListener('input',inputChanged,true);document.addEventListener('change',inputChanged,true);
    const observer=new MutationObserver(scheduleSync);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['value','checked','disabled','readonly','style','class','hidden','inert','aria-hidden','aria-invalid','aria-disabled','aria-label','aria-labelledby','aria-multiselectable','type','name','id','for','placeholder','autocomplete','multiple','role','data-section','data-kind','data-form-field-name','data-form-field-i18n-name']});
    window.addEventListener('focus',returnedToPage);window.addEventListener('resize',scheduleSync);document.addEventListener('visibilitychange',returnedToPage);
    cleanupPanel=()=>{clearTimeout(locatorTimer);locator?.remove();clearTimeout(syncTimer);clearTimeout(profileTimer);observer.disconnect();document.removeEventListener('input',inputChanged,true);document.removeEventListener('change',inputChanged,true);window.removeEventListener('focus',returnedToPage);window.removeEventListener('resize',scheduleSync);document.removeEventListener('visibilitychange',returnedToPage);};
    shadow.querySelector('.close').onclick=()=>{if(!busy){cleanupPanel();panelHost.remove();}};
    shadow.querySelector('.choose-records').onclick=()=>{const next=descriptors.find(d=>fieldState(d)==='record'),picker=recordSelectors.get(next?.recordInfo?.record);if(picker){picker.scrollIntoView({block:'center'});picker.focus();}};
    shadow.querySelector('.edit-profile').onclick=()=>editProfile({},status);
    const refresh=async()=>{
      if(busy)return;busy=true;status.textContent='正在读取最新资料…';
      try{const next=await latestProfile();busy=false;await open(next);panelHost.shadowRoot.querySelector('.status').textContent='资料已更新，请核对后点击“填写所选项”。';}
      catch(e){status.textContent='资料未能更新，请重新打开轻投。'+(e.message||'');}
      finally{busy=false;}
    };
    shadow.querySelector('.refresh-profile').onclick=refresh;
    shadow.querySelector('.rescan').onclick=refresh;
    shadow.querySelector('.undo').onclick=async()=>{
      if(busy)return;const result=await undo();
      for(const d of descriptors.filter(x=>x.outcome==='filled'||x.occupied)){
        const current=d.type==='radio'?d.elements.some(x=>x.checked):d.present?d.el.checked:d.type==='file'?d.el.files?.length:selectedText(d.el);
        const placeholder=d.el.tagName==='SELECT'&&/请选择|select|choose/i.test(d.el.selectedOptions[0]?.textContent||'');
        if(!current||placeholder){d.outcome=null;d.occupied=false;d.existing='';const ui=rows.get(d.id);ui.value.textContent=displayValue(d);ui.check.disabled=d.locked||!d.value;ui.check.checked=!!d.value&&!d.locked&&d.type!=='file';ui.hint.className='hint';ui.hint.textContent='已撤销';if(ui.select)ui.select.disabled=false;}
      }
      updateSummary();status.textContent=`已撤销 ${result.restored} 项`+(result.manual?`；${result.manual} 项已被修改或为自定义控件，请手动检查。`:'。');
    };
    apply.onclick=async()=>{
      if(busy||checkingApply)return;
      checkingApply=true;apply.disabled=true;
      try{if(await checkSavedProfile())return;}
      catch(e){status.textContent='最新资料未能读取，本次尚未填写。请点击“更新资料”重试。';return;}
      finally{checkingApply=false;apply.disabled=false;}
      if(structureChanged()){await open(profile);panelHost.shadowRoot.querySelector('.status').textContent='网页问题或控件已变化，已更新预览，请核对后再填写。';return;}
      if(reviewedBindings!==bindingSnapshot()){await open(profile);panelHost.shadowRoot.querySelector('.status').textContent='学校、公司、项目名称或年月已变化，已重新对应整段资料，请核对后再次填写。';return;}
      syncPage();const selected=descriptors.filter(d=>rows.get(d.id).check.checked&&!rows.get(d.id).check.disabled);
      if(!selected.length){status.textContent='请先勾选需要填写的字段。';return;}
      history=[];
      const expectedBindings=new Map(bindingEntries());
      const bindingChanged=()=>bindingEntries().some(([id,value])=>!expectedBindings.has(id)||expectedBindings.get(id)!==value);
      busy=true;shadow.querySelectorAll('button,select,input').forEach(b=>b.disabled=true);let filled=0,failed=0,bindingsInterrupted=false,structureInterrupted=false;
      try { for(const d of selected){
        if(structureChanged()){structureInterrupted=true;break;}
        if(bindingChanged()){bindingsInterrupted=true;break;}
        status.textContent='正在填写：'+d.label;
        let reason;
        try { const current=currentField(d);
          reason=current?.occupied?'页面内容已变化，已保留':await fillOne(d,profile);
        }catch(e){reason='未能填写，请手动检查';}
        const current=currentField(d);if(current){d.existing=current.value;d.occupied=current.occupied;}
        d.outcome=reason?'failed':'filled';d.fillReason=reason||'';const r=rows.get(d.id);r.hint.textContent=reason||'已填写';r.hint.className=reason?'hint fail':'hint ok';r.check.checked=false;r.check.disabled=true;if(reason&&r.correction)r.correction.open=true;reason?failed++:filled++;updateSummary();
        if(!reason&&expectedBindings.has(d.id))expectedBindings.set(d.id,current?.value??null);
        if(structureChanged()){structureInterrupted=true;break;}
        if(bindingChanged()){bindingsInterrupted=true;break;}
      } status.textContent=`已填写 ${filled} 项，${failed} 项待手动处理。请检查网站内容后提交。`+(selected.some(d=>d.reviewNote)?' 标黄项按简历顺序补填，请核对对应关系。':'');
      } finally {
        reviewedBindings=bindingSnapshot();
        busy=false;shadow.querySelectorAll('button').forEach(b=>b.disabled=false);recordSelectors.forEach(s=>s.disabled=false);
        for(const d of descriptors){const ui=rows.get(d.id);ui.check.disabled=!!d.outcome||d.locked||d.occupied||!d.value;if(ui.select)ui.select.disabled=d.outcome==='filled';}
        if(structureInterrupted){await open(currentProfile);panelHost.shadowRoot.querySelector('.status').textContent='填写期间网页问题或控件已变化，已停止后续填写并更新预览。请核对后再填写。';}
        else if(bindingsInterrupted){await open(currentProfile);panelHost.shadowRoot.querySelector('.status').textContent='填写期间学校、公司、项目名称或年月被修改，已停止后续填写并重新对应资料。请核对后再填写。';}
        else{syncPage();updateSummary();scheduleSync();}
      }
    };
  }
  globalThis.__qingtou={open,scan,undo,runtimeInfo,version:'0.5.11',isBusy:()=>busy,dispose:()=>{cleanupPanel();runtime?.onMessage?.removeListener(profileMessage);}};
})();






