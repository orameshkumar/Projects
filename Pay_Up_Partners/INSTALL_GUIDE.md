# Pay Up Partners — Installation Guide

## Prerequisites

- **A modern web browser:** Google Chrome (recommended), Microsoft Edge, or Firefox
- **A local web server:** Required because the app uses the Web Crypto API (`crypto.subtle`) which only works on localhost or HTTPS

> **Important:** You cannot simply open `index.html` by double-clicking it. The file must be served through a web server (localhost) for the cryptographic features (license validation) to work.

---

## Serving the App

Choose any one of these methods to serve Pay Up Partners on localhost:

### Option 1: VS Code Live Server (Easiest)

1. Open the `Pay_Up_Partners` folder in VS Code
2. Install the "Live Server" extension by Ritwick Dey (if not already installed)
3. Right-click on `index.html` and select **"Open with Live Server"**
4. The app opens in your browser at `http://127.0.0.1:5500` (or similar)

### Option 2: npx http-server (Node.js)

If you have Node.js installed:

```
npx http-server -p 8080
```

Run this command from inside the `Pay_Up_Partners` folder. Then open `http://localhost:8080` in your browser.

### Option 3: Python http.server

If you have Python installed:

```
python -m http.server 8080
```

Run this command from inside the `Pay_Up_Partners` folder. Then open `http://localhost:8080` in your browser.

---

## Installing as a PWA (Desktop)

Once the app is running in Chrome or Edge:

### Chrome:
1. Look for the **install icon** (a small monitor with a download arrow) in the address bar
2. Click it and select **"Install"**
3. The app installs as a standalone window — you can launch it from your Start Menu / Desktop

### Edge:
1. Click the **three-dot menu** (⋯) at the top-right
2. Select **Apps → Install this site as an app**
3. Confirm the installation

After installation, the app runs in its own window without browser chrome (address bar, tabs, etc.).

---

## Mobile Installation (Android)

### Chrome on Android:

1. Open the app URL in Chrome (e.g., `http://localhost:8080` if your phone can reach your computer, or serve it from a local network)
2. Tap the **three-dot menu** (⋮) at the top-right
3. Select **"Add to Home screen"** or **"Install app"**
4. Confirm by tapping **Add**
5. The app icon appears on your home screen

> **For true mobile use:** You'll need to serve the app on your local network (e.g., `http://192.168.1.x:8080`) so your phone can reach it. Alternatively, host it on any HTTPS server.

### Chrome on Android (self-hosted):

If you're running the server on your PC and want to access from your phone:

1. Find your PC's local IP address (e.g., `192.168.1.100`)
2. Start the server: `npx http-server -p 8080 --host 0.0.0.0`
3. On your phone, open `http://192.168.1.100:8080`
4. Add to Home Screen as above

---

## Updating the App

When the app files are updated:

### Method 1: Clear Service Worker Cache

1. Open Chrome DevTools (F12)
2. Go to **Application** tab → **Service Workers**
3. Click **"Unregister"** for the Pay Up Partners service worker
4. Reload the page (Ctrl+Shift+R or Cmd+Shift+R)

### Method 2: Hard Refresh

1. Press **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)
2. This bypasses the cache and loads fresh files

### Method 3: Clear Cache via DevTools

1. Open Chrome DevTools (F12)
2. Go to **Application** tab → **Cache Storage**
3. Delete all cached entries
4. Reload the page

---

## Troubleshooting

### "crypto.subtle is not available" or License Activation Fails

**Cause:** The Web Crypto API (`crypto.subtle`) is only available in secure contexts — `localhost`, `127.0.0.1`, or HTTPS.

**Fix:** Make sure you're accessing the app via `http://localhost:PORT` or `http://127.0.0.1:PORT`, not via `file://` protocol.

### App doesn't update after file changes

**Cause:** The Service Worker is serving cached files.

**Fix:** Unregister the service worker (see Updating section above) and hard-refresh.

### Data seems missing or corrupted

**Cause:** IndexedDB data may be corrupted.

**Fix:**
1. Open Chrome DevTools (F12)
2. Go to **Application** tab → **IndexedDB**
3. Find the "PayUpPartners" database
4. Right-click and **Delete database**
5. Reload the app (you'll lose all data — restore from a backup)

### Service Worker won't register

**Cause:** The `sw.js` file must be in the same directory as `index.html` (root of the app).

**Fix:** Verify `sw.js` exists in the `Pay_Up_Partners` folder root (not inside a subfolder).

### QR code not showing

**Cause:** The QR code library (`qrcode-lib.js`) may not be loaded.

**Fix:** Check browser console for errors. Ensure all JS files are present in the `js/` folder.

### PWA install button not showing

**Cause:** PWA install prompt only appears when:
- The app is served over localhost or HTTPS
- The `manifest.json` is valid and accessible
- A service worker is registered

**Fix:** Check that `manifest.json` is in the root folder and the `<link rel="manifest">` tag is in `index.html`.

---

## File Structure

```
Pay_Up_Partners/
├── index.html          ← Main app page
├── manifest.json       ← PWA manifest
├── sw.js              ← Service Worker
├── css/
│   └── styles.css     ← All styles (dark/light themes)
├── js/
│   ├── app.js         ← Navigation & initialization
│   ├── clients.js     ← Client management
│   ├── loans.js       ← Loan management
│   ├── collection.js  ← Daily EMI collection
│   ├── interest.js    ← Interest collection
│   ├── history.js     ← Payment history
│   ├── reports.js     ← Reports
│   ├── settings.js    ← Settings
│   ├── backup.js      ← Backup & restore
│   ├── license.js     ← License validation
│   ├── whatsapp.js    ← WhatsApp notifications
│   ├── db.js          ← IndexedDB wrapper
│   └── qrcode-lib.js  ← QR code generation library
└── icons/
    ├── icon-192.png
    └── icon-512.png
```
