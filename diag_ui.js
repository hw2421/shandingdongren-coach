// ================= 个体诊断模块 =================

let dAns = {};            // 答题记录
let dStep = 0;            // 当前步骤
let dResult = null;       // 诊断结果
let dOnlyUnanswered = true;

function v(k){ const x=dAns[k]; return x===undefined?'':(Array.isArray(x)?x[0]:x); }
function arr(k){ const x=dAns[k]; return Array.isArray(x)?x:(x?[x]:[]); }
function num(k){ const x=parseFloat(dAns[k]); return isNaN(x)?0:x; }

function diagView(){
  if(dResult) return diagResultView();
  const g = DIAG.survey[dStep];
  const total = DIAG.survey.length;
  const pct = Math.round((dStep+1)/total*100);
  const body = g.q.map(q=>diagQHTML(q)).join('');
  return `<div class="back" onclick="go('home')">← 返回首页</div>
  <h2 class="modtitle">${icoBoxInline('diag')} 个体诊断 · 第 ${dStep+1}/${total} 步</h2>
  <div class="dprogress"><div style="width:${pct}%"></div></div>
  <div class="dstepinfo"><b>${g.title}</b><span>${g.desc}</span></div>
  <div class="dq">${body}</div>
  <div class="dnav">
    ${dStep>0?'<button class="dbtn ghost" onclick="dPrev()">上一步</button>':''}
    <button class="dbtn" onclick="dNext()">${dStep<total-1?'下一步':'生成诊断报告'}</button>
  </div>
  <div class="dtip">💡 问卷共 8 步 60 题，约 3-5 分钟。可先只填关键项，其余留空也能出报告；填写越完整，诊断越精准。你的答案只保存在本机浏览器。</div>`;
}

