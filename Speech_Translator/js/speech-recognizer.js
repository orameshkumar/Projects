/**
 * SpeechRecognizer - Improved version with better continuous listening,
 * fresh instance on restart, and configurable parameters.
 * 
 * Key improvements:
 * - Creates a FRESH SpeechRecognition instance on each restart (avoids Chrome bug)
 * - Uses maxAlternatives for better accuracy
 * - Debounced restart to avoid rapid start/stop cycles
 * - Accumulates final transcript fragments before emitting
 * - Graceful handling of aborted and no-speech errors
 */
(function () {
  'use strict';

  class SpeechRecognizer {
    constructor(onInterim, onFinalized, onError, onNoSpeech) {
      this._onInterim = onInterim;
      this._onFinalized = onFinalized;
      this._onError = onError;
      this._onNoSpeech = onNoSpeech;
      this._listening = false;
      this._recognition = null;
      this._lang = 'en-US';
      this._restartTimer = null;
      this._noSpeechCount = 0;
      this._SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    }

    setLanguage(langCode) {
      this._lang = langCode;
    }

    start() {
      if (!this._SpeechRecognition) {
        this._onError('Speech recognition is not supported in this browser');
        return;
      }

      this._listening = true;
      this._noSpeechCount = 0;
      this._startRecognition();
    }

    _startRecognition() {
      // Always create a FRESH instance — reusing a stopped instance is unreliable in Chrome
      if (this._recognition) {
        try { this._recognition.abort(); } catch (e) {}
        this._recognition = null;
      }

      var recognition = new this._SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;  // Better accuracy with multiple alternatives
      recognition.lang = this._lang;

      this._recognition = recognition;

      var self = this;

      recognition.onresult = function (event) {
        var interimTranscript = '';
        var finalTranscript = '';

        for (var i = event.resultIndex; i < event.results.length; i++) {
          // Use best confidence alternative
          var bestAlt = event.results[i][0];
          for (var a = 1; a < event.results[i].length; a++) {
            if (event.results[i][a].confidence > bestAlt.confidence) {
              bestAlt = event.results[i][a];
            }
          }

          var transcript = bestAlt.transcript;

          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            self._noSpeechCount = 0; // Reset no-speech counter on successful recognition
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          self._onInterim(interimTranscript);
        }
        if (finalTranscript) {
          self._onFinalized(finalTranscript);
        }
      };

      recognition.onend = function () {
        if (self._listening) {
          // Debounced restart — wait a short moment to avoid rapid start/stop cycles
          clearTimeout(self._restartTimer);
          self._restartTimer = setTimeout(function () {
            if (self._listening) {
              self._startRecognition();
            }
          }, 150);
        }
      };

      recognition.onerror = function (event) {
        switch (event.error) {
          case 'no-speech':
            self._noSpeechCount++;
            // Only notify user after 3 consecutive no-speech events (~15 seconds)
            if (self._noSpeechCount >= 3) {
              self._onNoSpeech();
              self._noSpeechCount = 0;
            }
            // Don't stop listening — let onend handle the restart
            break;

          case 'aborted':
            // Browser aborted (e.g., user navigated, or we called abort) — ignore
            break;

          case 'not-allowed':
          case 'permission-denied':
            self._listening = false;
            self._onError('Microphone permission denied');
            break;

          case 'audio-capture':
            self._listening = false;
            self._onError('Microphone not available');
            break;

          case 'network':
            // Network errors are transient — don't stop, let onend restart
            self._onError('Network error during speech recognition');
            break;

          default:
            // For unknown errors, don't kill the session — let onend restart
            console.warn('[SpeechRecognizer] Non-fatal error:', event.error);
            break;
        }
      };

      recognition.onspeechstart = function () {
        self._noSpeechCount = 0;
      };

      try {
        recognition.start();
      } catch (e) {
        // If start fails (e.g., already started), retry after delay
        setTimeout(function () {
          if (self._listening) {
            self._startRecognition();
          }
        }, 300);
      }
    }

    stop() {
      this._listening = false;
      clearTimeout(this._restartTimer);
      if (this._recognition) {
        try { this._recognition.stop(); } catch (e) {}
        this._recognition = null;
      }
    }

    isListening() {
      return this._listening;
    }

    static isSupported() {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
  }

  window.SpeechRecognizer = SpeechRecognizer;
})();
