/**
 * import-export.js - Import/Export Items for ABC_Store
 *
 * Export: Downloads items as CSV file
 * Import: Reads CSV file, validates, and adds/updates items in DB
 *
 * CSV Format:
 * ItemCode,Name,BaseUnit,Price,VoiceTag
 * ITM001,Rice,kg,80,rice
 * ITM002,Milk,litre,60,milk
 * ITM003,Eggs,count,7,eggs
 */

const ImportExport = (function () {
  'use strict';

  function init() {
    var exportBtn = document.getElementById('export-items-btn');
    var importBtn = document.getElementById('import-items-btn');
    var fileInput = document.getElementById('import-file-input');

    if (exportBtn) exportBtn.addEventListener('click', exportItems);
    if (importBtn) importBtn.addEventListener('click', function () {
      if (fileInput) fileInput.click();
    });
    if (fileInput) fileInput.addEventListener('change', handleImportFile);
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  /**
   * Export all items as a CSV file download.
   */
  async function exportItems() {
    var items = [];
    try {
      items = await DB.getAllItems();
    } catch (e) {
      alert('Failed to load items for export.');
      return;
    }

    if (items.length === 0) {
      alert('No items to export.');
      return;
    }

    // Build CSV
    var csv = 'ItemCode,Name,BaseUnit,Price,VoiceTag\n';
    items.forEach(function (item) {
      var code = escapeCsvField(item.itemCode || '');
      var name = escapeCsvField(item.name || '');
      var unit = item.baseUnit || 'kg';
      var price = Number(item.basePricePerKg || 0).toFixed(2);
      var voiceTag = escapeCsvField(item.voiceTag || '');
      csv += code + ',' + name + ',' + unit + ',' + price + ',' + voiceTag + '\n';
    });

    // Download
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'items_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ─── Import ─────────────────────────────────────────────────────────────────

  /**
   * Handle file selection for import.
   */
  function handleImportFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      var csvText = e.target.result;
      processImport(csvText);
    };
    reader.onerror = function () {
      alert('Failed to read file.');
    };
    reader.readAsText(file);

    // Reset file input so same file can be imported again
    event.target.value = '';
  }

  /**
   * Parse CSV and import items into DB.
   * - If ItemCode already exists: updates the item
   * - If ItemCode is new: creates the item
   */
  async function processImport(csvText) {
    var lines = csvText.split(/\r?\n/).filter(function (l) { return l.trim(); });

    if (lines.length < 2) {
      alert('CSV file is empty or has no data rows.');
      return;
    }

    // Parse header
    var header = parseCSVLine(lines[0]);
    var headerLower = header.map(function (h) { return h.toLowerCase().trim(); });

    var codeIdx = headerLower.indexOf('itemcode');
    var nameIdx = headerLower.indexOf('name');
    var unitIdx = headerLower.indexOf('baseunit');
    var priceIdx = headerLower.indexOf('price');
    var voiceIdx = headerLower.indexOf('voicetag');

    if (nameIdx === -1 || priceIdx === -1) {
      alert('CSV must have at least "Name" and "Price" columns.');
      return;
    }

    // Load existing items for matching by ItemCode
    var existingItems = [];
    try {
      existingItems = await DB.getAllItems();
    } catch (e) {
      existingItems = [];
    }

    var imported = 0;
    var updated = 0;
    var errors = [];

    for (var i = 1; i < lines.length; i++) {
      var fields = parseCSVLine(lines[i]);
      if (fields.length < 2) continue;

      var name = nameIdx >= 0 && fields[nameIdx] ? fields[nameIdx].trim() : '';
      var price = priceIdx >= 0 ? parseFloat(fields[priceIdx]) : 0;
      var itemCode = codeIdx >= 0 && fields[codeIdx] ? fields[codeIdx].trim().toUpperCase() : '';
      var baseUnit = unitIdx >= 0 && fields[unitIdx] ? fields[unitIdx].trim().toLowerCase() : 'kg';
      var voiceTag = voiceIdx >= 0 && fields[voiceIdx] ? fields[voiceIdx].trim() : '';

      if (!name) {
        errors.push('Row ' + (i + 1) + ': missing name');
        continue;
      }
      if (isNaN(price) || price <= 0) {
        errors.push('Row ' + (i + 1) + ': invalid price');
        continue;
      }
      if (!['kg', 'litre', 'count'].includes(baseUnit)) {
        baseUnit = 'kg';
      }

      // Check if item exists by ItemCode
      var existingItem = itemCode ? existingItems.find(function (ei) {
        return ei.itemCode && ei.itemCode.toUpperCase() === itemCode;
      }) : null;

      var now = new Date().toISOString();

      if (existingItem) {
        // Update existing
        existingItem.name = name;
        existingItem.basePricePerKg = price;
        existingItem.baseUnit = baseUnit;
        existingItem.voiceTag = voiceTag || existingItem.voiceTag;
        existingItem.updatedAt = now;
        try {
          await DB.updateItem(existingItem);
          updated++;
        } catch (e) {
          errors.push('Row ' + (i + 1) + ': update failed');
        }
      } else {
        // Create new
        var newItem = {
          id: Utils.generateId(),
          name: name,
          itemCode: itemCode || _autoGenerateCode(existingItems, imported),
          basePricePerKg: price,
          baseUnit: baseUnit,
          voiceTag: voiceTag,
          imageBase64: null,
          createdAt: now,
          updatedAt: now
        };
        try {
          await DB.addItem(newItem);
          existingItems.push(newItem);
          imported++;
        } catch (e) {
          errors.push('Row ' + (i + 1) + ': add failed');
        }
      }
    }

    // Show results
    var msg = 'Import complete!\n' +
      'New items: ' + imported + '\n' +
      'Updated: ' + updated;
    if (errors.length > 0) {
      msg += '\nErrors: ' + errors.length + '\n' + errors.slice(0, 5).join('\n');
    }
    alert(msg);

    // Refresh item list
    if (typeof ItemMaster !== 'undefined' && ItemMaster.loadAndRenderItems) {
      ItemMaster.loadAndRenderItems();
    }
  }

  /**
   * Auto-generate an item code for imports without one.
   */
  function _autoGenerateCode(existingItems, offset) {
    var maxNum = 0;
    existingItems.forEach(function (item) {
      if (item.itemCode) {
        var match = item.itemCode.match(/^ITM(\d+)$/i);
        if (match) {
          var num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    return 'ITM' + String(maxNum + 1 + offset).padStart(3, '0');
  }

  // ─── CSV Helpers ────────────────────────────────────────────────────────────

  /**
   * Escape a field for CSV (wrap in quotes if it contains comma, quote, or newline).
   */
  function escapeCsvField(str) {
    if (!str) return '';
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Parse a single CSV line into an array of fields.
   * Handles quoted fields with commas inside.
   */
  function parseCSVLine(line) {
    var fields = [];
    var current = '';
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    init: init,
    exportItems: exportItems
  };

})();
