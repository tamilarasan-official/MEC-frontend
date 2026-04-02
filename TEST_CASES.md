# CampusOne - Manual Test Cases

> **App:** CampusOne (MEC Food Ordering)
> **Platform:** Android (React Native 0.83.1)
> **Date:** 2026-03-30
> **Roles:** Student, Captain, Owner, Stationery Owner

---

## 1. Authentication

### TC-1.1: OTP Login (Existing User) done 
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open app (logged out) | Login screen shows with phone input |
| 2 | Enter valid 10-digit phone (starts with 6-9) | "Send OTP" button enabled |
| 3 | Tap "Send OTP" | OTP sent, redirects to OTP screen, 30s resend cooldown |
| 4 | Enter 6-digit OTP (or auto-read from SMS) | Auto-verifies, shows login success overlay (3s green screen) |
| 5 | Wait for overlay to dismiss | Navigates to role-based dashboard |

### TC-1.2: OTP Login - Wrong OTP 
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Complete steps 1-3 from TC-1.1 | OTP screen shown |
| 2 | Enter wrong 6-digit OTP | Error: "Invalid OTP" with shake animation |
| 3 | Re-enter correct OTP | Login succeeds |

### TC-1.3: OTP Login - Phone Not Found
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter unregistered phone number | |
| 2 | Tap "Send OTP" | Error: "No account found" or redirects to register flow |

### TC-1.4: OTP Login - Rate Limited
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send OTP 5+ times within 10 minutes | Error: "Too many attempts. Try again later" (429) |

### TC-1.5: OTP Resend Cooldown
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send OTP | "Resend" button disabled, 30s countdown shown |
| 2 | Wait 30 seconds | "Resend" button re-enabled |
| 3 | Tap Resend | New OTP sent |

### TC-1.6: New User Registration
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter unregistered phone number | Detected as new user, name input shown |
| 2 | Enter full name + OTP | Account created, auto-login, PIN setup screen appears |

### TC-1.7: Username/Password Login (Staff)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to username login | Username + password form shown |
| 2 | Enter valid captain/owner credentials | Login success, navigates to work mode dashboard |

### TC-1.8: Logout
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open profile dropdown | Sign Out option visible |
| 2 | Tap "Sign Out" | Confirmation dialog appears |
| 3 | Tap "Sign Out" in dialog | Tokens cleared, redirected to login screen |

### TC-1.9: Force Logout (Another Device)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login on Device A | App loads normally |
| 2 | Login on Device B (same account) | Device A shows red "Session Ended" overlay |
| 3 | Tap "OK, GOT IT" on Device A | Returns to login screen |

### TC-1.10: Session Expiry (3-Day Inactivity)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login, then don't use app for 3+ days | |
| 2 | Open app | Auto-logged out, shows login screen |

### TC-1.11: Account Deletion
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to Profile > Delete Account | Confirmation dialog appears |
| 2 | If wallet balance > 0 | Deletion blocked: "Withdraw balance first" |
| 3 | If wallet balance = 0, confirm delete | Account deleted, logged out |

---

## 2. Transaction PIN

### TC-2.1: First-Time PIN Setup
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login as user without PIN setup | Full-screen purple PIN setup overlay blocks app |
| 2 | Enter 4-digit PIN | Moves to "Confirm your PIN" step |
| 3 | Enter same 4 digits | API call, success, overlay dismissed, app accessible |

### TC-2.2: PIN Setup - Mismatch
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter 4-digit PIN | Moves to confirm step |
| 2 | Enter different 4 digits | Shake animation, error "PINs don't match", resets to step 1 |

### TC-2.3: Change PIN - Correct Current PIN
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Profile > Transaction PIN > Change PIN | "Enter current PIN" screen |
| 2 | Enter correct current 4-digit PIN | API verifies PIN, moves to "Enter new PIN" |
| 3 | Enter new 4-digit PIN | Moves to "Confirm new PIN" |
| 4 | Enter same new PIN | API call succeeds, success modal shown |

### TC-2.4: Change PIN - Wrong Current PIN
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Profile > Transaction PIN > Change PIN | "Enter current PIN" screen |
| 2 | Enter wrong PIN | Shake animation, error "Wrong PIN. Please try again.", PIN cleared |
| 3 | User stays on "Enter current PIN" step | Can retry |