function diagQHTML(q){
  const cur = dAns[q.id];
  let inner='';
  if(q.type==='radio'){
    inner = q.opts.map(o=>`<span class="dopt ${cur===o?'on':''}" onclick="dPick('${q.id}','${escA(o)}',0)">${esc(o)}</span>`).join('');
  }else if(q.type==='multi'){
    const cs = Array.isArray(cur)?cur:[];
    inner = q.opts.map(o=>`<span class="dopt ${cs.includes(o)?'on':''}" onclick="dPick('${q.id}','${escA(o)}',1)">${esc(o)}</span>`).join('');
  }else if(q.type==='number'){
    inner = `<div class="dnum"><input id="in_${q.id}" type="number" inputmode="decimal" value="${cur||''}" placeholder="${q.ph||''}" oninput="dAns['${q.id}']=this.value"><span>${q.unit||''}</span></div>`;
  }else{
    inner = `<textarea class="dtext" id="in_${q.id}" placeholder="${q.ph||''}" oninput="dAns['${q.id}']=this.value">${cur||''}</textarea>`;
  }
  return `<div class="dqitem"><div class="dqt">${esc(q.t)}${q.req?'<em>*</em>':''}</div><div class="dopts ${q.type==='number'?'num':''}">${inner}</div></div>`;
}
function escA(s){return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
function dPick(id,val,multi){
  if(multi){
    let cs = Array.isArray(dAns[id])?dAns[id].slice():[];
    const i = cs.indexOf(val);
    if(i>=0) cs.splice(i,1); else cs.push(val);
    dAns[id]=cs;
  }else{
    dAns[id] = (dAns[id]===val? '' : val);
  }
  document.getElementById('view').innerHTML = diagView();
}
function dPrev(){ if(dStep>0){dStep--; document.getElementById('view').innerHTML=diagView(); window.scrollTo(0,0);} }
function dNext(){
  // 校验当前步必填
  const g = DIAG.survey[dStep];
  const missing = g.q.filter(q=>q.req && !String(dAns[q.id]||'').trim());
  if(missing.length){
    // 允许跳过，但提示
    if(!confirm('还有 ' + missing.length + ' 项关键信息未填（如体重、三大项重量），会明显影响诊断准确度。\n\n仍要继续吗？')) return;
  }
  if(dStep < DIAG.survey.length-1){ dStep++; document.getElementById('view').innerHTML=diagView(); window.scrollTo(0,0); }
  else { runDiag(); }
}

// ---------- 诊断引擎 ----------
function runDiag(){
  const hit = DIAG.rules.filter(r=>{
    try{ return eval(r.c) }catch(e){ return false }
  });
  const order={'P0':0,'P1':1,'P2':2};
  hit.sort((a,b)=>order[a.level]-order[b.level]);
  const bw=num('bw'), sq=num('sq'), bp=num('bp'), dl=num('dl');
  const total=sq+bp+dl;
  const ratio={
    sqdl: dl>0? (sq/dl).toFixed(2):'-',
    bpdl: dl>0? (bp/dl).toFixed(2):'-',
    wilks: bw>0? (total/bw).toFixed(2):'-',
    total: total||'-',
    protein: bw? Math.round(bw*1.6)+'-'+Math.round(bw*2.2):'-',
    kcal: bw? Math.round(bw*33):'-',
  };
  // 计划推荐
  const plans=[]; const seen={};
  hit.forEach(r=>{ if(r.plan && !seen[r.plan]){ seen[r.plan]=1; plans.push(r.plan) } });
  dResult={hit, ratio, plans, ts:new Date().toLocaleString('zh-CN')};
  document.getElementById('view').innerHTML=diagResultView();
  window.scrollTo(0,0);
  try{ localStorage.setItem('sddr_diag', JSON.stringify({a:dAns,r:{hit:hit.map(h=>h.id),ratio,plans,ts:dResult.ts}})) }catch(e){}
}

const LEVELNAME={P0:'立即处理',P1:'优先调整',P2:'优化提升'};
const LEVELDESC={P0:'涉及疼痛、伤病风险或直接阻断恢复的因素，建议先解决',P1:'直接影响进步速度的核心环节，未来 4-8 周重点改',P2:'锦上添花的优化项，可在主项稳定后逐步加入'};
const PLANINFO={
 sq:{n:'深蹲专项强化',d:'主项每周2-3次 + 股四头主导变式（前蹲/腿举/哈克/腰带深蹲），容量从MEV推向MRV'},
 bp:{n:'卧推专项强化',d:'卧推每周2-3次 + 暂停卧推（底端）+ 窄距卧推（锁定），上肢容量6-12组起步'},
 linear:{n:'线性/简化周期',d:'适合基础积累期：每周小幅递进，6-8周一个中周期，末期减载重测。推荐 Calgary 16周、帕金斯74kg'},
 volume:{n:'容量优先重建',d:'从MEV起步逐周加组，把每项容量推到有效区间，强度控制在75-85%'},
 deload:{n:'先减载再重启',d:'立即安排1周减载（容量50-60%、强度80-90%），随后改用3+1或4+1周期结构'},
 block:{n:'分阶段周期（板块）',d:'增肌容量期 → 增力强度期 → 冲刺峰值期，避免常年高强度锁死上限'},
 freq:{n:'提高训练频率',d:'同总量分摊到更多天，主项每周2-3次，其中1次为低强度技术日'},
 rpe:{n:'引入RPE自调节',d:'用RIR反推RPE，顶组记录RPE，按当天状态调整重量而非死守百分比'},
 peak:{n:'赛前冲刺与峰值',d:'强度上行至90%+、容量逐周下降，赛前1-2周减量50-60%。参考 Calgary 末段、古斯塔夫比赛周'},
 time:{n:'最低有效剂量方案',d:'每周3-4练、每次60-75分钟：主项2个+辅助2个，砍掉孤立动作，提高密度'},
};

function diagResultView(){
  const {hit,ratio,plans,ts}=dResult;
  const c0=hit.filter(h=>h.level==='P0').length, c1=hit.filter(h=>h.level==='P1').length, c2=hit.filter(h=>h.level==='P2').length;
  const name=dAns.name||'训练者';
  let html=`<div class="back" onclick="go('home')">← 返回首页</div>
  <h2 class="modtitle">${icoBoxInline('diag')} 诊断报告</h2>
  <div class="dreport" id="dreport">
    <div class="drhead">
      <div class="drtitle">山顶洞人 · 个体诊断报告</div>
      <div class="drsub">生成时间：${ts}　|　依据：本知识库 7 大模块 + 14 份训练计划</div>
    </div>
    <div class="drsec">
      <h4>一、基本信息与力量基线</h4>
      <table class="drtab">
        <tr><th>性别 / 年龄</th><td>${dAns.sex||'-'} / ${dAns.age||'-'} 岁</td><th>身高 / 体重</th><td>${dAns.h||'-'} cm / ${dAns.bw||'-'} kg</td></tr>
        <tr><th>训练年限</th><td>${dAns.exp||'-'}</td><th>当前目标</th><td>${(dAns.goal||[]).join('、')||'-'}</td></tr>
        <tr><th>深蹲 1RM</th><td>${dAns.sq? dAns.sq+' kg':'未填'}</td><th>卧推 1RM</th><td>${dAns.bp? dAns.bp+' kg':'未填'}</td></tr>
        <tr><th>硬拉 1RM</th><td>${dAns.dl? dAns.dl+' kg':'未填'}</td><th>总成绩</th><td>${ratio.total} kg</td></tr>
        <tr><th>蹲/拉比</th><td>${ratio.sqdl} <em>（参考 0.72-0.85）</em></td><th>推/拉比</th><td>${ratio.bpdl} <em>（参考 0.60-0.75）</em></td></tr>
        <tr><th>总成绩/体重</th><td>${ratio.wilks} <em>（基础期常 <4.2）</em></td><th>数据时效</th><td>${dAns.rep||'-'}</td></tr>
      </table>
    </div>`;
  // 概览
  html+=`<div class="drsec"><h4>二、诊断概览</h4>
    <div class="drstats">
      <div class="p0"><b>${c0}</b><span>立即处理</span></div>
      <div class="p1"><b>${c1}</b><span>优先调整</span></div>
      <div class="p2"><b>${c2}</b><span>优化提升</span></div>
    </div>
    <p class="drlead">共识别出 <b>${hit.length}</b> 项需要关注的问题。${c0>0?'其中 <b>'+c0+'</b> 项涉及疼痛、伤病风险或直接阻断恢复，建议在开始任何加量计划前优先处理。':''}建议每次只改 1-2 个变量，观察 2-4 周再评估 —— 这本身也是知识库反复强调的原则。</p>
  </div>`;
  // 分级清单
  html+=`<div class="drsec"><h4>三、问题清单与调整建议</h4>`;
  ['P0','P1','P2'].forEach(lv=>{
    const items=hit.filter(h=>h.level===lv);
    if(!items.length) return;
    html+=`<div class="drgroup lv-${lv}"><div class="drgh"><span class="drtag">${LEVELNAME[lv]}</span><span class="drgd">${LEVELDESC[lv]}</span></div>`;
    items.forEach((h,i)=>{
      html+=`<div class="dritem">
        <div class="drit">${i+1}. ${esc(h.title)}<span class="drcat">${h.cat}</span></div>
        ${h.why? `<div class="drwhy"><b>为什么：</b>${esc(h.why)}</div>`:''}
        ${h.fix? `<div class="drfix"><b>怎么调：</b>${esc(h.fix)}</div>`:''}
        ${h.ref&&h.ref.length? `<div class="drref">📖 ${h.ref.map(r=>`<a onclick="goRef('${escA(r[0])}','${escA(r[1])}')">《${r[0]}》› ${r[1]}${r[2]?' › '+r[2]:''}</a>`).join('　')}</div>`:''}
      </div>`;
    });
    html+=`</div>`;
  });
  if(!hit.length){
    html+=`<p class="drlead">🎉 没有识别到明显问题。可能填写信息较少，建议补全关键项后重新生成；或直接进入对应模块深入学习。</p>`;
  }
  html+=`</div>`;
  // 营养参考
  if(num('bw')){
    html+=`<div class="drsec"><h4>四、按你体重换算的营养参考</h4>
      <table class="drtab">
        <tr><th>体重</th><td>${num('bw')} kg</td><th>维持热量估算</th><td>约 ${ratio.kcal} 千卡/天（体重×33）</td></tr>
        <tr><th>蛋白质</th><td>${ratio.protein} 克/天</td><th>增肌盈余</th><td>维持 +250~375 千卡</td></tr>
        <tr><th>减脂赤字</th><td>维持 −500 千卡</td><th>周体重变化</th><td>减脂 0.25-1%/周；增重 0.1-0.25%/周</td></tr>
      </table>
      <p class="drnote">以上为估算起点，需用 1-2 周体重趋势校准（取周平均，不看单日）。</p>
    </div>`;
  }
  // 训练方向与计划推荐
  html+=`<div class="drsec"><h4>五、训练方向与计划推荐</h4>`;
  if(plans.length){
    html+=plans.map(p=>PLANINFO[p]?`<div class="drplan"><b>${PLANINFO[p].n}</b><span>${PLANINFO[p].d}</span></div>`:'').join('');
  }else{
    html+=`<p class="drlead">暂未触发特定计划推荐。可从「训练计划设置原理」模块的 14 份计划中，按周期长度、每周频次与强度控制方式挑选。</p>`;
  }
  html+=`</div>`;
  // 行动清单
  const acts=hit.filter(h=>h.level!=='P2').slice(0,5).map((h,i)=>`<li>${esc(h.title)}</li>`).join('');
  html+=`<div class="drsec"><h4>六、未来 4-8 周行动顺序</h4>
    <ol class="dract">${acts||'<li>补全问卷关键信息，重新生成更有针对性的报告</li>'}</ol>
    <p class="drnote">顺序原则：先解决 P0（疼痛/风险/恢复）→ 再补 P1（容量、频率、技术）→ 最后做 P2 优化。每次只改 1-2 项。</p>
  </div>`;
  html+=`<div class="drfoot">本报告由「山顶洞人力训教练」根据你上传资料整理的知识库自动生成，仅供训练参考，不能替代专业医疗诊断。<br>若涉及疼痛、神经症状或结构性问题，请及时就医。</div>`;
  html+=`</div>`;

  html+=`<div class="dract2">
    <button class="dbtn" onclick="dPrint()">📄 导出 PDF（打印/另存为PDF）</button>
    <button class="dbtn ghost" onclick="dRestart()">重新填写</button>
  </div>
  <div class="dtip">导出方法：点击上方按钮后会打开打印窗口，在打印目标里选择「另存为 PDF」即可。iPhone 可在 Safari 分享菜单里选「打印」→ 双指放大选择「存储到文件」。</div>`;
  return html;
}

function goRef(mod, sec, sub){
  go(mod);
  setTimeout(()=>{
    const secs=[...document.querySelectorAll('.sec')];
    const t=secs.find(s=>s.querySelector('.hd span')&&s.querySelector('.hd span').textContent.includes(sec));
    if(t){ t.classList.add('open'); t.scrollIntoView({behavior:'smooth',block:'start'}) }
  },60);
}
function dRestart(){
  if(!confirm('将清空当前答案并重新填写，确定吗？')) return;
  dAns={}; dStep=0; dResult=null;
  document.getElementById('view').innerHTML=diagView(); window.scrollTo(0,0);
}
function dPrint(){
  const rep=document.getElementById('dreport').innerHTML;
  const w=window.open('','_blank');
  if(!w){ alert('浏览器拦截了弹窗，请允许弹窗后重试，或直接用浏览器打印。'); return }
  const LT='<\u0073cript>', SC='<\\/\u0073cript>';
  const doc='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'+
  '<title>山顶洞人力训教练 · 个体诊断报告</title><style>'+
  '@page{size:A4;margin:14mm 12mm}'+
  '*{box-sizing:border-box}'+
  'body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1a1a1a;line-height:1.65;font-size:12px;margin:0}'+
  '.drhead{border-bottom:3px solid #ff8a3d;padding-bottom:10px;margin-bottom:14px}'+
  '.drtitle{font-size:21px;font-weight:800;letter-spacing:1px}'+
  '.drsub{font-size:10.5px;color:#666;margin-top:5px}'+
  '.drsec{margin:16px 0}'+
  '.drsec h4{font-size:13.5px;margin:0 0 8px;padding-left:8px;border-left:3px solid #ff8a3d;color:#111}'+
  '.drtab{width:100%;border-collapse:collapse;font-size:11px;margin:6px 0}'+
  '.drtab th,.drtab td{border:1px solid #d5d5d5;padding:5px 7px;text-align:left;vertical-align:top}'+
  '.drtab th{background:#f5f5f5;font-weight:600;width:15%;white-space:nowrap}'+
  '.drtab em{color:#888;font-style:normal;font-size:10px}'+
  '.drstats{display:flex;gap:8px;margin:8px 0}'+
  '.drstats div{flex:1;border:1px solid #ddd;border-radius:6px;padding:8px;text-align:center}'+
  '.drstats b{display:block;font-size:19px}'+
  '.drstats .p0 b{color:#d33} .drstats .p1 b{color:#d98300} .drstats .p2 b{color:#2f7ec4}'+
  '.drstats span{font-size:10px;color:#666}'+
  '.drlead{font-size:11.5px;margin:8px 0;color:#333}'+
  '.drgroup{margin:10px 0}'+
  '.drgh{display:flex;align-items:center;gap:8px;margin:10px 0 6px;padding:5px 8px;border-radius:5px;background:#f7f7f7}'+
  '.drtag{font-weight:700;font-size:11.5px;padding:1px 8px;border-radius:4px;color:#fff;white-space:nowrap}'+
  '.lv-P0 .drtag{background:#d33} .lv-P1 .drtag{background:#e08c00} .lv-P2 .drtag{background:#2f7ec4}'+
  '.drgd{font-size:10px;color:#666}'+
  '.dritem{border-left:2px solid #eee;padding:6px 0 6px 10px;margin-bottom:7px}'+
  '.lv-P0 .dritem{border-left-color:#f0b4b4} .lv-P1 .dritem{border-left-color:#f5d9a8} .lv-P2 .dritem{border-left-color:#b8d4ee}'+
  '.drit{font-weight:700;font-size:12px;margin-bottom:3px}'+
  '.drcat{font-size:9.5px;color:#888;font-weight:400;border:1px solid #ddd;border-radius:3px;padding:0 4px;margin-left:6px}'+
  '.drwhy,.drfix{font-size:11px;color:#333;margin:3px 0}'+
  '.drwhy b,.drfix b{color:#111}'+
  '.drref{font-size:10px;color:#777;margin-top:3px}'+
  '.drref a{color:#b26a00;text-decoration:none}'+
  '.drplan{border:1px solid #f0d5b8;background:#fffaf4;border-radius:6px;padding:7px 10px;margin:6px 0;font-size:11.5px}'+
  '.drplan b{display:block;color:#b26a00;margin-bottom:2px}'+
  '.drplan span{color:#333}'+
  '.dract{margin:6px 0 6px 18px;font-size:11.5px}'+
  '.dract li{margin:3px 0}'+
  '.drnote{font-size:10px;color:#777;margin-top:5px}'+
  '.drfoot{margin-top:18px;padding-top:8px;border-top:1px solid #ddd;font-size:9.5px;color:#888;line-height:1.6}'+
  '</'+'style></head><body>'+rep+
  LT+'>window.onload=function(){setTimeout(function(){window.print()},350)}'+SC+'>'+
  '</body></html>';
  w.document.open(); w.document.write(doc); w.document.close();
}
