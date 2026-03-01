# CampusOne Student API — React Native Integration Guide

> **Base URL:** `https://<your-domain>/api/v1`
> **Authentication:** Bearer Token (JWT)
> **Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Profile](#2-profile)
3. [Shops](#3-shops)
4. [Menu & Categories](#4-menu--categories)
5. [Orders](#5-orders)
6. [Wallet](#6-wallet)
7. [Razorpay Payments (Wallet Top-Up)](#7-razorpay-payments-wallet-top-up)
8. [Ad-Hoc Payments](#8-ad-hoc-payments)
9. [Leaderboard](#9-leaderboard)
10. [Real-Time Events (Socket.IO)](#10-real-time-events-socketio)
11. [Enums & Constants](#11-enums--constants)
12. [Error Handling](#12-error-handling)
13. [Rate Limits](#13-rate-limits)

---

## Global Response Format

Every API response follows this structure:

### Success

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

## 1. Authentication

All auth endpoints are prefixed with `/auth`.

### 1.1 Register

Creates a new student account. Account requires admin approval before the student can place orders.

```
POST /auth/register
```

**Headers:** None required

**Request Body:**

| Field        | Type   | Required | Validation                                                                 |
|--------------|--------|----------|---------------------------------------------------------------------------|
| `username`   | string | Yes      | 4–20 chars, lowercase letters, numbers, underscores only (`^[a-z0-9_]+$`) |
| `password`   | string | Yes      | 8–72 chars, must contain: uppercase, lowercase, digit, special character   |
| `name`       | string | Yes      | 2–100 chars                                                                |
| `phone`      | string | Yes      | 10-digit Indian mobile (`^[6-9]\d{9}$`)                                   |
| `email`      | string | No       | Valid email format                                                         |
| `rollNumber` | string | Yes      | 1–20 chars (auto-uppercased)                                               |
| `department` | string | Yes      | One of: `CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`, `IT`, `AIDS`, `AIML`, `OTHER` |
| `year`       | number | Yes      | `1`, `2`, `3`, or `4`                                                      |

**Example Request:**

```json
{
  "username": "john_doe",
  "password": "SecureP@ss1",
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "rollNumber": "21CS101",
  "department": "CSE",
  "year": 3
}
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "665a1b2c3d4e5f6a7b8c9d0e",
      "username": "john_doe",
      "name": "John Doe",
      "phone": "9876543210",
      "email": "john@example.com",
      "rollNumber": "21CS101",
      "department": "CSE",
      "year": 3,
      "role": "student",
      "isApproved": false,
      "isActive": true,
      "balance": 0
    },
    "message": "Registration successful. Your account is pending admin approval."
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Errors:**
- `400` — Validation failed (duplicate username/phone/email, invalid fields)

---

### 1.2 Login (Username & Password)

```
POST /auth/login
```

**Headers:** None required

**Request Body:**

| Field        | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| `username`   | string | Yes      | Case-insensitive           |
| `password`   | string | Yes      |                            |
| `deviceId`   | string | No       | Unique device identifier   |
| `deviceInfo` | object | No       | Device metadata (see below)|

**`deviceInfo` object (all fields optional):**

| Field                 | Type   | Description               |
|-----------------------|--------|---------------------------|
| `platform`            | string | `android` / `ios`         |
| `brand`               | string | Device brand              |
| `model`               | string | Device model              |
| `osVersion`           | string | OS version string         |
| `language`            | string | Device language           |
| `timezone`            | string | IANA timezone             |
| `screenResolution`    | string | e.g. `1080x2400`         |
| `networkType`         | string | `wifi` / `4g` / `5g`     |
| `hardwareConcurrency` | string | CPU cores                 |
| `deviceMemory`        | string | RAM in GB                 |

**Example Request:**

```json
{
  "username": "john_doe",
  "password": "SecureP@ss1",
  "deviceId": "abc-123-device-uuid",
  "deviceInfo": {
    "platform": "android",
    "brand": "Samsung",
    "model": "Galaxy S24",
    "osVersion": "15"
  }
}
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "665a1b2c3d4e5f6a7b8c9d0e",
      "username": "john_doe",
      "name": "John Doe",
      "role": "student",
      "isApproved": true,
      "isActive": true,
      "balance": 500,
      "department": "CSE",
      "year": 3
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": "15m"
    }
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Errors:**
- `401` — Invalid credentials
- `423` — Account locked (after 5 failed attempts)

**Notes:**
- Access token expires in **15 minutes**
- Refresh token expires in **7 days**
- Store both tokens securely using `react-native-keychain` or `expo-secure-store`

---

### 1.3 Send OTP

Sends a one-time password to the student's registered phone number.

```
POST /auth/send-otp
```

**Request Body:**

| Field   | Type   | Required | Validation                          |
|---------|--------|----------|-------------------------------------|
| `phone` | string | Yes      | 10-digit Indian mobile (`^[6-9]\d{9}$`) |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123def456",
    "message": "OTP sent successfully"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Errors:**
- `429` — Rate limited (max 5 OTPs per 10 minutes)

---

### 1.4 Verify OTP

Verifies the OTP and logs the user in.

```
POST /auth/verify-otp
```

**Request Body:**

| Field        | Type   | Required | Validation                          |
|--------------|--------|----------|-------------------------------------|
| `phone`      | string | Yes      | 10-digit Indian mobile              |
| `sessionId`  | string | Yes      | From `/auth/send-otp` response      |
| `otp`        | string | Yes      | 4–6 digits (`^\d{4,6}$`)            |
| `deviceId`   | string | No       | Unique device identifier            |
| `deviceInfo` | object | No       | Same as login `deviceInfo`          |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": "15m"
    }
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Errors:**
- `401` — `INVALID_OTP` — Invalid or expired OTP

---

### 1.5 Refresh Token

Use this to get a new access token before the current one expires.

```
POST /auth/refresh
```

**Request Body:**

| Field          | Type   | Required | Description        |
|----------------|--------|----------|--------------------|
| `refreshToken` | string | Yes      | The refresh token  |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": "15m"
    }
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Errors:**
- `401` — `NO_REFRESH_TOKEN` — Missing or invalid refresh token

**React Native Implementation Note:**
Set up an Axios/fetch interceptor that automatically calls this endpoint when a `401` is received, then retries the original request with the new access token.

---

### 1.6 Get Current User

Returns the authenticated user's full profile.

```
GET /auth/me
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "665a1b2c3d4e5f6a7b8c9d0e",
      "username": "john_doe",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "avatarUrl": "/images/avatars/john.jpg",
      "role": "student",
      "isApproved": true,
      "isActive": true,
      "balance": 500,
      "rollNumber": "21CS101",
      "department": "CSE",
      "year": 3,
      "dietPreference": "all",
      "lastLoginAt": "2026-02-25T10:00:00.000Z",
      "createdAt": "2026-01-15T08:00:00.000Z"
    }
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 1.7 Change Password

```
PUT /auth/change-password
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**

| Field             | Type   | Required | Validation                                                       |
|-------------------|--------|----------|------------------------------------------------------------------|
| `currentPassword` | string | Yes      |                                                                  |
| `newPassword`     | string | Yes      | 8–72 chars, uppercase + lowercase + digit + special character     |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 1.8 Logout

```
POST /auth/logout
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Notes:** Invalidates all active sessions for the user. Clear stored tokens on the client.

---

## 2. Profile

### 2.1 Get Profile

```
GET /student/profile
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "_id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "john_doe",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "avatarUrl": "/images/avatars/john.jpg",
    "role": "student",
    "isApproved": true,
    "isActive": true,
    "balance": 500,
    "department": "CSE",
    "year": 3,
    "rollNumber": "21CS101"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 2.2 Update Profile

```
PUT /student/profile
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body (all fields optional):**

| Field      | Type   | Validation                                  |
|------------|--------|---------------------------------------------|
| `name`     | string | 2–100 chars                                 |
| `email`    | string | Valid email                                 |
| `phone`    | string | 10-digit Indian mobile (`^[6-9]\d{9}$`)    |
| `avatarUrl`| string | Valid URL                                   |

**Response `200 OK`:** Returns the updated profile (same structure as GET).

---

### 2.3 Upload Avatar

```
PUT /student/profile/avatar
```

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Form Data:**

| Field    | Type | Constraints                    |
|----------|------|-------------------------------|
| `avatar` | File | Image only (jpeg, png, webp), max 5 MB |

**React Native Example:**

```javascript
const formData = new FormData();
formData.append('avatar', {
  uri: imageUri,
  type: 'image/jpeg',
  name: 'avatar.jpg',
});

const response = await fetch(`${BASE_URL}/student/profile/avatar`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
  body: formData,
});
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "avatarUrl": "/images/avatars/665a1b2c_avatar.jpg"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

## 3. Shops

### 3.1 List All Shops

```
GET /shops
```

**Headers:** None required (public endpoint)

**Query Parameters:**

| Param        | Type   | Default | Description                                    |
|-------------|--------|---------|------------------------------------------------|
| `activeOnly`| string | `true`  | `"true"` or `"false"`                          |
| `category`  | string | —       | Filter by: `canteen`, `classic`, `bites`, `laundry`, `stationery`, `other` |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "665b2c3d4e5f6a7b8c9d0e1f",
        "name": "Main Canteen",
        "description": "College main canteen",
        "category": "canteen",
        "isActive": true,
        "imageUrl": "/images/shops/canteen.jpg",
        "bannerUrl": "/images/shops/canteen_banner.jpg",
        "rating": 4.2,
        "totalOrders": 1250,
        "contactPhone": "9876543210",
        "canGenerateQR": true
      }
    ]
  },
  "meta": {
    "count": 5
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 3.2 Get Shop Details

```
GET /shops/:id
```

**Headers:** None required (public endpoint)

**URL Parameters:**

| Param | Type   | Description              |
|-------|--------|--------------------------|
| `id`  | string | Shop MongoDB ObjectId (24 hex chars) |

**Response `200 OK`:** Single shop object (same structure as list item).

**Errors:**
- `404` — `NOT_FOUND` — Shop not found

---

## 4. Menu & Categories

### 4.1 Get All Menu Items

Returns menu items from all active shops.

```
GET /menu/items
```

**Headers:** None required (public endpoint)

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "665c3d4e5f6a7b8c9d0e1f2a",
        "name": "Chicken Biryani",
        "description": "Hyderabadi style biryani",
        "price": 120,
        "image": "/images/menu/biryani.jpg",
        "imageUrl": "/images/menu/biryani.jpg",
        "category": "665d4e5f6a7b8c9d0e1f2a3b",
        "shopId": "665b2c3d4e5f6a7b8c9d0e1f",
        "shopName": "Main Canteen",
        "isAvailable": true,
        "isVeg": false,
        "isInstant": false,
        "isOffer": true,
        "offerPrice": 99,
        "rating": 4.5,
        "preparationTime": "15"
      }
    ]
  },
  "meta": {
    "count": 45
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 4.2 Get All Active Offers

```
GET /menu/offers
```

**Headers:** None required (public endpoint)

**Response `200 OK`:** Same structure as `/menu/items`, filtered to items with active offers.

---

### 4.3 Get Shop Menu

Returns menu items for a specific shop with filtering options.

```
GET /shops/:shopId/menu
```

**Headers:** None required (public endpoint)

**URL Parameters:**

| Param    | Type   | Description     |
|----------|--------|-----------------|
| `shopId` | string | Shop ObjectId   |

**Query Parameters:**

| Param            | Type   | Default | Description                    |
|-----------------|--------|---------|--------------------------------|
| `categoryId`    | string | —       | Filter by category ObjectId    |
| `search`        | string | —       | Search in name/description (max 100 chars) |
| `availableOnly` | string | —       | `"true"` or `"false"`          |
| `vegetarianOnly`| string | —       | `"true"` or `"false"`          |
| `minPrice`      | number | —       | Minimum price filter           |
| `maxPrice`      | number | —       | Maximum price filter           |

**Response `200 OK`:** Array of menu item objects.

---

### 4.4 Get Shop Categories

```
GET /shops/:shopId/categories
```

**Headers:** None required (public endpoint)

**Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "665d4e5f6a7b8c9d0e1f2a3b",
      "name": "Biryani",
      "description": "Rice dishes",
      "icon": "rice",
      "sortOrder": 1
    },
    {
      "_id": "665d4e5f6a7b8c9d0e1f2a3c",
      "name": "Beverages",
      "description": "Hot and cold drinks",
      "icon": "coffee",
      "sortOrder": 2
    }
  ],
  "meta": {
    "count": 6
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 4.5 Get Shop Offers

```
GET /shops/:shopId/offers
```

**Headers:** None required (public endpoint)

**Response `200 OK`:** Array of menu items with active offers for the specified shop.

---

## 5. Orders

All order endpoints require authentication.

### 5.1 Create Order (Single Shop)

Places an order for food items from a single shop. Payment is deducted from wallet automatically.

```
POST /orders
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**

| Field   | Type   | Required | Validation                              |
|---------|--------|----------|-----------------------------------------|
| `shopId`| string | Yes      | Valid MongoDB ObjectId (24 hex chars)   |
| `items` | array  | Yes      | 1–20 items                              |
| `notes` | string | No       | Max 500 chars                           |

**`items` array element:**

| Field        | Type   | Required | Validation        |
|-------------|--------|----------|-------------------|
| `foodItemId`| string | Yes      | Valid ObjectId    |
| `quantity`  | number | Yes      | Integer, 1–50     |

**Example Request:**

```json
{
  "shopId": "665b2c3d4e5f6a7b8c9d0e1f",
  "items": [
    { "foodItemId": "665c3d4e5f6a7b8c9d0e1f2a", "quantity": 2 },
    { "foodItemId": "665c3d4e5f6a7b8c9d0e1f2b", "quantity": 1 }
  ],
  "notes": "Extra spicy please"
}
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "665e5f6a7b8c9d0e1f2a3b4c",
      "userId": "665a1b2c3d4e5f6a7b8c9d0e",
      "userName": "John Doe",
      "shopId": "665b2c3d4e5f6a7b8c9d0e1f",
      "shopName": "Main Canteen",
      "orderNumber": "ORD-20260225-0042",
      "items": [
        {
          "foodItemId": "665c3d4e5f6a7b8c9d0e1f2a",
          "name": "Chicken Biryani",
          "imageUrl": "/images/menu/biryani.jpg",
          "quantity": 2,
          "subtotal": 240,
          "delivered": false
        },
        {
          "foodItemId": "665c3d4e5f6a7b8c9d0e1f2b",
          "name": "Cold Coffee",
          "imageUrl": "/images/menu/coffee.jpg",
          "quantity": 1,
          "subtotal": 60,
          "delivered": false
        }
      ],
      "total": 300,
      "status": "pending",
      "notes": "Extra spicy please",
      "createdAt": "2026-02-25T10:30:00.000Z",
      "placedAt": "2026-02-25T10:30:00.000Z"
    },
    "qrData": "ORD-20260225-0042|1234",
    "newBalance": 200,
    "wasSplit": false
  },
  "message": "Order created successfully",
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Errors:**
- `400` — Validation error / items unavailable / shop inactive
- `402` — Insufficient wallet balance

**Notes:**
- `qrData` is the string to encode into a QR code for order pickup verification
- If items marked as `isInstant` exist, they auto-complete; other items remain pending
- Wallet is debited automatically upon order creation

---

### 5.2 Create Batch Order (Multi-Shop)

Places orders across multiple shops in a single request. Useful for cart checkout spanning different shops.

```
POST /orders/batch
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**

| Field    | Type  | Required | Validation    |
|----------|-------|----------|---------------|
| `orders` | array | Yes      | 1–5 orders    |

Each order in the array follows the same schema as a single order (`shopId`, `items`, `notes`).

**Example Request:**

```json
{
  "orders": [
    {
      "shopId": "665b2c3d4e5f6a7b8c9d0e1f",
      "items": [{ "foodItemId": "665c3d4e5f6a7b8c9d0e1f2a", "quantity": 1 }],
      "notes": "No onion"
    },
    {
      "shopId": "665b2c3d4e5f6a7b8c9d0e2a",
      "items": [{ "foodItemId": "665c3d4e5f6a7b8c9d0e2b3c", "quantity": 2 }]
    }
  ]
}
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "orders": [ ... ],
    "newBalance": 150,
    "totalDeducted": 350
  },
  "message": "Batch order created: 2 orders",
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 5.3 Create Stationery Order

