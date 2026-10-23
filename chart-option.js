// The options of a chart for the drawing library: from the settings of a chart block and its data (the categories
// and the series that the table engine gives), builds the object that ECharts reads. The four palettes are here, each
// of ten colours that keep at least a 3 to 1 contrast against white and are told apart from each other. This file has no
// access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const PALETTES = {
    franche: [`#1f5fa8`, `#d97300`, `#2a9d4a`, `#c62d2d`, `#7a4cc2`, `#00828a`, `#b58900`, `#8a5a2b`, `#d6419b`, `#5a6773`],
    douce: [`#4f7cac`, `#c9803a`, `#5f9c6d`, `#b5645f`, `#8b78b5`, `#4a9399`, `#a58c3c`, `#9a7456`, `#b86a98`, `#6f7b86`],
    contrastee: [`#0072b2`, `#d55e00`, `#009e73`, `#cc79a7`, `#b07400`, `#7b3f9e`, `#444444`, `#2c8aa6`, `#8c3b3b`, `#4d7a2c`],
    froide: [`#0b3d66`, `#2b73a8`, `#00828a`, `#2f9e8f`, `#4d7a2c`, `#6a5acd`, `#3b4f8c`, `#5a6773`, `#7a8f2c`, `#1a7f5a`]
  };
  const PALETTE_KEYS = Object.keys(PALETTES);
  const CHART_TYPES = [`bar`, `stack`, `barh`, `barhStack`, `line`, `pie`, `donut`];
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

  // The options for ECharts, or null when there is nothing to draw. `config` holds chart, palette, legend and
  // labels; `data` is { categories, series: [{ name, values }] }; `helpers` holds `fontSize` (pixels) and
  // `format(number, decimals)` (the French way to write a number) and `decimals`.
  function buildOption(config, data, helpers) {
    if (!data || !data.categories.length || !data.series.length) return null;
    const fontSize = helpers.fontSize;
    const decimals = helpers.decimals;
    const format = (value, forced) => helpers.format(value, forced === undefined ? decimals : forced);
    const width = helpers.width || 600;
    const height = helpers.height || 300;
    const isPie = config.chart === `pie` || config.chart === `donut`;
    const names = isPie ? data.categories : data.series.map((one) => one.name);
    const legend = legendOf(config.legend, names, width, height, fontSize);
    const reserve = legend.reserve;
    const base = {
      animation: false,
      color: PALETTES[config.palette] || PALETTES.franche,
      backgroundColor: `transparent`,
      textStyle: { fontFamily: `sans-serif`, fontSize, color: TEXT_COLOR },
      legend: legend.option
    };
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
    const stacked = config.chart === `stack` || config.chart === `barhStack`;
    const type = config.chart === `line` ? `line` : `bar`;
    const category = { type: `category`, data: data.categories, axisLabel: { color: TEXT_COLOR, fontSize, hideOverlap: true }, axisLine: { lineStyle: { color: LINE_COLOR } }, axisTick: { show: false }, ...(horizontal ? { inverse: true } : {}) };
    const value = { type: `value`, axisLabel: { color: TEXT_COLOR, fontSize, formatter: (number) => format(number) }, splitLine: { lineStyle: { color: `#e4e7eb` } } };
    return {
      ...base,
      grid: { left: 8, right: 16 + reserve.right, top: 12 + reserve.top, bottom: 8 + reserve.bottom, containLabel: true },
      xAxis: horizontal ? value : category,
      yAxis: horizontal ? category : value,
      series: data.series.map((one) => ({
        type, name: one.name, data: one.values.map(numberOf), ...(stacked ? { stack: `total` } : {}),
        label: labelOf(config.labels === `percent` ? `values` : config.labels, fontSize, format, false),
        emphasis: { disabled: true }, ...(type === `line` ? { symbol: `circle`, symbolSize: fontSize * 0.6, lineStyle: { width: 2 } } : {})
      }))
    };
  }

  const api = { PALETTES, PALETTE_KEYS, CHART_TYPES, LEGENDS, LABELS, buildOption };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbChartOption = api;
})(typeof window !== `undefined` ? window : globalThis);
