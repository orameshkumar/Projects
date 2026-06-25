/**
 * interest.js - Interest Collection Module for Debt Collection App
 *
 * Provides the InterestCollection IIFE module for managing interest-only
 * loan clients. Handles monthly interest period calculation, carry-forward
 * logic, and payment tracking.
 */

var InterestCollection = (function() {
  'use strict';

  var currentPaymentType = 'interest';
  var currentClient = null;

  // ─── Helper Functions ──────────────────────────────────────────────────────

  /**
   * Generate a UUID v4 string.
   * @returns {string} UUID string
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get today's date as an ISO string (YYYY-MM-DD).
   * @returns {string} Today's date in YYYY-MM-DD format
   */
  function getTodayISO() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format an ISO date string to DD/MM/YYYY.
   * @param {string} isoDate - Date string in YYYY-MM-DD format
   * @returns {string} Formatted date in DD/MM/YYYY format
   */
  function formatDate(isoDate) {
    if (!isoDate) return '';
    var parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  // ─── Period Calculation Logic ──────────────────────────────────────────────

  /**
   * Get the number of days in a given month/year.
   * @param {number} year - Full year (e.g., 2025)
   * @param {number} month - Month (1-12)
   * @returns {number} Number of days in that month
   */
  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  /**
   * Compute the current interest period boundaries for a client.
   *
   * Anchors periods to the day-of-month from the client's startDate.
   * If the startDate day exceeds the number of days in a month, uses
   * the last day of that month.
   *
   * @param {string} startDate - Client's start date (YYYY-MM-DD)
   * @param {string} referenceDate - The date to find the period for (YYYY-MM-DD)
   * @returns {{ periodStart: string, periodEnd: string }} Period boundaries
   */
  function getInterestPeriod(startDate, referenceDate) {
    var startParts = startDate.split('-');
    var anchorDay = parseInt(startParts[2], 10);

    var refParts = referenceDate.split('-');
    var refYear = parseInt(refParts[0], 10);
    var refMonth = parseInt(refParts[1], 10); // 1-based
    var refDay = parseInt(refParts[2], 10);

    // Determine period start: find the most recent occurrence of anchorDay
    // on or before referenceDate
    var psYear = refYear;
    var psMonth = refMonth;
    var psDay = Math.min(anchorDay, daysInMonth(psYear, psMonth));

    // If the anchor day in the current month is after the reference date,
    // step back one month
    if (psDay > refDay) {
      psMonth -= 1;
      if (psMonth < 1) {
        psMonth = 12;
        psYear -= 1;
      }
      psDay = Math.min(anchorDay, daysInMonth(psYear, psMonth));
    }

    // Period start
    var periodStart = psYear + '-' +
      String(psMonth).padStart(2, '0') + '-' +
      String(psDay).padStart(2, '0');

    // Period end: one day before the next occurrence of anchorDay
    var peMonth = psMonth + 1;
    var peYear = psYear;
    if (peMonth > 12) {
      peMonth = 1;
      peYear += 1;
    }
    var nextAnchorDay = Math.min(anchorDay, daysInMonth(peYear, peMonth));

    // Subtract one day from the next period's start to get current period's end
    var nextStart = new Date(peYear, peMonth - 1, nextAnchorDay);
    var endDate = new Date(nextStart.getTime() - 86400000); // minus 1 day

    var periodEnd = endDate.getFullYear() + '-' +
      String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(endDate.getDate()).padStart(2, '0');

    return {
      periodStart: periodStart,
      periodEnd: periodEnd
    };
  }

  /**
   * Generate ALL period boundaries from startDate until (and including)
   * the period that contains referenceDate.
   *
   * @param {string} startDate - Client's start date (YYYY-MM-DD)
   * @param {string} referenceDate - The date to generate periods until (YYYY-MM-DD)
   * @returns {Array<{ periodStart: string, periodEnd: string }>} Array of period objects
   */
  function getAllPeriodsUntil(startDate, referenceDate) {
    var periods = [];
    var startParts = startDate.split('-');
    var anchorDay = parseInt(startParts[2], 10);

    // First period always starts on the startDate itself (clamped)
    var curYear = parseInt(startParts[0], 10);
    var curMonth = parseInt(startParts[1], 10); // 1-based
    var curDay = Math.min(anchorDay, daysInMonth(curYear, curMonth));

    var maxIterations = 1200; // safety: max 100 years of periods
    var iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      var periodStart = curYear + '-' +
        String(curMonth).padStart(2, '0') + '-' +
        String(curDay).padStart(2, '0');

      // Next period start
      var nextMonth = curMonth + 1;
      var nextYear = curYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      var nextDay = Math.min(anchorDay, daysInMonth(nextYear, nextMonth));

      // Period end = one day before next period start
      var nextStart = new Date(nextYear, nextMonth - 1, nextDay);
      var endDate = new Date(nextStart.getTime() - 86400000);

      var periodEnd = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0');

      periods.push({
        periodStart: periodStart,
        periodEnd: periodEnd
      });

      // Check if this period contains the referenceDate
      if (periodStart <= referenceDate && referenceDate <= periodEnd) {
        break;
      }

      // If we've passed the reference date, break (safety)
      if (periodStart > referenceDate) {
        break;
      }

      // Move to next period
      curYear = nextYear;
      curMonth = nextMonth;
      curDay = nextDay;
    }

    return periods;
  }

  // ─── Carry-Forward and Payment Tracking ────────────────────────────────────

  /**
   * Calculate carried-forward unpaid interest from all past periods.
   *
   * For each period EXCEPT the last one (current):
   *   Expected interest = principalBalance × interestRate / 100
   *   Paid = sum of interest payments within that period's date range
   *   If paid < expected: add (expected - paid) to carriedForward
   *
   * @param {Object} client - Client record with principalBalance, interestRate
   * @param {Array} payments - All payments for this client
   * @param {Array} periods - Array of period objects from getAllPeriodsUntil()
   * @returns {{ carriedForward: number, advanceCredit: number }} Carry-forward amount and remaining advance credit
   */
  function calculateCarriedForward(client, payments, periods) {
    var carriedForward = 0;
    var advanceCredit = 0;

    // Get all principal payments sorted by date ascending
    var principalPayments = payments.filter(function(p) {
      return p.paymentType === 'principal';
    }).sort(function(a, b) {
      return a.date.localeCompare(b.date);
    });

    // Process all periods EXCEPT the last one (current period)
    for (var i = 0; i < periods.length - 1; i++) {
      var period = periods[i];

      // Calculate effective principal for this period:
      // Original amount minus principal payments made BEFORE this period's start
      var principalReducedBeforePeriod = 0;
      for (var k = 0; k < principalPayments.length; k++) {
        if (principalPayments[k].date < period.periodStart) {
          principalReducedBeforePeriod += principalPayments[k].amount;
        }
      }
      var effectivePrincipal = client.totalAmount - principalReducedBeforePeriod;
      if (effectivePrincipal < 0) effectivePrincipal = 0;

      var expectedInterest = effectivePrincipal * client.interestRate / 100;

      var paid = getTotalInterestPaidInPeriod(payments, period.periodStart, period.periodEnd);

      // Net for this period: paid + advance credit from previous periods - expected
      var effectivePaid = paid + advanceCredit;
      advanceCredit = 0; // Reset advance credit after applying

      if (effectivePaid < expectedInterest) {
        // Underpaid: add deficit to carry-forward
        carriedForward += (expectedInterest - effectivePaid);
      } else if (effectivePaid > expectedInterest) {
        // Overpaid: excess becomes advance credit for next period
        advanceCredit = effectivePaid - expectedInterest;
      }
    }

    // Remaining advance credit reduces the carry-forward
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

  /**
   * Check if a period's interest is fully paid.
   *
   * @param {Array} payments - All payments for this client
   * @param {string} periodStart - Period start date (YYYY-MM-DD)
   * @param {string} periodEnd - Period end date (YYYY-MM-DD)
   * @param {number} amountDue - The interest amount due for the period
   * @returns {boolean} True if sum of interest payments >= amountDue
   */
  function isInterestPaidForPeriod(payments, periodStart, periodEnd, amountDue) {
    var totalPaid = getTotalInterestPaidInPeriod(payments, periodStart, periodEnd);
    return totalPaid >= amountDue;
  }

  /**
   * Sum all interest payments within a date range.
   *
   * @param {Array} payments - All payments for this client
   * @param {string} periodStart - Period start date (YYYY-MM-DD), inclusive
   * @param {string} periodEnd - Period end date (YYYY-MM-DD), inclusive
   * @returns {number} Sum of interest payment amounts in the range
   */
  function getTotalInterestPaidInPeriod(payments, periodStart, periodEnd) {
    var total = 0;
    for (var i = 0; i < payments.length; i++) {
      var p = payments[i];
      if (p.paymentType === 'interest' &&
          p.date >= periodStart &&
          p.date <= periodEnd) {
        total += p.amount;
      }
    }
    return total;
  }

  // ─── Render Interest List (Task 1.2) ────────────────────────────────────────

  /**
   * Render the interest collection list.
   * Fetches interest-only clients, computes periods and carry-forward,
   * and renders the list HTML.
   */
  async function renderInterestList() {
    var listContainer = document.getElementById('interest-list');
    if (!listContainer) return;

    var filterCheckbox = document.getElementById('interest-filter-unpaid');
    var showUnpaidOnly = filterCheckbox ? filterCheckbox.checked : false;

    // Use date from picker, default to today
    var dateInput = document.getElementById('interest-date');
    var referenceDate = (dateInput && dateInput.value) ? dateInput.value : getTodayISO();

    try {
      var clients = await DB.getAllClients();

      if (!clients || clients.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No interest collections pending.</p>';
        return;
      }

      // Filter to interest-only clients
      var interestClients = clients.filter(function(c) {
        return c.loanType === 'interest_only';
      });

      if (interestClients.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">No interest collections pending.</p>';
        return;
      }

      var displayItems = [];

      for (var i = 0; i < interestClients.length; i++) {
        var client = interestClients[i];

        // Skip clients with missing/invalid data
        if (!client.startDate || client.startDate.split('-').length !== 3) continue;
        if (client.principalBalance === null || client.principalBalance === undefined) continue;
        if (client.interestRate === null || client.interestRate === undefined) continue;
        if (client.principalBalance === 0) continue;

        var payments = await DB.getPaymentsByClient(client.id);
        var periods = getAllPeriodsUntil(client.startDate, referenceDate);

        if (periods.length === 0) continue;

        var currentPeriod = periods[periods.length - 1];

        // Calculate effective principal for current period:
        // Original amount minus principal payments made BEFORE current period start
        var principalPayments = payments.filter(function(p) {
          return p.paymentType === 'principal';
        });
        var principalReducedBeforeCurrentPeriod = 0;
        for (var pp = 0; pp < principalPayments.length; pp++) {
          if (principalPayments[pp].date < currentPeriod.periodStart) {
            principalReducedBeforeCurrentPeriod += principalPayments[pp].amount;
          }
        }
        var effectivePrincipalForCurrentPeriod = client.totalAmount - principalReducedBeforeCurrentPeriod;
        if (effectivePrincipalForCurrentPeriod < 0) effectivePrincipalForCurrentPeriod = 0;

        // Calculate expected interest for current period using effective principal
        var expectedInterest = Math.round(effectivePrincipalForCurrentPeriod * client.interestRate / 100 * 100) / 100;

        // Calculate carry-forward and advance credit from past periods
        var cfResult = calculateCarriedForward(client, payments, periods);
        var carryForward = cfResult.carriedForward;
        var advanceCredit = cfResult.advanceCredit;

        // Calculate how much has already been paid in the current period
        var paidInCurrentPeriod = getTotalInterestPaidInPeriod(payments, currentPeriod.periodStart, currentPeriod.periodEnd);

        // Total effective paid for current period includes advance credit from past overpayments
        var effectivePaidCurrentPeriod = paidInCurrentPeriod + advanceCredit;

        // Total due = current period interest + carry-forward - effective paid
        var totalDue = Math.round((expectedInterest + carryForward - effectivePaidCurrentPeriod) * 100) / 100;

        // If total due is zero or negative, this client is fully paid (or has advance credit)
        if (totalDue <= 0) continue;

        // Check if current period is fully paid (no remaining balance)
        var isFullyPaid = effectivePaidCurrentPeriod >= (expectedInterest + carryForward);

        // If fully paid: skip this client
        if (isFullyPaid) continue;

        // Apply "Show unpaid only" filter — show only those with zero payments in current period
        if (showUnpaidOnly && paidInCurrentPeriod > 0) continue;

        displayItems.push({
          client: client,
          currentPeriod: currentPeriod,
          totalDue: totalDue,
          carryForward: carryForward,
          advanceCredit: advanceCredit,
          paidInCurrentPeriod: paidInCurrentPeriod,
          isFullyPaid: isFullyPaid
        });
      }

      if (displayItems.length === 0) {
        var msg = showUnpaidOnly
          ? 'No clients match your filter.'
          : 'No interest collections pending.';
        listContainer.innerHTML = '<p class="empty-message">' + msg + '</p>';
        return;
      }

      // Sort alphabetically by client name
      displayItems.sort(function(a, b) {
        return a.client.name.localeCompare(b.client.name);
      });

      var html = '';
      for (var j = 0; j < displayItems.length; j++) {
        var item = displayItems[j];
        var notes = '';
        if (item.carryForward > 0) {
          notes += ' (₹' + item.carryForward.toFixed(2) + ' carried forward)';
        }
        if (item.advanceCredit > 0) {
          notes += ' (₹' + item.advanceCredit.toFixed(2) + ' advance applied)';
        }
        if (item.paidInCurrentPeriod > 0) {
          notes += ' (₹' + item.paidInCurrentPeriod.toFixed(2) + ' already paid)';
        }

        html += '<div class="collection-item">' +
          '<div class="collection-info">' +
            '<div class="collection-client-name">' + escapeHtml(item.client.name) + '</div>' +
            '<div class="collection-pending">Period: ' + formatDate(item.currentPeriod.periodStart) + ' - ' + formatDate(item.currentPeriod.periodEnd) + '</div>' +
            '<div class="collection-interest-due">Balance Due: ₹' + item.totalDue.toFixed(2) + notes + '</div>' +
          '</div>' +
          '<div class="collection-buttons">' +
            '<button class="btn-collect-interest" data-client-id="' + item.client.id + '">Collect Interest</button>' +
            '<button class="btn-collect-principal" data-client-id="' + item.client.id + '">Pay Principal</button>' +
          '</div>' +
        '</div>';
      }

      listContainer.innerHTML = html;

      // Attach click handlers to "Collect Interest" buttons
      var interestBtns = listContainer.querySelectorAll('.btn-collect-interest');
      interestBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var clientId = btn.getAttribute('data-client-id');
          var matchedItem = displayItems.find(function(d) { return d.client.id === clientId; });
          if (matchedItem) {
            showInterestPaymentModal(matchedItem.client, matchedItem.totalDue);
          }
        });
      });

      // Attach click handlers to "Pay Principal" buttons
      var principalBtns = listContainer.querySelectorAll('.btn-collect-principal');
      principalBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var clientId = btn.getAttribute('data-client-id');
          var matchedItem = displayItems.find(function(d) { return d.client.id === clientId; });
          if (matchedItem) {
            showPrincipalPaymentModal(matchedItem.client);
          }
        });
      });

    } catch (e) {
      listContainer.innerHTML = '<p class="empty-message">Could not load data. Please try again.</p>';
      console.error('Error rendering interest list:', e);
    }
  }

  // ─── Payment Flow Functions (Task 1.3) ─────────────────────────────────────

  /**
   * Show the interest payment modal with amount pre-filled.
   * @param {Object} client - Client record
   * @param {number} totalDue - Total interest due (including carry-forward)
   */
  function showInterestPaymentModal(client, totalDue) {
    currentPaymentType = 'interest';
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

    // Generate QR code
    var upiId = Settings.getUpiId();
    var appName = Settings.getAppName();
    if (upiId && totalDue > 0) {
      generateInterestQR(upiId, appName, totalDue, client.name);
    } else if (qrContainer) {
      qrContainer.innerHTML = '<p class="qr-placeholder">Configure UPI ID in Settings to generate QR</p>';
    }

    // Show modal
    if (modal) modal.removeAttribute('hidden');
  }

  /**
   * Show the principal payment modal with empty amount field.
   * @param {Object} client - Client record
   */
  function showPrincipalPaymentModal(client) {
    currentPaymentType = 'principal';
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

    // Show QR placeholder — user needs to enter amount first
    if (qrContainer) {
      qrContainer.innerHTML = '<p class="qr-placeholder">Enter amount to generate QR</p>';
    }

    // Show modal
    if (modal) modal.removeAttribute('hidden');
  }

  /**
   * Handle confirm payment button click for both interest and principal payments.
   */
  async function handleConfirmPayment() {
    var amountInput = document.getElementById('interest-payment-amount');
    var amountError = document.getElementById('interest-payment-amount-error');

    if (!amountInput || !currentClient) return;

    var amount = parseFloat(amountInput.value);

    // Validate amount > 0
    if (isNaN(amount) || amount <= 0) {
      if (amountError) amountError.textContent = 'Amount must be greater than zero.';
      return;
    }

    // Principal payment validation: amount must not exceed principal balance
    if (currentPaymentType === 'principal') {
      if (amount > currentClient.principalBalance) {
        if (amountError) amountError.textContent = 'Amount cannot exceed outstanding principal of ₹' + currentClient.principalBalance.toFixed(2);
        return;
      }
    }

    if (amountError) amountError.textContent = '';

    try {
      var payment = {
        id: generateUUID(),
        clientId: currentClient.id,
        date: getTodayISO(),
        amount: amount,
        paymentType: currentPaymentType,
        createdAt: new Date().toISOString()
      };

      await DB.addPayment(payment);

      // If principal payment, update the client's principalBalance
      if (currentPaymentType === 'principal') {
        var newBalance = Math.round((currentClient.principalBalance - amount) * 100) / 100;
        await DB.updateClientPrincipalBalance(currentClient.id, newBalance);
      }

      // Hide modal and refresh list
      hideInterestModal();
      await renderInterestList();
    } catch (e) {
      alert('Payment could not be saved: ' + (e.message || 'Unknown error'));
      console.error('Interest payment error:', e);
    }
  }

  /**
   * Hide the interest payment modal and clear state.
   */
  function hideInterestModal() {
    var modal = document.getElementById('interest-payment-modal');
    var qrContainer = document.getElementById('interest-qr-code-container');
    var amountError = document.getElementById('interest-payment-amount-error');

    if (modal) modal.setAttribute('hidden', '');
    if (qrContainer) qrContainer.innerHTML = '';
    if (amountError) amountError.textContent = '';
  }

  /**
   * Generate a UPI QR code for interest/principal payment.
   * @param {string} upiId - UPI ID
   * @param {string} appName - Application name (payee name)
   * @param {number} amount - Payment amount
   * @param {string} clientName - Client name for transaction note
   */
  function generateInterestQR(upiId, appName, amount, clientName) {
    var container = document.getElementById('interest-qr-code-container');
    if (!container) return;

    var upiLink = 'upi://pay?pa=' + upiId +
      '&pn=' + encodeURIComponent(appName) +
      '&am=' + amount.toFixed(2) +
      '&cu=INR' +
      '&tn=' + encodeURIComponent(clientName);

    try {
      var qr = qrcode(0, 'M');
      qr.addData(upiLink);
      qr.make();
      container.innerHTML = qr.createSvgTag(4, 0);
    } catch (e) {
      // Fallback: show tappable link
      console.error('QR code generation failed:', e);
      container.innerHTML = '<a href="' + escapeHtml(upiLink) + '" class="qr-fallback-link" ' +
        'aria-label="Open UPI payment link">Tap to pay via UPI</a>';
    }
  }

  // ─── Init Function (Task 1.4) ─────────────────────────────────────────────

  /**
   * Initialize the InterestCollection module.
   * Attaches event listeners and renders the interest list.
   */
  function init() {
    // Set up date picker — default to today
    var dateInput = document.getElementById('interest-date');
    if (dateInput) {
      if (!dateInput.value) {
        dateInput.value = getTodayISO();
      }
      dateInput.addEventListener('change', function() {
        renderInterestList();
      });
    }

    // Attach change listener to filter checkbox
    var filterCheckbox = document.getElementById('interest-filter-unpaid');
    if (filterCheckbox) {
      filterCheckbox.addEventListener('change', function() {
        renderInterestList();
      });
    }

    // Attach click listener to confirm payment button
    var confirmBtn = document.getElementById('interest-confirm-payment-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', handleConfirmPayment);
    }

    // Attach click listener to cancel payment button
    var cancelBtn = document.getElementById('interest-cancel-payment-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', hideInterestModal);
    }

    // Render the interest list on init
    renderInterestList();
  }

  // ─── Expose Public API ─────────────────────────────────────────────────────

  return {
    init: init,
    renderInterestList: renderInterestList
  };
})();
