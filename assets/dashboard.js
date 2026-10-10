/* TikTok 达人 ROI 运营看板 — 主逻辑（全周期累计版）
   数据：window.DASHBOARD_DATA = { note, rows, actions? }
   rows 粒度：达人（多份导出已按达人累计合并）；actions 粒度：达人 × 动作（可选） */
(function () {
  'use strict';

  var D = window.DASHBOARD_DATA || { rows: [], note: '' };
  var ROWS = D.rows || [];
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

  var state = { tier: '' };
  var charts = {};

  /* ---------- 工具 ---------- */
  function fmtMoney(v) { return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function fmtPct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  function $(id) { return document.getElementById(id); }

  function tierOf(c) {
    if (c.gmv >= 50) return 'S';
    if (c.gmv > 0) return 'A';
    if (c.videos > 0) return 'B';
    if (c.samples > 0) return 'C';
    return 'D';
  }

  function sumBy(list, key) {
    return list.reduce(function (a, c) { return a + (c[key] || 0); }, 0);
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
  function renderKPI(list) {
    var gmv = sumBy(list, 'gmv'), comm = sumBy(list, 'commission');
    var orders = sumBy(list, 'orders'), refund = sumBy(list, 'refund');
    var roi = comm > 0 ? gmv / comm : null;
    var billed = list.filter(function (c) { return c.gmv > 0; }).length;
    var content = sumBy(list, 'videos') + sumBy(list, 'lives');
    var aov = orders > 0 ? gmv / orders : 0;
    var refundRate = gmv > 0 ? refund / gmv : 0;
    var sampled = list.filter(function (c) { return c.samples > 0; }).length;
    var posted = list.filter(function (c) { return c.videos > 0; }).length;
    var postRate = sampled > 0 ? posted / sampled : null;
    var billRate = posted > 0 ? billed / posted : null;

    var cards = [
      { label: 'GMV（累计）', value: fmtMoney(gmv),
        delta: '<span>结算佣金 ' + fmtMoney(comm) + '｜佣金率 ' +
          (gmv > 0 ? fmtPct(comm / gmv) : '—') + '</span>' },
      { label: 'ROI（GMV ÷ 佣金）', value: roi == null ? '—' : roi.toFixed(1),
        delta: '<span>目标 ≥ 8，当前 ' +
          (roi == null ? '—' : (roi >= 8 ? '<b class="up">达标</b>' : '<b class="down">未达标</b>')) +
          '</span>' },
      { label: '出单达人', value: billed + ' 人',
        delta: '<span>投稿→出单 ' + (billRate == null ? '—' : fmtPct(billRate)) + '</span>' },
      { label: '建联达人', value: list.length.toLocaleString() + ' 人',
        delta: '<span>发样 ' + sampled + '｜投稿 ' + posted + '</span>' },
      { label: '发样→投稿转化', value: postRate == null ? '—' : fmtPct(postRate),
        delta: '<span>发样 ' + sampled + ' 人，投稿 ' + posted + ' 人</span>' },
      { label: '内容产出', value: content.toLocaleString(),
        delta: '<span>视频 ' + sumBy(list, 'videos').toLocaleString() +
          '｜直播 ' + sumBy(list, 'lives').toLocaleString() + '</span>' },
      { label: '订单 / AOV', value: orders.toLocaleString() + ' 单',
        delta: '<span>AOV ' + fmtMoney(aov) + '</span>' },
      { label: '退款率', value: fmtPct(refundRate),
        delta: '<span>退款金额 ' + fmtMoney(refund) + '</span>' }
    ];

    $('kpi-grid').innerHTML = cards.map(function (c) {
      return '<div class="kpi"><div class="k-label">' + c.label + '</div>' +
        '<div class="k-value">' + c.value + '</div>' +
        '<div class="k-delta">' + c.delta + '</div></div>';
    }).join('');
  }

  /* ---------- 各图表 ---------- */
  function renderPareto(list) {
    var sorted = list.filter(function (c) { return c.gmv > 0; })
      .slice().sort(function (a, b) { return b.gmv - a.gmv; });
    var el = $('c-pareto');
    if (!sorted.length) {
      el.innerHTML = '<div class="empty">暂无 GMV 数据</div>';
      return;
    }
    var top = sorted.slice(0, 20);
    var total = sumBy(sorted, 'gmv');
    var cum = 0;
    var cumPct = top.map(function (c) {
      cum += c.gmv;
      return +(cum / total * 100).toFixed(1);
    });
    mount('c-pareto', {
      animation: false,
      tooltip: baseTooltip({
        trigger: 'axis',
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          var c = top[i];
          var lines = '<b>' + c.name + '</b><br/>GMV：$' + c.gmv.toFixed(2) +
            '<br/>累计占比：' + cumPct[i] + '%';
          if (i === 0 && sorted.length > 1) {
            var top2 = (sorted[0].gmv + sorted[1].gmv) / total;
            lines += '<br/><span style="color:' + (top2 > 0.6 ? COLOR.down : COLOR.accent) +
              '">Top2 占全盘 ' + fmtPct(top2) + '</span>';
          }
          return lines;
        }
      }),
      legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9,
        textStyle: { color: COLOR.muted, fontSize: 12 }, data: ['GMV', '累计占比'] },
      grid: { left: 56, right: 48, top: 24, bottom: 64 },
      xAxis: Object.assign(axisStyle(), { type: 'category',
        data: top.map(function (c) { return c.name; }),
        axisLabel: { color: COLOR.muted, fontSize: 10, rotate: 32,
          formatter: function (s) { return s.length > 10 ? s.slice(0, 9) + '…' : s; } },
        splitLine: { show: false } }),
      yAxis: [
        Object.assign(axisStyle(), { type: 'value', name: 'GMV($)',
          nameTextStyle: { color: COLOR.muted, fontSize: 11 } }),
        Object.assign(axisStyle(), { type: 'value', name: '累计占比(%)', max: 100,
          nameTextStyle: { color: COLOR.muted, fontSize: 11 },
          splitLine: { show: false } })
      ],
      series: [
        { name: 'GMV', type: 'bar', data: top.map(function (c) { return +c.gmv.toFixed(2); }),
          barWidth: '52%', itemStyle: { color: COLOR.S, borderRadius: [4, 4, 0, 0] } },
        { name: '累计占比', type: 'line', yAxisIndex: 1, data: cumPct,
          symbol: 'circle', symbolSize: 6,
          lineStyle: { color: COLOR.A, width: 2 }, itemStyle: { color: COLOR.A },
          markLine: { silent: true, symbol: 'none',
            lineStyle: { color: COLOR.muted, type: 'dashed' },
            label: { color: COLOR.muted, fontSize: 10, formatter: '80%' },
            data: [{ yAxis: 80 }] } }
      ]
    });
  }

  function renderMiniFunnel(list) {
    var data = [
      { name: '建联', value: list.length },
      { name: '发样', value: list.filter(function (c) { return c.samples > 0; }).length },
      { name: '投稿', value: list.filter(function (c) { return c.videos > 0; }).length },
      { name: '出单', value: list.filter(function (c) { return c.gmv > 0; }).length }
    ];
    var conv = ['100%'];
    for (var i = 1; i < data.length; i++) {
      conv.push(data[i - 1].value > 0
        ? '上级转化 ' + fmtPct(data[i].value / data[i - 1].value) : '—');
    }
    mount('c-funnel-mini', funnelOption(data, conv));
  }

  function renderScatter(list) {
    var tiers = ['S', 'A', 'B', 'C', 'D'];
    var series = tiers.map(function (t) {
      return {
        name: TIER_NAME[t], type: 'scatter',
        data: list.filter(function (c) { return tierOf(c) === t; }).map(function (c) {
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

  function renderTierShare(list) {
    var tiers = ['S', 'A', 'B', 'C', 'D'];
    var counts = tiers.map(function (t) {
      return list.filter(function (c) { return tierOf(c) === t; }).length;
    });
    var gmvSorted = list.map(function (c) { return c.gmv; }).sort(function (a, b) { return b - a; });
    var total = gmvSorted.reduce(function (a, b) { return a + b; }, 0);
    var top2 = total > 0 && gmvSorted.length > 1 ? (gmvSorted[0] + gmvSorted[1]) / total : 0;

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

  function renderTable(list) {
    var top = list.slice().sort(function (a, b) { return b.gmv - a.gmv; }).slice(0, 30);
    var head = '<thead><tr><th>达人</th><th>层级</th><th class="num">GMV</th>' +
      '<th class="num">佣金</th><th class="num">ROI</th><th class="num">视频</th>' +
      '<th class="num">直播</th><th class="num">发样</th><th class="num">曝光</th>' +
      '<th>建议动作</th></tr></thead>';
    var body = top.map(function (c) {
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

  function renderTrafficFunnel(list) {
    var imps = sumBy(list, 'impressions');
    var clicks = list.reduce(function (a, c) {
      return a + (c.clicks != null ? c.clicks : c.impressions * ((c.ctr || 0) / 100));
    }, 0);
    var orders = sumBy(list, 'orders');
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

  function renderRoiTier(list) {
    var tiers = ['S', 'A', 'B', 'C', 'D'];
    var bars = [], labels = [];
    tiers.forEach(function (t) {
      var sub = list.filter(function (c) { return tierOf(c) === t; });
      var g = sumBy(sub, 'gmv'), cm = sumBy(sub, 'commission');
      if (cm > 0) {
        bars.push({ value: +(g / cm).toFixed(2),
          itemStyle: { color: COLOR[t], borderRadius: [4, 4, 0, 0] },
          gmv: g });
        labels.push(TIER_NAME[t]);
      }
    });
    var el = $('c-roi-tier');
    if (!bars.length) { el.innerHTML = '<div class="empty">暂无结算佣金数据</div>'; return; }
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

  function renderFormGmv(list) {
    var video = sumBy(list, 'videoGmv'), live = sumBy(list, 'liveGmv'),
      showcase = sumBy(list, 'showcaseGmv');
    var other = Math.max(0, sumBy(list, 'gmv') - video - live - showcase);
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

  function renderRoiScatter(list) {
    var pts = list.filter(function (c) { return c.commission > 0 || c.gmv > 0; })
      .map(function (c) {
        return { value: [+c.commission.toFixed(2), +c.gmv.toFixed(2)], name: c.name, raw: c };
      });
    var el = $('c-roi-scatter');
    if (!pts.length) { el.innerHTML = '<div class="empty">暂无 GMV / 佣金数据</div>'; return; }
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

  /* ---------- 模块四 ---------- */
  function renderActionAdvice(list) {
    var tiers = ['S', 'A', 'B', 'C', 'D'];
    var html = tiers.map(function (t) {
      var n = list.filter(function (c) { return tierOf(c) === t; }).length;
      if (!n) return '';
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;' +
        'border-bottom:1px solid ' + COLOR.grid + ';">' +
        '<span class="tier-tag" style="background:' + COLOR[t] + ';flex-shrink:0;margin-top:2px;">' +
        t + '</span>' +
        '<div style="font-size:12.5px;">' +
        '<b>' + TIER_NAME[t] + '</b>（' + n + ' 人）<br/>' +
        '<span style="color:' + COLOR.muted + ';">' + TIER_ACTION[t] + '</span></div></div>';
    }).join('');
    $('action-advice').innerHTML = html ||
      '<div class="empty">暂无达人数据</div>';
  }

  function scorecardHtml(actions, touchedCount, respondedRate) {
    var cell = function (label, value, sub) {
      return '<div style="padding:10px 2px 12px;border-bottom:1px solid ' + COLOR.grid + ';">' +
        '<div style="font-size:12px;color:' + COLOR.muted + ';">' + label + '</div>' +
        '<div style="font-size:24px;font-weight:700;letter-spacing:-0.02em;' +
        'font-variant-numeric:tabular-nums;margin-top:2px;">' + value + '</div>' +
        (sub ? '<div style="font-size:11.5px;color:' + COLOR.muted + ';margin-top:1px;">' + sub + '</div>' : '') +
        '</div>';
    };
    return cell('动作次数', actions, null) +
      cell('触达达人', touchedCount, null) +
      cell('触达后已出单', respondedRate, null);
  }

  function renderActions() {
    var scoreEl = $('action-scorecard');
    var tableEl = $('action-table');
    if (!ACTIONS.length) {
      scoreEl.innerHTML = scorecardHtml('0', '0 人', '—') +
        '<div style="margin-top:12px;padding:10px 12px;background:#F5F5F7;border-radius:8px;' +
        'font-size:12px;color:' + COLOR.muted + ';line-height:1.7;">' +
        '还没有动作记录。在 <b>data/actions_log.csv</b> 中按模板记录动作后，' +
        '运行 <b>python tools/build_data.py</b> 即可自动汇总到这里。' +
        '</div>';
      tableEl.innerHTML = '<thead><tr><th>日期</th><th>达人</th><th>动作类型</th><th>备注</th></tr></thead><tbody>' +
        '<tr><td style="color:#C7C7CC;">2026-10-12</td><td style="color:#C7C7CC;">creator_demo</td>' +
        '<td style="color:#C7C7CC;">催稿</td><td style="color:#C7C7CC;white-space:normal;">示例行 — 按 data/templates/actions_template.csv 填写后自动替换</td></tr>' +
        '<tr><td colspan="4" style="text-align:center;color:' + COLOR.muted + ';padding:14px;">' +
        '暂无动作记录 · 周报中「本周动作 / 下周计划」将取自这里</td></tr></tbody>';
      return;
    }
    var touched = {};
    ACTIONS.forEach(function (a) { touched[a.creator] = true; });
    var touchedNames = Object.keys(touched);
    var billedSet = {};
    ROWS.forEach(function (c) { if (c.gmv > 0) billedSet[c.name] = true; });
    var responded = touchedNames.filter(function (n) { return billedSet[n]; }).length;
    var rate = touchedNames.length ? fmtPct(responded / touchedNames.length) : '—';
    scoreEl.innerHTML = scorecardHtml(
      String(ACTIONS.length), touchedNames.length + ' 人', rate);
    tableEl.innerHTML = '<thead><tr><th>日期</th><th>达人</th><th>动作类型</th><th>备注</th></tr></thead><tbody>' +
      ACTIONS.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (a) {
        return '<tr><td>' + a.date + '</td><td>' + a.creator + '</td><td>' + a.type +
          '</td><td style="white-space:normal;">' + (a.note || '') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ---------- 主刷新 ---------- */
  function refresh() {
    var scoped = state.tier
      ? ROWS.filter(function (c) { return tierOf(c) === state.tier; }) : ROWS;

    renderKPI(scoped);
    renderPareto(scoped);
    renderMiniFunnel(scoped);

    renderScatter(scoped);
    renderTierShare(scoped);
    renderTable(scoped);

    renderTrafficFunnel(scoped);
    renderRoiTier(scoped);
    renderFormGmv(scoped);
    renderRoiScatter(scoped);

    renderActionAdvice(scoped);
    renderActions();
  }

  /* ---------- 初始化 ---------- */
  function init() {
    if (!ROWS.length) {
      document.querySelector('main').innerHTML =
        '<div class="empty">未找到数据，请确认 assets/data.js 存在且格式正确。</div>';
      return;
    }
    $('data-note').textContent =
      (D.note ? D.note + '｜' : '') + '共 ' + ROWS.length.toLocaleString() + ' 位达人';

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
