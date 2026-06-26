# Pay Up Partners — User Guide

## Overview

Pay Up Partners is an offline loan collection app that works on your phone or computer. It helps you manage clients, track daily EMI loans and interest-only loans, collect payments, send WhatsApp notifications, and generate reports — all without needing an internet connection after the first load.

**What you can do with Pay Up Partners:**

- Add clients and manage multiple loans per client
- Collect daily EMI payments with UPI QR codes
- Collect monthly interest and principal payments with carry-forward logic
- Send WhatsApp payment confirmations and reminders
- View payment history and generate business reports
- Backup and restore your data (including migration from the old Collection App)
- Work completely offline — no server needed

---

## Installation

Pay Up Partners runs in your web browser and can be installed as an app on your phone or computer. See the separate [INSTALL_GUIDE.md](INSTALL_GUIDE.md) for detailed installation steps.

**Quick start:** Serve the folder using a local web server (e.g., VS Code Live Server) and open it in Chrome or Edge.

---

## Getting Started (First-Time Setup)

When you open Pay Up Partners for the first time:

1. **Go to the Settings tab** (last tab in the bottom navigation)
2. **Set your App Name** — This appears in the header and on payment QR codes (default: "Pay Up Partners")
3. **Set your UPI ID** — Your payment address (e.g., `yourname@upi`). This is used when generating QR codes for collection.
4. **Choose your Theme** — Toggle between Dark mode and Light mode
5. **Set Backup Frequency** — How often the app reminds you to back up your data
6. **Save Settings**

You're ready to start adding clients!

---

## License Activation

Without a license, Pay Up Partners limits you to **5 clients**. To add more clients, you need a license key.

### How to activate your license:

1. Go to **Settings** tab
2. Scroll to the **License** section
3. Enter your license key in the text field
4. Tap **Activate**
5. If the key is valid, you'll see a success message and your name displayed as the licensee
6. If the key is invalid, you'll see an error — check for typos or contact the app provider

### License details:

- Your license persists across sessions — you only enter it once
- Without a license, you can still use all features but are limited to 5 clients
- To remove your license, tap the **Remove License** button in Settings

---

## Managing Clients

### Adding a Client

1. Go to the **Clients** tab
2. Tap the **+ Add Client** button
3. Enter the client's **Name** (must be unique)
4. Enter the client's **Mobile Number** (10 digits — needed for WhatsApp notifications)
5. Tap **Save**

### Editing a Client

1. On the client card, tap the **Edit** button
2. Modify the name or mobile number
3. Tap **Save**

> Editing a client does not affect their existing loans or payment history.

### Deleting a Client

1. On the client card, tap the **Delete** button
2. Confirm the deletion when prompted

> **Warning:** Deleting a client removes ALL their loans and ALL payment records permanently.

### Searching Clients

Use the search box at the top of the Clients tab to filter clients by name. The search is case-insensitive.

### CSV Import / Export

- **Export:** Tap the export button to download all client and loan data as a CSV file
- **Import:** Tap the import button and select a CSV file to bulk-add clients and loans

---

## Managing Loans

Each client can have multiple loans. Loans appear as sub-items under the client card.

### Adding a Loan

1. On a client card, tap **Add Loan**
2. Choose the loan type:
   - **Daily EMI** — fixed daily payment over a set number of days
   - **Interest Only** — monthly interest payment on the outstanding principal
3. Fill in the details:
   - **Daily EMI:** Total amount, start date, duration (default 100 days). EMI and end date are auto-calculated.
   - **Interest Only:** Total amount, start date, monthly interest rate. Monthly interest amount is auto-calculated.
4. Optionally add notes
5. Tap **Save**

### Editing a Loan

Tap the **Edit** button on a loan sub-item to modify its parameters. Editing one loan does not affect other loans.

### Closing a Loan

When a loan is fully paid or you want to mark it complete, tap **Close Loan**. Closed loans no longer appear in collection screens.

### Deleting a Loan

Tap **Delete** on a loan to permanently remove it along with all its payment records.

---

## Daily Collection

The **Collection** tab shows all active daily EMI loans for the selected date.

### How to use:

1. **Select a date** using the date picker at the top (defaults to today)
2. You'll see each active loan with: client name, loan amount, pending balance, and daily EMI
3. Tap **Collect** to record a payment

### Collecting a payment:

1. Tap **Collect** on a loan
2. A payment screen appears with:
   - The EMI amount pre-filled
   - A **UPI QR code** the client can scan to pay
3. Once payment is received, tap **Confirm Payment**
4. The loan is marked as "paid today" with a green highlight

### "Not Paid Today" filter:

Toggle this filter to show only clients who haven't paid for the selected date — useful for follow-ups.

### Search:

Use the search box to filter the collection list by client name.

---

## Interest Collection

The **Interest** tab shows all active interest-only loans.

### How it works:

- Interest is calculated in monthly periods anchored to each loan's start date
- The app automatically handles **carry-forward** (unpaid interest from previous months rolls over)
- The app automatically handles **advance credit** (if a client overpays, the extra is credited to future months)

### Using the Interest tab:

1. **Reference Date** — Select the date up to which interest should be calculated (defaults to today)
2. For each loan you'll see: client name, principal balance, interest due (including any carry-forward), and loan details
3. **Collect Interest** — Tap to record an interest payment. Partial payments are supported.
4. **Pay Principal** — Tap to record a principal reduction payment. This reduces the outstanding balance for future interest calculations.

### "Show Unpaid" filter:

Toggle this to show only loans with outstanding unpaid interest.

### Carry-Forward Explained:

