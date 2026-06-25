/**
 * SpeechSynthesizer - Wraps Web Speech Synthesis API for TTS output
 * with volume control, voice selection, and replay.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
(function () {
  'use strict';

  class SpeechSynthesizer {
    constructor(onSpeakStart, onSpeakEnd, onError) {
      this._onSpeakStart = onSpeakStart || function () {};
      this._onSpeakEnd = onSpeakEnd || function () {};
      this._onError = onError || function () {};

      this._volume = 0.8;
      this._lang = null;
      this._lastText = null;
      this._selectedVoice = null;

      if (typeof speechSynthesis !== 'undefined') {
        var self = this;
        speechSynthesis.onvoiceschanged = function () {
          self._selectVoice();
        };
      }
    }

    setLanguage(langCode) {
      this._lang = langCode;
      this._selectVoice();
    }

    speak(text) {
      speechSynthesis.cancel();
      this._lastText = text;

      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this._lang;
      utterance.volume = this._volume;

      if (this._selectedVoice) {
        utterance.voice = this._selectedVoice;
      }

      var self = this;
      utterance.onstart = function () { self._onSpeakStart(); };
      utterance.onend = function () { self._onSpeakEnd(); };
      utterance.onerror = function (event) {
        // "interrupted" and "canceled" are NOT real errors — they fire when
        // speechSynthesis.cancel() is called before new speech (by design).
        if (event.error === 'interrupted' || event.error === 'canceled') {
          return;
        }
        self._onError('Speech synthesis failed: ' + event.error);
      };

      speechSynthesis.speak(utterance);
    }

    stop() {
      speechSynthesis.cancel();
    }

    replay() {
      if (this._lastText) this.speak(this._lastText);
    }

    setVolume(value) {
      this._volume = Math.max(0.0, Math.min(1.0, value));
    }

    getVolume() {
      return this._volume;
    }

    isSpeaking() {
      return speechSynthesis.speaking;
    }

    isAvailable(langCode) {
      var voices = speechSynthesis.getVoices();
      var prefix = langCode.toLowerCase();
      return voices.some(function (v) { return v.lang.toLowerCase().startsWith(prefix); });
    }

    _selectVoice() {
      if (!this._lang) { this._selectedVoice = null; return; }

      var voices = speechSynthesis.getVoices();
      var langPrefix = this._lang.split('-')[0].toLowerCase();

      var matching = voices.filter(function (v) {
        return v.lang.toLowerCase().startsWith(langPrefix);
      });

      if (matching.length === 0) { this._selectedVoice = null; return; }

      matching.sort(function (a, b) {
        if (a.localService && !b.localService) return -1;
        if (!a.localService && b.localService) return 1;
        return 0;
      });

      this._selectedVoice = matching[0];
    }
  }

  window.SpeechSynthesizer = SpeechSynthesizer;
})();
