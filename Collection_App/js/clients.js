// Client Master module — CRUD operations for client records

var ClientMaster = (function() {
  'use strict';

  var editingClientId = null;

  /**
   * Initialize the Client Master module.
   * Sets up event listeners and renders the initial client list.
   */
  function init() {
    var addBtn = document.getElementById('add-client-btn');
    var cancelBtn = document.getElementById('client-cancel-btn');
    var clientForm = document.getElementById('client-form');
    var amountInput = document.getElementById('client-amount');
    var durationInput = document.getElementById('client-duration');
    var startDateInput = document.getElementById('client-start-date');
    var searchInput = document.getElementById('client-search');
    var loanTypeSelect = document.getElementById('client-loan-type');
    var interestRateInput = document.getElementById('client-interest-rate');

    if (addBtn) {
      addBtn.addEventListener('click', showAddForm);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', hideForm);
    }

    if (clientForm) {
      clientForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleFormSubmit();
      });
    }

    // Auto-recalculate EMI and End Date when amount or duration changes
    if (amountInput) {
      amountInput.addEventListener('input', autoRecalculate);
    }
    if (durationInput) {
      durationInput.addEventListener('input', autoRecalculate);
    }
    if (startDateInput) {
      startDateInput.addEventListener('input', autoRecalculate);
    }

    // Loan type change listener — toggle fields and recalculate
    if (loanTypeSelect) {
      loanTypeSelect.addEventListener('change', function() {
        toggleLoanTypeFields(loanTypeSelect.value);
        autoRecalculate();
      });
    }

    // Interest rate input listener — trigger recalculation for interest-only
    if (interestRateInput) {
      interestRateInput.addEventListener('input', autoRecalculate);
    }

    // Search filter
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        renderClientList(searchInput.value.trim());
      });
    }

    // Import/Export buttons
    var exportBtn = document.getElementById('export-clients-btn');
    var importBtn = document.getElementById('import-clients-btn');
    var importFile = document.getElementById('import-clients-file');

    if (exportBtn) {
      exportBtn.addEventListener('click', exportClients);
    }
    if (importBtn) {
      importBtn.addEventListener('click', function() {
        if (importFile) importFile.click();
      });
    }
    if (importFile) {
      importFile.addEventListener('change', handleImportFile);
    }

    renderClientList();
  }

  /**
   * Toggle visibility of form groups based on the selected loan type.
   * @param {string} loanType - "daily_emi" or "interest_only"
   */
  function toggleLoanTypeFields(loanType) {
    var durationGroup = document.getElementById('client-duration') ? document.getElementById('client-duration').parentElement : null;
    var endDateGroup = document.getElementById('client-end-date') ? document.getElementById('client-end-date').parentElement : null;
    var interestRateGroup = document.getElementById('interest-rate-group');
    var principalBalanceGroup = document.getElementById('principal-balance-group');

    if (loanType === 'interest_only') {
      // Hide Duration and End Date groups
      if (durationGroup) durationGroup.setAttribute('hidden', '');
      if (endDateGroup) endDateGroup.setAttribute('hidden', '');
      // Show Interest Rate group
      if (interestRateGroup) interestRateGroup.removeAttribute('hidden');
    } else {
      // Show Duration and End Date groups
      if (durationGroup) durationGroup.removeAttribute('hidden');
      if (endDateGroup) endDateGroup.removeAttribute('hidden');
      // Hide Interest Rate group and Principal Balance group
      if (interestRateGroup) interestRateGroup.setAttribute('hidden', '');
      if (principalBalanceGroup) principalBalanceGroup.setAttribute('hidden', '');
    }
  }

  /**
   * Auto-recalculate EMI and End Date based on current form values.
   * Branches on loan type: daily_emi uses amount/duration, interest_only uses amount*rate/100.
   */
  function autoRecalculate() {
    var loanType = document.getElementById('client-loan-type') ? document.getElementById('client-loan-type').value : 'daily_emi';
    var amount = parseFloat(document.getElementById('client-amount').value);
    var emiInput = document.getElementById('client-emi');
    var endDateInput = document.getElementById('client-end-date');

    if (loanType === 'interest_only') {
      var interestRate = parseFloat(document.getElementById('client-interest-rate').value);
      if (!isNaN(amount) && amount > 0 && !isNaN(interestRate) && interestRate > 0) {
        emiInput.value = Math.round((amount * interestRate / 100) * 100) / 100;
      }
      // No end date calculation for interest-only
    } else {
      // Daily EMI: existing logic
      var duration = parseInt(document.getElementById('client-duration').value, 10);
      var startDate = document.getElementById('client-start-date').value;

      if (!isNaN(amount) && amount > 0 && !isNaN(duration) && duration > 0) {
        emiInput.value = calculateEMI(amount, duration);
      }

      if (startDate && !isNaN(duration) && duration > 0) {
        endDateInput.value = calculateEndDate(startDate, duration);
      }
    }
  }

  /**
   * Render the list of all clients as card elements.
   */
  async function renderClientList(searchTerm) {
    var listContainer = document.getElementById('client-list');
    if (!listContainer) return;

    try {
      var clients = await DB.getAllClients();

      if (!clients || clients.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No clients added yet. Tap + to add a client.</p>';
        return;
      }

      // Filter by search term
      if (searchTerm) {
        var lowerSearch = searchTerm.toLowerCase();
        clients = clients.filter(function(c) {
          return c.name.toLowerCase().indexOf(lowerSearch) !== -1;
        });
      }

      if (clients.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No clients match your search.</p>';
        return;
      }

      // Sort alphabetically by name
      clients.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });

      var html = '';
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        html += renderClientCard(client);
      }

      listContainer.innerHTML = html;

      // Attach edit/delete/pay-principal event listeners
      clients.forEach(function(client) {
        var editBtn = document.getElementById('edit-' + client.id);
        var deleteBtn = document.getElementById('delete-' + client.id);
        var payPrincipalBtn = document.getElementById('pay-principal-' + client.id);

        if (editBtn) {
          editBtn.addEventListener('click', function() {
            showEditForm(client.id);
          });
        }
        if (deleteBtn) {
          deleteBtn.addEventListener('click', function() {
            deleteClient(client.id);
          });
        }
        if (payPrincipalBtn) {
          payPrincipalBtn.addEventListener('click', function() {
            showClientPrincipalModal(client);
          });
        }
      });
    } catch (e) {
      listContainer.innerHTML = '<p class="empty-message">Could not load data. Please try again.</p>';
      console.error('Error rendering client list:', e);
    }
  }

  /**
   * Render a single client card HTML.
   */
  function renderClientCard(client) {
    // Determine loan type badge
    var loanTypeBadge;
    if (client.loanType === 'interest_only') {
      loanTypeBadge = '<span class="loan-type-badge badge-interest-only">Interest Only</span>';
    } else {
      loanTypeBadge = '<span class="loan-type-badge badge-daily-emi">Daily EMI</span>';
    }

    // Determine amount display: principal balance for interest-only, total amount for daily_emi
    var amountDisplay;
    if (client.loanType === 'interest_only') {
      var principalBal = typeof client.principalBalance === 'number' ? client.principalBalance.toFixed(2) : '0.00';
      amountDisplay = 'Principal: ₹' + principalBal;
    } else {
      amountDisplay = typeof client.totalAmount === 'number' ? '₹' + client.totalAmount.toFixed(2) : '';
    }

    return '<div class="client-card">' +
      '<div class="client-info">' +
        '<div class="client-name">' + escapeHtml(client.name) + ' ' + loanTypeBadge + '</div>' +
        '<div class="client-details">' + escapeHtml(client.mobile) + ' | ' + amountDisplay + '</div>' +
      '</div>' +
      '<div class="client-actions">' +
        (client.loanType === 'interest_only' && client.principalBalance > 0
          ? '<button id="pay-principal-' + client.id + '" class="btn-pay-principal" aria-label="Pay principal for ' + escapeHtml(client.name) + '">💳</button>'
          : '') +
        '<button id="edit-' + client.id + '" class="btn-edit" aria-label="Edit ' + escapeHtml(client.name) + '">✏️</button>' +
        '<button id="delete-' + client.id + '" class="btn-delete" aria-label="Delete ' + escapeHtml(client.name) + '">🗑️</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * Show the add client form with defaults.
   */
  function showAddForm() {
    editingClientId = null;
    clearForm();

    var formTitle = document.getElementById('client-form-title');
    if (formTitle) formTitle.textContent = 'Add Client';

    var loanTypeSelect = document.getElementById('client-loan-type');
    if (loanTypeSelect) loanTypeSelect.value = 'daily_emi';
    toggleLoanTypeFields('daily_emi');

    var durationInput = document.getElementById('client-duration');
    if (durationInput) durationInput.value = '100';

    var startDateInput = document.getElementById('client-start-date');
    if (startDateInput) startDateInput.value = getTodayISO();

    var formContainer = document.getElementById('client-form-container');
    if (formContainer) formContainer.removeAttribute('hidden');

    var addBtn = document.getElementById('add-client-btn');
    if (addBtn) addBtn.style.display = 'none';
  }

  /**
   * Show the edit form pre-filled with client data.
   */
  async function showEditForm(id) {
    try {
      var client = await DB.getClient(id);
      if (!client) {
        alert('Client not found.');
        return;
      }

      editingClientId = id;
      clearErrors();

      var formTitle = document.getElementById('client-form-title');
      if (formTitle) formTitle.textContent = 'Edit Client';

      document.getElementById('client-id').value = client.id;
      document.getElementById('client-name').value = client.name || '';
      document.getElementById('client-mobile').value = client.mobile || '';
      document.getElementById('client-amount').value = client.totalAmount || '';
      document.getElementById('client-start-date').value = client.startDate || '';
      document.getElementById('client-duration').value = client.duration || '';
      document.getElementById('client-emi').value = client.emi || '';
      document.getElementById('client-end-date').value = client.endDate || '';
      document.getElementById('client-notes').value = client.notes || '';

      // Set loan type selector and toggle fields
      var loanType = client.loanType || 'daily_emi';
      var loanTypeSelect = document.getElementById('client-loan-type');
      if (loanTypeSelect) loanTypeSelect.value = loanType;
      toggleLoanTypeFields(loanType);

      // For interest-only clients, populate interest rate and display principal balance
      if (loanType === 'interest_only') {
        var interestRateInput = document.getElementById('client-interest-rate');
        if (interestRateInput && client.interestRate != null) {
          interestRateInput.value = client.interestRate;
        }

        var principalBalanceDisplay = document.getElementById('client-principal-balance-display');
        if (principalBalanceDisplay && client.principalBalance != null) {
          principalBalanceDisplay.textContent = '₹' + client.principalBalance.toFixed(2);
        }

        var principalBalanceGroup = document.getElementById('principal-balance-group');
        if (principalBalanceGroup) principalBalanceGroup.removeAttribute('hidden');
      }

      var formContainer = document.getElementById('client-form-container');
      if (formContainer) formContainer.removeAttribute('hidden');

      var addBtn = document.getElementById('add-client-btn');
      if (addBtn) addBtn.style.display = 'none';
    } catch (e) {
      alert('Error loading client: ' + e.message);
    }
  }

  /**
   * Hide the form and show the FAB button again.
   */
  function hideForm() {
    var formContainer = document.getElementById('client-form-container');
    if (formContainer) formContainer.setAttribute('hidden', '');

    var addBtn = document.getElementById('add-client-btn');
    if (addBtn) addBtn.style.display = '';

    editingClientId = null;
    clearForm();
  }

  /**
   * Handle form submission — validate and save.
   */
  async function handleFormSubmit() {
    clearErrors();

    var loanType = document.getElementById('client-loan-type') ? document.getElementById('client-loan-type').value : 'daily_emi';
    var interestRate = parseFloat(document.getElementById('client-interest-rate').value);

    var data = {
      name: (document.getElementById('client-name').value || '').trim(),
      mobile: (document.getElementById('client-mobile').value || '').trim(),
      totalAmount: parseFloat(document.getElementById('client-amount').value),
      startDate: document.getElementById('client-start-date').value,
      duration: parseInt(document.getElementById('client-duration').value, 10),
      emi: parseFloat(document.getElementById('client-emi').value),
      loanType: loanType,
      interestRate: loanType === 'interest_only' ? interestRate : null,
      notes: (document.getElementById('client-notes').value || '').trim()
    };

    var errors = await validateForm(data);
    if (errors.length > 0) {
      displayErrors(errors);
      return;
    }

    if (loanType === 'interest_only') {
      // Interest-only: no duration/endDate, set principalBalance to totalAmount
      data.duration = null;
      data.endDate = null;
      data.principalBalance = data.totalAmount;

      // Calculate EMI as interest amount if not manually set
      if (isNaN(data.emi) || data.emi <= 0) {
        data.emi = Math.round((data.totalAmount * interestRate / 100) * 100) / 100;
      }
    } else {
      // Daily EMI: existing logic
      data.loanType = 'daily_emi';
      data.interestRate = null;
      data.principalBalance = null;

      if (isNaN(data.emi) || data.emi <= 0) {
        data.emi = calculateEMI(data.totalAmount, data.duration);
      }
      data.endDate = calculateEndDate(data.startDate, data.duration);
    }

    await saveClient(data);
  }

  /**
   * Validate client form data.
   * @returns {Array} Array of {field, message} objects
   */
  async function validateForm(data) {
    var errors = [];

    // Mandatory fields
    if (!data.name || data.name === '') {
      errors.push({ field: 'client-name', message: 'Client Name is required.' });
    }

    if (!data.mobile || data.mobile === '') {
      errors.push({ field: 'client-mobile', message: 'Mobile number is required.' });
    } else if (!/^\d{10}$/.test(data.mobile.replace(/\s/g, ''))) {
      errors.push({ field: 'client-mobile', message: 'Enter exactly 10 digits (spaces allowed).' });
    }

    if (isNaN(data.totalAmount) || data.totalAmount <= 0) {
      errors.push({ field: 'client-amount', message: 'Amount must be greater than zero.' });
    }

    if (!data.startDate) {
      errors.push({ field: 'client-start-date', message: 'Collection start date is required.' });
    }

    // Loan-type-specific validation
    if (data.loanType === 'interest_only') {
      // Validate interest rate
      if (isNaN(data.interestRate) || data.interestRate <= 0) {
        errors.push({ field: 'client-interest-rate', message: 'Monthly interest rate must be greater than zero.' });
      } else if (data.interestRate > 100) {
        errors.push({ field: 'client-interest-rate', message: 'Monthly interest rate cannot exceed 100%.' });
      }
      // Skip duration validation for interest-only
    } else {
      // Daily EMI: validate duration
      if (isNaN(data.duration) || data.duration <= 0) {
        errors.push({ field: 'client-duration', message: 'Duration must be at least 1 day.' });
      }
      // Skip interest rate validation for daily_emi
    }

    // Check name uniqueness
    if (data.name && data.name !== '') {
      try {
        var allClients = await DB.getAllClients();
        var normalizedName = data.name.toLowerCase();
        var duplicate = allClients.find(function(c) {
          if (editingClientId && c.id === editingClientId) return false;
          return c.name.trim().toLowerCase() === normalizedName;
        });
        if (duplicate) {
          errors.push({ field: 'client-name', message: 'Client name already exists.' });
        }
      } catch (e) {
        // Skip uniqueness check on DB error
      }
    }

    return errors;
  }

  /**
   * Save a client (add or update).
   */
  async function saveClient(data) {
    try {
      if (editingClientId) {
        var clientRecord = {
          id: editingClientId,
          name: data.name,
          mobile: data.mobile.replace(/\s/g, ''),
          totalAmount: data.totalAmount,
          startDate: data.startDate,
          duration: data.duration,
          emi: data.emi,
          endDate: data.endDate,
          loanType: data.loanType,
          interestRate: data.interestRate,
          principalBalance: data.principalBalance,
          notes: data.notes || '',
          createdAt: undefined
        };

        // Preserve original createdAt and principalBalance for interest-only edits
        var existing = await DB.getClient(editingClientId);
        if (existing) {
          clientRecord.createdAt = existing.createdAt;
          // For interest-only clients, preserve existing principalBalance (don't overwrite from form)
          if (data.loanType === 'interest_only' && existing.principalBalance != null) {
            clientRecord.principalBalance = existing.principalBalance;
          }
        } else {
          clientRecord.createdAt = new Date().toISOString();
        }

        await DB.updateClient(clientRecord);
      } else {
        var newClient = {
          id: generateUUID(),
          name: data.name,
          mobile: data.mobile.replace(/\s/g, ''),
          totalAmount: data.totalAmount,
          startDate: data.startDate,
          duration: data.duration,
          emi: data.emi,
          endDate: data.endDate,
          loanType: data.loanType,
          interestRate: data.interestRate,
          principalBalance: data.principalBalance,
          notes: data.notes || '',
          createdAt: new Date().toISOString()
        };

        await DB.addClient(newClient);
      }

      hideForm();
      renderClientList();
    } catch (e) {
      var errorMsg = e.message || 'Failed to save client.';
      alert(errorMsg);
      console.error('Save client error:', e);
    }
  }

  /**
   * Delete a client after confirmation, including all associated payments.
   */
  async function deleteClient(id) {
    try {
      var client = await DB.getClient(id);
      if (!client) {
        alert('Client not found.');
        return;
      }

      var confirmed = confirm('Are you sure you want to delete "' + client.name + '"? This will also delete all payment records for this client.');
      if (!confirmed) return;

      await DB.deletePaymentsByClient(id);
      await DB.deleteClient(id);
      renderClientList();
    } catch (e) {
      alert('Could not delete client: ' + (e.message || 'Unknown error'));
      console.error('Delete client error:', e);
    }
  }

  /**
   * Calculate EMI: amount / duration, rounded to 2 decimal places.
   */
  function calculateEMI(amount, duration) {
    if (!amount || !duration || duration <= 0) return 0;
    return Math.round((amount / duration) * 100) / 100;
  }

  /**
   * Calculate end date: startDate + duration days.
   * @returns {string} ISO date string (YYYY-MM-DD)
   */
  function calculateEndDate(startDate, duration) {
    if (!startDate || !duration) return '';
    var date = new Date(startDate);
    date.setDate(date.getDate() + duration);
    return date.toISOString().split('T')[0];
  }

  // ─── Principal Payment from Client Tab ───

  var principalClient = null;

  /**
   * Show the principal payment modal for an interest-only client.
   * Pre-fills amount with principal balance and generates QR.
   * @param {Object} client - Client record
   */
  function showClientPrincipalModal(client) {
    principalClient = client;

    var modal = document.getElementById('client-principal-modal');
    var nameEl = document.getElementById('client-principal-name');
    var dateInput = document.getElementById('client-principal-date');
    var amountInput = document.getElementById('client-principal-amount');
    var amountError = document.getElementById('client-principal-amount-error');
    var qrContainer = document.getElementById('client-principal-qr');

    if (nameEl) nameEl.textContent = client.name;
    if (dateInput && !dateInput.value) dateInput.value = getTodayISO();
    if (amountInput) amountInput.value = client.principalBalance.toFixed(2);
    if (amountError) amountError.textContent = '';

    // Generate QR with principal balance amount
    var upiId = Settings.getUpiId();
    var appName = Settings.getAppName();
    if (upiId && qrContainer) {
      var upiLink = 'upi://pay?pa=' + upiId +
        '&pn=' + encodeURIComponent(appName) +
        '&am=' + client.principalBalance.toFixed(2) +
        '&cu=INR' +
        '&tn=' + encodeURIComponent(client.name + ' Principal');
      try {
        var qr = qrcode(0, 'M');
        qr.addData(upiLink);
        qr.make();
        qrContainer.innerHTML = qr.createSvgTag(4, 0);
      } catch (e) {
        qrContainer.innerHTML = '<a href="' + escapeHtml(upiLink) + '" class="qr-fallback-link">Tap to pay via UPI</a>';
      }
    } else if (qrContainer) {
      qrContainer.innerHTML = '<p class="qr-placeholder">Configure UPI ID in Settings</p>';
    }

    if (modal) modal.removeAttribute('hidden');

    // Attach confirm/cancel handlers
    var confirmBtn = document.getElementById('client-principal-confirm-btn');
    var cancelBtn = document.getElementById('client-principal-cancel-btn');

    if (confirmBtn) {
      confirmBtn.onclick = handleClientPrincipalConfirm;
    }
    if (cancelBtn) {
      cancelBtn.onclick = hideClientPrincipalModal;
    }

    // Re-generate QR when amount changes
    if (amountInput) {
      amountInput.oninput = function() {
        var amt = parseFloat(amountInput.value);
        if (!isNaN(amt) && amt > 0 && upiId && qrContainer) {
          var link = 'upi://pay?pa=' + upiId +
            '&pn=' + encodeURIComponent(appName) +
            '&am=' + amt.toFixed(2) +
            '&cu=INR' +
            '&tn=' + encodeURIComponent(client.name + ' Principal');
          try {
            var q = qrcode(0, 'M');
            q.addData(link);
            q.make();
            qrContainer.innerHTML = q.createSvgTag(4, 0);
          } catch (e) {
            qrContainer.innerHTML = '<a href="' + escapeHtml(link) + '" class="qr-fallback-link">Tap to pay via UPI</a>';
          }
        }
      };
    }
  }

  /**
   * Handle confirm principal payment from client tab.
   */
  async function handleClientPrincipalConfirm() {
    if (!principalClient) return;

    var amountInput = document.getElementById('client-principal-amount');
    var amountError = document.getElementById('client-principal-amount-error');
    var dateInput = document.getElementById('client-principal-date');

    var amount = parseFloat(amountInput.value);
    var date = dateInput ? dateInput.value : getTodayISO();

    if (isNaN(amount) || amount <= 0) {
      if (amountError) amountError.textContent = 'Amount must be greater than zero.';
      return;
    }

    if (amount > principalClient.principalBalance) {
      if (amountError) amountError.textContent = 'Amount cannot exceed outstanding principal of ₹' + principalClient.principalBalance.toFixed(2);
      return;
    }

    if (amountError) amountError.textContent = '';

    try {
      var payment = {
        id: generateUUID(),
        clientId: principalClient.id,
        date: date,
        amount: amount,
        paymentType: 'principal',
        createdAt: new Date().toISOString()
      };

      await DB.addPayment(payment);

      var newBalance = Math.round((principalClient.principalBalance - amount) * 100) / 100;
      await DB.updateClientPrincipalBalance(principalClient.id, newBalance);

      hideClientPrincipalModal();
      renderClientList();
    } catch (e) {
      alert('Payment could not be saved: ' + (e.message || 'Unknown error'));
    }
  }

  /**
   * Hide the principal payment modal.
   */
  function hideClientPrincipalModal() {
    var modal = document.getElementById('client-principal-modal');
    if (modal) modal.setAttribute('hidden', '');
    var qrContainer = document.getElementById('client-principal-qr');
    if (qrContainer) qrContainer.innerHTML = '';
    principalClient = null;
  }

  // ─── Helper Functions ───

  function clearForm() {
    var form = document.getElementById('client-form');
    if (form) form.reset();
    document.getElementById('client-id').value = '';
    clearErrors();
  }

  function clearErrors() {
    var errorElements = document.querySelectorAll('#client-form .error-message');
    errorElements.forEach(function(el) { el.textContent = ''; });
  }

  function displayErrors(errors) {
    errors.forEach(function(error) {
      var errorEl = document.getElementById(error.field + '-error');
      if (errorEl) {
        errorEl.textContent = error.message;
      }
    });
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getTodayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
  }

  /**
   * Export all client records as a CSV file download.
   */
  async function exportClients() {
    try {
      var clients = await DB.getAllClients();
      if (!clients || clients.length === 0) {
        alert('No clients to export.');
        return;
      }

      // CSV header
      var csv = 'Client Name,Mobile Number,Total Borrowed Amount,Collection Start Date,Duration (days),EMI,End Date,Notes\n';

      // CSV rows
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        csv += '"' + (c.name || '').replace(/"/g, '""') + '",';
        csv += '"' + (c.mobile || '') + '",';
        csv += (c.totalAmount || 0) + ',';
        csv += '"' + (c.startDate || '') + '",';
        csv += (c.duration || 100) + ',';
        csv += (c.emi || 0) + ',';
        csv += '"' + (c.endDate || '') + '",';
        csv += '"' + (c.notes || '').replace(/"/g, '""') + '"\n';
      }

      // Create and trigger download
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'clients_' + getTodayISO() + '.csv');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + (e.message || 'Unknown error'));
      console.error('Export error:', e);
    }
  }

  /**
   * Handle the file input change for importing clients from CSV.
   * @param {Event} event - The change event from the file input
   */
  function handleImportFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var content = e.target.result;
      importClients(content);
    };
    reader.onerror = function() {
      alert('Could not read the file. Please try again.');
    };
    reader.readAsText(file);

    // Reset file input so same file can be re-selected
    event.target.value = '';
  }

  /**
   * Parse CSV content and import client records.
   * Skips duplicates (by name, case-insensitive).
   * @param {string} csvContent - Raw CSV text
   */
  async function importClients(csvContent) {
    try {
      var lines = csvContent.split(/\r?\n/).filter(function(line) {
        return line.trim() !== '';
      });

      if (lines.length < 2) {
        alert('CSV file is empty or has no data rows.');
        return;
      }

      // Skip header row
      var dataLines = lines.slice(1);
      var existingClients = await DB.getAllClients();
      var existingNames = existingClients.map(function(c) {
        return c.name.trim().toLowerCase();
      });

      var imported = 0;
      var skipped = 0;
      var errors = 0;

      for (var i = 0; i < dataLines.length; i++) {
        var fields = parseCSVLine(dataLines[i]);
        if (fields.length < 4) {
          errors++;
          continue;
        }

        var name = fields[0].trim();
        var mobile = fields[1].trim();
        var amount = parseFloat(fields[2]);
        var startDate = fields[3].trim();
        var duration = fields[4] ? parseInt(fields[4], 10) : 100;
        var emi = fields[5] ? parseFloat(fields[5]) : 0;
        var notes = fields[7] ? fields[7].trim() : '';

        // Validate essentials
        if (!name || !mobile || isNaN(amount) || amount <= 0 || !startDate) {
          errors++;
          continue;
        }

        // Skip duplicates
        if (existingNames.indexOf(name.toLowerCase()) !== -1) {
          skipped++;
          continue;
        }

        // Calculate EMI and endDate if not provided
        if (!emi || emi <= 0) {
          emi = calculateEMI(amount, duration);
        }
        var endDate = calculateEndDate(startDate, duration);

        var client = {
          id: generateUUID(),
          name: name,
          mobile: mobile,
          totalAmount: amount,
          startDate: startDate,
          duration: duration,
          emi: emi,
          endDate: endDate,
          notes: notes,
          createdAt: new Date().toISOString()
        };

        await DB.addClient(client);
        existingNames.push(name.toLowerCase());
        imported++;
      }

      var msg = 'Import complete: ' + imported + ' added';
      if (skipped > 0) msg += ', ' + skipped + ' duplicates skipped';
      if (errors > 0) msg += ', ' + errors + ' rows with errors';
      alert(msg);

      renderClientList();
    } catch (e) {
      alert('Import failed: ' + (e.message || 'Unknown error'));
      console.error('Import error:', e);
    }
  }

  /**
   * Parse a single CSV line handling quoted fields.
   * @param {string} line - A single CSV row
   * @returns {Array<string>} Array of field values
   */
  function parseCSVLine(line) {
    var fields = [];
    var current = '';
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  }

  return {
    init: init,
    renderClientList: renderClientList,
    showAddForm: showAddForm,
    showEditForm: showEditForm,
    toggleLoanTypeFields: toggleLoanTypeFields,
    validateForm: validateForm,
    saveClient: saveClient,
    deleteClient: deleteClient,
    calculateEMI: calculateEMI,
    calculateEndDate: calculateEndDate,
    exportClients: exportClients,
    importClients: importClients
  };
})();
