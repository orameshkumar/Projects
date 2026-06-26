// Reports module — day-wise and client-wise collection reports with print support

var Reports = (function() {
  'use strict';

  var currentReportType = 'day-wise';

  /**
   * Initialize the Reports module.
   * Sets up date range, report type tabs, and print button.
   */
  function init() {
    var startDateInput = document.getElementById('report-start-date');
    var endDateInput = document.getElementById('report-end-date');
    var printBtn = document.getElementById('print-report-btn');

    // Default: first of current month to today
    var today = getTodayISO();
    var firstOfMonth = getFirstOfMonthISO();

    if (startDateInput && !startDateInput.value) {
      startDateInput.value = firstOfMonth;
    }
    if (endDateInput && !endDateInput.value) {
      endDateInput.value = today;
    }

    // Report type tabs
    var reportTabs = document.querySelectorAll('.report-tab');
    reportTabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        // Update active tab
        reportTabs.forEach(function(t) {
          t.classList.remove('active');
          t.setAttribute('aria-pressed', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-pressed', 'true');

        currentReportType = tab.getAttribute('data-report');
        loadReport();
      });
    });

    // Date change listeners
    if (startDateInput) {
      startDateInput.addEventListener('change', loadReport);
    }
    if (endDateInput) {
      endDateInput.addEventListener('change', loadReport);
    }

    // Print button
    if (printBtn) {
      printBtn.addEventListener('click', printReport);
    }

    // Client name search filter
    var clientSearchInput = document.getElementById('report-client-search');
    if (clientSearchInput) {
      clientSearchInput.addEventListener('input', loadReport);
    }

    loadReport();
  }

  /**
   * Load and render the currently selected report type.
   */
  async function loadReport() {
    // Outstanding report doesn't need date range
    if (currentReportType === 'outstanding') {
      var outstandingData = await generateOutstandingReport();
      renderReport(outstandingData, 'outstanding');
      return;
    }

    var start = document.getElementById('report-start-date').value;
    var end = document.getElementById('report-end-date').value;

    if (!start || !end || start > end) {
      var tableContainer = document.getElementById('report-table');
      if (tableContainer) tableContainer.innerHTML = '<p class="empty-message">Please select a valid date range.</p>';
      return;
    }

    if (currentReportType === 'day-wise') {
      var dayData = await generateDayWiseReport(start, end);
      renderReport(dayData, 'day-wise');
    } else {
      var clientData = await generateClientWiseReport(start, end);
      renderReport(clientData, 'client-wise');
    }
  }

  /**
   * Generate a day-wise report: aggregate payments by date.
   * @param {string} start - Start date ISO
   * @param {string} end - End date ISO
   * @returns {Array} [{date, total}] sorted by date descending
   */
  async function generateDayWiseReport(start, end) {
    try {
      var payments = await DB.getPaymentsByDateRange(start, end);

      if (!payments || payments.length === 0) return [];

      // Group by date
      var dateMap = {};
      for (var i = 0; i < payments.length; i++) {
        var date = payments[i].date;
        if (!dateMap[date]) {
          dateMap[date] = 0;
        }
        dateMap[date] += payments[i].amount;
      }

      // Convert to array and sort descending by date
      var result = [];
      for (var d in dateMap) {
        if (dateMap.hasOwnProperty(d)) {
          result.push({ date: d, total: Math.round(dateMap[d] * 100) / 100 });
        }
      }

      result.sort(function(a, b) {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
      });

      return result;
    } catch (e) {
      console.error('Error generating day-wise report:', e);
      return [];
    }
  }

  /**
   * Generate a client-wise report: aggregate payments by client.
   * For interest-only clients, computes separate interest and principal totals.
   * @param {string} start - Start date ISO
   * @param {string} end - End date ISO
   * @returns {Array} [{name, total, loanType, principalBalance, interestTotal, principalTotal}] sorted alphabetically by name
   */
  async function generateClientWiseReport(start, end) {
    try {
      var payments = await DB.getPaymentsByDateRange(start, end);

      if (!payments || payments.length === 0) return [];

      // Group by clientId with payment type breakdown
      var clientMap = {};
      for (var i = 0; i < payments.length; i++) {
        var clientId = payments[i].clientId;
        if (!clientMap[clientId]) {
          clientMap[clientId] = { total: 0, interestTotal: 0, principalTotal: 0 };
        }
        clientMap[clientId].total += payments[i].amount;
        if (payments[i].paymentType === 'interest') {
          clientMap[clientId].interestTotal += payments[i].amount;
        } else if (payments[i].paymentType === 'principal') {
          clientMap[clientId].principalTotal += payments[i].amount;
        }
      }

      // Resolve client names, loanType, and principalBalance
      var result = [];
      for (var id in clientMap) {
        if (clientMap.hasOwnProperty(id)) {
          var name = 'Unknown';
          var loanType = 'daily_emi';
          var principalBalance = null;
          try {
            var client = await DB.getClient(id);
            if (client) {
              name = client.name;
              loanType = client.loanType || 'daily_emi';
              principalBalance = client.principalBalance != null ? client.principalBalance : null;
            }
          } catch (e) {
            // Use defaults
          }

          var entry = {
            name: name,
            total: Math.round(clientMap[id].total * 100) / 100,
            loanType: loanType,
            principalBalance: principalBalance,
            interestTotal: loanType === 'interest_only' ? Math.round(clientMap[id].interestTotal * 100) / 100 : null,
            principalTotal: loanType === 'interest_only' ? Math.round(clientMap[id].principalTotal * 100) / 100 : null
          };
          result.push(entry);
        }
      }

      // Sort alphabetically by name
      result.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch (e) {
      console.error('Error generating client-wise report:', e);
      return [];
    }
  }

  /**
   * Generate an outstanding report: show all clients with pending balances.
   * @returns {Array} [{name, loanType, totalAmount, totalPaid, outstanding, notes}] sorted alphabetically
   */
  async function generateOutstandingReport() {
    try {
      var clients = await DB.getAllClients();
      if (!clients || clients.length === 0) return [];

      var result = [];

      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        var outstanding = 0;
        var totalPaid = 0;

        if (client.loanType === 'interest_only') {
          // For interest-only: outstanding = current principalBalance
          outstanding = client.principalBalance || 0;
          // Total paid in principal
          var payments = await DB.getPaymentsByClient(client.id);
          for (var k = 0; k < payments.length; k++) {
            if (payments[k].paymentType === 'principal') {
              totalPaid += payments[k].amount;
            }
          }
        } else {
          // For daily EMI: outstanding = totalAmount - sum of all payments
          var emiPayments = await DB.getPaymentsByClient(client.id);
          for (var j = 0; j < emiPayments.length; j++) {
            totalPaid += emiPayments[j].amount;
          }
          outstanding = client.totalAmount - totalPaid;
        }

        outstanding = Math.round(outstanding * 100) / 100;
        if (outstanding <= 0) continue; // Skip fully paid clients

        result.push({
          name: client.name,
          loanType: client.loanType || 'daily_emi',
          totalAmount: client.totalAmount,
          totalPaid: Math.round(totalPaid * 100) / 100,
          outstanding: outstanding,
          notes: client.notes || ''
        });
      }

      // Sort alphabetically by name
      result.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch (e) {
      console.error('Error generating outstanding report:', e);
      return [];
    }
  }

  /**
   * Render the report data as an HTML table.
   * @param {Array} data - Report data array
   * @param {string} type - 'day-wise', 'client-wise', or 'outstanding'
   */
  function renderReport(data, type) {
    var tableContainer = document.getElementById('report-table');
    if (!tableContainer) return;

    if (!data || data.length === 0) {
      tableContainer.innerHTML = '<p class="empty-message">No collection data available for the selected period.</p>';
      return;
    }

    // Apply client name filter for client-wise and outstanding reports
    var clientSearchInput = document.getElementById('report-client-search');
    var clientSearchTerm = clientSearchInput ? clientSearchInput.value.trim().toLowerCase() : '';

    if (clientSearchTerm && (type === 'client-wise' || type === 'outstanding')) {
      data = data.filter(function(item) {
        return item.name.toLowerCase().indexOf(clientSearchTerm) !== -1;
      });
      if (data.length === 0) {
        tableContainer.innerHTML = '<p class="empty-message">No clients match your filter.</p>';
        return;
      }
    }

    var html = '<table>';

    if (type === 'outstanding') {
      // Outstanding report: Client, Type, Total Borrowed, Total Paid, Outstanding, Notes
      html += '<thead><tr><th>Client</th><th>Type</th><th class="amount-cell">Borrowed (₹)</th>' +
              '<th class="amount-cell">Paid (₹)</th><th class="amount-cell">Outstanding (₹)</th><th>Notes</th></tr></thead>';
      html += '<tbody>';
      var totalOutstanding = 0;
      var totalBorrowed = 0;
      var totalPaidAll = 0;
      for (var o = 0; o < data.length; o++) {
        var item = data[o];
        var typeLabel = item.loanType === 'interest_only' ? 'Interest Only' : 'Daily EMI';
        html += '<tr>';
        html += '<td>' + escapeHtml(item.name) + '</td>';
        html += '<td><span class="loan-type-badge ' + (item.loanType === 'interest_only' ? 'badge-interest-only' : 'badge-daily-emi') + '">' + typeLabel + '</span></td>';
        html += '<td class="amount-cell">' + item.totalAmount.toFixed(2) + '</td>';
        html += '<td class="amount-cell">' + item.totalPaid.toFixed(2) + '</td>';
        html += '<td class="amount-cell"><strong>' + item.outstanding.toFixed(2) + '</strong></td>';
        html += '<td class="notes-cell">' + escapeHtml(item.notes) + '</td>';
        html += '</tr>';
        totalOutstanding += item.outstanding;
        totalBorrowed += item.totalAmount;
        totalPaidAll += item.totalPaid;
      }
      html += '<tr class="grand-total-row">';
      html += '<td colspan="2"><strong>Grand Total</strong></td>';
      html += '<td class="amount-cell"><strong>' + totalBorrowed.toFixed(2) + '</strong></td>';
      html += '<td class="amount-cell"><strong>' + totalPaidAll.toFixed(2) + '</strong></td>';
      html += '<td class="amount-cell"><strong>' + totalOutstanding.toFixed(2) + '</strong></td>';
      html += '<td></td>';
      html += '</tr>';
      html += '</tbody>';
    } else if (type === 'day-wise') {
      html += '<thead><tr><th>Date</th><th class="amount-cell">Amount (₹)</th></tr></thead>';
      html += '<tbody>';
      var grandTotal = 0;
      for (var i = 0; i < data.length; i++) {
        html += '<tr><td>' + formatDate(data[i].date) + '</td>' +
                '<td class="amount-cell">' + data[i].total.toFixed(2) + '</td></tr>';
        grandTotal += data[i].total;
      }
      html += '<tr class="grand-total-row"><td><strong>Total</strong></td>' +
              '<td class="amount-cell"><strong>' + grandTotal.toFixed(2) + '</strong></td></tr>';
      html += '</tbody>';
    } else {
      // Check if any interest-only clients exist to show extra columns
      var hasInterestOnly = data.some(function(d) { return d.loanType === 'interest_only'; });

      if (hasInterestOnly) {
        html += '<thead><tr><th>Client Name</th><th class="amount-cell">Amount (₹)</th>' +
                '<th class="amount-cell">Interest (₹)</th><th class="amount-cell">Principal (₹)</th>' +
                '<th class="amount-cell">Balance (₹)</th></tr></thead>';
      } else {
        html += '<thead><tr><th>Client Name</th><th class="amount-cell">Amount (₹)</th></tr></thead>';
      }
      html += '<tbody>';
      var clientGrandTotal = 0;
      for (var j = 0; j < data.length; j++) {
        var row = data[j];
        html += '<tr><td>' + escapeHtml(row.name) + '</td>' +
                '<td class="amount-cell">' + row.total.toFixed(2) + '</td>';
        if (hasInterestOnly) {
          if (row.loanType === 'interest_only') {
            html += '<td class="amount-cell">' + (row.interestTotal != null ? row.interestTotal.toFixed(2) : '0.00') + '</td>';
            html += '<td class="amount-cell">' + (row.principalTotal != null ? row.principalTotal.toFixed(2) : '0.00') + '</td>';
            html += '<td class="amount-cell">' + (row.principalBalance != null ? row.principalBalance.toFixed(2) : '—') + '</td>';
          } else {
            html += '<td class="amount-cell">—</td>';
            html += '<td class="amount-cell">—</td>';
            html += '<td class="amount-cell">—</td>';
          }
        }
        html += '</tr>';
        clientGrandTotal += row.total;
      }
      var totalColspan = hasInterestOnly ? 4 : 1;
      html += '<tr class="grand-total-row"><td colspan="' + totalColspan + '"><strong>Total</strong></td>' +
              '<td class="amount-cell"><strong>' + clientGrandTotal.toFixed(2) + '</strong></td></tr>';
      html += '</tbody>';
    }

    html += '</table>';
    tableContainer.innerHTML = html;
  }

  /**
   * Trigger the browser print dialog with print-optimized layout.
   */
  function printReport() {
    // Add print header and date range temporarily
    var appName = Settings.getAppName();
    var start = document.getElementById('report-start-date').value;
    var end = document.getElementById('report-end-date').value;

    var printHeader = document.querySelector('.print-header');
    var printDateRange = document.querySelector('.print-date-range');

    if (printHeader) printHeader.textContent = appName;
    if (printDateRange) printDateRange.textContent = formatDate(start) + ' to ' + formatDate(end);

    window.print();
  }

  // ─── Helpers ───

  function getTodayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function getFirstOfMonthISO() {
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    return first.toISOString().split('T')[0];
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    var parts = isoDate.split('-');
    if (parts.length === 3) {
      return parts[2] + '/' + parts[1] + '/' + parts[0]; // DD/MM/YYYY
    }
    return isoDate;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
  }

  return {
    init: init,
    generateDayWiseReport: generateDayWiseReport,
    generateClientWiseReport: generateClientWiseReport,
    generateOutstandingReport: generateOutstandingReport,
    renderReport: renderReport,
    printReport: printReport
  };
})();
