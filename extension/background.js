'use strict';
importScripts('common.js','matcher.js','profile-nav.js','runtime-sync.js');
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  if (reason === 'install') await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||!['qingtou:edit-profile','qingtou:get-profile','qingtou:return-to-form'].includes(message?.type))return;
  (async()=>{
    if(message.type==='qingtou:get-profile'){
      if(!sender.tab&&!sender.url?.startsWith(chrome.runtime.getURL('')))throw new Error('请从填写预览更新资料。');
      return {ok:true,profile:QT.sanitize(await QT.read('profile',QT.fresh()))};
    }
    const base=chrome.runtime.getURL('dashboard.html');
    if(message.type==='qingtou:edit-profile'){
      if(!sender.tab?.id){await chrome.tabs.create({url:QTProfileNav.url(base,message.target)});return {ok:true};}
      const url=QTProfileNav.url(base,message.target,sender.tab.id);
      const editors=(await chrome.storage.session.get('profileEditors')).profileEditors||{};
      let existing=editors[sender.tab.id],response;
      if(Number.isInteger(existing)){
        // Let the editor flush pending input before switching its focus.
        try{await chrome.tabs.get(existing);response=await chrome.runtime.sendMessage({type:'qingtou:navigate-profile',returnTab:sender.tab.id,target:message.target||{}});}
        catch{existing=null;}
      }
      if(response){
        if(!response?.ok)throw new Error(response?.error||'资料页暂时无法切换，请检查是否保存成功。');
        await chrome.tabs.update(existing,{active:true});
      }else{
        const created=await chrome.tabs.create({url});
        const latest=(await chrome.storage.session.get('profileEditors')).profileEditors||{};
        latest[sender.tab.id]=created.id;await chrome.storage.session.set({profileEditors:latest});
      }
      return {ok:true};
    }
    if(!sender.url?.startsWith(base+'?'))throw new Error('请从资料页返回招聘页。');
    const value=new URL(sender.url).searchParams.get('returnTab');
    if(!/^\d+$/.test(value||''))throw new Error('没有可返回的招聘页面。');
    const tabId=Number(value),profile=QT.sanitize(await QT.read('profile',QT.fresh()));
    let response;
    const pageRuntime=await QTRuntimeSync.probe(tabId);
    if(pageRuntime.state==='ready'&&pageRuntime.pageVersion===pageRuntime.installedVersion&&pageRuntime.runtimeReady!==false){
      try{response=await chrome.tabs.sendMessage(tabId,{type:'qingtou:profile-updated',profile});}catch{}
    }
    if(!response?.ok){
      try{await QTRuntimeSync.refresh(tabId,profile);response={ok:true};}
      catch(error){throw new Error('资料已保存，当前页预览未能更新。'+QTRuntimeSync.message(error));}
    }
    const tab=await chrome.tabs.update(tabId,{active:true});
    await chrome.windows.update(tab.windowId,{focused:true});
    return {ok:true};
  })().then(respond,e=>respond({ok:false,error:e.message||'操作失败，请重试。'}));
  return true;
});
