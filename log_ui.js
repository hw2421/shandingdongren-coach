// ================= 训练日志 v5：计划首页 + 完成格子表 + 当日逐组填报（自动保存） =================
let curPlanId = null;   // 当前计划
let curW = 0;           // 当前周期块
let curD = 0;           // 当前训练日
let showDay = false;    // 是否展开当日填报

/* ---------- 存储 ---------- */
function LS(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v) }catch(e){ return null } }
function getCur(){ return LS('sddr_curPlan')||'' }
function setCur(id){ LS('sddr_curPlan', id) }
function jget(k,def){ try{ const s=LS(k); return s?JSON.parse(s):def }catch(e){ return def } }
function jset(k,v){ LS(k, JSON.stringify(v)) }
function getMaxes(pid){ return jget('sddr_max_'+pid, {}) }
function setMaxes(pid,o){ jset('sddr_max_'+pid, o) }
function getLogs(pid){ const all=jget('sddr_logs',{}); return all[pid]||{} }
function setLogs(pid,o){ const all=jget('sddr_logs',{}); all[pid]=o; jset('sddr_logs', all) }
function planName(id){ const p=PLANS.find(x=>x.id===id); return p?p.name:'未知计划' }
function getT(id){ return PT[id]||null }

/* ---------- 计算 ---------- */
function varsOf(pid){
  const mx=getMaxes(pid), t=getT(pid), v={};
  if(t) t.inputs.forEach(i=>{ const n=parseFloat(mx[i.k]); if(isFinite(n)) v[i.k]=n });
  return v;
}
const CALC_CACHE={};
function calcW(expr, vars){
  if(!expr) return null;
  const ks=Object.keys(vars);
  if(!ks.length) return null;
  const ck=expr+'|'+ks.map(k=>vars[k]).join(',');
  if(ck in CALC_CACHE) return CALC_CACHE[ck];
  let out=null;
  try{
    const vs=ks.map(k=>vars[k]);
    const fn=Function('"use strict";const ['+ks.join(',')+']=['+vs.join(',')+'];return ('+expr+')');
    const r=fn();
    if(typeof r==='number'&&isFinite(r)) out=Math.round(r*10)/10;
  }catch(e){ out=null }
  CALC_CACHE[ck]=out; return out;
}
// 每组"计划"列：主项显示换算后的具体重量，辅助项显示处方文字（不显示公式）
function planText(set, vars){
  if(set.num!==null && set.num!==undefined) return set.num+' kg';
  if(set.expr){
    const v=calcW(set.expr, vars);
    return v!==null ? v+' kg' : '待填极限';
  }
  return set.txt || '—';
}

/* ---------- 完成判定 ---------- */
function isSetDone(lg){ return !!lg && lg.kg!=='' && lg.kg!=null && isFinite(+lg.kg) && +lg.kg>0 }
function dayKey(wi,di){ return wi+'-'+di }
function dayState(pid, wi, di){
  const t=getT(pid); if(!t) return {total:0,done:0,complete:false,partial:false};
  const logs=getLogs(pid);
  const day=t.weeks[wi].d[di];
  const rec=logs[dayKey(wi,di)];
  let total=0, done=0;
  day.g.forEach((g,gi)=>{ g.sets.forEach((s,si)=>{ total++; if(rec&&rec.sets&&isSetDone(rec.sets[gi+'_'+si])) done++ }) });
  return {total, done, complete: total>0 && done===total, partial: done>0 && done<total};
}
function planProgress(pid){
  const t=getT(pid); if(!t) return {T:0,D:0,pct:0};
  let T=0,D=0;
  t.weeks.forEach((w,wi)=>w.d.forEach((_,di)=>{ const st=dayState(pid,wi,di); T+=st.total; D+=st.done }));
  return {T,D,pct: T?Math.round(D/T*100):0};
}

