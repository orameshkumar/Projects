// Backup & Restore module — full data backup and restore including settings

var Backup = (function() {
  'use strict';

  var KEYS = {
    LAST_BACKUP: 'last_backup_date',
    BACKUP_FREQUENCY: 'backup_frequency'
  };

  /**
   * Initialize the Backup module.
   * Attaches event listeners and displays last backup info.
   */
  function init() {
    var backupBtn = document.getElementById('backup-now-btn');
    var restoreBtn = document.getElementById('restore-btn');
    var restoreInput = document.getElementById('restore-file-input');
    var frequencySelect = document.getElementById('backup-frequency');

    if (backupBtn) {
      backupBtn.addEventListener('click', createBackup);
    }

    if (restoreBtn) {
      restoreBtn.addEventListener('click', function() {
        if (restoreInput) restoreInput.click();
      });
    }

    if (restoreInput) {
      restoreInput.addEventListener('change', handleRestoreFile);
    }

    if (frequencySelect) {
      var savedFrequency = getBackupFrequency();
      frequencySelect.value = String(savedFrequency);
      frequencySelect.addEventListener('change', function() {
        setBackupFrequency(parseInt(frequencySelect.value, 10));
      });
    }

    displayLastBackupInfo();
  }

  /**
   * Create a full backup of all data (clients, payments, settings).
   * Downloads as a JSON file.
   */
  async function createBackup() {
    try {
      var clients = await DB.getAllClients();
      var payments = [];

      // Get all payments for all clients
      for (var i = 0; i < clients.length; i++) {
        var clientPayments = await DB.getPaymentsByClient(clients[i].id);
        payments = payments.concat(clientPayments);
      }

      // Gather all localStorage settings
      var settings = {};
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j);
        settings[key] = localStorage.getItem(key);
      }

      var backupData = {
        version: 2,
        appName: 'ABC Debt Collection',
        createdAt: new Date().toISOString(),
        data: {
          clients: clients,
          payments: payments,
          settings: settings
        }
      };

      var json = JSON.stringify(backupData, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);

      var today = new Date().toISOString().split('T')[0];
      var link = document.createElement('a');
      link.href = url;
      link.download = 'debt-collection-backup-' + today + '.json';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Record backup date
      localStorage.setItem(KEYS.LAST_BACKUP, new Date().toISOString());
      displayLastBackupInfo();

      alert('Backup created successfully!');
    } catch (e) {
      alert('Backup failed: ' + (e.message || 'Unknown error'));
      console.error('Backup error:', e);
    }
  }

  /**
   * Handle file selection for restore.
   * @param {Event} event
   */
  function handleRestoreFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        confirmAndRestore(data);
      } catch (err) {
        alert('Invalid backup file. Please select a valid JSON backup.');
      }
    };
    reader.onerror = function() {
      alert('Could not read the file. Please try again.');
    };
    reader.readAsText(file);

    // Reset so same file can be selected again
    event.target.value = '';
  }

  /**
   * Confirm with user and restore data from backup.
   * @param {Object} backupData - The parsed backup JSON
   */
  async function confirmAndRestore(backupData) {
    // Validate backup structure
    if (!backupData || !backupData.data) {
      alert('Invalid backup file format.');
      return;
    }

    if (!backupData.data.clients || !backupData.data.payments) {
      alert('Backup file is missing client or payment data.');
      return;
    }

    var clientCount = backupData.data.clients.length;
    var paymentCount = backupData.data.payments.length;
    var backupDate = backupData.createdAt ? new Date(backupData.createdAt).toLocaleDateString() : 'Unknown';

    var confirmed = confirm(
      'Restore from backup?\n\n' +
      'Backup date: ' + backupDate + '\n' +
      'Clients: ' + clientCount + '\n' +
      'Payments: ' + paymentCount + '\n\n' +
      '⚠️ This will REPLACE all current data. This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      // Restore settings (localStorage)
      if (backupData.data.settings) {
        var settings = backupData.data.settings;
        for (var key in settings) {
          if (settings.hasOwnProperty(key)) {
            localStorage.setItem(key, settings[key]);
          }
        }
      }

      // Clear existing data and restore clients
      var existingClients = await DB.getAllClients();
      for (var i = 0; i < existingClients.length; i++) {
        await DB.deletePaymentsByClient(existingClients[i].id);
        await DB.deleteClient(existingClients[i].id);
      }

      // Restore clients
      for (var j = 0; j < backupData.data.clients.length; j++) {
        await DB.addClient(backupData.data.clients[j]);
      }

      // Restore payments
      for (var k = 0; k < backupData.data.payments.length; k++) {
        await DB.addPayment(backupData.data.payments[k]);
      }

      // Update last backup date
      localStorage.setItem(KEYS.LAST_BACKUP, new Date().toISOString());

      alert('Restore complete! The app will now reload.');
      window.location.reload();
    } catch (e) {
      alert('Restore failed: ' + (e.message || 'Unknown error'));
      console.error('Restore error:', e);
    }
  }

  /**
   * Check if a backup reminder should be shown.
   * Called on app startup.
   */
  function checkBackupReminder() {
    var frequency = getBackupFrequency();
    if (frequency === 0) return; // Never remind

    var lastBackup = localStorage.getItem(KEYS.LAST_BACKUP);
    if (!lastBackup) {
      // Never backed up — show reminder
      showBackupReminder('You have never created a backup. Would you like to backup now?');
      return;
    }

    var lastDate = new Date(lastBackup);
    var now = new Date();
    var daysSinceBackup = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    if (daysSinceBackup >= frequency) {
      showBackupReminder('Your last backup was ' + daysSinceBackup + ' day' + (daysSinceBackup > 1 ? 's' : '') + ' ago. Would you like to backup now?');
    }
  }

  /**
   * Show a backup reminder notification.
   * @param {string} message
   */
  function showBackupReminder(message) {
    // Small delay to let the app render first
    setTimeout(function() {
      var doBackup = confirm('📦 Backup Reminder\n\n' + message);
      if (doBackup) {
        createBackup();
      }
    }, 1000);
  }

  /**
   * Get the backup frequency setting (days).
   * @returns {number} Days between backup reminders (0 = never)
   */
  function getBackupFrequency() {
    var val = localStorage.getItem(KEYS.BACKUP_FREQUENCY);
    if (val === null) return 7; // Default: weekly
    return parseInt(val, 10) || 0;
  }

  /**
   * Set the backup frequency.
   * @param {number} days
   */
  function setBackupFrequency(days) {
    localStorage.setItem(KEYS.BACKUP_FREQUENCY, String(days));
  }

  /**
   * Display the last backup date info in the settings UI.
   */
  function displayLastBackupInfo() {
    var infoEl = document.getElementById('last-backup-info');
    if (!infoEl) return;

    var lastBackup = localStorage.getItem(KEYS.LAST_BACKUP);
    if (lastBackup) {
      var date = new Date(lastBackup);
      infoEl.textContent = 'Last backup: ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } else {
      infoEl.textContent = 'No backup created yet.';
    }
  }

  return {
    init: init,
    createBackup: createBackup,
    checkBackupReminder: checkBackupReminder
  };
})();
