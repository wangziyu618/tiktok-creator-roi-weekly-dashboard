#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每周数据构建脚本：扫描 data/weekly_*.csv（可追加的周度导出）与 data/actions_log.csv，
重新生成 assets/data.js。看板页面无需改动，刷新即可。

用法：
    python tools/build_data.py

周度 CSV 字段（与 TikTok Shop Affiliate 导出对应，追加 week_start 列）：
    week_start, name, gmv, liveGmv, videoGmv, refund, orders, items, itemsRefunded,
    aov, showcaseGmv, ctor, lives, videos, sampleContent, samples, showcaseAdded,
    ctr, impressions, views, customers, productsSold, commission, flatFee

actions_log.csv 字段：
    date, creator, type, note
"""
import csv
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, 'data')
OUT = os.path.join(BASE, 'assets', 'data.js')

NUM_FIELDS = [
    'gmv', 'liveGmv', 'videoGmv', 'refund', 'orders', 'items', 'itemsRefunded',
    'aov', 'showcaseGmv', 'ctor', 'lives', 'videos', 'sampleContent', 'samples',
    'showcaseAdded', 'ctr', 'impressions', 'views', 'customers', 'productsSold',
    'commission', 'flatFee'
]


def to_float(x):
    if x is None:
        return 0.0
    s = str(x).replace('$', '').replace(',', '').replace('%', '').strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def main():
    rows = []
    weekly_files = sorted(
        f for f in os.listdir(DATA_DIR)
        if f.startswith('weekly_') and f.endswith('.csv')
    )
    if not weekly_files:
        print('未找到 data/weekly_*.csv，请先按 data/templates/weekly_template.csv 准备数据')
        sys.exit(1)

    for fname in weekly_files:
        with open(os.path.join(DATA_DIR, fname), encoding='utf-8-sig') as fp:
            for r in csv.DictReader(fp):
                if not r.get('name') or not r.get('week_start'):
                    continue
                row = {'week': r['week_start'].strip(), 'name': r['name'].strip()}
                for f in NUM_FIELDS:
                    row[f] = to_float(r.get(f))
                rows.append(row)

    weeks = sorted({r['week'] for r in rows})

    actions = []
    actions_path = os.path.join(DATA_DIR, 'actions_log.csv')
    if os.path.exists(actions_path):
        with open(actions_path, encoding='utf-8-sig') as fp:
            for r in csv.DictReader(fp):
                if r.get('date') and r.get('creator'):
                    actions.append({
                        'date': r['date'].strip(),
                        'creator': r['creator'].strip(),
                        'type': (r.get('type') or '').strip(),
                        'note': (r.get('note') or '').strip()
                    })

    payload = {
        'weeks': weeks,
        'note': '数据周 %s ～ %s，由 tools/build_data.py 生成' % (weeks[0], weeks[-1]),
        'rows': rows,
        'actions': actions
    }
    with open(OUT, 'w', encoding='utf-8') as fp:
        fp.write('// 本文件由 tools/build_data.py 自动生成，请勿手动编辑\n')
        fp.write('window.DASHBOARD_DATA = ')
        json.dump(payload, fp, ensure_ascii=False, separators=(',', ':'))
        fp.write(';\n')
    print('OK 周数 %d，达人记录 %d 行，动作 %d 条 -> %s' % (len(weeks), len(rows), len(actions), OUT))


if __name__ == '__main__':
    main()
