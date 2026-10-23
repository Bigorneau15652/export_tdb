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

  // The legend of the chart for its position.
  function legendOf(legend, fontSize) {
    if (legend === `none`) return { show: false };
    const place = legend === `right` ? { right: 0, top: `middle`, orient: `vertical` } : { [legend]: 0, left: `center`, orient: `horizontal` };
    return { show: true, ...place, type: `scroll`, textStyle: { color: TEXT_COLOR, fontSize }, itemWidth: fontSize, itemHeight: fontSize * 0.7 };
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
    const base = {
      animation: false,
      color: PALETTES[config.palette] || PALETTES.franche,
      backgroundColor: `transparent`,
      textStyle: { fontFamily: `sans-serif`, fontSize, color: TEXT_COLOR },
      legend: legendOf(config.legend, fontSize)
    };
    if (config.chart === `pie` || config.chart === `donut`) {
      const series = data.series[0];
      const slices = data.categories.map((name, at) => ({ name, value: numberOf(series.values[at]) || 0 }));
      return {
        ...base,
        series: [{
          type: `pie`, radius: config.chart === `donut` ? [`42%`, `68%`] : `68%`, center: [`50%`, `50%`], avoidLabelOverlap: true,
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
      grid: { left: 8, right: 16, top: config.legend === `top` ? fontSize * 2.6 : 12, bottom: config.legend === `bottom` ? fontSize * 2.6 : 8, containLabel: true },
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
