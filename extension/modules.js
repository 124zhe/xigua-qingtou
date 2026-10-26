(function(){
  'use strict';
  let selected='';
  const schemaOpen=new Map();
  const templates=[
    {name:'校园经历',aliases:['校园活动','学生工作','社团经历'],fields:[['组织名称','text','社团名称、学生组织'],['担任职务','text','职位、角色'],['开始时间','month','开始日期'],['结束时间','text','结束日期'],['职责与成果','textarea','活动描述、工作内容']]},
    {name:'资格证书',aliases:['证书信息','职业资格','证书'],fields:[['证书名称','text','资格名称'],['证书等级','text','等级'],['取得时间','month','获证时间、获得日期'],['颁发机构','text','颁发单位、发证机构']]},
    QT.awardTemplate,
    {name:'科研论文',aliases:['论文成果','学术成果','科研成果'],fields:[['论文名称','text','论文标题'],['发表期刊','text','期刊名称'],['作者角色','text','作者排序'],['发表时间','month','发表日期'],['论文链接','url','DOI链接'],['研究内容','textarea','论文摘要']]},
    {name:'专利成果',aliases:['专利信息','专利情况'],fields:[['专利名称','text','名称'],['专利号','text','申请号'],['专利状态','select','状态',['已申请','已公开','已授权']],['申请时间','month','申请日期'],['本人贡献','textarea','成果描述']]},
    {name:'志愿服务',aliases:['志愿经历','公益活动'],fields:[['活动名称','text','项目名称'],['组织单位','text','主办单位'],['服务时间','month','活动时间'],['服务时长','number','志愿时长'],['服务内容','textarea','活动描述']]},
    {name:'自媒体与作品',aliases:['自媒体经历','作品展示'],fields:[['账号或作品名称','text','作品名称、账号名称'],['平台','text','发布平台'],['个人角色','text','角色'],['作品链接','url','链接'],['成果介绍','textarea','作品描述、运营成果']]}
  ];
  const split=s=>[...new Set(s.split(/[、,，;；\n]/).map(s=>s.trim()).filter(Boolean))].slice(0,30);
  function create(template){return {id:QT.newId(),name:template?.name||'新模块',aliases:template?.aliases.slice()||[],fields:(template?.fields||[['名称','text',''],['内容','textarea','']]).map(([label,type,aliases,options])=>({id:QT.newId(),label,type,aliases:split(aliases),options:options||[]})),entries:[{id:QT.newId(),values:{}}]};}
  function render(profile,{esc,field,exactDateField}){
    const modules=profile.modules;
    if(!modules.some(m=>m.id===selected))selected=modules[0]?.id||'';
    const index=modules.findIndex(m=>m.id===selected),m=modules[index];
    const entryField=(f,row,r)=>{
      let type=f.type==='select'?'text':f.type,notice='';
      if(exactDateField&&QT.isAwardModule(m)&&QT.awardFieldKind(f)==='date'&&['month','date'].includes(f.type)){
        const valuePath=`modules.${index}.entries.${r}.values.${f.id}`;
        return (f.type==='month'?field(f.label,valuePath,'month','按实际情况填写'):'')+exactDateField('完整获奖日期',valuePath);
      }
      if(['month','date','number','url'].includes(type)&&row.values[f.id]){const probe=document.createElement('input');probe.type=type;probe.value=row.values[f.id];if(probe.value!==row.values[f.id]){notice='已有内容不符合“'+QT.fieldTypes[f.type]+'”格式，原值已保留，请修改内容或字段格式。';type='text';}}
      const input=field(f.label||'未命名字段',`modules.${index}.entries.${r}.values.${f.id}`,type,'按实际情况填写',f.type==='select'?[...new Set([...f.options,...(row.values[f.id]&&!f.options.includes(row.values[f.id])?[row.values[f.id]]:[])])]:undefined);
      return notice?`<div class="field">${input}<small class="module-empty-note">${esc(notice)}</small></div>`:input;
    };
    const templatesHtml=templates.map((t,i)=>`<button class="template-button" data-template="${i}"><strong>＋ ${esc(t.name)}</strong><small>${t.fields.length} 个字段 · 可自由修改</small></button>`).join('');
    const header=`<section class="card module-start"><div class="card-header"><div><h2>从一个常用模块开始</h2><p>模板只创建空白字段；名称、字段与记录都可以修改。</p></div><button class="button primary" id="new-module">＋ 新建空白模块</button></div><div class="template-grid">${templatesHtml}</div></section>`;
    if(!m)return header+'<div class="empty"><h3>你的经历，不必装进固定栏目。</h3><p>添加一个模块，定义要保存的信息。以后遇到对应网申栏目，就可以重复使用。</p></div>';
    const editor=m.fields.map((f,i)=>`<div class="field-definition" data-field-definition="${f.id}"><div class="definition-order"><span>${i+1}</span><button class="text-button" data-field-up="${i}" ${i===0?'disabled':''} aria-label="上移字段 ${i+1}">↑</button><button class="text-button" data-field-down="${i}" ${i===m.fields.length-1?'disabled':''} aria-label="下移字段 ${i+1}">↓</button></div><label class="field"><span>字段名称</span><input data-module-field="${i}" data-property="label" value="${esc(f.label)}" maxlength="100" aria-label="字段名称 ${i+1}"></label><label class="field"><span>填写格式</span><select data-module-field="${i}" data-property="type" aria-label="字段格式 ${i+1}">${Object.entries(QT.fieldTypes).map(([key,label])=>`<option value="${key}" ${f.type===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="field"><span>官网里的其他叫法</span><input data-module-field="${i}" data-property="aliases" value="${esc(f.aliases.join('、'))}" placeholder="例如：发证机构、颁发单位" aria-label="字段其他叫法 ${i+1}"></label><button class="text-button" data-delete-field="${i}" aria-label="删除字段 ${i+1}">删除</button>${f.type==='select'?`<label class="field definition-options"><span>可选项（用顿号或逗号分隔）</span><input data-module-field="${i}" data-property="options" value="${esc(f.options.join('、'))}" aria-label="字段选项 ${i+1}"></label>`:''}</div>`).join('');
    const records=m.entries.map((row,r)=>`<section class="card module-record" data-module-entry="${row.id}"><div class="card-header"><div class="repeat-heading"><span class="number">${String(r+1).padStart(2,'0')}</span><h2>第 ${r+1} 条记录</h2></div><div class="module-record-actions"><button class="text-button" data-entry-up="${r}" ${r===0?'disabled':''} aria-label="上移记录 ${r+1}">上移</button><button class="text-button" data-entry-down="${r}" ${r===m.entries.length-1?'disabled':''} aria-label="下移记录 ${r+1}">下移</button><button class="text-button" data-copy-entry="${r}">复制</button><button class="text-button" data-delete-entry="${r}">删除</button></div></div><div class="fields">${m.fields.map(f=>entryField(f,row,r)).join('')}</div>${!m.fields.length?'<p class="inline-note">先在“设置模块字段”中添加字段。</p>':''}</section>`).join('');
    return header+`<div class="module-toolbar"><label class="field"><span>我的模块 · ${modules.length} 个</span><select id="module-picker" aria-label="选择模块">${modules.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.name||'未命名模块')}（${x.entries.length} 条）</option>`).join('')}</select></label><a href="modules-demo.html" target="_blank" class="button outline">练习填写这些模块 ↗</a></div><section class="card"><div class="card-header"><div><h2>${esc(m.name||'未命名模块')}</h2><p>模块名称和其他叫法帮助识别官网栏目；只按明确匹配填写。</p></div><button class="text-button" id="delete-module">删除模块</button></div><div class="fields"><label class="field"><span>模块名称</span><input id="module-name" value="${esc(m.name)}" maxlength="100" aria-label="模块名称"></label><label class="field"><span>官网栏目的其他叫法</span><input id="module-aliases" value="${esc(m.aliases.join('、'))}" placeholder="例如：职业资格、证书信息" aria-label="模块其他叫法"></label></div><details class="module-schema" ${(schemaOpen.has(m.id)?schemaOpen.get(m.id):m.entries.every(e=>Object.values(e.values).every(v=>!v)))?'open':''}><summary>设置模块字段 · ${m.fields.length} 项</summary><div class="schema-note">字段改名或调整顺序会保留已有内容。不同字段使用相同叫法时，填写预览会提示你选择。</div><div>${editor}</div><button class="button" id="add-module-field">＋ 添加字段</button></details></section><div class="cards-actions"><p class="inline-note">${m.entries.length} 条记录 · 按此顺序对应官网已有的记录栏</p><button class="button primary" id="add-module-entry">＋ 添加一条记录</button></div>${records||'<div class="empty"><h3>添加第一条记录</h3><p>你填写的内容会自动保存在当前浏览器。</p></div>'}`;
  }
  function bind(profile,{save,queueSave,render,notify}){
    const $=s=>document.querySelector(s), all=s=>document.querySelectorAll(s);
    const m=()=>profile.modules.find(x=>x.id===selected);
    const commit=async()=>{await save();render();};
    const add=async template=>{if(profile.modules.length>=20){notify('最多保存 20 个自定义模块。');return;}const module=create(template);profile.modules.push(module);selected=module.id;await commit();notify('模块已添加，可以修改字段并填写记录。');};
    $('#new-module').onclick=()=>add();
    all('[data-template]').forEach(b=>b.onclick=()=>add(templates[Number(b.dataset.template)]));
    if(!m())return;
    const schema=$('.module-schema');schema.addEventListener('toggle',()=>{if(schema.isConnected)schemaOpen.set(selected,schema.open);});
    $('#module-picker').onchange=e=>{selected=e.target.value;render();};
    $('#module-name').oninput=e=>{m().name=e.target.value;queueSave();};
    $('#module-aliases').oninput=e=>{m().aliases=split(e.target.value);queueSave();};
    $('#delete-module').onclick=async()=>{if(!confirm('删除这个模块及其中全部记录？'))return;profile.modules=profile.modules.filter(x=>x.id!==selected);selected='';await commit();};
    $('#add-module-field').onclick=async()=>{if(m().fields.length>=25){notify('每个模块最多 25 个字段。');return;}m().fields.push({id:QT.newId(),label:'新字段',type:'text',aliases:[],options:[]});await commit();};
    all('[data-module-field]').forEach(el=>el.addEventListener(el.dataset.property==='type'?'change':'input',async()=>{
      const f=m().fields[Number(el.dataset.moduleField)],k=el.dataset.property;
      f[k]=['aliases','options'].includes(k)?split(el.value):el.value;
      if(k==='type'){await commit();notify('格式已更新；已有值仍保留，请核对是否符合新格式。');}else queueSave();
    }));
    all('[data-delete-field]').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.deleteField),f=m().fields[i];if(!confirm('删除“'+f.label+'”及所有记录中的这一项内容？'))return;m().fields.splice(i,1);m().entries.forEach(e=>delete e.values[f.id]);await commit();});
    const reorder=async(list,i,d)=>{if(i+d<0||i+d>=list.length)return;[list[i],list[i+d]]=[list[i+d],list[i]];await commit();};
    for(const [attr,dir,list] of [['fieldUp',-1,'fields'],['fieldDown',1,'fields'],['entryUp',-1,'entries'],['entryDown',1,'entries']])all('[data-'+attr.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']').forEach(b=>b.onclick=()=>reorder(m()[list],Number(b.dataset[attr]),dir));
    $('#add-module-entry').onclick=async()=>{if(m().entries.length>=50){notify('每个模块最多 50 条记录。');return;}m().entries.push({id:QT.newId(),values:{}});await commit();};
    all('[data-copy-entry]').forEach(b=>b.onclick=async()=>{if(m().entries.length>=50){notify('每个模块最多 50 条记录。');return;}const i=Number(b.dataset.copyEntry);m().entries.splice(i+1,0,{id:QT.newId(),values:{...m().entries[i].values}});await commit();});
    all('[data-delete-entry]').forEach(b=>b.onclick=async()=>{if(!confirm('删除这条记录？'))return;m().entries.splice(Number(b.dataset.deleteEntry),1);await commit();});
  }
  globalThis.QTModulesUI={render,bind,templates,create,select:id=>{selected=id;}};
})();
