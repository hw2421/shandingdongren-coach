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
    ("bigthree",       "三大项动作框架",    "动作三分类 · 深蹲/卧推/硬拉的设置·阶段结构·变式推导 · 四类参数排查法", "module_bigthree_v4.md"),
    ("troubleshooting","动作问题排查",      "症状→归类→归因→选手段四步流程 · 三大项逐条症状速查 · 一节课排查流程", "module_tshoot_v4.md"),
    ("principles",     "训练原理",          "七大核心原理 · 专项性/超负荷/疲劳管理/SRA/变式/阶段增益/个体化 · MEV-MRV · RPE-RIR · 五大流派对照", "module_principles_v4.md"),
    ("plans",          "训练计划设置原理",  "八步设计法 · 中周期长度 · 超负荷与波动组合 · 弱点变式配对 · 14份计划横向对照", "module_programming_v4.md"),
    ("plateau",        "平台期突破",        "停滞原因四类诊断清单与训练/恢复端突破策略", "module_plateau.md"),
    ("nutrition",      "营养",              "能量平衡与TDEE四组成 · 热量/蛋白/脂肪/碳水四步定序 · 周期分段策略 · 比赛日 · 补剂证据分级", "module_nutrition_v4.md"),
    ("rehab",          "伤病排查及康复",    "疼痛认知、各部位问题自查、重返训练原则与预防", "module_rehab.md"),
]

