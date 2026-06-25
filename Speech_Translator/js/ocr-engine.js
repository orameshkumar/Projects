/**
 * OCREngine - Extracts text from images using Tesseract.js.
 * Supports camera capture and gallery upload.
 * Works entirely in-browser (no server needed).
 */
(function () {
  'use strict';

  // Tesseract language code mapping from our app's codes
  var LANG_MAP = {
    'en': 'eng',
    'es': 'spa',
    'fr': 'fra',
    'de': 'deu',
    'it': 'ita',
    'pt': 'por',
    'hi': 'hin',
    'ja': 'jpn',
    'ko': 'kor',
    'zh': 'chi_sim'
  };

  class OCREngine {
    constructor() {
      this._worker = null;
      this._currentLang = 'eng';
      this._isProcessing = false;
    }

    /**
     * Set the source language for OCR recognition.
     * @param {string} langCode - Our app language code (e.g., 'en', 'fr')
     */
    setLanguage(langCode) {
      this._currentLang = LANG_MAP[langCode] || 'eng';
    }

    /**
     * Extract text from an image file or blob.
     * @param {File|Blob|string} image - Image source (File, Blob, or data URL)
     * @param {Function} onProgress - Progress callback (0-1)
     * @returns {Promise<string>} Extracted text
     */
    async recognize(image, onProgress) {
      if (this._isProcessing) {
        throw new Error('OCR is already processing an image');
      }

      this._isProcessing = true;

      try {
        var result = await Tesseract.recognize(image, this._currentLang, {
          logger: function (info) {
            if (info.status === 'recognizing text' && onProgress) {
              onProgress(info.progress || 0);
            }
          }
        });

        var text = result.data.text ? result.data.text.trim() : '';

        if (!text) {
          throw new Error('No text detected in the image');
        }

        return text;
      } finally {
        this._isProcessing = false;
      }
    }

    /**
     * Check if currently processing an image.
     * @returns {boolean}
     */
    isProcessing() {
      return this._isProcessing;
    }

    /**
     * Get the Tesseract language code for a given app language code.
     * @param {string} langCode
     * @returns {string}
     */
    static getTesseractLang(langCode) {
      return LANG_MAP[langCode] || 'eng';
    }
  }

  window.OCREngine = OCREngine;
})();
