# Speech Translator — User Guide

## Overview

Speech Translator is a Progressive Web App (PWA) that provides real-time speech-to-speech translation. Speak in one language, and the app translates and speaks the result in another language. You can also capture or upload images containing text to translate.

---

## Getting Started

### Recommended Setup

For the best experience (persistent microphone permission, PWA install, offline shell):

1. Open a terminal in the `Speech_Translator` folder
2. Start a local server:
   - **Python:** `python -m http.server 8080`
   - **Node.js:** `npx serve .`
3. Open `http://localhost:8080` in **Google Chrome** or **Microsoft Edge**
4. Grant microphone access when prompted (only asked once)

### Quick Start (file:// protocol)

You can also double-click `index.html` directly, but:
- Microphone permission will be asked every session
- PWA install won't work
- Service Worker caching won't activate

---

## Features

### 1. Speech Translation (Voice)

1. Select a **Source Language** (the language you speak)
2. Select a **Target Language** (the language to translate into)
3. Press **🎤 Start**
4. Speak clearly into your microphone
5. The app will:
   - Show your words as you speak (interim text)
   - Translate the finalized text
   - Speak the translation aloud
   - Display both source and translated text in the transcript
6. Press **⏹ Stop** when done

### 2. Image Translation (OCR)

1. Select source and target languages
2. Press **📷 Camera** to take a photo, or **🖼️ Gallery** to pick an existing image
3. The app will:
   - Show a preview of the image
   - Extract text using OCR (progress bar shown)
   - Translate the extracted text
   - Speak the translation and add it to the transcript
4. Works best with printed text (signs, menus, documents)

### 3. Playback

- **🔁 Replay** button: Replays the most recent translation
- **🔊 buttons on entries**: Each transcript entry has play buttons for both the source text and translated text — tap to hear either one spoken aloud
- **Volume slider**: Adjust speech output volume (persisted across sessions)

### 4. Language Swap

Press the **⇄** button between the language dropdowns to instantly swap source and target languages.

### 5. Session Management

| Button | Action |
|--------|--------|
| 🎤 Start | Begin listening and translating |
| ⏹ Stop | Stop listening |
| Clear | Clear all transcript entries (stops session if active) |

### 6. PWA Installation

When served via HTTP:
1. Look for the install icon in Chrome's address bar (or "Add to Home screen" on mobile)
2. Once installed, the app launches in standalone mode (no browser chrome)
3. The app shell loads offline; translation requires internet

---

## Supported Languages

| Language | Speech Recognition | Translation | Text-to-Speech | OCR |
|----------|-------------------|-------------|----------------|-----|
| English | ✅ | ✅ | ✅ | ✅ |
| Spanish | ✅ | ✅ | ✅ | ✅ |
| French | ✅ | ✅ | ✅ | ✅ |
| German | ✅ | ✅ | ✅ | ✅ |
| Italian | ✅ | ✅ | ✅ | ✅ |
| Portuguese | ✅ | ✅ | ✅ | ✅ |
| Hindi | ✅ | ✅ | ✅ | ✅ |
| Japanese | ✅ | ✅ | ✅ | ✅ |
| Korean | ✅ | ✅ | ✅ | ✅ |
| Chinese | ✅ | ✅ | ✅ | ✅ |

---

## Internet Requirements

| Feature | Needs Internet |
|---------|---------------|
| App loading (after first visit) | ❌ Cached offline |
| Speech Recognition (voice → text) | ✅ Chrome sends audio to Google |
| Translation (text → target language) | ✅ MyMemory API |
| Text-to-Speech (translated → audio) | ❌ Uses local OS voices |
| OCR (image → text) | ✅ First use downloads Tesseract data (~2-4 MB) |
| OCR (after data cached) | ❌ Runs locally in browser |

If you go offline during a session, the app pauses automatically and shows a **Resume** button when connectivity returns.

---

## Transcript Panel

- Displays source text and translated text as paired entries
- Maximum **200 entries** — oldest entries are removed when the limit is reached
- Auto-scrolls to newest entry (pauses if you scroll up manually)
- Each entry has 🔊 play buttons for both source and translated text

---

## Troubleshooting

### Microphone keeps asking for permission
You're opening the file directly (`file://`). Serve via HTTP instead (see Getting Started above).

### No speech detected
- Check that your microphone is working (test in OS settings)
- Speak clearly and at normal volume
- Ensure the correct source language is selected
- Try Chrome or Edge (Firefox/Safari have limited Speech API support)

### Translation fails or times out
- Check your internet connection
- MyMemory API has rate limits — wait a few seconds between heavy usage
- The app retries automatically (up to 2 times)

### OCR doesn't recognize text
- Ensure image is clear and well-lit
- Printed text works best; handwriting has limited support
- Select the correct source language (OCR needs to know what language to look for)
- Complex fonts or stylized text may not be recognized

### No audio output
- Check that volume slider is not at 0
- Some languages may not have a TTS voice available on your OS
- Try a different target language to test

### App won't install as PWA
- Must be served via HTTPS or localhost (not `file://`)
- Use Chrome or Edge
- Check for the install icon in the address bar

---

## Browser Compatibility

| Browser | Speech Recognition | TTS | OCR | PWA Install |
|---------|-------------------|-----|-----|-------------|
| Chrome (desktop) | ✅ | ✅ | ✅ | ✅ |
| Chrome (Android) | ✅ | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ |
| Firefox | ❌ | ✅ | ✅ | ❌ |
| Safari | ❌ | ✅ | ✅ | Limited |

**Recommended: Google Chrome** (desktop or Android)

---

## Technical Notes

- No server or backend required — everything runs in the browser
- No API keys needed — uses free MyMemory translation API
- No build tools — plain HTML/CSS/JavaScript
- Data is not stored or sent anywhere except to Google (for speech recognition) and MyMemory (for translation)
- User preferences (language selection, volume) are saved in localStorage
- OCR uses Tesseract.js v5 loaded from CDN

---

## Keyboard Shortcuts

Currently the app is touch/click based. No keyboard shortcuts are configured.

---

## Privacy

- **Speech audio** is sent to Google's servers for recognition (standard Web Speech API behavior)
- **Text for translation** is sent to MyMemory API (mymemory.translated.net)
- **Images for OCR** are processed entirely in your browser — never uploaded anywhere
- **No user data is stored on any server** — preferences are local to your browser
