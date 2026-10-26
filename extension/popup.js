(async()=>{
  const $=id=>document.getElementById(id),status=$('status');
  const installed=QTRuntimeSync.installedVersion();
  $('installed-version').textContent='v'+installed;$('footer-version').textContent='v'+installed;
  let operation=false,currentInfo=null,recoveryTab=null;
  const currentTab=async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return tab;};
  const freshProfile=async()=>QT.sanitize(await QT.read('profile',QT.fresh()));
  function profileSummary(profile){
    $('name').textContent=profile.basic.name||'还没有填写姓名';
    $('summary').textContent=`${profile.educations.filter(x=>x.school).length} 段教育 · ${profile.experiences.length} 段实习 / 工作 · ${profile.projects.length} 个项目 · ${profile.modules.length} 个自定义模块`;
    $('bar').style.width=QT.completeness(profile)/8*100+'%';
  }
  function showVersion(info){
    currentInfo=info;const mismatch=info.pageVersion&&info.pageVersion!==installed;
    $('page-version').textContent=info.pageVersion?'v'+info.pageVersion+(info.panelOpen?'':' · 已关闭'):info.state==='unopened'?'未打开':info.state==='unsupported'?'当前页面不支持':'暂时无法读取';
    $('version-note').textContent=info.busy?'当前页正在填写，结束后可以更新预览。':mismatch?'当前页预览与已安装扩展版本不同，点击下方按钮即可更新预览。':info.runtimeReady===false?'当前页预览的连接已失效，请更新当前页预览。':info.state==='ready'?'当前页预览与已安装版本一致。':info.state==='unopened'?'当前页尚未打开轻投预览。':info.message||'请从招聘表单页点击工具栏中的轻投后再试。';
    $('version-note').className=mismatch||info.runtimeReady===false?'version-warning':'';
    $('sync-preview').disabled=operation||!!info.busy||info.state==='unsupported';
  }
  async function checkVersion(){
    const tab=await currentTab();
    showVersion(tab?.id?await QTRuntimeSync.probe(tab.id):{state:'unsupported',message:'请先打开招聘官网的申请表。'});
  }
  $('profile').onclick=()=>chrome.runtime.openOptionsPage();
  $('demo').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('demo.html')});
  $('record').onclick=async()=>{const tab=await currentTab();const url=new URL(chrome.runtime.getURL('dashboard.html'));url.searchParams.set('source',QT.safeUrl(tab?.url||''));url.searchParams.set('title',tab?.title||'');url.hash='records';chrome.tabs.create({url:url.href});};
  $('check-page-version').onclick=()=>checkVersion().catch(e=>status.textContent=QTRuntimeSync.message(e));
  async function updatePreview(closeAfter){
    if(operation)return;operation=true;for(const id of ['fill','sync-preview','check-page-version'])$(id).disabled=true;
    $('reload-help').hidden=true;recoveryTab=null;status.textContent='正在更新当前页预览…';
    try{
      const tab=await currentTab();if(!tab?.id||!/^https?:\/\//i.test(tab.url||''))throw new Error('请先打开招聘官网的申请表。练习表单请使用页面内按钮。');
      recoveryTab={id:tab.id,url:tab.url};
      const info=await QTRuntimeSync.probe(tab.id);if(info.busy)throw new Error('当前页正在填写，请等本轮填写结束后再更新预览。');
      const profile=await freshProfile();profileSummary(profile);
      const {prepareProfile}=await import('./resume-prepare.mjs');
      const prepared=await prepareProfile(profile,{onProgress:message=>status.textContent=message});
      if(prepared.warning)prepared.profile.preparationWarning=prepared.warning;
      const after=await QTRuntimeSync.refresh(tab.id,prepared.profile);showVersion(after);
      status.textContent='当前页预览已更新到 v'+after.pageVersion+'。网页已填内容保留，请检查预览后再填写。';
      if(closeAfter)window.close();
    }catch(e){
      status.textContent=QTRuntimeSync.message(e);
      if(recoveryTab&&!/正在填写|请先打开|当前页面不能/.test(status.textContent))$('reload-help').hidden=false;
    }finally{
      operation=false;$('fill').disabled=false;$('check-page-version').disabled=false;
      $('sync-preview').disabled=!!currentInfo?.busy||currentInfo?.state==='unsupported';
    }
  }
  $('fill').onclick=()=>updatePreview(true);
  $('sync-preview').onclick=()=>updatePreview(false);
  $('reload-page').onclick=async()=>{
    if(!confirm('刷新网页可能丢失未保存的内容。请确认已在官网保存，再继续刷新。'))return;
    try{const tab=await currentTab();if(!tab?.id||!/^https?:\/\//i.test(tab.url||''))throw new Error('请先回到招聘官网的申请表。');if(tab.id!==recoveryTab?.id||tab.url!==recoveryTab?.url)throw new Error('网页已切换，请重新打开轻投检查当前页。');await chrome.tabs.reload(tab.id);window.close();}
    catch(e){status.textContent=QTRuntimeSync.message(e);}
  };
  await Promise.all([freshProfile().then(profileSummary).catch(e=>status.textContent='资料读取失败：'+e.message),checkVersion().catch(e=>status.textContent=QTRuntimeSync.message(e))]);
})().catch(e=>{document.getElementById('status').textContent='轻投未能打开：'+e.message;});
