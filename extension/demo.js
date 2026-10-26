(function(){
  let events=0;
  const form=document.getElementById('practice-form'),container=document.getElementById('education-blocks');
  function addEducation(){const i=container.children.length+1,div=document.createElement('div');div.className='education-block';div.innerHTML=`<div class="block-number">EDUCATION / ${String(i).padStart(2,'0')}</div><div class="fields"><label class="field"><span>学校名称</span><input aria-label="学校名称"></label><label class="field"><span>专业</span><input aria-label="专业"></label><label class="field"><span>学历</span><select aria-label="学历"><option value="">请选择</option><option value="part">非全日制本科</option><option value="b">大学本科</option><option value="m">硕士研究生</option></select></label><label class="field"><span>学位</span><select aria-label="学位"><option value="">请选择</option><option value="none">无</option><option value="ba">学士学位</option><option value="ma">硕士</option></select></label><label class="field"><span>入学时间</span><input type="month" aria-label="入学时间"></label><label class="field"><span>毕业时间</span><input type="month" aria-label="毕业时间"></label><label class="field"><span>GPA</span><input aria-label="GPA"></label></div>`;container.append(div);}
  addEducation();addEducation();
  document.getElementById('add-education').onclick=addEducation;
  document.getElementById('try-mine').onclick=async()=>{const p=QT.sanitize(await QT.read('profile',QT.fresh()));if(!p.basic.name){document.getElementById('demo-result').textContent='请先在“编辑我的资料”中导入或填写个人资料。';return;}globalThis.__qingtou.open(p);};
  document.getElementById('try').onclick=()=>globalThis.__qingtou.open(QT.sanitize(QT.sample()));
  document.getElementById('reset').onclick=()=>{form.reset();globalThis.__qingtou.undo();document.getElementById('qingtou-host')?.remove();document.getElementById('demo-result').textContent='';};
  form.addEventListener('input',()=>{events++;document.getElementById('event-count').textContent='页面已收到 '+events+' 次输入事件';});
  form.onsubmit=e=>{e.preventDefault();document.getElementById('demo-result').textContent='练习已完成。这些内容没有发送到任何招聘网站。';};
  const combo=document.querySelector('[role="combobox"]'),options=document.getElementById('city-options');
  combo.onclick=()=>{options.hidden=!options.hidden;combo.setAttribute('aria-expanded',String(!options.hidden));};
  combo.onkeydown=e=>{if(e.key==='Escape'){options.hidden=true;combo.setAttribute('aria-expanded','false');}};
  options.querySelectorAll('[role="option"]').forEach(el=>el.onclick=e=>{e.preventDefault();e.stopPropagation();combo.value=el.textContent;combo.dispatchEvent(new Event('change',{bubbles:true}));combo.setAttribute('aria-expanded','false');options.hidden=true;});
})();
