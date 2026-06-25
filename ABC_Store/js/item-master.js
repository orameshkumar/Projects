/**
 * item-master.js - Item Master Module for ABC Provisional Store
 *
 * Manages the item catalog: listing, adding, editing items with
 * name, base price per KG, voice tag, and camera image capture.
 *
 * Depends on: DB (db.js), Utils (utils.js)
 */

const ItemMaster = (function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────────────

  let allItems = [];
  let editingItemId = null;
  let capturedImageBase64 = null;
  let modalOverlay = null;

  // ─── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the Item Master module.
   * Sets up event listeners and loads items from DB.
   */
  function init() {
    const addBtn = document.getElementById('add-item-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        openModal(null);
      });
    }

    // Add search input above the item list
    _injectSearchBar();

    // Load and render items
    loadAndRenderItems();
  }

  // ─── Search Bar ─────────────────────────────────────────────────────────────

  /**
   * Injects a search input above the item list if not already present.
   */
  function _injectSearchBar() {
    const itemListContainer = document.getElementById('item-list');
    if (!itemListContainer) return;

    // Check if search bar already exists
    if (document.getElementById('item-search-input')) return;

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.id = 'item-search-input';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Search items...';
    searchInput.setAttribute('aria-label', 'Search items');

    // Insert before the item list
    itemListContainer.parentNode.insertBefore(searchInput, itemListContainer);

    searchInput.addEventListener('input', function () {
      const query = searchInput.value.trim().toLowerCase();
      _filterAndRenderItems(query);
    });
  }

  // ─── Item List Rendering (Task 4.1 & 4.6) ──────────────────────────────────

  /**
   * Load all items from DB and render the list.
   */
  async function loadAndRenderItems() {
    try {
      allItems = await DB.getAllItems();
    } catch (error) {
      console.error('Failed to load items:', error);
      allItems = [];
    }
    _renderItemList(allItems);
  }

  /**
   * Filter items by name and render.
   * @param {string} query - Lowercase search query
   */
  function _filterAndRenderItems(query) {
    if (!query) {
      _renderItemList(allItems);
      return;
    }
    const filtered = allItems.filter(function (item) {
      return item.name.toLowerCase().indexOf(query) !== -1;
    });
    _renderItemList(filtered);
  }

  /**
   * Renders the given list of items into #item-list.
   * Each item card shows: 64x64 thumbnail, name, price/KG, edit button.
   * @param {Array} items - Array of item objects to render
   */
  function _renderItemList(items) {
    const container = document.getElementById('item-list');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-state-icon">📦</span>' +
          '<span class="empty-state-text">No items yet. Tap + to add your first item.</span>' +
        '</div>';
      return;
    }

    var html = '';
    items.forEach(function (item) {
      var thumbHtml;
      if (item.imageBase64) {
        thumbHtml = '<img src="' + item.imageBase64 + '" alt="' + _escapeHtml(item.name) + '" class="item-thumb" width="64" height="64">';
      } else {
        thumbHtml = '<div class="item-thumb" style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:#e8eaed;border-radius:4px;">📷</div>';
      }

      html +=
        '<div class="item-card" data-item-id="' + item.id + '">' +
          thumbHtml +
          '<div class="item-info">' +
            '<div class="item-name">' + _escapeHtml(item.name) + '</div>' +
            '<div class="item-price" style="font-size:0.7rem;color:#5f6368;">' + _escapeHtml(item.itemCode || '') + ' | ₹' + Number(item.basePricePerKg).toFixed(2) + '/' + _unitLabel(item.baseUnit) + '</div>' +
          '</div>' +
          '<button class="item-edit-btn" data-item-id="' + item.id + '" aria-label="Edit ' + _escapeHtml(item.name) + '">✏️</button>' +
          '<button class="item-delete-btn" data-item-id="' + item.id + '" aria-label="Delete ' + _escapeHtml(item.name) + '">🗑️</button>' +
        '</div>';
    });

    container.innerHTML = html;

    // Attach edit button listeners
    var editBtns = container.querySelectorAll('.item-edit-btn');
    editBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var itemId = btn.getAttribute('data-item-id');
        var item = allItems.find(function (i) { return i.id === itemId; });
        if (item) {
          openModal(item);
        }
      });
    });

    // Attach delete button listeners
    var deleteBtns = container.querySelectorAll('.item-delete-btn');
    deleteBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var itemId = btn.getAttribute('data-item-id');
        var item = allItems.find(function (i) { return i.id === itemId; });
        if (item) {
          _handleDeleteItem(item);
        }
      });
    });
  }

  // ─── Add/Edit Modal (Task 4.2) ─────────────────────────────────────────────

  /**
   * Opens the add/edit item modal.
   * @param {Object|null} item - Existing item to edit, or null for new item
   */
  function openModal(item) {
    editingItemId = item ? item.id : null;
    capturedImageBase64 = item ? (item.imageBase64 || null) : null;

    // Remove existing modal if any
    _removeModal();

    // Create modal overlay
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'item-modal-overlay';

    var title = item ? 'Edit Item' : 'Add Item';
    var nameVal = item ? _escapeAttr(item.name) : '';
    var itemCodeVal = item ? _escapeAttr(item.itemCode || '') : _generateItemCode();
    var priceVal = item ? item.basePricePerKg : '';
    var voiceTagVal = item ? _escapeAttr(item.voiceTag || '') : '';
    var baseUnit = item ? (item.baseUnit || 'kg') : 'kg';

    var imagePreviewHtml;
    if (capturedImageBase64) {
      imagePreviewHtml = '<img id="item-image-preview" src="' + capturedImageBase64 + '" alt="Item image preview" style="width:80px;height:80px;object-fit:cover;border-radius:4px;margin-top:8px;">';
    } else {
      imagePreviewHtml = '<div id="item-image-preview" style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:#e8eaed;border-radius:4px;margin-top:8px;font-size:1.5rem;color:#5f6368;">📷</div>';
    }

    var priceLabel = baseUnit === 'count' ? 'Price per Unit (₹) *' : (baseUnit === 'litre' ? 'Base Price per Litre (₹) *' : 'Base Price per KG (₹) *');

    modalOverlay.innerHTML =
      '<div class="modal" role="dialog" aria-labelledby="item-modal-title" aria-modal="true">' +
        '<div class="modal-header">' +
          '<h2 class="modal-title" id="item-modal-title">' + title + '</h2>' +
          '<button class="modal-close" id="item-modal-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label for="item-name-input">Item Name *</label>' +
            '<input type="text" id="item-name-input" placeholder="Enter item name" value="' + nameVal + '" autocomplete="off">' +
            '<span id="item-name-error" style="color:#ea4335;font-size:0.75rem;display:none;margin-top:4px;">Item name is required</span>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="item-code-input">Item Code (unique, auto-generated)</label>' +
            '<input type="text" id="item-code-input" placeholder="e.g., ITM001" value="' + itemCodeVal + '" autocomplete="off">' +
            '<span id="item-code-error" style="color:#ea4335;font-size:0.75rem;display:none;margin-top:4px;"></span>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="item-unit-select">Base Unit *</label>' +
            '<select id="item-unit-select" style="width:100%;padding:10px 12px;border:1.5px solid #dadce0;border-radius:8px;font-size:0.875rem;min-height:44px;background:#fff;">' +
              '<option value="kg"' + (baseUnit === 'kg' ? ' selected' : '') + '>Kilogram (KG)</option>' +
              '<option value="litre"' + (baseUnit === 'litre' ? ' selected' : '') + '>Litre (L)</option>' +
              '<option value="count"' + (baseUnit === 'count' ? ' selected' : '') + '>Count (Nos)</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="item-price-input" id="item-price-label">' + priceLabel + '</label>' +
            '<input type="number" id="item-price-input" placeholder="Enter price" value="' + priceVal + '" min="0" step="0.01">' +
            '<span id="item-price-error" style="color:#ea4335;font-size:0.75rem;display:none;margin-top:4px;">Base price is required</span>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="item-voicetag-input">Voice Tag</label>' +
            '<input type="text" id="item-voicetag-input" placeholder="Enter voice tag (e.g., rice)" value="' + voiceTagVal + '" autocomplete="off">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Item Image</label>' +
            '<button type="button" id="item-capture-btn" class="btn-secondary" style="width:100%;margin-top:4px;">📸 Capture Image</button>' +
            '<input type="file" id="item-image-file-input" accept="image/*" capture="environment" style="display:none;">' +
            '<div id="item-camera-message" style="color:#ea4335;font-size:0.75rem;display:none;margin-top:4px;"></div>' +
            imagePreviewHtml +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn-secondary" id="item-modal-cancel">Cancel</button>' +
          '<button class="btn-primary" id="item-modal-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modalOverlay);

    // Trigger active state after render for animation
    requestAnimationFrame(function () {
      modalOverlay.classList.add('active');
    });

    // Attach modal event listeners
    _setupModalListeners();

    // Focus name input
    setTimeout(function () {
      var nameInput = document.getElementById('item-name-input');
      if (nameInput) nameInput.focus();
    }, 350);
  }

  /**
   * Sets up event listeners on modal buttons and inputs.
   */
  function _setupModalListeners() {
    var closeBtn = document.getElementById('item-modal-close');
    var cancelBtn = document.getElementById('item-modal-cancel');
    var saveBtn = document.getElementById('item-modal-save');
    var captureBtn = document.getElementById('item-capture-btn');
    var fileInput = document.getElementById('item-image-file-input');
    var unitSelect = document.getElementById('item-unit-select');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeModal);
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', _handleSave);
    }
    if (captureBtn) {
      captureBtn.addEventListener('click', _handleCaptureClick);
    }
    if (fileInput) {
      fileInput.addEventListener('change', _handleFileSelected);
    }
    if (unitSelect) {
      unitSelect.addEventListener('change', function () {
        var label = document.getElementById('item-price-label');
        if (!label) return;
        var unit = unitSelect.value;
        if (unit === 'count') label.textContent = 'Price per Unit (₹) *';
        else if (unit === 'litre') label.textContent = 'Base Price per Litre (₹) *';
        else label.textContent = 'Base Price per KG (₹) *';
      });
    }

    // Close on overlay background click
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) {
          closeModal();
        }
      });
    }
  }

  /**
   * Closes and removes the modal from the DOM.
   */
  function closeModal() {
    if (modalOverlay) {
      modalOverlay.classList.remove('active');
      setTimeout(function () {
        _removeModal();
      }, 300);
    }
  }

  /**
   * Removes the modal element from DOM.
   */
  function _removeModal() {
    var existing = document.getElementById('item-modal-overlay');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }
    modalOverlay = null;
  }

  // ─── Camera Capture (Task 4.3) ──────────────────────────────────────────────

  /**
   * Handles the capture button click.
   * Uses file input with capture attribute for mobile camera access.
   * Falls back to plain file selection if camera is unavailable.
   */
  function _handleCaptureClick() {
    var fileInput = document.getElementById('item-image-file-input');
    var messageEl = document.getElementById('item-camera-message');

    if (!fileInput) return;

    // Check if MediaDevices API is available (indicates camera support)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Show fallback message but still allow file selection
      if (messageEl) {
        messageEl.textContent = 'Camera access is not supported on this device. You can select an image file instead.';
        messageEl.style.display = 'block';
      }
      // Remove capture attribute to allow file browsing
      fileInput.removeAttribute('capture');
    } else {
      // Camera likely available, ensure capture attribute is set
      fileInput.setAttribute('capture', 'environment');
      if (messageEl) {
        messageEl.style.display = 'none';
      }
    }

    // Trigger file input
    fileInput.click();
  }

  /**
   * Handles the file/image selected from camera or file picker.
   * @param {Event} event - The change event from the file input
   */
  function _handleFileSelected(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      var messageEl = document.getElementById('item-camera-message');
      if (messageEl) {
        messageEl.textContent = 'Please select a valid image file.';
        messageEl.style.display = 'block';
      }
      return;
    }

    // Compress image
    _compressImage(file, function (base64) {
      capturedImageBase64 = base64;
      _updateImagePreview(base64);
    });
  }

  // ─── Image Compression (Task 4.4) ──────────────────────────────────────────

  /**
   * Compresses an image file using Canvas API.
   * Resizes to max 200x200, exports as JPEG quality 0.6, returns Base64.
   * @param {File} file - The image file to compress
   * @param {Function} callback - Called with the Base64 string result
   */
  function _compressImage(file, callback) {
    var reader = new FileReader();

    reader.onload = function (e) {
      var img = new Image();

      img.onload = function () {
        var maxSize = 200;
        var width = img.width;
        var height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }

        // Draw to canvas
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with quality 0.6
        var base64 = canvas.toDataURL('image/jpeg', 0.6);
        callback(base64);
      };

      img.onerror = function () {
        console.error('Failed to load image for compression');
        var messageEl = document.getElementById('item-camera-message');
        if (messageEl) {
          messageEl.textContent = 'Failed to process image. Please try again.';
          messageEl.style.display = 'block';
        }
      };

      img.src = e.target.result;
    };

    reader.onerror = function () {
      console.error('Failed to read image file');
    };

    reader.readAsDataURL(file);
  }

  /**
   * Updates the image preview in the modal.
   * @param {string} base64 - Base64 image data URL
   */
  function _updateImagePreview(base64) {
    var previewEl = document.getElementById('item-image-preview');
    if (!previewEl) return;

    if (previewEl.tagName === 'IMG') {
      previewEl.src = base64;
    } else {
      // Replace placeholder div with an img
      var img = document.createElement('img');
      img.id = 'item-image-preview';
      img.src = base64;
      img.alt = 'Item image preview';
      img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:4px;margin-top:8px;';
      previewEl.parentNode.replaceChild(img, previewEl);
    }
  }

  // ─── Item Save/Update (Task 4.5) ───────────────────────────────────────────

  /**
   * Handles the Save button click in the modal.
   * Validates required fields and saves/updates the item.
   */
  async function _handleSave() {
    var nameInput = document.getElementById('item-name-input');
    var itemCodeInput = document.getElementById('item-code-input');
    var priceInput = document.getElementById('item-price-input');
    var voiceTagInput = document.getElementById('item-voicetag-input');
    var unitSelect = document.getElementById('item-unit-select');
    var nameError = document.getElementById('item-name-error');
    var codeError = document.getElementById('item-code-error');
    var priceError = document.getElementById('item-price-error');

    var name = nameInput ? nameInput.value.trim() : '';
    var itemCode = itemCodeInput ? itemCodeInput.value.trim().toUpperCase() : '';
    var price = priceInput ? parseFloat(priceInput.value) : NaN;
    var voiceTag = voiceTagInput ? voiceTagInput.value.trim() : '';
    var baseUnit = unitSelect ? unitSelect.value : 'kg';

    // Reset errors
    if (nameError) nameError.style.display = 'none';
    if (codeError) codeError.style.display = 'none';
    if (priceError) priceError.style.display = 'none';

    // Validate
    var valid = true;

    if (!name) {
      if (nameError) nameError.style.display = 'block';
      valid = false;
    }

    if (!itemCode) {
      if (codeError) { codeError.textContent = 'Item code is required'; codeError.style.display = 'block'; }
      valid = false;
    }

    if (isNaN(price) || price <= 0 || priceInput.value.trim() === '') {
      if (priceError) priceError.style.display = 'block';
      valid = false;
    }

    if (!valid) return;

    // Check uniqueness of item code
    var duplicateItem = allItems.find(function (i) {
      return i.itemCode && i.itemCode.toUpperCase() === itemCode && i.id !== editingItemId;
    });
    if (duplicateItem) {
      if (codeError) { codeError.textContent = 'Item code "' + itemCode + '" already exists (' + duplicateItem.name + ')'; codeError.style.display = 'block'; }
      return;
    }

    var now = new Date().toISOString();

    try {
      if (editingItemId) {
        // Check if item code changed — update bills if so
        var existingItem = allItems.find(function (i) { return i.id === editingItemId; });
        var oldCode = existingItem ? (existingItem.itemCode || '') : '';

        var updatedItem = {
          id: editingItemId,
          name: name,
          itemCode: itemCode,
          basePricePerKg: price,
          baseUnit: baseUnit,
          voiceTag: voiceTag,
          imageBase64: capturedImageBase64 || (existingItem ? existingItem.imageBase64 : null),
          createdAt: existingItem ? existingItem.createdAt : now,
          updatedAt: now
        };
        await DB.updateItem(updatedItem);

        // If item code changed, update all bills referencing this item
        if (oldCode && oldCode !== itemCode) {
          await _updateBillsItemCode(editingItemId, name, itemCode);
        }
      } else {
        // Add new item
        var newItem = {
          id: Utils.generateId(),
          name: name,
          itemCode: itemCode,
          basePricePerKg: price,
          baseUnit: baseUnit,
          voiceTag: voiceTag,
          imageBase64: capturedImageBase64 || null,
          createdAt: now,
          updatedAt: now
        };
        await DB.addItem(newItem);
      }

      // Close modal and refresh list
      closeModal();
      await loadAndRenderItems();
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Failed to save item. Please try again.');
    }
  }

  // ─── Item Code Helpers ────────────────────────────────────────────────────────

  /**
   * Generate a unique item code. Format: ITM + 3-digit sequential number.
   * Scans existing items to find the next available number.
   * @returns {string} Generated item code e.g., "ITM001"
   */
  function _generateItemCode() {
    var maxNum = 0;
    allItems.forEach(function (item) {
      if (item.itemCode) {
        var match = item.itemCode.match(/^ITM(\d+)$/i);
        if (match) {
          var num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    return 'ITM' + String(maxNum + 1).padStart(3, '0');
  }

  /**
   * Update all bills that reference an item when its code changes.
   * @param {string} itemId - The item's internal ID
   * @param {string} newName - New item name
   * @param {string} newCode - New item code
   */
  async function _updateBillsItemCode(itemId, newName, newCode) {
    try {
      var bills = await DB.getAllBills();
      for (var i = 0; i < bills.length; i++) {
        var bill = bills[i];
        var updated = false;
        if (bill.lineItems) {
          bill.lineItems.forEach(function (li) {
            if (li.itemId === itemId) {
              li.itemName = newName;
              li.itemCode = newCode;
              updated = true;
            }
          });
        }
        if (updated) {
          await DB.saveBill(bill);
        }
      }
    } catch (e) {
      console.error('Failed to update bills with new item code:', e);
    }
  }

  // ─── Delete Item ─────────────────────────────────────────────────────────────

  /**
   * Returns display label for base unit.
   * @param {string} unit - 'kg', 'litre', or 'count'
   * @returns {string} Display label
   */
  function _unitLabel(unit) {
    if (unit === 'litre') return 'L';
    if (unit === 'count') return 'Nos';
    return 'KG';
  }

  /**
   * Handles deleting an item after user confirmation.
   * @param {Object} item - The item object to delete
   */
  async function _handleDeleteItem(item) {
    var confirmed = confirm('Delete "' + item.name + '"? This cannot be undone.');
    if (!confirmed) return;

    try {
      await DB.deleteItem(item.id);
      await loadAndRenderItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item. Please try again.');
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /**
   * Escapes HTML special characters to prevent XSS.
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Escapes string for use in HTML attribute values.
   * @param {string} str - String to escape
   * @returns {string} Escaped string safe for attributes
   */
  function _escapeAttr(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    init: init,
    loadAndRenderItems: loadAndRenderItems,
    openModal: openModal,
    closeModal: closeModal
  };

})();
