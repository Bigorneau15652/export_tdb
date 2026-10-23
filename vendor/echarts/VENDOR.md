# Apache ECharts, custom build

What it is: a custom build of Apache ECharts 6.1.0 that draws the charts of the dashboard (bar, line, area, pie, scatter and treemap charts, in SVG). It is copied into the repository so that the widget loads no code from a CDN.

- Source: the npm packages `echarts@6.1.0` (licence Apache-2.0), `zrender@6.1.0` (BSD-3-Clause, the drawing engine of ECharts) and `tslib@2.3.0` (0BSD), downloaded from the npm registry (https://registry.npmjs.org).
- Content of the build: the bar, line (also used for the area chart), pie, scatter and treemap charts, the grid and legend components, the label layout and the SVG renderer only. The canvas renderer, the tooltips, the 3D and map charts and the other components are left out.
- File: `echarts.custom.min.js` (put in `window.exportTdbEcharts`). SHA-256: `7ddfce5aeeb9848b27d6bc30bacaa432aa5d074d8afa42f0eec866146e6c222e`.
- Licences: `LICENSE` and `NOTICE` (ECharts), `LICENSE-zrender`, `LICENSE-tslib`.

How it was built (to build it again, in an empty folder outside the repository):

1. `npm install echarts@6.1.0 esbuild@0.28.2 --save-exact`
2. copy `entry.js` of this folder into it
3. `npx esbuild entry.js --bundle --minify --format=iife --target=es2019 --legal-comments=none --outfile=echarts.custom.min.js`
4. put the line of comment about the licences at the top of the file

Checks made when it was added:

- the file contains no `eval`, no `new Function`, no `fetch`, `XMLHttpRequest`, `WebSocket` or `importScripts` (a test checks it);
- the page keeps its strict Content-Security-Policy and the charts are drawn in it without error (an integration test checks it);
- the three licences are compatible with the public repository and are kept in this folder.

To update it: change the versions above, build again, check again, then change the version and the SHA-256 in this file.