Places a print/stationery order.

```
POST /orders/stationery
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**

| Field                 | Type    | Required | Validation                          |
|----------------------|---------|----------|-------------------------------------|
| `shopId`             | string  | Yes      | Valid ObjectId                      |
| `pageCount`          | number  | Yes      | Integer, 1–1000                     |
| `copies`             | number  | Yes      | Integer, 1–100                      |
| `colorType`          | string  | Yes      | `"bw"` or `"color"`                 |
| `paperSize`          | string  | Yes      | `"A4"`, `"A3"`, `"Letter"`, `"Legal"` |
| `doubleSided`        | boolean | No       | Default: `false`                    |
| `specialInstructions`| string  | No       | Max 500 chars                       |

**Response `201 Created`:** Same order structure as single order.

---

### 5.4 Get My Orders

Returns the authenticated student's order history with pagination and filtering.

```
GET /orders/my
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**

| Param      | Type   | Default | Description                                                        |
|-----------|--------|---------|--------------------------------------------------------------------|
| `page`    | number | `1`     | Page number (min: 1)                                               |
| `limit`   | number | `20`    | Items per page (1–100)                                             |
| `status`  | string | —       | Comma-separated: `pending`, `preparing`, `ready`, `completed`, `cancelled` |
| `startDate`| string | —      | ISO 8601 or `YYYY-MM-DD`                                          |
| `endDate` | string | —       | ISO 8601 or `YYYY-MM-DD`                                          |

