// Reads the cell of an image block: an Attachments cell (a list of numbers) or a text cell with one https link
// per line, and gives the picture at the chosen rank. Share links of Nextcloud, Google Drive and kDrive are turned
// into addresses that a picture element can load. The link rules come from the image_plus widget of the same
// author (MIT licence). This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  // A cell with more pictures than this is cut, so that a pasted list can never flood the page.
  const MAX_IMAGES = 200;
  const MAX_SAMPLE = 60;
  // File types that a browser cannot show as a picture: a link that ends with one of them is reported.
  const UNSUPPORTED = new Set([`pdf`, `dxf`, `dwg`, `tif`, `tiff`, `heic`, `heif`, `raw`, `psd`, `ai`, `eps`]);
  // A Nextcloud public share: .../s/CODE or .../index.php/s/CODE, with or without a final slash.
  const NEXTCLOUD_SHARE = /^(.*\/s\/[A-Za-z0-9._-]+)\/?$/;
  const GOOGLE_ID = /^[A-Za-z0-9_-]{10,}$/;
  // The page that shows one picture of a kDrive share: /app/share/DRIVE/UUID/preview/TYPE/FILE.
  const KDRIVE_PREVIEW = /^\/app\/share\/(\d+)\/([0-9a-fA-F-]{20,})\/preview\/[a-z]+\/(\d+)\/?$/;
  const ONEDRIVE_HOSTS = new Set([`1drv.ms`, `onedrive.live.com`]);

  // Accepts only an absolute https link without credentials; returns the URL object or null.
  function parseHttpsUrl(text) {
    let url;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    return url.protocol === `https:` && !url.username && !url.password ? url : null;
  }

  // Lower-case extension of the last path segment of a link, or an empty text.
  function extensionOf(url) {
    const last = url.pathname.split(`/`).filter(Boolean).pop() || ``;
    let decoded = last;
    try {
      decoded = decodeURIComponent(last);
    } catch {
      // A malformed percent sequence: the raw segment is used.
    }
    const dot = decoded.lastIndexOf(`.`);
    return dot < 0 ? `` : decoded.slice(dot + 1).toLowerCase();
  }

  // Google Drive: file/d/ID/view, open?id=ID or uc?id=ID.
  function googleDrive(url) {
    const fromPath = /^\/file\/d\/([^/]+)/.exec(url.pathname);
    const id = fromPath ? fromPath[1] : url.searchParams.get(`id`);
    const isOpen = /^\/(open|uc)$/.test(url.pathname);
    if (!id || !GOOGLE_ID.test(id) || !(fromPath || isOpen)) return null;
    return { candidates: [`https://lh3.googleusercontent.com/d/${id}`, `https://drive.google.com/uc?export=view&id=${id}`], drive: `google` };
  }

  // kDrive: the address of the shared file, known only from the page that shows the picture (.../preview/image/NUMBER).
  function kDrive(url) {
    const page = KDRIVE_PREVIEW.exec(url.pathname);
    if (!page) return null;
    const base = `https://kdrive.infomaniak.com/2/app/${page[1]}/share/${page[2]}/files/${page[3]}`;
    return { candidates: [`${base}/download`, `${base}/preview`], drive: `kdrive` };
  }

  // The addresses to try for an https link, the most likely first, and the drive that was recognised.
  function toImageUrl(href) {
    const url = new URL(href);
    if (url.hostname === `drive.google.com`) return googleDrive(url) || { candidates: [url.href], drive: `direct` };
    if (ONEDRIVE_HOSTS.has(url.hostname)) return { candidates: [url.href], drive: `onedrive` };
    if (url.hostname === `kdrive.infomaniak.com`) return kDrive(url) || { candidates: [url.href], drive: `direct` };
    const share = NEXTCLOUD_SHARE.exec(url.pathname);
    if (!share) return { candidates: [url.href], drive: `direct` };
    // The download address of a share gives the file itself instead of the page of the share.
    url.pathname = `${share[1]}/download`;
    url.hash = ``;
    return { candidates: [url.href], drive: `nextcloud` };
  }

  // The entries of a cell, in order: { kind: `attachment`, id } or { kind: `link`, text }. Blank lines are skipped.
  function entriesOf(raw) {
    const entries = [];
    if (Array.isArray(raw)) {
      for (const id of raw) if (Number.isInteger(id) && id > 0) entries.push({ kind: `attachment`, id });
    } else if (typeof raw === `string`) {
      for (const line of raw.split(/\r?\n/)) if (line.trim()) entries.push({ kind: `link`, text: line.trim() });
    }
    return entries.slice(0, MAX_IMAGES);
  }

  // The number of pictures that a cell holds.
  function countImages(raw) {
    return entriesOf(raw).length;
  }

  // The picture at the rank `rank` (1 is the first) of a cell. Returns one of
  //   { status: `empty` }                            nothing at this rank
  //   { status: `attachment`, id }                   an attachment of the document
  //   { status: `link`, candidates, drive }          an https link, with the addresses to try in turn
  //   { status: `rejected`, reason, text }           `link` (not https) or `format` (not a picture), with a sample
  //   { status: `onedrive`, href }                   a OneDrive link, which cannot be shown in another page
  function pictureAt(raw, rank) {
    const entry = entriesOf(raw)[Math.max(1, Math.floor(rank) || 1) - 1];
    if (!entry) return { status: `empty` };
    if (entry.kind === `attachment`) return { status: `attachment`, id: entry.id };
    const sample = entry.text.length > MAX_SAMPLE ? `${entry.text.slice(0, MAX_SAMPLE)}…` : entry.text;
    const url = parseHttpsUrl(entry.text);
    if (!url) return { status: `rejected`, reason: `link`, text: sample };
    if (UNSUPPORTED.has(extensionOf(url))) return { status: `rejected`, reason: `format`, text: sample };
    const converted = toImageUrl(url.href);
    if (converted.drive === `onedrive`) return { status: `onedrive`, href: url.href };
    return { status: `link`, candidates: converted.candidates, drive: converted.drive };
  }

  const api = { pictureAt, countImages, MAX_IMAGES };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbImage = api;
})(typeof window !== `undefined` ? window : globalThis);