DIAG = json.loads((BASE/"diag_data.json").read_text(encoding="utf-8"))
DIAG_UI = (BASE/"diag_ui.js").read_text(encoding="utf-8")
PLANDATA = json.loads((BASE/"plan_data.json").read_text(encoding="utf-8"))
import glob as _glob
PLANTABLES = json.loads((BASE/"plan_tables.json").read_text(encoding="utf-8"))
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
        # 去掉首部 "# 一级标题" 行（模块名已由卡片/页头显示），避免多出一个"概述"节
        raw=re.sub(r"\A\s*#\s+[^\n]*\n", "", raw)
        parts=re.split(r"\n(?=## )",raw)
        for part in parts:
            part=part.strip()
            if not part: continue
            m=re.match(r"##\s+(.*)",part)
            title=m.group(1).strip().strip("#").strip() if m else "使用说明与资料来源"
            body=part[m.end():].strip() if m else part
            if not body: continue
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
#app{max-width:760px;margin:0 auto;padding-bottom:96px;overflow-x:hidden}
header{padding:26px 20px 14px;background:var(--bg)}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:44px;height:44px;flex:none}
.brand h1{font-size:23px;font-weight:800;letter-spacing:1px}
.brand h1 span{color:var(--acc)}
.tagline{color:var(--sub);font-size:13px;margin-top:6px}
.hbanner{position:relative;border-radius:14px;overflow:hidden;margin:14px 0 4px;border:1px solid var(--line);background:#0c100c}
.hbanner img{display:block;width:100%;height:190px;object-fit:cover;object-position:center 20%;filter:brightness(.82) saturate(1.05)}
.hbanner .hbt{position:absolute;left:0;right:0;bottom:0;padding:26px 14px 10px;background:linear-gradient(transparent,rgba(5,8,5,.88));display:flex;flex-direction:column;gap:2px}
.hbanner .hbt b{color:#fff;font-size:16px;letter-spacing:.5px}
.hbanner .hbt span{color:var(--acc);font-size:11.5px}
.searchbar.homeq{margin:18px 0 8px}
.pguide{background:#101512;border:1px solid var(--line);border-left:3px solid #3b463c;border-radius:10px;padding:10px 12px;margin-top:9px;cursor:pointer;transition:border-color .12s}
.pguide:hover{border-color:var(--acc)}
.pguide.on{border-left-color:var(--acc);background:#121a12}
.pgh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.pgh b{color:var(--acc2);font-size:12.5px;line-height:1.4;word-break:break-word}
.pgh span{color:var(--sub);font-size:10.5px}
.pgtag{font-style:normal;margin-left:auto;font-size:9.5px;color:var(--acc);border:1px solid var(--acc);border-radius:5px;padding:0 5px;flex:none}
.pgrow{display:flex;gap:8px;margin-top:6px;align-items:flex-start}
.pgrow label{flex:none;width:52px;font-size:10px;color:var(--acc);background:#1b231a;border:1px solid var(--line);border-radius:5px;text-align:center;padding:1px 0;line-height:1.6}
.pgrow p{margin:0;font-size:11px;color:var(--txt);line-height:1.6;word-break:break-word}
.pgcols{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:7px}
@media(max-width:560px){.pgcols{grid-template-columns:1fr}}
.pgcol{background:#0c100c;border:1px solid var(--line);border-radius:8px;padding:7px 9px}
.pgcol label{display:block;font-size:10px;margin-bottom:3px;font-weight:700}
.pgcol.pro label{color:#9fd36a}
.pgcol.con label{color:#e0a06a}
.pgcol ul{margin:0;padding-left:14px}
.pgcol li{font-size:10.5px;color:var(--sub);line-height:1.65;word-break:break-word;margin-bottom:2px}
.pgsrc{margin-top:7px;padding-top:6px;border-top:1px dashed var(--line);font-size:9.5px;color:#6f7a6e;line-height:1.6;word-break:break-word}
.qnote{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-left:4px;border:1px solid var(--line);border-radius:50%;font-size:8.5px;font-style:normal;color:var(--sub);cursor:pointer;vertical-align:1px;flex:none}
.qnote:hover{color:var(--acc);border-color:var(--acc)}
.b3box{background:#101512;border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin-top:6px}
.b3box .b3main{display:flex;align-items:baseline;gap:8px}
.b3box .b3main b{color:var(--acc);font-size:20px;font-variant-numeric:tabular-nums}
.b3box .b3main span{color:var(--sub);font-size:11px}
.b3box .b3sub{color:var(--sub);font-size:10.5px;margin-top:4px;line-height:1.5}
.b3box .b3sub b{color:var(--txt)}
.b3head,.b3r{display:grid;grid-template-columns:1.1fr 1fr 1fr .9fr;gap:6px;align-items:center;padding:5px 2px;border-bottom:1px solid rgba(255,255,255,.05)}
.b3head{color:var(--sub);font-size:10.5px;border-bottom:1px solid var(--line);padding-bottom:6px}
.b3head span:not(:first-child),.b3v,.b3d{text-align:right;font-variant-numeric:tabular-nums}
.b3n{color:var(--txt);font-size:12px}
.b3v{color:var(--txt);font-size:12.5px}
.b3d{font-size:11.5px;color:var(--sub)}
.b3d.up{color:#e0603f}
.b3d.down{color:#4fa87a}
.b3r.tot{border-bottom:none;border-top:1px solid var(--line);margin-top:2px;padding-top:7px}
.b3r.tot .b3n{color:var(--acc);font-weight:600}
.b3r.tot .b3v{color:var(--acc);font-weight:600;font-size:13.5px}
.b3v.dim{color:var(--sub)}
.b3t{font-style:normal;font-size:9.5px;color:var(--sub);opacity:.8}
.jrest{display:flex;justify-content:space-between;align-items:center;background:#181d18;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:11px;color:var(--sub)}
.jrest b{color:var(--acc);font-size:13px;font-variant-numeric:tabular-nums}
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
.card .t{font-weight:700;margin-top:10px;font-size:15.5px;line-height:1.35;white-space:normal;word-break:break-word;overflow-wrap:anywhere}
.card .d{color:var(--sub);font-size:12px;margin-top:5px;line-height:1.55;flex:1;white-space:normal;word-break:break-word;overflow-wrap:anywhere}
.card .n{color:var(--acc2);font-size:11.5px;margin-top:auto;padding-top:9px;border-top:1px dashed var(--line);white-space:normal;word-break:break-word}
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
.card.log.banner{grid-column:1/-1;margin-top:14px;flex-direction:row;align-items:center;flex-wrap:wrap;gap:4px 12px;background:linear-gradient(150deg,#122a1d 0%,var(--card) 65%);border-color:#2f6a48}
.card.log.banner .top{flex:none}
.card.log.banner .t{margin-top:0;font-size:16.5px;flex:none;max-width:100%}
.card.log.banner .d{flex:1 1 100%;min-width:0;margin:0;white-space:normal}
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

/* ===== 训练日志 v5：格子表 + 当日表 ===== */
.lgstatic{cursor:default}
.lgok{color:var(--green);font-size:10.5px;border:1px solid rgba(94,216,143,.35);border-radius:5px;padding:1px 6px;margin-left:6px;white-space:nowrap}
.lgneed{color:#d8b26a;font-size:10.5px;border:1px solid rgba(216,178,106,.35);border-radius:5px;padding:1px 6px;margin-left:6px;white-space:nowrap}
.lgpg{float:right;font-size:11px;color:var(--acc);font-weight:600;font-variant-numeric:tabular-nums}
.lgmaxgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:8px}
.lgmaxgrid.three{grid-template-columns:repeat(3,1fr)}
.lgmaxgrid.three .lgf label{font-size:9.5px}
.lgmaxgrid.three .lgmaxI{padding:6px 4px;font-size:12px}
.lgf.repf label{color:#c9b06a}
.lgf.repf .lgmaxI{text-align:center}
.lgmaxgrid.four{grid-template-columns:repeat(4,1fr);gap:6px}
.lgmaxgrid.four .lgf label{font-size:9px;line-height:1.3;height:22px;display:flex;align-items:flex-end}
.lgmaxgrid.four .lgmaxI{padding:6px 3px;font-size:11.5px;text-align:center}
.lgnote{font-size:11px;color:var(--sub);line-height:1.65;background:var(--card2);border-radius:8px;padding:7px 9px;word-break:break-all;overflow-wrap:anywhere}
.lgbarsm{height:4px;background:var(--line);border-radius:99px;overflow:hidden;margin:7px 0 10px}
.lgbarsm i{display:block;height:100%;background:var(--acc);border-radius:99px;transition:width .3s}
/* 格子表：极紧凑（每周期一行，格高18px） */
#gridBox{margin-top:6px}
.gblock{display:flex;align-items:center;gap:5px;padding:1.5px 0}
.gbt{flex:0 0 56px;font-size:9px;color:var(--sub);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gcells{flex:1;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2.5px;min-width:0}
.gcell{position:relative;background:#1a211a;border:1px solid #2b3429;border-radius:3px;height:17px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.1s;min-width:0;overflow:hidden}
.gcell b{font-size:9px;color:#8f998c;line-height:1;font-weight:600;font-variant-numeric:tabular-nums}
.gcell u{position:absolute;left:0;bottom:0;height:2px;background:#c9b64a}
.gcell:active{transform:scale(.92)}
.gcell.part{border-color:#7d7a3c;background:#242a1c}
.gcell.part b{color:#e0d67a}
.gcell.done{background:#3a5528;border-color:#7aa855}
.gcell.done b{color:var(--acc);font-size:11px}
.gcell.sel{outline:1.5px solid var(--acc);outline-offset:-1px}
/* 当日表 */
.dayhd{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:0 0 8px;border-bottom:1px solid var(--line);margin-bottom:2px}
.dayhd div{display:flex;flex-direction:column;gap:1px;min-width:0}
.dayhd b{font-size:12.5px;color:var(--acc2);line-height:1.35}
.dayhd span{font-size:11px;color:var(--sub)}
.daypr{font-size:11px;color:var(--acc);font-weight:700;white-space:nowrap;flex:none}
.thead,.trow{display:grid;grid-template-columns:17px minmax(0,1fr) 22px 54px 42px 42px;gap:3px;align-items:center}
.thead{padding:6px 0 5px;font-size:9.5px;color:var(--sub);letter-spacing:.4px;position:sticky;top:0;background:var(--card);z-index:2}
.thead span:nth-child(3),.thead span:nth-child(4),.thead span:nth-child(5),.thead span:nth-child(6){text-align:center}
.ghead{font-size:11.5px;font-weight:700;color:var(--acc2);margin:9px 0 3px;padding-left:6px;border-left:2px solid var(--acc);line-height:1.4;display:flex;align-items:center;gap:6px}
.ghead span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ghead em{font-style:normal;font-weight:400;font-size:10px;color:var(--sub);background:#1b231a;border:1px solid var(--line);border-radius:5px;padding:0 5px;flex:none}
.ghead.main{border-left-color:#e0b64a}
.ghead .mtag{font-style:normal;font-size:9.5px;color:#e0b64a;border:1px solid rgba(224,182,74,.45);background:rgba(224,182,74,.1);border-radius:5px;padding:1px 5px;flex:none;font-weight:600}
.trow{padding:5px 0;border-bottom:1px solid #232c26;font-size:11.5px}
.trow:last-child{border-bottom:0}
.trow .tno{color:#7a8477;font-size:10px;text-align:center;font-variant-numeric:tabular-nums}
.trow .tplan{color:#c3ccc0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}
.trow .treps{color:var(--sub);text-align:center;font-size:11px}
.trow input{width:100%;min-width:0;background:#101512;border:1px solid var(--line);border-radius:6px;padding:6px 2px;color:var(--txt);font-size:12px;text-align:center;outline:none;font-family:inherit;-moz-appearance:textfield}
.trow input::-webkit-inner-spin-button,.trow input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.trow input:focus{border-color:var(--acc);background:#161d15}
.trow.done .tno{color:var(--acc);font-weight:700}
.trow.done .tplan{color:var(--acc2)}
.trow.done input{background:#1d2a17;border-color:#4d6b39;color:var(--acc2)}
/* 保存提示 */
.dnav2{display:flex;align-items:center;gap:6px;margin:7px 0 3px}
.dnav2 button{flex:1;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:7px 4px;font-size:11.5px;cursor:pointer;font-family:inherit}
.dnav2 button:active{opacity:.8}
.dnav2 button:disabled{opacity:.3}
.dnav2 span{font-size:10px;color:var(--sub);flex:none;font-variant-numeric:tabular-nums}
.daydone{margin:8px 0 0}
.preset{display:flex;align-items:center;gap:10px;margin:10px 0 2px;flex-wrap:wrap}
.preset span{font-size:10.5px;color:var(--sub)}
.btnRestart{background:rgba(224,138,106,.1);border:1px solid rgba(224,138,106,.5);color:#e0996a;border-radius:8px;padding:6px 12px;font-size:11.5px;font-weight:700;font-family:inherit;cursor:pointer}
.btnRestart:active{background:rgba(224,138,106,.2)}
.btnClear{width:100%;background:transparent;border:1px solid #4a3a34;color:#c08a72;border-radius:9px;padding:8px;font-size:11.5px;font-family:inherit;cursor:pointer;margin-top:6px}
.btnClear:active{background:rgba(224,138,106,.12)}
.cfmWrap{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .16s}
.cfmWrap.on{opacity:1}
.cfmMask{position:absolute;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(2px)}
.cfmBox{position:relative;width:100%;max-width:360px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 16px 14px;box-shadow:0 18px 44px rgba(0,0,0,.55);transform:translateY(8px);transition:transform .16s}
.cfmWrap.on .cfmBox{transform:none}
.cfmT{font-size:15px;font-weight:700;color:var(--txt);margin-bottom:10px}
.cfmD{font-size:12px;color:var(--sub);line-height:1.7}
.cfmD p{margin:0 0 6px}
.cfmD b{color:var(--acc2)}
.cfmD ul{margin:4px 0 8px;padding-left:16px}
.cfmD li{margin-bottom:3px;word-break:break-word}
.cfmD .cfmWarn{color:#e0996a;font-size:11.5px;margin-top:8px}
.cfmBtns{display:flex;gap:9px;margin-top:14px}
.cfmBtns button{flex:1;border-radius:9px;padding:10px;font-size:12.5px;font-family:inherit;cursor:pointer;font-weight:700}
.cfmCancel{background:#1a201a;border:1px solid var(--line);color:var(--sub)}
.cfmOk{background:rgba(213,250,117,.14);border:1px solid var(--acc);color:var(--acc)}
.cfmOk.danger{background:rgba(224,110,90,.14);border-color:#d9694f;color:#f09a7e}
.ghead.libg{flex-wrap:wrap;gap:4px}
.ghead.libg .libSel{margin-left:auto;max-width:58%;background:#101512;border:1px solid #3b463c;color:var(--acc2);border-radius:6px;padding:3px 5px;font-size:10.5px;font-family:inherit;outline:none}
.jmroll{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}
.jmroll .jr{background:#101512;border:1px solid var(--line);border-radius:7px;padding:5px 4px;text-align:center;font-size:10px;color:var(--sub);line-height:1.5}
.jmroll .jr b{display:block;color:var(--acc2);font-size:11.5px;font-variant-numeric:tabular-nums}
.btnDone{width:100%;background:rgba(213,250,117,.12);border:1px solid var(--acc);color:var(--acc);border-radius:9px;padding:10px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer}
.btnDone:active{transform:scale(.99);opacity:.85}
.lgtoast{position:fixed;left:50%;bottom:86px;transform:translate(-50%,14px);background:#2a3a22;border:1px solid var(--acc);color:var(--acc);font-size:12.5px;padding:8px 16px;border-radius:99px;opacity:0;pointer-events:none;transition:.22s;z-index:99;white-space:nowrap;box-shadow:0 6px 22px rgba(0,0,0,.5)}
.lgtoast.on{opacity:1;transform:translate(-50%,0)}
@media(max-width:400px){
  .gcells{grid-template-columns:repeat(5,1fr)}
  .thead,.trow{grid-template-columns:15px minmax(0,1fr) 20px 50px 38px 38px;gap:2px}
  .lgmaxgrid{grid-template-columns:1fr 1fr}
}
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
    <div class="tagline">力量训练知识体系 · 支持智能问答</div>
  </header>
  <main id="view"></main>
  <div class="foot">本系统内容综合自：《力量训练原理》《肌肉肥大科学训练原则》《如何深蹲/卧推/硬拉·终极指南》《力量训练基础》《力量举指南（赵伟）》《Juggernaut 力量举手册》《力量举计划设计手册》《RTS 反应训练系统》《Westside 共轭法用户指南》《终极饮食设置指南》《肌骨疼痛康复临床工作笔记》及 RTS 系列×4、Juggernaut Method、腰王、Calgary Barbell、GZCL波浪撕裂者、SSTT×Jamal Browner、Russwole、帕金斯74kg、古斯塔夫16周、山顶洞人CATS 4.0、斯莫洛夫共 18 个训练计划（RTS×4、Juggernaut、腰王基础C1、腰王进阶C1、Calgary、GZCL、SSTT、Russwole、74kg、古斯塔夫、CATS×4 cycle、斯莫洛夫）。配图截取自对应资料页，页码为 PDF 物理页码，仅供个人学习。<br>伤病与康复内容仅供学习参考，不能替代专业医疗诊断，请及时就医。</div>
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
  return `<div class="hbanner"><img src="__BANNER__" alt="banner"/><div class="hbt"><b>山顶洞人力训教练</b><span>练好三大项 · 记好每一组</span></div></div>`+
  `<div class="card log banner" data-go="log"><div class="top">${icoBox("log")}<span class="idx">★</span></div><div class="t">训练日志 · 固定填报模板</div><div class="d">18 份计划任选 · 每份计划含训练极限输入、逐日逐动作重量/次数/组数/RPE 跟踪 · 按计划原文逻辑生成填报模板</div><div class="n">记下今天这一练 →</div></div><div class="cards">`+
  DATA.map((m,i)=>{ if(m.id==="plans") return `<div class="card" data-go="log"><div class="top">${cardIco(m.id)}<span class="idx">0${i+1}</span></div><div class="t">训练计划</div><div class="d">18 份原表迁移计划 · 格子表追踪完成度 · 逐组填报自动保存 · 支持三大项预测合计</div><div class="n">进入训练日志 →</div></div>`; return `<div class="card" data-go="${m.id}"><div class="top">${cardIco(m.id)}<span class="idx">0${i+1}</span></div><div class="t">${m.title}</div><div class="d">${m.desc}</div><div class="n">${m.sections.length} 个章节 · 查看 →</div></div>` }).join("")+
  `<div class="card diag" data-go="diag"><div class="top">${icoBox("diag")}<span class="idx">09</span></div><div class="t">个体诊断</div><div class="d">8 步问卷 → 自动生成问题清单与调整方案，支持一键导出 PDF</div><div class="n">开始诊断 · 约5分钟 →</div></div>`+
  `<div class="card qa" data-go="qa"><div class="top">${icoBox("qa")}</div><div><div class="t">Q&A 智能问答</div><div class="d">输入问题，自动匹配资料库内容作为解答</div></div><div class="n">开始提问 →</div></div></div>`+
  `<div class="searchbar homeq"><input id="q" placeholder="搜索：低杆深蹲、平台期、腰痛、MEV…" /></div>`}
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
function go(id){view=id;if(id==="log"&&typeof logView==="function"){}const qel=document.getElementById("q");if(qel)qel.value="";render();window.scrollTo(0,0);[...nav.children].forEach(c=>c.classList.toggle("on",c.dataset.go===id))}
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
  if(view==="home")bindQ();
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
let tm;
function bindQ(){const el=document.getElementById("q");if(!el)return;el.removeEventListener("input",qHandler);el.addEventListener("input",qHandler)}
function qHandler(e){clearTimeout(tm);const v=e.target.value;tm=setTimeout(()=>{v.trim()?search(v):render()},250)}
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
const PT=__PLANTABLES__;
__LOGUI__
</script>
</body>
</html>"""

import base64, os
_bpath = "/root/uploads/1793958322824025016-1793958306039-qksd72dz-898207270526f63914ed16a1e47ad2ea.jpg"
BANNER = ("data:image/jpeg;base64," + base64.b64encode(open(_bpath, "rb").read()).decode()) if os.path.exists(_bpath) else ""

out = HTML.replace("__DATA__", content_js).replace("__DIAGDATA__", json.dumps(DIAG, ensure_ascii=False)).replace("__DIAGUI__", DIAG_UI).replace("__PLANDATA__", json.dumps(PLANDATA, ensure_ascii=False)).replace("__PLANTABLES__", json.dumps(PLANTABLES, ensure_ascii=False)).replace("__LOGUI__", LOG_UI).replace("__BANNER__", BANNER)
OUT.write_text(out, encoding="utf-8")
print("written", OUT, round(OUT.stat().st_size/1024/1024,2), "MB")