**Example:** `GET /orders/my?status=pending,preparing&page=1&limit=10`

**Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "665e5f6a7b8c9d0e1f2a3b4c",
      "orderNumber": "ORD-20260225-0042",
      "shopName": "Main Canteen",
      "items": [ ... ],
      "total": 300,
      "status": "preparing",
      "placedAt": "2026-02-25T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 23,
    "pages": 3
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 5.5 Get Order by ID

```
GET /orders/:id
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Parameters:**

| Param | Type   | Description       |
|-------|--------|-------------------|
| `id`  | string | Order ObjectId    |

**Response `200 OK`:** Full order object.

**Errors:**
- `403` — Cannot view orders belonging to other students
- `404` — Order not found

---

### Order Status Flow

```
pending → preparing → ready → completed
                                  ↑
           any status → cancelled (with wallet refund)
```

| Status                  | Meaning                                          |
|------------------------|--------------------------------------------------|
| `pending`              | Order placed, awaiting shop acceptance            |
| `preparing`            | Shop is preparing the order                       |
| `ready`                | Order is ready for pickup                         |
| `partially_delivered`  | Some items delivered (multi-item orders)           |
| `completed`            | All items delivered, order finished                |
| `cancelled`            | Order cancelled, wallet refunded                  |

---

## 6. Wallet

### 6.1 Get Wallet Balance

```
GET /student/wallet
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "balance": 500,
    "user": {
      "id": "665a1b2c3d4e5f6a7b8c9d0e",
      "name": "John Doe",
      "email": "john@example.com",
      "rollNumber": "21CS101"
    }
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 6.2 Get Transaction History

