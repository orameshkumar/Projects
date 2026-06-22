/**
 * voice-engine.js - Voice Recognition Engine for ABC Provisional Store
 *
 * Implements:
 *   6.1 - Web Speech API initialization and browser support detection
 *   6.2 - Continuous speech recognition start/stop with mic button toggle
 *   6.3 - Voice command parser: tokenize transcript, match voice tags, extract quantities
 *   6.4 - Quantity word-to-grams conversion
 *   6.5 - Integration with billing screen: add recognized item-quantity pairs
 *   6.6 - Unrecognized segment highlighting for manual correction
 */

const VoiceEngine = (function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────────────

  let recognition = null;
  let isListening = false;
  let isSupported = false;
  let voiceBtn = null;

  // ─── Number Word Mappings ───────────────────────────────────────────────────

  const NUMBER_WORDS = {
    'zero': 0,
    'one': 1,
    'two': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10,
    'eleven': 11,
    'twelve': 12,
    'thirteen': 13,
    'fourteen': 14,
    'fifteen': 15,
    'sixteen': 16,
    'seventeen': 17,
    'eighteen': 18,
    'nineteen': 19,
    'twenty': 20,
    'thirty': 30,
    'forty': 40,
    'fifty': 50,
    'sixty': 60,
    'seventy': 70,
    'eighty': 80,
    'ninety': 90,
    'hundred': 100,
    'thousand': 1000
  };

  // ─── 6.1: Initialization & Browser Support Detection ────────────────────────

  /**
   * Initialize the Voice Engine.
   * Checks Web Speech API support, sets up the #voice-btn click handler.
   * If not supported, disables the voice button and shows a message.
   */
  function init() {
    voiceBtn = document.getElementById('voice-btn');

    // Detect Web Speech API support
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      isSupported = false;
      if (voiceBtn) {
        voiceBtn.disabled = true;
        voiceBtn.title = 'Voice input not supported in this browser';
        voiceBtn.setAttribute('aria-disabled', 'true');
      }
      console.warn('VoiceEngine: Web Speech API not supported in this browser.');
      return;
    }

    isSupported = true;

    // Create recognition instance
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    // Set up recognition event handlers
    recognition.onresult = onRecognitionResult;
    recognition.onerror = onRecognitionError;
    recognition.onend = onRecognitionEnd;

    // Set up voice button click handler
    if (voiceBtn) {
      voiceBtn.addEventListener('click', toggleRecognition);
    }
  }

  // ─── 6.2: Start/Stop Recognition ───────────────────────────────────────────

  /**
   * Toggle speech recognition on/off when voice button is clicked.
   */
  function toggleRecognition() {
    if (!isSupported || !recognition) return;

    if (isListening) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }

  /**
   * Start continuous speech recognition.
   */
  function startRecognition() {
    if (!recognition) return;

    try {
      recognition.start();
      isListening = true;
      if (voiceBtn) {
        voiceBtn.classList.add('listening');
        voiceBtn.setAttribute('aria-label', 'Stop voice billing');
      }
    } catch (e) {
      console.error('VoiceEngine: Failed to start recognition', e);
    }
  }

  /**
   * Stop speech recognition.
   */
  function stopRecognition() {
    if (!recognition) return;

    try {
      recognition.stop();
    } catch (e) {
      // Ignore errors on stop
    }
    isListening = false;
    if (voiceBtn) {
      voiceBtn.classList.remove('listening');
      voiceBtn.setAttribute('aria-label', 'Start voice billing');
    }
  }

  /**
   * Handle recognition end event (auto-restart if still in listening mode).
   */
  function onRecognitionEnd() {
    // If we were still supposed to be listening, recognition ended unexpectedly
    // (e.g., due to silence timeout). Restart it.
    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        // If restart fails, update UI state
        isListening = false;
        if (voiceBtn) {
          voiceBtn.classList.remove('listening');
          voiceBtn.setAttribute('aria-label', 'Start voice billing');
        }
      }
    }
  }

  /**
   * Handle recognition errors.
   */
  function onRecognitionError(event) {
    console.error('VoiceEngine: Recognition error:', event.error);

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showNotification('Microphone access denied. Please allow microphone permission.');
      stopRecognition();
    } else if (event.error === 'no-speech') {
      // Silence — this is normal, recognition will restart via onend
    }
  }

  // ─── 6.3: Voice Command Parser ─────────────────────────────────────────────

  /**
   * Handle recognition result: parse transcript and process commands.
   * @param {SpeechRecognitionEvent} event
   */
  async function onRecognitionResult(event) {
    // Get the latest result
    var lastResultIndex = event.results.length - 1;
    var result = event.results[lastResultIndex];

    if (!result.isFinal) return;

    var transcript = result[0].transcript;
    console.log('VoiceEngine: Transcript:', transcript);

    // Parse the voice command
    var parsed = await parseVoiceCommand(transcript);

    // 6.5: Add recognized pairs to billing
    if (parsed.recognized.length > 0) {
      for (var i = 0; i < parsed.recognized.length; i++) {
        var pair = parsed.recognized[i];
        await Billing.addItemById(pair.itemId, pair.quantityGrams);
      }
    }

    // 6.6: Show unrecognized segments
    if (parsed.unrecognized.length > 0) {
      showUnrecognizedSegments(parsed.unrecognized);
    }
  }

  /**
   * Parse a voice command transcript into item-quantity pairs.
   * Algorithm:
   *   1. Normalize transcript (lowercase)
   *   2. Load items from DB, get voice tags
   *   3. Match voice tags as delimiters to identify items
   *   4. Extract quantity for each matched item
   *   5. Convert quantity to grams
   *   6. Return recognized pairs and unrecognized segments
   *
   * @param {string} transcript - Raw speech transcript
   * @returns {Promise<{recognized: Array, unrecognized: Array}>}
   */
  async function parseVoiceCommand(transcript) {
    var normalized = transcript.toLowerCase().trim();

    if (!normalized) {
      return { recognized: [], unrecognized: [] };
    }

    // Load all items to get voice tags
    var items = [];
    try {
      items = await DB.getAllItems();
    } catch (e) {
      console.error('VoiceEngine: Failed to load items', e);
      return { recognized: [], unrecognized: [normalized] };
    }

    // Filter items that have voice tags, sort by tag length descending (longer tags first)
    var taggedItems = items
      .filter(function (item) { return item.voiceTag && item.voiceTag.trim(); })
      .map(function (item) {
        return { id: item.id, name: item.name, tag: item.voiceTag.toLowerCase().trim() };
      })
      .sort(function (a, b) { return b.tag.length - a.tag.length; });

    if (taggedItems.length === 0) {
      return { recognized: [], unrecognized: [normalized] };
    }

    // Find all voice tag matches and their positions in the transcript
    var matches = [];
    var workingText = normalized;

    taggedItems.forEach(function (item) {
      var searchFrom = 0;
      var idx;
      while ((idx = workingText.indexOf(item.tag, searchFrom)) !== -1) {
        // Check word boundaries (not in the middle of another word)
        var before = idx > 0 ? workingText.charAt(idx - 1) : ' ';
        var after = idx + item.tag.length < workingText.length ? workingText.charAt(idx + item.tag.length) : ' ';
        if ((before === ' ' || before === ',') && (after === ' ' || after === ',')) {
          matches.push({
            itemId: item.id,
            itemName: item.name,
            tag: item.tag,
            startIndex: idx,
            endIndex: idx + item.tag.length
          });
        }
        searchFrom = idx + 1;
      }
    });

    // Sort matches by position in transcript
    matches.sort(function (a, b) { return a.startIndex - b.startIndex; });

    // Remove overlapping matches (keep the first/longest match at each position)
    var filteredMatches = [];
    var lastEnd = -1;
    matches.forEach(function (match) {
      if (match.startIndex >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.endIndex;
      }
    });

    // Extract quantity for each matched item from the text following the tag
    var recognized = [];
    var unrecognized = [];

    for (var i = 0; i < filteredMatches.length; i++) {
      var match = filteredMatches[i];
      // The quantity text is between this match's end and the next match's start (or end of string)
      var qtyStart = match.endIndex;
      var qtyEnd = (i + 1 < filteredMatches.length) ? filteredMatches[i + 1].startIndex : normalized.length;
      var qtyText = normalized.substring(qtyStart, qtyEnd).trim();

      var grams = parseQuantityToGrams(qtyText);

      if (grams > 0) {
        recognized.push({ itemId: match.itemId, quantityGrams: grams });
      } else {
        // Item found but quantity not recognized
        unrecognized.push(match.itemName + ' ' + qtyText);
      }
    }

    // Check for text before the first match that isn't recognized
    if (filteredMatches.length > 0 && filteredMatches[0].startIndex > 0) {
      var leadingText = normalized.substring(0, filteredMatches[0].startIndex).trim();
      if (leadingText) {
        unrecognized.push(leadingText);
      }
    }

    // If no matches at all, the entire transcript is unrecognized
    if (filteredMatches.length === 0) {
      unrecognized.push(normalized);
    }

    return { recognized: recognized, unrecognized: unrecognized };
  }

  // ─── 6.4: Quantity Word-to-Grams Conversion ────────────────────────────────

  /**
   * Parse a quantity string and convert to grams.
   * Handles patterns like:
   *   "half kg" → 500, "one kg" → 1000, "two kg" → 2000
   *   "hundred gram" → 100, "fifty gram" → 50
   *   "two hundred fifty gram" → 250
   *   "five hundred gram" → 500
   *   "seven fifty gram" or "750 gram" → 750
   *   "quarter kg" → 250, "three quarter" → 750
   *   Pure numbers: "100 g", "500 g", "1 kg"
   *
   * @param {string} text - The quantity portion of the transcript
   * @returns {number} Quantity in grams, or 0 if not parseable
   */
  function parseQuantityToGrams(text) {
    if (!text) return 0;

    var cleaned = text.toLowerCase().trim()
      .replace(/,/g, '')
      .replace(/\s+/g, ' ');

    if (!cleaned) return 0;

    // ─── Direct phrase matching (highest priority) ─────────────────────

    // Half kg / half kilo
    if (/\bhalf\s*(kg|kilo|kilogram)\b/.test(cleaned)) return 500;

    // Plain "half" (assumed half kg in a store context)
    if (/^\s*half\s*$/.test(cleaned)) return 500;

    // Quarter kg
    if (/\bquarter\s*(kg|kilo|kilogram)\b/.test(cleaned)) return 250;

    // Plain "quarter" (assumed quarter kg)
    if (/^\s*quarter\s*$/.test(cleaned)) return 250;

    // Three quarter / three quarters
    if (/\bthree\s*quarter/.test(cleaned)) return 750;

    // ─── Numeric + unit patterns ──────────────────────────────────────

    // Pattern: pure number followed by kg/kilo/g/gram/grams
    var numUnitMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|g|gram|grams)$/);
    if (numUnitMatch) {
      var num = parseFloat(numUnitMatch[1]);
      var unit = numUnitMatch[2];
      if (unit === 'kg' || unit === 'kilo' || unit === 'kilogram') {
        return num * 1000;
      } else {
        return num;
      }
    }

    // Pattern: number only (assume grams if small, check context)
    var pureNumMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
    if (pureNumMatch) {
      var pureNum = parseFloat(pureNumMatch[1]);
      // If it looks like kg (small number), treat as grams anyway
      // since without a unit we assume grams
      return pureNum;
    }

    // ─── Word-based patterns ──────────────────────────────────────────

    // Check if unit is kg/kilo or gram/grams
    var isKg = /\b(kg|kilo|kilogram)\b/.test(cleaned);
    var isGram = /\b(g|gram|grams)\b/.test(cleaned);

    // Remove the unit words to extract the number part
    var numPart = cleaned
      .replace(/\b(kg|kilo|kilogram|g|gram|grams)\b/g, '')
      .trim();

    if (!numPart && !isKg && !isGram) {
      // No unit and no number — try parsing the whole thing as a number word
      var wholeAsNum = wordsToNumber(cleaned);
      if (wholeAsNum > 0) return wholeAsNum;
      return 0;
    }

    // Parse number words to numeric value
    var numericValue = wordsToNumber(numPart);

    if (numericValue <= 0) {
      // Try parsing as a plain number from the numPart
      var parsed = parseFloat(numPart);
      if (!isNaN(parsed) && parsed > 0) {
        numericValue = parsed;
      } else {
        return 0;
      }
    }

    // Convert to grams based on unit
    if (isKg) {
      return numericValue * 1000;
    } else if (isGram) {
      return numericValue;
    } else {
      // No explicit unit found — assume grams
      return numericValue;
    }
  }

  /**
   * Convert number words to a numeric value.
   * Handles combinations like "two hundred fifty" → 250, "seven fifty" → 750.
   *
   * @param {string} text - Text containing number words
   * @returns {number} The numeric value, or 0 if not parseable
   */
  function wordsToNumber(text) {
    if (!text) return 0;

    var cleaned = text.trim().toLowerCase();
    if (!cleaned) return 0;

    // Try direct parse as number first
    var directNum = parseFloat(cleaned);
    if (!isNaN(directNum) && String(directNum) === cleaned) {
      return directNum;
    }

    // Special compound patterns
    // "seven fifty" = 750 (spoken shorthand)
    if (/\bseven\s+fifty\b/.test(cleaned)) return 750;
    // "two fifty" = 250
    if (/\btwo\s+fifty\b/.test(cleaned)) return 250;
    // "one fifty" = 150
    if (/\bone\s+fifty\b/.test(cleaned)) return 150;
    // "three fifty" = 350
    if (/\bthree\s+fifty\b/.test(cleaned)) return 350;
    // "four fifty" = 450
    if (/\bfour\s+fifty\b/.test(cleaned)) return 450;
    // "five fifty" = 550
    if (/\bfive\s+fifty\b/.test(cleaned)) return 550;

    var words = cleaned.split(/\s+/);
    var total = 0;
    var current = 0;

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var value = NUMBER_WORDS[word];

      if (value === undefined) {
        // Try parsing as numeric
        var numVal = parseFloat(word);
        if (!isNaN(numVal)) {
          value = numVal;
        } else {
          // Unrecognized word — return what we have or 0
          continue;
        }
      }

      if (value === 100) {
        // "hundred" multiplies the current accumulator
        current = current === 0 ? 100 : current * 100;
      } else if (value === 1000) {
        // "thousand" multiplies current and adds to total
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else {
        current += value;
      }
    }

    total += current;
    return total;
  }

  // ─── 6.5: Integration with Billing (handled in onRecognitionResult) ─────────

  // ─── 6.6: Unrecognized Segment Highlighting ────────────────────────────────

  /**
   * Show unrecognized segments as a notification below the voice button
   * for manual correction.
   * @param {Array<string>} segments - Array of unrecognized text segments
   */
  function showUnrecognizedSegments(segments) {
    var message = 'Could not recognize: "' + segments.join('", "') + '"';
    showNotification(message);
  }

  /**
   * Show a notification/toast message near the voice button.
   * Creates or reuses a notification div below #voice-btn.
   * @param {string} message - The message to display
   */
  function showNotification(message) {
    var notifId = 'voice-notification';
    var notif = document.getElementById(notifId);

    if (!notif) {
      // Create the notification element below the voice button
      notif = document.createElement('div');
      notif.id = notifId;
      notif.className = 'voice-notification';
      notif.setAttribute('role', 'alert');
      notif.setAttribute('aria-live', 'polite');

      // Insert after voice button
      if (voiceBtn && voiceBtn.parentNode) {
        voiceBtn.parentNode.insertBefore(notif, voiceBtn.nextSibling);
      } else {
        // Fallback: append to billing top area
        var billingTop = document.querySelector('.billing-top');
        if (billingTop) {
          billingTop.appendChild(notif);
        } else {
          document.body.appendChild(notif);
        }
      }
    }

    notif.textContent = message;
    notif.classList.add('visible');

    // Auto-hide after 5 seconds
    clearTimeout(notif._hideTimeout);
    notif._hideTimeout = setTimeout(function () {
      notif.classList.remove('visible');
    }, 5000);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    init: init,
    // Exposed for testing/external use
    parseQuantityToGrams: parseQuantityToGrams,
    parseVoiceCommand: parseVoiceCommand,
    wordsToNumber: wordsToNumber
  };

})();
