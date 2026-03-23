# TabHub — Manual Regression Test Plan

Run this document top-to-bottom after any significant change to verify no regressions.
Each scenario is self-contained. Scenarios that depend on prior state say so explicitly.

---

## Environment

| | URL |
|---|---|
| **Frontend** | `https://ashy-grass-0c75bb903.6.azurestaticapps.net` |
| **API (Swagger)** | `https://api-tabhub.azurewebsites.net/swagger` |

## Credentials

| Role | Tenant | Email / PIN | Password |
|---|---|---|---|
| **Super Admin** | *(none)* | `mehdi@mehdi.com` | `mehdi123` |
| Manager | `cafetunisia` | `mehdi@cafetunisia.com` | `mehdi123` |
| Waiter | `cafetunisia` | PIN `5678` | *(created in T-14/T-16)* |
| Kitchen | `cafetunisia` | PIN `2222` | *(created in T-15)* |
| Cashier | `cafetunisia` | PIN `3333` | *(created in T-15)* |

> **Tip:** Run tests in order on first pass — later modules depend on data created in earlier ones.
> For Swagger calls, always set header `X-Tenant: cafetunisia` in the **Authorize** dialog.
> Super admin login is at `/admin/login` — no tenant slug required.

---

## Module 1 — Manager Authentication

### T-01 — Successful manager login
**Steps:**
1. Go to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/login`
2. Enter tenant: `cafetunisia`, email: `mehdi@cafetunisia.com`, password: `mehdi123`
3. Click **Sign in**

**Expected:**
- Redirected to `/manager/cafetunisia/dashboard`
- Sidebar shows: Dashboard, Menu, Spaces, Staff, Config
- User email visible at the bottom of the sidebar

---

### T-02 — Wrong password rejected
**Steps:**
1. Go to `/login`
2. Enter tenant: `cafetunisia`, email: `mehdi@cafetunisia.com`, password: `wrongpassword`
3. Click **Sign in**

**Expected:**
- Error message appears ("Invalid credentials" or similar)
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
1. Open a private/incognito browser window
2. Navigate directly to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/manager/cafetunisia/dashboard`

**Expected:**
- Redirected to `/login`
- Dashboard is not visible

---

### T-05 — Logout
**Preconditions:** Logged in (T-01 complete)

**Steps:**
1. Click **Sign out** at the bottom of the sidebar

**Expected:**
- Redirected to `/login`
- Navigating back to `/manager/cafetunisia/dashboard` redirects to `/login` again

---

### T-06 — Language switcher persists across reload
**Preconditions:** Logged in

**Steps:**
1. In the sidebar, click **AR**
2. Verify UI switches to Arabic and layout flips right-to-left
3. Reload the page (`F5`)

**Expected:**
- UI remains in Arabic after reload
- Sidebar text is right-to-left

4. Click **FR** to restore French before continuing

---

## Module 2 — Restaurant Configuration

### T-07 — Update restaurant name
**Preconditions:** Logged in → navigate to **Config** tab

**Steps:**
1. Find the "Restaurant name" field
2. Clear it and type `Café Tunisie Test`
3. Click **Save**

**Expected:**
- Success toast/confirmation appears
- Reload the page — field still shows `Café Tunisie Test`

---

### T-08 — Update TVA rate
**Steps:**
1. On Config page, change TVA rate to `19`
2. Click **Save**

**Expected:**
- Reload — field shows `19`

---

### T-09 — Update opening hours
**Steps:**
1. On Config page, set Monday opening hours to `08:00` – `22:00`
2. Click **Save**

**Expected:**
- Reload — Monday hours persist correctly

---

## Module 3 — Spaces & Tables

### T-10 — Create a space
**Preconditions:** Logged in → navigate to **Spaces** tab → **Editor** sub-tab

**Steps:**
1. Click **New Space** (or the add button)
2. Enter name: `Terrasse`, cols: `4`, rows: `3`
3. Save

**Expected:**
- "Terrasse" appears in the space list
- Clicking it shows a 4×3 empty grid

---

### T-11 — Add tables to the grid
**Preconditions:** T-10 complete, "Terrasse" selected in Editor

**Steps:**
1. Click cell (col 1, row 1) — a table is created at that position
2. Repeat for (col 2, row 1) and (col 1, row 2)
3. Total: 3 tables added

**Expected:**
- 3 cells show table numbers (e.g. T1, T2, T3)
- Each cell has a QR icon or button

---

### T-12 — QR code generation and download
**Preconditions:** T-11 complete

**Steps:**
1. Click the QR button on table T1
2. A modal opens showing the QR code image
3. Note the URL shown — it should contain `/menu/cafetunisia?table=<uuid>`

**Expected:**
- QR code image is visible
- URL contains the correct tenant slug and a UUID
- Download button downloads a PNG/SVG file

