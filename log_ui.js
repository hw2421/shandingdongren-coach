// ================= 训练日志模块 v3：周×日×逐组填报模板 =================
let curPlanId = null;
let curWeek = 1;

function getCur(){ try{ return localStorage.getItem('sddr_curPlan')||'' }catch(e){ return '' } }
function setCur(id){ try{ localStorage.setItem('sddr_curPlan', id) }catch(e){} }
function getLogs(){ try{ return JSON.parse(localStorage.getItem('sddr_logs')||'[]') }catch(e){ return [] } }
function saveLogs(a){ try{ localStorage.setItem('sddr_logs', JSON.stringify(a)) }catch(e){} }
function getMaxes(pid){ try{ return JSON.parse(localStorage.getItem('sddr_max_'+pid)||'{}') }catch(e){ return {} } }
function setMaxes(pid,o){ try{ localStorage.setItem('sddr_max_'+pid, JSON.stringify(o)) }catch(e){} }
function planName(id){ const p=PLANS.find(x=>x.id===id); return p?p.name:'未知计划' }

function logView(){
  const cur = getCur();
  const curPlan = PLANS.find(p=>p.id===cur);
  const logs = getLogs();
  return `<div class="back" onclick="go('home')">← 返回首页</div>
  <h2 class="modtitle">${icoBoxInline('log')} 训练日志</h2>
  <div class="lghome">
    <div class="lgcard lg-cur" data-go="${curPlan?'plan-'+curPlan:''}" ${curPlan?'':'style="opacity:.55"'}>
      <div class="lgct"><span class="lgbadge">当前计划</span>
        ${curPlan?`<b>${esc(curPlan.name)}</b><span class="lgmeta">${curPlan.tag} · ${curPlan.weeks} · 点击进入逐组填报</span>`
                 :`<b>尚未选择计划</b><span class="lgmeta">从下方「计划选择」里挑一个开始</span>`}
      </div>
      ${curPlan?'<span class="lgarr">→</span>':''}
    </div>
    <div class="lgcard lg-static">
      <div class="lgct"><span class="lgbadge blue">计划选择</span>
        <div class="lgdrop"><select id="planSel">
          <option value="">— 选择你上传的训练计划（14份） —</option>
          ${PLANS.map(p=>`<option value="${p.id}">${esc(p.name)}（${p.tag}）</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="lgstat"><div><b>${logs.length}</b><span>累计日志</span></div><div><b>${new Set(logs.map(l=>l.plan)).size}</b><span>涉及计划</span></div><div><b>${logs.filter(l=>l.date===new Date().toLocaleDateString('zh-CN')).length}</b><span>今日</span></div></div>
    ${logs.length?`<div class="lgrecent"><div class="lgrt">最近训练</div>${logs.slice(-3).reverse().map(l=>`<div class="lgri" onclick="openPlan('${l.plan}')"><b>${esc(planName(l.plan))}</b><span>${l.date} · 第${l.week}周 · ${esc(l.day)} · ${l.sets.length} 组</span></div>`).join('')}</div>`:''}
  </div>`;
}

function openPlan(id){
  if(!id) return;
  setCur(id);
  curPlanId = id;
  curWeek = 1;
  go('plan-'+id);
}

function planView(){
  const p = PLANS.find(x=>x.id===curPlanId);
  if(!p) return logView();
  const maxes = getMaxes(p.id);
  const maxSaved = p.maxes.every(k=>maxes[k]);
  const logs = getLogs().filter(l=>l.plan===p.id);
  const today = new Date().toISOString().slice(0,10);
  return `<div class="back" onclick="go('log')">← 返回训练日志</div>
  <h2 class="modtitle">${icoBoxInline('log')} ${esc(p.name)}</h2>
  <div class="ptags"><span class="ptag">${p.tag}</span><span class="ptag">${p.weeks}</span><span class="ptag">${p.freq}</span><span class="ptag">重量锚：${p.anchor}</span></div>

  <div class="lgsec">
    <div class="lgsh">🏋️ 第一步 · 训练极限输入 ${maxSaved?'<span class="lgok">已保存 ✓</span>':'<span class="lgneed">未填 · 建议先填写</span>'}</div>
    <div class="lgform">
      <div class="lgmaxgrid">${p.maxes.map(k=>`
        <div class="lgf"><label>${esc(k)}（kg）</label><input type="number" step="2.5" min="0" class="lgmax" data-k="${esc(k)}" value="${maxes[k]||''}" placeholder="如 140"></div>`).join('')}
      </div>
      ${p.maxnote?`<div class="lgnote">📌 ${esc(p.maxnote)}</div>`:''}
      <button class="dbtn" onclick="saveMaxes()">保存训练极限</button>
    </div>
  </div>

  <div class="lgsec">
    <div class="lgsh">📝 第二步 · 每周每日逐组填报 <span class="badge">按计划固定模板</span></div>
    <div class="lgform">
      <div class="lgrow">
        <div class="lgf"><label>训练周（共 ${p.weeksN} 周）</label>
          <select id="lgWeek" onchange="curWeek=parseInt(this.value)||1">${Array.from({length:p.weeksN},(_,i)=>`<option value="${i+1}" ${i===0?'selected':''}>第 ${i+1} 周</option>`).join('')}</select>
        </div>
        <div class="lgf"><label>日期</label><input id="lgDate" type="date" value="${today}"></div>
      </div>
      <div class="lgf"><label>训练日（${p.days.length} 个固定训练日）</label>
        <select id="lgDay" onchange="renderMoves()">${p.days.map((d,i)=>`<option value="${i}">${esc(d.n)}</option>`).join('')}</select>
      </div>
      <div id="mvBox">${movesHTML(p,0)}</div>
      <div class="lgrow">
        <div class="lgf"><label>整体RPE（可选）</label><input id="lgRpe" type="number" min="1" max="10" step="0.5" placeholder="8"></div>
        <div class="lgf"><label>备注（可选）</label><input id="lgNote" placeholder="状态、疼痛、调整…"></div>
      </div>
      <button class="dbtn" onclick="saveSession()">保存本次训练（逐组记录）</button>
    </div>
  </div>

  <div class="lgsec">
    <div class="lgsh">📊 训练历史 <span class="badge">${logs.length} 条</span></div>
    <div id="lgList">${histHTML(logs)}</div>
  </div>

  ${p.sections.map((s,i)=>`<div class="sec${i===0?' open':''}"><div class="hd" onclick="this.parentElement.classList.toggle('open')"><span>📋 ${esc(s[0])}</span><span class="arr">▶</span></div><div class="bd"><div class="content"><p>${esc(s[1])}</p></div></div></div>`).join('')}`;
}

// 按训练日固定模板渲染：每个动作 → 逐组行（计划处方 + 实际重量/次数/RPE）
function movesHTML(p, di){
  const d = p.days[di]; if(!d) return '';
  let out='';
  d.m.forEach((mv,mi)=>{
    out+=`<div class="mvhead"><span class="mvname">${esc(mv.n)}</span><span class="mvrx">${esc(mv.rx)}</span></div>`;
    for(let s=0;s<mv.sets;s++){
      const id=`${di}_${mi}_${s}`;
      out+=`<div class="setrow">
        <span class="setno">${s+1}</span>
        <span class="mvw">实际重量<input type="number" step="2.5" id="k_${id}" placeholder="kg"></span>
        <span class="mvw">实际次数<input type="number" id="r_${id}" placeholder="次"></span>
        <span class="mvw">RPE<input type="number" step="0.5" min="1" max="10" id="p_${id}" placeholder="—"></span>
      </div>`;
    }
  });
  return out+`<div class="lgnote">每个动作下的每一行就是一组：填入该组实际重量与完成次数。动作名称与组数、处方严格按该计划原文设定。</div>`;
}

function renderMoves(){
  const p = PLANS.find(x=>x.id===curPlanId); if(!p) return;
  curWeek = parseInt(document.getElementById('lgWeek').value)||1;
  const di = parseInt(document.getElementById('lgDay').value)||0;
  document.getElementById('mvBox').innerHTML = movesHTML(p, di);
}

function saveMaxes(){
  const p = PLANS.find(x=>x.id===curPlanId); if(!p) return;
  const o = {};
  document.querySelectorAll('.lgmax').forEach(inp=>{ if(inp.value) o[inp.dataset.k]=parseFloat(inp.value) });
  if(!Object.keys(o).length){ alert('请至少填写一项训练极限'); return }
  setMaxes(p.id, o);
  document.getElementById('view').innerHTML = planView();
  window.scrollTo(0,0);
}

function saveSession(){
  const p = PLANS.find(x=>x.id===curPlanId); if(!p) return;
  const di = parseInt(document.getElementById('lgDay').value)||0;
  const wk = parseInt(document.getElementById('lgWeek').value)||1;
  const sets = [];
  p.days[di].m.forEach((mv,mi)=>{
    for(let s=0;s<mv.sets;s++){
      const kg=document.getElementById('k_'+di+'_'+mi+'_'+s).value;
      const rep=document.getElementById('r_'+di+'_'+mi+'_'+s).value;
      const rpe=document.getElementById('p_'+di+'_'+mi+'_'+s).value;
      if(kg||rep) sets.push({mv:mv.n, set:s+1, kg, rep, rpe});
    }
  });
  if(!sets.length){ alert('请至少填写一组的重量或次数'); return }
  const logs=getLogs();
  logs.push({plan:p.id, week:wk, day:p.days[di].n, date:document.getElementById('lgDate').value||new Date().toLocaleDateString('zh-CN'), sets, rpe:document.getElementById('lgRpe').value, note:document.getElementById('lgNote').value.trim(), ts:Date.now()});
  saveLogs(logs);
  document.getElementById('view').innerHTML = planView();
  window.scrollTo(0,document.body.scrollHeight);
}

// 训练历史：按周分组，每次训练展开为逐组明细
function histHTML(logs){
  if(!logs.length) return `<div class="lgnone">还没有记录。填好训练极限，按模板逐组记录第一次训练吧。</div>`;
  return logs.slice().reverse().map((l,i)=>{
    const idx=logs.length-1-i;
    return `<div class="lgentry"><div class="lgehd"><b>第${l.week}周 · ${esc(l.day)}</b><span>${l.date} · ${l.sets.length} 组${l.rpe?' · 整体RPE'+l.rpe:''}</span><a class="lgdel" onclick="delLog(${idx})">删除</a></div>
    <table class="mvtab"><tr><th>动作</th><th>组</th><th>实际重量</th><th>实际次数</th><th>RPE</th></tr>
    ${l.sets.map(m=>`<tr><td>${esc(m.mv)}</td><td>${m.set}</td><td>${esc(m.kg)?esc(m.kg)+'kg':'—'}</td><td>${esc(m.rep)||'—'}</td><td>${esc(m.rpe||'—')}</td></tr>`).join('')}
    </table>${l.note?`<div class="lgenote">${esc(l.note)}</div>`:''}</div>`;
  }).join('');
}

function delLog(idx){
  if(!confirm('删除这条训练记录？')) return;
  const logs=getLogs().filter(l=>l.plan===curPlanId);
  const target=logs[idx]; if(!target) return;
  const all=getLogs(); const gi=all.findIndex(l=>l.ts===target.ts && l.plan===target.plan);
  if(gi>=0){ all.splice(gi,1); saveLogs(all) }
  document.getElementById('view').innerHTML=planView();
}
