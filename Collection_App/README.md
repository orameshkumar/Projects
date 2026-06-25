# ABC Debt Collection - User Manual

## Overview

ABC Debt Collection is an offline-capable Progressive Web App (PWA) for managing two types of debt collection:

1. **Daily EMI** — Clients pay a fixed daily installment that reduces the principal with every payment
2. **Interest Only** — Clients pay monthly interest on the outstanding principal, with principal repaid separately

All data is stored locally on your device. No internet required after first install.

---

## Installation

1. Open `index.html` in Chrome, Edge, or Safari
2. On mobile: tap browser menu → "Add to Home Screen" or "Install App"
3. The app installs as a standalone application
4. Works fully offline after installation

---

## First-Time Setup

1. Tap **⚙️ Settings** tab
2. Toggle **Dark Theme** if preferred
3. Enter your **Application Name** (default: "ABC Debt Collection")
4. Enter your **UPI ID** (e.g., `yourname@upi`) — required for QR code payments
5. Tap **Save Settings**

---

## Navigation

The app has 6 tabs at the bottom:

| Tab | Icon | Purpose |
|-----|------|---------|
| Clients | 👥 | Manage client records (add, edit, delete, import/export) |
| Collection | 💰 | Daily EMI payment collection |
| Interest | 🏦 | Interest-only loan management (interest + principal) |
| History | 📋 | View all payment records |
| Reports | 📊 | Day-wise and client-wise reports |
| Settings | ⚙️ | App name, UPI ID, theme |

---

## Clients Tab (👥)

### Adding a Client

1. Tap the **+** button
2. Select **Loan Type**:
   - **Daily EMI** — fixed daily installment
   - **Interest Only** — monthly interest payments
3. Fill in the fields:
   - **Client Name** (unique, max 100 chars)
   - **Mobile Number** (10 digits, spaces allowed)
   - **Total Borrowed Amount**
   - **Collection Start Date**
4. For Daily EMI:
   - **Duration** (defaults to 100 days)
   - **EMI** (auto-calculated: Amount ÷ Duration, editable)
   - **End Date** (auto-calculated)
5. For Interest Only:
   - **Monthly Interest Rate (%)** (e.g., 3 means 3%)
   - **EMI** (auto-calculated: Amount × Rate ÷ 100)
6. Tap **Save Client**

### Client Card Display

Each client card shows:
- Client name with loan type badge (**Daily EMI** or **Interest Only**)
- Mobile number and amount/principal balance
- **💳** button (Interest Only clients) — Pay Principal directly
- **✏️** button — Edit
- **🗑️** button — Delete (also removes all payment records)

### Pay Principal (from Client Tab)

For Interest Only clients:
1. Tap the **💳** button on the client card
2. A payment modal opens with:
   - **Date picker** (defaults to today)
   - **Amount** pre-filled with full principal balance (editable)
   - **QR code** generated immediately
3. Adjust amount for partial payment if needed
4. Tap **Confirm Payment**

### Search, Import & Export

- **Search bar** — filter clients by name in real-time
- **📤 Export** — downloads all clients as CSV
- **📥 Import** — upload a CSV file to bulk-add clients (skips duplicates)

CSV format: `Client Name, Mobile, Amount, Start Date, Duration, EMI, End Date`

---

## Collection Tab (💰)

For **Daily EMI clients only** (Interest Only clients are in the Interest tab).

### Daily Workflow

1. Select the **Collection Date** (defaults to today)
2. The list shows all clients with pending balances
3. For each client:
   - Client name, pending amount
   - EMI amount (editable before collecting)
4. Tap **Collect** → QR code page opens
5. Client scans QR → tap **Confirm Payment**
6. Client row turns **green** with "✓ Paid today" badge

### Filters

- **Search** — filter by client name
- **Not paid today** checkbox — hides clients who already paid today

---

## Interest Tab (🏦)