---

### T-13 — Delete a table
**Steps:**
1. Delete table T3 from the grid (click delete or right-click → delete)
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
1. Click **Add staff** → name: `Sara Kitchen`, role: `Kitchen`, PIN: `2222` → Save
2. Click **Add staff** → name: `Omar Cashier`, role: `Cashier`, PIN: `3333` → Save

**Expected:**
- Both appear in the list with correct role badges

---

### T-16 — Edit staff name and change PIN
**Steps:**
1. Click edit on "Ali Waiter"
2. Change display name to `Ali Ben Waiter` → Save
3. Open PIN management for this staff member
4. Set new PIN: `5678` → Save

**Expected:**
- Name updated to "Ali Ben Waiter" in the list
- New PIN `5678` will be used for login (verified in T-25)

---

### T-17 — Assign waiter zone
**Preconditions:** T-14/T-16 complete, T-10/T-11 complete (Terrasse with tables)

**Steps:**
1. Go to **Spaces** → **Zones** sub-tab
2. Select staff: `Ali Ben Waiter`
3. Select space: `Terrasse`
4. Assign a zone covering cols 1–2, rows 1–2
5. Save

**Expected:**
- Zone appears in the zone list under Ali Ben Waiter
- Terrasse grid shows a zone overlay for those cells

---

### T-18 — Delete staff
**Steps:**
1. Click **Add staff** → name: `Temp Staff`, role: `Waiter`, PIN: `9999` → Save
2. Click delete on "Temp Staff" → confirm

**Expected:**
- "Temp Staff" no longer appears in the staff list

---

## Module 5 — Menu System

### T-19 — Create a category
**Preconditions:** Logged in → navigate to **Menu** tab

**Steps:**
1. Click **Add category**
2. Enter name: `Boissons`, sort order: `1`, active: yes
3. Save

**Expected:**
- "Boissons" appears in the category list/accordion

---

### T-20 — Create a menu item with photo
**Preconditions:** T-19 complete

**Steps:**
1. Expand "Boissons" category
2. Click **Add item**
3. Enter name: `Café`, price: `3.500`, description: `Espresso serré`, available: yes
4. Save
5. Click the photo/image button on the "Café" item row
6. Upload any JPG or PNG image (< 5 MB)

**Expected:**
- "Café" appears under Boissons with its price
- After upload, the item shows a thumbnail image
- The image URL ends in `.webp` (backend resizes to WebP 400×400)

---

### T-21 — Toggle item availability
**Steps:**
1. Find "Café" in the menu list
2. Toggle availability to **Unavailable** → confirm/save

**Expected:**
- Item shows as unavailable (grayed out or badge)
- Open the customer menu URL (from T-12 QR) — "Café" shows an "Unavailable" badge with no Add button

3. Toggle back to **Available** before continuing

---

### T-22 — Create a modifier group on an item
**Steps:**
1. Click edit on the "Café" item
2. Add a modifier group: name `Sucre`, required: yes, min: 1, max: 1
3. Add options: `Sans sucre` (price delta: 0), `Un sucre` (delta: 0), `Deux sucres` (delta: 0)
4. Save

**Expected:**
- On the customer menu, tapping "Café" opens a modifier modal with the three sugar options
- The form cannot be submitted without selecting one option (required group)

---

### T-23 — Create an ingredient and link to item
**Steps:**
1. In the Menu section, navigate to **Ingredients** (or via item edit)
2. Create ingredient: `Lait` → Save
3. Link `Lait` to the "Café" item

**Expected:**
- `Lait` appears in the ingredient list
- "Café" item shows `Lait` as a linked ingredient

---

### T-24 — Disabling an ingredient cascades to linked items
**Preconditions:** T-23 complete

**Steps:**
1. Find `Lait` in the ingredient list
2. Toggle it to **inactive** → save

**Expected:**
- "Café" item is automatically set to unavailable
- Customer menu no longer shows "Café" as available (grayed out or hidden)

3. Re-enable `Lait`
4. Manually re-enable "Café" availability (cascade only disables, does not auto re-enable)

---

## Module 6 — Staff PIN Login

### T-25 — Waiter PIN login
**Preconditions:** T-16 complete (Ali Ben Waiter with PIN 5678)

**Steps:**
1. Go to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/waiter/cafetunisia`
2. Enter PIN: `5678`
3. Tap/click **Login**

**Expected:**
- Logged in as "Ali Ben Waiter"
- Floor plan tab is visible
- Only tables within Ali's assigned zone are highlighted

---

### T-26 — Wrong PIN rejected
**Steps:**
1. Go to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/kitchen/cafetunisia`
2. Enter PIN: `0000` (invalid)
3. Tap **Login**

