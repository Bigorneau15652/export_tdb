// An invented Grist document used by the tests: sites, buildings, floors, rooms, usages and
// contacts, with the traps that real documents have (a reference to the same table, a list of
// references, a room whose site differs from the site of its building, empty values).
// It holds no real data. It is returned in the form that Grist gives to a widget.

const T = (id, tableId, summarySourceTable = 0) => ({ id, tableId, summarySourceTable });
const C = (id, parentId, colId, type, extra = {}) => ({ id, parentId, colId, label: extra.label || colId, type, isFormula: extra.isFormula || false, visibleCol: extra.visibleCol || 0 });

const tableRows = [
  T(1, `Sites`), T(2, `Buildings`), T(3, `Floors`), T(4, `Rooms`), T(5, `Usages`), T(6, `Contacts`), T(7, `Notes`), T(8, `Rooms_summary_Usage`, 4)
];
const columnRows = [
  C(1, 1, `Name`, `Text`), C(2, 1, `Address`, `Text`),
  C(3, 2, `Name`, `Text`), C(4, 2, `Site`, `Ref:Sites`, { visibleCol: 1 }), C(5, 2, `Year`, `Int`), C(6, 2, `Photo`, `Attachments`),
  C(7, 2, `Parent`, `Ref:Buildings`, { visibleCol: 3 }), C(8, 2, `Managers`, `RefList:Contacts`, { visibleCol: 20 }),
  C(9, 3, `Label`, `Text`), C(10, 3, `Building`, `Ref:Buildings`, { visibleCol: 3 }),
  C(11, 4, `Number`, `Text`), C(12, 4, `Building`, `Ref:Buildings`, { visibleCol: 3 }), C(13, 4, `Floor`, `Ref:Floors`, { visibleCol: 9 }),
  C(14, 4, `Site`, `Ref:Sites`, { visibleCol: 1 }), C(15, 4, `Usage`, `Ref:Usages`, { visibleCol: 25 }), C(16, 4, `Area`, `Numeric`),
  C(17, 4, `Seats`, `Int`), C(18, 4, `Tags`, `ChoiceList`), C(19, 4, `Surface`, `Numeric`, { isFormula: true }),
  C(16 + 4 + 5, 5, `Label`, `Text`), C(26, 5, `Counts`, `Bool`),
  C(20, 6, `Name`, `Text`),
  C(27, 7, `Text`, `Text`),
  C(28, 4, `manualSort`, `ManualSortPos`), C(29, 4, `gristHelper_Display`, `Any`, { isFormula: true }),
  C(30, 8, `Usage`, `Ref:Usages`), C(31, 8, `Area`, `Numeric`, { isFormula: true }), C(32, 2, `Inspected`, `Date`), C(33, 2, `Link`, `Text`)
];

// Metadata tables in the column form of fetchTable.
function columnar(rows) {
  const keys = Object.keys(rows[0]);
  const out = {};
  for (const key of keys) out[key] = rows.map((row) => row[key]);
  return out;
}

// The data: a small deterministic content.
const data = {
  Sites: { id: [1, 2], Name: [`North campus`, `South campus`], Address: [`1 Example street`, ``] },
  Buildings: {
    id: [1, 2, 3, 4], Name: [`Building A`, `Building B`, `Building A`, `Annex`], Site: [1, 1, 2, 1], Year: [1965, 1990, 2005, 0],
    Photo: [[`L`, 11, 12], null, [`L`], null], Parent: [0, 0, 0, 1], Managers: [[`L`, 1, 2], [`L`], null, [`L`, 2]],
    Inspected: [1736294400, 1704067200, null, 1736294400],
    Link: [`https://cloud.example.org/s/AbC123`, `https://1drv.ms/i/abc\nhttps://cloud.example.org/index.php/s/Second/`, `http://insecure.example.org/a.png`, ``]
  },
  Floors: { id: [1, 2, 3, 4], Label: [`Ground`, `Level 1`, `Ground`, `Ground`], Building: [1, 1, 2, 3] },
  Rooms: {
    id: [1, 2, 3, 4, 5, 6], Number: [`A-001`, `A-002`, `B-001`, `B-002`, `C-001`, `X-001`], Building: [1, 1, 2, 2, 3, 1],
    Floor: [1, 2, 3, 3, 4, 1], Site: [1, 1, 1, 1, 2, 2], Usage: [1, 2, 1, 0, 2, 1], Area: [20.5, 35, 12, 8.25, 40, 5],
    Seats: [4, 10, 0, 1, 12, 0], Tags: [[`L`, `bright`], null, [`L`, `quiet`, `new`], [`L`], null, null], Surface: [20.5, 35, 12, 8.25, 40, 5]
  },
  Usages: { id: [1, 2], Label: [`Office`, `Classroom`], Counts: [true, false] },
  Contacts: { id: [1, 2], Name: [`First contact`, `Second contact`] },
  Notes: { id: [1], Text: [`not related to anything`] }
};

const metadata = { _grist_Tables: columnar(tableRows), _grist_Tables_column: columnar(columnRows) };

module.exports = { metadata, data };
