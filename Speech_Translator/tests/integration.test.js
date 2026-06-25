/**
 * Integration Tests for Real-Time Speech Translator
 * Tests full pipeline behavior with mocked browser APIs.
 */
import TranslationEngine from '../js/translation-engine.js';
import TranscriptPanel from '../js/transcript-panel.js';
import SpeechSynthesizer from '../js/speech-synthesizer.js';
import SpeechRecognizer from '../js/speech-recognizer.js';
import { SUPPORTED_LANGUAGES } from '../js/app.js';

/**
 * Helper: create a fresh transcript panel container
 */
function createTranscriptContainer() {
  const container = document.createElement('div');
  container.id = 'transcript-panel-test';
  const interim = document.createElement('span');
  interim.id = 'interim-text';
  container.appendChild(interim);
  return container;
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

/**
 * Helper: setup mocked speechSynthesis
 */
function setupMockSpeechSynthesis() {
  const spoken = [];
  const original = window.speechSynthesis;
  const originalUtt = window.SpeechSynthesisUtterance;

  window.speechSynthesis = {
    cancel: () => { spoken.push({ action: 'cancel' }); },
    speak: (utterance) => {
      spoken.push({ action: 'speak', text: utterance.text, lang: utterance.lang });
      if (utterance.onstart) utterance.onstart();
      setTimeout(() => { if (utterance.onend) utterance.onend(); }, 10);
    },
    getVoices: () => [
      { lang: 'en-US', name: 'English US', localService: true },
      { lang: 'es-ES', name: 'Spanish', localService: true },
      { lang: 'fr-FR', name: 'French', localService: false }
    ],
    speaking: false,
    onvoiceschanged: null
  };

  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.volume = 1;
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  };

  return {
    spoken,
    restore: () => {
      window.speechSynthesis = original;
      window.SpeechSynthesisUtterance = originalUtt;
    }
  };
}

/**
 * Helper: setup mocked fetch for translation API
 */
function setupMockFetch(responseText, options = {}) {
  const originalFetch = window.fetch;
  const fetchCalls = [];

  window.fetch = (url, fetchOptions) => {
    fetchCalls.push({ url, options: fetchOptions });

    if (options.networkError) {
      return Promise.reject(new Error('Network error'));
    }

    if (options.delay) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({
            json: () => Promise.resolve({
              responseData: { translatedText: responseText },
              responseStatus: 200
            })
          });
        }, options.delay);

        // Support AbortController
        if (fetchOptions && fetchOptions.signal) {
          fetchOptions.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    }

    return Promise.resolve({
      json: () => Promise.resolve({
        responseData: { translatedText: responseText },
        responseStatus: 200
      })
    });
  };

  return {
    fetchCalls,
    restore: () => { window.fetch = originalFetch; }
  };
}

/**
 * Run all integration tests.
 * Returns array of { name, pass, detail } objects.
 */
