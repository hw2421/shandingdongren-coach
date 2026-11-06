#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""fix_v11: 1) RTS 按源表 RPE×次数 反推重量  2) CATS 按源表公式补 RPE"""
import json, re, sys, copy

BASE = '/root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d65-3cdb49c2f000'
T = json.load(open(BASE + '/plan_tables.json'))

# ---------- RTS 源表「计算器」页 RPE × 次数 → 1RM 百分比 ----------
# rows: RPE 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6 ; cols: reps 1..10
RPE_TAB = {
    10.0: [1.000, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739],
    9.5:  [0.978, 0.939, 0.907, 0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723],
    9.0:  [0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707],
    8.5:  [0.939, 0.907, 0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694],
    8.0:  [0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.680],
    7.5:  [0.907, 0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667],
    7.0:  [0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.680, 0.653],
    6.5:  [0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.640],
    6.0:  [0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.680, 0.653, 0.626],
}
def rts_pct(rpe, reps):
    """取最接近的 RPE 档位（6~10，步进0.5）与次数（1~10）。
       源表换算表只到 10 次；>10 次按 9→10 次的相对递减率线性外推。"""
    if rpe is None or reps is None: return None
    rpe = round(rpe * 2) / 2
    rpe = min(10.0, max(6.0, rpe))
    if reps < 1: return None
    if reps <= 10:
        return RPE_TAB[rpe][reps - 1]
    row = RPE_TAB[rpe]
    step = row[8] - row[9]          # 9 次 → 10 次的递减量（约 0.023~0.032）
    v = row[9] - step * (reps - 10)
    return max(0.40, round(v, 3))    # 外推下限 40% 1RM

# ---------- 动作 → (所属三大项变量, 变式相对系数) ----------
# 系数取常见力量举变式相对主项的百分比（源表 RTS 备注里的惯例）
LIFT_MAP = [
    (r'比赛深蹲|^\s*深蹲\s*$', 'sq', 1.00),
    (r'比赛卧推|^\s*卧推\s*$', 'bp', 1.00),
    (r'比赛硬拉|^\s*硬拉\s*$', 'dl', 1.00),
    (r'高杠深蹲', 'sq', 0.92),
    (r'安全杆深蹲', 'sq', 0.85),
    (r'腰带深蹲', 'sq', 0.85),
    (r'定点深蹲|低位定点深蹲', 'sq', 0.82),
    (r'2秒暂停深蹲', 'sq', 0.80),
    (r'暂停深蹲', 'sq', 0.80),
    (r'前蹲|泽奇深蹲', 'sq', 0.78),
    (r'哈克深蹲|腿举|倒蹬', 'sq', 1.30),
    (r'保加利亚分腿蹲|前弓步|侧弓步|后弓步|安全杆后弓步', 'sq', 0.45),
    (r'窄距卧推|窄推', 'bp', 0.90),
    (r'宽距卧推', 'bp', 0.95),
    (r'触碰即走卧推|节奏卧推', 'bp', 0.95),
    (r'2秒暂停卧推|3秒暂停卧推', 'bp', 0.85),
    (r'无腿卧推', 'bp', 0.85),
    (r'弹弓卧推', 'bp', 1.10),
    (r'弹力带卧推|铁链卧推', 'bp', 0.90),
    (r'地板卧推|窄距地板卧推|木板卧推|层木板|定点卧推|定点上斜卧推', 'bp', 0.85),
    (r'上斜卧推|窄距上斜卧推|哑铃卧推|哑铃上斜卧推', 'bp', 0.75),
    (r'双杠臂屈伸', 'bp', 0.70),
    (r'哑铃飞鸟|平板飞鸟|绳索夹胸', 'bp', 0.30),
    (r'2秒暂停硬拉|节奏硬拉|暂停硬拉', 'dl', 0.85),
    (r'2寸赤字硬拉|赤字硬拉', 'dl', 0.85),
    (r'罗马尼亚硬拉|RDL|直腿硬拉|抓举式RDL', 'dl', 0.70),
    (r'铁链硬拉', 'dl', 0.85),
    (r'单腿硬拉', 'dl', 0.35),
    (r'早安式', 'dl', 0.45),
    (r'臀桥', 'dl', 0.90),
    (r'站姿推举|坐姿推举|定点推举|JM推举|对握站姿推举|哑铃肩部推举|阿诺德推举|推举', 'bp', 0.62),
    (r'潘德雷划船|杠铃划船|哑铃划船|胸部支撑划船|杠杆划船|梅多斯划船|自选划船动作', 'bp', 0.60),
    (r'双杠臂屈伸', 'bp', 0.70),
    (r'罗马尼亚硬拉|RDL|直腿硬拉|抓举式RDL', 'dl', 0.70),
    (r'引体向上|垂直拉|反向自重划船', 'bp', 0.00),
    (r'腹轮|平板支撑|侧平板支撑|提踵|弯举|三头|下拉|侧平举|俯身侧平举|侧身哑铃侧平举|上拉|地雷杠', 'bp', 0.00),
]
# 肩部/背部/手臂/核心 动作用体重或固定重量，不换算
BW_LIMIT = re.compile(r'引体向上|垂直拉|反向自重划船|腹轮|平板支撑|侧平板支撑|提踵|弯举|三头|下拉|侧平举|俯身侧平举|侧身哑铃侧平举|上拉|地雷杠')

