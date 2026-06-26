const InterestCollection = (function() {
  'use strict';

  var currentPaymentType = 'interest';
  var currentLoan = null;
  var currentClient = null;

  function getTodayISO() {
    return new Date().toISOString().split('T')[0];
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

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // ─── Period Calculation ───

  function getInterestPeriod(startDate, referenceDate) {
    var startParts = startDate.split('-');
    var anchorDay = parseInt(startParts[2], 10);

    var refParts = referenceDate.split('-');
    var refYear = parseInt(refParts[0], 10);
    var refMonth = parseInt(refParts[1], 10);
    var refDay = parseInt(refParts[2], 10);

    var psYear = refYear;
    var psMonth = refMonth;
    var psDay = Math.min(anchorDay, daysInMonth(psYear, psMonth));

    if (psDay > refDay) {
      psMonth -= 1;
      if (psMonth < 1) { psMonth = 12; psYear -= 1; }
      psDay = Math.min(anchorDay, daysInMonth(psYear, psMonth));
    }

    var periodStart = psYear + '-' + String(psMonth).padStart(2, '0') + '-' + String(psDay).padStart(2, '0');

    var peMonth = psMonth + 1;
    var peYear = psYear;
    if (peMonth > 12) { peMonth = 1; peYear += 1; }
    var nextAnchorDay = Math.min(anchorDay, daysInMonth(peYear, peMonth));

    var nextStart = new Date(peYear, peMonth - 1, nextAnchorDay);
    var endDate = new Date(nextStart.getTime() - 86400000);

    var periodEnd = endDate.getFullYear() + '-' + String(endDate.getMonth() + 1).padStart(2, '0') + '-' + String(endDate.getDate()).padStart(2, '0');

    return { periodStart: periodStart, periodEnd: periodEnd };
  }

  function getAllPeriodsUntil(startDate, referenceDate) {
    var periods = [];
    var startParts = startDate.split('-');
    var anchorDay = parseInt(startParts[2], 10);

    var curYear = parseInt(startParts[0], 10);
    var curMonth = parseInt(startParts[1], 10);
    var curDay = Math.min(anchorDay, daysInMonth(curYear, curMonth));

    var maxIterations = 1200;
    var iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      var periodStart = curYear + '-' + String(curMonth).padStart(2, '0') + '-' + String(curDay).padStart(2, '0');

      var nextMonth = curMonth + 1;
      var nextYear = curYear;
      if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
      var nextDay = Math.min(anchorDay, daysInMonth(nextYear, nextMonth));

      var nextStart = new Date(nextYear, nextMonth - 1, nextDay);
      var endDate = new Date(nextStart.getTime() - 86400000);

      var periodEnd = endDate.getFullYear() + '-' + String(endDate.getMonth() + 1).padStart(2, '0') + '-' + String(endDate.getDate()).padStart(2, '0');

      periods.push({ periodStart: periodStart, periodEnd: periodEnd });

      if (periodStart <= referenceDate && referenceDate <= periodEnd) break;
      if (periodStart > referenceDate) break;

      curYear = nextYear;
      curMonth = nextMonth;
      curDay = nextDay;
    }

    return periods;
  }

  // ─── Effective Principal and Carry-Forward ───

  function calculateEffectivePrincipal(loan, principalPayments, periodStart) {
    var reduced = 0;
    for (var i = 0; i < principalPayments.length; i++) {
      if (principalPayments[i].date < periodStart) {
        reduced += principalPayments[i].amount;
      }
    }
    var effective = loan.totalAmount - reduced;
    return effective > 0 ? effective : 0;
  }

  function getTotalInterestPaidInPeriod(payments, periodStart, periodEnd) {
    var total = 0;
    for (var i = 0; i < payments.length; i++) {
      var p = payments[i];
      if (p.paymentType === 'interest' && p.date >= periodStart && p.date <= periodEnd) {
        total += p.amount;
      }
    }
    return total;
  }

  function calculateCarriedForward(loan, payments, periods) {
    var carriedForward = 0;
    var advanceCredit = 0;

    var principalPayments = payments.filter(function(p) {
      return p.paymentType === 'principal';
    }).sort(function(a, b) { return a.date.localeCompare(b.date); });

    // Process all periods except the last (current)
    for (var i = 0; i < periods.length - 1; i++) {
      var period = periods[i];

      var effectivePrincipal = calculateEffectivePrincipal(loan, principalPayments, period.periodStart);
      var expectedInterest = effectivePrincipal * loan.interestRate / 100;
      var paid = getTotalInterestPaidInPeriod(payments, period.periodStart, period.periodEnd);

      var effectivePaid = paid + advanceCredit;
      advanceCredit = 0;

      if (effectivePaid < expectedInterest) {
        carriedForward += (expectedInterest - effectivePaid);
      } else if (effectivePaid > expectedInterest) {
        advanceCredit = effectivePaid - expectedInterest;
      }
    }

    // Remaining advance credit reduces carry-forward
    if (advanceCredit > 0 && carriedForward > 0) {
      if (advanceCredit >= carriedForward) {
        advanceCredit -= carriedForward;
        carriedForward = 0;
      } else {
        carriedForward -= advanceCredit;
        advanceCredit = 0;
      }
    }

    return {
      carriedForward: Math.round(carriedForward * 100) / 100,
      advanceCredit: Math.round(advanceCredit * 100) / 100
    };
  }

  // ─── Render ───

  async function renderInterestList() {
    var listContainer = document.getElementById('interest-list');
    if (!listContainer) return;

    var filterCheckbox = document.getElementById('interest-filter-unpaid');
    var showUnpaidOnly = filterCheckbox ? filterCheckbox.checked : false;

    var dateInput = document.getElementById('interest-date');
    var referenceDate = (dateInput && dateInput.value) ? dateInput.value : getTodayISO();

    try {
      var loans = await DB.getAllLoans();

      // Filter to active interest_only loans with principal > 0
      loans = loans.filter(function(l) {
        return l.loanType === 'interest_only' && l.status === 'active' && l.principalBalance > 0;
      });

      if (loans.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No interest collections pending.</p>';
        return;
      }

      var displayItems = [];

      for (var i = 0; i < loans.length; i++) {
        var loan = loans[i];

        if (!loan.startDate || loan.startDate.split('-').length !== 3) continue;
        if (!loan.interestRate) continue;

        var client = await DB.getClient(loan.clientId);
        if (!client) continue;

        var payments = await DB.getPaymentsByLoan(loan.id);
        var periods = getAllPeriodsUntil(loan.startDate, referenceDate);

        if (periods.length === 0) continue;

        var currentPeriod = periods[periods.length - 1];

        // Effective principal for current period
        var principalPayments = payments.filter(function(p) { return p.paymentType === 'principal'; });
        var effectivePrincipal = calculateEffectivePrincipal(loan, principalPayments, currentPeriod.periodStart);

        var expectedInterest = Math.round(effectivePrincipal * loan.interestRate / 100 * 100) / 100;

        // Carry-forward from past periods
        var cfResult = calculateCarriedForward(loan, payments, periods);
        var carryForward = cfResult.carriedForward;
        var advanceCredit = cfResult.advanceCredit;

        // Paid in current period
        var paidInCurrentPeriod = getTotalInterestPaidInPeriod(payments, currentPeriod.periodStart, currentPeriod.periodEnd);
        var effectivePaidCurrentPeriod = paidInCurrentPeriod + advanceCredit;

        // Total due
        var totalDue = Math.round((expectedInterest + carryForward - effectivePaidCurrentPeriod) * 100) / 100;

        if (totalDue <= 0) continue;

        // Apply unpaid filter
        if (showUnpaidOnly && paidInCurrentPeriod > 0) continue;

        displayItems.push({
          loan: loan,
          client: client,
          currentPeriod: currentPeriod,
          totalDue: totalDue,
          carryForward: carryForward,
          advanceCredit: advanceCredit,
          paidInCurrentPeriod: paidInCurrentPeriod,
          effectivePrincipal: effectivePrincipal
        });
      }

      if (displayItems.length === 0) {
        var msg = showUnpaidOnly ? 'No loans match your filter.' : 'No interest collections pending.';
        listContainer.innerHTML = '<p class="empty-message">' + msg + '</p>';
        return;
      }

      displayItems.sort(function(a, b) { return a.client.name.localeCompare(b.client.name); });

      var html = '';
      for (var j = 0; j < displayItems.length; j++) {
        var item = displayItems[j];
        var notes = '';
        if (item.carryForward > 0) notes += ' (₹' + item.carryForward.toFixed(2) + ' carried forward)';
        if (item.advanceCredit > 0) notes += ' (₹' + item.advanceCredit.toFixed(2) + ' advance applied)';
        if (item.paidInCurrentPeriod > 0) notes += ' (₹' + item.paidInCurrentPeriod.toFixed(2) + ' already paid)';

        html += '<div class="collection-item">';
        html += '<div class="collection-info">';
        html += '<div class="collection-client-name">' + esc(item.client.name) + '</div>';
        html += '<div class="collection-pending">Period: ' + formatDate(item.currentPeriod.periodStart) + ' - ' + formatDate(item.currentPeriod.periodEnd) + '</div>';
        html += '<div class="collection-principal">Principal: ₹' + item.loan.principalBalance.toFixed(2) + ' @ ' + item.loan.interestRate + '%</div>';
        html += '<div class="collection-interest-due">Balance Due: ₹' + item.totalDue.toFixed(2) + notes + '</div>';
        html += '</div>';
        html += '<div class="collection-buttons">';
        html += '<button class="btn-collect-interest" data-loan-id="' + item.loan.id + '">Collect Interest</button>';
        html += '<button class="btn-collect-principal" data-loan-id="' + item.loan.id + '">Pay Principal</button>';
        html += '<button class="btn-reminder" data-loan-id="' + item.loan.id + '" data-client-id="' + item.client.id + '">📱 Remind</button>';
        html += '</div>';
        html += '</div>';
      }

      listContainer.innerHTML = html;

      // Attach handlers
      var interestBtns = listContainer.querySelectorAll('.btn-collect-interest');
      interestBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var loanId = btn.getAttribute('data-loan-id');
          var matched = displayItems.find(function(d) { return d.loan.id === loanId; });
          if (matched) showInterestPaymentModal(matched.loan, matched.client, matched.totalDue);
        });
      });

      var principalBtns = listContainer.querySelectorAll('.btn-collect-principal');
      principalBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var loanId = btn.getAttribute('data-loan-id');
          var matched = displayItems.find(function(d) { return d.loan.id === loanId; });
          if (matched) showPrincipalPaymentModal(matched.loan, matched.client);
        });
      });

      // WhatsApp Reminder handlers
      var reminderBtns = listContainer.querySelectorAll('.btn-reminder');
      reminderBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var loanId = btn.getAttribute('data-loan-id');
          var matched = displayItems.find(function(d) { return d.loan.id === loanId; });
          if (matched && typeof WhatsApp !== 'undefined') {
            WhatsApp.sendReminder({ client: matched.client, loan: matched.loan, pending: matched.totalDue });
          }
        });
      });
    } catch (e) {
      listContainer.innerHTML = '<p class="empty-message">Could not load data.</p>';
      console.error('Interest render error:', e);
    }
  }

  // ─── Payment Modals ───

  function showInterestPaymentModal(loan, client, totalDue) {
    currentPaymentType = 'interest';
    currentLoan = loan;
    currentClient = client;

    var modal = document.getElementById('interest-payment-modal');
    var titleEl = document.getElementById('interest-modal-title');
    var clientNameEl = document.getElementById('interest-payment-client-name');
    var amountInput = document.getElementById('interest-payment-amount');
    var amountError = document.getElementById('interest-payment-amount-error');
    var qrContainer = document.getElementById('interest-qr-code-container');

    if (titleEl) titleEl.textContent = 'Collect Interest';
    if (clientNameEl) clientNameEl.textContent = client.name;
    if (amountInput) amountInput.value = totalDue.toFixed(2);
    if (amountError) amountError.textContent = '';

    var upiId = Settings.getUpiId();
    if (upiId && totalDue > 0) {
      generateInterestQR(qrContainer, upiId, totalDue, client.name, 'Interest');
    } else if (qrContainer) {
      qrContainer.innerHTML = '<p class="qr-placeholder">Configure UPI ID in Settings</p>';
    }

    if (modal) modal.removeAttribute('hidden');

    // Regen QR on amount change
    if (amountInput) {
      amountInput.oninput = function() {
        var amt = parseFloat(amountInput.value);
        if (!isNaN(amt) && amt > 0 && upiId && qrContainer) {
          generateInterestQR(qrContainer, upiId, amt, client.name, 'Interest');
        }
      };
    }
  }

  function showPrincipalPaymentModal(loan, client) {
    currentPaymentType = 'principal';
    currentLoan = loan;
    currentClient = client;

    var modal = document.getElementById('interest-payment-modal');
    var titleEl = document.getElementById('interest-modal-title');
    var clientNameEl = document.getElementById('interest-payment-client-name');
    var amountInput = document.getElementById('interest-payment-amount');
    var amountError = document.getElementById('interest-payment-amount-error');
    var qrContainer = document.getElementById('interest-qr-code-container');

    if (titleEl) titleEl.textContent = 'Pay Principal';
    if (clientNameEl) clientNameEl.textContent = client.name;
    if (amountInput) amountInput.value = '';
    if (amountError) amountError.textContent = '';
    if (qrContainer) qrContainer.innerHTML = '<p class="qr-placeholder">Enter amount to generate QR</p>';

    if (modal) modal.removeAttribute('hidden');

    // Regen QR on amount change
    var upiId = Settings.getUpiId();
    if (amountInput) {
      amountInput.oninput = function() {
        var amt = parseFloat(amountInput.value);
        if (!isNaN(amt) && amt > 0 && upiId && qrContainer) {
          generateInterestQR(qrContainer, upiId, amt, client.name, 'Principal');
        }
      };
    }
  }

  function generateInterestQR(container, upiId, amount, clientName, label) {
    if (!container) return;
    var appName = Settings.getAppName();
    var upiLink = 'upi://pay?pa=' + upiId + '&pn=' + encodeURIComponent(appName) + '&am=' + amount.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent(clientName + ' ' + label);
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
    var amountInput = document.getElementById('interest-payment-amount');
    var amountError = document.getElementById('interest-payment-amount-error');

    if (!amountInput || !currentLoan) return;

    var amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      if (amountError) amountError.textContent = 'Amount must be greater than zero.';
      return;
    }

    if (currentPaymentType === 'principal') {
      if (amount > currentLoan.principalBalance) {
        if (amountError) amountError.textContent = 'Amount cannot exceed outstanding principal of ₹' + currentLoan.principalBalance.toFixed(2);
        return;
      }
    }

    if (amountError) amountError.textContent = '';

    try {
      var dateInput = document.getElementById('interest-date');
      var date = (dateInput && dateInput.value) ? dateInput.value : getTodayISO();

      var payment = {
        id: DB.generateId(),
        loanId: currentLoan.id,
        date: date,
        amount: amount,
        paymentType: currentPaymentType,
        createdAt: new Date().toISOString()
      };

      await DB.addPayment(payment);

      // If principal payment, update loan's principalBalance
      if (currentPaymentType === 'principal') {
        var newBalance = Math.round((currentLoan.principalBalance - amount) * 100) / 100;
        currentLoan.principalBalance = newBalance;
        await DB.updateLoan(currentLoan);
      }

      if (typeof WhatsApp !== 'undefined' && currentClient && currentLoan) {
        var _pendingAfter = (currentPaymentType === 'principal') ? currentLoan.principalBalance : 0;
        WhatsApp.offerConfirmation({ client: currentClient, loan: currentLoan, amount: amount, date: date, pending: _pendingAfter });
      }

      hideInterestModal();
      await renderInterestList();
    } catch (e) {
      alert('Payment could not be saved: ' + (e.message || 'Unknown error'));
      console.error('Interest payment error:', e);
    }
  }

  function hideInterestModal() {
    var modal = document.getElementById('interest-payment-modal');
    var qrContainer = document.getElementById('interest-qr-code-container');
    var amountError = document.getElementById('interest-payment-amount-error');
    if (modal) modal.setAttribute('hidden', '');
    if (qrContainer) qrContainer.innerHTML = '';
    if (amountError) amountError.textContent = '';
    currentLoan = null;
    currentClient = null;
  }

  // ─── Init ───

  function init() {
    var dateInput = document.getElementById('interest-date');
    if (dateInput) {
      if (!dateInput.value) dateInput.value = getTodayISO();
      dateInput.addEventListener('change', function() { renderInterestList(); });
    }

    var filterCheckbox = document.getElementById('interest-filter-unpaid');
    if (filterCheckbox) {
      filterCheckbox.addEventListener('change', function() { renderInterestList(); });
    }

    var confirmBtn = document.getElementById('interest-confirm-payment-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirmPayment);

    var cancelBtn = document.getElementById('interest-cancel-payment-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', hideInterestModal);

    renderInterestList();
  }

  return {
    init: init,
    renderInterestList: renderInterestList,
    getInterestPeriod: getInterestPeriod,
    getAllPeriodsUntil: getAllPeriodsUntil,
    calculateCarriedForward: calculateCarriedForward,
    calculateEffectivePrincipal: calculateEffectivePrincipal
  };
})();
