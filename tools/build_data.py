#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据构建脚本：扫描 data/weekly_*.csv 与 data/actions_log.csv，
按达人累计合并（不分周期），生成 assets/data.js。看板页面无需改动，刷新即可。

用法：
    python tools/build_data.py

说明：
    - 多个 CSV 会按达人求和合并，请保证各文件的统计周期互不重叠；
      更简单的做法是直接放一份「全部时间」的最新导出。
    - week_start 列仅用于记录，看板不按周期展示。

CSV 字段（与 TikTok Shop Affiliate 导出对应）：
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
SUM_FIELDS = [
    'gmv', 'liveGmv', 'videoGmv', 'refund', 'orders', 'lives', 'videos',
    'samples', 'impressions', 'views', 'customers', 'commission'
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
    weekly_files = sorted(
        f for f in os.listdir(DATA_DIR)
        if f.startswith('weekly_') and f.endswith('.csv')
    )
    if not weekly_files:
        print('未找到 data/weekly_*.csv，请先按 data/templates/weekly_template.csv 准备数据')
        sys.exit(1)

    creators = {}
    n_rows = 0
    periods = set()
    for fname in weekly_files:
        with open(os.path.join(DATA_DIR, fname), encoding='utf-8-sig') as fp:
            for r in csv.DictReader(fp):
                if not r.get('name'):
                    continue
                n_rows += 1
                if r.get('week_start'):
                    periods.add(r['week_start'].strip())
                name = r['name'].strip()
                c = creators.setdefault(
                    name, {'name': name, 'clicks': 0.0, **{f: 0.0 for f in SUM_FIELDS}})
                imps = to_float(r.get('impressions'))
                ctr = to_float(r.get('ctr'))
                c['clicks'] += imps * ctr / 100.0
                for f in SUM_FIELDS:
                    c[f] += to_float(r.get(f))

    rows = list(creators.values())

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
        'note': '全周期累计视图：%d 个原始周期已按达人合并（%d 行原始记录），由 tools/build_data.py 生成'
                % (len(periods), n_rows),
        'rows': rows,
        'actions': actions
    }
    with open(OUT, 'w', encoding='utf-8') as fp:
        fp.write('// 本文件由 tools/build_data.py 自动生成，请勿手动编辑\n')
        fp.write('window.DASHBOARD_DATA = ')
        json.dump(payload, fp, ensure_ascii=False, separators=(',', ':'))
        fp.write(';\n')
    print('OK 达人 %d 位（原始 %d 行，%d 个周期），动作 %d 条 -> %s'
          % (len(rows), n_rows, len(periods), len(actions), OUT))


if __name__ == '__main__':
    main()
