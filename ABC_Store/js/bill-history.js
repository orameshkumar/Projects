/**
 * bill-history.js - Bill History Module for ABC Provisional Store
 * 
 * Provides bill history listing, date range filtering, detail expansion,
 * WhatsApp sharing, and clipboard fallback.
 * 
 * Dependencies: DB (db.js), Utils (utils.js)
 */

const BillHistory = (function () {
  'use strict';

  let historyListEl = null;
  let dateFromEl = null;
  let dateToEl = null;
  let filterBtnEl = null;
  let expandedBillId = null;
  let lastRenderedBills = null;

  // ─── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the Bill History module.
   * Sets up event listeners and loads all bills.
   */
  function init() {
    historyListEl = document.getElementById('history-list');
    dateFromEl = document.getElementById('history-date-from');
    dateToEl = document.getElementById('history-date-to');
    filterBtnEl = document.getElementById('history-filter-btn');

    if (filterBtnEl) {
      filterBtnEl.addEventListener('click', handleFilter);
    }

    loadAndRenderBills();
  }

  // ─── Filter Handling (Task 7.2) ─────────────────────────────────────────────

  /**
   * Handles the filter button click.
   * Loads bills by date range if dates are provided, otherwise loads all.
   */
  async function handleFilter() {
    var startDate = dateFromEl ? dateFromEl.value : '';
    var endDate = dateToEl ? dateToEl.value : '';

    if (startDate && endDate) {
      try {
        var bills = await DB.getBillsByDateRange(startDate, endDate);
        // Sort by bill number ascending
        bills.sort(function (a, b) {
          return (a.billNumber || '').localeCompare(b.billNumber || '');
        });
        renderBillList(bills);
      } catch (err) {
        console.error('Error filtering bills:', err);
        renderBillList([]);
      }
    } else {
      // No dates selected — show all bills
      loadAndRenderBills();
    }
  }

  // ─── Load Bills ─────────────────────────────────────────────────────────────

  /**
   * Loads all bills from DB and renders them (sorted by bill number ascending).
   */
  async function loadAndRenderBills() {
    try {
      var bills = await DB.getAllBills();
      // Sort by bill number ascending (ABC-20250101-001, ABC-20250101-002, ...)
      bills.sort(function (a, b) {
        return (a.billNumber || '').localeCompare(b.billNumber || '');
      });
      renderBillList(bills);
    } catch (err) {
      console.error('Error loading bills:', err);
      renderBillList([]);
    }
  }

  // ─── Render Bill List (Task 7.1) ───────────────────────────────────────────

  /**
   * Renders the list of bill cards into the history list container.
   * Each card shows bill number, formatted date, and total amount.
   * @param {Array} bills - Array of bill objects
   */
  function renderBillList(bills) {
    if (!historyListEl) return;

    // Cache last rendered bills for expand/collapse re-render
    lastRenderedBills = bills;

    if (!bills || bills.length === 0) {
      historyListEl.innerHTML = '<p class="empty-message">No bills found.</p>';
      return;
    }

    var html = '';
    bills.forEach(function (bill) {
      var isExpanded = expandedBillId === bill.id;
      html += renderBillCard(bill, isExpanded);
    });

    historyListEl.innerHTML = html;

    // Attach click listeners for expand/collapse and share
    attachCardListeners();
  }

  /**
   * Renders a single bill card HTML string.
   * @param {Object} bill - Bill object
   * @param {boolean} expanded - Whether the card is expanded
   * @returns {string} HTML string
   */
  function renderBillCard(bill, expanded) {
    var formattedDate = Utils.formatDate(bill.date);
    var formattedTotal = Utils.formatCurrency(bill.total);

    var html = '<div class="bill-card' + (expanded ? ' expanded' : '') + '" data-bill-id="' + bill.id + '">';
    html += '<div class="bill-card-header">';
    html += '<span class="bill-number">' + escapeHtml(bill.billNumber) + '</span>';
    html += '<span class="bill-card-date">' + escapeHtml(formattedDate) + '</span>';
    html += '<span class="bill-card-total">' + escapeHtml(formattedTotal) + '</span>';
    html += '</div>';

    // Detail view (Task 7.3)
    if (expanded) {
      html += renderBillDetail(bill);
    }

    html += '</div>';
    return html;
  }

  // ─── Bill Detail View (Task 7.3) ───────────────────────────────────────────

  /**
   * Renders the expanded detail view for a bill.
   * Shows all line items with quantities and prices, total, and share button.
   * @param {Object} bill - Bill object
   * @returns {string} HTML string for the detail section
   */
  function renderBillDetail(bill) {
    var html = '<div class="bill-card-detail">';
    html += '<table class="bill-detail-table">';
    html += '<thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>';
    html += '<tbody>';

    if (bill.lineItems && bill.lineItems.length > 0) {
      bill.lineItems.forEach(function (item) {
        var qty = Utils.formatQuantity(item.quantityGrams);
        var price = Utils.formatCurrency(item.lineTotal);
        html += '<tr>';
        html += '<td>' + escapeHtml(item.itemName) + '</td>';
        html += '<td>' + escapeHtml(qty) + '</td>';
        html += '<td>' + escapeHtml(price) + '</td>';
        html += '</tr>';
      });
    }

    html += '</tbody>';
    html += '</table>';
    html += '<div class="bill-detail-total">Total: ' + escapeHtml(Utils.formatCurrency(bill.total)) + '</div>';
    html += '<button class="btn-whatsapp-share" data-bill-id="' + bill.id + '">Share via WhatsApp</button>';
    html += '</div>';

    return html;
  }

  // ─── Event Listeners ────────────────────────────────────────────────────────

  /**
   * Attaches click event listeners to bill cards and share buttons.
   */
  function attachCardListeners() {
    if (!historyListEl) return;

    // Expand/collapse on card header click
    var headers = historyListEl.querySelectorAll('.bill-card-header');
    headers.forEach(function (header) {
      header.addEventListener('click', function () {
        var card = header.closest('.bill-card');
        var billId = card ? card.getAttribute('data-bill-id') : null;
        if (!billId) return;

        // Toggle expand/collapse
        if (expandedBillId === billId) {
          expandedBillId = null;
        } else {
          expandedBillId = billId;
        }

        // Re-render from cached bills to preserve filter state
        if (lastRenderedBills) {
          renderBillList(lastRenderedBills);
        } else {
          loadAndRenderBills();
        }
      });
    });

    // WhatsApp share buttons
    var shareBtns = historyListEl.querySelectorAll('.btn-whatsapp-share');
    shareBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var billId = btn.getAttribute('data-bill-id');
        if (billId) {
          handleShareWhatsApp(billId);
        }
      });
    });
  }

  // ─── WhatsApp Share (Task 7.4) ─────────────────────────────────────────────

  /**
   * Generates formatted bill text and opens WhatsApp share URL.
   * Falls back to clipboard if WhatsApp link cannot be opened.
   * @param {string} billId - The bill ID to share
   */
  async function handleShareWhatsApp(billId) {
    try {
      var bill = await DB.getBill(billId);
      if (!bill) {
        console.error('Bill not found for sharing:', billId);
        return;
      }

      var text = Utils.formatBillForWhatsApp(bill);
      var encodedText = encodeURIComponent(text);
      var whatsappUrl = 'https://wa.me/?text=' + encodedText;

      // Try opening WhatsApp URL
      var opened = window.open(whatsappUrl, '_blank');

      // If window.open returns null/undefined, the URL scheme isn't supported
      // Fall back to clipboard copy
      if (!opened) {
        copyToClipboard(text);
      }
    } catch (err) {
      console.error('Error sharing bill via WhatsApp:', err);
      // Attempt clipboard fallback on any error
      try {
        var fallbackBill = await DB.getBill(billId);
        if (fallbackBill) {
          var fallbackText = Utils.formatBillForWhatsApp(fallbackBill);
          copyToClipboard(fallbackText);
        }
      } catch (clipErr) {
        console.error('Clipboard fallback also failed:', clipErr);
      }
    }
  }

  // ─── Clipboard Fallback (Task 7.5) ─────────────────────────────────────────

  /**
   * Copies text to clipboard using modern API with fallback to execCommand.
   * Shows a brief confirmation message.
   * @param {string} text - Text to copy
   */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopyConfirmation();
      }).catch(function () {
        // Fallback to execCommand
        execCommandCopy(text);
      });
    } else {
      execCommandCopy(text);
    }
  }

  /**
   * Fallback clipboard copy using document.execCommand('copy').
   * @param {string} text - Text to copy
   */
  function execCommandCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      showCopyConfirmation();
    } catch (err) {
      console.error('execCommand copy failed:', err);
    }

    document.body.removeChild(textarea);
  }

  /**
   * Shows a brief "Bill copied to clipboard!" confirmation message.
   */
  function showCopyConfirmation() {
    // Check if a toast already exists
    var existing = document.querySelector('.clipboard-toast');
    if (existing) {
      existing.remove();
    }

    var toast = document.createElement('div');
    toast.className = 'clipboard-toast';
    toast.textContent = 'Bill copied to clipboard!';
    document.body.appendChild(toast);

    // Auto-remove after 2.5 seconds
    setTimeout(function () {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 2500);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Escapes HTML special characters to prevent XSS.
   * @param {string} str - Raw string
   * @returns {string} Escaped string safe for innerHTML
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

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    init: init,
    loadAndRenderBills: loadAndRenderBills
  };

})();
