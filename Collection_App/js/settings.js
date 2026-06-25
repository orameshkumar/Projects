// Settings module — manages UPI_ID and AppName via localStorage

var Settings = (function() {
  'use strict';

  var KEYS = { UPI_ID: 'upi_id', APP_NAME: 'app_name', THEME: 'app_theme' };
  var DEFAULTS = { APP_NAME: 'ABC Debt Collection', THEME: 'light' };

  var saveTimeout = null;

  /**
   * Check if localStorage is available.
   * @returns {boolean}
   */
  function isLocalStorageAvailable() {
    try {
      var testKey = '__settings_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Initialize settings form fields with stored values or defaults.
   * Attaches save button click handler and theme toggle handler.
   */
  function init() {
    var appNameInput = document.getElementById('settings-app-name');
    var upiIdInput = document.getElementById('settings-upi-id');
    var saveBtn = document.getElementById('settings-save-btn');
    var themeToggle = document.getElementById('theme-toggle');

    if (appNameInput) {
      appNameInput.value = getAppName();
    }

    if (upiIdInput) {
      upiIdInput.value = getUpiId() || '';
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function(e) {
        e.preventDefault();
        save();
      });
    }

    // Theme toggle
    if (themeToggle) {
      themeToggle.checked = getTheme() === 'dark';
      themeToggle.addEventListener('change', function() {
        var theme = themeToggle.checked ? 'dark' : 'light';
        setTheme(theme);
      });
    }
  }

  /**
   * Validate and save settings to localStorage.
   * Validates UPI_ID is not empty/whitespace-only and respects max lengths.
   * Shows success message for 3 seconds on valid save.
   * Calls updateAppName() from app.js to immediately update header/title.
   */
  function save() {
    var appNameInput = document.getElementById('settings-app-name');
    var upiIdInput = document.getElementById('settings-upi-id');
    var upiError = document.getElementById('settings-upi-error');
    var saveMsg = document.getElementById('settings-save-msg');

    // Clear previous errors
    if (upiError) {
      upiError.textContent = '';
    }

    var appNameValue = appNameInput ? appNameInput.value : '';
    var upiIdValue = upiIdInput ? upiIdInput.value : '';

    // Validate UPI_ID is not empty or whitespace-only
    if (!upiIdValue || upiIdValue.trim() === '') {
      if (upiError) {
        upiError.textContent = 'UPI ID is required and cannot be empty.';
      }
      return;
    }

    // Validate UPI_ID max 45 characters
    if (upiIdValue.trim().length > 45) {
      if (upiError) {
        upiError.textContent = 'UPI ID must be 45 characters or less.';
      }
      return;
    }

    // Validate AppName max 50 characters
    if (appNameValue.length > 50) {
      if (upiError) {
        upiError.textContent = 'Application Name must be 50 characters or less.';
      }
      return;
    }

    // Check localStorage availability
    if (!isLocalStorageAvailable()) {
      if (upiError) {
        upiError.textContent = 'Settings could not be saved. Local storage is unavailable.';
      }
      return;
    }

    // Persist values
    try {
      var trimmedUpiId = upiIdValue.trim();
      var finalAppName = appNameValue.trim() === '' ? DEFAULTS.APP_NAME : appNameValue.trim();

      localStorage.setItem(KEYS.UPI_ID, trimmedUpiId);
      localStorage.setItem(KEYS.APP_NAME, finalAppName);
    } catch (e) {
      if (upiError) {
        upiError.textContent = 'Settings could not be saved. Storage error occurred.';
      }
      return;
    }

    // Show success message for 3 seconds
    if (saveMsg) {
      saveMsg.removeAttribute('hidden');

      // Clear any existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(function() {
        saveMsg.setAttribute('hidden', '');
        saveTimeout = null;
      }, 3000);
    }

    // Immediately update header/title via app.js
    if (typeof updateAppName === 'function') {
      updateAppName();
    }
  }

  /**
   * Get the stored UPI ID.
   * @returns {string|null} The stored UPI_ID or null if not set
   */
  function getUpiId() {
    try {
      return localStorage.getItem(KEYS.UPI_ID) || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the stored App Name.
   * @returns {string} The stored AppName or the default "ABC Debt Collection"
   */
  function getAppName() {
    try {
      return localStorage.getItem(KEYS.APP_NAME) || DEFAULTS.APP_NAME;
    } catch (e) {
      return DEFAULTS.APP_NAME;
    }
  }

  /**
   * Get the stored theme preference.
   * @returns {string} 'light' or 'dark'
   */
  function getTheme() {
    try {
      return localStorage.getItem(KEYS.THEME) || DEFAULTS.THEME;
    } catch (e) {
      return DEFAULTS.THEME;
    }
  }

  /**
   * Set and apply the theme.
   * @param {string} theme - 'light' or 'dark'
   */
  function setTheme(theme) {
    try {
      localStorage.setItem(KEYS.THEME, theme);
    } catch (e) {
      // Ignore storage errors
    }
    applyTheme(theme);
  }

  /**
   * Apply theme to the document.
   * @param {string} theme - 'light' or 'dark'
   */
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    // Update meta theme-color
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#1e1e1e' : '#1976d2');
    }
  }

  return {
    init: init,
    save: save,
    getUpiId: getUpiId,
    getAppName: getAppName,
    getTheme: getTheme,
    setTheme: setTheme,
    applyTheme: applyTheme
  };
})();
