// Entry point of the custom build of Apache ECharts used by export_tdb: only the charts, components and the SVG
// renderer that the dashboard needs. The result is a script that puts ECharts in `window.exportTdbEcharts`.
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent } from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, LabelLayout, SVGRenderer]);
window.exportTdbEcharts = echarts;
