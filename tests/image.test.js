// Tests of the reading of the cell of an image block: attachments, https links, share links of the drives.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const I = require(`../image.js`);

test(`an attachments cell gives its pictures in order, the marker L is ignored`, () => {
  assert.equal(I.countImages([`L`, 11, 12]), 2);
  assert.deepEqual(I.pictureAt([`L`, 11, 12], 1), { status: `attachment`, id: 11 });
  assert.deepEqual(I.pictureAt([`L`, 11, 12], 2), { status: `attachment`, id: 12 });
  assert.deepEqual(I.pictureAt([`L`, 11, 12], 3), { status: `empty` });
  assert.deepEqual(I.pictureAt([`L`], 1), { status: `empty` });
  assert.deepEqual(I.pictureAt(null, 1), { status: `empty` });
  assert.deepEqual(I.pictureAt([`L`, -3, 0, 1.5, `x`, 7], 1), { status: `attachment`, id: 7 });
});

test(`a text cell gives one picture per non blank line`, () => {
  const cell = `https://example.org/a.png\n\n  https://example.org/b.jpg  \n`;
  assert.equal(I.countImages(cell), 2);
  assert.deepEqual(I.pictureAt(cell, 2).candidates, [`https://example.org/b.jpg`]);
  assert.equal(I.pictureAt(cell, 3).status, `empty`);
  assert.equal(I.pictureAt(``, 1).status, `empty`);
  assert.equal(I.pictureAt(12, 1).status, `empty`);
});

test(`a Nextcloud share link becomes its download address`, () => {
  const plain = I.pictureAt(`https://cloud.example.org/s/AbC123`, 1);
  assert.equal(plain.drive, `nextcloud`);
  assert.deepEqual(plain.candidates, [`https://cloud.example.org/s/AbC123/download`]);
  assert.deepEqual(I.pictureAt(`https://cloud.example.org/index.php/s/AbC123/`, 1).candidates, [`https://cloud.example.org/index.php/s/AbC123/download`]);
  assert.deepEqual(I.pictureAt(`https://cloud.example.org/s/AbC123#frag`, 1).candidates, [`https://cloud.example.org/s/AbC123/download`]);
});

test(`Google Drive and kDrive links are converted, OneDrive is recognised`, () => {
  const google = I.pictureAt(`https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing`, 1);
  assert.equal(google.drive, `google`);
  assert.equal(google.candidates[0], `https://lh3.googleusercontent.com/d/1AbCdEfGhIjK`);
  assert.equal(I.pictureAt(`https://drive.google.com/open?id=1AbCdEfGhIjK`, 1).drive, `google`);
  const kdrive = I.pictureAt(`https://kdrive.infomaniak.com/app/share/123/0a1b2c3d-1111-2222-3333-444455556666/preview/image/77`, 1);
  assert.equal(kdrive.drive, `kdrive`);
  assert.equal(kdrive.candidates[0], `https://kdrive.infomaniak.com/2/app/123/share/0a1b2c3d-1111-2222-3333-444455556666/files/77/download`);
  assert.equal(I.pictureAt(`https://1drv.ms/i/abc`, 1).status, `onedrive`);
  assert.equal(I.pictureAt(`https://onedrive.live.com/redir?x=1`, 1).status, `onedrive`);
});

test(`links that are not safe pictures are refused with a reason`, () => {
  assert.deepEqual(I.pictureAt(`http://example.org/a.png`, 1), { status: `rejected`, reason: `link`, text: `http://example.org/a.png` });
  assert.equal(I.pictureAt(`https://user:pass@example.org/a.png`, 1).reason, `link`);
  assert.equal(I.pictureAt(`javascript:alert(1)`, 1).reason, `link`);
  assert.equal(I.pictureAt(`not a link`, 1).reason, `link`);
  assert.equal(I.pictureAt(`https://example.org/plan.PDF`, 1).reason, `format`);
  assert.equal(I.pictureAt(`https://example.org/scan.tiff`, 1).reason, `format`);
  assert.ok(I.pictureAt(`x`.repeat(200), 1).text.length <= 61);
});

test(`the rank is a whole number from 1 and a cell is cut at the maximum`, () => {
  const cell = [`L`, 5, 6];
  assert.equal(I.pictureAt(cell, 0).id, 5);
  assert.equal(I.pictureAt(cell, 2.9).id, 6);
  assert.equal(I.pictureAt(cell, `x`).id, 5);
  const many = [`L`, ...Array.from({ length: 500 }, (_, i) => i + 1)];
  assert.equal(I.countImages(many), I.MAX_IMAGES);
});
