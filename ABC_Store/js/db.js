/**
 * db.js - IndexedDB Wrapper for ABC Provisional Store
 * 
 * Provides a global DB object with methods for managing items and bills
 * using IndexedDB as the persistence layer.
 * 
 * Database: "ABCStore" (version 1)
 * Object Stores:
 *   - items: keyPath "id", indexes on "name" and "voiceTag"
 *   - bills: keyPath "id", indexes on "billNumber" and "date"
 */

const DB = (function () {
  const DB_NAME = 'ABCStore';
  const DB_VERSION = 1;
  let db = null;

  /**
   * Opens/creates the ABCStore database with required object stores and indexes.
   * @returns {Promise<IDBDatabase>}
   */
  function init() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open database: ' + request.error));
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        // Create "items" object store with keyPath "id"
        if (!database.objectStoreNames.contains('items')) {
          const itemsStore = database.createObjectStore('items', { keyPath: 'id' });
          itemsStore.createIndex('name', 'name', { unique: false });
          itemsStore.createIndex('voiceTag', 'voiceTag', { unique: false });
        }

        // Create "bills" object store with keyPath "id"
        if (!database.objectStoreNames.contains('bills')) {
          const billsStore = database.createObjectStore('bills', { keyPath: 'id' });
          billsStore.createIndex('billNumber', 'billNumber', { unique: true });
          billsStore.createIndex('date', 'date', { unique: false });
        }
      };
    });
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  /**
   * Returns a promise-based transaction helper for a given store and mode.
   */
  function getStore(storeName, mode) {
    if (!db) {
      throw new Error('Database not initialized. Call DB.init() first.');
    }
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  /**
   * Wraps an IDBRequest in a Promise.
   */
  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ─── Item CRUD Methods ─────────────────────────────────────────────────────

  /**
   * Add a new item to the items store.
   * @param {Object} item - Item object with id, name, basePricePerKg, etc.
   * @returns {Promise<string>} The key of the added item
   */
  function addItem(item) {
    const store = getStore('items', 'readwrite');
    return requestToPromise(store.add(item));
  }

  /**
   * Get a single item by its id.
   * @param {string} id - The item id
   * @returns {Promise<Object|undefined>} The item object or undefined if not found
   */
  function getItem(id) {
    const store = getStore('items', 'readonly');
    return requestToPromise(store.get(id));
  }

  /**
   * Get all items from the items store.
   * @returns {Promise<Object[]>} Array of all item objects
   */
  function getAllItems() {
    const store = getStore('items', 'readonly');
    return requestToPromise(store.getAll());
  }

  /**
   * Update an existing item (put operation - replaces the item with the same id).
   * @param {Object} item - Item object with id and updated fields
   * @returns {Promise<string>} The key of the updated item
   */
  function updateItem(item) {
    const store = getStore('items', 'readwrite');
    return requestToPromise(store.put(item));
  }

  /**
   * Delete an item by its id.
   * @param {string} id - The item id to delete
   * @returns {Promise<undefined>}
   */
  function deleteItem(id) {
    const store = getStore('items', 'readwrite');
    return requestToPromise(store.delete(id));
  }

  // ─── Bill Methods ──────────────────────────────────────────────────────────

  /**
   * Save a bill to the bills store.
   * @param {Object} bill - Bill object with id, billNumber, date, lineItems, total, etc.
   * @returns {Promise<string>} The key of the saved bill
   */
  function saveBill(bill) {
    const store = getStore('bills', 'readwrite');
    return requestToPromise(store.put(bill));
  }

  /**
   * Get a single bill by its id.
   * @param {string} id - The bill id
   * @returns {Promise<Object|undefined>} The bill object or undefined if not found
   */
  function getBill(id) {
    const store = getStore('bills', 'readonly');
    return requestToPromise(store.get(id));
  }

  /**
   * Get all bills sorted by date descending (most recent first).
   * @returns {Promise<Object[]>} Array of all bill objects sorted by date desc
   */
  function getAllBills() {
    return new Promise((resolve, reject) => {
      const store = getStore('bills', 'readonly');
      const index = store.index('date');
      const request = index.openCursor(null, 'prev');
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get bills within a date range (inclusive on both ends).
   * @param {string} startDate - ISO date string (e.g., "2025-01-01")
   * @param {string} endDate - ISO date string (e.g., "2025-01-31")
   * @returns {Promise<Object[]>} Array of bill objects within the date range, sorted by date desc
   */
  function getBillsByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const store = getStore('bills', 'readonly');
      const index = store.index('date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.openCursor(range, 'prev');
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    init,
    addItem,
    getItem,
    getAllItems,
    updateItem,
    deleteItem,
    saveBill,
    getBill,
    getAllBills,
    getBillsByDateRange
  };
})();