### TC-2.5: Change PIN - New PINs Don't Match
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter correct current PIN | Passes, moves to new PIN |
| 2 | Enter new PIN | Moves to confirm |
| 3 | Enter different PIN | Shake, "PINs don't match", goes back to new PIN step |

### TC-2.6: Change PIN - Lockout After 3 Wrong Attempts
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter wrong current PIN 3 times | Error with countdown: "Too many attempts. Try again in 0:30" |
| 2 | Wait 30 seconds | Can retry |

### TC-2.7: Change PIN - 60s Cooldown
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Successfully change PIN | Success modal |
| 2 | Immediately try to change again | Error: "PIN was recently changed. Wait 60 seconds" |

### TC-2.8: Forgot PIN Flow
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Transaction PIN > Forgot PIN | "Send OTP" screen with masked phone |
| 2 | Tap "Send OTP" | OTP sent, moves to OTP entry (6 digits) |
| 3 | Enter correct OTP | Moves to "Enter new PIN" |
| 4 | Enter new PIN + confirm | API resets PIN, success modal |

### TC-2.9: Forgot PIN - Wrong OTP
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Complete send OTP | OTP screen |
| 2 | Enter wrong 6-digit OTP, then new PIN + confirm | Error: "Invalid or expired OTP" on submit |

### TC-2.10: PIN Screen Security
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open any PIN screen (setup/change/verify) | |
| 2 | Try to take screenshot | Screenshot blocked (black screen on Android) |

---

## 3. Food Ordering (Student)

### TC-3.1: Browse Menu & Add to Cart
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Dashboard | Menu loads with category pills + food cards |
| 2 | Tap a category pill (e.g., "Snacks") | Menu filters to that category |
| 3 | Tap "+" on a food item | Item added to cart, floating cart bar appears at bottom |
| 4 | Tap "+" again on same item | Quantity increases to 2 |
| 5 | Tap "-" on item | Quantity decreases to 1 |

### TC-3.2: Cart - View & Modify
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap floating cart bar | Cart bottom sheet slides up |
| 2 | See items with images, names, prices, quantities | All correct |
| 3 | Modify quantity with +/- | Total updates in real-time |
| 4 | Tap trash icon on item | Item removed from cart |
| 5 | Verify wallet balance displayed | Shows current balance |
| 6 | Verify total matches item prices x quantities | Correct |

### TC-3.3: Place Order - Success (With PIN)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Cart has items, balance sufficient | "Pay Rs.XXX" button enabled (blue/green gradient) |
| 2 | Tap "Pay Rs.XXX" | PIN verify modal slides up showing amount + items |
| 3 | Enter correct 4-digit PIN | PIN verified, modal closes, order submitting |
| 4 | Wait for API response | Success animation: checkmark + pickup token + "Order Confirmed!" |
| 5 | Animation auto-dismisses (5s) or tap | QR card shows with order details |
| 6 | Dismiss QR card | Back to dashboard, cart empty, balance deducted |

### TC-3.4: Place Order - Wrong PIN
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap "Pay Rs.XXX" | PIN modal appears |
| 2 | Enter wrong 4-digit PIN | Shake animation, "Wrong PIN. Please try again.", PIN cleared |
| 3 | Enter correct PIN | Order proceeds normally |

### TC-3.5: Place Order - PIN Lockout During Payment
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter wrong PIN 3 times | Lockout: "Too many attempts. Try again in 0:30" with countdown |
| 2 | Wait for countdown to finish | Can enter PIN again |

### TC-3.6: Place Order - Insufficient Balance
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add items exceeding wallet balance | Red text: "Insufficient balance. Add Rs.XXX to proceed" |
| 2 | "Pay" button disabled (gray) | Cannot proceed |

### TC-3.7: Place Order - Shop Closed
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Shop is marked closed by owner | Banner: "Shop is currently closed" |
| 2 | "Pay" button shows "Shop Closed" (gray) | Cannot proceed |

### TC-3.8: Place Order - Split Order (Instant + Regular)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add both instant (flash icon) and regular items | |
| 2 | Complete payment | Success animation shows TWO pickup tokens |
| 3 | Dismiss animation | QR card for first order, then second order |

### TC-3.9: Order Failure - API Error
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger order failure (e.g., server down) | Failure animation: red "Order Failed" with error message |
| 2 | Dismiss | Returns to cart with items still present |

