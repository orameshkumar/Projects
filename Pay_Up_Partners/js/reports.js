const Reports = (function() {
  'use strict';

  var currentTab = 'daywise';

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
    var startInput = document.getElementById('report-start-date');
    var endInput = document.getElementById('report-end-date');
    var searchInput = document.getElementById('report-search');
    var printBtn = document.getElementById('report-print-btn');

    if (startInput && !startInput.value) startInput.value = getDateDaysAgo(30);
    if (endInput && !endInput.value) endInput.value = getTodayISO();

    if (startInput) startInput.addEventListener('change', function() { renderReport(); });
    if (endInput) endInput.addEventListener('change', function() { renderReport(); });
    if (searchInput) searchInput.addEventListener('input', function() { renderReport(); });
    if (printBtn) printBtn.addEventListener('click', printReport);

    // Tab switching
    var tabs = document.querySelectorAll('.report-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentTab = tab.getAttribute('data-tab');
        renderReport();
      });
    });

    renderReport();
  }

  async function renderReport() {
    var container = document.getElementById('report-content');
    if (!container) return;

    switch (currentTab) {
      case 'daywise': await renderDaywise(container); break;
      case 'clientwise': await renderClientwise(container); break;
      case 'outstanding': await renderOutstanding(container); break;
      default: await renderDaywise(container);
    }
  }

  async function renderDaywise(container) {
    var startInput = document.getElementById('report-start-date');
    var endInput = document.getElementById('report-end-date');
    var startDate = startInput ? startInput.value : getDateDaysAgo(30);
    var endDate = endInput ? endInput.value : getTodayISO();

    try {
      var payments = await DB.getPaymentsByDateRange(startDate, endDate);

      if (!payments || payments.length === 0) {
        container.innerHTML = '<p class="empty-message">No payments in this date range.</p>';
        return;
      }

      // Aggregate by date
      var dateMap = {};
      for (var i = 0; i < payments.length; i++) {
        var p = payments[i];
        if (!dateMap[p.date]) dateMap[p.date] = { total: 0, count: 0, emi: 0, interest: 0, principal: 0 };
        dateMap[p.date].total += p.amount;
        dateMap[p.date].count += 1;
        if (p.paymentType === 'emi') dateMap[p.date].emi += p.amount;
        else if (p.paymentType === 'interest') dateMap[p.date].interest += p.amount;
        else if (p.paymentType === 'principal') dateMap[p.date].principal += p.amount;
      }

      var dates = Object.keys(dateMap).sort().reverse();
      var grandTotal = 0;

      var html = '<table class="report-table">';
      html += '<thead><tr><th>Date</th><th>Count</th><th>EMI</th><th>Interest</th><th>Principal</th><th>Total</th></tr></thead>';
      html += '<tbody>';

      for (var j = 0; j < dates.length; j++) {
        var d = dates[j];
        var row = dateMap[d];
        grandTotal += row.total;
        html += '<tr>';
        html += '<td>' + formatDate(d) + '</td>';
        html += '<td>' + row.count + '</td>';
        html += '<td>₹' + row.emi.toFixed(2) + '</td>';
        html += '<td>₹' + row.interest.toFixed(2) + '</td>';
        html += '<td>₹' + row.principal.toFixed(2) + '</td>';
        html += '<td><strong>₹' + row.total.toFixed(2) + '</strong></td>';
        html += '</tr>';
      }

      html += '</tbody>';
      html += '<tfoot><tr><td><strong>Total</strong></td><td></td><td></td><td></td><td></td><td><strong>₹' + grandTotal.toFixed(2) + '</strong></td></tr></tfoot>';
      html += '</table>';

      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<p class="empty-message">Could not generate report.</p>';
      console.error('Day-wise report error:', e);
    }
  }

  async function renderClientwise(container) {
    var startInput = document.getElementById('report-start-date');
    var endInput = document.getElementById('report-end-date');
    var searchInput = document.getElementById('report-search');
    var startDate = startInput ? startInput.value : getDateDaysAgo(30);
    var endDate = endInput ? endInput.value : getTodayISO();
    var searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    try {
      var payments = await DB.getPaymentsByDateRange(startDate, endDate);

      if (!payments || payments.length === 0) {
        container.innerHTML = '<p class="empty-message">No payments in this date range.</p>';
        return;
      }

      // Resolve loan → client for each payment, aggregate by client
      var clientMap = {};
      for (var i = 0; i < payments.length; i++) {
        var p = payments[i];
        var loan = await DB.getLoan(p.loanId);
        var clientId = loan ? loan.clientId : 'unknown';
        if (!clientMap[clientId]) {
          var client = loan ? await DB.getClient(loan.clientId) : null;
          clientMap[clientId] = { name: client ? client.name : 'Unknown', total: 0, emi: 0, interest: 0, principal: 0 };
        }
        clientMap[clientId].total += p.amount;
        if (p.paymentType === 'emi') clientMap[clientId].emi += p.amount;
        else if (p.paymentType === 'interest') clientMap[clientId].interest += p.amount;
        else if (p.paymentType === 'principal') clientMap[clientId].principal += p.amount;
      }

      var clientIds = Object.keys(clientMap);

      // Apply search filter
      if (searchTerm) {
        clientIds = clientIds.filter(function(id) {
          return clientMap[id].name.toLowerCase().indexOf(searchTerm) !== -1;
        });
      }

      if (clientIds.length === 0) {
        container.innerHTML = '<p class="empty-message">No clients match your search.</p>';
        return;
      }

      // Sort by client name
      clientIds.sort(function(a, b) { return clientMap[a].name.localeCompare(clientMap[b].name); });

      var grandTotal = 0;
      var html = '<table class="report-table">';
      html += '<thead><tr><th>Client</th><th>EMI</th><th>Interest</th><th>Principal</th><th>Total</th></tr></thead>';
      html += '<tbody>';

      for (var j = 0; j < clientIds.length; j++) {
        var row = clientMap[clientIds[j]];
        grandTotal += row.total;
        html += '<tr>';
        html += '<td>' + esc(row.name) + '</td>';
        html += '<td>₹' + row.emi.toFixed(2) + '</td>';
        html += '<td>₹' + row.interest.toFixed(2) + '</td>';
        html += '<td>₹' + row.principal.toFixed(2) + '</td>';
        html += '<td><strong>₹' + row.total.toFixed(2) + '</strong></td>';
        html += '</tr>';
      }

      html += '</tbody>';
      html += '<tfoot><tr><td><strong>Total</strong></td><td></td><td></td><td></td><td><strong>₹' + grandTotal.toFixed(2) + '</strong></td></tr></tfoot>';
      html += '</table>';

      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<p class="empty-message">Could not generate report.</p>';
      console.error('Client-wise report error:', e);
    }
  }

  async function renderOutstanding(container) {
    var searchInput = document.getElementById('report-search');
    var searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    try {
      var loans = await DB.getAllLoans();

      // Filter to active loans only
      loans = loans.filter(function(l) { return l.status === 'active'; });

      if (loans.length === 0) {
        container.innerHTML = '<p class="empty-message">No active loans.</p>';
        return;
      }

      var displayItems = [];

      for (var i = 0; i < loans.length; i++) {
        var loan = loans[i];
        var client = await DB.getClient(loan.clientId);
        var clientName = client ? client.name : 'Unknown';

        // Apply search
        if (searchTerm && clientName.toLowerCase().indexOf(searchTerm) === -1) continue;

        var payments = await DB.getPaymentsByLoan(loan.id);
        var totalPaid = 0;
        for (var k = 0; k < payments.length; k++) {
          totalPaid += payments[k].amount;
        }

        var outstanding;
        if (loan.loanType === 'interest_only') {
          outstanding = loan.principalBalance || 0;
        } else {
          outstanding = loan.totalAmount - totalPaid;
          if (outstanding < 0) outstanding = 0;
        }

        displayItems.push({
          clientName: clientName,
          loan: loan,
          totalPaid: totalPaid,
          outstanding: Math.round(outstanding * 100) / 100
        });
      }

      if (displayItems.length === 0) {
        container.innerHTML = '<p class="empty-message">No loans match your search.</p>';
        return;
      }

      // Sort by client name
      displayItems.sort(function(a, b) { return a.clientName.localeCompare(b.clientName); });

      var grandBorrowed = 0, grandPaid = 0, grandOutstanding = 0;

      var html = '<table class="report-table">';
      html += '<thead><tr><th>Client</th><th>Type</th><th>Borrowed</th><th>Paid</th><th>Outstanding</th><th>Notes</th></tr></thead>';
      html += '<tbody>';

      for (var j = 0; j < displayItems.length; j++) {
        var item = displayItems[j];
        var typeLabel = item.loan.loanType === 'interest_only' ? 'Interest Only' : 'Daily EMI';
        var badgeClass = item.loan.loanType === 'interest_only' ? 'badge-interest-only' : 'badge-daily-emi';

        grandBorrowed += item.loan.totalAmount;
        grandPaid += item.totalPaid;
        grandOutstanding += item.outstanding;

        html += '<tr>';
        html += '<td>' + esc(item.clientName) + '</td>';
        html += '<td><span class="loan-type-badge ' + badgeClass + '">' + typeLabel + '</span></td>';
        html += '<td>₹' + item.loan.totalAmount.toFixed(2) + '</td>';
        html += '<td>₹' + item.totalPaid.toFixed(2) + '</td>';
        html += '<td><strong>₹' + item.outstanding.toFixed(2) + '</strong></td>';
        html += '<td>' + esc(item.loan.notes || '') + '</td>';
        html += '</tr>';
      }

      html += '</tbody>';
      html += '<tfoot><tr><td><strong>Total</strong></td><td></td><td><strong>₹' + grandBorrowed.toFixed(2) + '</strong></td><td><strong>₹' + grandPaid.toFixed(2) + '</strong></td><td><strong>₹' + grandOutstanding.toFixed(2) + '</strong></td><td></td></tr></tfoot>';
      html += '</table>';

      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<p class="empty-message">Could not generate report.</p>';
      console.error('Outstanding report error:', e);
    }
  }

  function printReport() {
    window.print();
  }

  return {
    init: init,
    renderReport: renderReport,
    printReport: printReport
  };
})();
