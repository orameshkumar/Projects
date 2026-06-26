(function() {
  'use strict';

  // --- Constants ---
  var STORAGE_KEY = 'license_gen_apps';
  var DEFAULT_APPS = [
    { name: "Pay Up Partners", secret: [80,85,80,95,76,73,67,95,50,48,50,53,95,36,101,99,114,51,116,95,75,51,121,33] },
    { name: "ABC Store", secret: [65,66,67,95,76,73,67,95,50,48,50,53,95,36,116,48,114,51,95,75,51,121,33] }
  ];

  // Protected app names that cannot be modified or deleted (case-insensitive)
  var PROTECTED_APPS = ["pay up partners", "abc store"];

  // --- Registry Functions ---

  function _loadRegistry() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function _saveRegistry(registry) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    } catch (e) {
      console.error('Failed to save app registry:', e);
    }
  }

  function _seedDefaults() {
    _saveRegistry(DEFAULT_APPS.slice());
    return DEFAULT_APPS.slice();
  }

  function _getRegistry() {
    var registry = _loadRegistry();
    if (!registry || registry.length === 0) {
      registry = _seedDefaults();
    }
    return registry;
  }

  function _populateAppDropdown() {
    var select = document.getElementById('app-select');
    if (!select) return;
    var registry = _getRegistry();
    select.innerHTML = '';
    for (var i = 0; i < registry.length; i++) {
      var option = document.createElement('option');
      option.value = i;
      option.textContent = registry[i].name;
      select.appendChild(option);
    }
  }

  function _addApp(name, secretStr) {
    if (!name || !name.trim()) {
      alert('Please enter an application name.');
      return false;
    }
    if (!secretStr || !secretStr.trim()) {
      alert('Please enter a secret string.');
      return false;
    }
    name = name.trim();
    secretStr = secretStr.trim();

    // Check for duplicate app name (case-insensitive)
    var registry = _getRegistry();
    var nameLower = name.toLowerCase();
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].name.toLowerCase() === nameLower) {
        alert('An application named "' + registry[i].name + '" already exists. Please use a different name.');
        return false;
      }
    }

    var secretArray = secretStr.split('').map(function(c) { return c.charCodeAt(0); });
    registry.push({ name: name, secret: secretArray });
    _saveRegistry(registry);
    _populateAppDropdown();
    // Select the newly added app
    var select = document.getElementById('app-select');
    if (select) select.value = registry.length - 1;
    return true;
  }

  function _removeApp(index) {
    var registry = _getRegistry();
    if (index < 0 || index >= registry.length) return false;
    var appName = registry[index].name;

    // Prevent deletion of protected apps
    if (PROTECTED_APPS.indexOf(appName.toLowerCase()) !== -1) {
      alert('"' + appName + '" is a protected application and cannot be removed.');
      return false;
    }

    if (!confirm('Remove "' + appName + '" from the registry?')) return false;
    registry.splice(index, 1);
    if (registry.length === 0) {
      registry = _seedDefaults();
    } else {
      _saveRegistry(registry);
    }
    _populateAppDropdown();
    return true;
  }

  // --- HMAC-SHA256 via Web Crypto API ---

  function _getSecretFromCodes(codes) {
    return codes.map(function(c) { return String.fromCharCode(c); }).join('');
  }

  async function hmacHex(message, secretCodes) {
    var secret = _getSecretFromCodes(secretCodes);
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

  // --- Generate License Key ---

  async function generateLicense(name, secretCodes) {
    var hash = await hmacHex(name, secretCodes);
    var payload = JSON.stringify({ n: name, h: hash });
    return btoa(payload);
  }

  // --- DOM Ready ---

  // DOM elements
  var nameInput = document.getElementById('user-name');
  var generateBtn = document.getElementById('generate-btn');
  var outputSection = document.getElementById('output-section');
  var licenseOutput = document.getElementById('license-output');
  var copyBtn = document.getElementById('copy-btn');
  var statusMsg = document.getElementById('status-msg');
  var appSelect = document.getElementById('app-select');
  var appNameLabel = document.getElementById('app-name-label');
  var addAppBtn = document.getElementById('add-app-btn');
  var removeAppBtn = document.getElementById('remove-app-btn');
  var addAppName = document.getElementById('add-app-name');
  var addAppSecret = document.getElementById('add-app-secret');

  // Initialize app dropdown
  _populateAppDropdown();

  // Generate button click
  generateBtn.addEventListener('click', async function() {
    var name = (nameInput.value || '').trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    var registry = _getRegistry();
    var selectedIndex = parseInt(appSelect.value, 10);
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= registry.length) {
      alert('Please select an application.');
      return;
    }

    var selectedApp = registry[selectedIndex];

    try {
      var key = await generateLicense(name, selectedApp.secret);
      licenseOutput.value = key;
      outputSection.removeAttribute('hidden');
      // Display selected app name alongside generated key
      if (appNameLabel) {
        appNameLabel.textContent = 'Generated for: ' + selectedApp.name;
        appNameLabel.removeAttribute('hidden');
      }
      statusMsg.setAttribute('hidden', '');
    } catch (e) {
      alert('Error generating license: ' + e.message);
    }
  });

  // Copy button click
  copyBtn.addEventListener('click', async function() {
    var text = licenseOutput.value;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      statusMsg.textContent = '✅ Copied to clipboard!';
      statusMsg.removeAttribute('hidden');
      setTimeout(function() { statusMsg.setAttribute('hidden', ''); }, 3000);
    } catch (e) {
      // Fallback
      licenseOutput.select();
      document.execCommand('copy');
      statusMsg.textContent = '✅ Copied to clipboard!';
      statusMsg.removeAttribute('hidden');
      setTimeout(function() { statusMsg.setAttribute('hidden', ''); }, 3000);
    }
  });

  // Add App button click
  if (addAppBtn) {
    addAppBtn.addEventListener('click', function() {
      var name = addAppName ? addAppName.value : '';
      var secret = addAppSecret ? addAppSecret.value : '';
      if (_addApp(name, secret)) {
        if (addAppName) addAppName.value = '';
        if (addAppSecret) addAppSecret.value = '';
      }
    });
  }

  // Remove App button click
  if (removeAppBtn) {
    removeAppBtn.addEventListener('click', function() {
      var selectedIndex = parseInt(appSelect.value, 10);
      _removeApp(selectedIndex);
    });
  }

  // Allow Enter key to generate
  nameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateBtn.click();
    }
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function(reg) {
      console.log('SW registered:', reg.scope);
    }).catch(function(err) {
      console.log('SW registration failed:', err);
    });
  }
})();
