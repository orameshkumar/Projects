/**
 * TranscriptPanel - Manages the scrollable transcript display with paired entries,
 * auto-scroll, and per-entry playback buttons.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
(function () {
  'use strict';

  class TranscriptPanel {
    constructor(container) {
      this._container = container;
      this._interimElement = container.querySelector('#interim-text');
      this._userScrolledUp = false;
      this.MAX_ENTRIES = 200;
      this._onPlayCallback = null;

      this._container.addEventListener('scroll', () => {
        var el = this._container;
        this._userScrolledUp = (el.scrollTop + el.clientHeight < el.scrollHeight - 50);
      });
    }

    /**
     * Set a callback that fires when user clicks play on a transcript entry.
     * @param {Function} callback - receives (translatedText, langCode)
     */
    onPlay(callback) {
      this._onPlayCallback = callback;
    }

    /**
     * Add a paired transcript entry with play buttons for both source and translated text.
     */
    addEntry(sourceText, translatedText, sourceLangLabel, targetLangLabel) {
      var entry = document.createElement('div');
      entry.className = 'transcript-entry';

      // Source text row
      var sourceDiv = document.createElement('div');
      sourceDiv.className = 'entry-source';
      sourceDiv.innerHTML =
        '<span class="lang-label">' + this._esc(sourceLangLabel) + '</span>' +
        '<span class="entry-text">' + this._esc(sourceText) + '</span>';

      var srcPlayBtn = document.createElement('button');
      srcPlayBtn.className = 'entry-play-btn';
      srcPlayBtn.textContent = '🔊';
      srcPlayBtn.title = 'Play source text';
      srcPlayBtn.setAttribute('aria-label', 'Play source text');
      srcPlayBtn.setAttribute('data-text', sourceText);
      srcPlayBtn.setAttribute('data-lang', sourceLangLabel.toLowerCase());
      sourceDiv.appendChild(srcPlayBtn);

      // Translated text row
      var translatedDiv = document.createElement('div');
      translatedDiv.className = 'entry-translated';
      translatedDiv.innerHTML =
        '<span class="lang-label">' + this._esc(targetLangLabel) + '</span>' +
        '<span class="entry-text">' + this._esc(translatedText) + '</span>';

      var tgtPlayBtn = document.createElement('button');
      tgtPlayBtn.className = 'entry-play-btn';
      tgtPlayBtn.textContent = '🔊';
      tgtPlayBtn.title = 'Play translated text';
      tgtPlayBtn.setAttribute('aria-label', 'Play translated text');
      tgtPlayBtn.setAttribute('data-text', translatedText);
      tgtPlayBtn.setAttribute('data-lang', targetLangLabel.toLowerCase());
      translatedDiv.appendChild(tgtPlayBtn);

      entry.appendChild(sourceDiv);
      entry.appendChild(translatedDiv);

      // Attach click handlers for play buttons
      var self = this;
      srcPlayBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (self._onPlayCallback) {
          self._onPlayCallback(sourceText, sourceLangLabel.toLowerCase());
        }
      });
      tgtPlayBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (self._onPlayCallback) {
          self._onPlayCallback(translatedText, targetLangLabel.toLowerCase());
        }
      });

      this._container.insertBefore(entry, this._interimElement);

      // Enforce 200-entry cap
      while (this.getEntryCount() > this.MAX_ENTRIES) {
        var oldest = this._container.querySelector('.transcript-entry');
        if (oldest) oldest.remove();
      }

      this._autoScroll();
    }

    updateInterim(text) {
      if (this._interimElement) {
        this._interimElement.textContent = text;
      }
      this._autoScroll();
    }

    clear() {
      var entries = this._container.querySelectorAll('.transcript-entry');
      entries.forEach(function (e) { e.remove(); });
      if (this._interimElement) this._interimElement.textContent = '';
      this._userScrolledUp = false;
    }

    getEntryCount() {
      return this._container.querySelectorAll('.transcript-entry').length;
    }

    isEmpty() {
      return this.getEntryCount() === 0;
    }

    _autoScroll() {
      if (!this._userScrolledUp) {
        this._container.scrollTop = this._container.scrollHeight;
      }
    }

    _esc(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }

  window.TranscriptPanel = TranscriptPanel;
})();
