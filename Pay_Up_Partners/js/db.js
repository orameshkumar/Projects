const DB = (function() {
  'use strict';
  const DB_NAME = 'PayUpPartners';
  const DB_VERSION = 1;
  let db = null;

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function init() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject(new Error('Failed to open database: ' + (e.target.error?.message || 'Unknown')));
      request.onsuccess = (e) => { db = e.target.result; resolve(db); };
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('clients')) {
          const cs = database.createObjectStore('clients', { keyPath: 'id' });
          cs.createIndex('name', 'name', { unique: true });
        }
        if (!database.objectStoreNames.contains('loans')) {
          const ls = database.createObjectStore('loans', { keyPath: 'id' });
          ls.createIndex('clientId', 'clientId', { unique: false });
          ls.createIndex('loanType', 'loanType', { unique: false });
        }
        if (!database.objectStoreNames.contains('payments')) {
          const ps = database.createObjectStore('payments', { keyPath: 'id' });
          ps.createIndex('loanId', 'loanId', { unique: false });
          ps.createIndex('date', 'date', { unique: false });
        }
      };
    });
  }

  function getStore(name, mode) {
    if (!db) throw new Error('Database not initialized');
    return db.transaction(name, mode).objectStore(name);
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(new Error(e.target.error?.message || 'DB operation failed'));
    });
  }

  function cursorCollect(store, indexName, keyRange) {
    return new Promise((resolve, reject) => {
      const results = [];
      const source = indexName ? store.index(indexName) : store;
      const req = keyRange ? source.openCursor(keyRange) : source.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else resolve(results);
      };
      req.onerror = (e) => reject(new Error(e.target.error?.message || 'Cursor failed'));
    });
  }

  // ─── Client CRUD ───
  function addClient(client) { return reqToPromise(getStore('clients', 'readwrite').add(client)); }
  function getClient(id) { return reqToPromise(getStore('clients', 'readonly').get(id)); }
  function getAllClients() { return reqToPromise(getStore('clients', 'readonly').getAll()); }
  function updateClient(client) { return reqToPromise(getStore('clients', 'readwrite').put(client)); }
  function deleteClient(id) { return reqToPromise(getStore('clients', 'readwrite').delete(id)); }

  // ─── Loan CRUD ───
  function addLoan(loan) { return reqToPromise(getStore('loans', 'readwrite').add(loan)); }
  function getLoan(id) { return reqToPromise(getStore('loans', 'readonly').get(id)); }
  function getAllLoans() { return reqToPromise(getStore('loans', 'readonly').getAll()); }
  function updateLoan(loan) { return reqToPromise(getStore('loans', 'readwrite').put(loan)); }
  function deleteLoan(id) { return reqToPromise(getStore('loans', 'readwrite').delete(id)); }

  function getLoansByClient(clientId) {
    const store = getStore('loans', 'readonly');
    return cursorCollect(store, 'clientId', IDBKeyRange.only(clientId));
  }

  // ─── Payment CRUD ───
  function addPayment(payment) { return reqToPromise(getStore('payments', 'readwrite').add(payment)); }
  function getAllPayments() { return reqToPromise(getStore('payments', 'readonly').getAll()); }
  function deletePayment(id) { return reqToPromise(getStore('payments', 'readwrite').delete(id)); }

  function getPaymentsByLoan(loanId) {
    const store = getStore('payments', 'readonly');
    return cursorCollect(store, 'loanId', IDBKeyRange.only(loanId));
  }

  function getPaymentsByDateRange(start, end) {
    const store = getStore('payments', 'readonly');
    return cursorCollect(store, 'date', IDBKeyRange.bound(start, end));
  }

  function deletePaymentsByLoan(loanId) {
    return new Promise((resolve, reject) => {
      const store = getStore('payments', 'readwrite');
      const index = store.index('loanId');
      const req = index.openCursor(IDBKeyRange.only(loanId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
        else resolve();
      };
      req.onerror = (e) => reject(new Error(e.target.error?.message || 'Delete payments failed'));
    });
  }

  // ─── Cascade Helpers ───
  async function deleteLoanCascade(loanId) {
    await deletePaymentsByLoan(loanId);
    await deleteLoan(loanId);
  }

  async function deleteLoansByClient(clientId) {
    const loans = await getLoansByClient(clientId);
    for (const loan of loans) {
      await deleteLoanCascade(loan.id);
    }
  }

  async function deleteClientCascade(clientId) {
    await deleteLoansByClient(clientId);
    await deleteClient(clientId);
  }

  return {
    init, generateId,
    addClient, getClient, getAllClients, updateClient, deleteClient,
    addLoan, getLoan, getLoansByClient, getAllLoans, updateLoan, deleteLoan,
    addPayment, getPaymentsByLoan, getPaymentsByDateRange, getAllPayments, deletePayment, deletePaymentsByLoan,
    deleteLoanCascade, deleteLoansByClient, deleteClientCascade
  };
})();