```
GET /student/wallet/transactions
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**

| Param      | Type   | Default | Description                        |
|-----------|--------|---------|------------------------------------|
| `type`    | string | —       | `"credit"`, `"debit"`, or `"refund"` |
| `startDate`| string | —      | ISO 8601 or `YYYY-MM-DD`          |
| `endDate` | string | —       | ISO 8601 or `YYYY-MM-DD`          |
| `page`    | number | `1`     | Min: 1                             |
| `limit`   | number | `20`    | 1–100                              |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "665f6a7b8c9d0e1f2a3b4c5d",
      "userId": "665a1b2c3d4e5f6a7b8c9d0e",
      "type": "debit",
      "amount": 300,
      "source": "order_payment",
      "description": "Order ORD-20260225-0042 payment",
      "balance": 200,
      "createdAt": "2026-02-25T10:30:00.000Z"
    },
    {
      "id": "665f6a7b8c9d0e1f2a3b4c5e",
      "userId": "665a1b2c3d4e5f6a7b8c9d0e",
      "type": "credit",
      "amount": 500,
      "source": "online_payment",
      "description": "Wallet top-up via Razorpay",
      "balance": 500,
      "createdAt": "2026-02-25T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Transaction Types:**

| Type     | Description                           |
|----------|---------------------------------------|
| `credit` | Money added (top-up, refund)          |
| `debit`  | Money deducted (order payment)        |
| `refund` | Refund from cancelled order           |

**Credit Sources:**

| Source            | Description                      |
|-------------------|----------------------------------|
| `cash_deposit`    | Cash deposited by accountant     |
| `online_payment`  | Razorpay top-up                  |
| `refund`          | Order cancellation refund        |
| `adjustment`      | Manual adjustment                |
| `complementary`   | Free credit                      |

---

## 7. Razorpay Payments (Wallet Top-Up)

### 7.1 Create Payment Order

Initiates a Razorpay payment to add money to the wallet.

```
POST /razorpay/create-order
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**

