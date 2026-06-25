/**
 * barcode.js - Barcode Generation, Printing & Scanning Module for ABC_Store
 *
 * Features:
 * - Generate unique barcodes for each item (Code128)
 * - Select specific items for barcode generation
 * - Generate barcodes for standard quantities (per unit type)
 * - Print barcode reports (items + quantities)
 * - Scan barcodes via camera using BarcodeDetector API
 * - Auto-add scanned item+quantity pairs to billing
 */

const BarcodeModule = (function () {
  'use strict';

  const BARCODE_PREFIX_ITEM = 'ITM-';
  const BARCODE_PREFIX_QTY = 'QTY-';

  // Standard quantities for each unit type
  const QTY_PRESETS = {
    kg: [
      { value: 50, label: '50g' },
      { value: 100, label: '100g' },
      { value: 250, label: '250g' },
      { value: 500, label: '500g' },
      { value: 750, label: '750g' },
      { value: 1000, label: '1 KG' },
      { value: 2000, label: '2 KG' }
    ],
    litre: [
      { value: 50, label: '50ml' },
      { value: 100, label: '100ml' },
      { value: 250, label: '250ml' },
      { value: 500, label: '500ml' },
      { value: 750, label: '750ml' },
      { value: 1000, label: '1 L' },
      { value: 2000, label: '2 L' }
    ],
    count: [
      { value: 1, label: '1 Nos' },
      { value: 2, label: '2 Nos' },
      { value: 3, label: '3 Nos' },
      { value: 5, label: '5 Nos' },
      { value: 6, label: '6 Nos' },
      { value: 10, label: '10 Nos' },
      { value: 12, label: '12 Nos' }
    ]
  };

  // Scanning state
  let scannerActive = false;
  let videoStream = null;
  let barcodeDetector = null;
  let scanInterval = null;
  let pendingItemId = null;

  // ─── Initialization ─────────────────────────────────────────────────────────

  function init() {
    var printItemsBtn = document.getElementById('print-item-barcodes-btn');
    var printQtyBtn = document.getElementById('print-qty-barcodes-btn');
    var scanBtn = document.getElementById('barcode-scan-btn');

    if (printItemsBtn) printItemsBtn.addEventListener('click', printItemBarcodes);
    if (printQtyBtn) printQtyBtn.addEventListener('click', printQuantityBarcodes);
    if (scanBtn) scanBtn.addEventListener('click', toggleScanner);

    if ('BarcodeDetector' in window) {
      barcodeDetector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code', 'data_matrix', 'aztec', 'ean_13', 'ean_8'] });
    }
  }

  // ─── Barcode Value Generators ───────────────────────────────────────────────

  function getItemBarcodeValue(item) {
    // Use itemCode if available (user-visible, stable), otherwise fall back to ID fragment
    if (item.itemCode) {
      return BARCODE_PREFIX_ITEM + item.itemCode.toUpperCase();
    }
    return BARCODE_PREFIX_ITEM + item.id.substring(0, 8).toUpperCase();
  }

  function getQtyBarcodeValue(unit, value) {
    var unitCode = unit === 'litre' ? 'L' : (unit === 'count' ? 'NOS' : 'KG');
    return BARCODE_PREFIX_QTY + unitCode + '-' + value;
  }

  // ─── Print Item Barcodes (with selection) ───────────────────────────────────

  async function printItemBarcodes() {
    var items = [];
    try {
      items = await DB.getAllItems();
    } catch (e) {
      alert('Failed to load items.');
      return;
    }

    if (items.length === 0) {
      alert('No items to print. Add items in Item Master first.');
      return;
    }

    // Show selection modal
    showItemSelectionModal(items, function (selectedItems, barcodeType) {
      if (selectedItems.length === 0) {
        alert('No items selected.');
        return;
      }
      generateItemBarcodePrintPage(selectedItems, barcodeType);
    });
  }

  /**
   * Show a modal with checkboxes to select items and barcode type.
   */
  function showItemSelectionModal(items, onConfirm) {
    var existing = document.getElementById('barcode-select-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'barcode-select-modal';
    overlay.className = 'modal-overlay';

    var itemListHtml = items.map(function (item, idx) {
      return '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee;cursor:pointer;">' +
        '<input type="checkbox" class="bc-item-check" data-idx="' + idx + '" checked style="width:18px;height:18px;">' +
        '<span style="font-size:0.875rem;">' + item.name + '</span>' +
      '</label>';
    }).join('');

    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-header">' +
          '<h2 class="modal-title">Select Items for Barcode</h2>' +
          '<button class="modal-close" id="bc-select-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="max-height:50vh;overflow-y:auto;">' +
          '<div style="margin-bottom:12px;">' +
            '<label style="font-size:0.75rem;font-weight:600;color:#5f6368;display:block;margin-bottom:6px;">Barcode Type:</label>' +
            '<div style="display:flex;gap:8px;">' +
              '<label style="flex:1;display:flex;align-items:center;gap:4px;padding:8px;border:1.5px solid #dadce0;border-radius:8px;cursor:pointer;font-size:0.8rem;">' +
                '<input type="radio" name="bc-type" value="code128" checked> Code128 (1D)' +
              '</label>' +
              '<label style="flex:1;display:flex;align-items:center;gap:4px;padding:8px;border:1.5px solid #dadce0;border-radius:8px;cursor:pointer;font-size:0.8rem;">' +
                '<input type="radio" name="bc-type" value="qr"> QR Code (2D)' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
            '<button id="bc-select-all" class="btn-secondary" style="flex:1;min-height:32px;font-size:0.75rem;">Select All</button>' +
            '<button id="bc-deselect-all" class="btn-secondary" style="flex:1;min-height:32px;font-size:0.75rem;">Deselect All</button>' +
          '</div>' +
          itemListHtml +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn-secondary" id="bc-select-cancel">Cancel</button>' +
          '<button class="btn-primary" id="bc-select-print">Print Selected</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('active'); });

    document.getElementById('bc-select-close').addEventListener('click', function () { closeSelectionModal(overlay); });
    document.getElementById('bc-select-cancel').addEventListener('click', function () { closeSelectionModal(overlay); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSelectionModal(overlay); });

    document.getElementById('bc-select-all').addEventListener('click', function () {
      overlay.querySelectorAll('.bc-item-check').forEach(function (cb) { cb.checked = true; });
    });
    document.getElementById('bc-deselect-all').addEventListener('click', function () {
      overlay.querySelectorAll('.bc-item-check').forEach(function (cb) { cb.checked = false; });
    });

    document.getElementById('bc-select-print').addEventListener('click', function () {
      var selected = [];
      overlay.querySelectorAll('.bc-item-check:checked').forEach(function (cb) {
        var idx = parseInt(cb.getAttribute('data-idx'), 10);
        selected.push(items[idx]);
      });
      var typeRadio = overlay.querySelector('input[name="bc-type"]:checked');
      var barcodeType = typeRadio ? typeRadio.value : 'code128';
      closeSelectionModal(overlay);
      onConfirm(selected, barcodeType);
    });
  }

  function closeSelectionModal(overlay) {
    overlay.classList.remove('active');
    setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 300);
  }

  /**
   * Get the base URL of the app for script references in print pages.
   */
  function getBaseUrl() {
    var loc = window.location;
    var path = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
    return loc.origin + path;
  }

  /**
   * Generate the printable barcode page for selected items.
   * @param {Array} items - Selected items
   * @param {string} barcodeType - 'code128' or 'qr'
   */
  function generateItemBarcodePrintPage(items, barcodeType) {
    var storeName = (typeof Settings !== 'undefined') ? Settings.getStoreName() : 'ABC Store';
    var isQR = barcodeType === 'qr';
    var baseUrl = getBaseUrl();

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
    html += '<title>' + storeName + ' - Item Barcodes</title>';
    html += '<style>';
    html += 'body { font-family: Arial, sans-serif; padding: 20px; }';
    html += 'h1 { text-align: center; font-size: 18px; margin-bottom: 20px; }';
    html += '.barcode-grid { display: grid; grid-template-columns: repeat(' + (isQR ? '4' : '3') + ', 1fr); gap: 16px; }';
    html += '.barcode-card { border: 1px solid #ccc; padding: 12px; text-align: center; border-radius: 4px; page-break-inside: avoid; }';
    html += '.barcode-card .item-name { font-size: 18px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; }';
    html += '.barcode-card svg, .barcode-card canvas { max-width: 100%; }';
    html += '.barcode-card .barcode-text { font-size: 9px; color: #999; margin-top: 4px; }';
    html += '@media print { .no-print { display: none; } body { padding: 10px; } }';
    html += '</style>';
    if (!isQR) {
      html += '<script src="' + baseUrl + 'js/jsbarcode.min.js"><\/script>';
    } else {
      html += '<script src="' + baseUrl + 'js/qrcode-lib.js"><\/script>';
    }
    html += '</head><body>';
    html += '<h1>' + storeName + ' - Item Barcodes (' + (isQR ? 'QR' : 'Code128') + ')</h1>';
    html += '<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;font-size:14px;">&#x1F5A8; Print</button>';
    html += '<div class="barcode-grid">';

    items.forEach(function (item) {
      var barcodeVal = getItemBarcodeValue(item);
      var safeId = barcodeVal.replace(/[^a-zA-Z0-9]/g, '_');
      html += '<div class="barcode-card">';
      html += '<div class="item-name">' + item.name + '</div>';
      if (isQR) {
        html += '<canvas id="bc-' + safeId + '"></canvas>';
      } else {
        html += '<svg id="bc-' + safeId + '"></svg>';
      }
      html += '<div class="barcode-text">' + barcodeVal + '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '<script>';
    html += 'document.addEventListener("DOMContentLoaded", function() {';
    if (isQR) {
      items.forEach(function (item) {
        var barcodeVal = getItemBarcodeValue(item);
        var safeId = barcodeVal.replace(/[^a-zA-Z0-9]/g, '_');
        html += 'try { var qr = qrcode(0, "M"); qr.addData("' + barcodeVal + '"); qr.make();';
        html += 'var canvas = document.getElementById("bc-' + safeId + '");';
        html += 'var modules = qr.getModuleCount(); var cell = Math.max(4, Math.floor(200 / modules)); var quiet = cell * 2;';
        html += 'canvas.width = cell * modules + quiet * 2; canvas.height = cell * modules + quiet * 2;';
        html += 'var ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);';
        html += 'ctx.fillStyle = "#000";';
        html += 'for (var r = 0; r < modules; r++) { for (var c = 0; c < modules; c++) { if (qr.isDark(r, c)) ctx.fillRect(quiet + c * cell, quiet + r * cell, cell, cell); } }';
        html += '} catch(e) { console.error(e); }';
      });
    } else {
      items.forEach(function (item) {
        var barcodeVal = getItemBarcodeValue(item);
        var safeId = barcodeVal.replace(/[^a-zA-Z0-9]/g, '_');
        html += 'try { JsBarcode("#bc-' + safeId + '", "' + barcodeVal + '", { format: "CODE128", height: 60, fontSize: 12, margin: 10, width: 2 }); } catch(e) {}';
      });
    }
    html += '});';
    html += '<\/script>';
    html += '</body></html>';

    var printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
  }

  // ─── Print Quantity Barcodes ────────────────────────────────────────────────

  function printQuantityBarcodes() {
    // Ask for barcode type
    showBarcodeTypeChoice(function (barcodeType) {
      generateQtyBarcodePrintPage(barcodeType);
    });
  }

  /**
   * Show a simple barcode type chooser modal.
   */
  function showBarcodeTypeChoice(onConfirm) {
    var existing = document.getElementById('bc-type-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'bc-type-modal';
    overlay.className = 'modal-overlay';

    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-header">' +
          '<h2 class="modal-title">Barcode Type</h2>' +
          '<button class="modal-close" id="bct-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="text-align:center;">' +
          '<p style="font-size:0.8rem;color:#5f6368;margin-bottom:12px;">Choose barcode format for quantity barcodes:</p>' +
          '<div style="display:flex;gap:12px;justify-content:center;">' +
            '<button id="bct-code128" class="btn-primary" style="flex:1;">Code128 (1D)</button>' +
            '<button id="bct-qr" class="btn-primary" style="flex:1;background:#34a853;">QR Code (2D)</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('active'); });

    document.getElementById('bct-close').addEventListener('click', function () { closeSelectionModal(overlay); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSelectionModal(overlay); });

    document.getElementById('bct-code128').addEventListener('click', function () {
      closeSelectionModal(overlay);
      onConfirm('code128');
    });
    document.getElementById('bct-qr').addEventListener('click', function () {
      closeSelectionModal(overlay);
      onConfirm('qr');
    });
  }

  /**
   * Generate quantity barcode print page.
   */
  function generateQtyBarcodePrintPage(barcodeType) {
    var storeName = (typeof Settings !== 'undefined') ? Settings.getStoreName() : 'ABC Store';
    var isQR = barcodeType === 'qr';
    var baseUrl = getBaseUrl();

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
    html += '<title>' + storeName + ' - Quantity Barcodes</title>';
    html += '<style>';
    html += 'body { font-family: Arial, sans-serif; padding: 20px; }';
    html += 'h1 { text-align: center; font-size: 18px; margin-bottom: 10px; }';
    html += 'h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }';
    html += '.barcode-grid { display: grid; grid-template-columns: repeat(' + (isQR ? '4' : '2') + ', 1fr); gap: 16px; margin-bottom: 20px; }';
    html += '.barcode-card { border: 1px solid #ccc; padding: 14px; text-align: center; border-radius: 4px; page-break-inside: avoid; }';
    html += '.barcode-card .qty-label { font-size: 18px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }';
    html += '.barcode-card svg, .barcode-card canvas { max-width: 100%; }';
    html += '.barcode-card .barcode-text { font-size: 8px; color: #999; margin-top: 4px; }';
    html += '@media print { .no-print { display: none; } }';
    html += '</style>';
    if (!isQR) {
      html += '<script src="' + baseUrl + 'js/jsbarcode.min.js"><\/script>';
    } else {
      html += '<script src="' + baseUrl + 'js/qrcode-lib.js"><\/script>';
    }
    html += '</head><body>';
    html += '<h1>' + storeName + ' - Quantity Barcodes (' + (isQR ? 'QR' : 'Code128') + ')</h1>';
    html += '<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;font-size:14px;">&#x1F5A8; Print</button>';

    var allBarcodes = [];
    var unitLabels = { kg: 'Weight (KG)', litre: 'Volume (Litre)', count: 'Count (Numbers)' };

    ['kg', 'litre', 'count'].forEach(function (unit) {
      html += '<h2>' + unitLabels[unit] + '</h2>';
      html += '<div class="barcode-grid">';
      QTY_PRESETS[unit].forEach(function (preset) {
        var barcodeVal = getQtyBarcodeValue(unit, preset.value);
        var safeId = barcodeVal.replace(/[^a-zA-Z0-9]/g, '_');
        allBarcodes.push({ id: safeId, value: barcodeVal });
        html += '<div class="barcode-card">';
        html += '<div class="qty-label">' + preset.label + '</div>';
        if (isQR) {
          html += '<canvas id="bc-' + safeId + '"></canvas>';
        } else {
          html += '<svg id="bc-' + safeId + '"></svg>';
        }
        html += '<div class="barcode-text">' + barcodeVal + '</div>';
        html += '</div>';
      });
      html += '</div>';
    });

    html += '<script>';
    html += 'document.addEventListener("DOMContentLoaded", function() {';
    if (isQR) {
      allBarcodes.forEach(function (bc) {
        html += 'try { var qr = qrcode(0, "M"); qr.addData("' + bc.value + '"); qr.make();';
        html += 'var canvas = document.getElementById("bc-' + bc.id + '");';
        html += 'var modules = qr.getModuleCount(); var cell = Math.max(4, Math.floor(160 / modules)); var quiet = cell * 2;';
        html += 'canvas.width = cell * modules + quiet * 2; canvas.height = cell * modules + quiet * 2;';
        html += 'var ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);';
        html += 'ctx.fillStyle = "#000";';
        html += 'for (var r = 0; r < modules; r++) { for (var c = 0; c < modules; c++) { if (qr.isDark(r, c)) ctx.fillRect(quiet + c * cell, quiet + r * cell, cell, cell); } }';
        html += '} catch(e) { console.error(e); }';
      });
    } else {
      allBarcodes.forEach(function (bc) {
        html += 'try { JsBarcode("#bc-' + bc.id + '", "' + bc.value + '", { format: "CODE128", height: 60, fontSize: 12, margin: 10, width: 2 }); } catch(e) {}';
      });
    }
    html += '});';
    html += '<\/script>';
    html += '</body></html>';

    var printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
  }

  // ─── Barcode Scanner ────────────────────────────────────────────────────────

  function toggleScanner() {
    if (scannerActive) {
      stopScanner();
    } else {
      startScanner();
    }
  }

  async function startScanner() {
    if (!barcodeDetector) {
      alert('Barcode scanning is not supported in this browser. Use Chrome on Android.');
      return;
    }

    var scanBtn = document.getElementById('barcode-scan-btn');

    // Create full-screen scanner overlay
    var scanArea = document.getElementById('barcode-scan-area');
    if (scanArea) scanArea.remove();

    scanArea = document.createElement('div');
    scanArea.id = 'barcode-scan-area';
    scanArea.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;background:#000;display:flex;flex-direction:column;';
    scanArea.innerHTML =
      '<div style="position:relative;flex:1;overflow:hidden;">' +
        '<video id="barcode-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;"></video>' +
        '<div style="position:absolute;top:50%;left:10%;right:10%;height:2px;background:red;opacity:0.8;"></div>' +
        '<div id="scan-status-bar" style="position:absolute;top:0;left:0;right:0;padding:12px 16px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.8rem;text-align:center;">Scan an item barcode...</div>' +
      '</div>' +
      '<button id="barcode-stop-btn" style="flex:0 0 auto;padding:16px;background:#ea4335;color:#fff;border:none;font-size:1rem;font-weight:600;cursor:pointer;">✕ Close Scanner</button>';

    document.body.appendChild(scanArea);

    var video = document.getElementById('barcode-video');

    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = videoStream;
      await video.play();

      scannerActive = true;
      if (scanBtn) {
        scanBtn.textContent = '⏹️ Stop Scanner';
        scanBtn.classList.add('active');
      }

      // Close button handler
      document.getElementById('barcode-stop-btn').addEventListener('click', stopScanner);

      scanInterval = setInterval(function () { detectBarcode(video); }, 500);
    } catch (e) {
      console.error('Scanner: Failed to access camera', e);
      alert('Could not access camera. Please allow camera permission.');
      if (scanArea) scanArea.remove();
    }
  }

  function stopScanner() {
    scannerActive = false;
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    if (videoStream) { videoStream.getTracks().forEach(function (t) { t.stop(); }); videoStream = null; }

    var scanArea = document.getElementById('barcode-scan-area');
    if (scanArea) scanArea.remove();

    var scanBtn = document.getElementById('barcode-scan-btn');
    if (scanBtn) { scanBtn.textContent = '📷 Scan Barcode'; scanBtn.classList.remove('active'); }

    pendingItemId = null;
  }

  async function detectBarcode(video) {
    if (!barcodeDetector || !scannerActive) return;
    try {
      var barcodes = await barcodeDetector.detect(video);
      if (barcodes.length > 0) {
        // Pick the barcode closest to the center of the video frame
        var centerX = video.videoWidth / 2;
        var centerY = video.videoHeight / 2;
        var closest = barcodes[0];
        var closestDist = Infinity;

        barcodes.forEach(function (bc) {
          if (bc.boundingBox) {
            var bcCenterX = bc.boundingBox.x + bc.boundingBox.width / 2;
            var bcCenterY = bc.boundingBox.y + bc.boundingBox.height / 2;
            var dist = Math.sqrt(Math.pow(bcCenterX - centerX, 2) + Math.pow(bcCenterY - centerY, 2));
            if (dist < closestDist) {
              closestDist = dist;
              closest = bc;
            }
          }
        });

        handleScannedBarcode(closest.rawValue);
      }
    } catch (e) { /* ignore */ }
  }

  async function handleScannedBarcode(value) {
    if (!value) return;
    var upperVal = value.toUpperCase().trim();

    if (upperVal.startsWith(BARCODE_PREFIX_ITEM)) {
      var itemIdFragment = upperVal.substring(BARCODE_PREFIX_ITEM.length).trim();
      var items = await DB.getAllItems();

      // Match by itemCode first (preferred, stable)
      var matchedItem = items.find(function (item) {
        return item.itemCode && item.itemCode.toUpperCase() === itemIdFragment;
      });

      // Fallback: match by first 8 chars of internal ID
      if (!matchedItem) {
        var lowerFragment = itemIdFragment.toLowerCase();
        matchedItem = items.find(function (item) {
          return item.id.substring(0, 8).toLowerCase() === lowerFragment;
        });
      }

      if (matchedItem) {
        pendingItemId = matchedItem.id;
        showScanNotification('✓ ' + matchedItem.name + ' — scan quantity');
        if (navigator.vibrate) navigator.vibrate(100);
      } else {
        var dbCodes = items.slice(0, 3).map(function(i) { return (i.itemCode || i.id.substring(0,8)); }).join(', ');
        showScanNotification('No match: ' + itemIdFragment + ' | Have: ' + dbCodes);
      }

    } else if (upperVal.startsWith(BARCODE_PREFIX_QTY)) {
      var qtyParts = upperVal.substring(BARCODE_PREFIX_QTY.length).split('-');
      if (qtyParts.length >= 2) {
        var qtyValue = parseInt(qtyParts[qtyParts.length - 1], 10);
        if (pendingItemId && qtyValue > 0) {
          if (typeof Billing !== 'undefined' && Billing.addItemById) {
            await Billing.addItemById(pendingItemId, qtyValue);
            showScanNotification('✓ Added! Scan next item...');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            pendingItemId = null;
          }
        } else if (!pendingItemId) {
          showScanNotification('Scan an item first, then quantity');
        }
      }
    } else {
      showScanNotification('Unknown barcode: ' + value);
    }
  }

  function showScanNotification(message) {
    // Update the status bar inside the scanner overlay
    var statusBar = document.getElementById('scan-status-bar');
    if (statusBar) {
      statusBar.textContent = message;
      statusBar.style.background = 'rgba(0,0,0,0.7)';
      return;
    }

    // Fallback: floating toast if scanner isn't full-screen
    var existing = document.getElementById('scan-notification');
    if (existing) existing.remove();

    var notif = document.createElement('div');
    notif.id = 'scan-notification';
    notif.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);background:#323232;color:#fff;padding:8px 16px;border-radius:8px;font-size:0.8rem;z-index:1000;max-width:90%;text-align:center;';
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(function () { if (notif.parentNode) notif.remove(); }, 3000);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    init: init,
    printItemBarcodes: printItemBarcodes,
    printQuantityBarcodes: printQuantityBarcodes,
    toggleScanner: toggleScanner,
    stopScanner: stopScanner
  };

})();