For **Interest Only clients only**. Manages monthly interest collection and principal payments.

### How Interest Periods Work

- Each client's billing cycle is anchored to their **borrowing start date**
- Example: Client borrows on 15th → periods are 15th–14th each month
- Interest is calculated as: **Effective Principal × Monthly Rate ÷ 100**

### Effective Principal (Date-Aware)

- If principal was paid on date A, the reduced principal is used for interest calculation **only for periods starting after date A**
- Past periods use the principal that was outstanding at that time

### Carry-Forward & Advance Payments

- **Unpaid interest** from past periods carries forward and adds to the current period's due
- **Overpayments** (paying more than due) create advance credit that reduces future periods
- **Partial payments** are accumulated — pay in multiple installments within a period

### Interest Collection List

Shows each client with:
- Client name
- **Period dates** (from – to)
- **Balance Due** (interest for this period + carry-forward - already paid - advance credits)
- Notes showing carry-forward, advance applied, and already paid amounts
- **Collect Interest** button
- **Pay Principal** button

### Collecting Interest

1. Tap **Collect Interest**
2. Amount pre-filled with the balance due (editable)
3. QR code generated
4. Tap **Confirm Payment**
5. Client disappears from list once fully paid for the period

### Paying Principal

1. Tap **Pay Principal**
2. Enter amount manually (validated ≤ current principal)
3. Tap **Confirm Payment**
4. Principal balance reduces; future interest calculations use the new balance

### Filters

- **Reference Date** — change the date to view interest state for past/future dates
- **Show unpaid only** — shows only clients with zero payments in the current period

---

## History Tab (📋)

View all recorded payments.

### Usage

1. Set **From** and **To** dates (defaults: last 30 days)
2. Tap **Search** to filter
3. Each record shows: Date | Client Name | Amount | Type Badge | 🗑️ Delete

### Payment Type Badges

| Badge | Meaning |
|-------|---------|
| **EMI** (green) | Daily EMI payment |
| **Interest** (blue) | Monthly interest payment |
| **Principal** (red) | Principal repayment |

### Filters

- **Client name search** — filter records by client name in real-time
- **Date range** — From/To date selection

### Deleting a Payment

- Tap **🗑️** on any record → confirm deletion
- The payment is removed and balances recalculate accordingly

---

## Reports Tab (📊)

View aggregated collection data.

### Report Types

**Day-wise:**
- Total amount collected per day
- Sorted most recent first
- Grand total at bottom

**Client-wise:**
- Total collected per client
- For Interest Only clients: separate Interest/Principal/Balance columns
- Sorted alphabetically

### Filters

- **Date range** — defaults to current month
- **Client name search** — filter client-wise report by name

### Print

- Tap **🖨️ Print Report** to print the active report
- Printed output shows: App name, date range, and report table only

---

## Settings Tab (⚙️)

| Setting | Description |
|---------|-------------|
| **Dark Theme** | Toggle light/dark appearance |
| **Application Name** | Shown in headers, QR codes, print (max 50 chars) |
| **UPI ID** | Your payment address for QR codes (format: `name@provider`) |
| **Backup Frequency** | How often you're reminded to backup (default: weekly) |

### Backup & Restore

The Settings tab includes a **Backup & Restore** section with:

- **Backup Reminder Frequency** — choose how often the app reminds you to backup:
  - Never, Daily, Every 3 days, Weekly (default), Every 2 weeks, Monthly
- **📦 Create Backup** button — exports all data (clients, payments, settings) as a JSON file download
- **📂 Restore Backup** button — imports from a previously saved JSON backup file, replacing all current data
- **Last backup date display** — shows when you last created a backup
- **Backup reminder on app launch** — if enough days have passed since your last backup (based on your frequency setting), you'll be prompted to create one

---

## Backup & Restore

### Creating a Backup
1. Go to Settings tab
2. Tap "📦 Create Backup"
3. A JSON file downloads containing all your data
4. Store this file safely (Google Drive, email to yourself, etc.)

