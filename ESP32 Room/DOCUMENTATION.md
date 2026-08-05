# Room Controller — Complete Documentation
## Firebase + ESP32 + PWA — v2.0

---

## What this system does

Controls 6 room lights from any device — phone, tablet, laptop — using:
- **ESP32** board with 6 relay modules + 6 LED indicators
- **Firebase Realtime Database** as the communication bridge
- **PWA web app** hosted on GitHub Pages, installable on any device

---

## System architecture

```
PWA App (any device)
      ↓ writes override / slots
Firebase Realtime Database
      ↓ ESP32 polls every 3 seconds
ESP32 reads override → drives relay → writes lightOn back
      ↓
Relay switches light ON/OFF
      ↓
LED on board glows to confirm state
```

---

## Priority logic — how the system decides relay state

**Manual override always has highest priority. Schedule is only consulted in auto mode.**

```
┌─────────────────────────────────────────────────┐
│              applyState() — single entry point  │
│                                                 │
│  ovr = 1  → relay ON  (ignore schedule)         │
│  ovr = 0  → relay OFF (ignore schedule)         │
│  ovr = -1 → isInSlot()? → ON : OFF              │
└─────────────────────────────────────────────────┘
```

Every function that can change relay state goes through `applyState()`:

| Function | Frequency | Override guard |
|---|---|---|
| `pollOverrides()` | every 3 sec | skips empty/error reads |
| `checkSchedules()` | every 10 sec | `if (ovr != -1) continue` |
| `refreshSlotsOnly()` | every 60 sec | calls applyState() which checks ovr |
| `readAllRooms()` | on boot | keeps existing ovr on bad value |

Manual override set from the app is never cleared by a bad network read or a scheduled event.

---

## Overlapping slots behavior

When two slots overlap, the system merges them automatically:

| Scenario | Result |
|---|---|
| 9:00–11:00 + 10:00–12:00 | Merged → 9:00–12:00 (light stays ON) |
| 9:00–10:00 + 10:00–11:00 (adjacent) | Merged → 9:00–11:00 |
| 9:00–12:00 + 10:00–11:00 (contained) | Kept as 9:00–12:00 |
| 9:00–10:00 + 11:00–12:00 (gap) | Kept separate — OFF 10:00–11:00 |
| Recurring + manual same time | Duplicate ignored |

The PWA app shows a warning toast: ⚠️ Overlaps with 09:00–11:00 — slots merged

---

## Hardware required

| Item | Qty | Notes |
|---|---|---|
| ESP32 Dev Module | 1 | Any 38-pin variant |
| 6-channel relay module (5V) | 1 | Active-LOW preferred |
| LEDs (green recommended) | 6 | One per room |
| 330Ω resistors | 6 | One per LED |
| Jumper wires | 20 | Male-female |
| USB OTG adapter | 1 | For flashing from Android tablet |
| Power supply 5V 2A | 1 | For relay + ESP32 |

---

## Wiring reference

### Relay module → ESP32

```
Relay VCC  → ESP32 VIN (5V)
Relay GND  → ESP32 GND
Relay IN1  → ESP32 GPIO 26  (Room 1)
Relay IN2  → ESP32 GPIO 27  (Room 2)
Relay IN3  → ESP32 GPIO 14  (Room 3)
Relay IN4  → ESP32 GPIO 12  (Room 4)
Relay IN5  → ESP32 GPIO 13  (Room 5)
Relay IN6  → ESP32 GPIO 15  (Room 6)
```

### LED indicators → ESP32

```
GPIO 2  → 330Ω → LED+ (long leg) → LED- (short leg) → GND  (Room 1)
GPIO 4  → 330Ω → LED+ → LED- → GND  (Room 2)
GPIO 5  → 330Ω → LED+ → LED- → GND  (Room 3)
GPIO 18 → 330Ω → LED+ → LED- → GND  (Room 4)
GPIO 19 → 330Ω → LED+ → LED- → GND  (Room 5)
GPIO 21 → 330Ω → LED+ → LED- → GND  (Room 6)
```

### LED legs
```
Long  leg (+) = Positive = connects to resistor
Short leg (-) = Negative = connects to GND
Flat edge on base = negative side
```

