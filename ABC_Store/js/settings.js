/**
 * settings.js - UPI Settings Module for ABC Provisional Store
 *
 * Stores and retrieves UPI payment settings from localStorage.
 * Provides UPI QR code generation after bill finalization.
 */

const Settings = (function () {
  'use strict';

  const STORAGE_KEY = 'abcstore_upi_settings';

  // ─── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the Settings module.
   * Loads saved settings into the form and sets up save button.
   */
  function init() {
    var saveBtn = document.getElementById('upi-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveSettings);
    }

    // Load existing settings into form
    loadSettingsIntoForm();
  }

  // ─── Load / Save ────────────────────────────────────────────────────────────

  /**
   * Get saved UPI settings from localStorage.
   * @returns {Object|null} { upiId, payeeName, merchantCode } or null
   */
  function getSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Settings: Failed to read settings', e);
    }
    return null;
  }

  /**
   * Save UPI settings from form to localStorage.
   */
  function saveSettings() {
    var upiId = document.getElementById('upi-id-input');
    var payeeName = document.getElementById('upi-name-input');
    var merchantCode = document.getElementById('upi-merchant-code-input');
    var msg = document.getElementById('upi-save-msg');

    var settings = {
      upiId: upiId ? upiId.value.trim() : '',
      payeeName: payeeName ? payeeName.value.trim() : '',
      merchantCode: merchantCode ? merchantCode.value.trim() : ''
    };

    if (!settings.upiId) {
      alert('UPI ID is required.');
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      if (msg) {
        msg.style.display = 'block';
        setTimeout(function () { msg.style.display = 'none'; }, 3000);
      }
    } catch (e) {
      console.error('Settings: Failed to save', e);
      alert('Failed to save settings.');
    }
  }

  /**
   * Load saved settings into the form inputs.
   */
  function loadSettingsIntoForm() {
    var settings = getSettings();
    if (!settings) return;

    var upiId = document.getElementById('upi-id-input');
    var payeeName = document.getElementById('upi-name-input');
    var merchantCode = document.getElementById('upi-merchant-code-input');

    if (upiId) upiId.value = settings.upiId || '';
    if (payeeName) payeeName.value = settings.payeeName || '';
    if (merchantCode) merchantCode.value = settings.merchantCode || '';
  }

  // ─── UPI QR Code Generation ─────────────────────────────────────────────────

  /**
   * Generate a UPI payment URL string.
   * Format: upi://pay?pa=<UPI_ID>&pn=<NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>
   * @param {number} amount - Bill total amount
   * @param {string} billNumber - Bill number for the transaction note
   * @returns {string|null} UPI URL string, or null if UPI not configured
   */
  function generateUpiUrl(amount, billNumber) {
    var settings = getSettings();
    if (!settings || !settings.upiId) return null;

    var params = [];
    params.push('pa=' + encodeURIComponent(settings.upiId));

    if (settings.payeeName) {
      params.push('pn=' + encodeURIComponent(settings.payeeName));
    }

    params.push('am=' + amount.toFixed(2));
    params.push('cu=INR');
    params.push('tn=' + encodeURIComponent('Bill: ' + billNumber));

    if (settings.merchantCode) {
      params.push('mc=' + encodeURIComponent(settings.merchantCode));
    }

    return 'upi://pay?' + params.join('&');
  }

  /**
   * Show a QR code modal for UPI payment after bill finalization.
   * @param {number} amount - Bill total
   * @param {string} billNumber - Bill number
   */
  function showPaymentQR(amount, billNumber) {
    var upiUrl = generateUpiUrl(amount, billNumber);
    if (!upiUrl) return; // UPI not configured, skip silently

    // Remove existing QR modal if any
    var existing = document.getElementById('upi-qr-modal');
    if (existing) existing.remove();

    // Create modal overlay
    var overlay = document.createElement('div');
    overlay.id = 'upi-qr-modal';
    overlay.className = 'modal-overlay';

    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-labelledby="qr-modal-title" aria-modal="true">' +
        '<div class="modal-header">' +
          '<h2 class="modal-title" id="qr-modal-title">UPI Payment</h2>' +
          '<button class="modal-close" id="qr-modal-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="text-align:center;">' +
          '<p style="font-size:0.875rem;color:#5f6368;margin-bottom:8px;">Scan to pay for ' + billNumber + '</p>' +
          '<p style="font-size:1.5rem;font-weight:700;color:#202124;margin-bottom:12px;">₹' + amount.toFixed(2) + '</p>' +
          '<div id="upi-qr-canvas-container" style="display:inline-block;padding:12px;background:#fff;border-radius:8px;border:1px solid #dadce0;"></div>' +
          '<p style="font-size:0.75rem;color:#5f6368;margin-top:8px;word-break:break-all;">' + upiUrl + '</p>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn-primary" id="qr-modal-done" style="flex:1;">Done</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Render QR code
    var container = document.getElementById('upi-qr-canvas-container');
    if (container && typeof QRCode !== 'undefined') {
      QRCode.toCanvas(container, upiUrl, { width: 200, margin: 2 }, function (error) {
        if (error) {
          console.error('QR generation failed:', error);
          container.innerHTML = '<p style="color:#ea4335;font-size:0.8rem;">QR generation failed</p>';
        }
      });
    } else if (container) {
      container.innerHTML = '<p style="color:#ea4335;font-size:0.8rem;">QR library not loaded</p>';
    }

    // Show modal with animation
    requestAnimationFrame(function () {
      overlay.classList.add('active');
    });

    // Close handlers
    document.getElementById('qr-modal-close').addEventListener('click', function () {
      closeQrModal(overlay);
    });
    document.getElementById('qr-modal-done').addEventListener('click', function () {
      closeQrModal(overlay);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeQrModal(overlay);
    });
  }

  /**
   * Close and remove the QR modal.
   */
  function closeQrModal(overlay) {
    overlay.classList.remove('active');
    setTimeout(function () {
      if (overlay.parentNode) overlay.remove();
    }, 300);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    init: init,
    getSettings: getSettings,
    generateUpiUrl: generateUpiUrl,
    showPaymentQR: showPaymentQR
  };

})();