| Field    | Type   | Required | Validation            |
|----------|--------|----------|-----------------------|
| `amount` | number | Yes      | 1–50,000 (in rupees)  |

**Example Request:**

```json
{
  "amount": 500
}
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "order_P1a2b3c4d5e6f7",
    "entity": "order",
    "amount": 50000,
    "amount_paid": 0,
    "amount_due": 50000,
    "currency": "INR",
    "receipt": "rcpt_665a1b2c_1740470000",
    "status": "created",
    "attempts": 0,
    "created_at": 1740470000
  }
}
```

**Note:** The `amount` in the response is in **paise** (×100). Pass this order to the Razorpay React Native SDK.

**React Native Integration:**

```javascript
import RazorpayCheckout from 'react-native-razorpay';

const options = {
  description: 'Wallet Top-Up',
  image: 'https://your-app-logo.png',
  currency: 'INR',
  key: '<RAZORPAY_KEY_ID>',
  amount: response.data.amount, // in paise
  order_id: response.data.id,
  name: 'CampusOne',
  prefill: {
    email: user.email,
    contact: user.phone,
    name: user.name,
  },
  theme: { color: '#F37254' },
};

const paymentData = await RazorpayCheckout.open(options);
// paymentData contains: razorpay_order_id, razorpay_payment_id, razorpay_signature
```

---

### 7.2 Verify Payment

After Razorpay SDK returns success, call this to verify the payment and credit the wallet.

