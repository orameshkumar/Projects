const WhatsApp = (function() {
  'use strict';

  // ─── localStorage Keys ───
  var KEYS = {
    TPL_CONFIRM: 'pup_wa_tpl_confirm',
    TPL_REMINDER: 'pup_wa_tpl_reminder',
    TOGGLE_DAILY_EMI: 'pup_wa_toggle_daily_emi',
    TOGGLE_INTEREST_ONLY: 'pup_wa_toggle_interest_only',
    TIMING: 'pup_wa_timing'
  };

  // ─── Defaults ───
  var DEFAULTS = {
    TPL_CONFIRM: 'Hi {clientName}, payment of ₹{amount} received on {date}. Loan amount: ₹{loanAmount}. Pending: ₹{pending}. Thank you!',
    TPL_REMINDER: 'Hi {clientName}, this is your {reminderNumber} reminder for the month. Your pending amount is ₹{pending} on loan of ₹{loanAmount}. Please pay at the earliest.',
    TOGGLE_DAILY_EMI: '0',
    TOGGLE_INTEREST_ONLY: '1',
    TIMING: [1, 3]
  };

  // ─── Utility: localStorage helpers ───
  function lsGet(key, def) {
    try { return localStorage.getItem(key) || def; } catch (e) { return def; }
  }

  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }

  // ─── formatOrdinal(n) ───
  function formatOrdinal(n) {
    var num = Math.floor(n);
    if (num <= 0) return String(num);
    var mod100 = num % 100;
    var mod10 = num % 10;
    if (mod100 === 11 || mod100 === 12 || mod100 === 13) {
      return num + 'th';
    }
    if (mod10 === 1) return num + 'st';
    if (mod10 === 2) return num + 'nd';
    if (mod10 === 3) return num + 'rd';
    return num + 'th';
  }

  // ─── formatDateDDMMYYYY(isoDate) ───
  function formatDateDDMMYYYY(isoDate) {
    if (!isoDate) return '';
    var parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  // ─── processTemplate(template, variables) ───
  function processTemplate(template, variables) {
    if (!template) return '';
    if (!variables) return template;
    return template.replace(/\{(\w+)\}/g, function(match, key) {
      return variables.hasOwnProperty(key) ? String(variables[key]) : match;
    });
  }

  // ─── buildWhatsAppURL(mobile, message) ───
  function buildWhatsAppURL(mobile, message) {
    return 'https://wa.me/91' + mobile + '?text=' + encodeURIComponent(message);
  }

  // ─── isValidMobile(mobile) ───
  function isValidMobile(mobile) {
    return /^\d{10}$/.test(mobile);
  }

  // ─── Toggle persistence ───
  function getConfirmToggle(loanType) {
    var key = (loanType === 'daily_emi') ? KEYS.TOGGLE_DAILY_EMI : KEYS.TOGGLE_INTEREST_ONLY;
    var def = (loanType === 'daily_emi') ? DEFAULTS.TOGGLE_DAILY_EMI : DEFAULTS.TOGGLE_INTEREST_ONLY;
    return lsGet(key, def) === '1';
  }

  function setConfirmToggle(loanType, enabled) {
    var key = (loanType === 'daily_emi') ? KEYS.TOGGLE_DAILY_EMI : KEYS.TOGGLE_INTEREST_ONLY;
    lsSet(key, enabled ? '1' : '0');
  }

  // ─── Reminder timing ───
  function getReminderTiming() {
    var raw = lsGet(KEYS.TIMING, '');
    if (!raw) return DEFAULTS.TIMING.slice();
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return DEFAULTS.TIMING.slice();
    } catch (e) {
      return DEFAULTS.TIMING.slice();
    }
  }

  function setReminderTiming(days) {
    lsSet(KEYS.TIMING, JSON.stringify(days));
  }

  // ─── Template persistence ───
  function getConfirmationTemplate() {
    return lsGet(KEYS.TPL_CONFIRM, '') || DEFAULTS.TPL_CONFIRM;
  }

  function getReminderTemplate() {
    return lsGet(KEYS.TPL_REMINDER, '') || DEFAULTS.TPL_REMINDER;
  }

  function saveTemplates(confirmTpl, reminderTpl) {
    var c = (confirmTpl && confirmTpl.trim()) ? confirmTpl.trim() : DEFAULTS.TPL_CONFIRM;
    var r = (reminderTpl && reminderTpl.trim()) ? reminderTpl.trim() : DEFAULTS.TPL_REMINDER;
    lsSet(KEYS.TPL_CONFIRM, c);
    lsSet(KEYS.TPL_REMINDER, r);
  }

  // ─── Reminder counter ───
  function getCurrentMonthKey(clientId) {
    var now = new Date();
    var ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    return 'pup_wa_rc_' + clientId + '_' + ym;
  }

  function getReminderCount(clientId) {
    var key = getCurrentMonthKey(clientId);
    var val = lsGet(key, '0');
    var num = parseInt(val, 10);
    return isNaN(num) ? 0 : num;
  }

  function incrementReminderCount(clientId) {
    var key = getCurrentMonthKey(clientId);
    var current = getReminderCount(clientId);
    lsSet(key, String(current + 1));
    return current + 1;
  }

  // ─── offerConfirmation(options) ───
  function offerConfirmation(options) {
    try {
      if (!options || !options.client || !options.loan) return;

      var loanType = options.loan.loanType || 'interest_only';
      if (!getConfirmToggle(loanType)) return;

      var mobile = options.client.mobile ? String(options.client.mobile).replace(/\D/g, '') : '';
      if (!isValidMobile(mobile)) return;

      var loanAmount = (loanType === 'interest_only') ? (options.loan.principalBalance || options.loan.totalAmount) : options.loan.totalAmount;
      var template = getConfirmationTemplate();
      var variables = {
        clientName: options.client.name || '',
        amount: Number(options.amount || 0).toFixed(2),
        date: formatDateDDMMYYYY(options.date || ''),
        loanAmount: Number(loanAmount || 0).toFixed(2),
        pending: Number(options.pending || 0).toFixed(2)
      };

      var message = processTemplate(template, variables);
      var accepted = confirm('Send WhatsApp confirmation to ' + options.client.name + '?');
      if (accepted) {
        var url = buildWhatsAppURL(mobile, message);
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error('WhatsApp offerConfirmation error:', e);
    }
  }

  // ─── sendReminder(options) ───
  function sendReminder(options) {
    try {
      if (!options || !options.client || !options.loan) return;

      var mobile = options.client.mobile ? String(options.client.mobile).replace(/\D/g, '') : '';
      if (!isValidMobile(mobile)) {
        alert('Client does not have a valid 10-digit mobile number.');
        return;
      }

      var count = incrementReminderCount(options.client.id);
      var loanType = options.loan.loanType || 'interest_only';
      var loanAmount = (loanType === 'interest_only') ? (options.loan.principalBalance || options.loan.totalAmount) : options.loan.totalAmount;

      var template = getReminderTemplate();
      var variables = {
        clientName: options.client.name || '',
        reminderNumber: formatOrdinal(count),
        pending: Number(options.pending || 0).toFixed(2),
        loanAmount: Number(loanAmount || 0).toFixed(2),
        amount: Number(options.pending || 0).toFixed(2),
        date: formatDateDDMMYYYY(new Date().toISOString().split('T')[0])
      };

      var message = processTemplate(template, variables);
      var url = buildWhatsAppURL(mobile, message);
      window.open(url, '_blank');
    } catch (e) {
      console.error('WhatsApp sendReminder error:', e);
    }
  }

  // ─── isReminderDue(periodStartDate, configuredDays, referenceDate) ───
  // Checks if referenceDate is within the configured reminder window BEFORE the period start date.
  // e.g., if periodStart is July 15, referenceDate is July 12, and configuredDays = [1, 3], returns true (3 days before).
  // Value 0 means "on due date" (referenceDate === periodStart).
  function isReminderDue(periodStartDate, configuredDays, referenceDate) {
    if (!periodStartDate || !configuredDays || !configuredDays.length) return false;
    try {
      var refParts = (referenceDate || '').split('-');
      var ref;
      if (refParts.length === 3) {
        ref = new Date(parseInt(refParts[0], 10), parseInt(refParts[1], 10) - 1, parseInt(refParts[2], 10));
      } else {
        ref = new Date();
      }
      ref.setHours(0, 0, 0, 0);

      var parts = periodStartDate.split('-');
      var startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      startDate.setHours(0, 0, 0, 0);

      var diffMs = startDate.getTime() - ref.getTime();
      var diffDays = Math.round(diffMs / 86400000);

      for (var i = 0; i < configuredDays.length; i++) {
        if (diffDays === configuredDays[i]) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // ─── init() ───
  function init() {
    try {
      // Populate Settings UI elements with stored values
      var emiToggle = document.getElementById('wa-confirm-emi');
      var interestToggle = document.getElementById('wa-confirm-interest');
      var confirmTextarea = document.getElementById('wa-template-confirm');
      var reminderTextarea = document.getElementById('wa-template-reminder');

      if (emiToggle) emiToggle.checked = getConfirmToggle('daily_emi');
      if (interestToggle) interestToggle.checked = getConfirmToggle('interest_only');
      if (confirmTextarea) confirmTextarea.value = getConfirmationTemplate();
      if (reminderTextarea) reminderTextarea.value = getReminderTemplate();

      // Populate timing checkboxes
      var timing = getReminderTiming();
      var timingCheckboxes = document.querySelectorAll('#wa-reminder-timing input[type="checkbox"]');
      timingCheckboxes.forEach(function(cb) {
        var val = parseInt(cb.value, 10);
        cb.checked = timing.indexOf(val) !== -1;
      });

      // Listen for settings save button to also persist WhatsApp settings
      var saveBtn = document.getElementById('settings-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          // Save toggles
          if (emiToggle) setConfirmToggle('daily_emi', emiToggle.checked);
          if (interestToggle) setConfirmToggle('interest_only', interestToggle.checked);

          // Save timing
          var selectedDays = [];
          var tcbs = document.querySelectorAll('#wa-reminder-timing input[type="checkbox"]');
          tcbs.forEach(function(cb) {
            if (cb.checked) selectedDays.push(parseInt(cb.value, 10));
          });
          setReminderTiming(selectedDays);

          // Save templates
          var cTpl = confirmTextarea ? confirmTextarea.value : '';
          var rTpl = reminderTextarea ? reminderTextarea.value : '';
          saveTemplates(cTpl, rTpl);
        });
      }
    } catch (e) {
      console.error('WhatsApp init error:', e);
    }
  }

  // ─── Public API ───
  return {
    init: init,
    offerConfirmation: offerConfirmation,
    sendReminder: sendReminder,
    getConfirmationTemplate: getConfirmationTemplate,
    getReminderTemplate: getReminderTemplate,
    saveTemplates: saveTemplates,
    getConfirmToggle: getConfirmToggle,
    setConfirmToggle: setConfirmToggle,
    getReminderTiming: getReminderTiming,
    setReminderTiming: setReminderTiming,
    isReminderDue: isReminderDue,
    getReminderCount: getReminderCount,
    incrementReminderCount: incrementReminderCount,
    formatOrdinal: formatOrdinal,
    processTemplate: processTemplate,
    buildWhatsAppURL: buildWhatsAppURL,
    formatDateDDMMYYYY: formatDateDDMMYYYY,
    isValidMobile: isValidMobile
  };
})();
