# iOS Developer Handoff - 2026-05-10

**Prepared by:** CampusOne Dev Team  
**Date:** 10 May 2026  
**Covers:** All major changes shipped after the previous handoff dated 2026-04-28, through 2026-05-10  
**iOS Action Required:** Yes - see Section 4

---

## Table of Contents

1. [Session Summary](#1-session-summary)
2. [Backend Changes](#2-backend-changes-mecfoodapp-backend)
3. [Web Frontend Changes](#3-web-frontend-changes-mecfoodapp-frontend)
4. [Android Changes -> iOS Requirements](#4-android-changes---ios-requirements)
5. [New API / Data Contract Reference](#5-new-api--data-contract-reference)
6. [Environment / Config Notes](#6-environment--config-notes)
7. [Commit Reference Table](#7-commit-reference-table)

---

## 1. Session Summary

This handoff covers the work completed after the 2026-04-28 handoff. The biggest platform additions were announcements, streak/weekly challenge improvements, hosteller meal compliance with missed-meal auto debit, owner-side official veg meal selection, and the final Android patch work for release `1.2.9`.

| # | Area | Type | iOS Action? |
|---|------|------|-------------|
| 1 | Changelog / What's New timeline | Full-stack feature | Yes |
| 2 | Announcements system | Full-stack feature | Yes |
| 3 | Streak + weekly challenge expansion | Full-stack feature | Yes |
| 4 | Hosteller meal compliance + auto debit | Full-stack feature | Yes |
| 5 | Meal-compliance shop flag (`isMealComplianceShop`) | Backend + web + mobile integration | Yes |
| 6 | Scanner order lookup fix | Mobile bug fix | Yes |
| 7 | Leaderboard + streak UI polish | Mobile UX update | Yes |
| 8 | App version detection fix + Android `1.2.9` prep | Mobile release fix | Yes |

---

## 2. Backend Changes (`mecfoodapp-backend`)

### 2.1 Changelog / What's New Feed

**Commits:** `afd399c`, `81ece73`, `627ac54`, `246d863`, `5ed1192`

Backend now serves a seeded changelog timeline used by the mobile `What's New` screen. Release notes have been extended through version `1.2.9`.

Important points:
- Android `1.2.8` and `1.2.9` notes are seeded on the server
- mobile clients read this from backend, not from local app constants

### 2.2 Announcements Module

**Commits:** `ec3dc06`, `a3c2293`, `96c3035`

New announcements module added with accountant / superadmin support and live broadcast capability.

Behaviour:
- backend stores and serves active announcements
- socket broadcast is supported for live updates
- access control was corrected so superadmin can manage announcements too

### 2.3 Streak / Weekly Challenge Enhancements

**Commits:** `afd399c`, `9979b34`, `c5686f9`, `2241839`, `e38a9dd`, `2909c32`, `17f30cf`

The streak backend now supports:
- weekly food challenge tracking with claim state
- better per-shop heatmap logic
- filtering heatmaps to shops the student actually ordered from
- top-food image URL proxy fixes
- performance/indexing improvements for streak queries

### 2.4 Hosteller Meal Compliance + Missed-Meal Auto Debit

**Commits:** `8885399`, `2c0e81e`, `d9d885e`, `c94f9a2`

New backend feature set:
- `Hosteller` / `Day Scholar` user tagging
- meal compliance records for breakfast / lunch / dinner
- owner-selected official veg item snapshot per session
- missed-meal debit / refund transaction sources
- reminder notifications before sessions
- scheduled and manual compliance runs

Important behaviour:
- if `autoDebitEnabled` is OFF, reminders still work
- if session veg snapshot is missing, debit does not guess the amount and the run fails safely

### 2.5 Meal Compliance Shop Decoupled from Category

**Commit:** `369eecd`

Meal compliance no longer depends on `shop.category === 'classic'`.

New approach:
- keep `Madras Kitchen` as `category: 'canteen'`
- mark the real meal-compliance shop with `isMealComplianceShop: true`

Why this matters:
- student/captain food flows continue to work with canteen-based lookup
- meal compliance can still target the same shop without category conflicts

### 2.6 Shop Night Lock Rollback

**Commit:** `44ed704`

The temporary automatic night-lock shop closure logic was disabled again. Shops are back to manual open/close behaviour.

---

## 3. Web Frontend Changes (`mecfoodapp-frontend`)

### 3.1 What's New Page / Changelog Surfacing

**Commit:** `0be44dc`

Web support for changelog / versioned release note surfacing was added as part of the broader changelog rollout.

### 3.2 Announcements Management

**Commit:** `89c34fd`

Announcements management UI was added to accountant and superadmin dashboards.

### 3.3 Meal Compliance Dashboard

**Commits:** `05c2c47`, `46651cc`, `f5228d6`, `01444c6`, `26d14c6`, `03a5519`, `479f426`, `aefe665`

Accountant-side meal compliance tooling now includes:
- meal compliance dashboard tab
- editable breakfast / lunch / dinner session windows
- India-date defaulting to avoid UTC day mismatch
- session save feedback
- record fetch limit clamp
- diagnostics panel for why debit ran / did not run
- separate meal-compliance shop toggle in shop management

### 3.4 Accountant Export Report Enhancement

**Commit:** `f8a3370`

Added accountant credit export report support for PDF generation by selected date range.

---

## 4. Android Changes -> iOS Requirements

### 4.1 iOS ACTION: What's New / Changelog Screen

**Android branch commits:** `6579e39`, `a2975de`

Android now exposes release notes more prominently and is prepared for `1.2.9`.

iOS should match:
- fetch server changelog feed
- surface the latest release notes in-app
- ensure patch releases can be shown without hardcoded client strings

### 4.2 iOS ACTION: Announcements UI

**Android commits:** `6579e39`, `6b17504`, `a2975de`

Android shipped:
- announcement cards on student dashboard
- redesigned purple carousel presentation
- notification-related card/modal refreshes

iOS should mirror:
- active announcement display in student home
- live refresh behaviour where applicable
- announcement presentation parity with the current mobile design language

### 4.3 iOS ACTION: Streak / Weekly Challenge / Leaderboard Refresh

**Android commits:** `4f5d8ec`, `a2975de`

Android now includes:
- weekly challenge card with reward open flow
- streak UI polish
- icon-based replacements where emoji-only UI was used before
- leaderboard "Your Place" card between podium and full list
- streak full-screen cleanup

iOS should mirror:
- weekly challenge surfaced in streak experience
- updated leaderboard layout showing logged-in user rank card
- refreshed streak visuals and card structure

### 4.4 iOS ACTION: Meal Compliance Student Flow

**Android commit:** `a2975de`

Android added:
- student meal compliance service layer
- meal compliance history screen
- wallet/history support for missed meal debit visibility
- dashboard / streak / wallet integration for hosteller meal compliance

iOS should mirror:
- hosteller-facing missed-meal history
- wallet labeling for missed meal debit / refund
- any student-facing meal-compliance notices already present on Android

### 4.5 iOS ACTION: Owner Meal-Veg Selection Uses Shop Flag

**Android commit:** `a2975de`

Owner app behaviour on Android now:
- fetches `/owner/shop`
- reads `isMealComplianceShop`
- shows `Set Meal Veg` only when the shop is flagged for meal compliance
- owner can set Breakfast / Lunch / Dinner official veg item from the menu page

iOS should match exactly. Do not gate this by `category === "classic"` anymore.

### 4.6 iOS ACTION: Scanner Fix for "Order Not Found"

**Android commit:** `a2975de`

Android fixed a real bug where scanning failed for some valid orders because the app searched only the first paginated shop-order page.

New Android behaviour:
- scanner fetches the scanned order directly by order ID
- it no longer depends on the limited paginated shop order list

iOS should mirror this to avoid captain/owner scan failures on busy days.

### 4.7 iOS ACTION: App Version Check Must Use Installed Native Version

**Android commit:** `a2975de`

Android now uses `DeviceInfo.getVersion()` for:
- version-check comparison
- `X-App-Version` request header

This fixes the bad update loop where a Play Store-updated build could still appear outdated if the app compared against a stale JS package version.

iOS should use the installed native app version for update checks, not a bundled static JS version string.

### 4.8 Android Release Prep Included in Current Branch

**Android commit:** `a2975de`

Current Android branch state now includes:
- app version `1.2.9`
- Android `versionCode = 30`

---

## 5. New API / Data Contract Reference

### `GET /api/v1/owner/shop`

Owner shop payload now effectively includes:

```json
{
  "success": true,
  "data": {
    "name": "Madras Kitchen",
    "category": "canteen",
    "isActive": true,
    "canGenerateQR": false,
    "isMealComplianceShop": true
  }
}
```

Use `isMealComplianceShop` to decide whether owner meal-session veg controls should be shown.

### `POST /api/v1/owner/menu/:id/official-meal-session`

Used by Android owner menu to mark an available veg item as the official meal item for the selected session.

**Body:**
```json
{
  "sessionType": "breakfast"
}
```

Allowed values:
- `breakfast`
- `lunch`
- `dinner`

### Meal Compliance Scope Rule

Meal compliance now targets the flagged shop via:
- `isMealComplianceShop === true`

It no longer depends on:
- `shop.category === "classic"`

---

## 6. Environment / Config Notes

Important live configuration points:

| Setting | Location | Purpose |
|---|---|---|
| `autoDebitEnabled` | `PlatformSettings` Mongo singleton | Master switch for meal auto debit |
| `isMealComplianceShop` | Shop document | Marks the real meal-compliance shop while keeping category as `canteen` |
| `latestVersion` / `minimumVersion` | App Version Management | Must be updated to `1.2.9` when the new build is released |

Operational rule for meal compliance:
- the owner must set the official veg item for each session before debit can work
- if the veg snapshot is missing, the backend does not debit and instead fails safely

---

## 7. Commit Reference Table

### Backend (`mecfoodapp-backend` - `main`)

| Commit | Description |
|---|---|
| `afd399c` | Add streak module and changelog module |
| `ec3dc06` | Add announcements module with socket broadcast |
| `9979b34` | Add weekly food challenge tracking |
| `8885399` | Add `Hosteller` / `Day Scholar` user tags |
| `2c0e81e` | Add meal compliance backend module |
| `d9d885e` | Keep meal reminders active when auto debit is off |
| `c94f9a2` | Add owner meal-session veg snapshot flow |
| `44ed704` | Disable automatic shop night lock |
| `369eecd` | Decouple meal compliance from shop category |
| `5ed1192` | Update changelog for version `1.2.9` |

### Web Frontend (`mecfoodapp-frontend` - `main`)

| Commit | Description |
|---|---|
| `0be44dc` | Add What's New page and changelog support |
| `89c34fd` | Add announcements management dashboards |
| `05c2c47` | Add accountant meal compliance dashboard |
| `46651cc` | Expose editable meal session timings |
| `f8a3370` | Add accountant credit export report |
| `f5228d6` | Clamp meal compliance record page size |
| `01444c6` | Add editable shop lock window settings |
| `26d14c6` | Add meal session save feedback |
| `03a5519` | Use India date for meal compliance dashboard |
| `479f426` | Add meal compliance shop flag controls |
| `aefe665` | Add meal compliance diagnostics panel |

### Mobile (`frontend` - `Android-tamil`)

| Commit | Description |
|---|---|
| `6579e39` | Add announcement cards to dashboard with live refresh |
| `6b17504` | Redesign announcements as swipeable carousel |
| `4f5d8ec` | Add weekly challenge card and gift-box modal |
| `a2975de` | Ship meal compliance mobile flow, scanner fix, owner meal-veg flag support, version-check fix, and Android `1.2.9` prep |

---

*Document prepared: 2026-05-10 - CampusOne / Madras Engineering College*