```
POST /razorpay/verify-payment
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**

| Field                 | Type   | Required | Validation                          |
|-----------------------|--------|----------|-------------------------------------|
| `razorpay_order_id`   | string | Yes      | Format: `order_[A-Za-z0-9]+`       |
| `razorpay_payment_id` | string | Yes      | Format: `pay_[A-Za-z0-9]+`         |
| `razorpay_signature`  | string | Yes      | 64-char hex string                  |

**Example Request:**

```json
{
  "razorpay_order_id": "order_P1a2b3c4d5e6f7",
  "razorpay_payment_id": "pay_Q9z8y7x6w5v4u3",
  "razorpay_signature": "a1b2c3d4e5f6...64chars"
}
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "transaction": {
      "_id": "665f6a7b8c9d0e1f2a3b4c5e",
      "userId": "665a1b2c3d4e5f6a7b8c9d0e",
      "amount": 500,
      "type": "credit",
      "description": "Wallet top-up via Razorpay",
      "paymentGateway": "razorpay",
      "razorpayOrderId": "order_P1a2b3c4d5e6f7",
      "razorpayPaymentId": "pay_Q9z8y7x6w5v4u3",
      "createdAt": "2026-02-25T10:30:00.000Z"
    },
    "newBalance": 1000
  }
}
```

**Errors:**
- `400` — Invalid signature / payment verification failed

---

## 8. Ad-Hoc Payments

These are custom payment requests created by admins (e.g., event fees, lab fees).

### 8.1 Get Pending Payments

Returns payment requests that the student needs to pay.

```
GET /student/payments/pending
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "665g7b8c9d0e1f2a3b4c5d6e",
      "title": "Lab Fee - Semester 2",
      "description": "Chemistry lab materials fee for second semester",
      "amount": 250,
      "createdBy": "665h8c9d0e1f2a3b4c5d6e7f",
      "targetType": "department",
      "status": "active",
      "dueDate": "2026-03-15T00:00:00.000Z",
      "isVisibleOnDashboard": true,
      "isPaid": false,
      "totalTargetCount": 120
    }
  ],
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### 8.2 Pay a Payment Request

Pays an ad-hoc payment from the student's wallet.

```
POST /student/payments/:id/pay
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Parameters:**

| Param | Type   | Description                 |
|-------|--------|-----------------------------|
| `id`  | string | Payment request ObjectId    |

**Request Body:** None

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "transaction": {
      "_id": "665i9d0e1f2a3b4c5d6e7f8a",
      "userId": "665a1b2c3d4e5f6a7b8c9d0e",
      "amount": 250,
      "type": "debit",
      "description": "Payment for: Lab Fee - Semester 2",
      "createdAt": "2026-02-25T10:30:00.000Z"
    },
    "newBalance": 750,
    "submission": {
      "_id": "665j0e1f2a3b4c5d6e7f8a9b",
      "paymentRequest": "665g7b8c9d0e1f2a3b4c5d6e",
      "student": "665a1b2c3d4e5f6a7b8c9d0e",
      "amount": 250,
      "status": "paid",
      "paidAt": "2026-02-25T10:30:00.000Z"
    }
  },
  "message": "Payment successful",
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Errors:**
- `400` — `INSUFFICIENT_BALANCE` — Not enough wallet balance
- `400` — Already paid
- `404` — Payment request not found

---

### 8.3 Get Payment History

```
GET /student/payments/history
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**

| Param   | Type   | Default | Description                      |
|---------|--------|---------|----------------------------------|
| `status`| string | `"all"` | `"paid"`, `"pending"`, `"all"`   |
| `page`  | number | `1`     | Min: 1                           |
| `limit` | number | `20`    | 1–50                             |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "665j0e1f2a3b4c5d6e7f8a9b",
      "paymentRequest": {
        "_id": "665g7b8c9d0e1f2a3b4c5d6e",
        "title": "Lab Fee - Semester 2",
        "amount": 250
      },
      "status": "paid",
      "paidAt": "2026-02-25T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "pages": 1
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

## 9. Leaderboard

### 9.1 Get Student Leaderboard

Returns a ranked list of students by total spending.

```
GET /student/leaderboard
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**

| Param   | Type   | Default | Description        |
|---------|--------|---------|--------------------|
| `limit` | number | `50`    | 1–100              |

**Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "665a1b2c3d4e5f6a7b8c9d0e",
      "name": "John Doe",
      "username": "john_doe",
      "balance": 500,
      "totalSpent": 12500
    },
    {
      "_id": "665a1b2c3d4e5f6a7b8c9d1f",
      "name": "Jane Smith",
      "username": "jane_s",
      "balance": 800,
      "totalSpent": 11200
    }
  ],
  "meta": {
    "count": 50,
    "limit": 50
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

## 10. Real-Time Events (Socket.IO)

The app uses Socket.IO for real-time updates (order status, wallet balance, shop availability).

### Connection Setup

```javascript
import { io } from 'socket.io-client';