/* ---------- 训练日志首页 ---------- */
function logView(){
  const cur=getCur(), cp=PLANS.find(p=>p.id===cur);
  const allLogs=jget('sddr_logs',{});
  let doneDays=0;
  Object.keys(allLogs).forEach(pid=>{ const t=getT(pid); if(!t) return;
    t.weeks.forEach((w,wi)=>w.d.forEach((_,di)=>{ if(dayState(pid,wi,di).complete) doneDays++ })) });
  return `<div class="back" onclick="go('home')">← 返回首页</div>
  <h2 class="modtitle">${icoBoxInline('log')} 训练日志</h2>
  <div class="lghome">
    <div class="lgcard lg-cur" ${cp?`onclick="openPlan('${cp.id}')"`:'style="opacity:.55"'}>
      <div class="lgct"><span class="lgbadge">当前计划</span>
        ${cp?`<b>${esc(cp.name)}</b><span class="lgmeta">${cp.tag} · ${cp.weeks} · 已完成 ${planProgress(cp.id).pct}%</span>`
            :`<b>尚未选择计划</b><span class="lgmeta">从下方「计划选择」里挑一个开始</span>`}
      </div>
      ${cp?'<span class="lgarr">→</span>':''}
    </div>
    <div class="lgcard lg-static">
      <div class="lgct"><span class="lgbadge blue">计划选择</span>
        <div class="lgdrop"><select id="planSel">
          <option value="">— 选择你上传的训练计划（14份） —</option>
          ${PLANS.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}（${p.tag}）</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="lgstat"><div><b>${doneDays}</b><span>已完成训练日</span></div><div><b>${Object.keys(allLogs).length}</b><span>有记录计划</span></div><div><b>14</b><span>计划总数</span></div></div>
  </div>`;
}

function openPlan(id){
  if(!id) return;
  setCur(id); curPlanId=id; curW=0; curD=0; showDay=false;
  go('plan-'+id);
}

/* ---------- 计划首页 ---------- */
function planView(){
  const p=PLANS.find(x=>x.id===curPlanId); const t=getT(curPlanId);
  if(!p||!t) return logView();
  const mx=getMaxes(p.id);
  const seen=new Set(); const inputs=t.inputs.filter(i=>{ if(seen.has(i.k))return false; seen.add(i.k); return true });
  const allFilled=inputs.every(i=>mx[i.k]!==undefined && mx[i.k]!=='');
  const pr=planProgress(p.id);
  return `<div class="back" onclick="go('log')">← 训练日志</div>
  <h2 class="modtitle">${icoBoxInline('log')} ${esc(p.name)}</h2>
  <div class="ptags"><span class="ptag">${p.tag}</span><span class="ptag">${p.weeks}</span><span class="ptag">${p.freq}</span></div>

  <div class="lgsec">
    <div class="lgsh">🏋️ 训练极限 ${allFilled?'<span class="lgok">已保存 · 配重已换算 ✓</span>':'<span class="lgneed">填写后自动换算</span>'}</div>
    <div class="lgmaxgrid">${inputs.map(i=>`
      <div class="lgf"><label>${esc(i.label)}</label><input type="number" step="2.5" min="0" class="lgmaxI" data-k="${esc(i.k)}" value="${mx[i.k]!==undefined?mx[i.k]:''}" placeholder="kg" onchange="saveMaxAuto()"></div>`).join('')}
    </div>
    ${t.calcNote?`<div class="lgnote">📐 ${esc(t.calcNote)}</div>`:''}
  </div>

  <div class="lgsec" id="gridSec">
    <div class="lgsh">✅ 每日完成情况 <span class="lgpg">${pr.D}/${pr.T} 组 · ${pr.pct}%</span></div>
    <div class="lgbarsm"><i style="width:${pr.pct}%"></i></div>
    <div id="gridBox">${gridHTML(t)}</div>
  </div>

  <div class="lgsec" id="daySec">
    <div class="lgsh">📝 当日训练 ${showDay?`<span class="badge">${esc(t.weeks[curW].n)} · ${esc(t.weeks[curW].d[curD].n)}</span>`:''}</div>
    <div id="dayBox">${showDay?dayHTML(t):'<div class="lgnone">点击上方任一训练日格子，查看并填报当日训练</div>'}</div>
  </div>

  ${p.sections.map((s,i)=>`<div class="sec"><div class="hd" onclick="this.parentElement.classList.toggle('open')"><span>📋 ${esc(s[0])}</span><span class="arr">▶</span></div><div class="bd"><div class="content"><p>${esc(s[1])}</p></div></div></div>`).join('')}`;
}

