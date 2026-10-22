// Builds the dataset of the invented document for the tests of the engine.
const { buildSchema } = require(`../schema.js`);
const { createDataset } = require(`../dataset.js`);
const demo = require(`./fixtures/demo-data.js`);

const schema = buildSchema(demo.metadata._grist_Tables, demo.metadata._grist_Tables_column);
const dataset = createDataset(schema, demo.data);

module.exports = { schema, dataset, demo };
