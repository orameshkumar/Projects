const Backup = (function() {
  'use strict';

  function getTodayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function init() {
    var backupBtn = document.getElementById('backup-btn');
    var restoreBtn = document.getElementById('restore-btn');
    var restoreFile = document.getElementById('restore-file');

    if (backupBtn) backupBtn.addEventListener('click', createBackup);
    if (restoreBtn) restoreBtn.addEventListener('click', function() { if (restoreFile) restoreFile.click(); });
    if (restoreFile) restoreFile.addEventListener('change', handleRestoreFile);

    displayLastBackupInfo();
  }

  function displayLastBackupInfo() {
    var infoEl = document.getElementById('backup-last-info');
    if (!infoEl) return;

    var lastBackup = Settings.getLastBackup();
    if (lastBackup) {
      infoEl.textContent = 'Last backup: ' + lastBackup;
    } else {
      infoEl.textContent = 'No backups yet.';
    }
  }

  async function createBackup() {
    if (typeof License !== 'undefined' && !License.isLicensed()) {
      alert('Backup requires a valid license.\nGo to Settings → License to activate.');
      return;
    }
    try {
      var clients = await DB.getAllClients();
      var loans = await DB.getAllLoans();
      var payments = await DB.getAllPayments();
      var settings = Settings.getAllSettings();

      var backupData = {
        version: 3,
        appName: Settings.getAppName(),
        createdAt: new Date().toISOString(),
        data: {
          clients: clients,
          loans: loans,
          payments: payments,
          settings: settings
        }
      };

      var json = JSON.stringify(backupData, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'PayUpPartners_Backup_' + getTodayISO() + '.json';
      a.click();
      URL.revokeObjectURL(url);

      // Update last backup date
      Settings.setLastBackup(getTodayISO());
      displayLastBackupInfo();

      alert('Backup created successfully.');
    } catch (e) {
      alert('Backup failed: ' + e.message);
      console.error('Backup error:', e);
    }
  }

  function handleRestoreFile(event) {
    if (typeof License !== 'undefined' && !License.isLicensed()) {
      alert('Restore requires a valid license.\nGo to Settings → License to activate.');
      event.target.value = '';
      return;
    }
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        processRestore(data);
      } catch (err) {
        alert('Invalid backup file. Please select a valid JSON backup.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function processRestore(data) {
    // Determine version
    var version = data.version || null;

    if (!version) {
      // Check if it looks like a V2 backup (old Collection_App)
      // V2 has data.data.clients where clients have totalAmount field
      if (data.data && data.data.clients && Array.isArray(data.data.clients) && data.data.clients.length > 0 && data.data.clients[0].totalAmount !== undefined) {
        version = 2;
      } else if (data.data && data.data.clients && data.data.loans) {
        // V3 has separate clients and loans arrays
        version = 3;
      } else if (data.clients && Array.isArray(data.clients) && data.clients.length > 0 && data.clients[0].totalAmount !== undefined) {
        // V2 without wrapper (direct arrays)
        version = 2;
      } else {
        alert('Unsupported backup format.');
        return;
      }
    }

    if (version === 2) {
      if (!confirm('This is a Collection_App (V2) backup. It will be converted to the new format. All existing data will be replaced. Continue?')) return;
      var v3Data = migrateV2ToV3(data);
      await restoreBackup(v3Data);
    } else if (version === 3) {
      if (!confirm('Restore this backup? All existing data will be replaced.')) return;
      await restoreBackup(data);
    } else {
      alert('Unsupported backup format (version: ' + version + ').');
    }
  }

  async function restoreBackup(backupData) {
    if (!backupData || !backupData.data) {
      alert('Backup file is missing required data.');
      return;
    }

    var bd = backupData.data;

    if (!Array.isArray(bd.clients) || !Array.isArray(bd.loans) || !Array.isArray(bd.payments)) {
      alert('Backup file is missing required data arrays.');
      return;
    }

    try {
      // Clear existing data
      var existingClients = await DB.getAllClients();
      for (var i = 0; i < existingClients.length; i++) {
        await DB.deleteClientCascade(existingClients[i].id);
      }

      // Also clear any orphan loans/payments
      var existingLoans = await DB.getAllLoans();
      for (var j = 0; j < existingLoans.length; j++) {
        await DB.deleteLoanCascade(existingLoans[j].id);
      }

      // Import clients
      for (var c = 0; c < bd.clients.length; c++) {
        await DB.addClient(bd.clients[c]);
      }

      // Import loans
      for (var l = 0; l < bd.loans.length; l++) {
        await DB.addLoan(bd.loans[l]);
      }

      // Import payments
      for (var p = 0; p < bd.payments.length; p++) {
        await DB.addPayment(bd.payments[p]);
      }

      // Restore settings
      if (bd.settings) {
        Settings.restoreSettings(bd.settings);
        Settings.applyTheme();
        Settings.updateAppNameDisplay();
      }

      alert('Restore completed successfully. The app will reload.');
      window.location.reload();
    } catch (e) {
      alert('Restore failed: ' + e.message + '. Please reload the app.');
      console.error('Restore error:', e);
    }
  }

  function migrateV2ToV3(v2Data) {
    // V2 backup structure: { version: 2, data: { clients: [...], payments: [...], settings: {...} } }
    var sourceData = v2Data.data || v2Data;
    var clients = sourceData.clients || [];
    var payments = sourceData.payments || [];
    var settings = sourceData.settings || {};

    var v3Clients = [];
    var v3Loans = [];
    var v3Payments = [];

    // Map old clientId → new loanId for payment remapping
    var oldClientToNewLoan = {};
    // Map old clientId → new clientId
    var oldClientToNewClient = {};

    for (var i = 0; i < clients.length; i++) {
      var oldClient = clients[i];
      var newClientId = generateId();
      var newLoanId = generateId();

      // Create Client record (person info only)
      v3Clients.push({
        id: newClientId,
        name: oldClient.name || '',
        mobile: oldClient.mobile || '',
        createdAt: oldClient.createdAt || new Date().toISOString()
      });

      // Determine loan type and extract loan fields
      var loanType = oldClient.loanType || 'daily_emi';
      var totalAmount = oldClient.totalAmount || 0;
      var startDate = oldClient.startDate || getTodayISO();
      var duration = oldClient.duration || null;
      var emi = oldClient.emi || 0;
      var endDate = oldClient.endDate || null;
      var interestRate = oldClient.interestRate || null;
      var principalBalance = oldClient.principalBalance !== undefined ? oldClient.principalBalance : (loanType === 'interest_only' ? totalAmount : null);
      var notes = oldClient.notes || '';

      // Only create a loan if there's amount data
      if (totalAmount > 0) {
        v3Loans.push({
          id: newLoanId,
          clientId: newClientId,
          loanType: loanType,
          totalAmount: totalAmount,
          startDate: startDate,
          duration: loanType === 'daily_emi' ? duration : null,
          emi: emi,
          endDate: loanType === 'daily_emi' ? endDate : null,
          interestRate: loanType === 'interest_only' ? interestRate : null,
          principalBalance: loanType === 'interest_only' ? principalBalance : null,
          notes: notes,
          status: oldClient.status || 'active',
          createdAt: oldClient.createdAt || new Date().toISOString()
        });
      }

      // Map old id → new loan id (for payment remapping)
      oldClientToNewLoan[oldClient.id] = newLoanId;
      oldClientToNewClient[oldClient.id] = newClientId;
    }

    // Remap payments: old payments link to clientId, new payments link to loanId
    for (var j = 0; j < payments.length; j++) {
      var oldPayment = payments[j];
      var mappedLoanId = oldClientToNewLoan[oldPayment.clientId] || oldPayment.clientId;

      v3Payments.push({
        id: oldPayment.id || generateId(),
        loanId: mappedLoanId,
        date: oldPayment.date || getTodayISO(),
        amount: oldPayment.amount || 0,
        paymentType: oldPayment.paymentType || 'emi',
        createdAt: oldPayment.createdAt || new Date().toISOString()
      });
    }

    return {
      version: 3,
      appName: settings.app_name || settings.pup_app_name || v2Data.appName || 'Pay Up Partners',
      createdAt: new Date().toISOString(),
      data: {
        clients: v3Clients,
        loans: v3Loans,
        payments: v3Payments,
        settings: {}
      }
    };
  }

  function checkBackupReminder() {
    var frequency = Settings.getBackupFrequency();
    if (!frequency || frequency <= 0) return;

    var lastBackup = Settings.getLastBackup();
    if (!lastBackup) {
      showBackupReminder();
      return;
    }

    var lastDate = new Date(lastBackup + 'T00:00:00');
    var today = new Date(getTodayISO() + 'T00:00:00');
    var diffDays = Math.floor((today - lastDate) / 86400000);

    if (diffDays >= frequency) {
      showBackupReminder();
    }
  }

  function showBackupReminder() {
    var reminder = document.getElementById('backup-reminder');
    if (reminder) {
      reminder.removeAttribute('hidden');
      var dismissBtn = document.getElementById('backup-reminder-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', function() {
          reminder.setAttribute('hidden', '');
        });
      }
    }
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  return {
    init: init,
    createBackup: createBackup,
    restoreBackup: restoreBackup,
    migrateV2ToV3: migrateV2ToV3,
    checkBackupReminder: checkBackupReminder
  };
})();
