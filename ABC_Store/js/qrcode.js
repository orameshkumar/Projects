/**
 * QR Code wrapper for ABC Store PWA
 * Uses the qrcode-generator library (qrcode-lib.js) for offline QR generation.
 *
 * Public API: QRCode.toCanvas(container, text, options, callback)
 */

var QRCode = (function () {
  'use strict';

  /**
   * Render a QR code into a container element using canvas.
   *
   * @param {HTMLElement} container - DOM element to append the QR code into
   * @param {string} text - The text/URL to encode
   * @param {Object} options - { width: number, margin: number }
   * @param {Function} callback - Called with (error) on completion
   */
  function toCanvas(container, text, options, callback) {
    var width = (options && options.width) || 200;
    var margin = (options && options.margin) || 2;
    container.innerHTML = '';

    try {
      // Use the qrcode-generator library (global `qrcode` function)
      if (typeof qrcode === 'undefined') {
        throw new Error('qrcode-generator library not loaded');
      }

      // Type 0 = auto-detect version, EC level M
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();

      var moduleCount = qr.getModuleCount();
      var cellSize = Math.floor((width - margin * 2) / moduleCount);
      var canvasSize = cellSize * moduleCount + margin * 2;

      var canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';

      var ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Draw QR modules
      ctx.fillStyle = '#000000';
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(
              margin + col * cellSize,
              margin + row * cellSize,
              cellSize,
              cellSize
            );
          }
        }
      }

      container.appendChild(canvas);
      if (callback) callback(null);

    } catch (e) {
      console.error('QRCode.toCanvas error:', e);
      // Fallback: show UPI link
      var fallback = document.createElement('div');
      fallback.style.cssText = 'padding:16px;text-align:center;border:2px dashed #dadce0;border-radius:8px;';
      fallback.innerHTML =
        '<p style="font-size:0.8rem;color:#5f6368;margin-bottom:8px;">QR code generation failed.</p>' +
        '<a href="' + text + '" style="font-size:0.75rem;color:#1a73e8;word-break:break-all;">Open UPI Payment Link</a>';
      container.appendChild(fallback);
      if (callback) callback(e);
    }
  }

  return {
    toCanvas: toCanvas
  };

})();
