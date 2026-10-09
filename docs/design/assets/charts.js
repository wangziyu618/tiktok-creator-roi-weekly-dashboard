/* TikTok 达人 ROI 看板设计方案 — 图表初始化
   数据来源：ss.xlsx（TikTok Shop Affiliate 导出快照，1,068 达人） */
(function () {
  var root = getComputedStyle(document.documentElement);
  function token(name) { return root.getPropertyValue(name).trim(); }

  var chartSeries1 = token('--chart-series-1');
  var chartSeries2 = token('--chart-series-2');
  var chartOther = token('--chart-other');
  var gridColor = token('--chart-grid');
  var axisColor = token('--chart-axis');
  var labelColor = token('--chart-label');
  var tooltipBg = token('--chart-tooltip-bg');
  var inkColor = token('--page-text');

  function baseTooltip() {
    return {
      appendToBody: true,
      backgroundColor: tooltipBg,
      borderColor: gridColor,
      textStyle: { color: inkColor, fontSize: 12 }
    };
  }

  function mount(id, option) {
    var el = document.getElementById(id);
    if (!el) return;
    if (typeof echarts === 'undefined') {
      el.innerHTML = '<div class="chart-empty">图表库加载失败，请检查 _shared/js/echarts.min.js</div>';
      return;
    }
    var chart = echarts.init(el, null, { renderer: 'svg' });
    chart.setOption(option);
    window.addEventListener('resize', function () { chart.resize(); });
  }

  /* 图 1 · 转化漏斗：建联 1068 → 发样 350 → 投稿 221 → 出单 8 */
  var funnelData = [
    { name: '建联达人', value: 1068, conv: '100%' },
    { name: '发样达人', value: 350, conv: '占建联 32.8%' },
    { name: '投稿达人', value: 221, conv: '占发样 63.1%' },
    { name: '出单达人', value: 8, conv: '占投稿 3.6%' }
  ];

  mount('chart-funnel', {
    animation: false,
    tooltip: Object.assign(baseTooltip(), {
      trigger: 'item',
      formatter: function (p) {
        return '<b>' + p.name + '</b><br/>人数：' + p.value.toLocaleString() +
          '<br/>' + funnelData[p.dataIndex].conv;
      }
    }),
    series: [{
      type: 'funnel',
      left: '24%',
      width: '48%',
      top: 12,
      bottom: 12,
      sort: 'descending',
      gap: 4,
      minSize: '6%',
      maxSize: '100%',
      label: {
        position: 'left',
        formatter: function (p) { return p.name + '  ' + p.value.toLocaleString(); },
        color: inkColor,
        fontSize: 12.5,
        fontWeight: 600
      },
      labelLine: { length: 12, lineStyle: { color: gridColor } },
      itemStyle: {
        borderRadius: 4,
        borderColor: tooltipBg,
        borderWidth: 2
      },
      data: funnelData.map(function (d, i) {
        var opacity = [1, 0.82, 0.64, 0.5][i];
        return {
          name: d.name,
          value: d.value,
          itemStyle: { color: chartSeries1, opacity: opacity }
        };
      })
    }, {
      type: 'funnel',
      left: '24%',
      width: '48%',
      top: 12,
      bottom: 12,
      sort: 'descending',
      gap: 4,
      minSize: '8%',
      maxSize: '100%',
      z: 3,
      label: {
        position: 'right',
        formatter: function (p) { return funnelData[p.dataIndex].conv; },
        color: labelColor,
        fontSize: 12
      },
      itemStyle: { color: 'transparent' },
      silent: true,
      data: funnelData.map(function (d) { return { name: d.name, value: d.value }; })
    }]
  });

  /* 图 2 · 出单达人 GMV 帕累托 */
  var creators = [
    'jasmina__marie', 'tabbyandtuxedocat', 'littlelifethings_16', 'kayewhite02',
    'brucehustles', 'hollyween1973', 'maritza_2478', 'kdsartistry.org'
  ];
  var gmv = [135.99, 106.24, 49.99, 25.98, 17.99, 12.99, 12.99, 12.83];
  var cumShare = [36.3, 64.6, 77.9, 84.9, 89.7, 93.1, 96.6, 100.0];

  mount('chart-pareto', {
    animation: false,
    tooltip: Object.assign(baseTooltip(), {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        var i = params[0].dataIndex;
        return '<b>' + creators[i] + '</b><br/>GMV：$' + gmv[i].toFixed(2) +
          '<br/>累计占比：' + cumShare[i].toFixed(1) + '%';
      }
    }),
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: labelColor, fontSize: 12 },
      data: ['GMV', '累计占比']
    },
    grid: { left: 56, right: 56, top: 32, bottom: 64 },
    xAxis: {
      type: 'category',
      data: creators.map(function (c) {
        return c.length > 12 ? c.slice(0, 11) + '…' : c;
      }),
      axisLabel: { color: axisColor, fontSize: 11, rotate: 28 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false }
    },
    yAxis: [{
      type: 'value',
      name: 'GMV（$）',
      nameTextStyle: { color: labelColor, fontSize: 11 },
      axisLabel: { color: axisColor, fontSize: 11 },
      splitLine: { lineStyle: { color: gridColor, width: 1 } }
    }, {
      type: 'value',
      name: '累计占比（%）',
      max: 100,
      nameTextStyle: { color: labelColor, fontSize: 11 },
      axisLabel: { color: axisColor, fontSize: 11, formatter: '{value}%' },
      splitLine: { show: false }
    }],
    series: [{
      name: 'GMV',
      type: 'bar',
      data: gmv,
      barWidth: '52%',
      itemStyle: { color: chartSeries1, borderRadius: [4, 4, 0, 0] }
    }, {
      name: '累计占比',
      type: 'line',
      yAxisIndex: 1,
      data: cumShare,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { color: chartSeries2, width: 2 },
      itemStyle: { color: chartSeries2 },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: chartOther, type: 'dashed' },
        label: { color: labelColor, fontSize: 11, formatter: '80% 线' },
        data: [{ yAxis: 80 }]
      }
    }]
  });
})();