def lift_of(name):
    for pat, var, coef in LIFT_MAP:
        if re.search(pat, name, re.I):
            return var, coef
    return None, None

# ---------- CATS RPE 公式（源表 cycle1-基础 R7 单元格，逐字还原） ----------
# S7 标准次数 = IF(P<=0.5,12, IF(<=0.55,10, IF(<=0.6,8, IF(<=0.65,7, IF(<=0.7,6,
#                IF(<=0.75,5, IF(<=0.8,5, IF(<=0.85,4, IF(<=0.9,3,2))))))))
# R7 = IF(MIN(10,MAX(3,ROUND((10-(ROUND(30*(1/P-1),0)-T7))+(S7-1)*0.3,0)))<=5,"-", 同上)
#   P=强度  T=组数  S=标准次数（注意：末项用标准次数，不是实际次数）
def cat_std(pct):
    if pct <= 0.50: return 12
    if pct <= 0.55: return 10
    if pct <= 0.60: return 8
    if pct <= 0.65: return 7
    if pct <= 0.70: return 6
    if pct <= 0.75: return 5
    if pct <= 0.80: return 5
    if pct <= 0.85: return 4
    if pct <= 0.90: return 3
    return 2

def cat_rpe(pct, nsets, reps):
    """pct=强度比例, nsets=组数(源表T), reps=次数(源表S)"""
    if not pct or not nsets or not reps: return None
    step = round(30 * (1 / pct - 1))          # Excel ROUND(...,0)
    x = (10 - (step - nsets)) + (reps - 1) * 0.3
    v = int(min(10, max(3, round(x))))        # Excel ROUND(x,0) + MIN/MAX
    if v <= 5: return None                    # 源表显示 "-"
    return v

# =================== 1) RTS 反推重量 ===================
RTS_IDS = ['rts7', 'rts8', 'rts12', 'rts16']
# RTS 输入：三大项 1RM
RTS_INPUTS = [
    {'k': 'sq', 'label': '深蹲 1RM', 'def': 170},
    {'k': 'bp', 'label': '卧推 1RM', 'def': 120},
    {'k': 'dl', 'label': '硬拉 1RM', 'def': 200},
]

RTS_RPE_RE = re.compile(r'@?\s*RPE\s*([\d.]+)', re.I)

def parse_rpe_reps(s):
    """从 d 字段解析 RPE 与次数"""
    d = str(s.get('d') or '')
    m = RTS_RPE_RE.search(d)
    if not m: return None, None
    try: rpe = float(m.group(1))
    except: return None, None
    reps = s.get('r')
    try: reps = int(float(str(reps).strip()))
    except: return None, None
    return rpe, reps

