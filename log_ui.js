// ================= 训练日志模块 v4：迁移原表 · 周×日×逐组填报 =================
let curPlanId = null;

function getCur(){ try{ return localStorage.getItem('sddr_curPlan')||'' }catch(e){ return '' } }
function setCur(id){ try{ localStorage.setItem('sddr_curPlan', id) }catch(e){} }
function getLogs(){ try{ return JSON.parse(localStorage.getItem('sddr_logs')||'[]') }catch(e){ return [] } }
function saveLogs(a){ try{ localStorage.setItem('sddr_logs', JSON.stringify(a)) }catch(e){} }
function getMaxes(pid){ try{ return JSON.parse(localStorage.getItem('sddr_max_'+pid)||'{}') }catch(e){ return {} } }
function setMaxes(pid,o){ try{ localStorage.setItem('sddr_max_'+pid, JSON.stringify(o)) }catch(e){} }
function planName(id){ const p=PLANS.find(x=>x.id===id); return p?p.name:'未知计划' }
function getT(id){ return PT[id]||null }

// 按输入变量求值 w 表达式；失败返回 null
function calcW(w, vars){
  if(w===null||w===undefined) return null;
  if(typeof w==='number') return w;
  w=String(w).trim();
  if(/[0-9]/.test(w[0]) && !/[*+(/]/.test(w) && !/^Math/.test(w)) return null; // 处方文字
  try{
    const ks=Object.keys(vars), vs=ks.map(k=>vars[k]);
    const fn=Function('"use strict";const ['+ks.join(',')+']=['+vs.join(',')+'];return ('+w+')');
    const v=fn();
    return (typeof v==='number'&&isFinite(v))?v:null;
  }catch(e){ return null }
}

function logView(){
  const cur = getCur();
  const curPlan = PLANS.find(p=>p.id===cur);
  const logs = getLogs();
  return `<div class="back" onclick="go('home')">← 返回首页</div>
  <h2 class="modtitle">${icoBoxInline('log')} 训练日志</h2>
  <div class="lghome">
    <div class="lgcard lg-cur" data-go="${curPlan?'plan-'+curPlan:''}" ${curPlan?'':'style="opacity:.55"'}>
      <div class="lgct"><span class="lgbadge">当前计划</span>
        ${curPlan?`<b>${esc(curPlan.name)}</b><span class="lgmeta">${curPlan.tag} · ${curPlan.weeks} · 原表已迁移，点击进入填报</span>`
                 :`<b>尚未选择计划</b><span class="lgmeta">从下方「计划选择」里挑一个开始</span>`}
      </div>
      ${curPlan?'<span class="lgarr">→</span>':''}
    </div>
    <div class="lgcard lg-static">
      <div class="lgct"><span class="lgbadge blue">计划选择</span>
        <div class="lgdrop"><select id="planSel">
          <option value="">— 选择你上传的训练计划（14份·原表已迁移） —</option>
          ${PLANS.map(p=>`<option value="${p.id}">${esc(p.name)}（${p.tag}）</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="lgstat"><div><b>${logs.length}</b><span>累计日志</span></div><div><b>${new Set(logs.map(l=>l.plan)).size}</b><span>涉及计划</span></div><div><b>${logs.filter(l=>l.date===new Date().toLocaleDateString('zh-CN')).length}</b><span>今日</span></div></div>
    ${logs.length?`<div class="lgrecent"><div class="lgrt">最近训练</div>${logs.slice(-3).reverse().map(l=>`<div class="lgri" onclick="openPlan('${l.plan}')"><b>${esc(planName(l.plan))}</b><span>${l.date} · ${esc(l.week)} · ${esc(l.day)} · ${l.sets.length} 组</span></div>`).join('')}</div>`:''}
  </div>`;
}

function openPlan(id){
  if(!id) return;
  setCur(id);
  curPlanId = id;
  go('plan-'+id);
}

function planView(){
  const p = PLANS.find(x=>x.id===curPlanId);
  if(!p) return logView();
  const t = getT(p.id);
  if(!t) return `<div class="back" onclick="go('log')">← 返回训练日志</div><h2 class="modtitle">${esc(p.name)}</h2><div class="lgnote">该计划暂无迁移表格。</div>`;
  const maxes = getMaxes(p.id);
  // 输入项去重（jm 的 TM 跨模块重复 k）
  const seen=new Set(); const inputs=t.inputs.filter(i=>{ if(seen.has(i.k))return false; seen.add(i.k); return true });
  const saved = inputs.every(i=>maxes[i.k]!==undefined&&maxes[i.k]!=='');
  const logs = getLogs().filter(l=>l.plan===p.id);
  return `<div class="back" onclick="go('log')">← 返回训练日志</div>
  <h2 class="modtitle">${icoBoxInline('log')} ${esc(p.name)}</h2>
  <div class="ptags"><span class="ptag">${p.tag}</span><span class="ptag">${p.weeks}</span><span class="ptag">${p.freq}</span></div>

  <div class="lgsec">
    <div class="lgsh">🏋️ 第一步 · 输入数据（极限/TM） ${saved?'<span class="lgok">已保存 ✓ 配重自动换算</span>':'<span class="lgneed">未填 · 填后表格自动算出配重</span>'}</div>
    <div class="lgform">
      <div class="lgmaxgrid">${inputs.map(i=>`
        <div class="lgf"><label>${esc(i.label)}</label><input type="number" step="2.5" min="0" class="lgmax" data-k="${esc(i.k)}" value="${maxes[i.k]!==undefined?maxes[i.k]:''}" placeholder="kg"></div>`).join('')}
      </div>
      ${t.calcNote?`<div class="lgnote">📐 换算逻辑：${esc(t.calcNote)}</div>`:''}
      <button class="dbtn" onclick="saveMaxes()">保存并换算配重</button>
    </div>
  </div>

  <div class="lgsec">
    <div class="lgsh">📝 第二步 · 每周每日逐组填报 <span class="badge">原表迁移 · ${t.weeks.length} 个周期块</span></div>
    <div class="lgform">
      <div class="lgrow">
        <div class="lgf"><label>周期/周</label>
          <select id="lgWeek" onchange="renderMoves()">${t.weeks.map((w,i)=>`<option value="${i}">${esc(w.name)}</option>`).join('')}</select>
        </div>
        <div class="lgf"><label>日期</label><input id="lgDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="lgf"><label>训练日</label>
        <select id="lgDay" onchange="renderMoves()">${t.weeks[0].days.map((d,i)=>`<option value="${i}">${esc(d.name)}</option>`).join('')}</select>
      </div>
      <div id="mvBox">${movesHTML(0,0)}</div>
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

// 渲染迁移表：动作 | 组次 | 计划配重(自动换算) | 实际重量 | 实际次数 | RPE
function varsOf(){
  const maxes=getMaxes(curPlanId), vars={};
  const t=getT(curPlanId);
  if(t) t.inputs.forEach(i=>{ const v=parseFloat(maxes[i.k]); if(isFinite(v)) vars[i.k]=v });
  return vars;
}
function movesHTML(wi, di){
  const t=getT(curPlanId); if(!t) return '';
  const w=t.weeks[wi]; if(!w||!w.days[di]) return '';
  const day=w.days[di]; const vars=varsOf();
  let out='', autoN=0, rows=0;
  day.rows.forEach((row,ri)=>{
    out+=`<div class="mvhead"><span class="mvname">${esc(row.n)}</span></div>`;
    (row.sets||[]).forEach((s,si)=>{
      const id=`${wi}_${di}_${ri}_${si}`;
      const calc=calcW(s.w, vars);
      const wtxt = calc!==null ? (Math.round(calc*10)/10)+' kg' : (s.w===null||s.w===undefined?'—':esc(String(s.w)));
      if(calc!==null) autoN++; rows++;
      out+=`<div class="setrow">
        <span class="setno">${si+1}</span>
        <span class="setd">${esc(s.d||'')}</span>
        <span class="setw">计划 <b>${wtxt}</b></span>
        <span class="mvw">实际<input type="number" step="2.5" id="k_${id}" placeholder="kg"></span>
        <span class="mvw">次数<input type="number" id="r_${id}" placeholder="次"></span>
        <span class="mvw">RPE<input type="number" step="0.5" min="1" max="10" id="p_${id}" placeholder="—"></span>
      </div>`;
    });
  });
  return out+`<div class="lgnote">📋 共 ${rows} 组 · 其中 ${autoN} 组配重已按你输入的数据自动换算（换算逻辑与原表公式一致）。其余为处方组（RPE/RIR/自选），按处方自行掌握重量。「计划」列可作参考，实际完成填在右侧。</div>`;
}

function renderMoves(){
  const t=getT(curPlanId); if(!t) return;
  const wi=parseInt(document.getElementById('lgWeek').value)||0;
  // 周切换后重建训练日列表（各周天数可能不同）
  const daySel=document.getElementById('lgDay');
  const cur=daySel.value;
  daySel.innerHTML=t.weeks[wi].days.map((d,i)=>`<option value="${i}">${esc(d.name)}</option>`).join('');
  if(!t.weeks[wi].days.some((d,i)=>String(i)===cur)) daySel.value='0';
  const di=parseInt(daySel.value)||0;
  document.getElementById('mvBox').innerHTML=movesHTML(wi,di);
}

function saveMaxes(){
  const p = PLANS.find(x=>x.id===curPlanId); if(!p) return;
  const o = {};
  document.querySelectorAll('.lgmax').forEach(inp=>{ if(inp.value) o[inp.dataset.k]=parseFloat(inp.value) });
  if(!Object.keys(o).length){ alert('请至少填写一项数据'); return }
  setMaxes(p.id, o);
  document.getElementById('view').innerHTML = planView();
  window.scrollTo(0,0);
}

function saveSession(){
  const t=getT(curPlanId); if(!t) return;
  const wi=parseInt(document.getElementById('lgWeek').value)||0;
  const di=parseInt(document.getElementById('lgDay').value)||0;
  const day=t.weeks[wi].days[di];
  const vars=varsOf();
  const sets=[];
  day.rows.forEach((row,ri)=>{
    (row.sets||[]).forEach((s,si)=>{
      const id=`${wi}_${di}_${ri}_${si}`;
      const kg=document.getElementById('k_'+id).value;
      const rep=document.getElementById('r_'+id).value;
      const rpe=document.getElementById('p_'+id).value;
      if(kg||rep){
        const calc=calcW(s.w,vars);
        sets.push({mv:row.n, set:si+1, d:s.d||'', plan:calc!==null?Math.round(calc*10)/10:(s.w||''), kg, rep, rpe});
      }
    });
  });
  if(!sets.length){ alert('请至少填写一组的实际重量或次数'); return }
  const logs=getLogs();
  logs.push({plan:curPlanId, week:t.weeks[wi].name, day:day.name, date:document.getElementById('lgDate').value||new Date().toLocaleDateString('zh-CN'), sets, rpe:document.getElementById('lgRpe').value, note:document.getElementById('lgNote').value.trim(), ts:Date.now()});
  saveLogs(logs);
  document.getElementById('view').innerHTML = planView();
  window.scrollTo(0,document.body.scrollHeight);
}

function histHTML(logs){
  if(!logs.length) return `<div class="lgnone">还没有记录。填好输入数据，按原表模板逐组记录第一次训练吧。</div>`;
  return logs.slice().reverse().map((l,i)=>{
    const idx=logs.length-1-i;
    return `<div class="lgentry"><div class="lgehd"><b>${esc(l.week)} · ${esc(l.day)}</b><span>${l.date} · ${l.sets.length} 组${l.rpe?' · 整体RPE'+l.rpe:''}</span><a class="lgdel" onclick="delLog(${idx})">删除</a></div>
    <table class="mvtab"><tr><th>动作</th><th>组</th><th>计划</th><th>实际重量</th><th>实际次数</th><th>RPE</th></tr>
    ${l.sets.map(m=>`<tr><td>${esc(m.mv)}</td><td>${m.set}</td><td>${esc(String(m.plan))}</td><td>${esc(m.kg)?esc(m.kg)+'kg':'—'}</td><td>${esc(m.rep)||'—'}</td><td>${esc(m.rpe||'—')}</td></tr>`).join('')}
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