/* ---------- 完成情况格子表 ---------- */
function gridHTML(t){
  return t.weeks.map((w,wi)=>{
    const label=w.n.length>12?w.n.slice(0,12)+'…':w.n;
    return `<div class="gblock"><div class="gbt">${esc(label)}</div><div class="gcells">${
      w.d.map((d,di)=>{
        const st=dayState(curPlanId,wi,di);
        const sel=(showDay&&wi===curW&&di===curD)?' sel':'';
        return `<div class="gcell${st.complete?' done':''}${st.partial?' part':''}${sel}" onclick="pickDay(${wi},${di})" title="${esc(d.n)} · ${st.done}/${st.total}组"><b>${st.complete?'✓':esc(dayNum(d.n))}</b><span>${st.total}组</span></div>`;
      }).join('')
    }</div></div>`;
  }).join('');
}
function dayNum(n){
  const m=String(n).match(/D\s*(\d+)/i) || String(n).match(/第\s*(\d+)\s*天/) || String(n).match(/(\d+)/);
  return m?('D'+m[1]):String(n).slice(0,2);
}

function pickDay(wi,di){
  curW=wi; curD=di; showDay=true;
  const t=getT(curPlanId);
  const gb=document.getElementById('gridBox'); if(gb) gb.innerHTML=gridHTML(t);
  const sh=document.querySelector('#daySec .lgsh');
  if(sh) sh.innerHTML=`📝 当日训练 <span class="badge">${esc(t.weeks[wi].n)} · ${esc(t.weeks[wi].d[di].n)}</span>`;
  const box=document.getElementById('dayBox'); if(box) box.innerHTML=dayHTML(t);
  const sec=document.getElementById('daySec');
  if(sec) sec.scrollIntoView({behavior:'smooth',block:'start'});
}

function saveMaxAuto(){
  const p=PLANS.find(x=>x.id===curPlanId); if(!p) return;
  const o={}; document.querySelectorAll('.lgmaxI').forEach(i=>{ if(i.value!=='') o[i.dataset.k]=parseFloat(i.value) });
  setMaxes(p.id,o);
  Object.keys(CALC_CACHE).forEach(k=>delete CALC_CACHE[k]);
  const sh=document.querySelector('.lgsec .lgsh');
  if(sh) sh.innerHTML='🏋️ 训练极限 <span class="lgok">已保存 · 配重已换算 ✓</span>';
  const t=getT(p.id);
  const gb=document.getElementById('gridBox'); if(gb) gb.innerHTML=gridHTML(t);
  if(showDay){ const box=document.getElementById('dayBox'); if(box) box.innerHTML=dayHTML(t) }
  refreshProgressBar();
  toast('已自动保存 · 配重已更新');
}
function refreshProgressBar(){
  const pr=planProgress(curPlanId);
  const el=document.querySelector('#gridSec .lgpg'); if(el) el.textContent=`${pr.D}/${pr.T} 组 · ${pr.pct}%`;
  const bar=document.querySelector('.lgbarsm i'); if(bar) bar.style.width=pr.pct+'%';
}