**Expected:**
- Error message: invalid PIN or staff not found
- Stays on PIN screen

---

### T-27 — Kitchen PIN login
**Preconditions:** T-15 complete (Sara Kitchen, PIN 2222)

**Steps:**
1. Go to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/kitchen/cafetunisia`
2. Enter PIN: `2222` → Login

**Expected:**
- Logged into kitchen display
- Two-column kanban (Pending / In Progress) visible — may be empty initially

---

### T-28 — Cashier PIN login
**Preconditions:** T-15 complete (Omar Cashier, PIN 3333)

**Steps:**
1. Go to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/cashier/cafetunisia`
2. Enter PIN: `3333` → Login

**Expected:**
- Logged into cashier app
- Two tabs visible: **New Order** and **Sessions**

---

## Module 7 — Customer QR Ordering Flow

### T-29 — Open customer menu via QR URL
**Preconditions:** T-11/T-12 complete (table T1 with QR code)

**Steps:**
1. From the Spaces → Editor QR modal, copy the table URL for T1
2. Open it in a new browser tab (or paste it directly)
   Format: `https://ashy-grass-0c75bb903.6.azurestaticapps.net/menu/cafetunisia?table=<uuid>`

**Expected:**
- Menu page loads showing the restaurant's active categories and items
- No login required

---

### T-30 — Browse categories and items
**Steps:**
1. On the customer menu page, verify categories are listed
2. Tap a category to expand or scroll to it
3. Verify items are shown with name, description, price, and photo (if uploaded)

**Expected:**
- Only active categories with available items are shown
- Unavailable items show an "Unavailable" badge — no Add button

---

### T-31 — Add items to cart including one with modifiers
**Preconditions:** T-22 complete (Café with Sucre modifier group)

**Steps:**
1. Tap **Add** on "Café"
2. Modifier modal opens → select "Un sucre" → confirm
3. Tap **Add** on another item (no modifiers)
4. Check the floating cart — correct item count and total

**Expected:**
- Cart badge shows 2 items
- Subtotal is correct (sum of prices)
- Required modifier was enforced — could not close modal without selecting

---

### T-32 — Required modifier enforced — cannot add without selection
**Steps:**
1. Tap **Add** on "Café"
2. In the modifier modal, do NOT select any sugar option
3. Try to confirm / add to cart

**Expected:**
- Confirm button is disabled or validation error is shown
- Item is not added to cart

---

### T-33 — Place order
**Preconditions:** T-31 complete (items in cart)

**Steps:**
1. Tap the floating cart button
2. Review items and total
3. Tap **Place order** / **Submit**

**Expected:**
- Order submitted successfully
- Cart clears
- Order status view appears showing: Pending / En attente
- Step indicator is visible (Pending → InProgress → Ready → Served)

---

### T-34 — Customer sees real-time status updates
**Preconditions:** T-33 complete (order placed), waiter or kitchen app open in another tab

**Steps:**
1. Keep the customer tab open on the order status view
2. In another tab, advance the order status (waiter app → Orders → advance to InProgress)
3. Watch the customer tab — do NOT refresh

**Expected:**
- Customer tab updates automatically within 1–2 seconds
- Step indicator moves to "InProgress / En préparation"

---

### T-35 — Call waiter button
**Preconditions:** T-33 complete, waiter app open in another tab (Ali, PIN 5678)

**Steps:**
1. On the customer order view, tap **Call waiter**

**Expected:**
- Waiter tab shows a notification banner with the table number
- Notification appears within 1–2 seconds

---

### T-36 — Request bill button
**Preconditions:** T-33 complete, waiter app open

**Steps:**
1. On the customer order view, tap **Request bill**

**Expected:**
- Waiter tab shows a "Bill requested" notification banner for the table

---

### T-37 — Shared cart across two devices
**Steps:**
1. Open the customer menu URL (same QR/table) in **two separate browser windows**
2. In window A, add "Café" to the cart
3. Watch window B — do NOT interact with it

**Expected:**
- Window B's cart updates automatically (SignalR `CartUpdated` event)
- A sync toast appears in window B
- Window B shows the same items as window A

---

## Module 8 — Waiter Application

