# TikTok 达人 ROI 运营看板

纯佣（无坑位费）模式下的 TikTok Shop 宠物垂类达人运营看板：零依赖单页 Dashboard，支持**周度切换、单周/全周期、环比对比、达人五层分层、ROI 多维拆解与运营动作追踪**，用于周度周报与全周期复盘。

## 快速开始

直接用浏览器打开 `dashboard.html` 即可（无需本地服务器，数据通过 `<script>` 引入）。

仓库内置了基于真实导出快照（1,068 位达人）生成的示例数据周 `2026-10-05`，开箱即可看到完整效果。

## 看板模块

| 模块 | 内容 | 回答的问题 |
|---|---|---|
| 一 · 核心指标概览 | 8 张 KPI 卡（含环比）＋ GMV×ROI 周趋势 ＋ 转化漏斗 | 本周怎么样、比上周好不好 |
| 二 · 达人分层诊断 | 价值×活跃四象限散点、层级结构、Top2 头部依赖预警、达人明细表 | 资源该花在谁身上 |
| 三 · ROI 多维拆解 | 流量漏斗（曝光→点击→下单）、分层 ROI、内容形式 GMV 构成、佣金–GMV 散点 | 高 ROI 来自哪里 |
| 四 · 策略与效果追踪 | 周趋势 × 动作标注、动作响应率记分卡、动作清单 | 运营动作有没有用 |

**达人分层规则**（阈值可在 `assets/dashboard.js` 的 `tierOf` 中调整）：

- `S` 头部支柱：累计 GMV ≥ $50 → 1v1 维护、阶梯佣金
- `A` 高潜成长：已出单未达 S → 加码寄样、复投激励
- `B` 活跃未出单：已投稿未出单 → 优化选品与话术
- `C` 发样未投稿：发样 > 0 且未投稿 → 催稿 / 停样回收
- `D` 建联储备：未发样 → 按粉丝量与垂类排序筛选

## 每周更新 SOP（约 15 分钟）

1. 每周一在 TikTok Seller Center 导出「过去 7 天」达人数据；
2. 参照 `data/templates/weekly_template.csv` 整理为 `data/weekly_YYYYMMDD.csv`（`week_start` 填上周一日期），直接追加新文件即可，旧文件保留；
3. 随手在 `data/actions_log.csv` 记录运营动作（模板见 `data/templates/actions_template.csv`）；
4. 运行 `python tools/build_data.py` 重新生成 `assets/data.js`；
5. 刷新 `dashboard.html` —— 周筛选器、环比、分层、动作追踪全部自动更新。

## 目录结构

```
├── dashboard.html          # 看板入口（直接打开）
├── assets/
│   ├── dashboard.js        # 看板逻辑（筛选、聚合、图表）
│   └── data.js             # 数据文件（由 tools/build_data.py 生成）
├── _shared/js/echarts.min.js
├── data/
│   ├── weekly_*.csv        # 周度达人数据（可追加）
│   ├── actions_log.csv     # 运营动作记录（可选）
│   └── templates/          # 两个 CSV 模板
├── tools/build_data.py     # 数据构建脚本
└── docs/design/            # 完整设计方案报告（Tableau 版思路同样适用）
```

## 指标口径

- **ROI** = Creator-attributed GMV ÷ Est. commission（纯佣模式佣金即唯一结算成本）
- **CTR / CTOR** 按曝光与点击加权汇总，非简单平均
- 环比仅在「单周」视图且存在上一数据周时显示
- 分层、漏斗、ROI 拆解均随顶部「数据周 / 单周-累计 / 层级」筛选联动

## 技术栈

原生 HTML/CSS/JS + 本地化 ECharts，无任何外部依赖与构建步骤，可离线使用，适合直接部署到 GitHub Pages。