- If a client owes ₹500 interest for January but only pays ₹300, the remaining ₹200 carries forward to February
- In February, the client will owe the new month's interest PLUS the ₹200 carry-forward
- If a client pays ₹700 when only ₹500 is due, the extra ₹200 becomes advance credit for the next month

---

## WhatsApp Notifications

Pay Up Partners can send messages to your clients via WhatsApp — both payment confirmations and payment reminders.

### Payment Confirmation

After you collect a payment (EMI, interest, or principal), the app offers to send a confirmation message to the client via WhatsApp. The message includes the amount, date, and pending balance.

**How it works:**
1. Collect a payment as usual
2. If the confirmation toggle is enabled for that loan type, a prompt appears: "Send confirmation via WhatsApp?"
3. Tap Yes → WhatsApp opens with the message pre-filled and the client's number ready
4. Tap No → the prompt dismisses

**Requirements:**
- The client must have a valid 10-digit mobile number saved
- The confirmation toggle for that loan type must be enabled in Settings

### Payment Reminders

For clients who haven't paid, you can send a reminder directly from the Collection or Interest screens.

**How it works:**
1. Look for the **📱 Remind** button next to unpaid clients
2. Tap it → WhatsApp opens with a reminder message pre-filled
3. The message includes which reminder number this is for the month (e.g., "this is your 2nd reminder")

The app tracks how many reminders you've sent to each client per month. The counter resets automatically at the start of each new month.

### Configuring WhatsApp in Settings

Go to **Settings** to customize:

- **Confirmation Toggles:**
  - Daily EMI confirmation (default: OFF)
  - Interest/Principal confirmation (default: ON)

- **Reminder Timing (Interest Loans):**
  - Choose when to highlight loans for reminders: on due date, 1 day before, 3 days before, 5 days before

- **Message Templates:**
  - Edit the confirmation message template
  - Edit the reminder message template
  - Available variables: `{clientName}`, `{amount}`, `{date}`, `{loanAmount}`, `{pending}`, `{reminderNumber}`

---

## Payment History

The **History** tab shows all recorded payments across all clients and loans.

### Features:

- Each entry shows: client name, loan info, payment date, amount, and type (EMI / Interest / Principal)
- Colour-coded badges distinguish payment types

### Filtering:

- **Date Range:** Set a start and end date to view payments within a specific period
- **Client Filter:** Type a client name to show only their payments

### Deleting a Payment:

1. Find the payment in the history list
2. Tap **Delete**
3. Confirm the deletion

> If you delete a principal payment, the loan's principal balance is automatically restored.

---

## Reports

The **Reports** tab provides three types of aggregated reports:

### Day-wise Report
Shows total collections grouped by date. Useful for seeing how much you collected each day.

### Client-wise Report
Shows total payments grouped by client (across all their loans). Useful for seeing total business per client.

### Outstanding Report
Shows all active loans with: client name, loan type, total borrowed, total paid, and outstanding balance.

### Using Reports:

1. Select the report type
2. Optionally filter by date range or client name
3. Tap **Print** to generate a printable version of the report

---

## Backup & Restore

### Creating a Backup

1. Go to **Settings**
2. Tap **Create Backup**
3. A JSON file is downloaded containing all your data (clients, loans, payments, settings)

### Restoring a Backup

1. Go to **Settings**
2. Tap **Restore Backup**
3. Select a backup file (JSON)
4. Confirm the restore — this replaces all current data with the backup data

### Migrating from Old Collection App (V2)

If you previously used the "Collection App" (the older version), you can import your old backup:

1. Create a backup from the old Collection App
2. In Pay Up Partners, go to Settings → Restore Backup
3. Select the old backup file
4. The app automatically detects it's a V2 format and migrates the data:
   - Old combined client-loan records are split into separate Client and Loan records
   - Old payments are remapped from client links to loan links
   - All data is preserved

### Backup Reminders

The app checks your backup frequency setting and reminds you when it's time to create a new backup. The last backup date is shown in Settings.

---

## Settings

The Settings tab lets you configure:

| Setting | Description | Default |
|---------|-------------|---------|
| App Name | Shown in header and QR codes | "Pay Up Partners" |
| UPI ID | Your payment address for QR codes | (empty) |
| Theme | Dark or Light mode | Dark |
| Backup Frequency | How often to remind you to backup | 7 days |
| License Key | Activate to unlock unlimited clients | (none) |
| WhatsApp Confirmations | Toggle per loan type | EMI: off, Interest: on |
| Reminder Timing | Days before due for interest reminders | 1 day, 3 days |
| Message Templates | Customize WhatsApp messages | (defaults provided) |

---

## Offline Support

Pay Up Partners works completely offline after the first load:

- All data is stored locally on your device using IndexedDB
- Settings are stored in localStorage
- A Service Worker caches all app files (HTML, CSS, JS, icons)
- No internet connection is needed for any feature
- QR codes are generated locally
- WhatsApp messages open via URL scheme (requires WhatsApp installed on device)

**First load:** You need internet to download the app files initially. After that, everything works offline.

**Updating:** If the app is updated, clear the service worker cache and reload. See [INSTALL_GUIDE.md](INSTALL_GUIDE.md) for details.

---

## Tips

- Always keep a recent backup — your data lives only on your device
- Set up your UPI ID in Settings before collecting payments
- Use the "Not Paid Today" filter during daily rounds to focus on pending clients
- The search feature works across all tabs — use it to quickly find clients
- WhatsApp reminders with ordinal counters ("3rd reminder") create urgency
- Interest carry-forward is automatic — you don't need to manually track unpaid months
