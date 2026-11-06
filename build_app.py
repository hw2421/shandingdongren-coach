#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3 构建：全资料配图 + 深色主题 + 极简图标 + Q&A"""
import json, markdown, re, base64, pathlib, subprocess, hashlib, os

BASE = pathlib.Path("/root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d65-3cdb49c2f000")
ASSETS = BASE/"assets"; ASSETS.mkdir(exist_ok=True)
OUT = pathlib.Path("/workspace/山顶洞人力训教练.html")

PDFS = {
 "力量训练原理": "/root/uploads/1793845139390283797-力量训练原理：用七大核心原理科学提升力量.pdf",
 "肌肉肥大科学训练原则": "/root/uploads/1793845139837952627-（已压缩）肌肉肥大科学训练原则.pdf",
 "RTS": "/root/uploads/1793845136018506256-THE REACTIVE TRAINING SYSTEM_ZH.pdf",
 "如何深蹲": "/root/uploads/1793845141128194498-如何深蹲｜终极指南.pdf",
 "如何卧推": "/root/uploads/1793845141282360521-如何卧推｜终极指南.pdf",
 "如何硬拉": "/root/uploads/1793845141434198685-如何硬拉｜终极指南.pdf",
 "力量训练基础": "/root/uploads/1793845138266801933-力量训练基础  用5种杠铃动作极速发展身体实.pdf",
 "力量举指南-赵伟": "/root/uploads/1793845136994634649-力量举指南-赵伟-pdf.pdf",
 "Juggernaut手册": "/root/uploads/1793845135215961284-Juggernaut Powerlifting Clinic Manual_ZH.pdf",
 "肌骨疼痛康复笔记": "/root/uploads/1793845136378275132-肌骨疼痛康复临床工作笔记2026第三版（开头.pdf",
 "力量举计划设计手册": "/root/uploads/1793845140890244751-the-powerlifting-program-design-manual_ZH.pdf",
 "终极饮食设置指南": "/root/uploads/1793845141563052919-终极饮食设置指南.pdf",
}
# 统一按出处页面整页截图，不再使用预裁图

MODULES = [
    ("principles",     "训练原理",          "超负荷、专项性、疲劳管理、RPE自主调节、肌肥大机制等底层规律", "module_principles.md"),
    ("bigthree",       "三大项动作框架",    "深蹲/卧推/硬拉技术框架 · 图示详解 · 分歧观点对照表（标注页码出处）", "module_bigthree_v2.md"),
    ("troubleshooting","动作问题排查",      "症状→原因→调整：三大项常见错误与矫正方案速查", "module_troubleshooting.md"),
    ("plans",          "训练计划设置原理",  "计划设计原理 + 14份上传计划逐一分析与横向对比（RTS系列/Juggernaut/腰王/Calgary/GZCL/SSTT/Russwole/帕金斯/古斯塔夫/CATS/斯莫洛夫）", "module_programming.md|module_plans.md|module_plans_b.md"),
    ("plateau",        "平台期突破",        "停滞原因四类诊断清单与训练/恢复端突破策略", "module_plateau.md"),
    ("nutrition",      "营养",              "热量与宏量营养素设定、体重解读与调整规则、补剂", "module_nutrition.md"),
    ("rehab",          "伤病排查及康复",    "疼痛认知、各部位问题自查、重返训练原则与预防", "module_rehab.md"),
]

DIAG = json.loads((BASE/"diag_data.json").read_text(encoding="utf-8"))
DIAG_UI = (BASE/"diag_ui.js").read_text(encoding="utf-8")
PLANDATA = json.loads((BASE/"plan_data.json").read_text(encoding="utf-8"))
LOG_UI = (BASE/"log_ui.js").read_text(encoding="utf-8")

# ---------- 1. 配图已全部移除（仅保留文字与页码出处） ----------
md_src = {fname: (BASE/fname).read_text(encoding="utf-8") for _,_,_,fns in MODULES for fname in fns.split("|")}

# ---------- 2. 渲染模块 ----------
md = markdown.Markdown(extensions=["tables","sane_lists"])
FIG_RE = re.compile(r"【配图:([^|]+)\|PDF第(\d+)页\|([^】]+)】")

def render(text):
    text = FIG_RE.sub("", text)
    text = re.sub(r"^3\. 所有【配图】.*$", "", text, flags=re.M)
    md.reset()
    return md.convert(text)

def parse_module(files):
    sections=[]
    for fname in files.split("|"):
        raw=(BASE/fname).read_text(encoding="utf-8")
        parts=re.split(r"\n(?=## )",raw)
        for part in parts:
            part=part.strip()
            if not part: continue
            m=re.match(r"##\s+(.*)",part)
            title=m.group(1).strip().strip("#").strip() if m else "概述"
            body=part[m.end():].strip() if m else part
            sections.append({"t":title,"h":render(body)})
    return sections