### Restoring from Backup
1. Go to Settings tab
2. Tap "📂 Restore Backup"
3. Select a previously saved .json backup file
4. Confirm the restore (WARNING: replaces all current data)
5. App reloads with restored data

### Backup Reminder
- Set your preferred reminder frequency in Settings
- On app launch, if enough days have passed since last backup, you'll be prompted
- Choose "Never" to disable reminders

### What's Included in Backup
- All client records (both Daily EMI and Interest Only)
- All payment records (EMI, Interest, Principal)
- All settings (App Name, UPI ID, Theme, Backup Frequency)

---

## Interest Calculation — Detailed Example

```
Client: Raju
Borrowed: ₹1,00,000 on 15-Jan-2025
Interest Rate: 2% per month

Period 1 (15 Jan - 14 Feb):
  Principal: ₹1,00,000
  Interest Due: ₹2,000
  Raju pays: ₹2,000 ✓ (fully paid)

Period 2 (15 Feb - 14 Mar):
  Principal: ₹1,00,000
  Interest Due: ₹2,000
  Raju pays: ₹1,000 (partial)
  Remaining: ₹1,000 (carries forward)

Raju pays ₹30,000 principal on 1-Mar-2025

Period 3 (15 Mar - 14 Apr):
  Principal: ₹1,00,000 - ₹30,000 = ₹70,000 (reduced after Mar 1)
  Interest Due: ₹70,000 × 2% = ₹1,400
  Carry Forward: ₹1,000 (from Period 2)
  Total Due: ₹2,400
  Raju pays: ₹3,000 (overpays by ₹600 → advance credit)

Period 4 (15 Apr - 14 May):
  Principal: ₹70,000
  Interest Due: ₹1,400
  Advance Credit: ₹600 (from Period 3 overpayment)
  Balance Due: ₹800
```

---

## Data & Offline

- All data stored **locally** in IndexedDB (clients, payments) and localStorage (settings)
- No server, no cloud — fully private
- Works offline after first load
- **Use Backup & Restore** in Settings to protect against data loss
- Service worker caches all app files for offline use

---

## Tips

| Tip | Benefit |
|-----|---------|
| Install as PWA | Full-screen mobile experience |
| Use "Not paid today" filter | Quickly see remaining daily collections |
| Use "Show unpaid only" filter | Focus on clients who owe interest |
| Pay principal from Client tab | Quick access without switching to Interest tab |
| Change Reference Date in Interest tab | Check past/future interest states |
| Create backups regularly | Protect against device loss or data clearing |
| Export clients regularly | CSV backup of your client data |
| Print reports | Paper records for clients or your files |
| Dark theme | Comfortable for evening collections |
| Set backup reminder to Weekly | Never forget to backup your data |
| Bump service worker version | After updates, change CACHE_NAME in sw.js |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| QR code not showing | Configure UPI ID in Settings |
| App not installing | Use Chrome/Edge on Android, Safari on iOS |
| Changes not reflecting after update | Clear browser cache or update CACHE_NAME in sw.js |
| Storage full | Delete old client records or clear other browser data |
| Interest calculation seems wrong | Check that principal payment dates are correct — interest uses the principal that was effective at each period start |
| Client not showing in Collection tab | Check if they're an Interest Only client (those appear in Interest tab) |
| Dark theme colors wrong | Refresh the page |

---

## Technical Details

| Aspect | Detail |
|--------|--------|
| Technology | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Storage | IndexedDB v2 (clients + payments), localStorage (settings) |
| QR Library | qrcode-generator by Kazuhiko Arase |
| Offline | Service Worker with cache-first strategy |
| Compatibility | Chrome 60+, Firefox 60+, Safari 12+, Edge 79+ |
| Themes | Light (default) + Dark |
| Tabs | 6 (Clients, Collection, Interest, History, Reports, Settings) |
