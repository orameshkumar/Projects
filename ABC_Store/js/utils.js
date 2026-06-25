/**
 * ABC Provisional Store - Utility Module
 * Shared utilities for formatting, bill number generation, and calculations.
 */
const Utils = (function () {
  'use strict';

  const STORE_PREFIX = 'ABC';
  const STORAGE_KEY = 'abcstore_dailySequence';

  // ─── Bill Number Generation ───────────────────────────────────────────────────

  /**
   * Generates a bill number in format ABC-YYYYMMDD-NNN.
   * Reads/writes dailySequence from localStorage. Resets counter daily.
   * @returns {string} Bill number e.g. "ABC-20250615-001"
   */
  function generateBillNumber() {
    const today = new Date();
    const dateStr = _formatDateCompact(today);

    let seq = _loadSequence();

    if (seq.date !== dateStr) {
      seq = { date: dateStr, counter: 1 };
    }

    const number = seq.counter;
    const billNumber = STORE_PREFIX + '-' + dateStr + '-' + String(number).padStart(3, '0');

    seq.counter = number + 1;
    _saveSequence(seq);

    return billNumber;
  }

  function _loadSequence() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // Corrupted data — reset
    }
    return { date: '', counter: 1 };
  }

  function _saveSequence(seq) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seq));
  }

  /**
   * Returns YYYYMMDD string for a Date object.
   */
  function _formatDateCompact(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + m + d;
  }

  // ─── Price Calculation ────────────────────────────────────────────────────────

  /**
   * Calculates line total for a given base price per KG and quantity in grams.
   * @param {number} basePricePerKg - Price per kilogram
   * @param {number} quantityGrams - Quantity in grams
   * @returns {number} Calculated price rounded to 2 decimal places
   */
  function calculateLineTotal(basePricePerKg, quantityGrams) {
    const total = basePricePerKg * quantityGrams / 1000;
    return Math.round(total * 100) / 100;
  }

  // ─── Quantity Display Formatter ───────────────────────────────────────────────

  /**
   * Formats grams into a human-readable display string.
   * - Under 1000g: shown as grams (e.g. "50g", "250g", "500g")
   * - 1000g and above: shown as KG (e.g. "1 KG", "1.5 KG", "2 KG")
   * @param {number} grams - Quantity in grams
   * @returns {string} Formatted display string
   */
  function formatQuantity(grams) {
    if (grams >= 1000) {
      const kg = grams / 1000;
      // Remove unnecessary trailing zeros
      const kgDisplay = kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1).replace(/\.?0+$/, '');
      return kgDisplay + ' KG';
    }
    return grams + 'g';
  }

  // ─── WhatsApp Share Formatter ─────────────────────────────────────────────────

  /**
   * Formats a bill object into a WhatsApp-friendly text string.
   * @param {object} bill - Bill object with billNumber, date, lineItems, total
   * @param {string} bill.billNumber - e.g. "ABC-20250101-001"
   * @param {string} bill.date - ISO date string (YYYY-MM-DD)
   * @param {Array} bill.lineItems - Array of {itemName, quantityGrams, lineTotal}
   * @param {number} bill.total - Bill total
   * @returns {string} Formatted text for WhatsApp sharing
   */
  function formatBillForWhatsApp(bill) {
    const lines = [];

    lines.push('\u{1F9FE} *' + (typeof Settings !== 'undefined' ? Settings.getStoreName() : 'ABC Store') + '*');
    lines.push('Bill No: ' + bill.billNumber);
    lines.push('Date: ' + formatDate(bill.date));
    lines.push('');
    lines.push('Items:');

    bill.lineItems.forEach(function (item, index) {
      const qty = formatQuantity(item.quantityGrams);
      const price = formatCurrency(item.lineTotal);
      lines.push((index + 1) + '. ' + item.itemName + ' - ' + qty + ' - ' + price);
    });

    lines.push('');
    lines.push('*Total: ' + formatCurrency(bill.total) + '*');
    lines.push('');
    lines.push('Thank you for your purchase!');

    return lines.join('\n');
  }

  // ─── UUID Generator ───────────────────────────────────────────────────────────

  /**
   * Generates a unique ID.
   * Uses crypto.randomUUID() when available, falls back to a v4-style random UUID.
   * @returns {string} UUID string
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: generate UUID v4 format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ─── Currency Formatter ───────────────────────────────────────────────────────

  /**
   * Formats a number as Indian Rupee currency string.
   * @param {number} amount - Amount to format
   * @returns {string} Formatted string e.g. "₹80.00"
   */
  function formatCurrency(amount) {
    return '\u20B9' + Number(amount).toFixed(2);
  }

  // ─── Date Formatter ───────────────────────────────────────────────────────────

  /**
   * Formats an ISO date string (YYYY-MM-DD) into "DD-Mon-YYYY" display format.
   * @param {string} isoDateString - ISO date string e.g. "2025-01-01"
   * @returns {string} Formatted date e.g. "01-Jan-2025"
   */
  function formatDate(isoDateString) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Parse date parts directly to avoid timezone issues
    var parts = isoDateString.split('-');
    if (parts.length >= 3) {
      var year = parts[0];
      var monthIndex = parseInt(parts[1], 10) - 1;
      var day = parts[2].padStart(2, '0');
      return day + '-' + months[monthIndex] + '-' + year;
    }

    // Fallback: try parsing as Date
    var date = new Date(isoDateString);
    var dd = String(date.getDate()).padStart(2, '0');
    var mon = months[date.getMonth()];
    var yyyy = date.getFullYear();
    return dd + '-' + mon + '-' + yyyy;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  return {
    generateBillNumber: generateBillNumber,
    calculateLineTotal: calculateLineTotal,
    formatQuantity: formatQuantity,
    formatBillForWhatsApp: formatBillForWhatsApp,
    generateId: generateId,
    formatCurrency: formatCurrency,
    formatDate: formatDate
  };

})();
