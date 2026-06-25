/**
 * AppManager - Central orchestrator for the Real-Time Speech Translator PWA.
 * Manages session lifecycle, wires components together, and handles error propagation.
 */
(function () {
  'use strict';

  var SUPPORTED_LANGUAGES = [
    { code: 'en', speechCode: 'en-US', name: 'English' },
    { code: 'es', speechCode: 'es-ES', name: 'Spanish' },
    { code: 'fr', speechCode: 'fr-FR', name: 'French' },
    { code: 'de', speechCode: 'de-DE', name: 'German' },
    { code: 'it', speechCode: 'it-IT', name: 'Italian' },
    { code: 'pt', speechCode: 'pt-PT', name: 'Portuguese' },
    { code: 'hi', speechCode: 'hi-IN', name: 'Hindi' },
    { code: 'ja', speechCode: 'ja-JP', name: 'Japanese' },
    { code: 'ko', speechCode: 'ko-KR', name: 'Korean' },
    { code: 'zh', speechCode: 'zh-CN', name: 'Chinese' }
  ];

  // Expose for tests
  window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;

  // ── State ──
  var isActive = false;
  var isPaused = false;
  var sourceLang = null;
  var targetLang = null;

  // ── Components ──
  var recognizer = null;
  var translationEngine = null;
  var synthesizer = null;
  var transcriptPanel = null;
  var preferences = null;
  var ocrEngine = null;

  // ── DOM elements ──
  var startBtn, stopBtn, clearBtn, swapBtn;
  var sourceLangSelect, targetLangSelect;
  var volumeSlider, replayBtn;
  var listeningIndicator, speakingIndicator;
  var offlineBanner, resumeBtn, toastContainer;
  var ocrCameraBtn, ocrGalleryBtn, ocrCameraInput, ocrGalleryInput;
  var ocrPreviewSection, ocrProgress, ocrProgressText, ocrProgressFill, ocrCancelBtn;

  // ═══════════════════════════════════════════════════════════════
  // Theme Toggle
  // ═══════════════════════════════════════════════════════════════

  function initTheme() {
    var saved = localStorage.getItem('stt_theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }

    var toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        var next = (current === 'dark') ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('stt_theme', next);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Initialization
  // ═══════════════════════════════════════════════════════════════

  var micStream = null; // Hold reference to keep permission alive

  function init() {
    // Theme setup (before anything else so UI renders in correct theme)
    initTheme();

    // Cache DOM
    startBtn = document.getElementById('start-btn');
    stopBtn = document.getElementById('stop-btn');
    clearBtn = document.getElementById('clear-btn');
    swapBtn = document.getElementById('swap-btn');
    sourceLangSelect = document.getElementById('source-lang');
    targetLangSelect = document.getElementById('target-lang');
    volumeSlider = document.getElementById('volume-slider');
    replayBtn = document.getElementById('replay-btn');
    listeningIndicator = document.getElementById('listening-indicator');
    speakingIndicator = document.getElementById('speaking-indicator');
    offlineBanner = document.getElementById('offline-banner');
    resumeBtn = document.getElementById('resume-btn');
    toastContainer = document.getElementById('toast-container');

    // Initialize preferences
    preferences = new PreferencesManager();

    // Populate language dropdowns FIRST (always works regardless of browser support)
    populateLanguageDropdowns();
    loadPreferences();

    // Check browser support
    if (!SpeechRecognizer.isSupported()) {
      showNotification(
        'Your browser does not support the Web Speech API. Please use Chrome or Edge.',
        'error', false
      );
      startBtn.disabled = true;
      bindNonSpeechEvents();
      return;
    }

    // Initialize components
    translationEngine = new TranslationEngine();

    synthesizer = new SpeechSynthesizer(
      function () { speakingIndicator.hidden = false; },
      function () { speakingIndicator.hidden = true; },
      function (msg) { handleError('SpeechSynthesizer', msg); }
    );

    transcriptPanel = new TranscriptPanel(document.getElementById('transcript-panel'));

    // Wire up per-entry playback: clicking 🔊 on any entry speaks that text
    transcriptPanel.onPlay(function (text, langCode) {
      if (!text || text.indexOf('[Translation failed') === 0) return;
      // Find the matching speechCode for the language label
      var lang = SUPPORTED_LANGUAGES.find(function (l) { return l.code === langCode; });
      if (lang) {
        synthesizer.setLanguage(lang.speechCode);
      }
      synthesizer.speak(text);
    });

    recognizer = new SpeechRecognizer(
      function (text) { transcriptPanel.updateInterim(text); },
      function (text) { handleFinalizedText(text); },
      function (msg) { handleError('SpeechRecognizer', msg); },
      function () { showNotification('No speech detected. Please speak into the microphone.', 'info', true); }
    );

    // Apply saved volume
    var savedVolume = preferences.getVolume();
    synthesizer.setVolume(savedVolume);
    volumeSlider.value = Math.round(savedVolume * 100);

    // Bind all events
    bindEvents();

    // Initial button states
    updateButtonStates(false);

    // Register Service Worker
    registerServiceWorker();

    // Pre-request microphone permission to avoid repeated popups
    requestMicPermission();

    // Initialize OCR
    initOCR();
  }

  /**
   * Request microphone access once on load and keep the stream reference.
   * This prevents the browser from repeatedly prompting the user.
   * The stream is kept alive (not closed) so the permission stays granted.
   */
  function requestMicPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          micStream = stream;
          // Show a brief confirmation
          showNotification('Microphone access granted.', 'info', true);
        })
        .catch(function (err) {
          console.warn('[SpeechTranslator:Mic] Permission not granted:', err.message);
          // Don't disable — user can still grant when they press Start
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Language Dropdowns
  // ═══════════════════════════════════════════════════════════════

  function populateLanguageDropdowns() {
    sourceLangSelect.innerHTML = '<option value="">Select source language</option>';
    targetLangSelect.innerHTML = '<option value="">Select target language</option>';

    for (var i = 0; i < SUPPORTED_LANGUAGES.length; i++) {
      var lang = SUPPORTED_LANGUAGES[i];

      var srcOpt = document.createElement('option');
      srcOpt.value = lang.code;
      srcOpt.textContent = lang.name;
      sourceLangSelect.appendChild(srcOpt);

      var tgtOpt = document.createElement('option');
      tgtOpt.value = lang.code;
      tgtOpt.textContent = lang.name;
      targetLangSelect.appendChild(tgtOpt);
    }
  }

  function loadPreferences() {
    var sourceCode = preferences.getSourceLanguage();
    var targetCode = preferences.getTargetLanguage();

    var srcLang = SUPPORTED_LANGUAGES.find(function (l) { return l.code === sourceCode; });
    var tgtLang = SUPPORTED_LANGUAGES.find(function (l) { return l.code === targetCode; });

    if (srcLang) {
      sourceLang = srcLang;
      sourceLangSelect.value = srcLang.code;
    }

    if (tgtLang) {
      targetLang = tgtLang;
      targetLangSelect.value = tgtLang.code;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Session Control
  // ═══════════════════════════════════════════════════════════════

  function startSession() {
    if (!sourceLang || !targetLang) {
      showNotification('Please select both source and target languages.', 'warning', true);
      return;
    }

    transcriptPanel.clear();
    recognizer.setLanguage(sourceLang.speechCode);
    translationEngine.setLanguages(sourceLang.code, targetLang.code);
    synthesizer.setLanguage(targetLang.speechCode);
    recognizer.start();

    isActive = true;
    isPaused = false;
    listeningIndicator.hidden = false;
    updateButtonStates(true);
  }

  function stopSession() {
    recognizer.stop();
    synthesizer.stop();
    isActive = false;
    isPaused = false;
    listeningIndicator.hidden = true;
    updateButtonStates(false);
  }

  function pauseSession() {
    if (!isActive) return;
    recognizer.stop();
    offlineBanner.hidden = false;
    resumeBtn.hidden = false;
    isPaused = true;
    listeningIndicator.hidden = true;
    showNotification('Internet connection lost. Translation paused.', 'warning', false);
  }

  function resumeSession() {
    if (!isPaused) return;
    offlineBanner.hidden = true;
    resumeBtn.hidden = true;
    recognizer.setLanguage(sourceLang.speechCode);
    recognizer.start();
    isPaused = false;
    isActive = true;
    listeningIndicator.hidden = false;
    showNotification('Connection restored. Session resumed.', 'info', true);
  }

  // ═══════════════════════════════════════════════════════════════
  // Translation Pipeline (queued to avoid overlapping requests)
  // ═══════════════════════════════════════════════════════════════

  var translationQueue = Promise.resolve();

  async function handleFinalizedText(text) {
    if (!text || /^\s*$/.test(text)) return;

    transcriptPanel.updateInterim('');

    // Queue translations to avoid flooding the API and losing order
    translationQueue = translationQueue.then(function () {
      return processTranslation(text);
    }).catch(function () {
      // Ensure queue continues even if one translation fails
    });
  }

  async function processTranslation(text) {
    var srcLabel = sourceLang.code.toUpperCase();
    var tgtLabel = targetLang.code.toUpperCase();

    try {
      var translatedText = await translationEngine.translate(text);
      if (translatedText === null) return;

      // Only speak if session is still active
      if (isActive) {
        synthesizer.speak(translatedText);
      }

      transcriptPanel.addEntry(text, translatedText, srcLabel, tgtLabel);
      updateClearBtn();
    } catch (error) {
      handleError('TranslationEngine', error.message);
      transcriptPanel.addEntry(text, '[Translation failed: ' + error.message + ']', srcLabel, tgtLabel);
      updateClearBtn();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Language Selection
  // ═══════════════════════════════════════════════════════════════

  function setSourceLanguage(langCode) {
    var lang = SUPPORTED_LANGUAGES.find(function (l) { return l.code === langCode; });
    if (!lang) return;

    if (targetLang && lang.code === targetLang.code) {
      showNotification('Source and target languages must be different.', 'warning', true);
      sourceLangSelect.value = sourceLang ? sourceLang.code : '';
      return;
    }

    sourceLang = lang;
    if (recognizer) recognizer.setLanguage(lang.speechCode);
    if (targetLang && translationEngine) translationEngine.setLanguages(lang.code, targetLang.code);
    preferences.setSourceLanguage(lang.code);
  }

  function setTargetLanguage(langCode) {
    var lang = SUPPORTED_LANGUAGES.find(function (l) { return l.code === langCode; });
    if (!lang) return;

    if (sourceLang && lang.code === sourceLang.code) {
      showNotification('Source and target languages must be different.', 'warning', true);
      targetLangSelect.value = targetLang ? targetLang.code : '';
      return;
    }

    targetLang = lang;
    if (sourceLang && translationEngine) translationEngine.setLanguages(sourceLang.code, lang.code);
    if (synthesizer) synthesizer.setLanguage(lang.speechCode);
    preferences.setTargetLanguage(lang.code);
  }

  function swapLanguages() {
    if (!sourceLang || !targetLang) return;

    var temp = sourceLang;
    sourceLang = targetLang;
    targetLang = temp;

    sourceLangSelect.value = sourceLang.code;
    targetLangSelect.value = targetLang.code;

    if (recognizer) recognizer.setLanguage(sourceLang.speechCode);
    if (translationEngine) translationEngine.setLanguages(sourceLang.code, targetLang.code);
    if (synthesizer) synthesizer.setLanguage(targetLang.speechCode);

    preferences.setSourceLanguage(sourceLang.code);
    preferences.setTargetLanguage(targetLang.code);
  }

  // ═══════════════════════════════════════════════════════════════
  // UI State
  // ═══════════════════════════════════════════════════════════════

  function updateButtonStates(active) {
    startBtn.disabled = active;
    stopBtn.disabled = !active;
    updateClearBtn();
  }

  function updateClearBtn() {
    clearBtn.disabled = transcriptPanel ? transcriptPanel.isEmpty() : true;
  }

  function handleClear() {
    if (isActive) stopSession();
    transcriptPanel.clear();
    updateClearBtn();
  }

  // ═══════════════════════════════════════════════════════════════
  // Error Handling
  // ═══════════════════════════════════════════════════════════════

  function handleError(component, message) {
    console.error('[SpeechTranslator:' + component + '] ' + message);
    showNotification(message, 'error');

    if (message.indexOf('Microphone permission denied') !== -1 || message.indexOf('Microphone not available') !== -1) {
      stopSession();
    } else if (message.indexOf('Microphone connection was lost') !== -1) {
      stopSession();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Notifications
  // ═══════════════════════════════════════════════════════════════

  function showNotification(message, type, autoDismiss) {
    var shouldAutoDismiss = (autoDismiss !== undefined) ? autoDismiss : (type !== 'error');

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'alert');

    var msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    var dismissBtn = document.createElement('button');
    dismissBtn.className = 'toast-dismiss';
    dismissBtn.textContent = '\u00d7';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.addEventListener('click', function () { toast.remove(); });
    toast.appendChild(dismissBtn);

    toastContainer.appendChild(toast);

    if (shouldAutoDismiss) {
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 5000);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Event Binding
  // ═══════════════════════════════════════════════════════════════

  function bindNonSpeechEvents() {
    sourceLangSelect.addEventListener('change', function (e) {
      if (e.target.value) setSourceLanguage(e.target.value);
    });
    targetLangSelect.addEventListener('change', function (e) {
      if (e.target.value) setTargetLanguage(e.target.value);
    });
    swapBtn.addEventListener('click', swapLanguages);
    volumeSlider.addEventListener('input', function (e) {
      preferences.setVolume(parseInt(e.target.value, 10) / 100);
    });
  }

  function bindEvents() {
    startBtn.addEventListener('click', startSession);
    stopBtn.addEventListener('click', stopSession);
    clearBtn.addEventListener('click', handleClear);

    sourceLangSelect.addEventListener('change', function (e) {
      if (e.target.value) setSourceLanguage(e.target.value);
    });
    targetLangSelect.addEventListener('change', function (e) {
      if (e.target.value) setTargetLanguage(e.target.value);
    });

    swapBtn.addEventListener('click', swapLanguages);

    volumeSlider.addEventListener('input', function (e) {
      var vol = parseInt(e.target.value, 10) / 100;
      synthesizer.setVolume(vol);
      preferences.setVolume(vol);
    });

    replayBtn.addEventListener('click', function () { synthesizer.replay(); });
    resumeBtn.addEventListener('click', resumeSession);

    window.addEventListener('offline', pauseSession);
    window.addEventListener('online', function () {
      if (isPaused) {
        showNotification('Connection restored. Press Resume to continue.', 'info', false);
        resumeBtn.hidden = false;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // OCR (Image to Text Translation) with Crop Selection
  // ═══════════════════════════════════════════════════════════════

  var imageCropper = null;
  var currentOCRFile = null;

  function initOCR() {
    ocrEngine = new OCREngine();

    // Cache OCR DOM elements
    ocrCameraBtn = document.getElementById('ocr-camera-btn');
    ocrGalleryBtn = document.getElementById('ocr-gallery-btn');
    ocrCameraInput = document.getElementById('ocr-camera-input');
    ocrGalleryInput = document.getElementById('ocr-gallery-input');
    ocrPreviewSection = document.getElementById('ocr-preview-section');
    ocrProgress = document.getElementById('ocr-progress');
    ocrProgressText = document.getElementById('ocr-progress-text');
    ocrProgressFill = document.getElementById('ocr-progress-fill');
    ocrCancelBtn = document.getElementById('ocr-cancel-btn');

    var ocrTranslateSelectionBtn = document.getElementById('ocr-translate-selection-btn');
    var ocrTranslateAllBtn = document.getElementById('ocr-translate-all-btn');
    var ocrResetSelectionBtn = document.getElementById('ocr-reset-selection-btn');

    // Initialize image cropper
    var canvas = document.getElementById('ocr-canvas');
    imageCropper = new ImageCropper(canvas);

    // Update button states when selection changes
    imageCropper.onSelectionChange(function (hasSelection) {
      ocrTranslateSelectionBtn.disabled = !hasSelection;
      ocrResetSelectionBtn.disabled = !hasSelection;
    });

    // Bind OCR events
    ocrCameraBtn.addEventListener('click', function () { ocrCameraInput.click(); });
    ocrGalleryBtn.addEventListener('click', function () { ocrGalleryInput.click(); });

    ocrCameraInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) handleOCRImageLoad(e.target.files[0]);
    });
    ocrGalleryInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) handleOCRImageLoad(e.target.files[0]);
    });

    ocrTranslateSelectionBtn.addEventListener('click', function () {
      translateCroppedRegion();
    });

    ocrTranslateAllBtn.addEventListener('click', function () {
      translateFullImage();
    });

    ocrResetSelectionBtn.addEventListener('click', function () {
      imageCropper.resetSelection();
    });

    ocrCancelBtn.addEventListener('click', function () {
      ocrPreviewSection.hidden = true;
      ocrProgress.hidden = true;
      imageCropper.clear();
      currentOCRFile = null;
      ocrCameraInput.value = '';
      ocrGalleryInput.value = '';
    });
  }

  async function handleOCRImageLoad(file) {
    if (!sourceLang || !targetLang) {
      showNotification('Please select source and target languages first.', 'warning', true);
      return;
    }

    currentOCRFile = file;
    ocrPreviewSection.hidden = false;
    ocrProgress.hidden = true;

    try {
      await imageCropper.loadImage(file);
      showNotification('Draw a rectangle on the image to select an area, or tap "Translate All".', 'info', true);
    } catch (err) {
      showNotification('Failed to load image: ' + err.message, 'error', true);
    }
  }

  async function translateCroppedRegion() {
    if (!imageCropper.hasSelection()) {
      showNotification('Please draw a selection on the image first.', 'warning', true);
      return;
    }

    var croppedCanvas = imageCropper.getCroppedCanvas();
    if (!croppedCanvas) return;

    // Convert canvas to blob and run OCR
    await runOCROnCanvas(croppedCanvas);
  }

  async function translateFullImage() {
    var fullCanvas = imageCropper.getFullCanvas();
    if (!fullCanvas) return;

    await runOCROnCanvas(fullCanvas);
  }

  async function runOCROnCanvas(sourceCanvas) {
    ocrEngine.setLanguage(sourceLang.code);
    ocrProgress.hidden = false;
    ocrProgressText.textContent = 'Extracting text...';
    ocrProgressFill.style.width = '0%';

    try {
      // Convert canvas to data URL for Tesseract
      var dataUrl = sourceCanvas.toDataURL('image/png');

      var extractedText = await ocrEngine.recognize(dataUrl, function (progress) {
        var pct = Math.round(progress * 100);
        ocrProgressFill.style.width = pct + '%';
        ocrProgressText.textContent = 'Extracting text... ' + pct + '%';
      });

      ocrProgressText.textContent = 'Text extracted! Translating...';
      ocrProgressFill.style.width = '100%';

      // Feed into translation pipeline
      var srcLabel = sourceLang.code.toUpperCase();
      var tgtLabel = targetLang.code.toUpperCase();

      var translatedText = await translationEngine.translate(extractedText);

      if (translatedText) {
        synthesizer.speak(translatedText);
        transcriptPanel.addEntry(extractedText, translatedText, srcLabel, tgtLabel);
        updateClearBtn();
        showNotification('Image translated successfully!', 'info', true);
      }

      setTimeout(function () { ocrProgress.hidden = true; }, 1500);
    } catch (error) {
      ocrProgressText.textContent = 'Failed: ' + error.message;
      showNotification('OCR/Translation error: ' + error.message, 'error', true);
      setTimeout(function () { ocrProgress.hidden = true; }, 3000);
    }

    ocrCameraInput.value = '';
    ocrGalleryInput.value = '';
  }

  // ═══════════════════════════════════════════════════════════════
  // Service Worker
  // ═══════════════════════════════════════════════════════════════

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.error('[SpeechTranslator:ServiceWorker] Registration failed:', err.message);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Entry Point
  // ═══════════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', init);
})();
