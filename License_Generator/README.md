# Pay Up Partners — License Generator

## Purpose

This is a private tool for the Pay Up Partners app owner. It generates license keys that unlock unlimited client access in the Pay Up Partners app.

Without a license key, Pay Up Partners users are limited to 5 clients. A valid license key removes this restriction.

---

## Installation

The License Generator is a standalone web app that must be served via localhost (same as Pay Up Partners).

### Quick Start:

```
npx http-server -p 8081
```

Run this command from inside the `License_Generator` folder, then open `http://localhost:8081` in your browser.

### Alternative methods:

- **VS Code Live Server:** Right-click `index.html` → Open with Live Server
- **Python:** `python -m http.server 8081` (run from the License_Generator folder)

> **Important:** Use a different port (e.g., 8081) if Pay Up Partners is already running on port 8080.

---

## Usage

1. Open the License Generator in your browser (`http://localhost:8081`)
2. Enter the **user's name** in the text field (this is the name that will appear in their app as the licensee)
3. Click **Generate License**
4. The license key appears in the output area
5. Click **📋 Copy to Clipboard** to copy the key
6. Give the key to your user — they enter it in Pay Up Partners under Settings → License → Activate

### Notes:

- The key is specific to the name entered — a key generated for "Ramesh" only works when "Ramesh" is the licensee name
- You can generate keys for as many users as you want
- There is no expiry on generated keys
- Press Enter after typing the name to generate quickly

---

## How It Works

The License Generator creates keys using HMAC-SHA256 (a cryptographic signing algorithm):

1. You enter a user name
2. The app computes an HMAC-SHA256 hash of the name using a shared secret key
3. The name and hash are packaged into a JSON object: `{"n": "name", "h": "hash"}`
4. The JSON is encoded as Base64 — this is the license key

When a user enters this key in Pay Up Partners:
1. The app decodes the Base64
2. Extracts the name and hash
3. Recomputes the HMAC using the same shared secret
4. If the computed hash matches the stored hash, the key is valid

This ensures only keys generated with the correct secret are accepted — you can't forge a key without knowing the secret.

---

## Security Notes

- **Keep this app private.** Anyone with access to the License Generator can create unlimited license keys.
- **Do not distribute** the License Generator files to users.
- **Do not share** the source code of this app with users — it contains the shared secret (obfuscated but recoverable).
- The shared secret is embedded in both the License Generator and Pay Up Partners. It is the same in both apps, stored as an array of character codes to prevent casual discovery.
- This is obfuscation, not encryption — a determined developer could extract the secret from source code. The goal is to prevent casual bypassing.

---

## Troubleshooting

### "Generate" button does nothing / Error generating license

**Cause:** The Web Crypto API (`crypto.subtle`) is only available on localhost or HTTPS.

**Fix:** Make sure you're accessing the app via `http://localhost:8081` (not by opening the HTML file directly).

### Copied key doesn't work in Pay Up Partners

**Possible causes:**
- The name was entered differently (extra spaces, different capitalization). The key is case-sensitive.
- The key was partially copied — make sure you copy the entire text from the output area.
- The key was modified during transfer (e.g., messaging app added line breaks).

**Fix:** Regenerate the key and copy it carefully. Use the "Copy to Clipboard" button for accuracy.

### App looks broken or doesn't load

**Fix:** Ensure all files are present in the folder:
- `index.html`
- `app.js`
- `styles.css`
- `manifest.json`
- `sw.js`
- `icon-192.png`
- `icon-512.png`

---

## File Structure

```
License_Generator/
├── index.html      ← Main page
├── app.js          ← License generation logic
├── styles.css      ← Dark theme styling
├── manifest.json   ← PWA manifest
├── sw.js           ← Service Worker (offline support)
├── icon-192.png    ← App icon (small)
└── icon-512.png    ← App icon (large)
```
