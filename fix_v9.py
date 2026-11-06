# -*- coding: utf-8 -*-
"""v9 数据修复（按组名对齐版）：
1. Russwole W4D1 深蹲 45组 → 4组
2. 古斯塔夫：整计划按源表重建（RPE 处方，无自动算式）
3. 腰王 base/adv：按组名对齐，逐组展开源表并重建算式/次数
4. RTS 系列：括号说明拆为 t（? 批注）
"""
import json, re

PATH = 'plan_tables.json'
T = json.load(open(PATH, encoding='utf-8'))
SRC = {p: json.load(open(f'tables/{p}.json', encoding='utf-8')) for p in ('gustav', 'yw', 'russwole')}
report = []

# ---------- 1. Russwole W4D1 ----------
d = T['russwole']['weeks'][3]['d'][0]
for g in d['g']:
    if g['n'] == '深蹲' and len(g['s']) > 4:
        old = len(g['s']); g['s'] = g['s'][:4]
        for s in g['s']: s['d'] = '4×7 @80%'
        report.append(f'russwole W4D1 深蹲: {old}组 → 4组 (4×7 @80%)')

# ---------- 2. 古斯塔夫：整计划重建 ----------
def expand_rep_desc(dtext):
    """'1*6 1*3-6' → [('6',None),('3-6',None)] 的次数列表；无 * 记号按 1 组"""
    toks = re.findall(r'(\d+)\*([\d\-]+)', dtext)
    if not toks: return ['']
    return [m for _, m in toks]

def split_rpes(wtext):
    if not wtext: return []
    return re.findall(r'RPE\s*[\d.\-]+', wtext)

gu = T['gustav']
nfix = 0
for wi, w in enumerate(gu['weeks']):
    srcw = SRC['gustav']['weeks'][wi]
    newdays = []
    for di, srcday in enumerate(srcw['days']):
        groups = []
        for row in srcday['rows']:
            sets = []
            for sset in row['sets']:
                dtxt = sset.get('d', '') or ''
                reps_list = expand_rep_desc(dtxt)
                rpes = split_rpes(sset.get('w'))
                for i, reps in enumerate(reps_list):
                    st = {'d': dtxt, 'r': reps, 'e': None,
                          't': (rpes[i] if i < len(rpes) else (sset.get('w') if i == 0 else None)),
                          'n': None}
                    sets.append(st)
            groups.append({'n': row['n'], 's': sets})
        # 保留原 day 的名字（当前命名更干净）
        oldname = w['d'][di]['n'] if di < len(w['d']) else srcday['name']
        newdays.append({'n': oldname, 'g': groups})
    w['d'] = newdays
    nfix += sum(len(g['s']) for day in w['d'] for g in day['g'])
gu['inputs'] = []
gu['calcNote'] = '古斯塔夫为纯 RPE 处方计划：只规定「组次 + 目标 RPE」，重量由当天状态按 RPE 自定（RPE7 ≈ 留 3 次余力），不自动换算。'
report.append(f'gustav: 按源表整计划重建，共 {nfix} 组（处方原文 + RPE 批注，无算式）')

# ---------- 3. 腰王 ----------
def expand_cn(dtext):
    """'3组×5次 @RPE7' → 3 份；'1组×3次 @RPE5' → 1 份"""
    m = re.match(r'^(\d+)组×(\d+)次', dtext.strip())
    if m: return int(m.group(1)), m.group(2)
    m2 = re.match(r'^1组×(\d+)次', dtext.strip())
    if m2: return 1, m2.group(1)
    return 1, ''

def rebuild_yw(pid, sl):
    p = T[pid]; fixed = 0; bad = 0
    for wi, w in enumerate(p['weeks']):
        srcw = SRC['yw']['weeks'][sl][wi]
        for di, srcday in enumerate(srcw['days']):
            day = w['d'][di]
            if len(day['g']) != len(srcday['rows']):
                report.append(f'!! {pid} {w["n"]}/{day["n"]} 组数不匹配(现{len(day["g"])} vs 源{len(srcday["rows"])})'); bad += 1; continue
            for g, row in zip(day['g'], srcday['rows']):
                # 展开源表
                src_sets = []
                for sset in row['sets']:
                    n, reps = expand_cn(sset.get('d', ''))
                    for i in range(n):
                        suffix = f'（第{i+1}组）' if n > 1 else ''
                        src_sets.append({'d': (sset.get('d', '').replace('×', '×', 1) + suffix) if suffix else sset.get('d', ''),
                                         'r': reps, 'w': sset.get('w')})
                if len(src_sets) != len(g['s']):
                    report.append(f'!! {pid} {w["n"]}/{day["n"]}/{g["n"]}: 现{len(g["s"])} vs 源展开{len(src_sets)}，跳过'); bad += 1; continue
                for s, ss in zip(g['s'], src_sets):
                    if ss['w'] and 'Math.round' in ss['w']:
                        s['e'] = ss['w']
                    s['r'] = ss['r'] if ss['r'] else s['r']
                fixed += len(g['s'])
    return fixed, bad

f1, b1 = rebuild_yw('yw_base', slice(0, 6))
f2, b2 = rebuild_yw('yw_adv', slice(18, 24))
report.append(f'yw_base: 重建 {f1} 组算式（异常 {b1}）')
report.append(f'yw_adv: 重建 {f2} 组算式（异常 {b2}）')

# ---------- 4. RTS 备注拆分 ----------
nfix = 0
for pid in ('rts7', 'rts8', 'rts12', 'rts16'):
    for w in T[pid]['weeks']:
        for dd in w['d']:
            for g in dd['g']:
                for s in g['s']:
                    dd_ = str(s.get('d') or '')
                    m = re.match(r'^(.*?)（(.+?)）\s*$', dd_)
                    if m:
                        s['d'] = m.group(1).strip()
                        s['t'] = m.group(2).strip(); s['tn'] = 1; nfix += 1
                    elif s.get('t') and s['d'] != s['t']:
                        s['tn'] = 1; nfix += 1
report.append(f'rts 系列: {nfix} 组备注 → ? 批注')

json.dump(T, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False)
print('\n'.join(report))
