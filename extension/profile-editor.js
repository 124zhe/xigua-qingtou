(function(){
  'use strict';
  function mount({getProfile,flush,reload,render,notify}){
    const runtime=globalThis.chrome?.runtime?.id?chrome.runtime:null;
    const params=new URLSearchParams(location.search);
    const base=new URL(location.href);base.search='';base.hash='';
    const returnTab=/^\d+$/.test(params.get('returnTab')||'')?Number(params.get('returnTab')):null;
    let banner,title,note,back,target;
    const hasEntry=returnTab!==null||[...params.keys()].some(k=>k.startsWith('edit_'));
    if(hasEntry){
      banner=document.createElement('section');banner.className='profile-return';
      const copy=document.createElement('div');title=document.createElement('strong');note=document.createElement('p');copy.append(title,note);
      back=document.createElement('button');back.className='button primary';back.id='return-to-form';back.textContent=runtime&&returnTab!==null?'保存并返回招聘页':'保存资料';
      banner.append(copy,back);document.querySelector('main').prepend(banner);
      back.onclick=async()=>{
        back.disabled=true;
        try{
          await flush();
          if(runtime&&returnTab!==null){
            const result=await runtime.sendMessage({type:'qingtou:return-to-form'});
            if(!result?.ok)throw new Error(result?.error||'返回失败');
          }else notify('资料已保存，请回到练习页点击“更新资料”。');
        }catch(e){note.textContent=e.message||'保存失败，请重试。';notify(note.textContent);}
        finally{back.disabled=false;}
      };
    }
    function prepare(raw){
      const profile=getProfile();target=QTProfileNav.target(raw);let customConflict=false;
      if(target.recordCustom){
        const row=target.kind&&target.index!==null?profile[target.kind]?.[target.index]:null;
        if(!target.kind)target.notice='无法定位这条资料，请从对应经历重新打开补充入口。';
        else if(!row){target.missingRecord=true;target.notice='这条记录尚未建立，请先添加记录，再补充对应内容。';}
        else{
          const fields=Array.isArray(row.customFields)?row.customFields:[];
          let i=target.fieldId?fields.findIndex(f=>f.id===target.fieldId):-1;
          const lookup=label=>QTMatch.recordCustomMatch?QTMatch.recordCustomMatch(profile,target.kind,target.index,label):QTMatch.customMatch({custom:fields},label);
          const match=lookup(target.label||(i>=0?fields[i].label:''));
          customConflict=!!match.conflict;
          if(i>=0){const ownMatch=lookup(fields[i].label);customConflict=customConflict||!!ownMatch.conflict||ownMatch.indices.length>1;}
          else if(match.indices.length){i=match.indices[0];customConflict=customConflict||match.indices.length>1;}
          else if(target.label.trim()&&!QTMatch.manualOnly(target.label)){
            if(fields.length<25){i=fields.length;fields.push({id:QT.newId(),label:target.label,value:'',aliases:[]});row.customFields=fields;}
            else target.notice='这段经历已达到 25 个补充字段，请先整理已有字段。';
          }else target.notice='没有找到这个补充字段，请在这段经历中选择或添加字段。';
          if(i>=0)target.path=`${target.kind}.${target.index}.customFields.${i}.value`;
        }
      }
      if(target.customLabel){
        const match=QTMatch.customMatch(profile,target.customLabel);
        const matches=match.indices.map(index=>({row:profile.custom[index],index}));
        customConflict=!!match.conflict;
        if(matches.length===1)target.path=`custom.${matches[0].index}.value`;
        else if(matches.length>1){target.path=`custom.${matches[0].index}.value`;customConflict=true;}
        else if(!matches.length&&profile.custom.length<100){
          // Keep a draft until the user enters an answer; opening a link alone does not write storage.
          const i=profile.custom.length;profile.custom.push({label:target.customLabel,value:'',aliases:[]});target.path=`custom.${i}.value`;
        }
      }
      if(target.moduleId){
        const i=profile.modules.findIndex(m=>m.id===target.moduleId),m=profile.modules[i];
        if(m){QTModulesUI.select(m.id);if(m.entries[target.index]&&m.fields.some(f=>f.id===target.fieldId))target.path=`modules.${i}.entries.${target.index}.values.${target.fieldId}`;}
      }
      if(banner){title.textContent=target.label?'补充：'+target.label:'补充网申资料';note.textContent=target.notice||(customConflict?'已有问答存在答案或其他叫法冲突；多条同义问答请统一答案或删除重复项，其他叫法请保持同一含义。已定位到已有问题，没有新建问题。':target.precision==='day'?'官网要求具体到日。补充真实日期后保存返回，预览就能自动调用；原有年月已保留。':target.recordCustom?'这项内容只保存在当前这段经历中，填写后保存返回；特殊问法可添加到“其他叫法”。':target.customLabel?'填写真实回答，保存后可用于同义问题；特殊问法可添加到“其他叫法”。':'编辑后自动保存；返回招聘页会更新预览，再由你确认填写。');}
    }
    function focus(){
      if(!target)return;
      const fields=[...document.querySelectorAll('[data-path],[data-exact-path]')],field=(target.precision==='day'?fields.find(el=>el.dataset.exactPath===target.path):null)||fields.find(el=>(el.dataset.exactPath||el.dataset.path)===target.path);
      const fallback=target.recordCustom&&!target.missingRecord?null:document.querySelector(`[data-add="${target.page}"]`)||(target.page==='modules'?document.getElementById('add-module-entry')||document.getElementById('new-module'):target.page==='extras'?document.getElementById('add-custom'):null);
      const el=field||fallback;
      if(el){el.closest('.field,.custom-row')?.classList.add('profile-target');el.scrollIntoView({block:'center'});el.focus({preventScroll:true});}
      if(target.path&&!field&&note)note.textContent='这条记录尚未建立，请先添加记录，再补充对应内容。';
    }
    async function navigate(raw){
      await flush();await reload();
      prepare(raw);
      history.replaceState(null,'',QTProfileNav.url(base.href,raw,returnTab));
      render();focus();
    }
    runtime?.onMessage?.addListener((message,sender,respond)=>{
      if(sender.id!==runtime.id||message?.type!=='qingtou:navigate-profile'||returnTab===null||message.returnTab!==returnTab)return;
      navigate(message.target).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));
      return true;
    });
    if(hasEntry){const raw=QTProfileNav.read(location.search);prepare(raw);history.replaceState(null,'',QTProfileNav.url(base.href,raw,returnTab));}
    return {focus};
  }
  globalThis.QTProfileEditor={mount};
})();
