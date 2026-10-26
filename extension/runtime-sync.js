(function(){
  'use strict';
  const files=['matcher.js','form-engine.js','diagnostics.js','content.js'];
  const installedVersion=()=>chrome.runtime.getManifest().version;
  const safeVersion=value=>typeof value==='string'&&/^\d+(?:\.\d+){1,3}$/.test(value)?value:'';
  function message(error){
    const value=String(error?.message||error||'');
    if(/Cannot access|Missing host permission|extensions gallery|not allowed|chrome:\/\/|edge:\/\//i.test(value))return '当前页面不能使用插件，请进入招聘官网的申请表。';
    if(/No tab|tab was closed|frame was removed/i.test(value))return '原页面已关闭或跳转，请回到申请表重新打开轻投。';
    if(/context invalidated/i.test(value))return '当前页还在使用更新前的预览，请重新打开轻投并更新当前页预览。';
    return value||'当前页预览未能更新，请重新打开轻投后再试。';
  }
  async function probe(tabId){
    const installed=installedVersion();let tab;
    try{tab=await chrome.tabs.get(tabId);}catch(error){return {state:'unavailable',installedVersion:installed,pageVersion:'',message:message(error)};}
    if(!/^https?:\/\//i.test(tab?.url||''))return {state:'unsupported',installedVersion:installed,pageVersion:'',message:'请先打开招聘官网的申请表。练习表单请使用页面内按钮。'};
    try{
      const results=await chrome.scripting.executeScript({target:{tabId},func:()=>{
        const app=globalThis.__qingtou;if(!app)return {version:'',panelOpen:false,busy:false,runtimeReady:null};
        let info;try{info=typeof app.runtimeInfo==='function'?app.runtimeInfo():null;}catch{}
        let busy=false;try{busy=info?!!info.busy:!!app.isBusy?.();}catch{busy=true;}
        // Metadata only: no page inputs or saved profiles are read.
        return {version:typeof info?.version==='string'?info.version:typeof app.version==='string'?app.version:'',panelOpen:info?!!info.panelOpen:!!document.getElementById('qingtou-host'),busy,runtimeReady:typeof info?.runtimeReady==='boolean'?info.runtimeReady:null};
      }});
      const info=results.find(x=>x.frameId===0)?.result||results[0]?.result||{},version=safeVersion(info.version);
      return {state:version?'ready':'unopened',installedVersion:installed,pageVersion:version,panelOpen:!!info.panelOpen,busy:!!info.busy,runtimeReady:typeof info.runtimeReady==='boolean'?info.runtimeReady:null};
    }catch(error){return {state:'unavailable',installedVersion:installed,pageVersion:'',message:message(error)};}
  }
  async function refresh(tabId,profile){
    const before=await probe(tabId);
    if(before.state==='unsupported')throw new Error(before.message);
    if(before.busy)throw new Error('当前页正在填写，请等本轮填写结束后再更新预览。');
    try{
      const cleared=await chrome.scripting.executeScript({target:{tabId},func:()=>{
        const app=globalThis.__qingtou;
        try{if(app?.isBusy?.())return {busy:true};}catch{return {busy:true};}
        // Removing an invalidated extension listener may throw. Website values
        // remain intact; only the stale preview is discarded.
        try{app?.dispose?.();}catch{}
        document.getElementById('qingtou-host')?.remove();
        try{delete globalThis.__qingtou;}catch{globalThis.__qingtou=undefined;}
        return {busy:false};
      }});
      if(cleared.some(x=>x.result?.busy))throw new Error('当前页正在填写，请等本轮填写结束后再更新预览。');
      await chrome.scripting.executeScript({target:{tabId},files});
      await chrome.scripting.executeScript({target:{tabId},func:async p=>{
        if(typeof globalThis.__qingtou?.open!=='function')throw new Error('当前页预览没有加载完整，请重新打开轻投后再试。');
        await globalThis.__qingtou.open(p);
      },args:[profile]});
      const after=await probe(tabId);
      if(after.state!=='ready'||after.pageVersion!==after.installedVersion||!after.panelOpen||after.runtimeReady===false)throw new Error('当前页预览版本仍未同步，请重新打开轻投并更新预览。');
      return after;
    }catch(error){throw new Error(message(error));}
  }
  globalThis.QTRuntimeSync={installedVersion,probe,refresh,message};
})();
