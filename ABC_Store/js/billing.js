/**
 * billing.js - Billing Module for ABC Provisional Store
 * 
 * Handles:
 *   - Item selection grid with search filtering (5.1, 5.2)
 *   - Quick Entry Panel with preset & custom quantity (5.3)
 *   - Add to Bill with calculated price (5.4)
 *   - Bill line item display with scrollable list & running total (5.5)
 *   - Line item edit: tap to update quantity or override price (5.6)
 *   - Line item delete with total recalculation (5.7)
 *   - Finalize Bill: generate bill number, save to IndexedDB, clear (5.8)
 */

const Billing = (function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────────────

  let allItems = [];               // All items from DB
  let currentBillItems = [];       // Array of line items in current bill
  let selectedItemId = null;       // Currently selected item id
  let selectedQuantityGrams = null; // Current quantity in grams

  // ─── DOM References ─────────────────────────────────────────────────────────

  let searchInput, itemGrid, customQtyInput;
  let billItemsList, billTotalEl, finalizeBtn;
  let qtyButtons;

  // ─── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the Billing module.
   * Loads items from DB, sets up event listeners, and renders the item grid.
   */
  async function init() {
    // Cache DOM references
    searchInput = document.getElementById('billing-search');
    itemGrid = document.getElementById('billing-item-grid');
    customQtyInput = document.getElementById('custom-qty');
    billItemsList = document.getElementById('current-bill-items');
    billTotalEl = document.getElementById('bill-total');
    finalizeBtn = document.getElementById('finalize-bill-btn');
    qtyButtons = document.querySelectorAll('.qty-btn');

    // Load items from database
    await loadItems();

    // Set up event listeners
    setupEventListeners();

    // Reset state
    resetBillState();
  }

  /**
   * Load all items from IndexedDB and render the item grid.
   */
  async function loadItems() {
    try {
      allItems = await DB.getAllItems();
    } catch (e) {
      console.error('Billing: Failed to load items', e);
      allItems = [];
    }
    renderItemGrid(allItems);
  }

  /**
   * Set up all event listeners for the billing screen.
   */
  function setupEventListeners() {
    // Search filtering
    if (searchInput) {
      searchInput.addEventListener('input', onSearchInput);
    }

    // Preset quantity buttons
    qtyButtons.forEach(function (btn) {
      btn.addEventListener('click', onQtyButtonClick);
    });

    // Custom quantity input
    if (customQtyInput) {
      customQtyInput.addEventListener('input', onCustomQtyInput);
    }

    // Finalize bill button
    if (finalizeBtn) {
      finalizeBtn.addEventListener('click', onFinalizeBill);
    }
  }

  // ─── Item Grid (5.1, 5.2) ──────────────────────────────────────────────────

  /**
   * Render items as selectable cards in the item grid.
   * @param {Array} items - Array of item objects to display
   */
  function renderItemGrid(items) {
    if (!itemGrid) return;

    if (items.length === 0) {
      itemGrid.innerHTML = '<p class="empty-message">No items found. Add items in Item Master.</p>';
      return;
    }

    itemGrid.innerHTML = items.map(function (item) {
      const isSelected = item.id === selectedItemId;
      const thumbnail = item.imageBase64
        ? '<img src="' + item.imageBase64 + '" alt="' + item.name + '" class="item-thumb">'
        : '<span class="item-thumb-placeholder">📦</span>';
      const voiceTag = item.voiceTag ? '<span class="item-voice-tag">' + item.voiceTag + '</span>' : '';

      return '<button class="item-card' + (isSelected ? ' selected' : '') + '" data-item-id="' + item.id + '" aria-pressed="' + isSelected + '">'
        + thumbnail
        + '<span class="item-card-name">' + item.name + '</span>'
        + voiceTag
        + '</button>';
    }).join('');

    // Attach click listeners to item cards
    itemGrid.querySelectorAll('.item-card').forEach(function (card) {
      card.addEventListener('click', onItemCardClick);
    });
  }

  /**
   * Handle search input to filter items.
   */
  function onSearchInput() {
    var query = searchInput.value.trim().toLowerCase();
    if (!query) {
      renderItemGrid(allItems);
      return;
    }
    var filtered = allItems.filter(function (item) {
      return item.name.toLowerCase().indexOf(query) !== -1
        || (item.voiceTag && item.voiceTag.toLowerCase().indexOf(query) !== -1);
    });
    renderItemGrid(filtered);
  }

  /**
   * Handle item card click — select the item.
   */
  function onItemCardClick(e) {
    var card = e.currentTarget;
    var itemId = card.getAttribute('data-item-id');

    // Toggle selection
    if (selectedItemId === itemId) {
      selectedItemId = null;
    } else {
      selectedItemId = itemId;
    }

    // Update visual state
    itemGrid.querySelectorAll('.item-card').forEach(function (c) {
      var isSelected = c.getAttribute('data-item-id') === selectedItemId;
      c.classList.toggle('selected', isSelected);
      c.setAttribute('aria-pressed', isSelected);
    });

    // Try to auto-add if both item and quantity are selected
    tryAutoAdd();
  }

  // ─── Quick Entry Panel (5.3) ────────────────────────────────────────────────

  /**
   * Handle preset quantity button click.
   */
  function onQtyButtonClick(e) {
    var btn = e.currentTarget;
    var grams = parseInt(btn.getAttribute('data-grams'), 10);

    // Clear custom input when preset is selected
    if (customQtyInput) {
      customQtyInput.value = '';
    }

    // Highlight selected button
    qtyButtons.forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    selectedQuantityGrams = grams;

    // Try to auto-add
    tryAutoAdd();
  }

  /**
   * Handle custom quantity input — overrides preset selection.
   */
  function onCustomQtyInput() {
    var value = parseInt(customQtyInput.value, 10);

    // Clear preset button highlights
    qtyButtons.forEach(function (b) {
      b.classList.remove('active');
    });

    if (value && value > 0) {
      selectedQuantityGrams = value;
      // Try to auto-add
      tryAutoAdd();
    } else {
      selectedQuantityGrams = null;
    }
  }

  // ─── Add to Bill (5.4) ──────────────────────────────────────────────────────

  /**
   * Attempt to auto-add a line item when both item and quantity are selected.
   */
  function tryAutoAdd() {
    if (!selectedItemId || !selectedQuantityGrams) return;

    var item = allItems.find(function (i) { return i.id === selectedItemId; });
    if (!item) return;

    addLineItem(item, selectedQuantityGrams);

    // Reset selections after adding
    resetSelection();
  }

  /**
   * Add a line item to the current bill.
   * @param {Object} item - The item object from DB
   * @param {number} quantityGrams - Quantity in grams
   */
  function addLineItem(item, quantityGrams) {
    var lineTotal = Utils.calculateLineTotal(item.basePricePerKg, quantityGrams);

    var lineItem = {
      id: Utils.generateId(),
      itemId: item.id,
      itemName: item.name,
      quantityGrams: quantityGrams,
      pricePerKg: item.basePricePerKg,
      lineTotal: lineTotal,
      priceOverridden: false
    };

    currentBillItems.push(lineItem);
    renderBillItems();
    updateBillTotal();
  }

  /**
   * Reset item selection after adding (keep quantity selection).
   */
  function resetSelection() {
    selectedItemId = null;

    // Clear item highlights only — keep quantity selection
    if (itemGrid) {
      itemGrid.querySelectorAll('.item-card').forEach(function (c) {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
    }
  }

  // ─── Bill Line Item Display (5.5) ──────────────────────────────────────────

  /**
   * Render all current bill line items in the scrollable list.
   */
  function renderBillItems() {
    if (!billItemsList) return;

    if (currentBillItems.length === 0) {
      billItemsList.innerHTML = '<p class="empty-bill-message">No items added yet.</p>';
      return;
    }

    billItemsList.innerHTML = currentBillItems.map(function (lineItem, index) {
      var qtyDisplay = Utils.formatQuantity(lineItem.quantityGrams);
      var priceDisplay = Utils.formatCurrency(lineItem.lineTotal);

      return '<div class="bill-line-item" data-line-id="' + lineItem.id + '">'
        + '<span class="line-item-index">' + (index + 1) + '.</span>'
        + '<span class="line-item-name">' + lineItem.itemName + '</span>'
        + '<span class="line-item-qty" data-action="edit-qty" title="Tap to edit quantity">' + qtyDisplay + '</span>'
        + '<span class="line-item-price' + (lineItem.priceOverridden ? ' price-overridden' : '') + '" data-action="edit-price" title="Tap to override price">' + priceDisplay + '</span>'
        + '<button class="line-item-delete" data-action="delete" aria-label="Delete ' + lineItem.itemName + '">❌</button>'
        + '</div>';
    }).join('');

    // Attach event listeners to line items
    billItemsList.querySelectorAll('.bill-line-item').forEach(function (el) {
      // Edit quantity
      el.querySelector('[data-action="edit-qty"]').addEventListener('click', function () {
        onEditQuantity(el.getAttribute('data-line-id'));
      });
      // Edit price (override)
      el.querySelector('[data-action="edit-price"]').addEventListener('click', function () {
        onEditPrice(el.getAttribute('data-line-id'));
      });
      // Delete
      el.querySelector('[data-action="delete"]').addEventListener('click', function () {
        onDeleteLineItem(el.getAttribute('data-line-id'));
      });
    });
  }

  /**
   * Update the bill total display.
   */
  function updateBillTotal() {
    var total = currentBillItems.reduce(function (sum, item) {
      return sum + item.lineTotal;
    }, 0);
    // Round to 2 decimal places
    total = Math.round(total * 100) / 100;

    if (billTotalEl) {
      billTotalEl.textContent = Utils.formatCurrency(total);
    }
  }

  // ─── Line Item Edit (5.6) ──────────────────────────────────────────────────

  /**
   * Handle tap on quantity — show inline edit.
   * @param {string} lineId - The line item id
   */
  function onEditQuantity(lineId) {
    var lineItem = currentBillItems.find(function (li) { return li.id === lineId; });
    if (!lineItem) return;

    var newQty = prompt('Enter new quantity in grams:', lineItem.quantityGrams);
    if (newQty === null) return; // cancelled

    newQty = parseInt(newQty, 10);
    if (!newQty || newQty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }

    lineItem.quantityGrams = newQty;

    // Recalculate price only if not manually overridden
    if (!lineItem.priceOverridden) {
      lineItem.lineTotal = Utils.calculateLineTotal(lineItem.pricePerKg, newQty);
    }

    renderBillItems();
    updateBillTotal();
  }

  /**
   * Handle tap on price — allow manual price override.
   * @param {string} lineId - The line item id
   */
  function onEditPrice(lineId) {
    var lineItem = currentBillItems.find(function (li) { return li.id === lineId; });
    if (!lineItem) return;

    var currentPrice = lineItem.lineTotal.toFixed(2);
    var newPrice = prompt('Enter custom price (₹):', currentPrice);
    if (newPrice === null) return; // cancelled

    newPrice = parseFloat(newPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Please enter a valid price.');
      return;
    }

    lineItem.lineTotal = Math.round(newPrice * 100) / 100;
    lineItem.priceOverridden = true;

    renderBillItems();
    updateBillTotal();
  }

  // ─── Line Item Delete (5.7) ────────────────────────────────────────────────

  /**
   * Handle delete button click — remove line item from bill.
   * @param {string} lineId - The line item id
   */
  function onDeleteLineItem(lineId) {
    currentBillItems = currentBillItems.filter(function (li) {
      return li.id !== lineId;
    });
    renderBillItems();
    updateBillTotal();
  }

  // ─── Finalize Bill (5.8) ───────────────────────────────────────────────────

  /**
   * Finalize the current bill: generate bill number, save to DB, clear state.
   */
  async function onFinalizeBill() {
    if (currentBillItems.length === 0) {
      alert('Cannot finalize an empty bill. Please add items first.');
      return;
    }

    var billNumber = Utils.generateBillNumber();
    var now = new Date();
    var dateStr = now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0');
    var timeStr = String(now.getHours()).padStart(2, '0') + ':'
      + String(now.getMinutes()).padStart(2, '0') + ':'
      + String(now.getSeconds()).padStart(2, '0');

    var total = currentBillItems.reduce(function (sum, item) {
      return sum + item.lineTotal;
    }, 0);
    total = Math.round(total * 100) / 100;

    // Build line items for storage (strip internal fields)
    var lineItemsForStorage = currentBillItems.map(function (li) {
      return {
        itemId: li.itemId,
        itemName: li.itemName,
        quantityGrams: li.quantityGrams,
        pricePerKg: li.pricePerKg,
        lineTotal: li.lineTotal
      };
    });

    var bill = {
      id: Utils.generateId(),
      billNumber: billNumber,
      date: dateStr,
      time: timeStr,
      lineItems: lineItemsForStorage,
      total: total,
      createdAt: now.toISOString()
    };

    try {
      await DB.saveBill(bill);
      alert('Bill ' + billNumber + ' saved successfully!');

      // Show UPI payment QR if configured
      if (typeof Settings !== 'undefined' && Settings.showPaymentQR) {
        Settings.showPaymentQR(total, billNumber);
      }

      resetBillState();
    } catch (e) {
      console.error('Billing: Failed to save bill', e);
      alert('Error saving bill. Please try again.');
    }
  }

  // ─── State Reset ───────────────────────────────────────────────────────────

  /**
   * Reset the current bill state and UI.
   */
  function resetBillState() {
    currentBillItems = [];
    selectedItemId = null;
    selectedQuantityGrams = null;

    renderBillItems();
    updateBillTotal();

    // Full reset — clear item and quantity selections
    if (itemGrid) {
      itemGrid.querySelectorAll('.item-card').forEach(function (c) {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
    }
    qtyButtons.forEach(function (b) {
      b.classList.remove('active');
    });
    if (customQtyInput) {
      customQtyInput.value = '';
    }
  }

  // ─── Public API (used by VoiceEngine) ──────────────────────────────────────

  /**
   * Add an item to the current bill programmatically (used by voice engine).
   * If the item is not in the cached list, refreshes items from DB before adding.
   * @param {string} itemId - The item id
   * @param {number} quantityGrams - Quantity in grams
   */
  async function addItemById(itemId, quantityGrams) {
    var item = allItems.find(function (i) { return i.id === itemId; });
    if (!item) {
      // Item may have been added after billing was initialized; refresh from DB
      try {
        allItems = await DB.getAllItems();
        item = allItems.find(function (i) { return i.id === itemId; });
      } catch (e) {
        console.error('Billing.addItemById: Failed to refresh items', e);
      }
    }
    if (!item) {
      console.warn('Billing.addItemById: Item not found:', itemId);
      return;
    }
    addLineItem(item, quantityGrams);
  }

  /**
   * Refresh the item grid (called after item master changes).
   */
  async function refreshItems() {
    await loadItems();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    init: init,
    addItemById: addItemById,
    refreshItems: refreshItems
  };

})();
