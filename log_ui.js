// ================= 训练日志 v7 =================
// 规则：重量最小单位 2.5kg 四舍五入；实际重量默认=计划重量；增列实际次数；严格按组数逐行展开
let curPlanId = null, curW = 0, curD = 0, showDay = false;

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
function getT(id){ return PT[id]||null }

/* ---------- 重量取整：最小单位 2.5kg，四舍五入 ---------- */
function r25(x){ if(!isFinite(x)) return null; return Math.round(x/2.5)*2.5 }
function fmtW(x){ if(x===null||x===undefined||!isFinite(x)) return ''; const v=Math.round(x*10)/10; return (v%1===0? v.toFixed(0): v.toFixed(1)); }

/* ---------- 配重换算 ---------- */
/* 取用户填过的极限；没填则用计划默认值 */
function maxOf(pid,k){
  const mx=getMaxes(pid), t=getT(pid);
  let n=parseFloat(mx[k]);
  if(!isFinite(n) && t){
    const inp=t.inputs.find(i=>i.k===k);
    if(inp && inp.def!==undefined && inp.def!==null) n=parseFloat(inp.def);
  }
  return isFinite(n)?n:null;
}

/* 取出训练日志里某个 set 的实际次数（AMAP 推算用） */
function actualReps(pid,wi,di,gi,si){
  const rec=getLogs(pid)[dayKey(wi,di)];
  if(!rec||!rec.sets) return null;
  const it=rec.sets[gi+'_'+si];
  const n=it?parseFloat(it.reps):NaN;
  return isFinite(n)&&n>0?n:null;
}

/* ===== Juggernaut 滚动 TM：模块1=90%×1RM；模块2~4=上模块TM+（上模块第3周主项末组实次−标准次数）×2.5 ===== */
function jmTM(pid, mod, lift){
  const t=getT(pid); if(!t) return null;
  const rm=maxOf(pid, lift); if(rm===null) return null;
  const base = r25(rm*0.9);
  if(mod<=1) return base;
  let tm=base;
  /* 每个模块的「第3周（转化期）」= 该模块第3周全，主项末组标准次数见下表 */
  const STD={1:10, 2:8, 3:5, 4:3};      // 各模块转化期末组 AMAP 的「标准次数」
  /* 该周主项＝当周「第一个匹配动作」的最后一组；未填报 → 返回 null（下周期 TM 不显示） */
  for(let m=1;m<mod;m++){
    const wi=(m-1)*4+2;                  // 第 m 模块的第3周索引
    const w=t.weeks[wi]; if(!w) break;
    let got=null, found=false;
    const liftRe=new RegExp(lift==='sq'?'Squat|深蹲':lift==='bp'?'Bench|卧推':'Deadlift|硬拉','i');
    outer:
    for(let di=0;di<w.d.length;di++){
      for(let gi=0;gi<w.d[di].g.length;gi++){
        const g=w.d[di].g[gi];
        if(!liftRe.test(g.n)) continue;
        found=true;                       // 找到第一个匹配动作即锁定
        const si=g.s.length-1;
        got=actualReps(pid,wi,di,gi,si);
        break outer;
      }
    }
    if(!found || got===null) return null; /* 未填报 → 不显示下周期训练极限 */
    tm = r25(tm + 2.5*(got - (STD[m]||5)));
  }
  return tm;
}

function varsOf(pid){
  const mx=getMaxes(pid), t=getT(pid), v={};
  if(!t) return v;
  t.inputs.forEach(i=>{
    const n=maxOf(pid,i.k);
    if(n!==null) v[i.k]=n;
  });
  /* Juggernaut：注入 TM1_sq ~ TM4_ohp 四个模块的训练上限 */
  if(pid==='jm' && t.rolling){
    [1,2,3,4].forEach(m=>{
      ['sq','bp','dl','ohp'].forEach(l=>{
        const tm=jmTM(pid,m,l);
        if(tm!==null && tm>0) v['TM'+m+'_'+l]=tm;
      });
    });
  }
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
    /* r25 必须显式注入作用域，否则表达式里的 r25(...) 会抛 ReferenceError */
    const fn=Function('r25',...ks,'"use strict";return ('+expr+')');
    const r=fn(r25, ...ks.map(k=>vars[k]));
    if(typeof r==='number'&&isFinite(r)&&r>0) out=r25(r);
  }catch(e){ out=null }
  CALC_CACHE[ck]=out; return out;
}

