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
/* 估算 1RM（Epley）：重量 ×（1 + 次数 × 0.0333）；只做 1 次时即为该重量本身 */
function epley1RM(kg, reps){
  const w=parseFloat(kg), n=parseFloat(reps);
  if(!isFinite(w)||w<=0) return null;
  const r=(isFinite(n)&&n>0)?n:1;
  return w*(1+r*0.0333);
}
function jmTM(pid, mod, lift){
  const t=getT(pid); if(!t) return null;
  const rm=maxOf(pid, lift); if(rm===null) return null;
  /* 模块1训练上限 = 估算 1RM × 90%；估算 1RM 由「当前重量 + 极限次数」按 Epley 换算 */
  const rk=(t.rolling&&t.rolling.repsKeys&&t.rolling.repsKeys[lift])||null;
  const rn=rk?maxOf(pid, rk):null;
  const e1=epley1RM(rm, rn);
  const base = r25((e1===null?rm:e1)*0.9);
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
  const hasRec=Object.keys(getLogs(p.id)).length>0;
  return `<div class="back" onclick="go('log')">← 训练日志</div>
  <h2 class="modtitle">${icoBoxInline('log')} ${esc(p.name)}</h2>
  <div class="ptags"><span class="ptag">${p.tag}</span><span class="ptag">${p.weeks}</span><span class="ptag">${p.freq}</span></div>
  <div class="preset"><button class="btnRestart" onclick="askRestart()">🔄 重新开始计划</button><span>${hasRec?`已记录 ${Object.keys(getLogs(p.id)).length} 个训练日`:'尚未开始填报'}</span></div>

  ${inputs.length? `<div class="lgsec">
    <div class="lgsh">${t.rolling?'🏋️ 初始成绩（重量 + 极限次数）':'🏋️ 首次训练极限'} ${allFilled?'<span class="lgok">已保存 · 已换算 ✓</span>':'<span class="lgneed">填写一次即可，后续自动换算</span>'}</div>
    <div class="lgmaxgrid${inputs.length>4?' four':(inputs.length>2?' three':'')}">${inputs.map(i=>{
      const isRep=/r$/.test(i.k) && t.rolling && t.rolling.repsKeys && Object.values(t.rolling.repsKeys).indexOf(i.k)>=0;
      return `<div class="lgf${isRep?' repf':''}"><label>${esc(i.label)}</label><input type="number" step="${isRep?'1':'2.5'}" min="${isRep?'1':'0'}" max="${isRep?'30':''}" class="lgmaxI" data-k="${esc(i.k)}" data-rep="${isRep?'1':''}" value="${mx[i.k]!==undefined?mx[i.k]:(i.def!==undefined?i.def:'')}" placeholder="${isRep?'次':'kg'}" onchange="saveMaxAuto()"></div>`;
    }).join('')}
    </div>
    <div class="lgnote" style="margin-top:8px">📐 ${t.rolling? '填入「当前重量 + 该重量能做到的极限次数」，系统据此估算你的 1RM 并确定模块1的训练上限；后续模块按上一模块第3周第一个主项动作最后一组的「实次」自动推算（未填写则不显示该模块训练上限）。此处只填一次。' : '首次填一次极限即可，之后按计划表逻辑自动换算，全部取 2.5kg 整数倍。'}</div>
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
  /* 从已完成日志中取各动作最佳 e1RM（Epley：kg×(1+次数/30)）
     只统计「主项及其直接变式」，辅助/孤立动作不计入三大项预测 */
  const GRP={
    sq:/赛蹲|比赛深蹲|competition\s*squat|^深蹲$|^高杠深蹲$|^pause[sd]?\s+squat|暂停深蹲|^sq$/i,
    bp:/赛推(?!·轻)|比赛卧推|competition\s*(pause\s*)?bench|^卧推$|^pause[sd]?\s*bench|暂停卧推|^bp$/i,
    dl:/传统(?!·轻)|比赛硬拉|competition\s*deadlift|^硬拉$|^deadlift$|^dl$/i
  };
  const best={sq:0,bp:0,dl:0};
  const logs=getLogs(pid);
  const vars=varsOf(pid);
  t.weeks.forEach((w,wi)=>w.d.forEach((day,di)=>{
    const rec=logs[dayKey(wi,di)]; if(!rec||!rec.sets) return;
    day.g.forEach((g,gi)=>g.s.forEach((s,si)=>{
      const it=rec.sets[gi+'_'+si]; if(!it) return;
      /* 重量：优先取日志，其次取计划预填值（预填未改动时不写日志） */
      let kg=+it.kg;
      if(!isFinite(kg)||kg<=0){
        const pw=planWeightOf(s,vars);
        kg=(pw!==null&&isFinite(pw))?+pw:NaN;
      }
      const reps=+it.reps;
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
  /* 当前预测 = max(首填极限, 日志推算)；只升不降，练轻组不会把数字拉低 */
  const cur={}, improved={};
  ['sq','bp','dl'].forEach(k=>{
    const bs=(base[k]!==null&&base[k]!==undefined)? +base[k] : 0;
    const lg=best[k]||0;
    cur[k]=Math.max(bs,lg);
    improved[k]= lg>bs;          /* 该动作是否被训练成绩刷新过 */
  });
  const predSum=r25((cur.sq||0)+(cur.bp||0)+(cur.dl||0));
  return {base, baseSum, hasBase, predSum, hasLog, best, cur, improved};
}
function bigThreeHTML(pid){
  const b=bigThree(pid); if(!b) return '';
  const NAMES={sq:'深蹲', bp:'卧推', dl:'硬拉'};
  const anyUpd=b.improved.sq||b.improved.bp||b.improved.dl;
  const diffTot=(anyUpd&&b.hasBase)? Math.round(b.predSum-b.baseSum) : null;
  const cls=v=> v>=0?' up':' down';
  const sgn=v=> (v>0?'+':'')+v;

  /* 逐项一行：动作 | 首次填写 | 当前预测 | 变化 */
  const rows=['sq','bp','dl'].map(k=>{
    const base=b.base[k];
    const hasBaseV=(base!==null&&base!==undefined);
    const pred=b.cur[k]||null;
    const upd=b.improved[k];
    const d=(upd&&hasBaseV)? Math.round(pred-base) : null;
    return `<div class="b3r">
      <span class="b3n">${NAMES[k]}</span>
      <span class="b3v">${hasBaseV?fmtW(base)+' kg':'—'}</span>
      <span class="b3v${upd?'':' dim'}">${pred!==null?fmtW(pred)+' kg':'—'}${upd?'':' <i class="b3t">按首填</i>'}</span>
      <span class="b3d${d===null?'':cls(d)}">${d===null?'—':sgn(d)+' kg'}</span>
    </div>`;
  }).join('');

  /* 合计行 */
  const baseSumTxt = b.hasBase? fmtW(b.baseSum)+' kg' : '—';
  const predSumTxt = b.hasBase? fmtW(b.predSum)+' kg' : '—';
  const totRow=`<div class="b3r tot">
      <span class="b3n">合计</span>
      <span class="b3v">${baseSumTxt}</span>
      <span class="b3v">${predSumTxt}</span>
      <span class="b3d${diffTot===null?'':cls(diffTot)}">${diffTot===null?'—':sgn(diffTot)+' kg'}</span>
    </div>`;

  const tip = b.hasLog
    ? '当前预测取「首次填写极限」与「训练日志推算值」中的较大者，只升不降'
    : '暂无训练记录，暂以首次填写极限计；练完并填写实次后自动更新';

  return `<div class="lgsec" id="b3sec"><div class="lgsh">🏆 三大项 · 极限与预测对比</div>
    <div class="b3box">
      <div class="b3head"><span>动作</span><span>首次填写</span><span>当前预测</span><span>变化</span></div>
      ${rows}${totRow}
      <div class="b3sub" style="margin-top:8px">${tip}</div>
    </div></div>`;
}

/* ---------- 重新开始计划 / 清空今日 ---------- */
function confirmBox(opt){
  /* opt: {title, desc, ok, danger, onOk} */
  const old=document.getElementById('cfmWrap'); if(old) old.remove();
  const el=document.createElement('div');
  el.id='cfmWrap'; el.className='cfmWrap';
  el.innerHTML=`<div class="cfmMask" onclick="closeConfirm()"></div>
    <div class="cfmBox">
      <div class="cfmT">${opt.title}</div>
      <div class="cfmD">${opt.desc}</div>
      <div class="cfmBtns">
        <button class="cfmCancel" onclick="closeConfirm()">取消</button>
        <button class="cfmOk${opt.danger?' danger':''}" id="cfmOkBtn">${opt.ok||'确认'}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('on'));
  document.getElementById('cfmOkBtn').onclick=()=>{ closeConfirm(); opt.onOk&&opt.onOk() };
  return el;
}
function closeConfirm(){
  const el=document.getElementById('cfmWrap'); if(!el) return;
  el.classList.remove('on'); setTimeout(()=>el.remove(),160);
}
function askRestart(){
  const p=PLANS.find(x=>x.id===curPlanId); if(!p) return;
  const logs=getLogs(p.id), days=Object.keys(logs).length;
  const t=getT(p.id);
  let sets=0; Object.values(logs).forEach(r=>{ sets+=Object.keys((r&&r.sets)||{}).length });
  const maxes=getMaxes(p.id);
  const hasMax=Object.keys(maxes).length>0;
  confirmBox({
    title:'重新开始该计划？',
    desc:`<p><b>${esc(p.name)}</b></p>
      <ul>
        <li>将清空 <b>${days}</b> 个训练日、<b>${sets}</b> 组的重量 / 实次 / RPE 填报</li>
        <li>${hasMax?'同时清空已填的<b>首次训练极限</b>，需重新填写':'尚未填写训练极限'}</li>
        <li>辅助动作的下拉选择也会一并清除</li>
      </ul>
      <p class="cfmWarn">此操作不可撤销，确定要重新开始吗？</p>`,
    ok:'确认重新开始', danger:true,
    onOk:()=>doRestart()
  });
}
function doRestart(){
  const pid=curPlanId; if(!pid) return;
  /* 1. 清空本计划日志 */
  const all=jget('sddr_logs',{});
  if(all[pid]!==undefined){ delete all[pid]; jset('sddr_logs', all) }
  /* 2. 清空极限 */
  try{ LS('sddr_max_'+pid, '') }catch(e){}
  try{ localStorage.removeItem('sddr_max_'+pid) }catch(e){}
  /* 3. 清空本计划的辅助动作选择 */
  const acts=jget('sddr_acts',{});
  Object.keys(acts).forEach(k=>{ if(k.indexOf(pid+':')===0) delete acts[k] });
  jset('sddr_acts', acts);
  /* 4. 重置缓存与界面状态 */
  Object.keys(CALC_CACHE||{}).forEach(k=>delete CALC_CACHE[k]);
  curW=0; curD=0; showDay=false;
  render(); toast('已重新开始 · 填报记录已清空');
}

function askClearDay(){
  const t=getT(curPlanId); if(!t) return;
  const w=t.weeks[curW], day=w&&w.d[curD]; if(!day) return;
  const rec=getLogs(curPlanId)[dayKey(curW,curD)]||{sets:{}};
  const n=Object.keys(rec.sets||{}).length;
  if(!n){
    toast('今日还没有填报记录'); return;
  }
  confirmBox({
    title:'清空今日填报？',
    desc:`<p><b>${esc(w.n)} · ${esc(day.n)}</b></p>
      <ul><li>将清空今日 <b>${n}</b> 组的重量 / 实次 / RPE 与当日备注</li>
      <li>不影响该计划其它训练日</li></ul>
      <p class="cfmWarn">此操作不可撤销。</p>`,
    ok:'确认清空', danger:true,
    onOk:()=>doClearDay()
  });
}
function doClearDay(){
  const logs=getLogs(curPlanId), k=dayKey(curW,curD);
  if(logs[k]!==undefined){ delete logs[k]; setLogs(curPlanId, logs) }
  Object.keys(CALC_CACHE||{}).forEach(x=>delete CALC_CACHE[x]);
  const gb=document.getElementById('gridBox');
  if(gb) gb.innerHTML=gridHTML(getT(curPlanId));
  rerenderDay();
  const st=dayState(curPlanId,curW,curD);
  const dh=document.querySelector('.daypr');
  if(dh) dh.innerHTML=`${st.done}/${st.total} 组`;
  const b3=document.getElementById('b3sec'); if(b3) b3.outerHTML=bigThreeHTML(curPlanId);
  refreshBar(); refreshRoll();
  toast('今日填报已清空');
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
  const t=getT(p.id);
  const sh=document.querySelector('.lgsec .lgsh');
  if(sh) sh.innerHTML=(t&&t.rolling?'🏋️ 初始成绩（重量 + 极限次数）':'🏋️ 首次训练极限')+' <span class="lgok">已保存 · 已换算 ✓</span>';
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
      return `<div class="jr">模块${m}<b>${tm!==null?fmtW(tm):'—'}</b></div>`;
    }).join('');
    return `<div style="grid-column:1/-1;font-size:10px;color:var(--sub);margin-top:6px">${label} · 各模块训练上限（kg）</div><div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:5px">${cells}</div>`;
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
      /* 实次不预填：留空由训练者手动填写，避免「未训练却记成完成」 */
      const repsVal=(lg.reps!==undefined&&lg.reps!==null?lg.reps:'');
      html+=`<div class="trow${isSetDone(lg)?' done':''}">
        <span class="tno">${n+1}</span>
        <span class="tplan">${esc(planText(s,vars))}${(s.tn&&s.t)?`<i class="qnote" title="${esc(s.t)}" onclick="toast('${esc(s.t).replace(/'/g,"\\'")}')">?</i>`:''}</span>
        <span class="treps">${esc(reps||'—')}</span>
        <input type="number" inputmode="decimal" step="2.5" min="0" class="kgI" data-gi="${gi}" data-si="${si}" value="${kgVal!==''?kgVal:defKg}" placeholder="${defKg||'kg'}" onchange="saveSet(${gi},${si},'kg',this.value)">
        <input type="number" inputmode="numeric" step="1" min="0" class="rpI" data-gi="${gi}" data-si="${si}" value="${repsVal}" placeholder="${esc(reps||'次')}" onchange="saveSet(${gi},${si},'reps',this.value)">
        <input type="number" inputmode="decimal" step="0.5" min="1" max="10" value="${lg.rpe!==undefined?lg.rpe:''}" placeholder="—" onchange="saveSet(${gi},${si},'rpe',this.value)">
      </div>`;
    });
  });
  html+=`<div class="lgnote" style="margin-top:10px">💡 重量已按计划预填（可直接改）；<b>实次请训练后手动填写</b>，填了才算完成。点「✓ 本日完成」保存当前数据。</div>
  <div class="daydone"><button class="btnDone" onclick="completeDay()">✓ 本日完成（保存当前数据）</button></div>
  <div class="daydone"><button class="btnClear" onclick="askClearDay()">🗑 清空今日填报</button></div>
  <div class="lgf" style="margin-top:8px"><label>当日备注</label><input value="${esc(rec.note||'')}" placeholder="状态、疼痛、动作调整…" onchange="saveNote(this.value)"></div>`;
  return html;
}

/* 一键完成：保存当前已填的重量/实次；未填实次的组不写入（留给训练者手动填） */
function completeDay(){
  const rows=[...document.querySelectorAll('#dayBox .trow')];
  const t=getT(curPlanId), vars=varsOf(curPlanId);
  const day=t.weeks[curW].d[curD];
  const logs=getLogs(curPlanId); const k=dayKey(curW,curD);
  logs[k]=logs[k]||{sets:{}}; logs[k].sets=logs[k].sets||{};
  let missing=0;
  rows.forEach(r=>{
    const kg=r.querySelector('.kgI'), rp=r.querySelector('.rpI');
    if(!kg||!rp) return;
    const gi=+kg.dataset.gi, si=+kg.dataset.si;
    const sk=gi+'_'+si;
    const kv=parseFloat(kg.value);
    const rv=parseFloat(rp.value);
    if(!isFinite(rv)||rv<=0){ missing++; return; }   /* 实次未填 → 跳过，不算完成 */
    logs[k].sets[sk]=logs[k].sets[sk]||{};
    logs[k].sets[sk].kg = isFinite(kv)? r25(kv) : 0;
    logs[k].sets[sk].reps = rv;
  });
  setLogs(curPlanId,logs);
  const gb=document.getElementById('gridBox'); if(gb) gb.innerHTML=gridHTML(getT(curPlanId));
  rerenderDay(); const st=dayState(curPlanId,curW,curD);
  const dh=document.querySelector('.daypr'); if(dh) dh.innerHTML=`${st.done}/${st.total} 组${st.complete?' · 已打勾 ✓':''}`;
  refreshB3();
  refreshBar();
  refreshRoll();
  if(missing>0) toast(`已保存 · 还有 ${missing} 组未填实次，填完才算完成`);
  else toast(st.complete?'本日完成 ✓ 已保存':'已保存');
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
  refreshB3();
  refreshBar();
  refreshRoll();
  if(f==='reps') return;   /* 填实次时不弹提示，避免每次击键都弹 */
  toast(st.complete?'本日完成 ✓ 已保存':'已自动保存');
}
/* 刷新三大项对比（不重建整个页面） */
function refreshB3(){
  const el=document.getElementById('b3sec'); if(!el) return;
  el.outerHTML=bigThreeHTML(curPlanId);
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
