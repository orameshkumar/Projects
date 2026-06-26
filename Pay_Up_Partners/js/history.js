const PaymentHistory = (function() {
  'use strict';

  function getTodayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function getDateDaysAgo(days) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  function esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    var parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function init() {
    var startInput = document.getElementById('history-start-date');
    var endInput = document.getElementById('history-end-date');
    var searchInput = document.getElementById('history-search');

    if (startInput && !startInput.value) startInput.value = getDateDaysAgo(30);
    if (endInput && !endInput.value) endInput.value = getTodayISO();

    if (startInput) startInput.addEventListener('change', function() { renderHistory(); });
    if (endInput) endInput.addEventListener('change', function() { renderHistory(); });
    if (searchInput) searchInput.addEventListener('input', function() { renderHistory(); });

    renderHistory();
  }

  async function renderHistory() {
    var listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    var startInput = document.getElementById('history-start-date');
    var endInput = document.getElementById('history-end-date');
    var searchInput = document.getElementById('history-search');

    var startDate = startInput ? startInput.value : getDateDaysAgo(30);
    var endDate = endInput ? endInput.value : getTodayISO();
    var searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    try {
      var payments = await DB.getPaymentsByDateRange(startDate, endDate);

      if (!payments || payments.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No payments found in this date range.</p>';
        return;
      }

      // Resolve loan and client for each payment
      var displayItems = [];
      for (var i = 0; i < payments.length; i++) {
        var payment = payments[i];
        var loan = await DB.getLoan(payment.loanId);
        var client = loan ? await DB.getClient(loan.clientId) : null;
        var clientName = client ? client.name : 'Unknown';

        displayItems.push({
          payment: payment,
          loan: loan,
          clientName: clientName
        });
      }

      // Apply search filter
      if (searchTerm) {
        displayItems = displayItems.filter(function(item) {
          return item.clientName.toLowerCase().indexOf(searchTerm) !== -1;
        });
      }

      if (displayItems.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No payments match your search.</p>';
        return;
      }

      // Sort by date descending, then by createdAt descending
      displayItems.sort(function(a, b) {
        var cmp = b.payment.date.localeCompare(a.payment.date);
        if (cmp !== 0) return cmp;
        return (b.payment.createdAt || '').localeCompare(a.payment.createdAt || '');
      });

      var html = '<div class="history-table">';
      html += '<div class="history-header">';
      html += '<span class="history-col-date">Date</span>';
      html += '<span class="history-col-client">Client</span>';
      html += '<span class="history-col-type">Type</span>';
      html += '<span class="history-col-amount">Amount</span>';
      html += '<span class="history-col-action"></span>';
      html += '</div>';

      for (var j = 0; j < displayItems.length; j++) {
        var item = displayItems[j];
        var typeBadgeClass = 'badge-' + item.payment.paymentType;
        var typeLabel = item.payment.paymentType === 'emi' ? 'EMI' : item.payment.paymentType === 'interest' ? 'Interest' : 'Principal';

        var loanTypeBadge = '';
        if (item.loan) {
          var loanLabel = item.loan.loanType === 'interest_only' ? 'Int Only' : 'Daily';
          var loanBadgeClass = item.loan.loanType === 'interest_only' ? 'badge-interest-only' : 'badge-daily-emi';
          loanTypeBadge = '<span class="loan-type-badge ' + loanBadgeClass + '">' + loanLabel + '</span>';
        }

        html += '<div class="history-row">';
        html += '<span class="history-col-date">' + formatDate(item.payment.date) + '</span>';
        html += '<span class="history-col-client">' + esc(item.clientName) + ' ' + loanTypeBadge + '</span>';
        html += '<span class="history-col-type"><span class="payment-type-badge ' + typeBadgeClass + '">' + typeLabel + '</span></span>';
        html += '<span class="history-col-amount">₹' + item.payment.amount.toFixed(2) + '</span>';
        html += '<span class="history-col-action"><button class="btn-icon btn-delete-payment" data-payment-id="' + item.payment.id + '" data-payment-type="' + item.payment.paymentType + '" data-loan-id="' + item.payment.loanId + '" data-amount="' + item.payment.amount + '" title="Delete">🗑️</button></span>';
        html += '</div>';
      }

      html += '</div>';
      listContainer.innerHTML = html;

      // Attach delete handlers
      var deleteBtns = listContainer.querySelectorAll('.btn-delete-payment');
      deleteBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var paymentId = btn.getAttribute('data-payment-id');
          var paymentType = btn.getAttribute('data-payment-type');
          var loanId = btn.getAttribute('data-loan-id');
          var amount = parseFloat(btn.getAttribute('data-amount'));
          deletePayment(paymentId, paymentType, loanId, amount);
        });
      });
    } catch (e) {
      listContainer.innerHTML = '<p class="empty-message">Could not load payment history.</p>';
      console.error('History render error:', e);
    }
  }

  async function deletePayment(paymentId, paymentType, loanId, amount) {
    if (!confirm('Delete this payment record?')) return;

    try {
      await DB.deletePayment(paymentId);

      // If principal payment, restore the principalBalance on the loan
      if (paymentType === 'principal' && loanId) {
        var loan = await DB.getLoan(loanId);
        if (loan && loan.loanType === 'interest_only') {
          var restored = Math.round((loan.principalBalance + amount) * 100) / 100;
          loan.principalBalance = restored;
          await DB.updateLoan(loan);
        }
      }

      renderHistory();
    } catch (e) {
      alert('Could not delete payment: ' + e.message);
    }
  }

  return {
    init: init,
    renderHistory: renderHistory,
    deletePayment: deletePayment
  };
})();