### Load wiring (per relay)
```
COM terminal → Power supply +
NO terminal  → Load + (your light)
Load -       → Power supply -
```
⚠️ For mains voltage (220V), use an electrician for the load side.

---

## GPIO + Relay + LED pin map

| Room | Relay GPIO | LED GPIO |
|---|---|---|
| Room 1 | GPIO 26 | GPIO 2 |
| Room 2 | GPIO 27 | GPIO 4 |
| Room 3 | GPIO 14 | GPIO 5 |
| Room 4 | GPIO 12 | GPIO 18 |
| Room 5 | GPIO 13 | GPIO 19 |
| Room 6 | GPIO 15 | GPIO 21 |

---

## LED status indicator meanings

| LED state | Meaning |
|---|---|
| Solid ON | Room light is ON (relay active) |
| Solid OFF | Room light is OFF |
| Room 1 slow blink | Connecting to WiFi (boot) |
| All LEDs blink twice | WiFi connected successfully |
| All LEDs ON then sequence | Startup self-test |
| Room 1 fast blink (5×) | Firebase read error |
| All LEDs flash | WiFi lost |

---

## PART 1 — Firebase setup

### Step 1 — Create Realtime Database
1. Go to https://console.firebase.google.com
2. Open your project (roomcontrol-1d14d)
3. Build → Realtime Database → already created
4. Your database URL:
   ```
   https://roomcontrol-1d14d-default-rtdb.asia-southeast1.firebasedatabase.app
   ```

### Step 2 — Verify database rules
Go to Realtime Database → Rules tab. Should be:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### Step 3 — Verify initial data structure
Go to Realtime Database → Data tab. Should show:
```
rooms/
  room1/ name: "Room 1"  override: null  lightOn: false
  room2/ name: "Room 2"  override: null  lightOn: false
  room3/ name: "Room 3"  override: null  lightOn: false
  room4/ name: "Room 4"  override: null  lightOn: false
  room5/ name: "Room 5"  override: null  lightOn: false
  room6/ name: "Room 6"  override: null  lightOn: false
```

### Your credentials (already in sketch and README)
```
Database URL : https://roomcontrol-1d14d-default-rtdb.asia-southeast1.firebasedatabase.app
API Key      : AIzaSyAa1DZpoK03WeGkWOdyaCER-sl2KRwjVZA
```

---

## PART 2 — ESP32 setup via ArduinoDroid (Android tablet)

### Step 1 — Install apps on tablet
1. Install **ArduinoDroid** from Play Store
2. Install **Serial USB Terminal** from Play Store (for Serial Monitor)
3. Connect to WiFi and keep it on during first launch

### Step 2 — First launch SDK download
- Open ArduinoDroid
- It downloads the ESP32 SDK automatically (~500MB)
- Keep WiFi on, takes 5-10 minutes
- Progress bar shows at the bottom

### Step 3 — Verify library (ArduinoJson)
1. Tap ≡ menu → Library Manager
2. Search: `ArduinoJson`
3. Install if not already installed (by Benoit Blanchon)

Note: No Firebase library needed — the sketch uses built-in
WiFi + HTTPClient only. No library conflicts.

### Step 4 — Open the sketch
1. Copy `RoomController_Firebase.ino` to your tablet
   (via Google Drive download or USB)
2. In ArduinoDroid: ≡ menu → Open
3. Navigate to the file → tap to open

⚠️ The .ino file MUST be inside a folder with the SAME NAME:
```
RoomController_Firebase/
  RoomController_Firebase.ino   ← correct
```

### Step 5 — Edit WiFi credentials
Find these 2 lines near the top and edit:
```cpp
#define WIFI_SSID      "YOUR_WIFI_NAME"      // ← your WiFi name
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"  // ← your WiFi password
```
Everything else (Firebase URL, timezone, relay pins) is already configured.

### Step 6 — Select board
1. ≡ menu → Select Board
2. ESP32 Arduino → ESP32 Dev Module
3. Tap Select/OK

### Step 7 — Connect ESP32 via OTG
1. Plug OTG adapter into tablet USB port
2. Plug ESP32 USB cable into OTG adapter
3. Android shows popup → Allow ArduinoDroid to access USB → tap OK
4. ≡ menu → Select Port → tap the detected USB Serial device