data=[{"id":mid,"title":t,"desc":d,"sections":parse_module(f)} for mid,t,d,f in MODULES]
content_js=json.dumps(data,ensure_ascii=False)

HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>山顶洞人力训教练</title>
<style>
:root{--bg:#0d100f;--card:#171c19;--card2:#1d2620;--line:#303a33;--txt:#f1f5ee;--sub:#9ba69f;--acc:#d5fa75;--acc2:#e8ffb0;--blue:#5ed88f;--green:#5ed88f;--red:#ff6b5e}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--txt);font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.75;font-size:16px}
#app{max-width:760px;margin:0 auto;padding-bottom:96px}
header{padding:26px 20px 14px;background:var(--bg)}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:44px;height:44px;flex:none}
.brand h1{font-size:23px;font-weight:800;letter-spacing:1px}
.brand h1 span{color:var(--acc)}
.tagline{color:var(--sub);font-size:13px;margin-top:6px}
.searchbar{margin:16px 0 4px;position:relative}
.searchbar input{width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 14px 11px 40px;color:var(--txt);font-size:15px;outline:none}
.searchbar input:focus{border-color:var(--acc)}
.searchbar::before{content:"";position:absolute;left:14px;top:50%;transform:translateY(-50%);width:13px;height:13px;border:2px solid var(--sub);border-radius:50%}
.searchbar::after{content:"";position:absolute;left:25px;top:calc(50% + 5px);width:7px;height:2px;background:var(--sub);transform:rotate(45deg)}
main{padding:8px 16px}
h2.modtitle{font-size:19px;margin:14px 0 4px;display:flex;align-items:center;gap:9px}
h2.modtitle svg{width:22px;height:22px;stroke:var(--acc);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.back{display:inline-flex;align-items:center;gap:4px;color:var(--sub);font-size:14px;margin-top:10px;cursor:pointer}
.cards{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:12px;margin-top:16px}
.cards>*{display:flex;flex-direction:column;min-width:0}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 14px 14px;cursor:pointer;transition:transform .12s,border-color .12s;height:100%;box-sizing:border-box;display:flex;flex-direction:column}
.card:hover{border-color:#3d4a3d}
.card:active{transform:scale(.97)}
.card .top{display:flex;align-items:center;justify-content:space-between}
.card .icobox{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(213,250,117,.08);border:1px solid rgba(213,250,117,.25);border-radius:12px}.card .ico{width:26px;height:26px;stroke:var(--acc);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.card .idx{font-size:22px;font-weight:800;color:#2c352e;font-variant-numeric:tabular-nums}
.card .t{font-weight:700;margin-top:10px;font-size:15.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .d{color:var(--sub);font-size:12px;margin-top:5px;line-height:1.55;flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card .n{color:var(--acc2);font-size:11.5px;margin-top:auto;padding-top:9px;border-top:1px dashed var(--line)}
.card.qa{background:linear-gradient(150deg,#1d2416 0%,var(--card) 60%);border-color:#3d4a2c}
.card.qa .n{color:var(--acc)}
.hstats{display:flex;gap:8px;margin-top:14px}
.hstats div{flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;text-align:center;padding:10px 4px}
.hstats b{display:block;font-size:17px;color:var(--acc2)}
.hstats span{font-size:11px;color:var(--sub)}
.sec{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-top:12px;overflow:hidden}
.sec>.hd{padding:14px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:600}
.sec>.hd .arr{color:var(--sub);transition:transform .2s}
.sec.open>.hd .arr{transform:rotate(90deg)}
.sec>.bd{display:none;padding:0 16px 16px;border-top:1px solid var(--line)}
.sec.open>.bd{display:block}
.content{margin-top:14px}
.content>*:first-child{margin-top:0}
.content h1{display:none}
.content h3{font-size:16px;color:var(--acc2);margin:18px 0 8px;padding-left:10px;border-left:3px solid var(--acc)}
.content h4{font-size:15px;margin:14px 0 6px;color:var(--blue)}
.content p{margin:8px 0;color:#d9e2d4}
.content ul,.content ol{margin:8px 0 8px 4px;list-style:none}
.content li{position:relative;padding-left:18px;margin:6px 0}
.content li::before{content:"";position:absolute;left:4px;top:11px;width:6px;height:6px;border-radius:50%;background:var(--acc)}
.content ol{counter-reset:ol}
.content ol li::before{content:counter(ol);counter-increment:ol;background:none;width:auto;height:auto;top:0;left:0;font-size:12px;color:var(--acc);font-weight:700}
.content strong{color:var(--acc2)}
.content em{color:var(--sub)}
.content blockquote{background:#222b24;border-left:3px solid var(--acc);border-radius:0 10px 10px 0;padding:10px 14px;margin:10px 0;color:var(--acc2);font-size:14px}
.content figure{margin:14px 0;background:#101512;border:1px solid var(--line);border-radius:12px;padding:8px;text-align:center}
.content figure img{max-width:100%;border-radius:8px}
.content figcaption{font-size:12px;color:var(--sub);margin-top:7px;line-height:1.5}
.content table{width:100%;border-collapse:separate;border-spacing:0;margin:12px 0;font-size:12.5px;display:block;overflow-x:auto;white-space:normal}
.content th{position:sticky;top:0;z-index:3;background:#2a332c;color:var(--acc2);text-align:left;box-shadow:0 1px 0 var(--line)}
.content th,.content td{border:1px solid var(--line);border-top:none;border-left:none;padding:8px 10px;vertical-align:top}
.content tr td:first-child,.content tr th:first-child{position:sticky;left:0;z-index:2;background:var(--card2);font-weight:600;box-shadow:1px 0 0 var(--line)}
.content tr th:first-child{z-index:4}
.content code{background:var(--card2);padding:1px 6px;border-radius:5px;font-size:13px;color:var(--green)}
.content hr{border:none;border-top:1px dashed var(--line);margin:14px 0}
.discord{background:rgba(255,93,93,.08);border:1px solid rgba(255,93,93,.35);border-radius:10px;padding:10px 12px;margin:10px 0;font-size:14px}
.discord::before{content:"⚔️ 观点分歧　";font-weight:700;color:var(--red)}
.navbar{position:fixed;bottom:0;left:0;right:0;background:rgba(15,17,21,.92);backdrop-filter:blur(10px);border-top:1px solid var(--line);display:flex;z-index:50;max-width:760px;margin:0 auto}
.navbar div{flex:1;text-align:center;padding:8px 0 11px;color:var(--sub);font-size:11px;cursor:pointer}
.navbar div.on{color:var(--acc)}
.navbar div svg{width:20px;height:20px;display:block;margin:0 auto 2px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hit{color:var(--acc);background:rgba(213,250,117,.15);border-radius:3px}
.foot{color:#6b756b;font-size:11px;text-align:center;margin-top:30px;padding:0 20px;line-height:1.8}
.badge{display:inline-block;background:rgba(213,250,117,.15);color:var(--acc);font-size:11px;border-radius:6px;padding:1px 7px;margin-left:6px}
/* Q&A */
.qabox{margin-top:14px}
.qabox textarea{width:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 15px;color:var(--txt);font-size:15px;outline:none;resize:none;min-height:86px;font-family:inherit}
.qabox textarea:focus{border-color:var(--acc)}
.qabtn{margin-top:10px;width:100%;background:var(--acc);color:#152016;border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;cursor:pointer}
.qabtn:active{opacity:.85}
.qatip{color:var(--sub);font-size:12px;margin-top:8px;line-height:1.6}
.anshead{color:var(--acc2);font-size:13px;margin:18px 0 0;font-weight:700}
.anshead small{color:var(--sub);font-weight:400;margin-left:6px}
@media(min-width:700px){.cards{grid-template-columns:repeat(3,1fr)}}
.card.qa{grid-column:1/-1;flex-direction:row;align-items:center;gap:16px}.card.qa .d{flex:none;margin:0}.card.qa .top{flex:none}.card.qa .n{border:none;margin:0 0 0 auto;padding:0}
/* ===== 个体诊断 ===== */
.card.diag{background:linear-gradient(150deg,#14231b 0%,var(--card) 62%);border-color:#2c5240}
.card.diag .n{color:var(--blue)}
.dprogress{height:6px;background:var(--card2);border-radius:99px;margin:12px 0 10px;overflow:hidden}
.dprogress>div{height:100%;background:var(--acc);border-radius:99px;transition:width .25s}
.dstepinfo{display:flex;flex-direction:column;gap:2px;margin-bottom:12px}
.dstepinfo b{font-size:17px;color:var(--acc2)}
.dstepinfo span{font-size:12px;color:var(--sub)}
.dqitem{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 14px;margin-bottom:10px}
.dqt{font-size:14.5px;font-weight:600;margin-bottom:9px;line-height:1.5}
.dqt em{color:var(--red);font-style:normal;margin-left:3px}
.dopts{display:flex;flex-wrap:wrap;gap:7px}
.dopt{display:inline-block;border:1px solid var(--line);background:var(--card2);color:#c8d2c6;border-radius:9px;padding:7px 11px;font-size:13px;cursor:pointer;transition:.12s;line-height:1.4}
.dopt:active{transform:scale(.97)}
.dopt.on{background:rgba(213,250,117,.16);border-color:var(--acc);color:var(--acc2);font-weight:600}
.dnum{display:flex;align-items:center;gap:8px;width:100%}
.dnum input{flex:1;background:var(--card2);border:1px solid var(--line);border-radius:9px;padding:9px 12px;color:var(--txt);font-size:15px;outline:none;font-family:inherit}
.dnum input:focus{border-color:var(--acc)}
.dnum span{color:var(--sub);font-size:13px;flex:none}
.dtext{width:100%;min-height:70px;background:var(--card2);border:1px solid var(--line);border-radius:9px;padding:9px 12px;color:var(--txt);font-size:14px;outline:none;resize:vertical;font-family:inherit}
.dtext:focus{border-color:var(--acc)}
.dopts.num{display:block}
.dnav{display:flex;gap:10px;margin:16px 0 8px}
.dbtn{flex:1;background:var(--acc);color:#152016;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
.dbtn.ghost{background:var(--card2);color:var(--txt);border:1px solid var(--line);flex:0 0 100px}
.dbtn:active{opacity:.86}
.dtip{color:var(--sub);font-size:11.5px;line-height:1.65;margin-top:10px}
/* 报告 */
.dreport{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 15px;margin-top:12px}
.drhead{border-bottom:3px solid var(--acc);padding-bottom:10px;margin-bottom:14px}
.drtitle{font-size:19px;font-weight:800;letter-spacing:.5px}
.drsub{font-size:11px;color:var(--sub);margin-top:5px;line-height:1.6}
.drsec{margin:16px 0}
.drsec h4{font-size:14.5px;color:var(--acc2);margin:0 0 8px;padding-left:9px;border-left:3px solid var(--acc)}
.drtab{width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;display:block;overflow-x:auto}
.drtab th,.drtab td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.drtab th{background:var(--card2);white-space:nowrap;font-weight:600;color:var(--acc2)}
.drtab em{color:var(--sub);font-style:normal;font-size:10px}
.drstats{display:flex;gap:8px;margin:8px 0 10px}
.drstats div{flex:1;border:1px solid var(--line);border-radius:10px;padding:9px 4px;text-align:center;background:var(--card2)}
.drstats b{display:block;font-size:20px}
.drstats span{font-size:10.5px;color:var(--sub)}
.drstats .p0 b{color:var(--red)} .drstats .p1 b{color:#f0a742} .drstats .p2 b{color:var(--blue)}
.drlead{font-size:12.5px;color:#cfd8c8;line-height:1.7;margin:6px 0}
.drgroup{margin:10px 0}
.drgh{display:flex;align-items:center;gap:8px;margin:12px 0 7px;flex-wrap:wrap}
.drtag{font-weight:700;font-size:11.5px;padding:2px 9px;border-radius:5px;color:#fff;white-space:nowrap}
.lv-P0 .drtag{background:#b0443a} .lv-P1 .drtag{background:#9db54a} .lv-P2 .drtag{background:#4f9e6c}
.drgd{font-size:10.5px;color:var(--sub)}
.dritem{border-left:2px solid var(--line);padding:6px 0 6px 10px;margin-bottom:8px}
.lv-P0 .dritem{border-left-color:#5a3328} .lv-P1 .dritem{border-left-color:#4a5528} .lv-P2 .dritem{border-left-color:#274733}
.drit{font-weight:700;font-size:13.5px;line-height:1.5}
.drcat{font-size:10px;color:var(--sub);font-weight:400;border:1px solid var(--line);border-radius:4px;padding:0 5px;margin-left:6px;white-space:nowrap}
.drwhy,.drfix{font-size:12.5px;color:#ccd6c8;line-height:1.72;margin:4px 0}
.drwhy b,.drfix b{color:var(--acc2)}
.drref{font-size:11px;color:var(--sub);margin-top:4px;line-height:1.9}
.drref a{color:var(--blue);text-decoration:none;border-bottom:1px dashed rgba(77,163,255,.4)}
.drplan{border:1px solid #3d4a2c;background:rgba(213,250,117,.06);border-radius:10px;padding:9px 11px;margin:7px 0}
.drplan b{display:block;color:var(--acc);font-size:13px;margin-bottom:3px}
.drplan span{font-size:12px;color:#ccd6c8;line-height:1.7}
.dract{margin:6px 0 6px 20px;font-size:12.5px;line-height:1.9}
.drnote{font-size:11px;color:var(--sub);margin-top:6px;line-height:1.7}
.drfoot{margin-top:16px;padding-top:9px;border-top:1px dashed var(--line);font-size:10.5px;color:#6b7382;line-height:1.7}
.dract2{display:flex;gap:10px;margin:14px 0 6px}
@media(max-width:400px){.dbtn.ghost{flex:0 0 88px;font-size:14px}}
/* ===== 训练日志 ===== */
.card.log{background:linear-gradient(150deg,#121a12 0%,var(--card) 62%);border-color:#2c5240}
.card.log .n{color:var(--green)}
.lghome{margin-top:12px;display:flex;flex-direction:column;gap:10px}
.lgcard{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 15px;cursor:pointer;transition:border-color .12s}
.lgcard:hover{border-color:#3d4a3d}
.lgcard.lg-cur{background:linear-gradient(150deg,#152418 0%,var(--card) 65%);border-color:#2a5c3f}
.lgcard{display:flex;align-items:center;justify-content:space-between;gap:10px}
.lgct{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.lgct b{font-size:15px;line-height:1.4}
.lgmeta{font-size:11.5px;color:var(--sub)}
.lgbadge{font-size:10.5px;color:var(--green);border:1px solid rgba(62,207,142,.35);border-radius:5px;padding:0 6px;width:fit-content}
.lgbadge.blue{color:var(--blue);border-color:rgba(77,163,255,.35)}
.lgarr{color:var(--green);font-size:18px;flex:none}
.lgdrop{width:100%;margin-top:4px}
.lgdrop select{width:100%;background:var(--card2);border:1px solid var(--line);border-radius:9px;padding:10px 12px;color:var(--txt);font-size:14px;outline:none;-webkit-appearance:none;appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--sub) 50%),linear-gradient(135deg,var(--sub) 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat}
.lgstat{display:flex;gap:8px}
.lgstat div{flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;text-align:center;padding:9px 4px}
.lgstat b{display:block;font-size:17px;color:var(--acc2)}
.lgstat span{font-size:10.5px;color:var(--sub)}
.lgrecent{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.lgrt{font-size:12px;color:var(--sub);margin-bottom:6px;font-weight:600}
.lgri{padding:8px 0;border-top:1px dashed var(--line);cursor:pointer;display:flex;flex-direction:column;gap:2px}
.lgri b{font-size:13px;color:var(--acc2)}
.lgri span{font-size:11.5px;color:var(--sub);line-height:1.5}
/* 训练日志首页横幅（置顶） */
.card.log.banner{grid-column:1/-1;margin-top:14px;flex-direction:row;align-items:center;gap:16px;background:linear-gradient(150deg,#122a1d 0%,var(--card) 65%);border-color:#2f6a48}
.card.log.banner .top{flex:none}
.card.log.banner .t{margin-top:0;font-size:16.5px}
.card.log.banner .d{flex:none;margin:0;-webkit-line-clamp:2}
.card.log.banner .n{border:none;margin:0 0 0 auto;padding:0;white-space:nowrap;color:var(--green)}
.lgstatic{cursor:default}
.lgok{color:var(--green);font-size:11px;border:1px solid rgba(62,207,142,.35);border-radius:5px;padding:1px 6px;margin-left:6px}
.lgneed{color:#f0a742;font-size:11px;border:1px solid rgba(240,167,66,.35);border-radius:5px;padding:1px 6px;margin-left:6px}
.lgmaxgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.lgnote{font-size:11.5px;color:var(--sub);line-height:1.7;background:var(--card2);border-radius:8px;padding:8px 10px}
.mvrow{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:9px 10px;margin-bottom:8px}
.mvname{font-size:13px;font-weight:600;color:var(--acc2);margin-bottom:6px;line-height:1.5}
.mvinputs{display:flex;gap:6px;flex-wrap:wrap}
.mvw{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--sub);flex:1;min-width:72px}
.mvw input{width:100%;min-width:0;background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:6px 7px;color:var(--txt);font-size:13px;outline:none;font-family:inherit}
.mvw input:focus{border-color:var(--acc)}
.mvtab{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;margin-top:6px;display:block;overflow-x:auto}
.mvtab th,.mvtab td{border:1px solid var(--line);padding:5px 8px;text-align:left;white-space:nowrap}
.mvtab th{background:var(--card2);color:var(--acc2);font-weight:600}
/* 计划页 */
.ptags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 6px}
.ptag{font-size:11px;color:var(--acc2);background:rgba(213,250,117,.1);border:1px solid rgba(213,250,117,.25);border-radius:6px;padding:2px 8px}
.pfit{font-size:12px;color:var(--sub);margin-bottom:4px}
.lgsec{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 15px;margin-top:14px}
.lgsh{font-size:15px;font-weight:700;color:var(--acc2);margin-bottom:10px}
.lgform{display:flex;flex-direction:column;gap:9px;padding-bottom:12px;border-bottom:1px dashed var(--line)}
.lgrow{display:flex;gap:9px}
.lgrow .lgf{flex:1}
.lgf{display:flex;flex-direction:column;gap:4px;min-width:0}
.lgf label{font-size:11.5px;color:var(--sub)}
.lgf input,.lgf select{background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:8px 10px;color:var(--txt);font-size:13.5px;outline:none;font-family:inherit;width:100%}
.lgf input:focus,.lgf select:focus{border-color:var(--acc)}
.lgform .dbtn{margin-top:2px;padding:11px;font-size:14px}
.lglisthead{display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px;font-size:13px;font-weight:700;color:var(--acc2)}
.lglisthead select{background:var(--card2);border:1px solid var(--line);border-radius:7px;color:var(--txt);font-size:12px;padding:4px 8px;outline:none}
.lgnone{color:var(--sub);font-size:12.5px;text-align:center;padding:14px 0}
.lgentry{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:8px}
.lgehd{display:flex;align-items:center;gap:8px;font-size:12px}
.lgehd b{color:var(--acc2)}
.lgehd span{color:var(--sub);flex:1}
.lgdel{color:#7e887d;font-size:11px;text-decoration:underline;flex:none}
.lgect{font-size:13px;margin-top:4px;line-height:1.6;word-break:break-all}
.lgenote{font-size:11.5px;color:var(--sub);margin-top:3px;line-height:1.6}
</style>
</head>
<body>
<div id="app">
  <header>
    <div class="brand">
      <svg class="logo" viewBox="0 0 48 48" fill="none" stroke="#d5fa75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 5l16 8.5V25c0 9.5-7 15.5-16 18C15 40.5 8 34.5 8 25V13.5z"/><path d="M17 27l4.5-5.5 3.5 3.5 6-8"/></svg>
      <h1>山顶洞人<span>力训教练</span></h1>
    </div>
    <div class="tagline">力量训练知识体系 · 综合 20 份专业资料 · 14 份训练计划 · 支持智能问答</div>
    <div class="searchbar"><input id="q" placeholder="搜索：低杆深蹲、平台期、腰痛、MEV…" /></div>
  </header>
  <main id="view"></main>
  <div class="foot">本系统内容综合自：《力量训练原理》《肌肉肥大科学训练原则》《如何深蹲/卧推/硬拉·终极指南》《力量训练基础》《力量举指南（赵伟）》《Juggernaut 力量举手册》《力量举计划设计手册》《RTS 反应训练系统》《Westside 共轭法用户指南》《终极饮食设置指南》《肌骨疼痛康复临床工作笔记》及 RTS 系列×4、Juggernaut Method、腰王、Calgary Barbell、GZCL波浪撕裂者、SSTT×Jamal Browner、Russwole、帕金斯74kg、古斯塔夫16周、山顶洞人CATS 4.0、斯莫洛夫共 14 份训练计划表。配图截取自对应资料页，页码为 PDF 物理页码，仅供个人学习。<br>伤病与康复内容仅供学习参考，不能替代专业医疗诊断，请及时就医。</div>
</div>
<nav class="navbar" id="nav"></nav>
<script>
const DATA=__DATA__;
const NAV=[["home","home","首页","M4 20 L16 8 l12 12 M8 18v12h6v-7h4v7h6V18"],["bigthree","bigthree","三大项","M4 20h24 M8 13v14 M20 13v14 M12 11v18 M16 11v18"],["troubleshooting","troubleshooting","排查","M14 6a7 7 0 0 0-7 9l-4 4 6 6 4-4a7 7 0 0 0 9-7 M22 22l8 8"],["plans","plans","计划","M7 6h18v24H7z M11 4v5 M21 4v5 M7 13h18 M11 22l3-4 2 2 4-5"],["log","log","日志","M6 4h16v24H6z M9 11h8 M9 16h8 M9 21h5"],["diag","diag","诊断","M9 5h14v24H9z M12 12h8 M12 17h8 M12 22h5"],["qa","qa","问答","M6 6h20v14H14l-6 5v-5H6z M11 12h.5 M16 12h.5 M21 12h.5"]];
let view="home";
const app=document.getElementById("view"),nav=document.getElementById("nav");
// 首页卡片图标：统一在 6~26 坐标范围内绘制，保证视觉大小一致
const ICONS={
 "principles":"M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M24.5 7.5l-2.8 2.8M10.3 21.7l-2.8 2.8M16 11a5 5 0 1 0 0 10 5 5 0 0 0 0-10",
 "bigthree":"M6 27h20M9 27V14h4v13M19 27V14h4v13M11 14V8h10v6M16 4v4",
 "troubleshooting":"M15 5a10 10 0 1 0 0 20 10 10 0 0 0 0-20M15 9v7M15 19v3M27 27l-6.5-6.5",
 "plans":"M7 5h18a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M11 3v5M21 3v5M5 12h22M11 20l3-4 2 2 4-5",
 "plateau":"M4 26h24M4 22l7-7 5 4 8-11M23 8h4v4",
 "nutrition":"M16 6c5 4 8 7 8 12a8 8 0 0 1-16 0c0-5 3-8 8-12M12 19a4 4 0 0 0 4 4",
 "rehab":"M16 5v22M5 16h22M8.9 8.9l14.2 14.2M23.1 8.9L8.9 23.1",
 "log":"M6 4h16a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 4v4M16 4v4M8 12h8M8 17h11M8 22h6",
 "diag":"M9 5h14a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M12 12h8M12 17h8M12 22h5M12 4v4",
 "qa":"M5 6h22a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H14l-7 6v-6H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M11 13h.5M16 13h.5M21 13h.5",
}
function isvg(p,c){return `<svg viewBox="0 0 32 32" ${c?`class="${c}"`:""}><path d="${p}"/></svg>`}
function icoBox(id){return `<span class="icobox">${isvg(ICONS[id]||ICONS.principles,"ico")}</span>`}
function icoBoxInline(id){return `<span style="display:inline-flex;width:26px;height:26px;vertical-align:-6px">${isvg(ICONS[id]||ICONS.principles)}</span>`}
nav.innerHTML=NAV.map(n=>`<div data-go="${n[0]}">${isvg(ICONS[n[0]]||n[3])}${n[2]}</div>`).join("")+`<div data-go="all"><svg viewBox="0 0 32 32"><path d="M6 6h8v8H6z M18 6h8v8h-8z M6 18h8v8H6z M18 18h8v8h-8z"/></svg>全部</div>`;
nav.addEventListener("click",e=>{const d=e.target.closest("[data-go]");if(d)go(d.dataset.go)});
function esc(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function hl(html,q){if(!q)return html;try{const re=new RegExp(q.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&"),"g");return html.replace(re,m=>`<span class="hit">${m}</span>`)}catch(e){return html}}
function isDiscord(t){return /分歧|对照表/.test(t)}
function secHTML(s,q){const open=isDiscord(s.t)?" open":"";return `<div class="sec${open}"><div class="hd" onclick="this.parentElement.classList.toggle('open')"><span>${esc(s.t)}</span><span class="arr">▶</span></div><div class="bd"><div class="content">${hl(s.h,q)}</div></div></div>`}
function modHTML(m,q){return `<h2 class="modtitle"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="3"/><path d="M16 4v5M16 23v5M4 16h5M23 16h5M8 8l3.5 3.5M20.5 20.5L24 24M24 8l-3.5 3.5M11.5 20.5L8 24"/></svg> ${m.title}<span class="badge">${m.sections.length}节</span></h2><div class="content" style="margin:0 0 6px;color:var(--sub);font-size:13px">${esc(m.desc)}</div>`+m.sections.map(s=>secHTML(s,q)).join("")}
function cardIco(id){return icoBox(id)}
function home(){
  const secN=DATA.reduce((a,m)=>a+m.sections.length,0);
  return `<div class="hstats"><div><b>${DATA.length}</b><span>知识模块</span></div><div><b>${secN}</b><span>章节</span></div><div><b>14</b><span>训练计划</span></div></div><div class="card log banner" data-go="log"><div class="top">${icoBox("log")}<span class="idx">★</span></div><div class="t">训练日志 · 固定填报模板</div><div class="d">14 份计划任选 · 每份计划含训练极限输入、逐日逐动作重量/次数/组数/RPE 跟踪 · 按计划原文逻辑生成填报模板</div><div class="n">记下今天这一练 →</div></div><div class="cards">`+
  DATA.map((m,i)=>`<div class="card" data-go="${m.id}"><div class="top">${cardIco(m.id)}<span class="idx">0${i+1}</span></div><div class="t">${m.title}</div><div class="d">${m.desc}</div><div class="n">${m.sections.length} 个章节 · 查看 →</div></div>`).join("")+
  `<div class="card diag" data-go="diag"><div class="top">${icoBox("diag")}<span class="idx">09</span></div><div class="t">个体诊断</div><div class="d">8 步问卷 → 自动生成问题清单与调整方案，支持一键导出 PDF</div><div class="n">开始诊断 · 约5分钟 →</div></div>`+
  `<div class="card qa" data-go="qa"><div class="top">${icoBox("qa")}</div><div><div class="t">Q&A 智能问答</div><div class="d">输入问题，自动匹配资料库内容作为解答</div></div><div class="n">开始提问 →</div></div></div>`}
function qaView(){return `<h2 class="modtitle"><svg viewBox="0 0 32 32"><path d="M6 6h20v14H14l-6 5v-5H6z"/><path d="M11 13h.6M16 13h.6M21 13h.6"/></svg> Q&A 智能问答</h2>
<div class="qabox"><textarea id="qaInput" placeholder="输入你的训练问题，例如：&#10;· 深蹲总是膝盖内扣怎么办？&#10;· 增肌期每天该吃多少蛋白质？&#10;· 遇到平台期应该怎么突破？&#10;· 硬拉下背疼可能是什么问题？"></textarea>
<button class="qabtn" id="qaBtn">提问 · 从资料库找答案</button>
<div class="qatip">问答引擎会解析你的问题关键词，在 7 大模块全部章节中匹配最相关的内容并自动展开。内容均来自你上传的资料，页码出处已标注。问题越具体，匹配越准确。</div></div>
<div id="qaResult"></div>`}
function doQA(){
  const q=document.getElementById("qaInput").value.trim();
  const box=document.getElementById("qaResult");
  if(!q){box.innerHTML=`<p style="color:var(--sub);margin-top:20px;text-align:center">请先输入问题～</p>`;return}
  // 分词：中文二元组 + 长词 + 英数词
  const raw=q.toLowerCase();
  const terms=new Set();
  (raw.match(/[a-z0-9%]+/g)||[]).forEach(w=>w.length>1&&terms.add(w));
  for(let i=0;i<raw.length-1;i++){const a=raw[i],b=raw[i+1];if(/[\u4e00-\u9fa5]/.test(a)&&/[\u4e00-\u9fa5]/.test(b))terms.add(a+b)}
  const STOP=/的是了么呢吗啊怎么什么如何怎么办训练|并且|或者|应该|可以|有没有|是不是/;
  const scored=[];
  for(const m of DATA)for(const s of m.sections){
    const hay=(s.t+"　"+s.h.replace(/<[^>]+>/g," ")).toLowerCase();
    let score=0,hits=[];
    for(const t of terms){
      if(t.length<2||STOP.test(t)&&t.length<3)continue;
      const inT=s.t.toLowerCase().includes(t), n=hay.split(t).length-1;
      if(n||inT){score+=(inT?3:0)+Math.min(n,6);hits.push(t)}
    }
    if(score>0)scored.push({m,s,score,hits});
  }
  scored.sort((a,b)=>b.score-a.score);
  if(!scored.length){box.innerHTML=`<p style="color:var(--sub);margin-top:24px;text-align:center">资料库中没有找到与「${esc(q)}」直接相关的内容。<br>试试换个说法，或用底部导航浏览对应模块。</p>`;return}
  const top=scored.slice(0,3);
  box.innerHTML=`<div class="anshead">📚 为你找到 ${scored.length} 处相关内容，显示最匹配的 ${top.length} 处</div>`+
    top.map(x=>`<div class="anshead" style="margin-top:14px">${esc(x.m.title)} <small>› ${esc(x.s.t)}　匹配度 ${x.score}</small></div>`+secHTML(x.s,q.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&").slice(0,80))).join("");
  box.scrollIntoView({behavior:"smooth"});
}
function go(id){view=id;if(id==="log"&&typeof logView==="function"){}document.getElementById("q").value="";render();window.scrollTo(0,0);[...nav.children].forEach(c=>c.classList.toggle("on",c.dataset.go===id))}
function render(){
  let html="";
  if(view==="home"){html=home()}
  else if(view==="log"){html=logView()}
  else if(view.startsWith("plan-")){curPlanId=view.slice(5);html=planView()}
  else if(view==="diag"){html=diagView()}
  else if(view==="qa"){html=qaView()}
  else if(view==="all"){html=`<h2 class="modtitle">📚 全部模块</h2>`+DATA.map(m=>modHTML(m)).join("")}
  else{const m=DATA.find(x=>x.id===view);html=`<div class="back" onclick="go('home')">← 返回首页</div>`+modHTML(m)}
  app.innerHTML=html;
  if(view==="qa"){document.getElementById("qaBtn").onclick=doQA;document.getElementById("qaInput").addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter")doQA()})}
}
function search(q){
  q=q.trim();if(q.length<1){render();return}
  const re=new RegExp(q.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&"),"gi");
  let html=`<div class="back" onclick="go('home')">← 返回首页</div><h2 class="modtitle">🔍 “${esc(q)}” 的搜索结果</h2>`;
  let total=0;
  for(const m of DATA){
    const hits=m.sections.filter(s=>s.t.includes(q)||s.h.includes(q)||re.test(s.h));
    if(hits.length){total+=hits.length;html+=`<div style="color:var(--acc2);font-size:14px;margin:16px 0 0;font-weight:700">${m.title}</div>`+hits.map(s=>secHTML(s,q)).join("")}
  }
  app.innerHTML=html+(total===0?`<p style="color:var(--sub);text-align:center;margin-top:40px">没有找到相关内容，换个关键词试试～</p>`:"");
  window.scrollTo(0,0);
}
let tm;document.getElementById("q").addEventListener("input",e=>{clearTimeout(tm);const v=e.target.value;tm=setTimeout(()=>{v.trim()?search(v):render()},250)});
app.addEventListener("click",e=>{const d=e.target.closest("[data-go]");if(d&&d.dataset.go)go(d.dataset.go)});
app.addEventListener("change",e=>{if(e.target.id==="planSel"&&e.target.value)openPlan(e.target.value)});
go("home");
</script>
<script>
const DIAG=__DIAGDATA__;
__DIAGUI__
</script>
<script>
const PLANS=__PLANDATA__;
__LOGUI__
</script>
</body>
</html>"""

out = HTML.replace("__DATA__", content_js).replace("__DIAGDATA__", json.dumps(DIAG, ensure_ascii=False)).replace("__DIAGUI__", DIAG_UI).replace("__PLANDATA__", json.dumps(PLANDATA, ensure_ascii=False)).replace("__LOGUI__", LOG_UI)
OUT.write_text(out, encoding="utf-8")
print("written", OUT, round(OUT.stat().st_size/1024/1024,2), "MB")
