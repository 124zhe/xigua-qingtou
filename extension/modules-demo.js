(function(){
  'use strict';
  let profile;
  const form=document.getElementById('module-form'),status=document.getElementById('module-status');
  function render(p){
    profile=p;document.getElementById('qingtou-host')?.remove();form.replaceChildren();
    let records=0;
    for(const m of profile.modules){
      const section=document.createElement('section');section.className='card';const h=document.createElement('h2');h.textContent=m.aliases[0]||m.name;section.append(h);
      for(const [i,entry] of m.entries.entries()){
        records++;const row=document.createElement('div');row.className='module-record';row.dataset.record=entry.id;const title=document.createElement('h3');title.textContent='第 '+(i+1)+' 条';row.append(title);const fields=document.createElement('div');fields.className='fields';
        for(const f of m.fields){const label=document.createElement('label');label.className='field'+(f.type==='textarea'?' wide':'');const span=document.createElement('span');span.textContent=f.aliases[0]||f.label;const control=document.createElement(f.type==='textarea'?'textarea':f.type==='select'?'select':'input');control.setAttribute('aria-label',span.textContent);if(f.type==='select'){control.add(new Option('请选择',''));f.options.forEach((o,index)=>control.add(new Option(o,'option-'+index)));}else if(f.type!=='textarea')control.type=f.type;label.append(span,control);fields.append(label);}row.append(fields);section.append(row);
      }form.append(section);
    }
    const ready=records>0;document.getElementById('fill-modules').disabled=!ready;document.getElementById('clear-modules').disabled=!ready;
    status.textContent=ready?'已载入 '+profile.modules.length+' 个模块、'+records+' 条记录。点击下方“识别并预览填写”。':'还没有自定义模块记录。可以先添加模块，也可以用虚构示例体验。';
  }
  const loadMine=async()=>render(QT.sanitize(await QT.read('profile',QT.fresh())));
  document.getElementById('load-mine').onclick=loadMine;
  document.getElementById('load-example').onclick=()=>{const p=QT.fresh();p.modules=[{id:'qexample',name:'资格证书',aliases:['证书信息'],fields:[{id:'qname',label:'证书名称',type:'text',aliases:['资格名称'],options:[]},{id:'qlevel',label:'证书等级',type:'select',aliases:['等级'],options:['初级','中级','高级']},{id:'qissuer',label:'颁发机构',type:'text',aliases:['发证机构'],options:[]},{id:'qdate',label:'取得时间',type:'month',aliases:['获证时间'],options:[]}],entries:[{id:'qone',values:{qname:'虚构证书 A',qlevel:'初级',qissuer:'示例机构 A',qdate:'2025-06'}},{id:'qtwo',values:{qname:'虚构证书 B',qlevel:'高级',qissuer:'示例机构 B',qdate:'2026-07'}}]}];render(p);status.textContent+=' 当前使用虚构资料，不会改动你的资料库。';};
  document.getElementById('fill-modules').onclick=()=>globalThis.__qingtou.open(profile);
  document.getElementById('clear-modules').onclick=()=>{form.reset();document.getElementById('qingtou-host')?.remove();};
  form.onsubmit=e=>e.preventDefault();loadMine().catch(()=>status.textContent='资料读取失败，请刷新后重试。');
})();