### Step 8 — Upload sketch
1. ≡ menu → Upload (or tap → arrow)
2. Watch the log — uploading progress shown as percentage
3. If "Failed to connect" error:
   - Hold BOOT button on ESP32
   - Tap Upload again
   - Release BOOT when you see "Connecting......"
4. Success message: "Done uploading"

### Step 9 — Verify via Serial Monitor
1. ≡ menu → Serial Monitor → set 115200 baud
2. Press RST button on ESP32
3. Expected output:
```
=== Room Controller Booting ===
All relays + LEDs OFF
[LED startup test runs — all LEDs blink once]
WiFi connecting..........
Connected! IP: 192.168.x.x
NTP sync.....
Time: 14:30:00
Reading rooms from Firebase...
  Room 1 (Room 1): ovr=-1  slots=0  light=OFF
  Room 2 (Room 2): ovr=-1  slots=0  light=OFF
  ...
=== Ready! ===
```

### Step 10 — Test relay
Send a test from Firebase console:
1. Go to Firebase console → Realtime Database → rooms → room1
2. Click override → Edit → type `true` → Save
3. Serial Monitor should show:
   ```
   Room 1 override: -1 → 1
   [14:30:05] Room 1 → ON
   ```
4. Relay 1 clicks, LED 1 glows
5. Set override back to `null` → relay turns OFF

---

## PART 3 — PWA deployment on GitHub Pages

### Step 1 — Create GitHub repo
1. Go to https://github.com → New repository
2. Name: `room-controller`
3. Set to Public → Add README → Create

### Step 2 — Upload PWA files
1. In your repo → Add file → Upload files
2. Upload from `pwa/` folder:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
3. Commit changes

### Step 3 — Enable GitHub Pages
1. Settings → Pages (left sidebar)
2. Source: Deploy from a branch
3. Branch: main → / (root) → Save
4. Wait ~1 minute

### Step 4 — Get your URL
```
https://YOUR-USERNAME.github.io/room-controller
```

---

## PART 4 — Configure and install PWA

### Step 1 — Open on any device
Go to your GitHub Pages URL in Chrome

### Step 2 — Enter Firebase credentials
1. Tap Settings tab (bottom right)
2. Database URL:
   ```
   https://roomcontrol-1d14d-default-rtdb.asia-southeast1.firebasedatabase.app
   ```
3. API Key:
   ```
   AIzaSyAa1DZpoK03WeGkWOdyaCER-sl2KRwjVZA
   ```
4. Tap Save settings
5. Tap Test Firebase connection → ✓ Firebase connected!
6. Green dot appears in top right

### Step 3 — Install as app

Android (Chrome):
1. Open URL in Chrome
2. Chrome shows "Add to Home Screen" banner automatically
   OR tap ⋮ → Add to Home Screen
3. Tap Add → icon appears on home screen

iPhone/iPad (Safari only):
1. Open URL in Safari (NOT Chrome)
2. Tap Share button → Add to Home Screen
3. Tap Add

Windows/Mac (Chrome):
1. Click install icon in address bar
2. Click Install

### Step 4 — Rename rooms (optional)
1. Settings tab → Room names section
2. Edit each room name
3. Tap Save settings

---

## PART 5 — Daily operation

### Adding a schedule
1. Open app → Rooms tab
2. Tap a room card to expand
3. Tap Slots tab
4. Select Today or Tomorrow
5. Set Start and End time
6. Tap + Add slot
7. ESP32 picks it up within 60 seconds

### Manual override
1. Tap a room card → Override tab
2. Force ON → relay stays ON until cleared
3. Force OFF → relay stays OFF until cleared
4. Auto → returns to schedule control

### Timeline view
- 12-hour view — centered on current time
- Full day — midnight to midnight
- Tomorrow — tomorrow's schedule
- Red vertical line = current time
- Colored bars = scheduled slots
- Amber = manual ON, Red = manual OFF, Blue = scheduled

### Checking room status
1. PWA dashboard — amber dot = ON, dimmed = OFF
2. Firebase console → rooms → room1 → lightOn
3. LED on ESP32 board — glowing = ON
4. Serial Monitor — live relay log

