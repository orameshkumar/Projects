const Settings = (function() {
  'use strict';
  const KEYS = { APP_NAME: 'pup_app_name', UPI_ID: 'pup_upi_id', THEME: 'pup_theme', BACKUP_FREQ: 'pup_backup_freq', LAST_BACKUP: 'pup_last_backup' };
  const DEFAULTS = { APP_NAME: 'Pay Up Partners', THEME: 'light', BACKUP_FREQ: 7 };

  function get(key, def) { try { return localStorage.getItem(key) || def; } catch(e) { return def; } }
  function set(key, val) { try { localStorage.setItem(key, val); } catch(e) {} }

  function getAppName() { return get(KEYS.APP_NAME, DEFAULTS.APP_NAME); }
  function setAppName(v) { set(KEYS.APP_NAME, v.trim() || DEFAULTS.APP_NAME); }
  function getUpiId() { return get(KEYS.UPI_ID, '') || null; }
  function setUpiId(v) { set(KEYS.UPI_ID, v.trim()); }
  function getTheme() { return get(KEYS.THEME, DEFAULTS.THEME); }
  function setTheme(v) { set(KEYS.THEME, v); applyTheme(v); }
  function getBackupFrequency() { return parseInt(get(KEYS.BACKUP_FREQ, DEFAULTS.BACKUP_FREQ), 10) || 0; }
  function setBackupFrequency(v) { set(KEYS.BACKUP_FREQ, String(v)); }
  function getLastBackup() { return get(KEYS.LAST_BACKUP, ''); }
  function setLastBackup(v) { set(KEYS.LAST_BACKUP, v); }

  function applyTheme(theme) {
    if (!theme) theme = getTheme();
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1e1e1e' : '#1565c0');
  }

  function getAllSettings() {
    var result = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith('pup_')) result[key] = localStorage.getItem(key);
    }
    return result;
  }

  function restoreSettings(settingsObj) {
    if (!settingsObj) return;
    for (var key in settingsObj) {
      if (settingsObj.hasOwnProperty(key)) localStorage.setItem(key, settingsObj[key]);
    }
  }

  function init() {
    applyTheme();
    var appNameInput = document.getElementById('settings-app-name');
    var upiIdInput = document.getElementById('settings-upi-id');
    var themeToggle = document.getElementById('theme-toggle');
    var freqSelect = document.getElementById('backup-frequency');
    var saveBtn = document.getElementById('settings-save-btn');

    if (appNameInput) appNameInput.value = getAppName();
    if (upiIdInput) upiIdInput.value = getUpiId() || '';
    if (themeToggle) { themeToggle.checked = getTheme() === 'dark'; themeToggle.addEventListener('change', function() { setTheme(themeToggle.checked ? 'dark' : 'light'); }); }
    if (freqSelect) { freqSelect.value = String(getBackupFrequency()); freqSelect.addEventListener('change', function() { setBackupFrequency(parseInt(freqSelect.value, 10)); }); }
    if (saveBtn) saveBtn.addEventListener('click', function(e) { e.preventDefault(); save(); });

    updateAppNameDisplay();
  }

  function save() {
    var appNameInput = document.getElementById('settings-app-name');
    var upiIdInput = document.getElementById('settings-upi-id');
    var errorEl = document.getElementById('settings-error');
    var msgEl = document.getElementById('settings-save-msg');
    if (errorEl) errorEl.textContent = '';

    var upiVal = upiIdInput ? upiIdInput.value.trim() : '';
    if (!upiVal) { if (errorEl) errorEl.textContent = 'UPI ID is required.'; return; }
    if (upiVal.length > 45) { if (errorEl) errorEl.textContent = 'UPI ID must be 45 characters or less.'; return; }

    var appVal = appNameInput ? appNameInput.value.trim() : '';
    if (appVal.length > 50) { if (errorEl) errorEl.textContent = 'App Name must be 50 characters or less.'; return; }

    setAppName(appVal);
    setUpiId(upiVal);
    updateAppNameDisplay();

    if (msgEl) { msgEl.removeAttribute('hidden'); setTimeout(function() { msgEl.setAttribute('hidden', ''); }, 3000); }
  }

  function updateAppNameDisplay() {
    var header = document.getElementById('app-name-header');
    if (header) header.textContent = getAppName();
    document.title = getAppName();
  }

  return { init, save, getAppName, setAppName, getUpiId, setUpiId, getTheme, setTheme, getBackupFrequency, setBackupFrequency, getLastBackup, setLastBackup, applyTheme, updateAppNameDisplay, getAllSettings, restoreSettings };
})();