/* ---------- 单个 set 的计划值 ---------- */
function planWeightOf(set, vars){
  if(set.n!==null && set.n!==undefined && isFinite(set.n)) return r25(+set.n);
  if(set.e){ return calcW(set.e, vars); }
  return null;
}
// 计划列展示：重量 / 仅处方文字（绝不显示公式与计算过程）
function planText(set, vars){
  const w=planWeightOf(set,vars);
  if(w!==null) return fmtW(w)+' kg';
  if(set.e) return '待填极限';
  /* 无强度/无重量的辅助动作：计划列只显示 *（次数已在「次」列） */
  if(set.x==='*' || set.nomark==='*') return '*';
  const d=String(set.d||'').trim(), t=String(set.t||'').trim();
  if(!d && !t) return '*';
  if(d===t) return d;
  if(set.tn && t) return d || '*';   /* ? 批注类备注不拼进计划列 */
  if(!set.tn && t && set.t && !set.e) return (d? d+' ' : '')+t;  /* RPE 类备注拼进计划列（如 1*8 @RPE8） */
  if(d && /^[0-9\s+~\-]+$/.test(d)) return '*';
  return d || t || '*';
}
// 次数字段：优先 r，其次 d 里抽取
function repsOf(set){
  const r=set.r;
  if(r!==null && r!==undefined && String(r).trim()!=='') return String(r).trim();
  const m=String(set.d||'').match(/^\s*(\S+)/);
  return m? m[1] : '';
}

