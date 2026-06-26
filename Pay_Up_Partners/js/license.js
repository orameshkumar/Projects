const License = (function() {
  'use strict';

  var CLIENT_LIMIT = 5;
  var LS_KEY = 'pup_license_key';

  // Cached state
  var _licensed = false;
  var _licenseeName = null;

  // Obfuscated shared secret
  var _s = [80,85,80,95,76,73,67,95,50,48,50,53,95,36,101,99,114,51,116,95,75,51,121,33];
  function _getSecret() { return _s.map(function(c){return String.fromCharCode(c);}).join(''); }

  // ─── HMAC-SHA256 via Web Crypto API ───
  async function _hmacHex(message) {
    var secret = _getSecret();
    var enc = new TextEncoder();
    var keyData = enc.encode(secret);
    var msgData = enc.encode(message);

    var cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    var sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    var bytes = new Uint8Array(sig);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += ('0' + bytes[i].toString(16)).slice(-2);
    }
    return hex;
  }

  // ─── Validate a license key string ───
  async function _validate(keyStr) {
    try {
      var json = atob(keyStr);
      var obj = JSON.parse(json);
      if (!obj || typeof obj.n !== 'string' || typeof obj.h !== 'string') return null;
      var computed = await _hmacHex(obj.n);
      if (computed.toLowerCase() === obj.h.toLowerCase()) {
        return obj.n;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ─── Public: init ───
  async function init() {
    // Validate stored key on load
    var stored = null;
    try { stored = localStorage.getItem(LS_KEY); } catch(e) {}

    if (stored) {
      var name = await _validate(stored);
      if (name) {
        _licensed = true;
        _licenseeName = name;
      } else {
        // Tampered or invalid — remove it
        try { localStorage.removeItem(LS_KEY); } catch(e) {}
        _licensed = false;
        _licenseeName = null;
      }
    } else {
      _licensed = false;
      _licenseeName = null;
    }

    // Setup Settings UI
    _renderLicenseStatus();
    _bindUI();
  }

  // ─── Public: isLicensed (sync, cached) ───
  function isLicensed() {
    return _licensed;
  }

  // ─── Public: getLicenseeName ───
  function getLicenseeName() {
    return _licenseeName;
  }

  // ─── Public: checkClientLimit ───
  async function checkClientLimit() {
    if (_licensed) return true;
    try {
      var clients = await DB.getAllClients();
      if (clients && clients.length >= CLIENT_LIMIT) {
        alert('You have reached the limit of ' + CLIENT_LIMIT + ' clients.\n\nPlease obtain a license key to add unlimited clients.\nGo to Settings → License to activate.');
        return false;
      }
      return true;
    } catch(e) {
      return true; // allow on error
    }
  }

  // ─── Public: validateAndStore ───
  async function validateAndStore(keyStr) {
    if (!keyStr || !keyStr.trim()) return { valid: false, name: null };
    keyStr = keyStr.trim();
    var name = await _validate(keyStr);
    if (name) {
      try { localStorage.setItem(LS_KEY, keyStr); } catch(e) {}
      _licensed = true;
      _licenseeName = name;
      _renderLicenseStatus();
      return { valid: true, name: name };
    }
    return { valid: false, name: null };
  }

  // ─── Public: removeLicense ───
  function removeLicense() {
    try { localStorage.removeItem(LS_KEY); } catch(e) {}
    _licensed = false;
    _licenseeName = null;
    _renderLicenseStatus();
  }

  // ─── UI Helpers ───
  function _renderLicenseStatus() {
    var statusEl = document.getElementById('license-status');
    if (!statusEl) return;

    if (_licensed) {
      statusEl.className = 'license-status licensed';
      statusEl.textContent = '✅ Licensed to: ' + _licenseeName;
    } else {
      statusEl.className = 'license-status unlicensed';
      statusEl.textContent = '🔒 Unlicensed — Limited to ' + CLIENT_LIMIT + ' clients';
    }
  }

  function _bindUI() {
    var activateBtn = document.getElementById('license-activate-btn');
    var removeBtn = document.getElementById('license-remove-btn');
    var input = document.getElementById('license-key-input');

    if (activateBtn) {
      activateBtn.addEventListener('click', async function() {
        var errorEl = document.getElementById('license-error');
        var successEl = document.getElementById('license-success-msg');
        if (errorEl) errorEl.textContent = '';
        if (successEl) successEl.setAttribute('hidden', '');

        var val = input ? input.value.trim() : '';
        if (!val) {
          if (errorEl) errorEl.textContent = 'Please enter a license key.';
          return;
        }

        var result = await validateAndStore(val);
        if (result.valid) {
          if (input) input.value = '';
          if (successEl) {
            successEl.removeAttribute('hidden');
            setTimeout(function() { successEl.setAttribute('hidden', ''); }, 3000);
          }
          _toggleButtons();
        } else {
          if (errorEl) errorEl.textContent = 'Invalid license key. Please check and try again.';
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        if (!confirm('Remove license? You will be limited to ' + CLIENT_LIMIT + ' clients.')) return;
        removeLicense();
        _toggleButtons();
      });
    }

    _toggleButtons();
  }

  function _toggleButtons() {
    var activateBtn = document.getElementById('license-activate-btn');
    var removeBtn = document.getElementById('license-remove-btn');
    var input = document.getElementById('license-key-input');

    if (_licensed) {
      if (activateBtn) activateBtn.setAttribute('hidden', '');
      if (input) input.parentElement.setAttribute('hidden', '');
      if (removeBtn) removeBtn.removeAttribute('hidden');
    } else {
      if (activateBtn) activateBtn.removeAttribute('hidden');
      if (input) input.parentElement.removeAttribute('hidden');
      if (removeBtn) removeBtn.setAttribute('hidden', '');
    }
  }

  return {
    init: init,
    isLicensed: isLicensed,
    getLicenseeName: getLicenseeName,
    checkClientLimit: checkClientLimit,
    validateAndStore: validateAndStore,
    removeLicense: removeLicense
  };
})();
