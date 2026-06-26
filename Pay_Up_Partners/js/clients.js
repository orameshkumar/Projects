const ClientMaster = (function() {
  'use strict';

  var editingClientId = null;

  function init() {
    var addBtn = document.getElementById('add-client-btn');
    var clientForm = document.getElementById('client-form');
    var cancelBtn = document.getElementById('client-cancel-btn');
    var searchInput = document.getElementById('client-search');
    var exportBtn = document.getElementById('export-btn');
    var importBtn = document.getElementById('import-btn');
    var importFile = document.getElementById('import-file');

    if (addBtn) addBtn.addEventListener('click', showAddForm);
    if (clientForm) clientForm.addEventListener('submit', function(e) { e.preventDefault(); handleFormSubmit(); });
    if (cancelBtn) cancelBtn.addEventListener('click', hideForm);
    if (searchInput) searchInput.addEventListener('input', function() { renderClientList(searchInput.value.trim()); });
    if (exportBtn) exportBtn.addEventListener('click', exportClients);
    if (importBtn) importBtn.addEventListener('click', function() { if (importFile) importFile.click(); });
    if (importFile) importFile.addEventListener('change', handleImportFile);

    renderClientList();
  }

  async function renderClientList(searchTerm) {
    var container = document.getElementById('client-list');
    if (!container) return;

    try {
      var clients = await DB.getAllClients();
      if (!clients || clients.length === 0) {
        container.innerHTML = '<p class="empty-message">No clients yet. Tap + to add one.</p>';
        return;
      }

      // Search filter
      if (searchTerm) {
        var lower = searchTerm.toLowerCase();
        clients = clients.filter(function(c) { return c.name.toLowerCase().indexOf(lower) !== -1; });
      }
      if (clients.length === 0) {
        container.innerHTML = '<p class="empty-message">No clients match your search.</p>';
        return;
      }

      clients.sort(function(a, b) { return a.name.localeCompare(b.name); });

      var html = '';
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        var loans = await DB.getLoansByClient(client.id);
        var activeLoans = loans.filter(function(l) { return l.status === 'active'; });

        html += '<div class="client-card">';
        html += '<div class="client-header">';
        html += '<div class="client-info"><div class="client-name">' + esc(client.name) + '</div><div class="client-mobile">' + esc(client.mobile) + '</div></div>';
        html += '<div class="client-actions">';
        html += '<button class="btn-icon btn-add-loan" data-client-id="' + client.id + '" title="Add Loan">➕</button>';
        html += '<button class="btn-icon btn-edit-client" data-client-id="' + client.id + '" title="Edit">✏️</button>';
        html += '<button class="btn-icon btn-delete-client" data-client-id="' + client.id + '" title="Delete">🗑️</button>';
        html += '</div></div>';

        // Loan sub-items
        if (activeLoans.length === 0) {
          html += '<div class="loan-list-empty">No active loans</div>';
        } else {
          html += '<div class="loan-list">';
          for (var j = 0; j < activeLoans.length; j++) {
            var loan = activeLoans[j];
            var typeLabel = loan.loanType === 'interest_only' ? 'Interest Only' : 'Daily EMI';
            var badgeClass = loan.loanType === 'interest_only' ? 'badge-interest-only' : 'badge-daily-emi';
            var amountInfo = loan.loanType === 'interest_only'
              ? 'Principal: ₹' + (loan.principalBalance || 0).toFixed(2) + ' @ ' + (loan.interestRate || 0) + '%'
              : '₹' + loan.totalAmount.toFixed(2) + ' | EMI: ₹' + loan.emi.toFixed(2);

            html += '<div class="loan-item">';
            html += '<div class="loan-item-info">';
            html += '<span class="loan-type-badge ' + badgeClass + '">' + typeLabel + '</span> ';
            html += '<span class="loan-amount-info">' + amountInfo + '</span>';
            if (loan.notes) html += '<div class="loan-notes">' + esc(loan.notes) + '</div>';
            html += '</div>';
            html += '<div class="loan-item-actions">';
            if (loan.loanType === 'interest_only' && loan.principalBalance > 0) {
              html += '<button class="btn-xs btn-pay-principal" data-loan-id="' + loan.id + '" title="Pay Principal">💳</button>';
            }
            html += '<button class="btn-xs btn-edit-loan" data-loan-id="' + loan.id + '" title="Edit Loan">✏️</button>';
            html += '<button class="btn-xs btn-close-loan" data-loan-id="' + loan.id + '" title="Close Loan">✅</button>';
            html += '<button class="btn-xs btn-delete-loan" data-loan-id="' + loan.id + '" title="Delete Loan">🗑️</button>';
            html += '</div></div>';
          }
          html += '</div>';
        }
        html += '</div>';
      }

      container.innerHTML = html;
      attachEventHandlers(container);
    } catch(e) {
      container.innerHTML = '<p class="empty-message">Could not load data.</p>';
      console.error('Error:', e);
    }
  }

  function attachEventHandlers(container) {
    container.querySelectorAll('.btn-add-loan').forEach(function(btn) {
      btn.addEventListener('click', function() { Loans.showAddLoanForm(btn.dataset.clientId); });
    });
    container.querySelectorAll('.btn-edit-client').forEach(function(btn) {
      btn.addEventListener('click', function() { showEditForm(btn.dataset.clientId); });
    });
    container.querySelectorAll('.btn-delete-client').forEach(function(btn) {
      btn.addEventListener('click', function() { deleteClient(btn.dataset.clientId); });
    });
    container.querySelectorAll('.btn-edit-loan').forEach(function(btn) {
      btn.addEventListener('click', function() { Loans.showEditLoanForm(btn.dataset.loanId); });
    });
    container.querySelectorAll('.btn-close-loan').forEach(function(btn) {
      btn.addEventListener('click', function() { Loans.closeLoan(btn.dataset.loanId); });
    });
    container.querySelectorAll('.btn-delete-loan').forEach(function(btn) {
      btn.addEventListener('click', function() { Loans.deleteLoan(btn.dataset.loanId); });
    });
    container.querySelectorAll('.btn-pay-principal').forEach(function(btn) {
      btn.addEventListener('click', function() { showPrincipalModal(btn.dataset.loanId); });
    });
  }

  function showAddForm() {
    editingClientId = null;
    var form = document.getElementById('client-form');
    var title = document.getElementById('client-form-title');
    var container = document.getElementById('client-form-container');
    if (form) form.reset();
    if (title) title.textContent = 'Add Client';
    if (container) container.removeAttribute('hidden');
    clearErrors();
  }

  async function showEditForm(clientId) {
    var client = await DB.getClient(clientId);
    if (!client) { alert('Client not found.'); return; }
    editingClientId = clientId;
    var title = document.getElementById('client-form-title');
    var container = document.getElementById('client-form-container');
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-mobile').value = client.mobile;
    if (title) title.textContent = 'Edit Client';
    if (container) container.removeAttribute('hidden');
    clearErrors();
  }

  async function handleFormSubmit() {
    clearErrors();
    var name = (document.getElementById('client-name').value || '').trim();
    var mobile = (document.getElementById('client-mobile').value || '').trim();

    // Validate
    var errors = [];
    if (!name) errors.push({ field: 'client-name', msg: 'Name is required.' });
    if (!mobile) errors.push({ field: 'client-mobile', msg: 'Mobile is required.' });
    else if (!/^\d{10}$/.test(mobile.replace(/\s/g, ''))) errors.push({ field: 'client-mobile', msg: 'Enter exactly 10 digits.' });

    // Uniqueness check
    if (name) {
      var all = await DB.getAllClients();
      var dup = all.find(function(c) {
        if (editingClientId && c.id === editingClientId) return false;
        return c.name.trim().toLowerCase() === name.toLowerCase();
      });
      if (dup) errors.push({ field: 'client-name', msg: 'Client name already exists.' });
    }

    if (errors.length > 0) { showErrors(errors); return; }

    // License check for new clients
    if (!editingClientId) {
      if (typeof License !== 'undefined') {
        var canAdd = await License.checkClientLimit();
        if (!canAdd) return;
      }
    }

    try {
      if (editingClientId) {
        var existing = await DB.getClient(editingClientId);
        await DB.updateClient({ id: editingClientId, name: name, mobile: mobile.replace(/\s/g, ''), createdAt: existing.createdAt });
      } else {
        await DB.addClient({ id: DB.generateId(), name: name, mobile: mobile.replace(/\s/g, ''), createdAt: new Date().toISOString() });
      }
      hideForm();
      renderClientList();
    } catch(e) { alert('Save failed: ' + e.message); }
  }

  async function deleteClient(clientId) {
    var client = await DB.getClient(clientId);
    if (!client) return;
    if (!confirm('Delete "' + client.name + '" and ALL their loans and payments?')) return;
    try {
      await DB.deleteClientCascade(clientId);
      renderClientList();
    } catch(e) { alert('Delete failed: ' + e.message); }
  }

  function hideForm() {
    var container = document.getElementById('client-form-container');
    if (container) container.setAttribute('hidden', '');
    editingClientId = null;
  }

  // Principal payment modal
  var principalLoan = null;
  async function showPrincipalModal(loanId) {
    var loan = await DB.getLoan(loanId);
    if (!loan || loan.principalBalance <= 0) { alert('No outstanding principal.'); return; }
    principalLoan = loan;
    var modal = document.getElementById('principal-modal');
    var nameEl = document.getElementById('principal-client-name');
    var amountInput = document.getElementById('principal-amount');
    var dateInput = document.getElementById('principal-date');
    var errorEl = document.getElementById('principal-error');
    var qrEl = document.getElementById('principal-qr');

    var client = await DB.getClient(loan.clientId);
    if (nameEl) nameEl.textContent = client ? client.name : 'Unknown';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (amountInput) amountInput.value = loan.principalBalance.toFixed(2);
    if (errorEl) errorEl.textContent = '';

    // Generate QR
    var upiId = Settings.getUpiId();
    if (upiId && qrEl) {
      try {
        var link = 'upi://pay?pa=' + upiId + '&pn=' + encodeURIComponent(Settings.getAppName()) + '&am=' + loan.principalBalance.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent((client ? client.name : '') + ' Principal');
        var qr = qrcode(0, 'M'); qr.addData(link); qr.make();
        qrEl.innerHTML = qr.createSvgTag(4, 0);
      } catch(e) { qrEl.innerHTML = '<p>QR generation failed</p>'; }
    } else if (qrEl) { qrEl.innerHTML = '<p>Configure UPI in Settings</p>'; }

    if (modal) modal.removeAttribute('hidden');

    // Rebind handlers
    var confirmBtn = document.getElementById('principal-confirm-btn');
    var cancelBtn = document.getElementById('principal-cancel-btn');
    if (confirmBtn) confirmBtn.onclick = confirmPrincipalPayment;
    if (cancelBtn) cancelBtn.onclick = function() { modal.setAttribute('hidden', ''); };

    // Re-gen QR on amount change
    if (amountInput) amountInput.oninput = function() {
      var amt = parseFloat(amountInput.value);
      if (!isNaN(amt) && amt > 0 && upiId && qrEl) {
        try {
          var l2 = 'upi://pay?pa=' + upiId + '&pn=' + encodeURIComponent(Settings.getAppName()) + '&am=' + amt.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent((client ? client.name : '') + ' Principal');
          var q2 = qrcode(0, 'M'); q2.addData(l2); q2.make();
          qrEl.innerHTML = q2.createSvgTag(4, 0);
        } catch(e) {}
      }
    };
  }

  async function confirmPrincipalPayment() {
    if (!principalLoan) return;
    var amountInput = document.getElementById('principal-amount');
    var dateInput = document.getElementById('principal-date');
    var errorEl = document.getElementById('principal-error');
    var amount = parseFloat(amountInput.value);
    var date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];

    if (isNaN(amount) || amount <= 0) { if (errorEl) errorEl.textContent = 'Amount must be greater than zero.'; return; }
    if (amount > principalLoan.principalBalance) { if (errorEl) errorEl.textContent = 'Cannot exceed ₹' + principalLoan.principalBalance.toFixed(2); return; }

    try {
      await DB.addPayment({ id: DB.generateId(), loanId: principalLoan.id, date: date, amount: amount, paymentType: 'principal', createdAt: new Date().toISOString() });
      var newBal = Math.round((principalLoan.principalBalance - amount) * 100) / 100;
      principalLoan.principalBalance = newBal;
      await DB.updateLoan(principalLoan);
      var modal = document.getElementById('principal-modal');
      if (modal) modal.setAttribute('hidden', '');
      principalLoan = null;
      renderClientList();
    } catch(e) { alert('Payment failed: ' + e.message); }
  }

  // Export
  async function exportClients() {
    if (typeof License !== 'undefined' && !License.isLicensed()) {
      alert('Export requires a valid license.\nGo to Settings → License to activate.');
      return;
    }
    var clients = await DB.getAllClients();
    var loans = await DB.getAllLoans();
    if (!clients.length) { alert('No clients to export.'); return; }

    var csv = 'Client Name,Mobile,Loan Type,Amount,Start Date,Duration,Interest Rate,EMI,Notes\n';
    for (var i = 0; i < clients.length; i++) {
      var clientLoans = loans.filter(function(l) { return l.clientId === clients[i].id && l.status === 'active'; });
      if (clientLoans.length === 0) {
        csv += '"' + clients[i].name.replace(/"/g, '""') + '","' + clients[i].mobile + '",,,,,,\n';
      } else {
        for (var j = 0; j < clientLoans.length; j++) {
          var l = clientLoans[j];
          csv += '"' + clients[i].name.replace(/"/g, '""') + '","' + clients[i].mobile + '","' + l.loanType + '",' + l.totalAmount + ',"' + (l.startDate || '') + '",' + (l.duration || '') + ',' + (l.interestRate || '') + ',' + (l.emi || '') + ',"' + (l.notes || '').replace(/"/g, '""') + '"\n';
        }
      }
    }
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'payup-clients-' + new Date().toISOString().split('T')[0] + '.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Import
  function handleImportFile(event) {
    if (typeof License !== 'undefined' && !License.isLicensed()) {
      alert('Import requires a valid license.\nGo to Settings → License to activate.');
      event.target.value = '';
      return;
    }
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) { importCSV(e.target.result); };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function importCSV(content) {
    var lines = content.split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (lines.length < 2) { alert('Empty CSV.'); return; }
    var existing = await DB.getAllClients();
    var names = existing.map(function(c) { return c.name.toLowerCase(); });
    var imported = 0, skipped = 0;

    for (var i = 1; i < lines.length; i++) {
      var fields = parseCSVLine(lines[i]);
      var name = (fields[0] || '').trim();
      var mobile = (fields[1] || '').trim();
      if (!name || !mobile) continue;

      var clientId;
      if (names.indexOf(name.toLowerCase()) === -1) {
        clientId = DB.generateId();
        await DB.addClient({ id: clientId, name: name, mobile: mobile.replace(/\s/g, ''), createdAt: new Date().toISOString() });
        names.push(name.toLowerCase());
        imported++;
      } else {
        var found = existing.find(function(c) { return c.name.toLowerCase() === name.toLowerCase(); });
        clientId = found ? found.id : null;
        skipped++;
      }

      // Create loan if data present
      if (clientId && fields[2]) {
        var loanType = fields[2].trim() || 'daily_emi';
        var amount = parseFloat(fields[3]) || 0;
        var startDate = (fields[4] || '').trim() || new Date().toISOString().split('T')[0];
        var duration = parseInt(fields[5], 10) || 100;
        var rate = parseFloat(fields[6]) || 0;
        var emi = parseFloat(fields[7]) || 0;
        var notes = (fields[8] || '').trim();

        if (amount > 0) {
          if (!emi || emi <= 0) emi = loanType === 'interest_only' ? Loans.calculateInterestEMI(amount, rate) : Loans.calculateEMI(amount, duration);
          await DB.addLoan({
            id: DB.generateId(), clientId: clientId, loanType: loanType, totalAmount: amount,
            startDate: startDate, duration: loanType === 'daily_emi' ? duration : null,
            emi: emi, endDate: loanType === 'daily_emi' ? Loans.calculateEndDate(startDate, duration) : null,
            interestRate: loanType === 'interest_only' ? rate : null,
            principalBalance: loanType === 'interest_only' ? amount : null,
            notes: notes, status: 'active', createdAt: new Date().toISOString()
          });
        }
      }
    }
    alert('Import done: ' + imported + ' new clients, ' + skipped + ' existing (loans added).');
    renderClientList();
  }

  function parseCSVLine(line) {
    var fields = [], current = '', inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) { if (ch === '"') { if (line[i+1] === '"') { current += '"'; i++; } else inQuotes = false; } else current += ch; }
      else { if (ch === '"') inQuotes = true; else if (ch === ',') { fields.push(current); current = ''; } else current += ch; }
    }
    fields.push(current);
    return fields;
  }

  function clearErrors() { document.querySelectorAll('#client-form .error-message').forEach(function(el) { el.textContent = ''; }); }
  function showErrors(errors) { errors.forEach(function(e) { var el = document.getElementById(e.field + '-error'); if (el) el.textContent = e.msg; }); }
  function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

  return { init, renderClientList, showAddForm, showEditForm, handleFormSubmit, deleteClient, exportClients, handleImportFile };
})();
