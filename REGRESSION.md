# TabHub — Manual Regression Test Plan

Run this document top-to-bottom after any significant change to verify no regressions.
Each scenario is self-contained. Scenarios that depend on prior state say so explicitly.

**Dev credentials:** `mehdi@cafetunisia.com` / `mehdi123` (tenant: `cafetunisia`)
**Second tenant for isolation tests:** `restauranttunisia`

---

## Setup (run once before any scenario)

```bash
# Terminal 1 — Database
docker-compose up -d

# Terminal 2 — Backend
cd backend && dotnet run --project TabHub.API

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Verify:
- `http://localhost:5195/swagger` loads Swagger UI
- `http://localhost:5173/login` loads the login page

---

## Module 1 — Manager Authentication

### T-01 — Successful manager login
**Steps:**
1. Go to `http://localhost:5173/login`
2. Enter tenant: `cafetunisia`, email: `mehdi@cafetunisia.com`, password: `mehdi123`
3. Click **Sign in**

**Expected:**
- Redirected to `http://localhost:5173/manager/cafetunisia/dashboard`
- Sidebar shows: Dashboard, Menu, Spaces, Staff, Config
- User email visible at the bottom of the sidebar

---

### T-02 — Wrong password rejected
**Steps:**
1. Go to `/login`
2. Enter tenant: `cafetunisia`, email: `mehdi@cafetunisia.com`, password: `wrongpassword`
3. Click **Sign in**

**Expected:**
- Error message appears below the form (e.g. "Invalid credentials")
- Stays on login page — no redirect

---

### T-03 — Unknown tenant rejected
**Steps:**
1. Go to `/login`
2. Enter tenant: `doesnotexist`, email: `mehdi@cafetunisia.com`, password: `mehdi123`
3. Click **Sign in**

**Expected:**
- Error message appears
- Stays on login page

---

### T-04 — Auth guard blocks unauthenticated access
**Steps:**
1. Open a private/incognito window
2. Navigate directly to `http://localhost:5173/manager/cafetunisia/dashboard`

**Expected:**
- Redirected to `/login`
- Dashboard is not visible

---

### T-05 — Logout
**Preconditions:** Logged in (T-01 complete)

**Steps:**
1. In the manager dashboard, click **Sign out** at the bottom of the sidebar

**Expected:**
- Redirected to `/login`
- Navigating back to `/manager/cafetunisia/dashboard` redirects to `/login` again

---

### T-06 — Language switcher persists across reload
**Preconditions:** Logged in

**Steps:**
1. In the sidebar, click **AR**
2. Reload the page (`F5`)

**Expected:**
- UI is in Arabic after reload
- Sidebar text is right-to-left
- `document.dir` is `rtl` (verify in browser DevTools console: `document.dir`)

3. Click **FR** to restore French

---

## Module 2 — Restaurant Configuration

### T-07 — Update restaurant name
**Preconditions:** Logged in → navigate to **Config** tab

**Steps:**
1. Find the "Restaurant name" field
2. Clear it and type `Café Tunisie Test`
3. Click Save

**Expected:**
- Success toast or confirmation
- Reload the page — field shows `Café Tunisie Test`

---

### T-08 — Update TVA rate
**Steps:**
1. On Config page, change TVA rate to `19`
2. Save

**Expected:**
- Reload — field shows `19`

---

### T-09 — Update opening hours
**Steps:**
1. On Config page, set Monday opening hours to `08:00` – `22:00`
2. Save

**Expected:**
- Reload — Monday hours persist

---

## Module 3 — Spaces & Tables

### T-10 — Create a space
**Preconditions:** Logged in → navigate to **Spaces** tab → **Editor** sub-tab

**Steps:**
1. Click **New Space** (or equivalent add button)
2. Enter name: `Terrasse`, cols: `4`, rows: `3`
3. Save

**Expected:**
- "Terrasse" appears in the space list
- Clicking it shows a 4×3 empty grid

---

### T-11 — Add tables to the grid
**Preconditions:** T-10 complete, "Terrasse" space selected in Editor

