/* TikTok 达人 ROI 运营看板 — 主逻辑
   数据：window.DASHBOARD_DATA = { weeks, note, rows, actions? }
   rows 粒度：达人 × 数据周；actions 粒度：达人 × 动作（可选） */
(function () {
  'use strict';

  var D = window.DASHBOARD_DATA || { weeks: [], rows: [], note: '' };
  var ACTIONS = D.actions || [];

  var COLOR = {
    S: '#12B886', A: '#228BE6', B: '#7950F2', C: '#E64980', D: '#C9CFCD',
    ink: '#1D1D1F', muted: '#86868B', grid: 'rgba(29,29,31,0.10)',
    accent: '#0CA678', down: '#E03131'
  };
  var TIER_NAME = {
    S: 'S 头部支柱', A: 'A 高潜成长', B: 'B 活跃未出单',
    C: 'C 发样未投稿', D: 'D 建联储备'
  };
  var TIER_ACTION = {
    S: '1v1 维护，优先寄样，阶梯佣金',
    A: '加码寄样 + 复投激励，冲刺第二单',
    B: '优化选品与挂车话术，发爆款模板',
    C: '催稿两轮，无响应停样回收',
    D: '按粉丝量/垂类排序，筛选寄样对象'
  };

  var state = { week: null, range: 'week', tier: '' };
  var charts = {};

  /* ---------- 工具 ---------- */
  function fmtMoney(v) { return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function fmtPct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  function $(id) { return document.getElementById(id); }

  function weeksInScope() {
    var sorted = D.weeks.slice().sort();
    if (state.range === 'week') return [state.week];
    return sorted.filter(function (w) { return w <= state.week; });
  }

  /* 按达人聚合所选范围内的指标 */
  function aggregate(weeks) {
    var map = {};
    D.rows.forEach(function (r) {
      if (weeks.indexOf(r.week) === -1) return;
      var c = map[r.name];
      if (!c) {
        c = map[r.name] = {
          name: r.name, gmv: 0, liveGmv: 0, videoGmv: 0, showcaseGmv: 0,
          refund: 0, orders: 0, itemsRefunded: 0, lives: 0, videos: 0,
          samples: 0, impressions: 0, clicks: 0, customers: 0,
          commission: 0, views: 0
        };
      }
      c.gmv += r.gmv; c.liveGmv += r.liveGmv; c.videoGmv += r.videoGmv;
      c.showcaseGmv += r.showcaseGmv; c.refund += r.refund; c.orders += r.orders;
      c.itemsRefunded += r.itemsRefunded; c.lives += r.lives; c.videos += r.videos;
      c.samples += r.samples; c.impressions += r.impressions;
      c.clicks += r.impressions * (r.ctr / 100);
      c.customers += r.customers; c.commission += r.commission; c.views += r.views;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function tierOf(c) {
    if (c.gmv >= 50) return 'S';
    if (c.gmv > 0) return 'A';
    if (c.videos > 0) return 'B';
    if (c.samples > 0) return 'C';
    return 'D';
  }

  function sumBy(list, key) {
    return list.reduce(function (a, c) { return a + c[key]; }, 0);
  }

  /* ---------- 图表挂载 ---------- */
  function mount(id, option) {
    var el = $(id);
    if (!el) return null;
    if (typeof echarts === 'undefined') {
      el.innerHTML = '<div class="empty">图表库加载失败，请确认 _shared/js/echarts.min.js 存在</div>';
      return null;
    }
    var inst = charts[id];
    if (!inst) {
      inst = echarts.init(el, null, { renderer: 'svg' });
      charts[id] = inst;
    }
    inst.setOption(option, true);
    return inst;
  }

  function baseTooltip(extra) {
    return Object.assign({
      appendToBody: true,
      backgroundColor: '#FFFFFF',
      borderColor: COLOR.grid,
      textStyle: { color: COLOR.ink, fontSize: 12 }
    }, extra || {});
  }

  function axisStyle() {
    return {
      axisLabel: { color: COLOR.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: COLOR.grid } },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: COLOR.grid, width: 1 } }
    };
  }

  function funnelOption(data, conv) {
    return {
      animation: false,
      tooltip: baseTooltip({
        trigger: 'item',
        formatter: function (p) {
          return '<b>' + p.name + '</b><br/>' + p.value.toLocaleString() +
            (conv && conv[p.dataIndex] ? '<br/>' + conv[p.dataIndex] : '');
        }
      }),
      series: [{
        type: 'funnel', left: '26%', width: '46%', top: 8, bottom: 8,
        sort: 'descending', gap: 3, minSize: '6%',
        label: {
          position: 'left', color: COLOR.ink, fontSize: 12, fontWeight: 600,
          formatter: function (p) { return p.name + '  ' + p.value.toLocaleString(); }
        },
        labelLine: { length: 10, lineStyle: { color: COLOR.grid } },
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        data: data.map(function (d, i) {
          return { name: d.name, value: d.value,
            itemStyle: { color: COLOR.S, opacity: [1, 0.8, 0.6, 0.42][i] || 0.42 } };
        })
      }]
    };
  }

  /* ---------- KPI ---------- */
  function kpiDelta(cur, prev, isRatio) {
    if (prev == null) return '<span>— 无上周数据</span>';
    if (isRatio) {
      var d = cur - prev;
      if (Math.abs(d) < 1e-9) return '<span>持平</span>';
      var cls = d > 0 ? 'up' : 'down';
      return '<span class="' + cls + '">' + (d > 0 ? '▲' : '▼') + ' ' +
        Math.abs(d).toFixed(2) + '</span> vs 上周';
    }
    if (prev === 0) return '<span>— 上周为 0</span>';
    var p = (cur - prev) / prev;
    if (Math.abs(p) < 1e-9) return '<span>持平</span>';
    var cls2 = p > 0 ? 'up' : 'down';
    return '<span class="' + cls2 + '">' + (p > 0 ? '▲' : '▼') + ' ' +
      fmtPct(Math.abs(p)) + '</span> vs 上周';
  }

  function renderKPI(cur, prev) {
    var gmv = sumBy(cur, 'gmv'), comm = sumBy(cur, 'commission');
    var orders = sumBy(cur, 'orders'), refund = sumBy(cur, 'refund');
    var roi = comm > 0 ? gmv / comm : null;
    var billed = cur.filter(function (c) { return c.gmv > 0; }).length;
    var content = sumBy(cur, 'videos') + sumBy(cur, 'lives');
    var aov = orders > 0 ? gmv / orders : 0;
    var refundRate = gmv > 0 ? refund / gmv : 0;

    var pGmv = prev ? sumBy(prev, 'gmv') : null;
    var pComm = prev ? sumBy(prev, 'commission') : null;
    var pOrders = prev ? sumBy(prev, 'orders') : null;
    var pRoi = prev && pComm > 0 ? pGmv / pComm : null;
    var pBilled = prev ? prev.filter(function (c) { return c.gmv > 0; }).length : null;
    var pContent = prev ? sumBy(prev, 'videos') + sumBy(prev, 'lives') : null;
    var pAov = prev && pOrders > 0 ? pGmv / pOrders : null;
    var pRefundRate = prev && pGmv > 0 ? sumBy(prev, 'refund') / pGmv : null;

    /* 新增出单：数据集中首次出单周 = 当前周 */
    var firstBilledWeek = {};
    D.weeks.slice().sort().forEach(function (w) {
      aggregate([w]).forEach(function (c) {
        if (c.gmv > 0 && !firstBilledWeek[c.name]) firstBilledWeek[c.name] = w;
      });
    });
    var newBilled = cur.filter(function (c) {
      return c.gmv > 0 && firstBilledWeek[c.name] === state.week;
    }).length;

    var cards = [
      { label: 'GMV', value: fmtMoney(gmv), delta: kpiDelta(gmv, pGmv) },
      { label: 'ROI（GMV ÷ 佣金）', value: roi == null ? '—' : roi.toFixed(1),
        delta: roi == null ? '<span>—</span>' : kpiDelta(roi, pRoi, true) },
      { label: '出单达人', value: billed + ' 人', delta: kpiDelta(billed, pBilled) },
      { label: '新增出单达人', value: newBilled + ' 人',
        delta: '<span>本周首次出单</span>' },
      { label: '结算佣金 / 佣金率', value: fmtMoney(comm),
        delta: '<span>佣金率 ' + (gmv > 0 ? fmtPct(comm / gmv) : '—') + '</span>' },
      { label: '内容产出', value: content.toLocaleString(),
        delta: kpiDelta(content, pContent) },
      { label: '订单 / AOV', value: orders.toLocaleString() + ' 单',
        delta: '<span>AOV ' + fmtMoney(aov) + '</span>' },
      { label: '退款率', value: fmtPct(refundRate),
        delta: pRefundRate == null ? '<span>— 无上周数据</span>'
          : kpiDelta(refundRate, pRefundRate, true) }
    ];

    $('kpi-grid').innerHTML = cards.map(function (c) {
      return '<div class="kpi"><div class="k-label">' + c.label + '</div>' +
        '<div class="k-value">' + c.value + '</div>' +
        '<div class="k-delta">' + c.delta + '</div></div>';
    }).join('');
  }

  /* ---------- 各图表 ---------- */
  function renderTrend() {
    var weeks = D.weeks.slice().sort();
    var gmvByW = [], roiByW = [];
    weeks.forEach(function (w) {
      var list = aggregate([w]);
      var g = sumBy(list, 'gmv'), c = sumBy(list, 'commission');
      gmvByW.push(+g.toFixed(2));
      roiByW.push(c > 0 ? +(g / c).toFixed(2) : null);
    });
    mount('c-trend', {
      animation: false,
      tooltip: baseTooltip({ trigger: 'axis' }),
      legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9,
        textStyle: { color: COLOR.muted, fontSize: 12 }, data: ['GMV', 'ROI'] },
      grid: { left: 56, right: 48, top: 24, bottom: 52 },
      xAxis: Object.assign(axisStyle(), { type: 'category', data: weeks,
        splitLine: { show: false } }),
      yAxis: [
        Object.assign(axisStyle(), { type: 'value', name: 'GMV($)',
          nameTextStyle: { color: COLOR.muted, fontSize: 11 } }),
        Object.assign(axisStyle(), { type: 'value', name: 'ROI',
          nameTextStyle: { color: COLOR.muted, fontSize: 11 },
          splitLine: { show: false } })
      ],
      series: [
        { name: 'GMV', type: 'bar', data: gmvByW, barWidth: '42%',
          itemStyle: { color: COLOR.S, borderRadius: [4, 4, 0, 0] } },
        { name: 'ROI', type: 'line', yAxisIndex: 1, data: roiByW,
          symbol: 'circle', symbolSize: 6,
          lineStyle: { color: COLOR.A, width: 2 }, itemStyle: { color: COLOR.A },
          markLine: { silent: true, symbol: 'none',
            lineStyle: { color: COLOR.muted, type: 'dashed' },
            label: { color: COLOR.muted, fontSize: 10, formatter: '目标 8' },
            data: [{ yAxis: 8 }] } }
      ]
    });
  }

  function renderMiniFunnel(cur) {
    var data = [
      { name: '建联', value: cur.length },
      { name: '发样', value: cur.filter(function (c) { return c.samples > 0; }).length },
      { name: '投稿', value: cur.filter(function (c) { return c.videos > 0; }).length },
      { name: '出单', value: cur.filter(function (c) { return c.gmv > 0; }).length }
    ];
    mount('c-funnel-mini', funnelOption(data));
  }

  function renderScatter(cur) {
    var tiers = ['S', 'A', 'B', 'C', 'D'];
    var series = tiers.map(function (t) {
      return {
        name: TIER_NAME[t], type: 'scatter',
        data: cur.filter(function (c) { return tierOf(c) === t; }).map(function (c) {
          return {
            value: [c.videos + c.lives, +c.gmv.toFixed(2)],
            name: c.name,
            symbolSize: Math.max(4, Math.min(18, 4 + Math.sqrt(c.commission) * 4)),
            raw: c
          };
        }),
        itemStyle: { color: COLOR[t], opacity: 0.85 }
      };
    });
    mount('c-scatter', {
      animation: false,
      tooltip: baseTooltip({
        formatter: function (p) {
          var c = p.data.raw;
          return '<b>' + c.name + '</b>（' + TIER_NAME[tierOf(c)] + '）<br/>GMV：$' +
            c.gmv.toFixed(2) + '｜佣金：$' + c.commission.toFixed(2) +
            '<br/>视频 ' + c.videos + '｜直播 ' + c.lives + '｜发样 ' + c.samples +
            '<br/>曝光 ' + c.impressions.toLocaleString();
        }
      }),
      legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9,
        textStyle: { color: COLOR.muted, fontSize: 11 } },
      grid: { left: 52, right: 24, top: 24, bottom: 56 },
      xAxis: Object.assign(axisStyle(), { type: 'value', name: '内容产出（视频+直播）',
        nameLocation: 'middle', nameGap: 26, minInterval: 1,
        nameTextStyle: { color: COLOR.muted, fontSize: 11 },
        splitLine: { show: false } }),
      yAxis: Object.assign(axisStyle(), { type: 'value', name: 'GMV($)',
        nameTextStyle: { color: COLOR.muted, fontSize: 11 } }),
      series: series
    });
  }

  function renderTierShare(cur) {
    var tiers = ['S', 'A', 'B', 'C', 'D'];
    var counts = tiers.map(function (t) {
      return cur.filter(function (c) { return tierOf(c) === t; }).length;
    });
    var gmvSorted = cur.map(function (c) { return c.gmv; }).sort(function (a, b) { return b - a; });
    var total = gmvSorted.reduce(function (a, b) { return a + b; }, 0);
    var top2 = total > 0 ? (gmvSorted[0] + gmvSorted[1]) / total : 0;

    var rowsHtml = tiers.map(function (t, i) {
      return '<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;margin:5px 0;">' +
        '<span style="width:10px;height:10px;border-radius:3px;background:' + COLOR[t] + ';"></span>' +
        '<span style="flex:1;">' + TIER_NAME[t] + '</span>' +
        '<b>' + counts[i].toLocaleString() + '</b> 人</div>';
    }).join('');
    var warnCls = top2 > 0.6 ? 'warn' : 'ok';
    var warnTxt = total === 0 ? '暂无 GMV'
      : 'Top2 达人 GMV 占比 ' + fmtPct(top2) + (top2 > 0.6 ? '（头部依赖预警）' : '');
    $('tier-summary').innerHTML = rowsHtml +
      '<div style="margin-top:10px;" class="' + warnCls + '">' + warnTxt + '</div>';

    mount('c-tier-share', {
      animation: false,
      tooltip: baseTooltip({ trigger: 'axis',
        axisPointer: { type: 'shadow' } }),
      grid: { left: 40, right: 16, top: 16, bottom: 28 },
      xAxis: Object.assign(axisStyle(), { type: 'category', data: tiers,
        splitLine: { show: false } }),
      yAxis: Object.assign(axisStyle(), { type: 'value' }),
      series: [{
        type: 'bar', data: counts.map(function (v, i) {
          return { value: v, itemStyle: { color: COLOR[tiers[i]], borderRadius: [4, 4, 0, 0] } };
        }),
        barWidth: '52%'
      }]
    });
  }

  function renderTable(cur) {
    var list = cur.slice().sort(function (a, b) { return b.gmv - a.gmv; }).slice(0, 30);
    var head = '<thead><tr><th>达人</th><th>层级</th><th class="num">GMV</th>' +
      '<th class="num">佣金</th><th class="num">ROI</th><th class="num">视频</th>' +
      '<th class="num">直播</th><th class="num">发样</th><th class="num">曝光</th>' +
      '<th>建议动作</th></tr></thead>';
    var body = list.map(function (c) {
      var t = tierOf(c);
      var roi = c.commission > 0 ? (c.gmv / c.commission).toFixed(1) : '—';
      return '<tr><td>' + c.name + '</td>' +
        '<td><span class="tier-tag" style="background:' + COLOR[t] + ';">' + t + '</span></td>' +
        '<td class="num">$' + c.gmv.toFixed(2) + '</td>' +
        '<td class="num">$' + c.commission.toFixed(2) + '</td>' +
        '<td class="num">' + roi + '</td>' +
        '<td class="num">' + c.videos + '</td>' +
        '<td class="num">' + c.lives + '</td>' +
        '<td class="num">' + c.samples + '</td>' +
        '<td class="num">' + c.impressions.toLocaleString() + '</td>' +
        '<td style="white-space:normal;min-width:180px;">' + TIER_ACTION[t] + '</td></tr>';
    }).join('');
    $('creator-table').innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  function renderTrafficFunnel(cur) {
    var imps = sumBy(cur, 'impressions');
    var clicks = sumBy(cur, 'clicks');
    var orders = sumBy(cur, 'orders');
    var data = [
      { name: '曝光', value: Math.round(imps) },
      { name: '点击', value: Math.round(clicks) },
      { name: '下单', value: orders }
    ];
    var conv = ['100%',
      'CTR ' + (imps > 0 ? fmtPct(clicks / imps, 2) : '—'),
      'CTOR ' + (clicks > 0 ? fmtPct(orders / clicks, 2) : '—')];
    mount('c-funnel-traffic', funnelOption(data, conv));
  }

  function renderRoiTier(cur) {
    var tiers = ['S', 'A', 'B', 'C', 'D'];
    var bars = [], labels = [];
    tiers.forEach(function (t) {
      var list = cur.filter(function (c) { return tierOf(c) === t; });
      var g = sumBy(list, 'gmv'), cm = sumBy(list, 'commission');
      if (cm > 0) {
        bars.push({ value: +(g / cm).toFixed(2),
          itemStyle: { color: COLOR[t], borderRadius: [4, 4, 0, 0] },
          gmv: g });
        labels.push(TIER_NAME[t]);
      }
    });
    var el = $('c-roi-tier');
    if (!bars.length) { el.innerHTML = '<div class="empty">当前范围内暂无结算佣金数据</div>'; return; }
    mount('c-roi-tier', {
      animation: false,
      tooltip: baseTooltip({ trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var p = ps[0];
          return '<b>' + p.name + '</b><br/>ROI：' + p.value +
            '<br/>GMV：$' + p.data.gmv.toFixed(2);
        } }),
      grid: { left: 48, right: 24, top: 24, bottom: 32 },
      xAxis: Object.assign(axisStyle(), { type: 'category', data: labels,
        splitLine: { show: false }, axisLabel: { color: COLOR.muted, fontSize: 11, interval: 0 } }),
      yAxis: Object.assign(axisStyle(), { type: 'value', name: 'ROI',
        nameTextStyle: { color: COLOR.muted, fontSize: 11 } }),
      series: [{ type: 'bar', data: bars, barWidth: '44%',
        markLine: { silent: true, symbol: 'none',
          lineStyle: { color: COLOR.muted, type: 'dashed' },
          label: { color: COLOR.muted, fontSize: 10, formatter: '目标 8' },
          data: [{ yAxis: 8 }] } }]
    });
  }

  function renderFormGmv(cur) {
    var video = sumBy(cur, 'videoGmv'), live = sumBy(cur, 'liveGmv'),
      showcase = sumBy(cur, 'showcaseGmv');
    var other = Math.max(0, sumBy(cur, 'gmv') - video - live - showcase);
    mount('c-form-gmv', {
      animation: false,
      tooltip: baseTooltip({ trigger: 'axis', axisPointer: { type: 'shadow' },
        valueFormatter: function (v) { return '$' + v.toFixed(2); } }),
      grid: { left: 72, right: 24, top: 16, bottom: 28 },
      xAxis: Object.assign(axisStyle(), { type: 'value' }),
      yAxis: Object.assign(axisStyle(), { type: 'category',
        data: ['视频', '直播', '橱窗', '其他/未归属'], splitLine: { show: false } }),
      series: [{
        type: 'bar', barWidth: '52%',
        data: [
          { value: +video.toFixed(2), itemStyle: { color: COLOR.S, borderRadius: [0, 4, 4, 0] } },
          { value: +live.toFixed(2), itemStyle: { color: COLOR.A, borderRadius: [0, 4, 4, 0] } },
          { value: +showcase.toFixed(2), itemStyle: { color: COLOR.B, borderRadius: [0, 4, 4, 0] } },
          { value: +other.toFixed(2), itemStyle: { color: COLOR.D, borderRadius: [0, 4, 4, 0] } }
        ]
      }]
    });
  }

  function renderRoiScatter(cur) {
    var pts = cur.filter(function (c) { return c.commission > 0 || c.gmv > 0; })
      .map(function (c) {
        return { value: [+c.commission.toFixed(2), +c.gmv.toFixed(2)], name: c.name, raw: c };
      });
    var maxX = Math.max.apply(null, pts.map(function (p) { return p.value[0]; }).concat([1]));
    mount('c-roi-scatter', {
      animation: false,
      tooltip: baseTooltip({
        formatter: function (p) {
          var c = p.data.raw;
          var roi = c.commission > 0 ? (c.gmv / c.commission).toFixed(1) : '—';
          return '<b>' + c.name + '</b><br/>佣金：$' + c.commission.toFixed(2) +
            '｜GMV：$' + c.gmv.toFixed(2) + '<br/>ROI：' + roi;
        }
      }),
      grid: { left: 52, right: 24, top: 24, bottom: 44 },
      xAxis: Object.assign(axisStyle(), { type: 'value', name: '佣金($)',
        nameLocation: 'middle', nameGap: 26,
        nameTextStyle: { color: COLOR.muted, fontSize: 11 },
        splitLine: { show: false } }),
      yAxis: Object.assign(axisStyle(), { type: 'value', name: 'GMV($)',
        nameTextStyle: { color: COLOR.muted, fontSize: 11 } }),
      series: [{
        type: 'scatter', data: pts,
        symbolSize: function (v, p) {
          return Math.max(5, Math.min(16, 5 + Math.sqrt(p.data.raw.gmv)));
        },
        itemStyle: { color: COLOR.accent, opacity: 0.8 },
        markLine: { silent: true, symbol: 'none',
          lineStyle: { color: COLOR.down, type: 'dashed' },
          label: { color: COLOR.down, fontSize: 10, formatter: 'ROI=8' },
          data: [[{ coord: [0, 0] }, { coord: [maxX, maxX * 8] }]] }
      }]
    });
  }

  function renderActionTrend() {
    var weeks = D.weeks.slice().sort();
    var billedByW = weeks.map(function (w) {
      return aggregate([w]).filter(function (c) { return c.gmv > 0; }).length;
    });
    var marks = ACTIONS.map(function (a) {
      return { xAxis: a.date, label: { formatter: a.type } };
    });
    mount('c-action-trend', {
      animation: false,
      tooltip: baseTooltip({ trigger: 'axis' }),
      grid: { left: 48, right: 24, top: 24, bottom: 32 },
      xAxis: Object.assign(axisStyle(), { type: 'category', data: weeks,
        splitLine: { show: false } }),
      yAxis: Object.assign(axisStyle(), { type: 'value', minInterval: 1,
        name: '出单达人数', nameTextStyle: { color: COLOR.muted, fontSize: 11 } }),
      series: [{
        type: 'line', data: billedByW, symbol: 'circle', symbolSize: 7,
        lineStyle: { color: COLOR.S, width: 2.5 }, itemStyle: { color: COLOR.S },
        areaStyle: { color: COLOR.S, opacity: 0.08 },
        markLine: marks.length ? { silent: true, symbol: 'none',
          lineStyle: { color: COLOR.B, type: 'dashed' },
          label: { color: COLOR.B, fontSize: 10 }, data: marks } : undefined
      }]
    });
  }

  function renderActions() {
    var scoreEl = $('action-scorecard');
    var tableEl = $('action-table');
    if (!ACTIONS.length) {
      scoreEl.innerHTML = '<div class="empty">暂无动作记录。<br/>在 data/actions_log.csv 记录动作（日期 / 达人 / 类型 / 备注），' +
        '重新生成 data.js 后，此处自动展示动作量、触达人数与 14 日响应率。</div>';
      tableEl.innerHTML = '<thead><tr><th>日期</th><th>达人</th><th>动作类型</th><th>备注</th><th>结果追踪</th></tr></thead>' +
        '<tbody><tr><td colspan="5" style="color:#86868B;">暂无记录 — 周报中「本周动作 / 下周计划」将取自这里</td></tr></tbody>';
      return;
    }
    /* 有动作时：触达人数与响应率 */
    var touched = {};
    ACTIONS.forEach(function (a) { touched[a.creator] = true; });
    var responded = 0;
    Object.keys(touched).forEach(function (name) {
      var acts = ACTIONS.filter(function (a) { return a.creator === name; });
      var lastDate = acts.map(function (a) { return a.date; }).sort().pop();
      var after = D.rows.some(function (r) {
        return r.name === name && r.week > lastDate && (r.videos > 0 || r.gmv > 0);
      });
      if (after) responded++;
    });
    var rate = Object.keys(touched).length
      ? fmtPct(responded / Object.keys(touched).length) : '—';
    scoreEl.innerHTML =
      '<div class="kpi" style="box-shadow:none;padding:8px 0;">' +
      '<div class="k-label">动作次数</div><div class="k-value">' + ACTIONS.length + '</div></div>' +
      '<div class="kpi" style="box-shadow:none;padding:8px 0;">' +
      '<div class="k-label">触达达人</div><div class="k-value">' + Object.keys(touched).length + ' 人</div></div>' +
      '<div class="kpi" style="box-shadow:none;padding:8px 0;">' +
      '<div class="k-label">响应率（动作后有新投稿/出单）</div><div class="k-value">' + rate + '</div></div>';
    tableEl.innerHTML = '<thead><tr><th>日期</th><th>达人</th><th>动作类型</th><th>备注</th><th>结果追踪</th></tr></thead><tbody>' +
      ACTIONS.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (a) {
        return '<tr><td>' + a.date + '</td><td>' + a.creator + '</td><td>' + a.type +
          '</td><td style="white-space:normal;">' + (a.note || '') + '</td><td>—</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ---------- 主刷新 ---------- */
  function refresh() {
    var cur = aggregate(weeksInScope());
    var prev = null;
    var sorted = D.weeks.slice().sort();
    var idx = sorted.indexOf(state.week);
    if (state.range === 'week' && idx > 0) prev = aggregate([sorted[idx - 1]]);

    renderKPI(cur, prev);
    renderTrend();
    renderMiniFunnel(cur);

    var scoped = state.tier
      ? cur.filter(function (c) { return tierOf(c) === state.tier; }) : cur;
    renderScatter(scoped);
    renderTierShare(cur);
    renderTable(scoped);

    renderTrafficFunnel(cur);
    renderRoiTier(cur);
    renderFormGmv(cur);
    renderRoiScatter(cur);

    renderActionTrend();
    renderActions();
  }

  /* ---------- 初始化 ---------- */
  function init() {
    if (!D.weeks.length) {
      document.querySelector('main').innerHTML =
        '<div class="empty">未找到数据，请确认 assets/data.js 存在且格式正确。</div>';
      return;
    }
    state.week = D.weeks.slice().sort().pop();
    $('data-note').textContent =
      (D.note ? D.note + '｜' : '') + '共 ' + D.rows.length.toLocaleString() + ' 行达人数据';

    var sel = $('f-week');
    sel.innerHTML = D.weeks.slice().sort().reverse().map(function (w) {
      return '<option value="' + w + '"' + (w === state.week ? ' selected' : '') + '>' +
        w + '</option>';
    }).join('');
    sel.addEventListener('change', function () { state.week = sel.value; refresh(); });

    Array.prototype.forEach.call(document.querySelectorAll('#f-range button'), function (btn) {
      btn.addEventListener('click', function () {
        document.querySelector('#f-range .on').classList.remove('on');
        btn.classList.add('on');
        state.range = btn.getAttribute('data-v');
        refresh();
      });
    });

    $('f-tier').addEventListener('change', function () {
      state.tier = this.value; refresh();
    });

    window.addEventListener('resize', function () {
      Object.keys(charts).forEach(function (id) { charts[id].resize(); });
    });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
