/**
 * Feedback-ontvanger voor de feedpreviews van Cohezy.
 * Eén Google Sheet voor alle klanten: elke reactie wordt een rij.
 * Plaats dit script via Extensies > Apps Script in een Google Sheet (zie LEESMIJ).
 */
const TAB = 'Feedback';

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.appendRow(['Tijd', 'Klant', 'Post', 'Type', 'Over', 'Tekst', 'Naam']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Leest de feedback van één klant (de preview toont die terug)
function doGet(e) {
  const client = (e && e.parameter && e.parameter.client) || '';
  const values = sheet_().getDataRange().getValues();
  values.shift();
  const out = values
    .filter(r => r[1] === client)
    .map(r => ({ at: r[0], client: r[1], post: r[2], type: r[3], target: r[4], text: r[5], name: r[6] }));
  return json_(out);
}

// Bewaart een goedkeuring of reactie
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    const type = d.type === 'status' ? 'status' : 'comment';
    sheet_().appendRow([
      new Date(),
      String(d.client || '').slice(0, 80),
      String(d.post || '').slice(0, 80),
      type,
      String(d.target || '').slice(0, 20),
      String(d.text || '').slice(0, 2000),
      String(d.name || '').slice(0, 80)
    ]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
