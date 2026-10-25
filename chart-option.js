// The options of a chart for the drawing library: from the settings of a chart block and its data (the categories
// and the series that the table engine gives), builds the object that ECharts reads. The nine palettes are here, each
// of twenty colours. This file has no
// access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  // The nine palettes of twenty colours. `classic` goes first (its ten first colours are the ones of the earlier
  // default palette), then `acid` (saturated), `pastel`, `warm`, `cool`, three ramps of one hue (red, green, blue)
  // and the greys. The ramps go from dark to light.
  const PALETTES = {
    classic: [`#1f5fa8`, `#d97300`, `#2a9d4a`, `#c62d2d`, `#7a4cc2`, `#00828a`, `#b58900`, `#8a5a2b`, `#d6419b`, `#5a6773`, `#6fa3d9`, `#f0a860`, `#7fcf93`, `#e57c7c`, `#b79be0`, `#5cc1c8`, `#dcc25a`, `#c49a76`, `#eb93c4`, `#9aa5b1`],
    acid: [`#ff0000`, `#00ff19`, `#3300ff`, `#ff4d00`, `#00ff66`, `#7f00ff`, `#ff9900`, `#00ffb3`, `#cc00ff`, `#ffe500`, `#00ffff`, `#ff00e6`, `#ccff00`, `#00b2ff`, `#ff0099`, `#80ff00`, `#0066ff`, `#ff004c`, `#33ff00`, `#0019ff`],
    pastel: [`#efb3b3`, `#b3efb9`, `#bfb3ef`, `#efc5b3`, `#b3efcb`, `#d1b3ef`, `#efd7b3`, `#b3efdd`, `#e3b3ef`, `#efe9b3`, `#b3efef`, `#efb3e9`, `#e3efb3`, `#b3ddef`, `#efb3d7`, `#d1efb3`, `#b3cbef`, `#efb3c5`, `#bfefb3`, `#b3b9ef`],
    warm: [`#a00d0d`, `#d94012`, `#ef8e39`, `#f4d07b`, `#a0920d`, `#d91212`, `#ef6339`, `#f4b47b`, `#a0740d`, `#d9c512`, `#ef3939`, `#f4977b`, `#a0520d`, `#d99d12`, `#efdd39`, `#f47b7b`, `#a02f0d`, `#d96f12`, `#efb839`, `#f4e87b`],
    cool: [`#1a9375`, `#23acc7`, `#4987df`, `#8e86ea`, `#611a93`, `#23c79e`, `#49c6df`, `#86afea`, `#241a93`, `#8323c7`, `#49dfb9`, `#86d9ea`, `#1a4d93`, `#3123c7`, `#a049df`, `#86ead1`, `#1a7f93`, `#2368c7`, `#5549df`, `#c086ea`],
    red: [`#4c1010`, `#5c1313`, `#6c1717`, `#7c1a1a`, `#8c1e1e`, `#9b2121`, `#ab2424`, `#bb2828`, `#cb2b2b`, `#d43535`, `#d84545`, `#db5555`, `#de6565`, `#e27575`, `#e58585`, `#e99595`, `#eca5a5`, `#efb5b5`, `#f3c5c5`, `#f6d5d5`],
    green: [`#104c1a`, `#135c1f`, `#176c25`, `#1a7c2a`, `#1e8c30`, `#219b35`, `#24ab3b`, `#28bb40`, `#2bcb46`, `#35d450`, `#45d85e`, `#55db6c`, `#65de79`, `#75e287`, `#85e595`, `#95e9a3`, `#a5ecb1`, `#b5efbf`, `#c5f3cd`, `#d5f6da`],
    blue: [`#10294c`, `#13325c`, `#173a6c`, `#1a437c`, `#1e4b8c`, `#21549b`, `#245dab`, `#2865bb`, `#2b6ecb`, `#3578d4`, `#4582d8`, `#558ddb`, `#6598de`, `#75a2e2`, `#85ade5`, `#95b8e9`, `#a5c3ec`, `#b5cdef`, `#c5d8f3`, `#d5e3f6`],
    grey: [`#141414`, `#202020`, `#2b2b2b`, `#363636`, `#414141`, `#4d4d4d`, `#585858`, `#636363`, `#6f6f6f`, `#7a7a7a`, `#858585`, `#909090`, `#9c9c9c`, `#a7a7a7`, `#b2b2b2`, `#bebebe`, `#c9c9c9`, `#d4d4d4`, `#dfdfdf`, `#ebebeb`]
  };
  const RAMPS = [`red`, `green`, `blue`, `grey`];
  const PALETTE_KEYS = Object.keys(PALETTES);
  const CHART_TYPES = [`bar`, `stack`, `barh`, `barhStack`, `line`, `area`, `pie`, `donut`, `treemap`, `scatter`];
  const LEGENDS = [`none`, `top`, `bottom`, `right`];
  const LABELS = [`none`, `values`, `percent`];
  const TEXT_COLOR = `#1f2933`;
  const LINE_COLOR = `#cbd2d9`;

  // The number of a value for the drawing: a missing value stays missing (a gap), never 0.
  const numberOf = (value) => (typeof value === `number` && Number.isFinite(value) ? value : null);

  // Breaks a legend text into lines of at most `limit` characters, at spaces when possible.
  function wrapText(text, limit) {
    const lines = [];
    let line = ``;
    for (const word of String(text).split(` `)) {
      let rest = word;
      while (rest.length > limit) {
        if (line) { lines.push(line); line = ``; }
        lines.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
      if (line && line.length + 1 + rest.length > limit) { lines.push(line); line = rest; } else { line = line ? `${line} ${rest}` : rest; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [``];
  }

  // The legend of the chart: smaller text, names broken into lines, and the room that it takes (`reserve`, in
  // pixels, on the side where it stands) so that the drawing never overlaps it.
  function legendOf(legend, names, width, height, fontSize) {
    if (legend === `none`) return { option: { show: false }, reserve: { top: 0, bottom: 0, right: 0 } };
    const size = Math.max(8, Math.round(fontSize * 0.85));
    const charWidth = size * 0.62;
    const icon = size;
    const gap = 10;
    const lineHeight = size * 1.25;
    const vertical = legend === `right`;
    const textLimit = Math.max(8, Math.floor(((vertical ? Math.min(width * 0.32, 240) : width * 0.9) - icon - 8) / charWidth));
    const wrapped = new Map(names.map((name) => [name, wrapText(name, textLimit)]));
    const itemSize = (name) => {
      const lines = wrapped.get(name);
      return { w: icon + 8 + Math.max(...lines.map((line) => line.length)) * charWidth + gap, h: lines.length * lineHeight + 4 };
    };
    let reserveWidth = 0;
    let reserveHeight = 0;
    if (vertical) {
      reserveWidth = Math.max(...names.map((name) => itemSize(name).w)) + 8;
    } else {
      let rowWidth = 0;
      let rowHeight = 0;
      for (const name of names) {
        const item = itemSize(name);
        if (rowWidth && rowWidth + item.w > width * 0.95) { reserveHeight += rowHeight; rowWidth = 0; rowHeight = 0; }
        rowWidth += item.w;
        rowHeight = Math.max(rowHeight, item.h);
      }
      reserveHeight += rowHeight + 8;
    }
    const place = vertical ? { right: 0, top: `middle`, orient: `vertical` } : { [legend]: 0, left: `center`, orient: `horizontal`, width: width * 0.95 };
    const option = {
      show: true, ...place, type: `plain`, textStyle: { color: TEXT_COLOR, fontSize: size, lineHeight }, itemWidth: icon, itemHeight: size * 0.7, itemGap: gap,
      formatter: (name) => (wrapped.get(name) || [name]).join(`\n`)
    };
    return { option, reserve: { top: legend === `top` ? reserveHeight : 0, bottom: legend === `bottom` ? reserveHeight : 0, right: vertical ? reserveWidth : 0 } };
  }

  // The labels of the values on a bar or a line, or of a pie (`labels`: none, values, percent).
  function labelOf(labels, fontSize, format, pie) {
    if (labels === `none`) return { show: false };
    const text = (params) => (labels === `percent` && pie ? `${format(params.percent, 1)} %` : format(params.value));
    return { show: true, color: TEXT_COLOR, fontSize, formatter: pie ? (params) => `${params.name}\n${text(params)}` : (params) => text(params), ...(pie ? {} : { position: `top` }) };
  }

  // The colours to use for `count` series, slices or rectangles. A palette of several hues gives its colours in order. A
  // ramp (one hue, dark to light) gives colours spread over its range, so that two series are well told apart.
  function colorsFor(key, count) {
    const list = PALETTES[key] || PALETTES.classic;
    if (!RAMPS.includes(key) || count >= list.length) return list;
    if (count <= 1) return [list[4]];
    const first = 1;
    const last = list.length - 4;
    return Array.from({ length: count }, (_, at) => list[Math.round(first + (at * (last - first)) / (count - 1))]);
  }

  // The colour of a text written on a colour: dark on a light colour, white on a dark one.
  function readableOn(hex) {
    const value = parseInt(hex.slice(1), 16);
    const channel = (shift) => {
      const part = ((value >> shift) & 255) / 255;
      return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
    return luminance > 0.4 ? TEXT_COLOR : `#ffffff`;
  }

  // The options for ECharts, or null when there is nothing to draw. `config` holds chart, palette, legend and
  // labels; `data` is { categories, series: [{ name, values }] }, or for a scatter chart { xName, yName, series: [{ name,
  // points: [[x, y]] }] }; `helpers` holds `fontSize` (pixels) and `format(number, decimals)` (the French way to write a
  // number) and `decimals`.
  function buildOption(config, data, helpers) {
    const scatter = config.chart === `scatter`;
    if (!data || !Array.isArray(data.series) || !data.series.length) return null;
    if (scatter ? !data.series.some((one) => one.points.length) : !Array.isArray(data.categories) || !data.categories.length) return null;
    const fontSize = helpers.fontSize;
    const decimals = helpers.decimals;
    const format = (value, forced) => helpers.format(value, forced === undefined ? decimals : forced);
    const width = helpers.width || 600;
    const height = helpers.height || 300;
    const treemap = config.chart === `treemap`;
    const isPie = config.chart === `pie` || config.chart === `donut`;
    const names = isPie || treemap ? data.categories : data.series.map((one) => one.name);
    // A treemap writes the names in its rectangles and a single series of points needs no legend.
    const legendPlace = treemap || (scatter && data.series.length < 2) ? `none` : config.legend;
    const colors = colorsFor(helpers.palette, isPie || treemap ? data.categories.length : data.series.length);
    const legend = legendOf(legendPlace, names, width, height, fontSize);
    const reserve = legend.reserve;
    const base = {
      animation: false,
      color: colors,
      backgroundColor: `transparent`,
      textStyle: { fontFamily: `sans-serif`, fontSize, color: TEXT_COLOR },
      legend: legend.option
    };
    if (scatter) {
      const padding = fontSize * 1.8;
      const axis = (name, extra) => ({ type: `value`, scale: true, name, nameLocation: `middle`, nameGap: fontSize * 2.6, nameTextStyle: { color: TEXT_COLOR, fontSize }, axisLabel: { color: TEXT_COLOR, fontSize, formatter: (number) => format(number) }, axisLine: { lineStyle: { color: LINE_COLOR } }, splitLine: { lineStyle: { color: `#e4e7eb` } }, ...extra });
      return {
        ...base,
        grid: { left: 8 + padding, right: 16 + reserve.right, top: 12 + reserve.top, bottom: 8 + reserve.bottom + padding, containLabel: true },
        xAxis: axis(data.xName || ``, {}),
        yAxis: axis(data.yName || ``, { nameGap: fontSize * 3.4 }),
        series: data.series.map((one) => ({ type: `scatter`, name: one.name, data: one.points, symbolSize: fontSize * 0.8, itemStyle: { opacity: 0.85 }, emphasis: { disabled: true } }))
      };
    }
    if (treemap) {
      const series = data.series[0];
      const items = data.categories.map((name, at) => ({ name, value: numberOf(series.values[at]) || 0 })).filter((item) => item.value > 0);
      if (!items.length) return null;
      const sum = items.reduce((total, item) => total + item.value, 0);
      const text = (params) => (config.labels === `percent` ? `${params.name}\n${format(params.value / sum * 100, 1)} %` : config.labels === `values` ? `${params.name}\n${format(params.value)}` : params.name);
      return {
        ...base,
        series: [{
          type: `treemap`, left: 0, top: 0, right: 0, bottom: 0, roam: false, nodeClick: false, breadcrumb: { show: false }, squareRatio: 1,
          label: { show: true, fontSize, fontWeight: `bold`, formatter: text, overflow: `truncate` },
          itemStyle: { borderColor: `#ffffff`, borderWidth: 2, gapWidth: 2 }, emphasis: { disabled: true },
          data: items.map((item, at) => {
            const color = colors[at % colors.length];
            return { ...item, itemStyle: { color }, label: { color: readableOn(color) } };
          })
        }]
      };
    }
    if (config.chart === `pie` || config.chart === `donut`) {
      const series = data.series[0];
      const areaWidth = width - reserve.right;
      const areaHeight = height - reserve.top - reserve.bottom;
      const diameter = Math.max(20, Math.min(areaWidth, areaHeight) * 0.9);
      const slices = data.categories.map((name, at) => ({ name, value: numberOf(series.values[at]) || 0 }));
      return {
        ...base,
        series: [{
          type: `pie`, radius: config.chart === `donut` ? [diameter * 0.3, diameter * 0.5] : diameter * 0.5, center: [areaWidth / 2, reserve.top + areaHeight / 2], avoidLabelOverlap: true,
          label: labelOf(config.labels, fontSize, format, true), labelLine: { show: config.labels !== `none` }, data: slices,
          emphasis: { disabled: true }, itemStyle: { borderColor: `#ffffff`, borderWidth: 1 }
        }]
      };
    }
    const horizontal = config.chart === `barh` || config.chart === `barhStack`;
    const area = config.chart === `area`;
    const stacked = config.chart === `stack` || config.chart === `barhStack` || area;
    const type = config.chart === `line` || area ? `line` : `bar`;
    const category = { type: `category`, ...(area ? { boundaryGap: false } : {}), data: data.categories, axisLabel: { color: TEXT_COLOR, fontSize, hideOverlap: true }, axisLine: { lineStyle: { color: LINE_COLOR } }, axisTick: { show: false }, ...(horizontal ? { inverse: true } : {}) };
    const value = { type: `value`, axisLabel: { color: TEXT_COLOR, fontSize, formatter: (number) => format(number) }, splitLine: { lineStyle: { color: `#e4e7eb` } } };
    return {
      ...base,
      grid: { left: 8, right: 16 + reserve.right, top: 12 + reserve.top, bottom: 8 + reserve.bottom, containLabel: true },
      xAxis: horizontal ? value : category,
      yAxis: horizontal ? category : value,
      series: data.series.map((one) => ({
        type, name: one.name, data: one.values.map(numberOf), ...(stacked ? { stack: `total` } : {}),
        label: area ? { show: false } : labelOf(config.labels === `percent` ? `values` : config.labels, fontSize, format, false),
        emphasis: { disabled: true },
        ...(area ? { symbol: `none`, lineStyle: { width: 1 }, areaStyle: { opacity: 0.85 } } : type === `line` ? { symbol: `circle`, symbolSize: fontSize * 0.6, lineStyle: { width: 2 } } : {})
      }))
    };
  }

  const api = { PALETTES, RAMPS, colorsFor, readableOn, PALETTE_KEYS, CHART_TYPES, LEGENDS, LABELS, buildOption };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbChartOption = api;
})(typeof window !== `undefined` ? window : globalThis);