**Steps:**
1. Click on cell (col 1, row 1) — a table should be created at that position
2. Repeat for cells (col 2, row 1), (col 1, row 2)
3. Total: 3 tables added

**Expected:**
- 3 cells show a table number (e.g. T1, T2, T3)
- Each cell has a QR icon or button

---

### T-12 — QR code generation and copy
**Preconditions:** T-11 complete

**Steps:**
1. Click the QR button on table T1
2. A modal or panel opens showing the QR code image
3. Note the URL shown (should be `http://localhost:5173/menu/cafetunisia?table=<uuid>`)

**Expected:**
- QR code image is visible
- URL contains `/menu/cafetunisia?table=` followed by a UUID
- Download button is present and downloads a PNG/SVG

---

### T-13 — Delete a table
**Steps:**
1. Delete table T3 from the grid (click delete or right-click)
2. Confirm deletion

**Expected:**
- T3 cell is empty
- Refreshing the page — T3 is gone

---

## Module 4 — Staff Management

### T-14 — Create a waiter
**Preconditions:** Logged in → navigate to **Staff** tab

**Steps:**
1. Click **Add staff**
2. Enter display name: `Ali Waiter`, role: `Waiter`, PIN: `1234`
3. Save

**Expected:**
- "Ali Waiter" appears in the staff list with a "Waiter" badge

---

### T-15 — Create kitchen and cashier staff
**Steps:**
1. Add staff: name `Sara Kitchen`, role `Kitchen`, PIN `2222`
2. Add staff: name `Omar Cashier`, role `Cashier`, PIN `3333`

**Expected:**
- Both appear in list with correct role badges

---

### T-16 — Edit staff and change PIN
**Steps:**
1. Click edit on "Ali Waiter"
2. Change display name to `Ali Ben Waiter`
3. Save
4. Open PIN management for this staff member
5. Set new PIN: `5678`
6. Save

**Expected:**
- Name updated to "Ali Ben Waiter" in list
- Old PIN `1234` no longer works for login (verify in T-25)
- New PIN `5678` works

---

### T-17 — Assign waiter zone
**Preconditions:** T-14 complete, T-10/T-11 complete (Terrasse space with tables)

**Steps:**
1. Go to **Spaces** → **Zones** sub-tab
2. Select staff: `Ali Ben Waiter`
3. Select space: `Terrasse`
4. Draw or assign a zone covering cols 1–2, rows 1–2
5. Save

**Expected:**
- Zone appears in the zone list under Ali Ben Waiter
- The Terrasse grid shows the zone overlay

---

### T-18 — Delete staff
**Steps:**
1. Add a throwaway staff member: name `Temp Staff`, role `Waiter`, PIN `9999`
2. Delete them

**Expected:**
- "Temp Staff" no longer appears in the list

---

## Module 5 — Menu System

### T-19 — Create a category
**Preconditions:** Logged in → navigate to **Menu** tab

**Steps:**
1. Click **Add category**
2. Enter name: `Boissons`, sort order: `1`, active: yes
3. Save

**Expected:**
- "Boissons" appears in the category accordion

---

### T-20 — Create a menu item with photo
**Preconditions:** T-19 complete

**Steps:**
1. Expand "Boissons" category
2. Click **Add item**
3. Enter name: `Café`, price: `3.500`, description: `Espresso serré`, available: yes
4. Save
5. On the item row, click the photo/image button
6. Upload any JPG or PNG image (< 5 MB)

**Expected:**
- "Café" appears under Boissons
- After photo upload, the item shows a thumbnail
- The image URL in the backend ends in `.webp` (resize to WebP confirmed)

---

### T-21 — Toggle item availability
**Steps:**
1. Find "Café" in the list
2. Toggle availability to **Unavailable**
3. Save / confirm

**Expected:**
- Item shows as unavailable (grayed out or badge)
- Customer menu (`/menu/cafetunisia?table=<qrToken>`) shows "Café" with unavailable styling — Add button hidden

4. Toggle back to **Available**

---

### T-22 — Create a modifier group on an item
**Steps:**
1. Edit the "Café" item
2. Add a modifier group: name `Sucre`, required: yes, min: 1, max: 1
3. Add options: `Sans sucre` (delta: 0), `Un sucre` (delta: 0), `Deux sucres` (delta: 0)
4. Save

