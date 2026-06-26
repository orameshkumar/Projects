const Collection = (function() {
  'use strict';

  var paidLoansToday = {};

  function getTodayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
  }

  function init() {
    var dateInput = document.getElementById('collection-date');
    var searchInput = document.getElementById('collection-search');
    var paidFilter = document.getElementById('collection-filter-paid');

    if (dateInput) {
      if (!dateInput.value) dateInput.value = getTodayISO();
      dateInput.addEventListener('change', function() {
        paidLoansToday = {};
        renderCollectionList(dateInput.value);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var date = dateInput ? dateInput.value : getTodayISO();
        renderCollectionList(date);
      });
    }

    if (paidFilter) {
      paidFilter.addEventListener('change', function() {
        var date = dateInput ? dateInput.value : getTodayISO();
        renderCollectionList(date);
      });
    }

    var confirmBtn = document.getElementById('confirm-payment-btn');
    var cancelBtn = document.getElementById('cancel-payment-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirmPayment);
    if (cancelBtn) cancelBtn.addEventListener('click', hidePaymentModal);

    renderCollectionList(getTodayISO());
  }

  async function renderCollectionList(date) {
    var listContainer = document.getElementById('collection-list');
    if (!listContainer) return;

    var searchInput = document.getElementById('collection-search');
    var paidFilter = document.getElementById('collection-filter-paid');
    var searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var showNotPaidOnly = paidFilter ? paidFilter.checked : false;

    try {
      var loans = await DB.getAllLoans();

      // Filter to active daily_emi loans within date range
      loans = loans.filter(function(l) {
        if (l.loanType !== 'daily_emi') return false;
        if (l.status !== 'active') return false;
        if (l.startDate && l.startDate > date) return false;
        if (l.endDate && l.endDate < date) return false;
        return true;
      });

      if (loans.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No pending collections for this date.</p>';
        return;
      }

      var displayItems = [];

      for (var i = 0; i < loans.length; i++) {
        var loan = loans[i];
        var client = await DB.getClient(loan.clientId);
        if (!client) continue;

        var payments = await DB.getPaymentsByLoan(loan.id);
        var totalPaid = 0;
        var hasPaidOnDate = false;

        for (var k = 0; k < payments.length; k++) {
          if (payments[k].paymentType === 'emi') {
            totalPaid += payments[k].amount;
            if (payments[k].date === date) hasPaidOnDate = true;
          }
        }

        var pending = loan.totalAmount - totalPaid;
        pending = pending > 0 ? Math.round(pending * 100) / 100 : 0;

        if (pending <= 0) continue;

        displayItems.push({
          loan: loan,
          client: client,
          pending: pending,
          paidToday: hasPaidOnDate || !!paidLoansToday[loan.id]
        });
      }

      // Apply search filter
      if (searchTerm) {
        displayItems = displayItems.filter(function(item) {
          return item.client.name.toLowerCase().indexOf(searchTerm) !== -1;
        });
      }

      // Apply "not paid today" filter
      if (showNotPaidOnly) {
        displayItems = displayItems.filter(function(item) {
          return !item.paidToday;
        });
      }

      if (displayItems.length === 0) {
        var msg = searchTerm || showNotPaidOnly ? 'No loans match your filter.' : 'No pending collections for this date.';
        listContainer.innerHTML = '<p class="empty-message">' + msg + '</p>';
        return;
      }

      // Sort by client name
      displayItems.sort(function(a, b) {
        return a.client.name.localeCompare(b.client.name);
      });

      var html = '';
      for (var j = 0; j < displayItems.length; j++) {
        var item = displayItems[j];
        var defaultAmount = Math.min(item.loan.emi || 0, item.pending);
        var itemClass = 'collection-item' + (item.paidToday ? ' collection-item-paid' : '');

        html += '<div class="' + itemClass + '">';
        html += '<div class="collection-info">';
        html += '<div class="collection-client-name">' + esc(item.client.name) + '</div>';
        html += '<div class="collection-loan-amount">Loan: ₹' + item.loan.totalAmount.toFixed(2) + '</div>';
        html += '<div class="collection-pending">Pending: ₹' + item.pending.toFixed(2) + '</div>';
        if (item.paidToday) html += '<div class="collection-paid-badge">✓ Paid today</div>';
        html += '</div>';
        html += '<input type="number" class="collection-emi-input" id="emi-input-' + item.loan.id + '" value="' + defaultAmount.toFixed(2) + '" min="1" max="' + item.pending.toFixed(2) + '" step="0.01" aria-label="Payment amount for ' + esc(item.client.name) + '">';
        html += '<button class="btn-collect" data-loan-id="' + item.loan.id + '" aria-label="Collect payment from ' + esc(item.client.name) + '">Collect</button>';
        if (!item.paidToday) {
          html += '<button class="btn-reminder" data-loan-id="' + item.loan.id + '" data-client-id="' + item.client.id + '">📱 Remind</button>';
        }
        html += '</div>';
      }

      listContainer.innerHTML = html;

      // Attach handlers
      var collectBtns = listContainer.querySelectorAll('.btn-collect');
      collectBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var loanId = btn.getAttribute('data-loan-id');
          var emiInput = document.getElementById('emi-input-' + loanId);
          var amount = parseFloat(emiInput ? emiInput.value : 0);
          showPaymentPage(loanId, amount);
        });
      });

      // WhatsApp Reminder handlers
      var reminderBtns = listContainer.querySelectorAll('.btn-reminder');
      reminderBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var loanId = btn.getAttribute('data-loan-id');
          var clientId = btn.getAttribute('data-client-id');
          var matched = displayItems.find(function(d) { return d.loan.id === loanId; });
          if (matched && typeof WhatsApp !== 'undefined') {
            WhatsApp.sendReminder({ client: matched.client, loan: matched.loan, pending: matched.pending });
          }
        });
      });
    } catch (e) {
      listContainer.innerHTML = '<p class="empty-message">Could not load data.</p>';
      console.error('Collection render error:', e);
    }
  }

  async function showPaymentPage(loanId, amount) {
    var upiId = Settings.getUpiId();
    if (!upiId) { alert('Please configure UPI ID in Settings first.'); return; }

    try {
      var loan = await DB.getLoan(loanId);
      if (!loan) { alert('Loan not found.'); return; }
      var client = await DB.getClient(loan.clientId);
      var clientName = client ? client.name : 'Unknown';

      var modal = document.getElementById('payment-modal');
      var clientNameEl = document.getElementById('payment-client-name');
      var amountInput = document.getElementById('payment-amount');
      var amountError = document.getElementById('payment-amount-error');
      var qrContainer = document.getElementById('qr-code-container');

      if (clientNameEl) clientNameEl.textContent = clientName;
      if (amountInput) amountInput.value = amount > 0 ? amount.toFixed(2) : '';
      if (amountError) amountError.textContent = '';

      if (modal) {
        modal.setAttribute('data-loan-id', loanId);
        modal.removeAttribute('hidden');
      }

      // Generate QR
      if (amount > 0 && qrContainer) {
        generateQR(qrContainer, upiId, amount, clientName);
      } else if (qrContainer) {
        qrContainer.innerHTML = '<p class="qr-placeholder">Enter amount to generate QR</p>';
      }

      // Regen QR on amount change
      if (amountInput) {
        amountInput.oninput = function() {
          var amt = parseFloat(amountInput.value);
          if (!isNaN(amt) && amt > 0 && qrContainer) {
            generateQR(qrContainer, upiId, amt, clientName);
          }
        };
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  function generateQR(container, upiId, amount, clientName) {
    var appName = Settings.getAppName();
    var upiLink = 'upi://pay?pa=' + upiId + '&pn=' + encodeURIComponent(appName) + '&am=' + amount.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent(clientName + ' EMI');
    try {
      var qr = qrcode(0, 'M');
      qr.addData(upiLink);
      qr.make();
      container.innerHTML = qr.createSvgTag(4, 0);
    } catch (e) {
      container.innerHTML = '<a href="' + esc(upiLink) + '" class="qr-fallback-link">Tap to pay via UPI</a>';
    }
  }

  async function handleConfirmPayment() {
    var modal = document.getElementById('payment-modal');
    var amountInput = document.getElementById('payment-amount');
    var amountError = document.getElementById('payment-amount-error');
    var dateInput = document.getElementById('collection-date');

    if (!modal || !amountInput) return;

    var loanId = modal.getAttribute('data-loan-id');
    var amount = parseFloat(amountInput.value);
    var date = dateInput ? dateInput.value : getTodayISO();

    if (isNaN(amount) || amount <= 0) {
      if (amountError) amountError.textContent = 'Amount must be greater than zero.';
      return;
    }
    if (amountError) amountError.textContent = '';

    await confirmPayment(loanId, date, amount);
  }

  async function confirmPayment(loanId, date, amount) {
    try {
      var payment = {
        id: DB.generateId(),
        loanId: loanId,
        date: date,
        amount: amount,
        paymentType: 'emi',
        createdAt: new Date().toISOString()
      };

      await DB.addPayment(payment);

      if (typeof WhatsApp !== 'undefined') {
        var _loan = await DB.getLoan(loanId);
        var _client = _loan ? await DB.getClient(_loan.clientId) : null;
        if (_client && _loan) {
          var _pending = await calculatePending(_loan);
          WhatsApp.offerConfirmation({ client: _client, loan: _loan, amount: amount, date: date, pending: Math.max(0, _pending - amount) });
        }
      }

      paidLoansToday[loanId] = true;
      hidePaymentModal();

      var dateInput = document.getElementById('collection-date');
      renderCollectionList(dateInput ? dateInput.value : getTodayISO());
    } catch (e) {
      alert('Payment could not be saved: ' + (e.message || 'Unknown error'));
      console.error('Confirm payment error:', e);
    }
  }

  async function calculatePending(loan) {
    try {
      var payments = await DB.getPaymentsByLoan(loan.id);
      var totalPaid = 0;
      for (var i = 0; i < payments.length; i++) {
        if (payments[i].paymentType === 'emi') totalPaid += payments[i].amount;
      }
      var pending = loan.totalAmount - totalPaid;
      return pending > 0 ? Math.round(pending * 100) / 100 : 0;
    } catch (e) {
      return loan.totalAmount;
    }
  }

  function hidePaymentModal() {
    var modal = document.getElementById('payment-modal');
    if (modal) { modal.setAttribute('hidden', ''); modal.removeAttribute('data-loan-id'); }
    var container = document.getElementById('qr-code-container');
    if (container) container.innerHTML = '';
  }

  return {
    init: init,
    renderCollectionList: renderCollectionList,
    showPaymentPage: showPaymentPage,
    confirmPayment: confirmPayment,
    calculatePending: calculatePending
  };
})();
