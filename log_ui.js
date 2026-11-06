// ================= 训练日志模块 =================
let curPlanId = null;      // 当前打开的计划
let logFilter = 'all';     // 日志筛选

function getCur(){ try{ return localStorage.getItem('sddr_curPlan')||'' }catch(e){ return '' } }
function setCur(id){ try{ localStorage.setItem('sddr_curPlan', id) }catch(e){} }
function getLogs(){ try{ return JSON.parse(localStorage.getItem('sddr_logs')||'[]') }catch(e){ return [] } }
function saveLogs(a){ try{ localStorage.setItem('sddr_logs', JSON.stringify(a)) }catch(e){} }
function planName(id){ const p=PLANS.find(x=>x.id===id); return p?p.name:'未知计划' }

function logView(){
  const cur = getCur();
  const curPlan = PLANS.find(p=>p.id===cur);
  const logs = getLogs();
  const nLogs = logs.length;
  return `<div class="back" onclick="go('home')">← 返回首页</div>
  <h2 class="modtitle">${icoBoxInline('log')} 训练日志</h2>
  <div class="lghome">
    <div class="lgcard lg-cur" data-go="${curPlan?'plan-'+curPlan:''}" ${curPlan?'':'style="opacity:.55"'}>
      <div class="lgct"><span class="lgbadge">当前计划</span>
        ${curPlan?`<b>${esc(curPlan.name)}</b><span class="lgmeta">${curPlan.tag} · ${curPlan.weeks} · 点击继续使用</span>`
                 :`<b>尚未选择计划</b><span class="lgmeta">从下方「计划选择」里挑一个开始</span>`}
      </div>
      ${curPlan?'<span class="lgarr">→</span>':''}
    </div>
    <div class="lgcard">
      <div class="lgct"><span class="lgbadge blue">计划选择</span>
        <div class="lgdrop"><select id="planSel">
          <option value="">— 选择你上传的训练计划（14份） —</option>
          ${PLANS.map(p=>`<option value="${p.id}">${esc(p.name)}（${p.tag}）</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="lgstat"><div><b>${nLogs}</b><span>累计日志</span></div><div><b>${new Set(logs.map(l=>l.plan)).size}</b><span>涉及计划</span></div><div><b>${logs.filter(l=>l.date===new Date().toLocaleDateString('zh-CN')).length}</b><span>今日</span></div></div>
    ${nLogs?`<div class="lgrecent"><div class="lgrt">最近日志</div>${logs.slice(-3).reverse().map(l=>`<div class="lgri" onclick="openPlan('${l.plan}')"><b>${esc(planName(l.plan))}</b><span>${l.date} · ${esc(l.content)}${l.rpe?' · RPE'+l.rpe:''}</span></div>`).join('')}</div>`:''}
  </div>`;
}

function openPlan(id){
  if(!id) return;
  setCur(id);
  curPlanId = id;
  document.getElementById('view').innerHTML = planView();
  window.scrollTo(0,0);
}

function planView(){
  const p = PLANS.find(x=>x.id===curPlanId);
  if(!p) return logView();
  const logs = getLogs().filter(l=>l.plan===p.id);
  logFilter='all';
  return `<div class="back" onclick="go('log')">← 返回训练日志</div>
  <h2 class="modtitle">${icoBoxInline('log')} ${esc(p.name)}</h2>
  <div class="ptags"><span class="ptag">${p.tag}</span><span class="ptag">${p.weeks}</span><span class="ptag">${p.freq}</span><span class="ptag">重量锚：${p.anchor}</span></div>
  <div class="pfit">适合：${esc(p.fit)}</div>
  ${p.sections.map((s,i)=>`<div class="sec${i===0?' open':''}"><div class="hd" onclick="this.parentElement.classList.toggle('open')"><span>${i+1}. ${esc(s[0])}</span><span class="arr">▶</span></div><div class="bd"><div class="content"><p>${esc(s[1])}</p></div></div></div>`).join('')}
  <div class="lgsec">
    <div class="lgsh">📝 我的训练日志 <span class="badge">${logs.length} 条</span></div>
    <div class="lgform">
      <div class="lgrow">
        <div class="lgf"><label>周次/阶段</label><input id="lgWeek" placeholder="如 第3周 / W5减载 / C2第6周"></div>
        <div class="lgf"><label>训练日</label><select id="lgDay"><option>D1</option><option>D2</option><option>D3</option><option>D4</option><option>D5</option><option>D6</option><option>加练</option></select></div>
      </div>
      <div class="lgf"><label>完成内容</label><input id="lgContent" placeholder="如 深蹲 140×3×3 @RPE8，背销 100×5×5"></div>
      <div class="lgrow">
        <div class="lgf"><label>整体RPE（可选）</label><input id="lgRpe" type="number" min="1" max="10" step="0.5" placeholder="8"></div>
        <div class="lgf"><label>日期</label><input id="lgDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="lgf"><label>备注（可选）</label><input id="lgNote" placeholder="状态、疼痛、动作调整…"></div>
      <button class="dbtn" onclick="addLog()">保存这条日志</button>
    </div>
    <div class="lglisthead">
      <span>历史记录</span>
      <select id="lgFilter" onchange="renderLogList()">
        <option value="all">全部</option>
        <option value="5">最近5条</option>
        <option value="10">最近10条</option>
      </select>
    </div>
    <div id="lgList">${logListHTML(logs)}</div>
  </div>`;
}

function logListHTML(logs){
  if(!logs.length) return `<div class="lgnone">还没有日志。按上方表单记录第一次训练吧。</div>`;
  return logs.slice().reverse().map((l,i)=>{
    const idx = logs.length-1-i;
    return `<div class="lgentry"><div class="lgehd"><b>${esc(l.week||'—')} · ${esc(l.day)}</b><span>${l.date}${l.rpe?' · RPE'+l.rpe:''}</span><a class="lgdel" onclick="delLog(${idx})">删除</a></div><div class="lgect">${esc(l.content)}</div>${l.note?`<div class="lgenote">${esc(l.note)}</div>`:''}</div>`;
  }).join('');
}
function renderLogList(){
  const f=document.getElementById('lgFilter').value;
  let logs=getLogs().filter(l=>l.plan===curPlanId);
  if(f!=='all') logs=logs.slice(-parseInt(f));
  document.getElementById('lgList').innerHTML=logListHTML(logs);
}
function addLog(){
  const c=document.getElementById('lgContent').value.trim();
  if(!c){ alert('请填写「完成内容」'); return }
  const logs=getLogs();
  logs.push({plan:curPlanId, week:document.getElementById('lgWeek').value.trim(), day:document.getElementById('lgDay').value, content:c, rpe:document.getElementById('lgRpe').value, date:document.getElementById('lgDate').value||new Date().toLocaleDateString('zh-CN'), note:document.getElementById('lgNote').value.trim(), ts:Date.now()});
  saveLogs(logs);
  document.getElementById('view').innerHTML=planView();
  window.scrollTo(0,document.body.scrollHeight);
}
function delLog(idx){
  if(!confirm('删除这条日志？')) return;
  const logs=getLogs().filter(l=>l.plan===curPlanId);
  // idx 是该计划日志数组内的索引；转换为全局：按时间戳删除
  const target=logs[idx]; if(!target) return;
  const all=getLogs(); const gi=all.findIndex(l=>l.ts===target.ts && l.plan===target.plan);
  if(gi>=0){ all.splice(gi,1); saveLogs(all) }
  document.getElementById('view').innerHTML=planView();
}