### TC-3.10: Active Orders Carousel
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Place an order | Active order card appears on dashboard with pulsing animation |
| 2 | See item names, status badge, pickup token | All correct |
| 3 | Tap the order card | QR card opens with order details |
| 4 | If multiple active orders, swipe horizontally | Carousel paginates, dot indicators update |

### TC-3.11: Diet Filter
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Set diet to "Veg" in profile | |
| 2 | Browse menu | Only vegetarian items shown |
| 3 | Set back to "All" | All items shown |

### TC-3.12: Search Menu
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap search icon | Search modal opens with keyboard |
| 2 | Type item name | Results filter in real-time |
| 3 | Tap item "+" | Added to cart |

---

## 4. Wallet

### TC-4.1: View Wallet Balance
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap wallet pill in header | Wallet modal shows balance |
| 2 | Navigate to Wallet tab | Full wallet screen with balance + transaction history |

### TC-4.2: Top-Up via Razorpay
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap "+" top-up button | Top-up modal appears |
| 2 | Enter amount (e.g., 100) | Amount shown |
| 3 | Tap "Add Money" | Razorpay payment gateway opens |
| 4 | Complete payment (UPI/Card/NetBanking) | Success: balance updated, transaction in history |

### TC-4.3: Top-Up - Payment Cancelled
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Razorpay | Payment gateway shown |
| 2 | Press back / cancel | "Payment cancelled" message, balance unchanged |

### TC-4.4: Transaction History
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Wallet screen | Transaction list loads |
| 2 | Scroll through transactions | Shows debits (red) and credits (green) with dates |
| 3 | Tap a transaction | Transaction detail screen opens |

### TC-4.5: Wallet - Secure Screen
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Wallet screen | |
| 2 | Try to screenshot | Screenshot blocked (Android) |

---

## 5. QR Scanner

### TC-5.1: Scan Order QR (Student)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Scanner tab | Camera opens with scan frame |
| 2 | Point at valid order QR | QR detected, order details shown |

### TC-5.2: Scan Payment QR (Student)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Scan a stationery payment QR | Payment confirm modal shows amount + payee |
| 2 | If balance sufficient, tap "Pay" | PIN verify modal → enter PIN → payment success |
| 3 | If balance insufficient | "Insufficient balance" shown |

### TC-5.3: Scanner - Invalid QR
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Scan a non-CampusOne QR code | Toast: "Invalid QR code" |

### TC-5.4: Scanner - Camera Permission Denied
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Deny camera permission | "Camera access needed" with "Open Settings" button |
| 2 | Tap "Open Settings" | Device settings opens |
| 3 | Grant permission, return to app | Camera activates |

### TC-5.5: Scanner - Zoom Controls
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open scanner | Default 3x zoom |
| 2 | Tap "+" zoom button | Zoom increases |
| 3 | Tap "-" zoom button | Zoom decreases |
| 4 | Pinch to zoom | Smooth zoom in/out |

### TC-5.6: Scanner - Move Closer Hint
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open scanner, don't scan anything | After 3s, "Move closer" hint overlay appears |

---

## 6. Order Tracking (Student)

### TC-6.1: View Active Orders
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Orders tab | Active orders shown with status badges |
| 2 | See per-item status tags | Each item shows "Pending" / "Preparing" / "Ready" / "Delivered" / "Rejected" |

### TC-6.2: Real-Time Status Update
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Have an active order (status: pending) | |
| 2 | Captain accepts items | Item tags change to "Preparing" in real-time |
| 3 | Captain marks items ready | Item tags update to "Ready" |
| 4 | All items ready | Order moves to "Ready" status, pickup popup shown |

### TC-6.2.1: Item Rejected by Captain - Student View
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Captain rejects one item from a 3-item order | |
| 2 | Student sees rejected item | "Rejected · ₹XX refunded" tag, item grayed out |
| 3 | Wallet balance increases by refund amount | Real-time balance update via socket |
| 4 | Remaining items continue through normal flow | Preparing → Ready → Delivered |

### TC-6.3: Order Status Popup
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Order status changes | Full-screen popup with status, item names, pickup token |
| 2 | Auto-dismiss after 3s | Popup disappears |
| 3 | Multiple status changes quickly | Popups queue, show one at a time |