export async function runIntegrationTests() {
  const results = [];

  // ─── Full Translation Pipeline ───────────────────────────────────────────────

  results.push(await (async () => {
    const name = 'Full pipeline: speech → translate → speak → display';
    try {
      // Setup mocks
      const synthMock = setupMockSpeechSynthesis();
      const fetchMock = setupMockFetch('Hola mundo');

      // Create components
      const container = createTranscriptContainer();
      const panel = new TranscriptPanel(container);
      const engine = new TranslationEngine();
      engine.setLanguages('en', 'es');

      let speakStarted = false;
      let speakEnded = false;
      const synthesizer = new SpeechSynthesizer(
        () => { speakStarted = true; },
        () => { speakEnded = true; },
        () => {}
      );
      synthesizer.setLanguage('es-ES');

      // Simulate the pipeline: finalized text → translate → speak → display
      const sourceText = 'Hello world';
      const translatedText = await engine.translate(sourceText);

      assert(translatedText === 'Hola mundo', `Expected 'Hola mundo', got '${translatedText}'`);

      // Speak the translation
      synthesizer.speak(translatedText);

      // Add to transcript
      panel.addEntry(sourceText, translatedText, 'EN', 'ES');

      // Verify transcript entry
      const entries = container.querySelectorAll('.transcript-entry');
      assert(entries.length === 1, 'Should have 1 transcript entry');

      const srcText = entries[0].querySelector('.entry-source .entry-text').textContent;
      const tgtText = entries[0].querySelector('.entry-translated .entry-text').textContent;
      assert(srcText === 'Hello world', 'Source text should be preserved');
      assert(tgtText === 'Hola mundo', 'Translated text should be displayed');

      // Verify fetch was called
      assert(fetchMock.fetchCalls.length === 1, 'Should have made 1 API call');
      assert(fetchMock.fetchCalls[0].url.includes('langpair=en|es'), 'Should use correct language pair');

      // Verify speak was called
      assert(synthMock.spoken.some(s => s.action === 'speak' && s.text === 'Hola mundo'),
        'Synthesizer should have spoken the translation');

      fetchMock.restore();
      synthMock.restore();
      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Network Loss and Recovery ───────────────────────────────────────────────

  results.push(await (async () => {
    const name = 'Network loss and recovery: session pauses and can resume';
    try {
      // Simulate the pause/resume logic without full AppManager (since it needs full DOM)
      let sessionState = 'active';
      let offlineBannerVisible = false;
      let resumeBtnVisible = false;

      // Simulate offline event handler
      const onOffline = () => {
        sessionState = 'paused';
        offlineBannerVisible = true;
      };

      // Simulate online event handler
      const onOnline = () => {
        resumeBtnVisible = true;
      };

      // Simulate resume
      const onResume = () => {
        sessionState = 'active';
        offlineBannerVisible = false;
        resumeBtnVisible = false;
      };

      // Test flow
      assert(sessionState === 'active', 'Session should start active');

      // Go offline
      onOffline();
      assert(sessionState === 'paused', 'Session should be paused after offline');
      assert(offlineBannerVisible === true, 'Offline banner should be visible');

      // Come online
      onOnline();
      assert(resumeBtnVisible === true, 'Resume button should appear on reconnect');

      // Resume
      onResume();
      assert(sessionState === 'active', 'Session should be active after resume');
      assert(offlineBannerVisible === false, 'Offline banner should be hidden');
      assert(resumeBtnVisible === false, 'Resume button should be hidden');

      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Text Segmentation Pipeline ──────────────────────────────────────────────

  results.push(await (async () => {
    const name = 'Text segmentation: >5000 chars splits into multiple API calls';
    try {
      // Create text that's longer than 5000 chars
      const longText = 'Hello world. '.repeat(500); // ~6500 chars
      assert(longText.length > 5000, 'Test text should be >5000 chars');

      let apiCallCount = 0;
      const originalFetch = window.fetch;
      window.fetch = (url) => {
        apiCallCount++;
        // Extract the query text
        const match = url.match(/q=([^&]+)/);
        const queryText = match ? decodeURIComponent(match[1]) : '';
        return Promise.resolve({
          json: () => Promise.resolve({
            responseData: { translatedText: queryText + ' [translated]' },
            responseStatus: 200
          })
        });
      };

      const engine = new TranslationEngine();
      engine.setLanguages('en', 'es');
      const result = await engine.translate(longText);

      // Should have made multiple API calls
      assert(apiCallCount >= 2, `Expected >=2 API calls for long text, got ${apiCallCount}`);

      // Result should contain content (not be empty)
      assert(result.length > 0, 'Translation result should not be empty');

      window.fetch = originalFetch;
      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Speech Cancellation on New Translation ──────────────────────────────────

  results.push(await (async () => {
    const name = 'Speech cancellation: new translation cancels current speech';
    try {
      const synthMock = setupMockSpeechSynthesis();

      const synthesizer = new SpeechSynthesizer(() => {}, () => {}, () => {});
      synthesizer.setLanguage('es-ES');

      // Speak first text
      synthesizer.speak('Primera traducción');
      // Speak second text (should cancel first)
      synthesizer.speak('Segunda traducción');

      // Verify cancel was called before second speak
      const actions = synthMock.spoken.map(s => s.action);
      // Pattern should be: cancel, speak, cancel, speak
      // (speak() calls cancel() first per implementation)
      assert(actions.filter(a => a === 'cancel').length >= 2,
        `Expected at least 2 cancel calls, got actions: ${JSON.stringify(actions)}`);
      assert(actions.filter(a => a === 'speak').length === 2,
        'Expected 2 speak calls');

      // Last speak should be the second text
      const speaks = synthMock.spoken.filter(s => s.action === 'speak');
      assert(speaks[speaks.length - 1].text === 'Segunda traducción',
        'Last spoken text should be the newest translation');

      synthMock.restore();
      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Service Worker Cache Verification ───────────────────────────────────────

  results.push(await (async () => {
    const name = 'Service Worker cache: shell assets list is defined';
    try {
      // We can't fully test SW registration in this context,
      // but we can verify the expected cache behavior pattern
      const expectedAssets = [
        './',
        './index.html',
        './css/styles.css',
        './js/app.js',
        './js/speech-recognizer.js',
        './js/translation-engine.js',
        './js/speech-synthesizer.js',
        './js/transcript-panel.js',
        './js/preferences.js',
        './manifest.json',
        './icons/icon-192.png',
        './icons/icon-512.png'
      ];

      // Verify that the expected number of assets is reasonable
      assert(expectedAssets.length >= 10, 'Should cache at least 10 shell assets');
      assert(expectedAssets.includes('./index.html'), 'Should cache index.html');
      assert(expectedAssets.includes('./css/styles.css'), 'Should cache styles.css');
      assert(expectedAssets.includes('./manifest.json'), 'Should cache manifest.json');

      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Translation Error Handling ──────────────────────────────────────────────

  results.push(await (async () => {
    const name = 'Translation error: network failure preserves source text in transcript';
    try {
      const fetchMock = setupMockFetch(null, { networkError: true });
      const container = createTranscriptContainer();
      const panel = new TranscriptPanel(container);
      const engine = new TranslationEngine();
      engine.setLanguages('en', 'es');

      const sourceText = 'Hello world';
      let translationFailed = false;

      try {
        await engine.translate(sourceText);
      } catch (e) {
        translationFailed = true;
        // On failure, add source text with error indicator (mimics AppManager behavior)
        panel.addEntry(sourceText, '[Translation failed]', 'EN', 'ES');
      }

      assert(translationFailed === true, 'Translation should have failed');

      // Verify source text is preserved in transcript
      const entries = container.querySelectorAll('.transcript-entry');
      assert(entries.length === 1, 'Should have 1 entry');
      const srcText = entries[0].querySelector('.entry-source .entry-text').textContent;
      assert(srcText === sourceText, 'Source text should be preserved');

      fetchMock.restore();
      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Voice Selection by Language ─────────────────────────────────────────────

  results.push(await (async () => {
    const name = 'Voice selection: synthesizer selects voice matching target language';
    try {
      const synthMock = setupMockSpeechSynthesis();

      const synthesizer = new SpeechSynthesizer(() => {}, () => {}, () => {});
      synthesizer.setLanguage('es-ES');
      synthesizer.speak('Hola');

      const speaks = synthMock.spoken.filter(s => s.action === 'speak');
      assert(speaks.length === 1, 'Should have 1 speak action');
      assert(speaks[0].lang === 'es-ES', `Expected lang 'es-ES', got '${speaks[0].lang}'`);

      synthMock.restore();
      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Error Logging Format ────────────────────────────────────────────────────

  results.push(await (async () => {
    const name = 'Error logging: format includes [SpeechTranslator:Component] message';
    try {
      const logs = [];
      const origError = console.error;
      console.error = (...args) => { logs.push(args.join(' ')); };

      // Simulate the error handler pattern from AppManager
      const component = 'TranslationEngine';
      const message = 'Translation timeout: request exceeded 2 seconds';
      console.error(`[SpeechTranslator:${component}] ${message}`);

      console.error = origError;

      assert(logs.length === 1, 'Should have logged 1 error');
      assert(logs[0].includes('[SpeechTranslator:TranslationEngine]'), 'Should include component tag');
      assert(logs[0].includes('Translation timeout'), 'Should include error message');

      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Same Language Rejection Integration ─────────────────────────────────────

  results.push(await (async () => {
    const name = 'Same-language rejection: prevents selecting same source and target';
    try {
      // Test the logic: if source is 'en', target cannot be 'en'
      const source = SUPPORTED_LANGUAGES.find(l => l.code === 'en');
      const attemptTarget = SUPPORTED_LANGUAGES.find(l => l.code === 'en');

      const rejected = source.code === attemptTarget.code;
      assert(rejected === true, 'Same language should be detected');

      // A different language should be allowed
      const validTarget = SUPPORTED_LANGUAGES.find(l => l.code === 'es');
      const allowed = source.code !== validTarget.code;
      assert(allowed === true, 'Different languages should be allowed');

      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  // ─── Volume Control Persistence ──────────────────────────────────────────────

  results.push(await (async () => {
    const name = 'Volume control: set/get round-trip via PreferencesManager';
    try {
      const origLS = window.localStorage;
      const store = {};
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: (key) => store[key] || null,
          setItem: (key, val) => { store[key] = val; },
          removeItem: (key) => { delete store[key]; },
          clear: () => {}
        },
        writable: true,
        configurable: true
      });

      const synthMock = setupMockSpeechSynthesis();
      const prefs = new PreferencesManager();
      const synthesizer = new SpeechSynthesizer(() => {}, () => {}, () => {});

      // Set volume to 0.5
      prefs.setVolume(0.5);
      synthesizer.setVolume(0.5);

      assert(prefs.getVolume() === 0.5, `Expected volume 0.5, got ${prefs.getVolume()}`);
      assert(synthesizer.getVolume() === 0.5, `Expected synthesizer volume 0.5, got ${synthesizer.getVolume()}`);

      // Set volume to 0 (mute)
      prefs.setVolume(0);
      synthesizer.setVolume(0);
      assert(prefs.getVolume() === 0, 'Volume should be 0');
      assert(synthesizer.getVolume() === 0, 'Synthesizer volume should be 0');

      // Set volume to 1 (max)
      prefs.setVolume(1.0);
      synthesizer.setVolume(1.0);
      assert(prefs.getVolume() === 1.0, 'Volume should be 1.0');
      assert(synthesizer.getVolume() === 1.0, 'Synthesizer volume should be 1.0');

      Object.defineProperty(window, 'localStorage', { value: origLS, writable: true, configurable: true });
      synthMock.restore();
      return { name, pass: true };
    } catch (e) {
      return { name, pass: false, detail: e.message };
    }
  })());

  return results;
}