/* ---------- 完成判定：重量+实际次数都已填 ---------- */
function isSetDone(lg){
  if(!lg) return false;
  const kg=+lg.kg, reps=+lg.reps;
  /* 自重/自选重量动作记 kg=0 也算完成（只看实次） */
  return isFinite(kg) && kg>=0 && isFinite(reps) && reps>0;
}
function dayKey(wi,di){ return wi+'-'+di }
function dayState(pid, wi, di){
  const t=getT(pid); if(!t) return {total:0,done:0,complete:false,partial:false};
  const w=t.weeks[wi]; if(!w) return {total:0,done:0,complete:false,partial:false};
  const day=w.d[di]; if(!day) return {total:0,done:0,complete:false,partial:false};
  const rec=getLogs(pid)[dayKey(wi,di)];
  let total=0, done=0;
  day.g.forEach((g,gi)=>g.s.forEach((s,si)=>{ total++; if(rec&&rec.sets&&isSetDone(rec.sets[gi+'_'+si])) done++ }));
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
          <option value="">— 选择你上传的训练计划（${PLANS.length}份） —</option>
          ${PLANS.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}（${p.tag}）</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="lgstat"><div><b>${doneDays}</b><span>已完成训练日</span></div><div><b>${Object.keys(allLogs).length}</b><span>有记录计划</span></div><div><b>${PLANS.length}</b><span>计划总数</span></div></div>
  </div>
  ${planGuideHTML(cur)}`;
}
/* ---------- 计划选择页下方：适合人群 / 使用阶段 / 优劣点 ---------- */
function planGuideHTML(cur){
  const rows=PLANS.map(p=>{
    const on=p.id===cur?' on':'';
    const pros=(p.pros||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    const cons=(p.cons||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    return `<div class="pguide${on}" onclick="openPlan('${p.id}')">
      <div class="pgh"><b>${esc(p.name)}</b><span>${esc(p.tag)} · ${esc(p.freq||'')}</span>${on?'<i class="pgtag">当前</i>':''}</div>
      <div class="pgrow"><label>适合人群</label><p>${esc(p.who||'—')}</p></div>
      <div class="pgrow"><label>使用阶段</label><p>${esc(p.stage||'—')}</p></div>
      <div class="pgcols">
        <div class="pgcol pro"><label>优点</label><ul>${pros||'<li>—</li>'}</ul></div>
        <div class="pgcol con"><label>注意 / 缺点</label><ul>${cons||'<li>—</li>'}</ul></div>
      </div>
      ${p.src?`<div class="pgsrc">📎 依据：${esc(p.src)}</div>`:''}
    </div>`;
  }).join('');
  return `<div class="lgsec" id="planGuide">
    <div class="lgsh">📋 计划选择指南 <span class="lgpg">适合人群 · 使用阶段 · 优缺点</span></div>
    <div class="lgnote" style="margin-bottom:8px">按自己的<b>训练年限</b>、<b>每周可练天数</b>、<b>当前阶段（增肌 / 提升力量 / 备赛）</b>三件事来选；点任一张卡片即可直接进入该计划。</div>
    ${rows}
  </div>`;
}
function openPlan(id){
  if(!id) return;
  setCur(id); curPlanId=id; curW=0; curD=0; showDay=false;
  go('plan-'+id);
}

/* ---------- 计划首页 ---------- */
function planView(){
  const p=PLANS.find(x=>x.id===curPlanId), t=getT(curPlanId);
  if(!p||!t) return logView();
  const mx=getMaxes(p.id);
  const seen=new Set(); const inputs=t.inputs.filter(i=>{ if(seen.has(i.k))return false; seen.add(i.k); return true });
  const allFilled=inputs.length>0 && inputs.every(i=>mx[i.k]!==undefined && mx[i.k]!=='');
  const pr=planProgress(p.id);
  return `<div class="back" onclick="go('log')">← 训练日志</div>
  <h2 class="modtitle">${icoBoxInline('log')} ${esc(p.name)}</h2>
  <div class="ptags"><span class="ptag">${p.tag}</span><span class="ptag">${p.weeks}</span><span class="ptag">${p.freq}</span></div>

  ${inputs.length? `<div class="lgsec">
    <div class="lgsh">🏋️ 首次训练极限 ${allFilled?'<span class="lgok">已保存 · 已换算 ✓</span>':'<span class="lgneed">填写一次即可，后续自动换算</span>'}</div>
    <div class="lgmaxgrid${inputs.length>2?' three':''}">${inputs.map(i=>`
      <div class="lgf"><label>${esc(i.label)}</label><input type="number" step="2.5" min="0" class="lgmaxI" data-k="${esc(i.k)}" value="${mx[i.k]!==undefined?mx[i.k]:(i.def!==undefined?i.def:'')}" placeholder="kg" onchange="saveMaxAuto()"></div>`).join('')}
    </div>
    <div class="lgnote" style="margin-top:8px">📐 ${t.rolling? '模块1训练上限＝首填极限 × 90%；后续模块按上一模块第3周第一个主项动作最后一组的「实次」自动推算（未填写则不显示该模块训练上限）。此处只填一次。' : '首次填一次极限即可，之后按计划表逻辑自动换算，全部取 2.5kg 整数倍。'}</div>
    ${t.rolling? `<div class="jmroll" id="jmRoll">${jmRollHTML()}</div>`:''}
  </div>` : `<div class="lgsec"><div class="lgnote">🎯 本计划按 <b>RPE 处方</b>执行：重量由当天 RPE 与次数自行确定，不自动换算。填「实重 + 实次」即可记录。</div></div>`}

  ${bigThreeHTML(p.id)}

  <div class="lgsec" id="gridSec">
    <div class="lgsh">✅ 每日完成 <span class="lgpg">${pr.D}/${pr.T} 组 · ${pr.pct}%</span></div>
    <div class="lgbarsm"><i style="width:${pr.pct}%"></i></div>
    <div id="gridBox">${gridHTML(t)}</div>
  </div>

  <div class="lgsec" id="daySec">
    <div class="lgsh">📝 当日训练 ${showDay?`<span class="badge">${esc(t.weeks[curW].n)} · ${esc(t.weeks[curW].d[curD].n)}</span>`:''}</div>
    <div id="dayBox">${showDay?dayHTML(t):'<div class="lgnone">点击上方任一训练日格子，查看并填报当日训练</div>'}</div>
  </div>

  ${(p.sections||[]).map(s=>`<div class="sec"><div class="hd" onclick="this.parentElement.classList.toggle('open')"><span>📋 ${esc(s[0])}</span><span class="arr">▶</span></div><div class="bd"><div class="content"><p>${esc(s[1])}</p></div></div></div>`).join('')}`;
}

/* ---------- 三大项（深蹲/卧推/硬拉）预测合计 ---------- */
function bigThree(pid){
  const t=getT(pid); if(!t) return null;
  const KEY={sq:/^(tsq|sq2|sq)$/i, bp:/^(tbp|bp)$/i, dl:/^(tdl|dl)$/i};
  const base={sq:null,bp:null,dl:null};
  t.inputs.forEach(i=>{
    for(const lift in KEY){
      if(KEY[lift].test(i.k) && base[lift]===null){
        const n=maxOf(pid,i.k);
        if(n!==null) base[lift]=n;
      }
    }
  });
  /* 从已完成日志中取各动作最佳 e1RM（Epley：kg×(1+次数/30)） */
  const GRP={sq:/深蹲|squat/i, bp:/卧推|bench/i, dl:/硬拉|deadlift/i};
  const best={sq:0,bp:0,dl:0};
  const logs=getLogs(pid);
  t.weeks.forEach((w,wi)=>w.d.forEach((day,di)=>{
    const rec=logs[dayKey(wi,di)]; if(!rec||!rec.sets) return;
    day.g.forEach((g,gi)=>g.s.forEach((s,si)=>{
      const it=rec.sets[gi+'_'+si]; if(!it) return;
      const kg=+it.kg, reps=+it.reps;
      if(!isFinite(kg)||kg<=0||!isFinite(reps)||reps<=0) return;
      for(const lift in GRP){
        if(GRP[lift].test(g.n)){
          const e=kg*(1+reps/30);
          if(e>best[lift]) best[lift]=r25(e);
          break;
        }
      }
    }));
  }));
  const baseSum=(base.sq||0)+(base.bp||0)+(base.dl||0);
  const hasBase=baseSum>0;
  const hasLog=best.sq||best.bp||best.dl;
  const predSum=hasLog? r25(best.sq+best.bp+best.dl) : (hasBase? baseSum : null);
  return {base, baseSum, hasBase, predSum, hasLog, best};
}
function bigThreeHTML(pid){
  const b=bigThree(pid); if(!b) return '';
  const diff=(b.hasLog&&b.hasBase)? Math.round(b.predSum-b.baseSum) : null;
  const diffTxt=diff===null? '' : ` <span style="color:${diff>=0?'var(--acc)':'#e08a6a'}">(${diff>=0?'+':''}${diff} kg)</span>`;
  const liftTxt=[['sq','蹲'],['bp','推'],['dl','拉']].map(([k,l])=>`${l} ${b.best[k]?fmtW(b.best[k]):(b.base[k]!==null&&b.base[k]!==undefined?fmtW(r25(b.base[k]*0.9)):'—')}`).join(' · ');
  const predLine=b.hasLog? fmtW(b.predSum)+' kg'
    : (b.hasBase? fmtW(b.baseSum)+' kg（暂无训练记录，暂按首填合计计）' : '—');
  return `<div class="lgsec" id="b3sec"><div class="lgsh">🏆 三大项预测合计（深蹲+卧推+硬拉）</div>
    <div class="b3box">
      <div class="b3main"><b>${predLine}</b><span>预测合计${diffTxt}</span></div>
      <div class="b3sub">依据训练日志最佳成绩估算（Epley 公式）：${liftTxt}</div>
      <div class="b3sub">对比首次填写极限合计：<b>${b.hasBase?fmtW(b.baseSum)+' kg':'未填写'}</b></div>
    </div></div>`;
}

/* ---------- 格子表（极紧凑：每周期一行） ---------- */
function gridHTML(t){
  return t.weeks.map((w,wi)=>{
    const label=w.n.length>9?w.n.slice(0,9):w.n;
    return `<div class="gblock"><div class="gbt" title="${esc(w.n)}">${esc(label)}</div><div class="gcells">${
      w.d.map((d,di)=>{
        const st=dayState(curPlanId,wi,di);
        const sel=(showDay&&wi===curW&&di===curD)?' sel':'';
        const bar=st.partial?`<u style="width:${Math.round(st.done/st.total*100)}%"></u>`:'';
        return `<div class="gcell${st.complete?' done':''}${st.partial?' part':''}${sel}" onclick="pickDay(${wi},${di})" title="${esc(d.n)} · ${st.done}/${st.total}组"><b>${st.complete?'✓':esc(dayNum(d.n))}</b>${bar}</div>`;
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
  const sec=document.getElementById('daySec'); if(sec) sec.scrollIntoView({behavior:'smooth',block:'start'});
}
function saveMaxAuto(){
  const p=PLANS.find(x=>x.id===curPlanId); if(!p) return;
  const o={}; document.querySelectorAll('.lgmaxI').forEach(i=>{ if(i.value!=='') o[i.dataset.k]=parseFloat(i.value) });
  setMaxes(p.id,o);
  Object.keys(CALC_CACHE).forEach(k=>delete CALC_CACHE[k]);
  const sh=document.querySelector('.lgsec .lgsh');
  if(sh) sh.innerHTML='🏋️ 首次训练极限 <span class="lgok">已保存 · 已换算 ✓</span>';
  const t=getT(p.id);
  const gb=document.getElementById('gridBox'); if(gb) gb.innerHTML=gridHTML(t);
  if(showDay){ const box=document.getElementById('dayBox'); if(box) box.innerHTML=dayHTML(t) }
  const b3=document.getElementById('b3sec');
  if(b3){ b3.outerHTML=bigThreeHTML(p.id) }
  refreshRoll();
  refreshBar();
  toast('已自动保存 · 配重已更新');
}
function refreshBar(){
  const pr=planProgress(curPlanId);
  const el=document.querySelector('#gridSec .lgpg'); if(el) el.textContent=`${pr.D}/${pr.T} 组 · ${pr.pct}%`;
  const bar=document.querySelector('.lgbarsm i'); if(bar) bar.style.width=pr.pct+'%';
}



/* Juggernaut 四个模块训练上限速览（自动推算，不可手改） */
function jmRollHTML(){
  const lifts=[['sq','深蹲'],['bp','卧推'],['dl','硬拉'],['ohp','实力推']];
  return lifts.map(([k,label])=>{
    const cells=[1,2,3,4].map(m=>{
      const tm=jmTM(curPlanId,m,k);
      return `<div class="jr">M${m}<b>${tm!==null?fmtW(tm):'—'}</b></div>`;
    }).join('');
    return `<div style="grid-column:1/-1;font-size:10px;color:var(--sub);margin-top:4px">${label} 各模块 TM（kg）</div><div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:5px">${cells}</div>`;
  }).join('');
}


/* 刷新 Juggernaut 的 TM 速览（填完 AMAP 实次后立即变） */
function refreshRoll(){
  const el=document.getElementById('jmRoll');
  if(el) el.innerHTML=jmRollHTML();
  const t=getT(curPlanId);
  if(t && t.rolling){ const box=document.getElementById('dayBox'); if(box && showDay) box.innerHTML=dayHTML(t) }
}

/* ---------- 辅助动作下拉选择 ---------- */
function recPick(key){
  const all=jget('sddr_acts',{});
  return all[curPlanId+':'+key]||'';
}
function pickAct(key,v){
  const all=jget('sddr_acts',{});
  if(v) all[curPlanId+':'+key]=v; else delete all[curPlanId+':'+key];
  jset('sddr_acts', all);
  toast(v?('已选：'+v):'已清除选择');
}

/* ---------- 当日训练 ---------- */
function flatDays(t){ const out=[]; t.weeks.forEach((w,wi)=>w.d.forEach((d,di)=>out.push([wi,di]))); return out }
function switchDay(off){
  const t=getT(curPlanId); if(!t) return;
  const fl=flatDays(t);
  const idx=fl.findIndex(x=>x[0]===curW&&x[1]===curD);
  const ni=idx+off;
  if(ni<0||ni>=fl.length){ toast(off>0?'已是最后一个训练日':'已是第一个训练日'); return }
  pickDay(fl[ni][0],fl[ni][1]);
}

// 合并同名动作：Russwole 按「首列动作＝主项」优先排第一，其余保持原序；且不显示「N 组」
const MAIN_LIFTS=['深蹲','卧推','硬拉','前蹲','相扑硬拉'];
function buildBlocks(day){
  const isRuss = curPlanId==='russwole';
  const blocks=[];
  day.g.forEach((g,gi)=>{
    const last=blocks[blocks.length-1];
    if(last && last.n===g.n){
      g.s.forEach((s,si)=>last.sets.push({s,gi,si}));
    } else {
      blocks.push({n:g.n, sets:g.s.map((s,si)=>({s,gi,si})), lib:g.lib||null, key:curW+'-'+curD+'-'+gi});
    }
  });
  if(isRuss){
    // 首列动作作为主项：同名块合并为一块并置于最前
    const main=blocks[0]? blocks[0].n : null;
    if(main){
      const merged=blocks.filter(b=>b.n===main).sort((a,b)=>a.sets[0].gi-b.sets[0].gi);
      const rest=blocks.filter(b=>b.n!==main);
      const first={n:main, sets:[].concat(...merged.map(b=>b.sets)), main:true};
      return [first].concat(rest);
    }
  }
  return blocks;
}

function dayHTML(t){
  const w=t.weeks[curW], day=w.d[curD];
  const vars=varsOf(curPlanId);
  const rec=getLogs(curPlanId)[dayKey(curW,curD)]||{sets:{}};
  const st=dayState(curPlanId,curW,curD);
  const fl=flatDays(t), idx=fl.findIndex(x=>x[0]===curW&&x[1]===curD);
  let html=`<div class="dayhd"><div><b>${esc(w.n)}</b><span>${esc(day.n)}</span></div><div class="daypr">${st.done}/${st.total} 组${st.complete?' · 已打勾 ✓':''}</div></div>`;
  html+=`<div class="dnav2"><button onclick="switchDay(-1)" ${idx<=0?'disabled':''}>‹ 上一训练日</button><span>${idx+1} / ${fl.length}</span><button onclick="switchDay(1)" ${idx>=fl.length-1?'disabled':''}>下一训练日 ›</button></div>`;
  html+=`<div class="thead thead4"><span>#</span><span>计划</span><span>次</span><span>重量</span><span>实次</span><span>RPE</span></div>`;

  const blocks=buildBlocks(day);
  const rus=curPlanId==='russwole';
  blocks.forEach(bk=>{
    const multi=bk.sets.length>1;
    /* 组数严格按计划表的 1×N 解读为「1 组做 N 次」，逐行展开；Russwole 不在动作后标组数 */
    const badge=(rus||!multi)?'':`<em>${bk.sets.length} 组</em>`;
    const lib=bk.lib;
    if(lib && lib.length){
      const picked=recPick(bk.key);
      const opts=lib.map(o=>`<option value="${esc(o)}" ${o===picked?'selected':''}>${esc(o)}</option>`).join('');
      html+=`<div class="ghead${bk.main?' main':''} libg"><span>${esc(bk.n)}</span>
        <select class="libSel" onchange="pickAct('${bk.key}',this.value)"><option value="">— 选动作 —</option>${opts}</select></div>`;
    } else {
      html+=`<div class="ghead${bk.main?' main':''}"><span>${esc(bk.n)}</span>${bk.main?'<i class="mtag">主项</i>':''}${badge}</div>`;
    }
    bk.sets.forEach((it,n)=>{
      const gi=it.gi, si=it.si, s=it.s;
      const k=gi+'_'+si, lg=rec.sets[k]||{};
      const pw=planWeightOf(s,vars);
      const reps=repsOf(s);
      const defKg=(pw!==null)?fmtW(pw):'';
      const kgVal=(lg.kg!==undefined&&lg.kg!==null?lg.kg:'');
      /* 实次默认＝计划次数，用户也可改；只改实次不会覆盖计划 */
      const repsVal=(lg.reps!==undefined?lg.reps:'');
      html+=`<div class="trow${isSetDone(lg)?' done':''}">
        <span class="tno">${n+1}</span>
        <span class="tplan">${esc(planText(s,vars))}${(s.tn&&s.t)?`<i class="qnote" title="${esc(s.t)}" onclick="toast('${esc(s.t).replace(/'/g,"\\'")}')">?</i>`:''}</span>
        <span class="treps">${esc(reps||'—')}</span>
        <input type="number" inputmode="decimal" step="2.5" min="0" class="kgI" data-gi="${gi}" data-si="${si}" value="${kgVal!==''?kgVal:defKg}" placeholder="${defKg||'kg'}" onchange="saveSet(${gi},${si},'kg',this.value)">
        <input type="number" inputmode="numeric" step="1" min="0" class="rpI" data-gi="${gi}" data-si="${si}" value="${repsVal!==''?repsVal:(reps.match(/^\d+$/)?reps:'')}" placeholder="${esc(reps||'次')}" onchange="saveSet(${gi},${si},'reps',this.value)">
        <input type="number" inputmode="decimal" step="0.5" min="1" max="10" value="${lg.rpe!==undefined?lg.rpe:''}" placeholder="—" onchange="saveSet(${gi},${si},'rpe',this.value)">
      </div>`;
    });
  });
  html+=`<div class="lgnote" style="margin-top:10px">💡 重量、实次均已按计划预填，可直接改；点「✓ 本日完成」即按预填值保存并打勾。</div>
  <div class="daydone"><button class="btnDone" onclick="completeDay()">✓ 本日完成（保存预填数据）</button></div>
  <div class="lgf" style="margin-top:8px"><label>当日备注</label><input value="${esc(rec.note||'')}" placeholder="状态、疼痛、动作调整…" onchange="saveNote(this.value)"></div>`;
  return html;
}

/* 一键完成：把页面里预填的重量/实次全部落库（模拟真实训练＝按计划完成） */
function completeDay(){
  const rows=[...document.querySelectorAll('#dayBox .trow')];
  const t=getT(curPlanId), vars=varsOf(curPlanId);
  const day=t.weeks[curW].d[curD];
  const logs=getLogs(curPlanId); const k=dayKey(curW,curD);
  logs[k]=logs[k]||{sets:{}}; logs[k].sets=logs[k].sets||{};
  rows.forEach(r=>{
    const kg=r.querySelector('.kgI'), rp=r.querySelector('.rpI');
    if(!kg||!rp) return;
    const gi=+kg.dataset.gi, si=+kg.dataset.si;
    const sk=gi+'_'+si;
    let kv=parseFloat(kg.value);
    let rv=parseFloat(rp.value);
    /* 没预填重量（自选重量动作）→ 仍记为完成，重量记 0，实次按计划或 1 记 */
    if(!isFinite(kv)) kv=0;
    if(!isFinite(rv)){
      const s=(day.g[gi]&&day.g[gi].s[si])||{};
      const rr=parseFloat(repsOf(s)); rv=isFinite(rr)?rr:1;
    }
    if(rv<=0) rv=1;
    logs[k].sets[sk]=logs[k].sets[sk]||{};
    logs[k].sets[sk].kg=r25(kv); logs[k].sets[sk].reps=rv;
  });
  setLogs(curPlanId,logs);
  const gb=document.getElementById('gridBox'); if(gb) gb.innerHTML=gridHTML(getT(curPlanId));
  rerenderDay(); const st=dayState(curPlanId,curW,curD);
  const dh=document.querySelector('.daypr'); if(dh) dh.innerHTML=`${st.done}/${st.total} 组${st.complete?' · 已打勾 ✓':''}`;
  refreshBar();
  refreshRoll();
  toast(st.complete?'本日完成 ✓ 已保存':'还有未预填重量的组，请手动补填');
}

function saveSet(gi,si,f,v){
  if(v!=='' && (!isFinite(+v) || +v<0)) { rerenderDay(); return }
  if(f==='rpe' && v!=='' && (+v<1||+v>10)) { rerenderDay(); return }
  const logs=getLogs(curPlanId); const k=dayKey(curW,curD);
  logs[k]=logs[k]||{sets:{}}; logs[k].sets=logs[k].sets||{};
  const sk=gi+'_'+si;
  logs[k].sets[sk]=logs[k].sets[sk]||{};
  if(v==='') delete logs[k].sets[sk][f]; else logs[k].sets[sk][f]=(f==='kg')?r25(+v):+v;
  if(!Object.keys(logs[k].sets[sk]).length) delete logs[k].sets[sk];
  setLogs(curPlanId,logs);
  const row=document.querySelector(`input[onchange*="saveSet(${gi},${si},'kg'"]`)?.closest('.trow');
  if(row) row.classList.toggle('done', isSetDone(logs[k].sets[sk]));
  if(row){
    const inp=row.querySelectorAll('input');
    if(f==='kg' && v!=='' && inp[0]) inp[0].value=fmtW(r25(+v));
  }
  const gb=document.getElementById('gridBox'); if(gb) gb.innerHTML=gridHTML(getT(curPlanId));
  const st=dayState(curPlanId,curW,curD);
  const dh=document.querySelector('.daypr');
  if(dh) dh.innerHTML=`${st.done}/${st.total} 组${st.complete?' · 已打勾 ✓':''}`;
  refreshBar();
  refreshRoll();
  toast(st.complete?'本日完成 ✓ 已保存':'已自动保存');
}
function rerenderDay(){ const box=document.getElementById('dayBox'); if(box) box.innerHTML=dayHTML(getT(curPlanId)) }
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