### TC-6.4: View Order QR
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap active order | QR card opens with order details + QR code |
| 2 | QR shows app logo overlay | Medium error correction QR |
| 3 | Try screenshot | Blocked (secure screen) |

### TC-6.5: Order History
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Order History | Past orders (completed/cancelled) shown |
| 2 | Orders sorted by date (newest first) | Correct order |

---

## 7. Captain - Work Mode

### TC-7.1: View Incoming Orders
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login as captain (work mode) | Dashboard shows order tabs: Ready to Serve, New, Preparing, etc. |
| 2 | New order arrives | Card appears in "New" tab with items, total, token |

### TC-7.2: Accept All Items (Order-Level Swipe)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In "New" tab, swipe **whole order card** RIGHT | Card animates off-screen |
| 2 | All items accepted at once | Order moves to "Preparing" tab, all items show "PREP" tag |

### TC-7.3: Reject All Items (Order-Level Swipe)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In "New" tab, swipe **whole order card** LEFT | Reject confirmation modal: "Reject order #XXXX? Full amount will be refunded." |
| 2 | Confirm reject | Order cancelled, full amount refunded to student wallet |

### TC-7.4: Accept Single Item
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In "New" tab, swipe **individual item card** RIGHT | Item accepted, moves to "preparing" status |
| 2 | Other items in order remain pending | Can still accept/reject individually |
| 3 | When all items accepted or rejected | Order auto-transitions (preparing/cancelled) |

### TC-7.5: Reject Single Item (Partial Refund)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In "New" tab, swipe **individual item card** LEFT | Reject confirmation: "Reject {item name}? ₹{amount} will be refunded." |
| 2 | Confirm reject | Item marked "REJECTED" (grayed out), item amount refunded to student |
| 3 | Student sees item as "Rejected · ₹XX refunded" | Wallet balance updated in real-time |
| 4 | If all items rejected | Order auto-cancels with full refund |

### TC-7.6: Mark Item Ready (Swipe in Preparing)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In "Preparing" tab, swipe **item card** RIGHT | Item marked as "READY" |
| 2 | If all items ready | Order moves to "Ready" tab |
| 3 | If some items still preparing | Order moves to "Partially Ready" (purple) |

### TC-7.7: Deliver Item (Swipe in Ready/Partial Ready)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In "Partially Ready" tab, swipe **ready item** RIGHT | Item marked as "DELIVERED" |
| 2 | In "Ready" tab, swipe **item** RIGHT | Item marked as "DELIVERED" |
| 3 | When all items delivered | Order auto-completes |

### TC-7.8: Mark Order Delivered (Ready Tab)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In "Ready" tab, swipe **whole order card** RIGHT | All items delivered, order completed |
| 2 | Order disappears from active list | Student notified |

### TC-7.9: Mixed Accept/Reject in New Tab
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Order with 3 items in "New" tab | Each item shown as swipeable card |
| 2 | Swipe item A RIGHT (accept) | Item A → preparing |
| 3 | Swipe item B LEFT (reject) | Confirm → item B rejected, ₹XX refunded |
| 4 | Swipe item C RIGHT (accept) | Item C → preparing |
| 5 | Order now has 2 accepted items | Moves to "Preparing" tab, student sees 1 item rejected + refund |

### TC-7.7: Captain QR Scanner
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap floating QR scanner FAB | Scanner modal opens |
| 2 | Scan student's order QR | Order verified, items marked delivered |

### TC-7.8: Prep List View
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Prep List tab | Aggregated item list across all pending/preparing orders |
| 2 | See item name, total qty, pending qty | All correct |

### TC-7.9: Order History (Captain)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to History tab | Completed + cancelled orders shown |

---

## 8. Captain/Owner - Eat Mode

### TC-8.1: Switch to Eat Mode
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open profile dropdown | Mode toggle: Eat / Work |
| 2 | Tap "Eat" | Tabs change to: Home (menu), Orders, Scanner |
| 3 | Dashboard shows food menu (same as student) | Can browse, add to cart, order |

### TC-8.2: Order Food in Eat Mode
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Browse menu, add items, tap Pay | PIN verify modal |
| 2 | Enter PIN | Order placed, success animation with pickup token |
| 3 | Active order carousel appears with pulsing animation | Same UI as student |

### TC-8.3: Active Order Carousel (Eat Mode)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Place order in eat mode | Carousel card with pulsing dot, item names, status, token |
| 2 | Tap card | QR modal opens |
| 3 | Multiple orders, swipe | Carousel paginates with dot indicators |