const socket = io('https://<your-domain>', {
  auth: {
    token: accessToken, // JWT access token
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to real-time server');
});

socket.on('connect_error', (error) => {
  console.log('Connection failed:', error.message);
  // Handle: "Authentication required" or "Authentication failed"
});
```

### Auto-Joined Rooms

Upon connection, the server automatically joins the student to their personal room (`user:<userId>`). No manual join needed.

### Events to Listen For (Student)

#### `order:status_changed`

Fired when the order status changes (e.g., pending → preparing → ready).

```javascript
socket.on('order:status_changed', (data) => {
  // data shape:
  {
    orderId: "665e5f6a7b8c9d0e1f2a3b4c",
    orderNumber: "ORD-20260225-0042",
    status: "preparing",        // new status
    total: 300,
    pickupToken: "1234",
    itemCount: 2,
    items: [
      { name: "Chicken Biryani", quantity: 2, subtotal: 240, delivered: false },
      { name: "Cold Coffee", quantity: 1, subtotal: 60, delivered: false }
    ],
    isReadyServe: false,
    placedAt: "2026-02-25T10:30:00.000Z",
    preparingAt: "2026-02-25T10:32:00.000Z",
    readyAt: null,
    completedAt: null,
    cancelledAt: null,
    user: "665a1b2c3d4e5f6a7b8c9d0e",
    shop: "665b2c3d4e5f6a7b8c9d0e1f",
    timestamp: "2026-02-25T10:32:00.000Z"
  }
});
```

#### `order:ready`

Fired when the order is ready for pickup. Includes a notification payload for local push notification.

```javascript
socket.on('order:ready', (data) => {
  // data shape: same as status_changed, plus:
  {
    ...orderPayload,
    notification: {
      title: "Order Ready!",
      body: "Your order ORD-20260225-0042 is ready for pickup. Show your QR code at the counter.",
      type: "order_ready"
    }
  }
});
```

#### `order:completed`

Fired when the order is fully completed (all items picked up).

```javascript
socket.on('order:completed', (data) => {
  // data shape: same as status_changed, plus:
  {
    ...orderPayload,
    notification: {
      title: "Order Completed",
      body: "Your order ORD-20260225-0042 has been completed. Thank you for ordering!",
      type: "order_completed"
    }
  }
});
```

#### `order:cancelled`

Fired when an order is cancelled (by shop or admin). Refund is issued to wallet.

```javascript
socket.on('order:cancelled', (data) => {
  // data shape: same as status_changed, plus:
  {
    ...orderPayload,
    notification: {
      title: "Order Cancelled",
      body: "Your order ORD-20260225-0042 has been cancelled. Reason: Shop closed early. Amount has been refunded to your wallet.",
      type: "order_cancelled"
    }
  }
});
```

#### `wallet:updated`

Fired when wallet balance changes (debit, credit, or refund).

```javascript
socket.on('wallet:updated', (data) => {
  // data shape:
  {
    type: "credit",        // "credit" | "debit" | "refund"
    amount: 300,           // amount changed
    balance: 800,          // new balance
    message: "Refund for order ORD-20260225-0042"
  }
});
```

#### `shop:status_changed`

Broadcast to all clients when a shop opens/closes.

```javascript
socket.on('shop:status_changed', (data) => {
  // data shape:
  {
    shopId: "665b2c3d4e5f6a7b8c9d0e1f",
    isActive: false,
    timestamp: "2026-02-25T18:00:00.000Z"
  }
});
```

### Optional: Join Order Room

For tracking a specific order in real-time:

```javascript
// Join
socket.emit('join:order', orderId);
socket.on('joined:order', ({ orderId }) => {
  console.log(`Tracking order ${orderId}`);
});

// Leave when done
socket.emit('leave:order', orderId);
```

### Error Handling

```javascript
socket.on('error', ({ message }) => {
  console.error('Socket error:', message);
});
```

---

## 11. Enums & Constants

### Departments

```typescript
type Department = 'CSE' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL' | 'IT' | 'AIDS' | 'AIML' | 'OTHER';
```

### Years

```typescript
type Year = 1 | 2 | 3 | 4;
```

### Diet Preferences

```typescript
type DietPreference = 'all' | 'veg' | 'nonveg';
```

### Order Statuses

```typescript
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'partially_delivered' | 'completed' | 'cancelled';
```

### Transaction Types

```typescript
type TransactionType = 'credit' | 'debit' | 'refund';
```

### Shop Categories

```typescript
type ShopCategory = 'canteen' | 'classic' | 'bites' | 'laundry' | 'stationery' | 'other';
```

### Stationery Paper Sizes

```typescript
type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';
```

### Stationery Color Types

```typescript
type ColorType = 'bw' | 'color';
```

---

## 12. Error Handling

### Standard Error Codes

| HTTP Status | Code                  | Description                             |
|-------------|----------------------|------------------------------------------|
| `400`       | `VALIDATION_ERROR`   | Invalid request body/params              |
| `401`       | `UNAUTHORIZED`       | Missing or invalid access token          |
| `401`       | `INVALID_OTP`        | Wrong or expired OTP                     |
| `401`       | `NO_REFRESH_TOKEN`   | Missing refresh token                    |
| `402`       | `INSUFFICIENT_BALANCE`| Not enough wallet balance               |
| `403`       | `FORBIDDEN`          | Role/permission not allowed              |
| `404`       | `NOT_FOUND`          | Resource not found                       |
| `404`       | `USER_NOT_FOUND`     | User account not found                   |
| `423`       | `ACCOUNT_LOCKED`     | Too many failed login attempts           |
| `429`       | `TOO_MANY_REQUESTS`  | Rate limit exceeded                      |
| `500`       | `INTERNAL_ERROR`     | Server error                             |

### Validation Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "code": "too_small",
        "minimum": 4,
        "type": "string",
        "inclusive": true,
        "exact": false,
        "message": "Username must be at least 4 characters",
        "path": ["username"]
      }
    ]
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

### React Native Error Handling Pattern

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://<your-domain>/api/v1',
  timeout: 15000,
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const token = getAccessToken(); // from secure storage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 & refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refreshToken }
        );

        saveTokens(data.data.tokens);
        originalRequest.headers.Authorization = `Bearer ${data.data.tokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — log user out
        clearTokens();
        navigateToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## 13. Rate Limits

| Endpoint Category    | Window   | Max Requests | Notes                           |
|---------------------|----------|-------------|----------------------------------|
| General API         | 15 min   | 100         | All endpoints                    |
| Authentication      | 15 min   | 10          | Login, register                  |
| Registration        | 1 hour   | 5           | `/auth/register`                 |
| OTP Requests        | 10 min   | 5           | `/auth/send-otp`                 |
| Password Reset      | 1 hour   | 3           | `/auth/change-password`          |
| Order Creation      | 5 min    | 5           | `POST /orders`, `/orders/batch`  |
| Payment Operations  | 5 min    | 3           | Razorpay, ad-hoc payments        |
| File Uploads        | 10 min   | 10          | Avatar upload                    |

When rate limited, the API returns `429 Too Many Requests`. After 5+ rate limit violations, the IP is blocked for 1 hour.

---

## Quick Reference: All Student Endpoints

| Method | Endpoint                        | Auth | Description                      |
|--------|---------------------------------|------|----------------------------------|
| POST   | `/auth/register`                | No   | Register new account             |
| POST   | `/auth/login`                   | No   | Login with username/password     |
| POST   | `/auth/send-otp`                | No   | Send OTP to phone                |
| POST   | `/auth/verify-otp`              | No   | Verify OTP and login             |
| POST   | `/auth/refresh`                 | No   | Refresh access token             |
| POST   | `/auth/logout`                  | Yes  | Logout                           |
| GET    | `/auth/me`                      | Yes  | Get current user                 |
| PUT    | `/auth/change-password`         | Yes  | Change password                  |
| GET    | `/student/profile`              | Yes  | Get profile                      |
| PUT    | `/student/profile`              | Yes  | Update profile                   |
| PUT    | `/student/profile/avatar`       | Yes  | Upload avatar                    |
| GET    | `/shops`                        | No   | List all shops                   |
| GET    | `/shops/:id`                    | No   | Get shop details                 |
| GET    | `/menu/items`                   | No   | Get all menu items               |
| GET    | `/menu/offers`                  | No   | Get all active offers            |
| GET    | `/shops/:shopId/menu`           | No   | Get shop menu                    |
| GET    | `/shops/:shopId/categories`     | No   | Get shop categories              |
| GET    | `/shops/:shopId/offers`         | No   | Get shop offers                  |
| POST   | `/orders`                       | Yes  | Create single order              |
| POST   | `/orders/batch`                 | Yes  | Create multi-shop order          |
| POST   | `/orders/stationery`            | Yes  | Create stationery order          |
| GET    | `/orders/my`                    | Yes  | Get my orders                    |
| GET    | `/orders/:id`                   | Yes  | Get order details                |
| GET    | `/student/wallet`               | Yes  | Get wallet balance               |
| GET    | `/student/wallet/transactions`  | Yes  | Get transaction history          |
| POST   | `/razorpay/create-order`        | Yes  | Create payment order             |
| POST   | `/razorpay/verify-payment`      | Yes  | Verify payment & credit wallet   |
| GET    | `/student/payments/pending`     | Yes  | Get pending ad-hoc payments      |
| POST   | `/student/payments/:id/pay`     | Yes  | Pay an ad-hoc payment            |
| GET    | `/student/payments/history`     | Yes  | Get payment history              |
| GET    | `/student/leaderboard`          | Yes  | Get student leaderboard          |