---

## Troubleshooting

### Lights always ON after boot
Relay module is active-LOW — GPIO defaults to LOW before code runs.
This is normal — clears within 2 seconds once ESP32 initializes.
If persists: swap RELAY_ON/RELAY_OFF in sketch:
```cpp
#define RELAY_ON  HIGH   // ← swap these if relay logic is inverted
#define RELAY_OFF LOW
```

### Lights flickering every few minutes
Fixed in v2.0. Caused by `readAllRooms()` resetting slots to 0 during
a bad HTTP read. Now uses temp buffer — slots only updated if parse succeeds.

### Schedule not triggering
- Check Serial Monitor for "Schedule check at HH:MM"
- Verify slots show in Firebase console → rooms → room1 → slots
- Check timezone: IST = 19800, GMT = 0
- Slots refresh from Firebase every 60 seconds — wait after adding

### Override not working
- Tap Force ON in app → check Serial Monitor for "Room X override: -1 → 1"
- If not showing: check Firebase connection (green dot in app)
- Check Firebase console → room1 → override should show `true`

### PWA install option not showing
- Must use Chrome on Android, Safari on iPhone
- Must be served over HTTPS (GitHub Pages provides this)
- Must have valid icons — icons/icon-192.png and icons/icon-512.png
  must exist in the same folder as index.html

### ArduinoDroid upload fails
- Hold BOOT button on ESP32 during upload
- Use a data USB cable (not charge-only)
- Check OTG is properly detected (Allow popup appeared)

---

## Firebase data structure reference

```
/rooms/
  room1/
    name       : "Room 1"
    override   : null | true | false   ← PWA writes this
    lightOn    : true | false           ← ESP32 writes this
    slots      : [{s:"09:00", e:"11:00"}, ...]  ← today
    slotsT     : [{s:"09:00", e:"11:00"}, ...]  ← tomorrow
    lastSeen   : "14:32:05"             ← ESP32 heartbeat
    updatedAt  : 1234567890             ← timestamp
```

---

## Polling intervals

| Task | Interval | Purpose |
|---|---|---|
| Override poll | 3 seconds | Detect manual override change |
| Schedule check | 10 seconds | Slot start/end relay control |
| Slot refresh | 60 seconds | Pick up new slots from PWA |
| Heartbeat push | 5 minutes | Keep Firebase status current |

---

## Firebase free tier usage

Your daily read estimate: ~250,000 reads
Firebase free tier limits: unlimited reads/writes, 1GB storage, 10GB bandwidth/month
Your bandwidth: ~500MB/month (well within free tier)
No paid plan needed.

---

## File structure

```
room-controller/
├── pwa/
│   ├── index.html        ← Full PWA app — deploy this folder
│   ├── manifest.json     ← PWA install config
│   ├── sw.js             ← Service worker (offline + caching)
│   └── icons/
│       ├── icon-192.png  ← App icon (lightbulb + WiFi design)
│       └── icon-512.png  ← App icon large
├── esp32/
│   └── RoomController_Firebase.ino  ← Upload to ESP32
└── docs/
    ├── DOCUMENTATION.md  ← This file
    └── wiring-diagram.html  ← Open in browser
```

---

## Version history

### v2.0 (current)
- Fixed relay flickering — slot refresh no longer clears relay state
- Fixed manual override lost on bad network read
- Added overlap detection and slot merging (PWA + ESP32)
- Added LED indicators for all 6 rooms with status patterns
- Added PWA install icon (lightbulb + WiFi design)
- Fixed manifest.json icon purpose fields for Chrome install prompt
- Increased schedule check to every 10 seconds
- Slot refresh changed to 60 seconds (was 5 minutes)
- Serial Monitor now shows full slot details for debugging

### v1.0
- Initial release
- Firebase Realtime Database integration
- 6 relay control via HTTP polling
- Schedule slots + recurring + manual override
- Timeline view with 12h/day/tomorrow modes

---

*Room Controller v2.0 — ESP32 + Firebase + PWA*
*Libraries: WiFi, HTTPClient, WiFiClientSecure, ArduinoJson (all built-in to ArduinoDroid)*