### TC-8.4: Split Order in Eat Mode
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add instant + regular items | |
| 2 | Complete payment | Success animation shows both tokens |
| 3 | Dismiss | QR for first order, then second |

### TC-8.5: Transaction PIN in Eat Mode
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open profile dropdown (eat mode) | "Transaction PIN" menu item visible |
| 2 | Tap it | TransactionPINScreen opens as modal |
| 3 | Change PIN / Forgot PIN flows work | Same as student |

### TC-8.6: Switch Back to Work Mode
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open profile dropdown | Tap "Work" |
| 2 | Tabs revert to work mode | Home, Prep List, History |

---

## 9. Owner - Work Mode

### TC-9.1: Owner Dashboard
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login as owner (work mode) | Dashboard with order tabs (same as captain) |
| 2 | Order actions available | Per-item swipe: accept, reject, ready, deliver (same as captain TC-7.2–7.9) |

### TC-9.2: Owner Analytics
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Analytics tab | Revenue, order count, profit metrics |
| 2 | Toggle time filter (Today/Week/Month/All) | Data updates |
| 3 | Top selling items shown | Name, qty, revenue |

### TC-9.3: Owner Menu Management
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Menu tab | All menu items listed |
| 2 | Add/edit/delete items | CRUD operations work |
| 3 | Toggle item availability | Item shown/hidden for students |

---

## 10. Stationery Owner

### TC-10.1: Create QR Payment
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap "Create QR" on Stationery Home | Modal with title, description, amount fields |
| 2 | Fill fields, submit | QR code generated and displayed |
| 3 | Student scans QR | Payment confirm modal on student side |

### TC-10.2: View Active QR Payments
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Stationery Home screen | Shows active (unpaid) QR payments |
| 2 | When student pays | QR auto-dismisses, moves to history |

### TC-10.3: Stationery Analytics
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Analytics tab | Revenue card, payment count, 7-day chart |
| 2 | Toggle time filter | Data updates |
| 3 | Top 5 customers listed | Name, total spend |

### TC-10.4: Stationery Payment History
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to History tab | All paid transactions listed |
| 2 | Quick filter tabs (Today/Week/Month/Date) | Filters apply |
| 3 | Tap specific date on calendar | Shows transactions for that day |
| 4 | Total amount summary | Correct for filtered period |

---

## 11. Notifications

### TC-11.1: Push Notification (App Backgrounded)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Background the app | |
| 2 | Order status changes | Push notification in system tray |
| 3 | Tap notification | App opens to relevant screen |

### TC-11.2: In-App Notification (App Foregrounded)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | App is open | |
| 2 | Order status changes | Status popup overlay (3s auto-dismiss) with item names + token |

### TC-11.3: Notification Bell
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap notification bell icon | Notifications list opens |
| 2 | See order/wallet notifications | Each with icon, message, timestamp |
| 3 | Tap a notification | Navigates to relevant screen |

### TC-11.4: Wallet Credit Notification
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Receive wallet credit (top-up or refund) | Notification: "Wallet credited Rs.XXX" |
| 2 | Balance updates in real-time | Wallet pill in header refreshes |

---

## 12. Profile & Settings

### TC-12.1: Change Password
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Profile > Change Password | Form: current password, new password, confirm |
| 2 | Enter correct current + valid new password | Success message |
| 3 | Enter wrong current password | Error message |

### TC-12.2: Theme Toggle
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Profile dropdown > Appearance | Light / Dark / System options |
| 2 | Toggle to Dark | App switches to dark theme immediately |
| 3 | Toggle to System | Follows device setting |

### TC-12.3: Diet Filter (Eat Mode)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Profile dropdown (eat mode) > Diet | All / Veg options |
| 2 | Select "Veg" | Menu filters to vegetarian items only |

---

## 13. Edge Cases & Error Handling

### TC-13.1: Network Error During Order
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add items to cart, disable network | |
| 2 | Tap Pay, enter PIN | Error: network/timeout error message |
| 3 | Order NOT created | Balance unchanged |

### TC-13.2: App Background + Resume
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Have active orders | |
| 2 | Background app for 1+ minutes | |
| 3 | Resume app | Orders refresh, wallet balance updates, socket reconnects |