stat = {k: 0 for k in RTS_IDS}
miss = {k: [] for k in RTS_IDS}
for pid in RTS_IDS:
    p = T[pid]
    p['inputs'] = copy.deepcopy(RTS_INPUTS)
    p['calcNote'] = ('按 RTS 处方训练：每组给出目标 RPE 与建议重量（由你填写的三大项 1RM 结合 RPE×次数 换算表反推）。'
                     'RPE8 ≈ 留 2 次余力；实际训练请以当天状态微调 ±2.5kg。')
    for w in p['weeks']:
        for d in w['d']:
            for g in d['g']:
                var, coef = lift_of(g['n'])
                # 源表同一动作的 RPE 常合并单元格：首组写 RPE，后续组继承。
                # 组内先扫一遍确定「基准 RPE」（取第一个非 AMRAP 组的值）
                base_rpe = None
                for s in g['s']:
                    r_ = parse_rpe_reps(s)[0]
                    if r_ is not None:
                        base_rpe = r_; break
                carry = None
                for s in g['s']:
                    rpe, reps = parse_rpe_reps(s)
                    if rpe is not None:
                        carry = rpe
                    elif carry is not None:
                        rpe = carry
                    elif base_rpe is not None:
                        rpe = base_rpe
                    try: reps = int(float(str(s.get('r')).strip()))
                    except: reps = None
                    # 备注写了「1RM的XX%」→ 直接按百分比换算（优先于 RPE 反推）
                    nt = str(s.get('t') or '')
                    mp = re.search(r'1\s*RM\s*的\s*([\d.]+)\s*%', nt, re.I)
                    if mp and var and coef:
                        s['e'] = 'r25(%s*%.4f)' % (var, float(mp.group(1)) / 100 * coef)
                        if rpe is not None:
                            s['rpe'] = rpe
                        stat[pid] += 1
                        continue
                    if rpe is None or var is None or not coef:
                        if s.get('d') and str(s['d']) not in ('', 'AMRAP', '自选'):
                            miss[pid].append((g['n'], s.get('d'), s.get('r')))
                        continue
                    pct = rts_pct(rpe, reps)
                    if pct is None:
                        miss[pid].append((g['n'], s.get('d'), s.get('r')))
                        continue
                    s['e'] = 'r25(%s*%.4f)' % (var, pct * coef)
                    s['rpe'] = rpe
                    stat[pid] += 1
print('RTS 反推重量组数:', stat)
for k, v in miss.items():
    if v:
        print('  未换算', k, len(v), v[:6])

# =================== 2) CATS 补 RPE ===================
# 源表结构不一致：cycle1/2 有 RPE 列（R 列），cycle3/4 只有 次数(R)/组数(S)，无 RPE 列。
# 公式（cycle1/2 的 R7）：x = ROUND((10-(ROUND(30*(1/P-1),0)-T))+(S-1)*0.3, 0)
#   P=强度  T=组数  S=次数  若 x<=5 源表显示 "-"
CATS_IDS = ['cats_c1', 'cats_c2']          # cycle3/4 源表无 RPE 列，不补
cat_stat = {}
for pid in CATS_IDS:
    p = T[pid]; n = 0
    for w in p['weeks']:
        for d in w['d']:
            for g in d['g']:
                nsets = len(g['s'])
                # 该组块强度 = 算式中最小的比例因子
                pct = None; reps = None
                for s in g['s']:
                    ms = re.findall(r'\*\s*([0-9]*\.?[0-9]+)\s*\)', str(s.get('e') or ''))
                    if ms:
                        cand = [float(x) for x in ms if float(x) <= 1.0]
                        if cand:
                            pct = min(cand); break
                if pct is None: continue
                try:
                    raw = g['s'][0].get('r')
                    reps = int(float(str(raw).strip()))
                except:
                    continue
                v = cat_rpe(pct, nsets, reps)
                if v is not None:
                    for s in g['s']:
                        s['rpe'] = v
                    n += len(g['s'])
    cat_stat[pid] = n
print('CATS 补 RPE 组数:', cat_stat)

json.dump(T, open(BASE + '/plan_tables.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('saved')