### T-38 — Floor plan shows assigned zone only
**Preconditions:** T-17 complete (Ali's zone: cols 1–2, rows 1–2 of Terrasse), T-25 complete (logged in as Ali)

**Steps:**
1. On the waiter app, select space "Terrasse"

**Expected:**
- Only tables within Ali's zone (T1, T2) are highlighted/accessible
- Tables outside the zone are grayed out or not interactive

---

### T-39 — Receive notification and ACK an order
**Preconditions:** T-25 (waiter logged in as Ali), customer menu open at a table in Ali's zone

**Steps:**
1. From the customer menu tab, place a new order on table T1 (in Ali's zone)
2. Watch the waiter tab

**Expected:**
- Notification banner appears with order details and table number within 1–2 seconds
3. Tap **ACK** on the notification

**Expected:**
- Notification disappears
- Order appears in the waiter's Orders tab

---

### T-40 — Competing ACK — first waiter wins
**Preconditions:** Two waiter accounts both covering the same table, both logged in on separate browser windows

**Steps:**
1. Customer places an order at the shared table
2. Both waiter windows receive the notification
3. Waiter A taps **ACK** first

**Expected:**
- Notification disappears from Waiter A's screen and is marked acknowledged
- Waiter B sees "already taken" message or notification disappears gracefully (no crash)

---

### T-41 — Advance order status from waiter queue
**Preconditions:** T-39 complete (order in waiter's Orders tab)

**Steps:**
1. Go to the **Orders** tab on the waiter app
2. Find the order
3. Click advance (Pending → InProgress, or InProgress → Ready)

**Expected:**
- Order status changes on screen
- Customer tab (if open from T-34) updates in real time

---

### T-42 — Place order from waiter tablet (staff bypass)
**Steps:**
1. On the waiter app, tap **New Order** or the order creation button
2. Select table T1
3. Browse menu and add "Café"
4. Submit

**Expected:**
- Order created with status `InProgress` (staff bypass — skips Pending)
- Order appears in kitchen queue immediately

---

### T-43 — Move a table session
**Preconditions:** An active session on table T1 (from T-33 or T-42)

**Steps:**
1. Go to the **Sessions** tab on the waiter app
2. Find the open session for T1
3. Click **Move** → select T2 (which must be free)
4. Confirm

**Expected:**
- Session is now linked to T2
- T1 appears free on the floor plan
- T2 appears occupied

---

### T-44 — Merge two table sessions
**Preconditions:** Two open sessions exist (e.g. T1 and T2)

**Steps:**
1. Go to the **Sessions** tab
2. Find the T1 session → click **Merge** → select T2 session
3. Confirm

**Expected:**
- One combined session remains
- The merged session contains all orders from both tables

---

### T-45 — Close session and generate PDF bill (waiter)
**Preconditions:** An open session with at least one completed order

**Steps:**
1. On the Sessions tab, find the open session
2. Click **Close session** / generate bill

**Expected:**
- PDF renders in a modal or new tab with itemised list, prices, TVA breakdown, TND total
- Session status becomes closed
- Table shows as free on the floor plan

---

## Module 9 — Kitchen Application

### T-46 — New order appears in kitchen queue
**Preconditions:** T-27 (kitchen logged in as Sara), at least one pending order

**Steps:**
1. Place a new order from the customer menu (or waiter app)
2. If it's a customer order, advance it to InProgress in the waiter app first

**Expected:**
- Order appears in the **Pending** column of the kitchen kanban

---

### T-47 — Advance order through kitchen states
**Steps:**
1. Click **Commencer** (Start) on a Pending order → it moves to the InProgress column
2. Click **Prêt** (Ready) on the InProgress order

**Expected:**
- Order moves between columns correctly
- An elapsed time badge is visible and ticking
- When marked Ready: waiter app (if open) receives a "ready" notification

---

### T-48 — Reject an item
**Steps:**
1. Find an order with multiple items in the Pending or InProgress column
2. Click the reject button on one individual item

**Expected:**
- That item is marked as rejected
- A notification is sent to the covering waiter (or manager fallback)

---

### T-49 — Kitchen updates in real time without reload
**Steps:**
1. Kitchen tab is open and idle (no new orders)
2. Place a new order from the customer menu in another tab

**Expected:**
- Order appears in the Pending column automatically — no page refresh needed

---

## Module 10 — Cashier Application

### T-50 — Create a table order from cashier
**Preconditions:** T-28 (cashier logged in as Omar), table T1 exists

**Steps:**
1. On the cashier **New Order** tab
2. Select **Table** mode
3. Choose table T1
4. Add items from the menu picker
5. Submit

**Expected:**
- Order created with status `InProgress` (staff bypass)
- Order appears in the kitchen queue
- A session is opened for T1 if none existed

---

### T-51 — Create a takeaway order
**Steps:**
1. On the **New Order** tab, select **Takeaway** mode
2. Add items
3. Submit

**Expected:**
- Order created with a daily sequence number (format: YYYYMMDDNNNNN, e.g. `2026032300001`)
- Order appears on the Takeaway Display board at `https://ashy-grass-0c75bb903.6.azurestaticapps.net/takeaway/cafetunisia`

---

### T-52 — Close session and print bill from cashier
**Preconditions:** T-50 complete (open session on T1)

**Steps:**
1. Go to the **Sessions** tab on the cashier app
2. Find the T1 session
3. Click **Close** / generate bill

**Expected:**
- PDF bill modal appears with correct items and total
- Session closed, T1 shows as free on floor plan

---

## Module 11 — Takeaway Display

### T-53 — Takeaway order appears on display board
**Preconditions:** T-51 complete

**Steps:**
1. Open `https://ashy-grass-0c75bb903.6.azurestaticapps.net/takeaway/cafetunisia` in a separate tab
2. Place a new takeaway order from the cashier app

**Expected:**
- Order appears on the board with its sequence number and status: Pending
- No login required to view the board

---

### T-54 — Takeaway status updates in real time
**Steps:**
1. Keep the takeaway display tab open
2. In the kitchen tab, advance the takeaway order to InProgress → then Ready

**Expected:**
- Display updates automatically — no page refresh
- Order moves through: Pending → Preparing → Ready

---

## Module 12 — Full End-to-End Simulation

### T-55 — Complete dine-in flow (all roles active simultaneously)

Open all of the following tabs at the same time:
- **Tab A (Manager):** `https://ashy-grass-0c75bb903.6.azurestaticapps.net/manager/cafetunisia/dashboard`
- **Tab B (Customer):** QR URL for table T1 (from T-12)
- **Tab C (Waiter):** `/waiter/cafetunisia` — log in as Ali (PIN 5678)
- **Tab D (Kitchen):** `/kitchen/cafetunisia` — log in as Sara (PIN 2222)
- **Tab E (Cashier):** `/cashier/cafetunisia` — log in as Omar (PIN 3333)

**Steps:**
1. **Tab B (Customer):** Add 2 items (at least one with a modifier) → Place order
2. **Tab C (Waiter):** Notification banner appears → tap ACK
3. **Tab D (Kitchen):** Order appears in Pending → click Commencer → click Prêt
4. **Tab C (Waiter):** "Order ready" notification received → mark delivered
5. **Tab B (Customer):** Step indicator updates through each status without any reload
6. **Tab E (Cashier):** Sessions tab → close session → open PDF bill
7. **Tab A (Manager):** Dashboard KPI cards reflect the new completed order

**Expected at each step:**
- Step 2: Waiter notification within 1–2 seconds of order placement
- Step 3: Kitchen queue updates within 1–2 seconds
- Step 4: Waiter notified when kitchen marks Ready
- Step 5: Customer tab shows each status change in real time
- Step 6: PDF renders with all items, TVA, and TND total
- Step 7: Dashboard shows updated order count and revenue

---

### T-56 — Complete takeaway flow
**Steps:**
1. **Cashier (Tab E):** New Order → Takeaway mode → add 1 item → Submit
2. **Takeaway display** (`/takeaway/cafetunisia`): Confirm order appears with sequence number
3. **Kitchen (Tab D):** Advance to InProgress → then Ready
4. **Takeaway display:** Status updates in real time through each step
5. **Cashier (Tab E):** Close the takeaway order

**Expected:**
- Sequence number format is YYYYMMDDNNNNN
- Display updates without any reload at each kitchen step

---

## Module 13 — Manager Dashboard & Reports

### T-57 — Dashboard KPIs reflect real data
**Preconditions:** At least one completed order exists (run T-55 first)

**Steps:**
1. Go to `/manager/cafetunisia/dashboard`

**Expected:**
- KPI cards show non-zero values: orders today, revenue, average order value, top item
- Revenue bar chart shows data for recent days
- Top items list ranks ordered items by quantity

---

### T-58 — Live floor plan (Spaces → Live tab)
**Steps:**
1. Go to **Spaces** → **Live** tab
2. Ensure at least one active session on a table (from T-50 or T-55)

**Expected:**
- Occupied tables appear in a different colour (orange or red)
- Tables with pending/inProgress orders appear in an attention colour
- Free tables appear green
- Colours update automatically (auto-polls every 30 seconds)

---

### T-59 — QR download from Spaces Editor
**Steps:**
1. Go to **Spaces** → **Editor** tab
2. Click the QR button on any table
3. Click the **Download** button in the modal

**Expected:**
- A PNG or SVG file is downloaded
- The QR code encodes the correct URL: `.../menu/cafetunisia?table=<uuid>`

---

## Module 14 — Tenant Isolation

### T-60 — Data does not bleed between tenants
**Steps:**
1. Log in as `cafetunisia` manager → go to Menu → create category: `Isolation Test Cat`
2. Log out
3. Log in using `restauranttunisia` credentials (register via Swagger if needed: `POST /auth/register` with `X-Tenant: restauranttunisia`)
4. Go to the Menu tab

**Expected:**
- `Isolation Test Cat` does NOT appear for `restauranttunisia`
- restauranttunisia's menu is completely separate

---

### T-61 — Cross-tenant JWT is rejected
**Steps:**
1. Log in as `cafetunisia` manager
2. Open browser DevTools → Application → Local Storage → copy the value of `tabhub_token`
3. Open `https://api-tabhub.azurewebsites.net/swagger`
4. Click **Authorize** → paste the JWT token
5. Set the request header `X-Tenant: restauranttunisia`
6. Call `GET /spaces`

**Expected:**
- `401 Unauthorized` or `403 Forbidden`
- No restauranttunisia data is returned

---

## Module 15 — Navigation & URL Structure

### T-62 — All manager routes are path-based
**Steps:**
1. Log in → verify URL is `/manager/cafetunisia/dashboard`
2. Click each sidebar item and verify the URL changes to:
   - Dashboard → `/manager/cafetunisia/dashboard`
   - Menu → `/manager/cafetunisia/menu`
   - Spaces → `/manager/cafetunisia/spaces`
   - Staff → `/manager/cafetunisia/staff`
   - Config → `/manager/cafetunisia/config`

**Expected:**
- Each link navigates to the correct path
- Tenant slug `cafetunisia` is present in every URL
- Active sidebar item is highlighted

---

### T-63 — Direct URL navigation works after login
**Steps:**
1. Ensure you are already logged in (JWT in localStorage)
2. Navigate directly to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/manager/cafetunisia/staff`

**Expected:**
- Staff page loads directly without going through the dashboard

---

### T-64 — All staff and public app URLs load correctly
**Steps:**
Navigate to each of the following and verify the correct screen loads (no 404, no blank page):

| URL | Expected screen |
|---|---|
| `/waiter/cafetunisia` | PIN keypad for waiter |
| `/kitchen/cafetunisia` | PIN keypad for kitchen |
| `/cashier/cafetunisia` | PIN keypad for cashier |
| `/takeaway/cafetunisia` | Public takeaway board |
| `/menu/cafetunisia` | Public menu (may show error without valid `?table=` param) |
| `/admin/login` | Super admin login page (no tenant field) |

---

## Module 16 — PDF Bill

### T-65 — PDF bill content is correct
**Preconditions:** At least one closed session with 3+ items at different prices

**Steps:**
1. From the waiter or cashier app, close a session with 3+ different items
2. Open the PDF bill

**Expected:**
- PDF renders with visible text — not blank, not garbled boxes (Linux font smoke test)
- Restaurant name in the header
- Each item listed: name, quantity, unit price, line total
- Subtotal is correct (sum of line totals)
- TVA line shows correct rate and amount (e.g. 19%)
- Grand total in TND with 3 decimal places
- Date and time of bill generation is present

**If PDF fails:**
- Blank or empty boxes → font issue on Linux, needs fix
- 500 error → server crash, check App Service logs

---

## Module 17 — Image Upload

### T-66 — Menu item photo upload and display
**Steps:**
1. On the Menu page, click the photo button on any item
2. Select a JPG image (< 5 MB)
3. Confirm upload

**Expected:**
- Thumbnail appears on the item row in the manager menu
- On the customer menu, the item shows the uploaded photo
- Image URL ends in `.webp` (backend resizes to WebP 400×400)

---

### T-67 — Large image handling
**Steps:**
1. Try to upload an image larger than 5 MB

**Expected:**
- Either rejected with an error message, OR
- Accepted and silently resized to WebP 400×400 (verify output dimensions)

---

## Module 18 — Menu Scheduling

### T-68 — Active time-range menu appears on customer menu
**Steps:**
1. Go to **Menu** tab → **Menus** section
2. Create a menu: name `Menu Test`, add "Boissons" category to it
3. Add a schedule rule: type `TIME_RANGE`, start `00:00`, end `23:59`
4. Toggle the menu to **Active**
5. Open the customer menu URL (from T-29)

**Expected:**
- "Boissons" items are visible on the customer menu (menu is active 24h)

---

### T-69 — Inactive menu hides its categories from customer
**Steps:**
1. Toggle "Menu Test" to **Inactive**
2. Reload the customer menu URL

**Expected:**
- If "Boissons" is only assigned to this menu, it no longer appears on the customer menu

---

## Module 19 — Multilingual UI

### T-70 — Manager dashboard FR / AR / EN switching
**Steps:**
1. Log into the manager dashboard
2. Click **FR** → verify sidebar labels are in French
3. Click **EN** → verify labels switch to English
4. Click **AR** → verify labels switch to Arabic and layout flips to right-to-left

**Expected:**
- Text changes immediately without page reload for each language
- In Arabic: sidebar is on the right, text is right-aligned

---

### T-71 — Customer menu language selector
**Steps:**
1. Open the customer menu URL
2. If a language selector is visible, switch to Arabic

**Expected:**
- UI text switches to Arabic
- RTL layout applied

---

## Module 20 — Edge Cases & Error Handling

### T-72 — Customer cannot place an empty cart order
**Steps:**
1. Open the customer menu URL
2. Do not add any items
3. Attempt to access the cart or place order

**Expected:**
- Place order button is disabled or hidden when cart is empty

---

### T-73 — Unavailable item cannot be added to cart
**Preconditions:** "Café" is set to unavailable (T-21)

**Steps:**
1. Open the customer menu URL for cafetunisia
2. Find "Café" in the list

**Expected:**
- "Café" shows an "Unavailable" badge
- No **Add** button is visible
- Tapping the item does nothing or shows an unavailable message

---

### T-74 — Invalid QR token shows error
**Steps:**
1. Navigate to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/menu/cafetunisia?table=00000000-0000-0000-0000-000000000000`

**Expected:**
- Error message shown: "Invalid or inactive QR code" or similar
- Menu is not displayed

---

### T-75 — Unknown route redirects to login
**Steps:**
1. Navigate to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/this-does-not-exist`

**Expected:**
- Redirected to `/login`

---

## Module 21 — Super Admin Interface

### T-76 — Super admin login
**Steps:**
1. Go to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/admin/login`
2. Enter email: `mehdi@mehdi.com`, password: `mehdi123`
3. Click **Sign in**

**Expected:**
- Redirected to `/admin`
- Dashboard shows two tabs: **Tenants** and **Managers**
- No tenant slug was required during login

---

### T-77 — Super admin auth guard blocks unauthenticated access
**Steps:**
1. Open a private/incognito browser window
2. Navigate directly to `https://ashy-grass-0c75bb903.6.azurestaticapps.net/admin`

**Expected:**
- Redirected to `/admin/login`
- Dashboard is not visible

---

### T-78 — Wrong credentials rejected on admin login
**Steps:**
1. Go to `/admin/login`
2. Enter email: `mehdi@mehdi.com`, password: `wrongpassword`
3. Click **Sign in**

**Expected:**
- Error message appears ("Invalid credentials" or similar)
- Stays on `/admin/login` — no redirect

---

### T-79 — Regular manager cannot log in as super admin
**Steps:**
1. Go to `/admin/login`
2. Enter email: `mehdi@cafetunisia.com`, password: `mehdi123`
3. Click **Sign in**

**Expected:**
- Error message: "Invalid credentials"
- Login rejected (this account has `is_super_admin = false`)

---

### T-80 — Tenants tab lists existing tenants
**Preconditions:** T-76 complete (logged in as super admin)

**Steps:**
1. On the admin dashboard, click the **Tenants** tab

**Expected:**
- `cafetunisia` and `restauranttunisia` both appear in the list
- Each tenant shows its slug, schema name, and manager count

---

### T-81 — Create a new tenant
**Preconditions:** T-76 complete

**Steps:**
1. On the **Tenants** tab, fill in the **New Tenant** form:
   - Slug: `testcafe`
   - Display name: `Test Café`
2. Click **Create tenant**

**Expected:**
- Success message appears: "Tenant "testcafe" created."
- `testcafe` appears in the tenant list
- Schema was provisioned — log in at `/login` with tenant `testcafe` returns a valid (empty) response (not 404)

---

### T-82 — Create a new manager and assign to tenant
**Preconditions:** T-81 complete (`testcafe` tenant exists)

**Steps:**
1. Click the **Managers** tab
2. Fill in the **New Manager** form:
   - Display name: `Test Manager`
   - Email: `manager@testcafe.com`
   - Initial password: `test1234`
   - Assign to tenant: select `testcafe` from the dropdown
3. Click **Create manager**

**Expected:**
- Success message: "Manager "manager@testcafe.com" created."
- Manager appears in the list with `testcafe (owner)` badge
- Can log in at `/login` with tenant: `testcafe`, email: `manager@testcafe.com`, password: `test1234` → redirected to `/manager/testcafe/dashboard`

---

### T-83 — Assign existing manager to a second tenant
**Preconditions:** T-82 complete (`manager@testcafe.com` exists), T-81 complete (`testcafe` exists)

**Steps:**
1. On the **Managers** tab, fill in the **Assign Manager to Tenant** form:
   - Manager: select `Test Manager (manager@testcafe.com)` from the dropdown
   - Tenant: select `Cafe Tunisia (cafetunisia)`
   - Role: `Admin`
2. Click **Assign**

**Expected:**
- Success message: "Manager assigned."
- Manager now shows two tenant badges: `testcafe (owner)` and `cafetunisia (admin)`
- Can log in at `/login` with tenant: `cafetunisia`, email: `manager@testcafe.com`, password: `test1234` → access granted

---

## Checklist Summary

Use this as a quick reference to track what you've verified:

| # | Module | Test | ✅ / ❌ |
|---|---|---|---|
| T-01 | Auth | Manager login | |
| T-02 | Auth | Wrong password rejected | |
| T-03 | Auth | Unknown tenant rejected | |
| T-04 | Auth | Auth guard blocks unauthenticated access | |
| T-05 | Auth | Logout | |
| T-06 | Auth | Language switcher persists across reload | |
| T-07 | Config | Update restaurant name | |
| T-08 | Config | Update TVA rate | |
| T-09 | Config | Update opening hours | |
| T-10 | Spaces | Create a space | |
| T-11 | Spaces | Add tables to the grid | |
| T-12 | Spaces | QR code generation and download | |
| T-13 | Spaces | Delete a table | |
| T-14 | Staff | Create a waiter | |
| T-15 | Staff | Create kitchen and cashier staff | |
| T-16 | Staff | Edit staff name and change PIN | |
| T-17 | Staff | Assign waiter zone | |
| T-18 | Staff | Delete staff | |
| T-19 | Menu | Create a category | |
| T-20 | Menu | Create a menu item with photo | |
| T-21 | Menu | Toggle item availability | |
| T-22 | Menu | Create a modifier group | |
| T-23 | Menu | Create ingredient and link to item | |
| T-24 | Menu | Disable ingredient cascades to item | |
| T-25 | Staff Login | Waiter PIN login | |
| T-26 | Staff Login | Wrong PIN rejected | |
| T-27 | Staff Login | Kitchen PIN login | |
| T-28 | Staff Login | Cashier PIN login | |
| T-29 | Customer | Open customer menu via QR URL | |
| T-30 | Customer | Browse categories and items | |
| T-31 | Customer | Add items to cart with modifiers | |
| T-32 | Customer | Required modifier enforced | |
| T-33 | Customer | Place order | |
| T-34 | Customer | Real-time status updates | |
| T-35 | Customer | Call waiter button | |
| T-36 | Customer | Request bill button | |
| T-37 | Customer | Shared cart across two devices | |
| T-38 | Waiter | Floor plan shows assigned zone | |
| T-39 | Waiter | Receive and ACK notification | |
| T-40 | Waiter | Competing ACK — first waiter wins | |
| T-41 | Waiter | Advance order status | |
| T-42 | Waiter | Place order from waiter tablet | |
| T-43 | Waiter | Move table session | |
| T-44 | Waiter | Merge table sessions | |
| T-45 | Waiter | Close session and PDF bill | |
| T-46 | Kitchen | Order appears in kitchen queue | |
| T-47 | Kitchen | Advance order through kitchen states | |
| T-48 | Kitchen | Reject an item | |
| T-49 | Kitchen | Real-time updates without reload | |
| T-50 | Cashier | Create a table order | |
| T-51 | Cashier | Create a takeaway order | |
| T-52 | Cashier | Close session and print bill | |
| T-53 | Takeaway | Order appears on display board | |
| T-54 | Takeaway | Status updates in real time | |
| T-55 | E2E | Complete dine-in flow (all roles) | |
| T-56 | E2E | Complete takeaway flow | |
| T-57 | Dashboard | KPIs reflect real data | |
| T-58 | Dashboard | Live floor plan | |
| T-59 | Dashboard | QR download from Editor | |
| T-60 | Isolation | Data does not bleed between tenants | |
| T-61 | Isolation | Cross-tenant JWT rejected | |
| T-62 | Navigation | Manager routes are path-based | |
| T-63 | Navigation | Direct URL navigation works | |
| T-64 | Navigation | All app URLs load correctly | |
| T-65 | PDF | Bill content is correct + Linux font smoke test | |
| T-66 | Images | Photo upload and display | |
| T-67 | Images | Large image handling | |
| T-68 | Scheduling | Active time-range menu on customer menu | |
| T-69 | Scheduling | Inactive menu hides categories | |
| T-70 | i18n | Manager dashboard FR/AR/EN switching | |
| T-71 | i18n | Customer menu language selector | |
| T-72 | Edge cases | Empty cart cannot be submitted | |
| T-73 | Edge cases | Unavailable item cannot be added | |
| T-74 | Edge cases | Invalid QR token shows error | |
| T-75 | Edge cases | Unknown route redirects to login | |
| T-76 | Super Admin | Super admin login | |
| T-77 | Super Admin | Auth guard blocks unauthenticated access | |
| T-78 | Super Admin | Wrong credentials rejected | |
| T-79 | Super Admin | Regular manager cannot log in as super admin | |
| T-80 | Super Admin | Tenants tab lists existing tenants | |
| T-81 | Super Admin | Create a new tenant | |
| T-82 | Super Admin | Create a new manager and assign to tenant | |
| T-83 | Super Admin | Assign existing manager to a second tenant | |
