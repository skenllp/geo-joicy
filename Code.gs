// ============================================================
//  Code.gs — Google Apps Script for Geo & Joicy Wedding RSVP
//
//  HOW TO DEPLOY / UPDATE:
//  1. Go to script.google.com → Open your RSVP project
//  2. Paste this ENTIRE file into Code.gs and save (Ctrl+S)
//  3. Click Deploy → Manage deployments
//  4. Click the Edit (pencil) icon next to your active deployment
//  5. Under Version, select "New version"
//  6. Click Deploy!
// ============================================================

var HEADERS = ['Timestamp', 'Name', 'Wish'];

/* ── Get or create the RSVP sheet ── */
function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('RSVP');

  if (!sheet) {
    sheet = ss.insertSheet('RSVP');
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange
      .setFontWeight('bold')
      .setBackground('#2E4E2E')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 3, 180);
    sheet.setColumnWidth(2, 200); // Name
    sheet.setColumnWidth(3, 400); // Wish
  }

  return sheet;
}

/* ── Handle GET requests ── */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'getWishes') {
    return getWishesResponse();
  }

  return jsonResponse({ result: 'ok', message: 'RSVP API is running.' });
}

/* ── Handle POST requests (form submission) ── */
function doPost(e) {
  try {
    var data = (e && e.parameter) ? e.parameter : {};

    /* Fallback: parse postData if parameters are missing */
    if ((!data.name || !data.wish) && e && e.postData && e.postData.contents) {
      try {
        var parsed = JSON.parse(e.postData.contents);
        data.name = data.name || parsed.name;
        data.wish = data.wish || parsed.wish;
        data.timestamp = data.timestamp || parsed.timestamp;
      } catch (x) {
        e.postData.contents.split('&').forEach(function (pair) {
          var idx = pair.indexOf('=');
          if (idx < 0) return;
          var key = decodeURIComponent(pair.substring(0, idx).replace(/\+/g, ' '));
          var value = decodeURIComponent(pair.substring(idx + 1).replace(/\+/g, ' '));
          data[key] = data[key] || value;
        });
      }
    }

    var nameVal = String(data.name || '').trim();
    var wishVal = String(data.wish || '').trim();
    var timeVal = String(data.timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

    var sheet = getSheet();
    var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 3)).getValues()[0];

    // Find column index for Wish and Name
    var nameIdx = 1;
    var wishIdx = 2;
    for (var i = 0; i < headerRow.length; i++) {
      var h = String(headerRow[i] || '').trim().toLowerCase();
      if (h === 'name') nameIdx = i;
      if (h === 'wish' || h === 'wishes') wishIdx = i;
    }

    // Build row matching current sheet header columns
    var rowLen = Math.max(headerRow.length, wishIdx + 1);
    var rowData = [];
    for (var k = 0; k < rowLen; k++) { rowData.push(''); }
    rowData[0] = timeVal;
    rowData[nameIdx] = nameVal;
    rowData[wishIdx] = wishVal;

    sheet.appendRow(rowData);

    return jsonResponse({ result: 'success' });

  } catch (err) {
    return jsonResponse({ result: 'error', message: err.message });
  }
}

/* ── Return wishes as JSON ── */
function getWishesResponse() {
  try {
    var sheet = getSheet();
    var last  = sheet.getLastRow();

    if (last <= 1) {
      return jsonResponse({ wishes: [] });
    }

    var lastCol = sheet.getLastColumn();
    var rows   = sheet.getRange(1, 1, last, lastCol).getValues();
    var headerRow = rows[0];

    var nameIdx = 1;
    var wishIdx = lastCol - 1;
    for (var i = 0; i < headerRow.length; i++) {
      var h = String(headerRow[i] || '').trim().toLowerCase();
      if (h === 'name') nameIdx = i;
      if (h === 'wish' || h === 'wishes') wishIdx = i;
    }

    var wishes = [];

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var name = String(row[nameIdx] || '').trim();
      var wish = String(row[wishIdx] || '').trim();
      if (name && wish) {
        wishes.push({ name: name, wish: wish });
      }
    }

    /* Newest first */
    wishes.reverse();

    return jsonResponse({ wishes: wishes });

  } catch (err) {
    return jsonResponse({ wishes: [], error: err.message });
  }
}

/* ── JSON response helper with CORS header ── */
function jsonResponse(obj) {
  var output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
