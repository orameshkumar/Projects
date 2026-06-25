/**
 * db.js - IndexedDB Wrapper for Debt Collection App
 *
 * Provides a global DB object with methods for managing clients and payments
 * using IndexedDB as the persistence layer.
 *
 * Database: "CollectionApp" (version 2)
 * Object Stores:
 *   - clients: keyPath "id", indexes on "name" (unique), "mobile" (non-unique), "loanType" (non-unique)
 *   - payments: keyPath "id", indexes on "clientId" (non-unique) and "date" (non-unique)
 *
 * Migration v1→v2:
 *   - Adds loanType index to clients store
 *   - Adds loanType, interestRate, principalBalance fields to existing client records
 *   - Adds paymentType field to existing payment records
 */

const DB = (function () {
  const DB_NAME = 'CollectionApp';
  const DB_VERSION = 2;
  let db = null;

  /**
   * Opens/creates the CollectionApp database with required object stores and indexes.
   * @returns {Promise<IDBDatabase>}
   */
  function init() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        const error = event.target.error;
        if (error && error.name === 'QuotaExceededError') {
          reject(new Error('Device storage is full. Please free space to continue.'));
        } else {
          reject(new Error('Failed to open database: ' + (error ? error.message : 'Unknown error')));
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        // Create "clients" object store with keyPath "id"
        if (!database.objectStoreNames.contains('clients')) {
          const clientsStore = database.createObjectStore('clients', { keyPath: 'id' });
          clientsStore.createIndex('name', 'name', { unique: true });
          clientsStore.createIndex('mobile', 'mobile', { unique: false });
        }

        // Create "payments" object store with keyPath "id"
        if (!database.objectStoreNames.contains('payments')) {
          const paymentsStore = database.createObjectStore('payments', { keyPath: 'id' });
          paymentsStore.createIndex('clientId', 'clientId', { unique: false });
          paymentsStore.createIndex('date', 'date', { unique: false });
        }

        // Version 1 → 2 migration: add loanType support
        if (event.oldVersion < 2) {
          // Add loanType index to clients store
          const clientsStore = event.target.transaction.objectStore('clients');
          if (!clientsStore.indexNames.contains('loanType')) {
            clientsStore.createIndex('loanType', 'loanType', { unique: false });
          }

          // Migrate existing clients: add loanType, interestRate, principalBalance
          const clientCursor = clientsStore.openCursor();
          clientCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const record = cursor.value;
              record.loanType = record.loanType || 'daily_emi';
              record.interestRate = record.interestRate || null;
              record.principalBalance = record.principalBalance || null;
              cursor.update(record);
              cursor.continue();
            }
          };

          // Migrate existing payments: add paymentType
          const paymentsStore = event.target.transaction.objectStore('payments');
          const paymentCursor = paymentsStore.openCursor();
          paymentCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const record = cursor.value;
              record.paymentType = record.paymentType || 'emi';
              cursor.update(record);
              cursor.continue();
            }
          };
        }
      };
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Returns an object store for a given store name and mode.
   * @param {string} storeName - Name of the object store
   * @param {string} mode - Transaction mode: "readonly" or "readwrite"
   * @returns {IDBObjectStore}
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
   * @param {IDBRequest} request - The IndexedDB request to wrap
   * @returns {Promise}
   */
  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => {
        const error = event.target.error;
        if (error && error.name === 'QuotaExceededError') {
          reject(new Error('Device storage is full. Please free space to continue.'));
        } else {
          reject(new Error(error ? error.message : 'Database operation failed'));
        }
      };
    });
  }

  // ─── Client CRUD Methods ───────────────────────────────────────────────────

  /**
   * Add a new client record to the clients store.
   * @param {Object} client - Client object with id, name, mobile, totalAmount, etc.
   * @returns {Promise<string>} The key of the added client
   */
  function addClient(client) {
    try {
      const store = getStore('clients', 'readwrite');
      return requestToPromise(store.add(client));
    } catch (e) {
      return Promise.reject(new Error('Failed to add client: ' + e.message));
    }
  }

  /**
   * Get a single client by its id.
   * @param {string} id - The client id
   * @returns {Promise<Object|undefined>} The client object or undefined if not found
   */
  function getClient(id) {
    try {
      const store = getStore('clients', 'readonly');
      return requestToPromise(store.get(id));
    } catch (e) {
      return Promise.reject(new Error('Failed to get client: ' + e.message));
    }
  }

  /**
   * Get all clients from the clients store.
   * @returns {Promise<Object[]>} Array of all client objects
   */
  function getAllClients() {
    try {
      const store = getStore('clients', 'readonly');
      return requestToPromise(store.getAll());
    } catch (e) {
      return Promise.reject(new Error('Failed to get all clients: ' + e.message));
    }
  }

  /**
   * Update an existing client record (put operation).
   * @param {Object} client - Client object with id and updated fields
   * @returns {Promise<string>} The key of the updated client
   */
  function updateClient(client) {
    try {
      const store = getStore('clients', 'readwrite');
      return requestToPromise(store.put(client));
    } catch (e) {
      return Promise.reject(new Error('Failed to update client: ' + e.message));
    }
  }

  /**
   * Delete a client by its id.
   * @param {string} id - The client id to delete
   * @returns {Promise<undefined>}
   */
  function deleteClient(id) {
    try {
      const store = getStore('clients', 'readwrite');
      return requestToPromise(store.delete(id));
    } catch (e) {
      return Promise.reject(new Error('Failed to delete client: ' + e.message));
    }
  }

  // ─── Payment Methods ───────────────────────────────────────────────────────

  /**
   * Add a payment record to the payments store.
   * @param {Object} payment - Payment object with id, clientId, date, amount, createdAt
   * @returns {Promise<string>} The key of the added payment
   */
  function addPayment(payment) {
    try {
      const store = getStore('payments', 'readwrite');
      return requestToPromise(store.add(payment));
    } catch (e) {
      return Promise.reject(new Error('Failed to add payment: ' + e.message));
    }
  }

  /**
   * Get all payments for a given client using the clientId index.
   * @param {string} clientId - The client id to query payments for
   * @returns {Promise<Object[]>} Array of payment objects for the client
   */
  function getPaymentsByClient(clientId) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('payments', 'readonly');
        const index = store.index('clientId');
        const range = IDBKeyRange.only(clientId);
        const request = index.openCursor(range);
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

        request.onerror = (event) => {
          const error = event.target.error;
          reject(new Error('Failed to get payments for client: ' + (error ? error.message : 'Unknown error')));
        };
      } catch (e) {
        reject(new Error('Failed to get payments for client: ' + e.message));
      }
    });
  }

  /**
   * Get all payments within a date range (inclusive) using the date index.
   * @param {string} start - ISO date string for range start (e.g., "2025-01-01")
   * @param {string} end - ISO date string for range end (e.g., "2025-01-31")
   * @returns {Promise<Object[]>} Array of payment objects within the date range
   */
  function getPaymentsByDateRange(start, end) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('payments', 'readonly');
        const index = store.index('date');
        const range = IDBKeyRange.bound(start, end);
        const request = index.openCursor(range);
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

        request.onerror = (event) => {
          const error = event.target.error;
          reject(new Error('Failed to get payments by date range: ' + (error ? error.message : 'Unknown error')));
        };
      } catch (e) {
        reject(new Error('Failed to get payments by date range: ' + e.message));
      }
    });
  }

  /**
   * Get all payments for a specific client on a specific date.
   * @param {string} clientId - The client id
   * @param {string} date - ISO date string (e.g., "2025-01-15")
   * @returns {Promise<Object[]>} Array of payment objects matching clientId and date
   */
  function getPaymentsByClientAndDate(clientId, date) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('payments', 'readonly');
        const index = store.index('clientId');
        const range = IDBKeyRange.only(clientId);
        const request = index.openCursor(range);
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            if (cursor.value.date === date) {
              results.push(cursor.value);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(new Error('Failed to get payments for client and date: ' + (error ? error.message : 'Unknown error')));
        };
      } catch (e) {
        reject(new Error('Failed to get payments for client and date: ' + e.message));
      }
    });
  }

  /**
   * Delete all payments for a given client using the clientId index.
   * @param {string} clientId - The client id whose payments to delete
   * @returns {Promise<undefined>}
   */
  function deletePaymentsByClient(clientId) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('payments', 'readwrite');
        const index = store.index('clientId');
        const range = IDBKeyRange.only(clientId);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = (event) => {
          const error = event.target.error;
          if (error && error.name === 'QuotaExceededError') {
            reject(new Error('Device storage is full. Please free space to continue.'));
          } else {
            reject(new Error('Failed to delete payments for client: ' + (error ? error.message : 'Unknown error')));
          }
        };
      } catch (e) {
        reject(new Error('Failed to delete payments for client: ' + e.message));
      }
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Update the principalBalance field on a client record.
   * @param {string} clientId - The client id
   * @param {number} newBalance - The new principal balance value
   * @returns {Promise<void>}
   */
  function updateClientPrincipalBalance(clientId, newBalance) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('clients', 'readwrite');
        const getRequest = store.get(clientId);

        getRequest.onsuccess = () => {
          const client = getRequest.result;
          if (!client) {
            reject(new Error('Client not found: ' + clientId));
            return;
          }
          client.principalBalance = newBalance;
          const putRequest = store.put(client);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = (event) => {
            const error = event.target.error;
            reject(new Error('Failed to update principal balance: ' + (error ? error.message : 'Unknown error')));
          };
        };

        getRequest.onerror = (event) => {
          const error = event.target.error;
          reject(new Error('Failed to read client for balance update: ' + (error ? error.message : 'Unknown error')));
        };
      } catch (e) {
        reject(new Error('Failed to update principal balance: ' + e.message));
      }
    });
  }

  /**
   * Delete a single payment by ID.
   * @param {string} id - The payment ID to delete
   * @returns {Promise<undefined>}
   */
  function deletePayment(id) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('payments', 'readwrite');
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(new Error('Failed to delete payment: ' + (error ? error.message : 'Unknown error')));
        };
      } catch (e) {
        reject(new Error('Failed to delete payment: ' + e.message));
      }
    });
  }

  return {
    init,
    addClient,
    getClient,
    getAllClients,
    updateClient,
    deleteClient,
    addPayment,
    deletePayment,
    getPaymentsByClient,
    getPaymentsByDateRange,
    getPaymentsByClientAndDate,
    deletePaymentsByClient,
    updateClientPrincipalBalance
  };
})();
