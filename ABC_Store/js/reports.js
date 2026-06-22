/**
 * ABC Provisional Store - Reports Module
 * Provides sales reporting with Total, Day-wise, and Item-wise views.
 * Depends on: DB, Utils
 */
const Reports = (function () {
  'use strict';

  let currentReportType = 'total';

  // ─── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the Reports module.
   * Sets up event listeners, default date range, and renders default view.
   */
  function init() {
    _setupTabNavigation();
    _setupGenerateButton();
    _setDefaultDateRange();
  }

  /**
   * Set up click listeners on .report-tab buttons for sub-tab navigation.
   */
  function _setupTabNavigation() {
    var tabs = document.querySelectorAll('.report-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        // Update active state
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');

        // Store selected type and generate report
        currentReportType = tab.getAttribute('data-report');
        _generateReport();
      });
    });
  }

  /**
   * Set up click listener on the Generate button.
   */
  function _setupGenerateButton() {
    var btn = document.getElementById('report-generate-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        _generateReport();
      });
    }
  }

  /**
   * Set date inputs to default range: 1st of current month to today.
   */
  function _setDefaultDateRange() {
    var today = new Date();
    var firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    var fromInput = document.getElementById('report-date-from');
    var toInput = document.getElementById('report-date-to');

    if (fromInput) {
      fromInput.value = _toISODate(firstOfMonth);
    }
    if (toInput) {
      toInput.value = _toISODate(today);
    }
  }

  // ─── Report Generation ──────────────────────────────────────────────────────

  /**
   * Generate report based on current report type and date range.
   */
  function _generateReport() {
    var fromInput = document.getElementById('report-date-from');
    var toInput = document.getElementById('report-date-to');
    var startDate = fromInput ? fromInput.value : '';
    var endDate = toInput ? toInput.value : '';

    if (!startDate || !endDate) {
      _renderContent('<p class="report-empty">Please select a date range.</p>');
      return;
    }

    DB.getBillsByDateRange(startDate, endDate).then(function (bills) {
      switch (currentReportType) {
        case 'total':
          _renderTotalView(bills, startDate, endDate);
          break;
        case 'day-wise':
          _renderDayWiseView(bills);
          break;
        case 'item-wise':
          _renderItemWiseView(bills);
          break;
        default:
          _renderTotalView(bills, startDate, endDate);
      }
    }).catch(function (err) {
      _renderContent('<p class="report-empty">Error loading report data.</p>');
      console.error('Reports: Error generating report', err);
    });
  }

  // ─── Total Sales View (8.2) ─────────────────────────────────────────────────

  /**
   * Render total sales summary card.
   * @param {Array} bills - Array of bill objects in date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   */
  function _renderTotalView(bills, startDate, endDate) {
    var totalSales = 0;
    bills.forEach(function (bill) {
      totalSales += bill.total;
    });

    var formattedTotal = Utils.formatCurrency(totalSales);
    var formattedFrom = Utils.formatDate(startDate);
    var formattedTo = Utils.formatDate(endDate);
    var billCount = bills.length;

    var html = '<div class="report-summary">' +
      '<div class="report-summary-amount">' + formattedTotal + '</div>' +
      '<div class="report-summary-label">Total Sales</div>' +
      '<div class="report-summary-subtext">' +
        formattedFrom + ' to ' + formattedTo + ' &middot; ' + billCount + ' bill' + (billCount !== 1 ? 's' : '') +
      '</div>' +
    '</div>';

    _renderContent(html);
  }

  // ─── Day-wise View (8.3) ────────────────────────────────────────────────────

  /**
   * Render day-wise report: grouped by date, sorted descending.
   * @param {Array} bills - Array of bill objects in date range
   */
  function _renderDayWiseView(bills) {
    if (bills.length === 0) {
      _renderContent('<p class="report-empty">No bills found in the selected date range.</p>');
      return;
    }

    // Group bills by date
    var grouped = {};
    bills.forEach(function (bill) {
      var date = bill.date;
      if (!grouped[date]) {
        grouped[date] = { total: 0, count: 0 };
      }
      grouped[date].total += bill.total;
      grouped[date].count += 1;
    });

    // Sort dates descending
    var dates = Object.keys(grouped).sort(function (a, b) {
      return b.localeCompare(a);
    });

    // Build table
    var html = '<table class="report-table">' +
      '<thead><tr>' +
        '<th>Date</th>' +
        '<th>Bills</th>' +
        '<th>Daily Total</th>' +
      '</tr></thead>' +
      '<tbody>';

    dates.forEach(function (date) {
      var entry = grouped[date];
      html += '<tr>' +
        '<td>' + Utils.formatDate(date) + '</td>' +
        '<td>' + entry.count + '</td>' +
        '<td>' + Utils.formatCurrency(entry.total) + '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';

    _renderContent(html);
  }

  // ─── Item-wise View (8.4) ───────────────────────────────────────────────────

  /**
   * Render item-wise report: aggregated quantities and revenue per item.
   * @param {Array} bills - Array of bill objects in date range
   */
  function _renderItemWiseView(bills) {
    if (bills.length === 0) {
      _renderContent('<p class="report-empty">No bills found in the selected date range.</p>');
      return;
    }

    // Flatten all lineItems and group by itemName
    var grouped = {};
    bills.forEach(function (bill) {
      if (bill.lineItems && bill.lineItems.length > 0) {
        bill.lineItems.forEach(function (item) {
          var name = item.itemName;
          if (!grouped[name]) {
            grouped[name] = { totalGrams: 0, totalRevenue: 0 };
          }
          grouped[name].totalGrams += item.quantityGrams;
          grouped[name].totalRevenue += item.lineTotal;
        });
      }
    });

    var itemNames = Object.keys(grouped);

    if (itemNames.length === 0) {
      _renderContent('<p class="report-empty">No line items found in the selected date range.</p>');
      return;
    }

    // Sort by revenue descending
    itemNames.sort(function (a, b) {
      return grouped[b].totalRevenue - grouped[a].totalRevenue;
    });

    // Build table
    var html = '<table class="report-table">' +
      '<thead><tr>' +
        '<th>Item Name</th>' +
        '<th>Total Qty (KG)</th>' +
        '<th>Total Revenue</th>' +
      '</tr></thead>' +
      '<tbody>';

    itemNames.forEach(function (name) {
      var entry = grouped[name];
      var kg = (entry.totalGrams / 1000).toFixed(2);
      html += '<tr>' +
        '<td>' + name + '</td>' +
        '<td>' + kg + '</td>' +
        '<td>' + Utils.formatCurrency(entry.totalRevenue) + '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';

    _renderContent(html);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Render HTML content into the report container.
   * @param {string} html - HTML string to render
   */
  function _renderContent(html) {
    var container = document.getElementById('report-content');
    if (container) {
      container.innerHTML = html;
    }
  }

  /**
   * Convert a Date object to YYYY-MM-DD string.
   * @param {Date} date - Date object
   * @returns {string} ISO date string e.g. "2025-01-15"
   */
  function _toISODate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    init: init
  };

})();