### TC-13.3: Multiple Rapid QR Scans
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Scan the same QR quickly | Only first scan processed, cooldown prevents duplicates |

### TC-13.4: Force App Update
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Server requires newer app version | Update modal appears with "Visit Play Store" |
| 2 | Cannot dismiss if force update | Must update to continue |

### TC-13.5: Token Refresh (30-Minute Expiry)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Stay logged in for 30+ minutes | |
| 2 | Make any API call | Token auto-refreshes silently, no logout |

### TC-13.6: Concurrent Orders (Same User)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Place first order | Success, active order card shown |
| 2 | Place second order | Both orders in carousel, swipeable |

### TC-13.7: Order While PIN Locked
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Fail PIN 3 times during payment | Lockout countdown shown |
| 2 | Try to dismiss and re-pay | Modal still shows lockout until timer expires |

### TC-13.8: Compact QR Format
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Stationery owner creates QR payment | QR generated in compact format |
| 2 | Student scans compact QR | Correctly decoded, payment modal shows |

---

## 14. Real-Time Updates (Socket.IO)

### TC-14.1: Order Status - Pending to Preparing (Item-Level Accept)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Student places order | Status: Pending, all items "pending" |
| 2 | Captain accepts all items (swipe order right) | Student sees: all items → "Preparing", order status → "Preparing" |

### TC-14.1.1: Item Rejected - Real-Time Refund
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Student places 3-item order (₹198) | Status: Pending |
| 2 | Captain rejects 1 item (₹58) | Student sees: item "Rejected", balance +₹58, order total adjusted |
| 3 | Captain accepts remaining 2 items | Items → "Preparing", order → "Preparing" |

### TC-14.2: Order Status - Partially Ready
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Order has 3 items | All "Preparing" |
| 2 | Captain swipes 2 items right (ready) | Status: "Partially Ready" (purple), 2 items show "Ready" tag |
| 3 | Captain swipes last item right | Status: "Ready" (green) |

### TC-14.3: QR Card Real-Time Update
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Student has QR card open | |
| 2 | Captain changes order status | QR card updates status + item tags in real-time |

### TC-14.4: Wallet Balance Real-Time
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Student has app open | |
| 2 | Accountant credits wallet | Balance in header pill updates without refresh |

### TC-14.5: New Order Notification (Captain)
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Captain in work mode | |
| 2 | Student places order | New order appears in "New" tab + notification sound |

---

## 15. Cross-Role Testing Matrix

| Scenario | Student | Captain (Eat) | Captain (Work) | Owner (Eat) | Owner (Work) | Stationery Owner |
|----------|---------|---------------|----------------|-------------|--------------|-----------------|
| Browse menu | Y | Y | - | Y | - | - |
| Add to cart + order | Y | Y | - | Y | - | - |
| PIN verify on payment | Y | Y | - | Y | - | Y (QR pay) |
| Active order carousel | Y | Y | - | Y | - | - |
| Order success animation | Y | Y | - | Y | - | - |
| View wallet | Y | Y | - | Y | - | Y |
| Top-up wallet | Y | Y | - | Y | - | Y |
| Change PIN | Y | Y | - | Y | - | - |
| Forgot PIN | Y | Y | - | Y | - | - |
| QR scanner | Y | Y | Y | Y | Y | - |
| Manage orders | - | - | Y | - | Y | - |
| View analytics | - | - | - | - | Y | Y |
| Create QR payment | - | - | - | - | - | Y |
| Theme toggle | Y | Y | Y | Y | Y | Y |
| Force logout | Y | Y | Y | Y | Y | Y |

---

## Test Environment

| Item | Value |
|------|-------|
| API Base URL | `https://campusoneapi.madrascollege.ac.in/api/v1` |
| Android Package | `com.mec.campusone` |
| Access Token Expiry | 30 minutes |
| Refresh Token Expiry | 7 days |
| Session Timeout | 3 days inactivity |
| PIN Length | 4 digits |
| OTP Length | 6 digits |
| PIN Lockout | 3 wrong attempts = 30s lockout |
| PIN Change Cooldown | 60 seconds |
| Order Status Flow | pending → preparing → partially_ready → ready → completed |
| Item Status Flow | pending → preparing → ready → delivered (or pending → rejected + refund) |
| Order Status Derivation | Auto-derived from item statuses (rejected items excluded) |