/* ---------- 当日训练表 ---------- */
const COLHEAD='<div class="thead"><span>#</span><span>计划</span><span>次</span><span>重量</span><span>RPE</span></div>';
function dayHTML(t){
  const w=t.weeks[curW], day=w.d[curD];
  const vars=varsOf(curPlanId);
  const rec=getLogs(curPlanId)[dayKey(curW,curD)]||{sets:{}};
  const st=dayState(curPlanId,curW,curD);
  let html=`<div class="dayhd"><div><b>${esc(w.n)}</b><span>${esc(day.n)}</span></div><div class="daypr">${st.done}/${st.total} 组${st.complete?' · 已打勾 ✓':''}</div></div>`;
  html+=COLHEAD;
  day.g.forEach((g,gi)=>{
    html+=`<div class="ghead">${esc(g.n)}</div>`;
    g.sets.forEach((s,si)=>{
      const k=gi+'_'+si, lg=rec.sets[k]||{};
      const plan=planText(s,vars);
      const reps=String(s.r||'');
      html+=`<div class="trow${isSetDone(lg)?' done':''}">
        <span class="tno">${si+1}</span>
        <span class="tplan">${esc(plan)}</span>
        <span class="treps">${esc(reps||'—')}</span>
        <input type="number" inputmode="decimal" step="2.5" min="0" value="${lg.kg!==undefined?lg.kg:''}" placeholder="kg" onchange="saveSet(${gi},${si},'kg',this.value)">
        <input type="number" inputmode="decimal" step="0.5" min="1" max="10" value="${lg.rpe!==undefined?lg.rpe:''}" placeholder="—" onchange="saveSet(${gi},${si},'rpe',this.value)">
      </div>`;
    });
  });
  html+=`<div class="lgnote" style="margin-top:10px">💡 填重量自动保存并判定完成；整日全部填写后，格子表自动打勾。RPE 可留空。</div>
  <div class="lgf" style="margin-top:8px"><label>当日备注</label><input value="${esc(rec.note||'')}" placeholder="状态、疼痛、动作调整…" onchange="saveNote(this.value)"></div>`;
  return html;
}

function saveSet(gi,si,f,v){
  if(v!=='' && (!isFinite(+v) || +v<0)) { rerenderDay(); return }
  if(f==='rpe' && v!=='' && (+v<1||+v>10)) { rerenderDay(); return }
  const logs=getLogs(curPlanId); const k=dayKey(curW,curD);
  logs[k]=logs[k]||{sets:{}}; logs[k].sets=logs[k].sets||{};
  const sk=gi+'_'+si;
  logs[k].sets[sk]=logs[k].sets[sk]||{};
  if(v==='') delete logs[k].sets[sk][f]; else logs[k].sets[sk][f]=+v;
  if(!Object.keys(logs[k].sets[sk]).length) delete logs[k].sets[sk];
  setLogs(curPlanId,logs);
  // 行状态 + 进度 + 格子
  const sel=`input[onchange*="saveSet(${gi},${si},'kg'"]`;
  const row=document.querySelector(sel)?.closest('.trow');
  if(row) row.classList.toggle('done', isSetDone(logs[k].sets[sk]));
  refreshProgressBar();
  const gb=document.getElementById('gridBox'); if(gb) gb.innerHTML=gridHTML(getT(curPlanId));
  const st=dayState(curPlanId,curW,curD);
  const dh=document.querySelector('.daypr');
  if(dh) dh.innerHTML=`${st.done}/${st.total} 组${st.complete?' · 已打勾 ✓':''}`;
  toast(st.complete?'本日已完成 ✓ 已自动保存':'已自动保存');
}
function rerenderDay(){ const box=document.getElementById('dayBox'); if(box) box.innerHTML=dayHTML(getT(curPlanId)); }
function saveNote(v){
  const logs=getLogs(curPlanId); const k=dayKey(curW,curD);
  logs[k]=logs[k]||{sets:{}}; logs[k].note=v;
  setLogs(curPlanId,logs); toast('备注已保存');
}
function toast(msg){
  let el=document.getElementById('lgtoast');
  if(!el){ el=document.createElement('div'); el.id='lgtoast'; document.body.appendChild(el) }
  el.className='lgtoast'; el.textContent=msg;
  requestAnimationFrame(()=>el.classList.add('on'));
  clearTimeout(window.__lgT); window.__lgT=setTimeout(()=>el.classList.remove('on'),1500);
}
