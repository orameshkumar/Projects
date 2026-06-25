/**
 * PreferencesManager - Handles localStorage persistence for user settings.
 * Storage keys: stt_volume, stt_source_lang, stt_target_lang
 * Defaults: volume=0.8, source='en', target='es'
 */
(function () {
  'use strict';

  const KEYS = {
    VOLUME: 'stt_volume',
    SOURCE_LANG: 'stt_source_lang',
    TARGET_LANG: 'stt_target_lang'
  };

  const DEFAULTS = {
    VOLUME: 0.8,
    SOURCE_LANG: 'en',
    TARGET_LANG: 'es'
  };

  class PreferencesManager {
    getVolume() {
      try {
        const stored = localStorage.getItem(KEYS.VOLUME);
        if (stored === null) return DEFAULTS.VOLUME;
        const parsed = parseFloat(stored);
        if (isNaN(parsed)) return DEFAULTS.VOLUME;
        return Math.min(1.0, Math.max(0.0, parsed));
      } catch (e) {
        return DEFAULTS.VOLUME;
      }
    }

    setVolume(value) {
      if (typeof value !== 'number' || isNaN(value)) return;
      const clamped = Math.min(1.0, Math.max(0.0, value));
      try { localStorage.setItem(KEYS.VOLUME, clamped.toString()); } catch (e) {}
    }

    getSourceLanguage() {
      try {
        const stored = localStorage.getItem(KEYS.SOURCE_LANG);
        return (stored && stored.trim()) ? stored : DEFAULTS.SOURCE_LANG;
      } catch (e) {
        return DEFAULTS.SOURCE_LANG;
      }
    }

    setSourceLanguage(langCode) {
      if (typeof langCode !== 'string' || !langCode.trim()) return;
      try { localStorage.setItem(KEYS.SOURCE_LANG, langCode); } catch (e) {}
    }

    getTargetLanguage() {
      try {
        const stored = localStorage.getItem(KEYS.TARGET_LANG);
        return (stored && stored.trim()) ? stored : DEFAULTS.TARGET_LANG;
      } catch (e) {
        return DEFAULTS.TARGET_LANG;
      }
    }

    setTargetLanguage(langCode) {
      if (typeof langCode !== 'string' || !langCode.trim()) return;
      try { localStorage.setItem(KEYS.TARGET_LANG, langCode); } catch (e) {}
    }
  }

  window.PreferencesManager = PreferencesManager;
})();
