/**
 * TranslationEngine - Multi-provider translation with fallback.
 *
 * Primary: MyMemory API (with email for higher quota: 50K chars/day)
 * Fallback: LibreTranslate free instance (no key needed)
 *
 * If MyMemory returns 403 (quota exceeded), automatically falls back
 * to LibreTranslate for the remainder of the session.
 */
(function () {
  'use strict';

  // LibreTranslate free public instances
  var LIBRE_ENDPOINTS = [
    'https://libretranslate.com/translate',
    'https://translate.argosopentech.com/translate',
    'https://translate.terraprint.co/translate'
  ];

  class TranslationEngine {
    constructor() {
      this._sourceLang = null;
      this._targetLang = null;
      this._timeout = 10000; // 10 seconds
      this._retryCount = 2;
      this._useLibre = false; // Switch to LibreTranslate on MyMemory 403
      this._libreEndpointIndex = 0;
      // Email boosts MyMemory limit from 5K to 50K chars/day
      this._email = 'speech.translator.app@gmail.com';
    }

    setLanguages(sourceLang, targetLang) {
      this._sourceLang = sourceLang;
      this._targetLang = targetLang;
    }

    async translate(text) {
      if (this.isWhitespaceOnly(text)) return null;

      text = text.trim().replace(/\s+/g, ' ');
      if (!text) return null;

      if (text.length > 500) {
        var segments = this.splitText(text, 500);
        var results = [];
        for (var i = 0; i < segments.length; i++) {
          var translated = await this._translateWithRetry(segments[i]);
          results.push(translated);
          // Small delay between segments to avoid rate limiting
          if (i < segments.length - 1) await this._delay(300);
        }
        return results.join(' ');
      }

      return this._translateWithRetry(text);
    }

    async _translateWithRetry(text) {
      var lastError = null;

      for (var attempt = 0; attempt <= this._retryCount; attempt++) {
        try {
          if (attempt > 0) await this._delay(600 * attempt);

          if (this._useLibre) {
            return await this._translateLibre(text);
          } else {
            return await this._translateMyMemory(text);
          }
        } catch (error) {
          lastError = error;

          // If MyMemory gives 403, switch to LibreTranslate and retry immediately
          if (error.message.indexOf('403') !== -1 && !this._useLibre) {
            console.warn('[TranslationEngine] MyMemory quota exceeded. Switching to LibreTranslate.');
            this._useLibre = true;
            attempt--; // Don't count this as a retry
            continue;
          }

          // Retry on timeout or network errors
          if (error.message.indexOf('timeout') !== -1 || error.message.indexOf('network') !== -1) {
            console.warn('[TranslationEngine] Retry ' + (attempt + 1) + ': ' + error.message);
            continue;
          }

          // If LibreTranslate fails, try next endpoint
          if (this._useLibre && error.message.indexOf('LibreTranslate') !== -1) {
            this._libreEndpointIndex = (this._libreEndpointIndex + 1) % LIBRE_ENDPOINTS.length;
            console.warn('[TranslationEngine] Trying next LibreTranslate endpoint');
            continue;
          }

          throw error;
        }
      }

      throw lastError;
    }

    /**
     * Translate via MyMemory API (primary).
     */
    async _translateMyMemory(text) {
      var url = 'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(text) +
        '&langpair=' + this._sourceLang + '|' + this._targetLang +
        '&de=' + encodeURIComponent(this._email);

      var controller = new AbortController();
      var self = this;
      var timeoutId = setTimeout(function () { controller.abort(); }, self._timeout);

      try {
        var response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.status === 403) {
          throw new Error('Translation API error: status 403');
        }

        if (!response.ok) {
          throw new Error('Translation API HTTP error: ' + response.status);
        }

        var data = await response.json();

        if (!data.responseData || !data.responseData.translatedText) {
          throw new Error('Empty translation result');
        }

        if (data.responseStatus === 403 || data.responseStatus === 429) {
          throw new Error('Translation API error: status ' + data.responseStatus);
        }

        // Check for "PLEASE SELECT TWO LANGUAGES" or similar error messages
        var translated = data.responseData.translatedText;
        if (translated.toUpperCase().indexOf('PLEASE SELECT') !== -1 ||
            translated.toUpperCase().indexOf('MYMEMORY WARNING') !== -1) {
          throw new Error('Translation API error: status 403');
        }

        return translated;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Translation timeout: request exceeded ' + (self._timeout / 1000) + ' seconds');
        }
        if (error.message.indexOf('Translation API') !== -1 || error.message.indexOf('Empty translation') !== -1) {
          throw error;
        }
        throw new Error('Translation failed: network error - ' + error.message);
      }
    }

    /**
     * Translate via LibreTranslate (fallback).
     */
    async _translateLibre(text) {
      var endpoint = LIBRE_ENDPOINTS[this._libreEndpointIndex];

      var controller = new AbortController();
      var self = this;
      var timeoutId = setTimeout(function () { controller.abort(); }, self._timeout);

      try {
        var response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            source: this._sourceLang,
            target: this._targetLang,
            format: 'text'
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('LibreTranslate HTTP error: ' + response.status);
        }

        var data = await response.json();

        if (data.error) {
          throw new Error('LibreTranslate error: ' + data.error);
        }

        if (!data.translatedText) {
          throw new Error('LibreTranslate: empty result');
        }

        return data.translatedText;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Translation timeout: request exceeded ' + (self._timeout / 1000) + ' seconds');
        }
        if (error.message.indexOf('LibreTranslate') !== -1) {
          throw error;
        }
        throw new Error('Translation failed: network error - ' + error.message);
      }
    }

    /**
     * Split text into segments respecting sentence and word boundaries.
     */
    splitText(text, maxLength) {
      maxLength = maxLength || 500;
      if (text.length <= maxLength) return [text];

      var segments = [];
      var remaining = text;

      while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
          segments.push(remaining);
          break;
        }

        var splitIndex = -1;

        for (var i = maxLength - 1; i >= maxLength * 0.5; i--) {
          var ch = remaining[i];
          if ((ch === '.' || ch === '!' || ch === '?') && (i + 1 >= remaining.length || remaining[i + 1] === ' ')) {
            splitIndex = i + 1;
            break;
          }
        }

        if (splitIndex === -1) {
          for (var j = maxLength - 1; j >= maxLength * 0.5; j--) {
            if (remaining[j] === ',' || remaining[j] === ';') {
              splitIndex = j + 1;
              break;
            }
          }
        }

        if (splitIndex === -1) {
          for (var k = maxLength - 1; k >= maxLength * 0.3; k--) {
            if (remaining[k] === ' ') {
              splitIndex = k + 1;
              break;
            }
          }
        }

        if (splitIndex === -1) splitIndex = maxLength;

        segments.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
      }

      return segments.filter(function (s) { return s.length > 0; });
    }

    isWhitespaceOnly(text) {
      if (text === null || text === undefined) return true;
      return /^\s*$/.test(text);
    }

    _delay(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }
  }

  window.TranslationEngine = TranslationEngine;
})();