**Expected:**
- On the customer menu, tapping "Café" opens a modifier modal with the three sugar options
- Form cannot be submitted without selecting one option (required group)

---

### T-23 — Create an ingredient and link to item
**Steps:**
1. In Menu, navigate to Ingredients (if separate section) or via item edit
2. Create ingredient: `Lait`
3. Link `Lait` to the "Café" item

**Expected:**
- Ingredient appears in the ingredient list
- "Café" item shows `Lait` as a linked ingredient

---

### T-24 — Disable ingredient cascades to item
**Preconditions:** T-23 complete

**Steps:**
1. Disable the `Lait` ingredient (toggle isActive off)

**Expected:**
- "Café" item is automatically set to unavailable
- Customer menu no longer shows "Café" as available

2. Re-enable `Lait`
3. Manually re-enable "Café" availability (cascade only disables, doesn't re-enable)

---

## Module 6 — Staff PIN Login (Waiter / Kitchen / Cashier)

### T-25 — Waiter PIN login
**Preconditions:** T-14–T-16 complete (Ali Ben Waiter with PIN 5678)

**Steps:**
1. Go to `http://localhost:5173/waiter/cafetunisia`
2. Enter PIN: `5678`
3. Tap/click login

**Expected:**
- Logged in as "Ali Ben Waiter"
- Floor plan tab is shown
- Only tables in Ali's assigned zone are highlighted/visible

---

### T-26 — Wrong PIN rejected on staff login
**Steps:**
1. Go to `http://localhost:5173/kitchen/cafetunisia`
2. Enter PIN: `0000` (invalid)
3. Tap login

**Expected:**
- Error message shown (invalid PIN or staff not found)
- Stays on PIN screen

---

### T-27 — Kitchen PIN login
**Preconditions:** T-15 complete (Sara Kitchen, PIN 2222)

**Steps:**
1. Go to `http://localhost:5173/kitchen/cafetunisia`
2. Enter PIN: `2222`

**Expected:**
- Logged into kitchen display
- Two-column kanban (Pending / InProgress) visible — may be empty initially

---

### T-28 — Cashier PIN login
**Preconditions:** T-15 complete (Omar Cashier, PIN 3333)

**Steps:**
1. Go to `http://localhost:5173/cashier/cafetunisia`
2. Enter PIN: `3333`

**Expected:**
- Logged into cashier kiosk
- Two tabs visible: **New Order** and **Sessions**

---

## Module 7 — Customer QR Ordering Flow

### T-29 — Resolve QR token
**Preconditions:** T-11–T-12 complete (table T1 with QR token)

**Steps:**
1. Copy the QR URL from T-12: `http://localhost:5173/menu/cafetunisia?table=<uuid>`
2. Open it in a browser tab

**Expected:**
- Menu page loads, showing the restaurant's active categories and items
- No login required

---

### T-30 — Browse categories and items
**Steps:**
1. On the customer menu page, verify categories are listed
2. Tap a category to expand it (or scroll to it)
3. Verify menu items are shown with name, description, price, photo

**Expected:**
- Only active categories with available items are shown
- Unavailable items (if any) show an "Unavailable" badge and no Add button

---

### T-31 — Add items to cart with modifiers
**Preconditions:** T-22 complete (Café with Sucre modifier)

**Steps:**
1. Tap **Add** on "Café"
2. Modifier modal opens — select "Un sucre"
3. Confirm / add to cart
4. Tap Add on another item (no modifiers)
5. Check the floating cart shows correct count and total

**Expected:**
- Cart badge shows 2 items
- Subtotal is correct (price sum)
- Required modifier was enforced (could not close modal without selecting)

---

### T-32 — Cannot submit order with required modifier unselected
**Steps:**
1. Tap Add on "Café"
2. In the modifier modal, do NOT select any sugar option
3. Try to confirm / add to cart

**Expected:**
- Button is disabled or error is shown
- Item not added to cart

---

### T-33 — Place order
**Preconditions:** T-31 complete (items in cart)

**Steps:**
1. Tap the floating cart
2. Review items
3. Tap **Place order** / **Submit**

**Expected:**
- Order submitted successfully
- Cart clears
- Order status view appears showing: `Pending` or `En attente`
- Step indicator is visible (Pending → InProgress → Ready → Served)

---

### T-34 — Customer sees real-time status updates
**Preconditions:** T-33 complete (order placed), waiter or staff app open in another tab

**Steps:**
1. Keep the customer tab open on the order status view
2. In another tab (waiter or Swagger), advance the order status to `InProgress`
3. Watch the customer tab

**Expected:**
- Customer tab updates automatically (no reload needed)
- Step indicator moves to InProgress / "En préparation"

---

### T-35 — Call waiter button
**Preconditions:** T-33 complete, waiter tab open (`/waiter/cafetunisia`)

**Steps:**
1. On the customer menu/order view, tap **Call waiter**

**Expected:**
- Waiter tab shows a notification banner: "Waiter called" or similar
- Notification includes the table number

---

### T-36 — Request bill button
**Preconditions:** T-33 complete, waiter tab open

**Steps:**
1. On the customer order view, tap **Request bill**

**Expected:**
- Waiter tab shows a notification banner: "Bill requested" for the table

---

### T-37 — Shared cart across two devices
**Steps:**
1. Open the customer menu URL in **two separate browser windows** (same QR token / table)
2. In window A, add "Café" to the cart
3. Watch window B

**Expected:**
- Window B's cart updates automatically (SignalR `CartUpdated`)
- A toast appears in window B indicating cart was synced
- Window B shows the same items as window A

---

## Module 8 — Waiter Application

### T-38 — Floor plan shows correct zone
**Preconditions:** T-17 complete (Ali's zone covers cols 1–2, rows 1–2 of Terrasse), T-25 complete (logged in as Ali)

**Steps:**
1. On the waiter app floor plan, select space "Terrasse"

**Expected:**
- Only tables within Ali's zone are highlighted or accessible
- Tables outside the zone are grayed out or hidden

---

### T-39 — Receive and ACK notification
**Preconditions:** T-25 (waiter logged in), T-33 (order placed from customer menu at a table in Ali's zone)

**Steps:**
1. Customer places an order at T1 (in Ali's zone)
2. Waiter tab shows a notification banner

**Expected:**
- Notification banner appears with order details and table number
3. Tap **ACK** on the notification

**Expected:**
- Notification disappears from Ali's screen
- Order appears in the waiter's order queue tab

---

### T-40 — Competing consumer ACK (two waiters)
**Preconditions:** Two waiter accounts logged in on two browser windows, both have zones covering the same table

**Steps:**
1. Customer places an order at the shared table
2. Both waiter windows receive the notification
3. Waiter A taps ACK first

**Expected:**
- Notification disappears from Waiter A's screen
- Waiter B sees "already taken" or the notification disappears (409 handled gracefully)

---

### T-41 — Advance order from waiter queue
**Preconditions:** T-39 complete (order in waiter queue)

**Steps:**
1. Go to the Orders tab on the waiter app
2. Find the order
3. Click advance (Pending → InProgress or InProgress → Ready)

**Expected:**
- Order status changes
- Customer tab (if open) updates in real time

---

### T-42 — Place order from waiter tablet
**Steps:**
1. On the waiter app, tap **New Order** or the order creation button
2. Select table T1 (or a free table)
3. Browse menu, add "Café"
4. Submit

**Expected:**
- Order created with status `InProgress` (staff bypass — skips Pending)
- Order appears in kitchen queue immediately

---

### T-43 — Move table session
**Preconditions:** An active session on table T1 (from a placed order)

**Steps:**
1. Go to the Sessions tab on the waiter app
2. Find the open session for T1
3. Click **Move** → select T2 (free table)
4. Confirm

**Expected:**
- Session is now on T2
- T1 shows as free on the floor plan
- T2 shows as occupied

---

### T-44 — Merge table sessions
**Preconditions:** Two open sessions (T1 and T2)

**Steps:**
1. On the Sessions tab, find the T1 session
2. Click **Merge** → select T2 session
3. Confirm

**Expected:**
- One session remains
- The merged session contains all orders from both tables

---

### T-45 — Close session and generate PDF bill
**Preconditions:** Open session with at least one completed order

**Steps:**
1. On the Sessions tab, find the open session
2. Click **Close session** / generate bill
3. A PDF bill opens in an iframe or new tab

**Expected:**
- PDF renders with itemised list, prices, TVA breakdown, total in TND
- Session status becomes closed
- Table shows as free on the floor plan

---

## Module 9 — Kitchen Application

### T-46 — Order appears in kitchen queue
**Preconditions:** T-27 (kitchen logged in), an order placed by a customer or waiter

**Steps:**
1. Place an order (from customer menu or waiter app)
2. If it was a customer order, advance it to InProgress in the waiter app first

**Expected:**
- Order appears in the **Pending** column of the kitchen kanban

---

### T-47 — Advance order through kitchen states
**Steps:**
1. Click **Commencer** (or Start) on a Pending order → moves to InProgress column
2. Click **Prêt** (or Ready) on an InProgress order

**Expected:**
- Order moves between columns correctly
- Elapsed time badge is visible and ticking
- When marked Ready: waiter app (if open) receives a notification

---

### T-48 — Reject an item
**Steps:**
1. Find an order in the Pending or InProgress column with multiple items
2. Click the reject button on one individual item

**Expected:**
- That item is marked as rejected
- A notification or escalation is sent (manager fallback if no waiter zone)

---

### T-49 — Kitchen receives SignalR updates without reload
**Steps:**
1. Kitchen tab is open and idle
2. Place a new order from another tab (customer or waiter)

**Expected:**
- Order appears in the Pending column automatically with no page refresh

---

## Module 10 — Cashier Application

### T-50 — Create a table order from cashier
**Preconditions:** T-28 (cashier logged in), at least one table exists

**Steps:**
1. On the cashier **New Order** tab
2. Select **Table** mode
3. Choose table T1
4. Add items from the menu picker
5. Submit

**Expected:**
- Order created with status `InProgress` (staff bypass)
- Order appears in kitchen queue
- Session opened for T1 if none existed

---

### T-51 — Create a takeaway order
**Steps:**
1. On the **New Order** tab, select **Takeaway** mode
2. Add items
3. Submit

**Expected:**
- Order created with a daily sequence number (format: YYYYMMDDNNNNN, e.g. `2026032300001`)
- Order appears on the **Takeaway Display** board (`/takeaway/cafetunisia`)

---

### T-52 — Close session and print bill from cashier
**Preconditions:** T-50 complete (open session on T1)

**Steps:**
1. Go to the **Sessions** tab on the cashier app
2. Find the T1 session
3. Click close / generate bill

**Expected:**
- PDF bill modal appears with correct items and total
- Session closed, T1 shows as free

---

## Module 11 — Takeaway Display

### T-53 — Takeaway order appears on display
**Preconditions:** T-51 complete

**Steps:**
1. Open `http://localhost:5173/takeaway/cafetunisia` in a tab
2. Place a takeaway order from cashier or Swagger

**Expected:**
- Order appears on the board with its sequence number and status: Pending
- No login required to view the board

---

### T-54 — Takeaway status updates in real time
**Steps:**
1. Takeaway display is open
2. In kitchen, advance the takeaway order to InProgress then Ready

**Expected:**
- Display updates automatically (no refresh)
- Order moves through status groups: Pending → Preparing → Ready

---

## Module 12 — Full End-to-End Simulation

### T-55 — Complete dine-in flow (all roles active)
Open all tabs simultaneously:
- Tab A: `http://localhost:5173/manager/cafetunisia/dashboard`
- Tab B: `http://localhost:5173/menu/cafetunisia?table=<qrToken for T1>`
- Tab C: `http://localhost:5173/waiter/cafetunisia` (Ali, PIN 5678)
- Tab D: `http://localhost:5173/kitchen/cafetunisia` (Sara, PIN 2222)
- Tab E: `http://localhost:5173/cashier/cafetunisia` (Omar, PIN 3333)

**Steps:**
1. Tab B (Customer): Add 2 items including one with modifiers → Place order
2. Tab C (Waiter): Notification banner appears → ACK
3. Tab D (Kitchen): Order appears in Pending → Commencer → Prêt
4. Tab C (Waiter): "Order ready" notification received → Mark delivered
5. Tab B (Customer): Order status updates through each step in real time
6. Tab E (Cashier): Go to Sessions → Close session → Open PDF bill
7. Tab A (Manager): Dashboard KPI counts update (total orders, revenue)

**Expected at each step:**
- Step 2: Waiter notification within 1 second of order placement
- Step 3: Kitchen queue updates within 1 second
- Step 4: Waiter notified when kitchen marks ready
- Step 5: Customer tab shows each status change without reload
- Step 6: PDF bill shows all items with correct TVA and TND total
- Step 7: Dashboard reflects the new completed order

---

### T-56 — Complete takeaway flow
**Steps:**
1. Cashier (Tab E): Create takeaway order with 1 item → Submit
2. Takeaway display (`/takeaway/cafetunisia`): Order appears with sequence number
3. Kitchen (Tab D): Advance to InProgress → Ready
4. Takeaway display: Status updates in real time
5. Cashier: Close the takeaway order

**Expected:**
- Sequence number is YYYYMMDDNNNNN format
- Display updates without reload at each kitchen step

---

## Module 13 — Manager Dashboard Features

### T-57 — Dashboard KPIs reflect real data
**Preconditions:** At least one completed order exists (T-55 complete)

**Steps:**
1. Go to `/manager/cafetunisia/dashboard`

**Expected:**
- KPI cards show non-zero values for orders today
- Revenue total is correct (sum of completed orders)
- Bar chart shows data for recent days
- Top items list shows ordered items by count

---

### T-58 — Live floor plan (Spaces → Live tab)
**Steps:**
1. Go to **Spaces** → **Live** tab
2. Open a table session (place an order on T1 from customer menu)

**Expected:**
- T1 changes color to occupied (orange or similar) within 30 seconds (auto-poll)
- Free tables remain green
- Tables with pending/inProgress orders appear red/attention

---

### T-59 — Spaces Editor — QR download
**Steps:**
1. Go to **Spaces** → **Editor** tab
2. Click the QR button on any table
3. Click the download button

**Expected:**
- A PNG/SVG QR code file is downloaded
- The QR code encodes the correct URL with the right tenant slug and table UUID

---

## Module 14 — Tenant Isolation

### T-60 — Data does not bleed between tenants
**Steps:**
1. Log in as `cafetunisia` manager → create a category: `Test Isolation Cat`
2. Log out
3. Log in with a `restauranttunisia` manager account (create one via Swagger if needed)
4. Go to Menu tab

**Expected:**
- `Test Isolation Cat` does NOT appear for restauranttunisia
- restauranttunisia's menu is completely separate

---

### T-61 — Cross-tenant JWT rejected
**Steps:**
1. Log in as `cafetunisia` manager → copy the JWT from localStorage (`tabhub_token`)
2. In Swagger UI, set `X-Tenant: restauranttunisia`
3. Use the copied JWT to call `GET /spaces`

**Expected:**
- `401 Unauthorized` or `403 Forbidden`
- No restauranttunisia data is returned

---

## Module 15 — Path-Based Routing

### T-62 — All manager routes are path-based
**Steps:**
1. Log in → verify URL is `/manager/cafetunisia/dashboard`
2. Click each sidebar item and verify URLs:
   - Dashboard → `/manager/cafetunisia/dashboard`
   - Menu → `/manager/cafetunisia/menu`
   - Spaces → `/manager/cafetunisia/spaces`
   - Staff → `/manager/cafetunisia/staff`
   - Config → `/manager/cafetunisia/config`

**Expected:**
- Each nav link navigates to the correct path-based URL
- Tenant slug `cafetunisia` is in every URL
- Active sidebar item is highlighted correctly

---

### T-63 — Direct URL navigation works
**Steps:**
1. Log in (JWT in localStorage)
2. Directly navigate to `http://localhost:5173/manager/cafetunisia/staff`

**Expected:**
- Staff page loads directly without going through dashboard

---

### T-64 — Staff apps carry tenant in URL
**Steps:**
1. Verify these URLs load their respective PIN screens without redirect:
   - `http://localhost:5173/waiter/cafetunisia`
   - `http://localhost:5173/kitchen/cafetunisia`
   - `http://localhost:5173/cashier/cafetunisia`
   - `http://localhost:5173/takeaway/cafetunisia`
   - `http://localhost:5173/menu/cafetunisia`

**Expected:**
- Each URL loads its correct surface
- No 404 or blank page

---

## Module 16 — PDF Bill Generation

### T-65 — PDF bill content is correct
**Preconditions:** At least one closed session with multiple items at different prices

**Steps:**
1. From the waiter or cashier app, close a session with 3+ items
2. Open the PDF bill

**Expected:**
- Restaurant name appears in the header
- Each item is listed with name, quantity, unit price, line total
- Subtotal is correct
- TVA line shows the correct rate and amount (e.g. 19% on subtotal)
- Total TND is displayed with 3 decimal places
- Date/time of bill generation is present

---

## Module 17 — Image Upload

### T-66 — Item photo upload and display
**Steps:**
1. On Menu page, edit any item
2. Click the photo upload button
3. Select a JPG image (< 5 MB)
4. Confirm upload

**Expected:**
- Thumbnail appears on the item row in the manager menu
- On the customer menu (`/menu/cafetunisia`), the item shows the photo
- The image URL ends in `.webp` (backend resized to WebP 400×400)

---

### T-67 — Large image is rejected or resized
**Steps:**
1. Try to upload an image > 5 MB (if enforced client-side) or a very large image

**Expected:**
- Either rejected with an error message, OR
- Accepted and silently resized to WebP 400×400 (verify output image dimensions)

---

## Module 18 — Menu Scheduling

### T-68 — TIME_RANGE schedule rule
**Steps:**
1. Create a new menu: name `Menu Matin`, add it to "Boissons" category
2. Add schedule rule: type `TIME_RANGE`, start `07:00`, end `23:00`
3. Toggle menu active
4. Call `GET /menus/active` in Swagger (with `X-Tenant: cafetunisia`)

**Expected:**
- "Menu Matin" is returned (current time is within 07:00–23:00)

5. Change the rule end time to `01:00` (past midnight, outside current time if testing during day)
6. Call `GET /menus/active` again

**Expected:**
- "Menu Matin" is NOT returned

---

### T-69 — Manual menu toggle (isActive)
**Steps:**
1. Create a menu with no schedule rules, toggle it **active**
2. Verify it appears in `GET /menus/active`
3. Toggle it **inactive**
4. Verify it no longer appears

---

## Module 19 — Multilingual UI

### T-70 — FR / AR / EN switching on manager dashboard
**Steps:**
1. Log into manager dashboard
2. Click **FR** — verify nav labels are in French
3. Click **EN** — verify nav labels switch to English
4. Click **AR** — verify nav labels switch to Arabic, layout flips to RTL

**Expected:**
- Text changes immediately without page reload for each language
- Arabic: sidebar is on the right, text is right-aligned

---

### T-71 — Customer menu multilingual
**Steps:**
1. Open the customer menu URL
2. If there is a language selector, switch to Arabic

**Expected:**
- UI text switches to Arabic
- RTL layout applied

---

## Module 20 — Error & Edge Cases

### T-72 — Customer cannot order with empty cart
**Steps:**
1. Open the customer menu URL
2. Do not add any items
3. Attempt to place an order (if the button is even visible)

**Expected:**
- Order button is disabled or hidden when cart is empty

---

### T-73 — Unavailable item cannot be added to cart
**Preconditions:** T-21 (Café set to unavailable)

**Steps:**
1. Open the customer menu for cafetunisia
2. Find "Café" in the list

**Expected:**
- "Café" shows an "Unavailable" badge
- No **Add** button is visible
- Tapping the item does nothing (or shows unavailable message)

---

### T-74 — Invalid QR token shows error
**Steps:**
1. Navigate to `http://localhost:5173/menu/cafetunisia?table=00000000-0000-0000-0000-000000000000`

**Expected:**
- Error message shown: "Invalid or inactive QR code" or similar
- Menu is not displayed

---

### T-75 — Catch-all route redirects to login
**Steps:**
1. Navigate to `http://localhost:5173/this-does-not-exist`

**Expected:**
- Redirected to `/login`

---

## Checklist Summary

Use this as a quick reference to track what you've verified:

| # | Test | ✅ / ❌ |
|---|------|--------|
| T-01 | Manager login | |
| T-02 | Wrong password rejected | |
| T-03 | Unknown tenant rejected | |
| T-04 | Auth guard blocks unauthenticated access | |
| T-05 | Logout | |
| T-06 | Language switcher persists across reload | |
| T-07 | Update restaurant name | |
| T-08 | Update TVA rate | |
| T-09 | Update opening hours | |
| T-10 | Create a space | |
| T-11 | Add tables to the grid | |
| T-12 | QR code generation and copy | |
| T-13 | Delete a table | |
| T-14 | Create a waiter | |
| T-15 | Create kitchen and cashier staff | |
| T-16 | Edit staff and change PIN | |
| T-17 | Assign waiter zone | |
| T-18 | Delete staff | |
| T-19 | Create a category | |
| T-20 | Create a menu item with photo | |
| T-21 | Toggle item availability | |
| T-22 | Create a modifier group on an item | |
| T-23 | Create an ingredient and link to item | |
| T-24 | Disable ingredient cascades to item | |
| T-25 | Waiter PIN login | |
| T-26 | Wrong PIN rejected | |
| T-27 | Kitchen PIN login | |
| T-28 | Cashier PIN login | |
| T-29 | Resolve QR token | |
| T-30 | Browse categories and items | |
| T-31 | Add items to cart with modifiers | |
| T-32 | Cannot submit order with required modifier unselected | |
| T-33 | Place order | |
| T-34 | Customer sees real-time status updates | |
| T-35 | Call waiter button | |
| T-36 | Request bill button | |
| T-37 | Shared cart across two devices | |
| T-38 | Floor plan shows correct zone | |
| T-39 | Receive and ACK notification | |
| T-40 | Competing consumer ACK (two waiters) | |
| T-41 | Advance order from waiter queue | |
| T-42 | Place order from waiter tablet | |
| T-43 | Move table session | |
| T-44 | Merge table sessions | |
| T-45 | Close session and generate PDF bill (waiter) | |
| T-46 | Order appears in kitchen queue | |
| T-47 | Advance order through kitchen states | |
| T-48 | Reject an item | |
| T-49 | Kitchen receives SignalR updates without reload | |
| T-50 | Create a table order from cashier | |
| T-51 | Create a takeaway order | |
| T-52 | Close session and print bill from cashier | |
| T-53 | Takeaway order appears on display | |
| T-54 | Takeaway status updates in real time | |
| T-55 | Complete dine-in flow (all roles active) | |
| T-56 | Complete takeaway flow | |
| T-57 | Dashboard KPIs reflect real data | |
| T-58 | Live floor plan (Spaces → Live tab) | |
| T-59 | Spaces Editor — QR download | |
| T-60 | Data does not bleed between tenants | |
| T-61 | Cross-tenant JWT rejected | |
| T-62 | All manager routes are path-based | |
| T-63 | Direct URL navigation works | |
| T-64 | Staff apps carry tenant in URL | |
| T-65 | PDF bill content is correct | |
| T-66 | Item photo upload and display | |
| T-67 | Large image is rejected or resized | |
| T-68 | TIME_RANGE schedule rule | |
| T-69 | Manual menu toggle (isActive) | |
| T-70 | FR / AR / EN switching on manager dashboard | |
| T-71 | Customer menu multilingual | |
| T-72 | Customer cannot order with empty cart | |
| T-73 | Unavailable item cannot be added to cart | |
| T-74 | Invalid QR token shows error | |
| T-75 | Catch-all route redirects to login | |
