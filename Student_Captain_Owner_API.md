# MEC Food App — API Reference
**Students · Captains · Owners**

Base URL: `https://api.mec.welocalhost.com/api/v1`
All protected endpoints require: `Authorization: Bearer <accessToken>`

---

## Table of Contents
1. [Authentication](#1-authentication)
2. [Student — Profile & Wallet](#2-student--profile--wallet)
3. [Student — Orders](#3-student--orders)
4. [Student — Payments (Ad-hoc)](#4-student--payments-ad-hoc)
5. [Student — Notifications](#5-student--notifications)
6. [Shops & Menu (Public)](#6-shops--menu-public)
7. [Captain — Order Management](#7-captain--order-management)
8. [Captain — Analytics](#8-captain--analytics)
9. [Owner — Menu Management](#9-owner--menu-management)
10. [Owner — Shop Management](#10-owner--shop-management)
11. [Owner — Captain Management](#11-owner--captain-management)
12. [Image Proxy (Public)](#12-image-proxy-public)
13. [Socket.IO Events](#13-socketio-events)

---

## 1. Authentication

### POST `/auth/register`
Register a new student account. Account requires approval before ordering.

**Request**
```json
{
  "username": "john_doe",
  "password": "StrongPass123",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "rollNumber": "CS2021001",
  "department": "Computer Science",
  "year": 2
}
```

**Response `201`**
```json
{
  "message": "Registration successful. Awaiting approval.",
  "user": {
    "_id": "64a...",
    "username": "john_doe",
    "name": "John Doe",
    "role": "student",
    "status": "pending"
  }
}
```

---

### POST `/auth/send-otp`
Send OTP to phone number for login.

**Request**
```json
{
  "phoneNumber": "+919876543210"
}
```

**Response `200`**
```json
{
  "message": "OTP sent successfully"
}
```

---

### POST `/auth/verify-otp`
Verify OTP and receive tokens.

**Request**
```json
{
  "phoneNumber": "+919876543210",
  "otp": "123456"
}
```

**Response `200`**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "_id": "64a...",
    "name": "John Doe",
    "role": "student",
    "username": "john_doe"
  }
}
```

---

### POST `/auth/login`
Login with username and password.

**Request**
```json
{
  "username": "john_doe",
  "password": "StrongPass123"
}
```

**Response `200`**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "_id": "64a...",
    "name": "John Doe",
    "role": "student",
    "username": "john_doe"
  }
}
```

---

### POST `/auth/refresh`
Get a new access token using a refresh token.

**Request**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response `200`**
```json
{
  "accessToken": "eyJ..."
}
```

---

### POST `/auth/logout`
🔒 Authenticated. Invalidate the current session.

**Request** — No body required.

**Response `200`**
```json
{ "message": "Logged out successfully" }
```

---

### GET `/auth/me`
🔒 Authenticated. Get current user profile.

**Response `200`**
```json
{
  "_id": "64a...",
  "username": "john_doe",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "role": "student",
  "status": "approved",
  "rollNumber": "CS2021001",
  "department": "Computer Science",
  "year": 2,
  "wallet": { "balance": 250.00 }
}
```

---

### PUT `/auth/change-password`
🔒 Authenticated. Change account password.

**Request**
```json
{
  "oldPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**Response `200`**
```json
{ "message": "Password changed successfully" }
```

---

### POST `/auth/fcm-token`
🔒 Authenticated. Register mobile device for push notifications. Call after login and whenever FCM token refreshes.

**Request**
```json
{
  "token": "fcm_device_token_string",
  "deviceId": "unique-device-uuid",
  "platform": "android"
}
```
`platform`: `"android"` | `"ios"`

**Response `200`**
```json
{ "success": true }
```

---

### DELETE `/auth/fcm-token`
🔒 Authenticated. Remove FCM token on logout so no push notifications are sent to this device.

**Request**
```json
{
  "token": "fcm_device_token_string"
}
```

**Response `200`**
```json
{ "success": true }
```

---

## 2. Student — Profile & Wallet

### GET `/student/profile`
🔒 Authenticated. Get detailed profile.

**Response `200`**
```json
{
  "_id": "64a...",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "rollNumber": "CS2021001",
  "department": "Computer Science",
  "year": 2,
  "avatar": "https://api.mec.welocalhost.com/api/v1/images/avatars/file.png",
  "wallet": { "balance": 250.00 }
}
```

---

### PUT `/student/profile`
🔒 Authenticated. Update profile fields.

**Request**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "department": "Computer Science",
  "year": 3
}
```

**Response `200`**
```json
{ "message": "Profile updated", "user": { ... } }
```

---

### PUT `/student/profile/avatar`
🔒 Authenticated. Upload profile picture.

**Request** — `multipart/form-data`
```
avatar: <image file>
```

**Response `200`**
```json
{
  "message": "Avatar updated",
  "avatarUrl": "https://api.mec.welocalhost.com/api/v1/images/avatars/64a-avatar.png"
}
```

---

### GET `/student/wallet`
🔒 Authenticated. Get wallet balance.

**Response `200`**
```json
{
  "balance": 250.00,
  "currency": "INR"
}
```

---

### GET `/student/wallet/transactions`
🔒 Authenticated. Get wallet transaction history.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Results per page (default: 20) |
| `skip` | number | Offset for pagination |
| `from` | ISO date | Start date filter |
| `to` | ISO date | End date filter |

**Response `200`**
```json
{
  "transactions": [
    {
      "_id": "64b...",
      "type": "debit",
      "amount": 80.00,
      "description": "Order #ORD-2024-001",
      "balanceAfter": 250.00,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "skip": 0
}
```

---

### POST `/razorpay/create-order`
🔒 Authenticated. Create a Razorpay order to top up wallet.

**Request**
```json
{
  "amount": 500
}
```
`amount` in INR (minimum: 1)

**Response `200`**
```json
{
  "orderId": "order_xyz...",
  "amount": 50000,
  "currency": "INR",
  "key": "rzp_xxx"
}
```

---

### POST `/razorpay/verify-payment`
🔒 Authenticated. Verify Razorpay payment and credit wallet.

**Request**
```json
{
  "orderId": "order_xyz...",
  "paymentId": "pay_abc...",
  "signature": "hmac_signature"
}
```

**Response `200`**
```json
{
  "message": "Payment verified. Wallet credited.",
  "balance": 750.00
}
```

---

### GET `/student/leaderboard`
🔒 Authenticated. Get spending leaderboard.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Number of entries (default: 10) |

**Response `200`**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "name": "Jane Doe",
      "totalSpent": 1200.00,
      "avatar": "..."
    }
  ]
}
```

---

## 3. Student — Orders

### POST `/orders`
🔒 Roles: `student`, `captain`, `owner`. Place a food order.

**Request**
```json
{
  "shopId": "64c...",
  "items": [
    { "itemId": "64d...", "quantity": 2 },
    { "itemId": "64e...", "quantity": 1 }
  ],
  "special_instructions": "No onions please"
}
```

**Response `201`**
```json
{
  "order": {
    "_id": "64f...",
    "orderNumber": "ORD-2024-0042",
    "status": "pending",
    "totalAmount": 120.00,
    "items": [
      {
        "item": { "name": "Chicken Burger", "price": 60.00 },
        "quantity": 2,
        "price": 60.00
      }
    ],
    "shop": { "_id": "64c...", "name": "MEC Canteen" },
    "qrCode": "data:image/png;base64,...",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

> **Note:** Payment is deducted from wallet at order time. A QR code is returned — show it at the counter for pickup.

---

### POST `/orders/batch`
🔒 Roles: `student`, `captain`, `owner`. Place orders at multiple shops in one request.

**Request**
```json
{
  "orders": [
    {
      "shopId": "64c...",
      "items": [{ "itemId": "64d...", "quantity": 1 }]
    },
    {
      "shopId": "64g...",
      "items": [{ "itemId": "64h...", "quantity": 2 }]
    }
  ]
}
```

**Response `201`**
```json
{
  "orders": [ { ...order1 }, { ...order2 } ],
  "totalAmount": 200.00
}
```

---

### GET `/orders/my`
🔒 Roles: `student`, `captain`, `owner`. Get authenticated user's order history.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `pending` \| `preparing` \| `ready` \| `completed` \| `cancelled` |
| `limit` | number | Results per page (default: 20) |
| `skip` | number | Pagination offset |
| `from` | ISO date | Start date |
| `to` | ISO date | End date |

**Response `200`**
```json
{
  "orders": [
    {
      "_id": "64f...",
      "orderNumber": "ORD-2024-0042",
      "status": "completed",
      "totalAmount": 120.00,
      "shop": { "name": "MEC Canteen" },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 12,
  "limit": 20,
  "skip": 0
}
```

---

### GET `/orders/:orderId`
🔒 Authenticated. Get full details of a specific order. Students can only access their own orders.

**Response `200`**
```json
{
  "_id": "64f...",
  "orderNumber": "ORD-2024-0042",
  "status": "preparing",
  "totalAmount": 120.00,
  "items": [
    {
      "item": {
        "_id": "64d...",
        "name": "Chicken Burger",
        "price": 60.00,
        "image": "https://api.mec.welocalhost.com/api/v1/images/meccanteen/menu/file.png"
      },
      "quantity": 2,
      "price": 60.00,
      "delivered": false
    }
  ],
  "shop": {
    "_id": "64c...",
    "name": "MEC Canteen",
    "phone": "+91..."
  },
  "special_instructions": "No onions please",
  "qrCode": "data:image/png;base64,...",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

---

## 4. Student — Payments (Ad-hoc)

### GET `/student/payments/pending`
🔒 Authenticated. Get all pending payment requests assigned to the student.

**Response `200`**
```json
{
  "payments": [
    {
      "_id": "65a...",
      "title": "Semester Fee",
      "description": "Second semester canteen subscription",
      "amount": 500.00,
      "dueDate": "2024-02-01T00:00:00.000Z",
      "status": "pending"
    }
  ]
}
```

---

### POST `/student/payments/:requestId/pay`
🔒 Authenticated. Pay a pending request using wallet balance.

**Request** — No body required.

**Response `200`**
```json
{
  "message": "Payment successful",
  "amountPaid": 500.00,
  "walletBalance": 250.00
}
```

---

### GET `/student/payments/history`
🔒 Authenticated. Get student's payment history.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Results per page |
| `skip` | number | Pagination offset |
| `from` | ISO date | Start date |
| `to` | ISO date | End date |

**Response `200`**
```json
{
  "payments": [
    {
      "_id": "65a...",
      "title": "Semester Fee",
      "amount": 500.00,
      "paidAt": "2024-01-10T09:00:00.000Z",
      "status": "paid"
    }
  ],
  "total": 3
}
```

---

## 5. Student — Notifications

### GET `/student/notifications`
🔒 Authenticated. Get all notifications for the user.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Results per page (default: 20) |
| `skip` | number | Pagination offset |

**Response `200`**
```json
{
  "notifications": [
    {
      "_id": "66a...",
      "title": "Order Ready!",
      "body": "Your order ORD-2024-0042 is ready for pickup.",
      "type": "order_ready",
      "read": false,
      "data": { "orderId": "64f..." },
      "createdAt": "2024-01-15T10:40:00.000Z"
    }
  ],
  "unreadCount": 3,
  "total": 10
}
```

---

### PATCH `/student/notifications/read-all`
🔒 Authenticated. Mark all notifications as read.

**Response `200`**
```json
{ "message": "All notifications marked as read" }
```

---

### PATCH `/student/notifications/:notificationId/read`
🔒 Authenticated. Mark a single notification as read.

**Response `200`**
```json
{ "message": "Notification marked as read" }
```

---

### DELETE `/student/notifications/:notificationId`
🔒 Authenticated. Delete a single notification.

**Response `200`**
```json
{ "message": "Notification deleted" }
```

---

### DELETE `/student/notifications`
🔒 Authenticated. Clear all notifications.

**Response `200`**
```json
{ "message": "All notifications cleared" }
```

---

## 6. Shops & Menu (Public)

> These endpoints require no authentication.

### GET `/shops`
List all active shops.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Results per page |
| `skip` | number | Pagination offset |
| `search` | string | Search by name |

**Response `200`**
```json
{
  "shops": [
    {
      "_id": "64c...",
      "name": "MEC Canteen",
      "description": "Main campus canteen",
      "isOpen": true,
      "openTime": "08:00",
      "closeTime": "18:00",
      "logo": "https://api.mec.welocalhost.com/api/v1/images/shops/logo.png"
    }
  ],
  "total": 3
}
```

---

### GET `/shops/:shopId`
Get details of a single shop.

**Response `200`**
```json
{
  "_id": "64c...",
  "name": "MEC Canteen",
  "description": "Main campus canteen",
  "isOpen": true,
  "openTime": "08:00",
  "closeTime": "18:00",
  "phone": "+91...",
  "logo": "..."
}
```

---

### GET `/shops/:shopId/menu`
Get menu items for a shop.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category ID |
| `limit` | number | Results per page |
| `skip` | number | Pagination offset |

**Response `200`**
```json
{
  "items": [
    {
      "_id": "64d...",
      "name": "Chicken Burger",
      "description": "Juicy grilled chicken burger",
      "price": 60.00,
      "category": { "_id": "64z...", "name": "Burgers" },
      "image": "https://api.mec.welocalhost.com/api/v1/images/meccanteen/menu/chicken-burger.png",
      "available": true,
      "offer": {
        "discountPercent": 10,
        "validUntil": "2024-02-01T00:00:00.000Z",
        "discountedPrice": 54.00
      }
    }
  ],
  "total": 32
}
```

---

### GET `/shops/:shopId/categories`
Get all categories for a shop.

**Response `200`**
```json
{
  "categories": [
    { "_id": "64z...", "name": "Burgers", "description": "All burger varieties" },
    { "_id": "64y...", "name": "Beverages" }
  ]
}
```

---

### GET `/shops/:shopId/offers`
Get all active offers for a shop.

**Response `200`**
```json
{
  "offers": [
    {
      "_id": "64d...",
      "name": "Chicken Burger",
      "price": 60.00,
      "discountedPrice": 54.00,
      "offer": { "discountPercent": 10, "validUntil": "2024-02-01T00:00:00.000Z" },
      "image": "..."
    }
  ]
}
```

---

### GET `/menu/items`
Get all menu items across all shops.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by item name |
| `category` | string | Filter by category name |
| `limit` | number | Results per page |
| `skip` | number | Pagination offset |

**Response `200`**
```json
{
  "items": [ { ...menuItem, "shop": { "name": "MEC Canteen" } } ],
  "total": 76
}
```

---

### GET `/menu/offers`
Get all active offers across all shops.

**Response `200`**
```json
{
  "offers": [ { ...menuItem, "shop": { "name": "MEC Canteen" } } ]
}
```

---

## 7. Captain — Order Management

> Captains can see and manage orders for **their shop only** (determined by JWT `shopId` claim).

### GET `/orders/shop`
🔒 Roles: `captain`, `owner`. Get all orders for the shop.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `pending` \| `preparing` \| `ready` \| `completed` \| `cancelled` |
| `limit` | number | Results per page (default: 20) |
| `skip` | number | Pagination offset |

**Response `200`**
```json
{
  "orders": [
    {
      "_id": "64f...",
      "orderNumber": "ORD-2024-0042",
      "status": "pending",
      "totalAmount": 120.00,
      "user": { "name": "John Doe", "rollNumber": "CS2021001" },
      "items": [
        { "item": { "name": "Chicken Burger" }, "quantity": 2, "delivered": false }
      ],
      "special_instructions": "No onions please",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 8
}
```

---

### GET `/orders/shop/active`
🔒 Roles: `captain`, `owner`. Get only active orders (`pending` and `preparing`).

**Response `200`**
```json
{
  "orders": [ ...activeOrders ]
}
```

---

### PUT `/orders/:orderId/status`
🔒 Roles: `captain`, `owner`. Update the status of an order.

**Request**
```json
{
  "status": "preparing"
}
```

Valid `status` values:
- `pending` → `preparing` — Captain starts preparing
- `preparing` → `ready` — Food is ready for pickup
- `ready` → `completed` — Order picked up (or use verify-qr flow)
- Any → `cancelled` — Cancel the order (refunds wallet)

**Response `200`**
```json
{
  "message": "Order status updated",
  "order": {
    "_id": "64f...",
    "orderNumber": "ORD-2024-0042",
    "status": "preparing"
  }
}
```

> **Side effects:** Status change emits a Socket.IO event to the student's room and sends a push notification to the student's mobile device.

---

### POST `/orders/verify-qr`
🔒 Roles: `captain`, `owner`. Scan student's QR code to complete pickup.

**Request**
```json
{
  "qrCode": "qr_payload_string"
}
```

**Response `200`**
```json
{
  "message": "Order completed via QR",
  "order": { "_id": "64f...", "status": "completed", "orderNumber": "ORD-2024-0042" }
}
```

---

### POST `/orders/:orderId/complete`
🔒 Roles: `captain`, `owner`. Mark an order as completed directly (without QR scan).

**Request** — No body required.

**Response `200`**
```json
{
  "message": "Order marked as completed",
  "order": { "_id": "64f...", "status": "completed" }
}
```

---

### PATCH `/orders/:orderId/items/:itemIndex/deliver`
🔒 Roles: `captain`, `owner`. Mark a single item as delivered (for partial delivery tracking).

**Path Parameters**
- `orderId` — Order ID
- `itemIndex` — 0-based index of the item in the order's items array

**Response `200`**
```json
{
  "message": "Item marked as delivered",
  "order": { "_id": "64f...", "items": [ { "delivered": true }, ... ] }
}
```

---

### GET `/orders/shop/stats`
🔒 Roles: `captain`, `owner`. Get order count statistics.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `from` | ISO date | Start date |
| `to` | ISO date | End date |

**Response `200`**
```json
{
  "stats": {
    "total": 42,
    "pending": 3,
    "preparing": 2,
    "ready": 1,
    "completed": 35,
    "cancelled": 1,
    "totalRevenue": 4800.00
  }
}
```

---

## 8. Captain — Analytics

### GET `/orders/shop/analytics`
🔒 Roles: `captain`, `owner`. Get sales and order analytics for the shop.

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `from` | ISO date | Start date |
| `to` | ISO date | End date |
| `period` | string | `day` \| `week` \| `month` |

**Response `200`**
```json
{
  "analytics": {
    "totalOrders": 120,
    "totalRevenue": 14400.00,
    "averageOrderValue": 120.00,
    "topItems": [
      { "name": "Chicken Burger", "quantity": 45, "revenue": 2700.00 }
    ],
    "ordersByStatus": {
      "completed": 110,
      "cancelled": 5,
      "pending": 5
    },
    "revenueByDay": [
      { "date": "2024-01-15", "revenue": 1200.00, "orders": 10 }
    ]
  }
}
```

---

### GET `/owner/shop`
🔒 Roles: `captain`, `owner`. Get the shop details for the authenticated user's shop.

**Response `200`**
```json
{
  "_id": "64c...",
  "name": "MEC Canteen",
  "description": "Main campus canteen",
  "isOpen": true,
  "openTime": "08:00",
  "closeTime": "18:00",
  "phone": "+91...",
  "logo": "...",
  "qrPaymentsEnabled": true
}
```

---

## 9. Owner — Menu Management

### POST `/owner/categories`
🔒 Roles: `owner`. Create a new category for the shop.

**Request**
```json
{
  "name": "Beverages",
  "description": "Hot and cold drinks"
}
```

**Response `201`**
```json
{
  "category": {
    "_id": "64z...",
    "name": "Beverages",
    "description": "Hot and cold drinks",
    "shop": "64c..."
  }
}
```

---

### POST `/owner/menu`
🔒 Roles: `owner`. Add a new menu item.

**Request**
```json
{
  "name": "Chicken Burger",
  "description": "Juicy grilled chicken burger with lettuce and tomato",
  "price": 60.00,
  "categoryId": "64z...",
  "available": true
}
```

**Response `201`**
```json
{
  "item": {
    "_id": "64d...",
    "name": "Chicken Burger",
    "price": 60.00,
    "available": true,
    "category": "64z..."
  }
}
```

> **Note:** To upload an image, use `POST /uploads/image` first to get an image URL, then include the URL when creating/updating the item.

---

### PUT `/owner/menu/:itemId`
🔒 Roles: `owner`. Update a menu item.

**Request**
```json
{
  "name": "Spicy Chicken Burger",
  "price": 65.00,
  "description": "Updated description",
  "available": true
}
```

**Response `200`**
```json
{
  "item": { "_id": "64d...", "name": "Spicy Chicken Burger", "price": 65.00 }
}
```

---

### PATCH `/owner/menu/:itemId/availability`
🔒 Roles: `owner`. Toggle item availability (sold out / available).

**Response `200`**
```json
{
  "message": "Item availability updated",
  "available": false
}
```

---

### POST `/owner/menu/:itemId/offer`
🔒 Roles: `owner`. Set a discount offer on a menu item.

**Request**
```json
{
  "discountPercent": 15,
  "validUntil": "2024-02-28T23:59:59.000Z"
}
```

**Response `200`**
```json
{
  "message": "Offer set",
  "item": {
    "_id": "64d...",
    "offer": {
      "discountPercent": 15,
      "validUntil": "2024-02-28T23:59:59.000Z",
      "discountedPrice": 51.00
    }
  }
}
```

---

### DELETE `/owner/menu/:itemId/offer`
🔒 Roles: `owner`. Remove an active offer from a menu item.

**Response `200`**
```json
{ "message": "Offer removed" }
```

---

### DELETE `/owner/menu/:itemId`
🔒 Roles: `owner`. Delete a menu item.

**Response `200`**
```json
{ "message": "Menu item deleted" }
```

---

## 10. Owner — Shop Management

### PATCH `/owner/shop/toggle`
🔒 Roles: `captain`, `owner`. Toggle the shop open/closed state.

**Response `200`**
```json
{
  "message": "Shop is now open",
  "isOpen": true
}
```

---

### POST `/owner/qr-payments`
🔒 Roles: `captain`, `owner`. Create a QR payment entry.

**Request**
```json
{
  "amount": 150.00,
  "description": "Direct counter payment"
}
```

**Response `201`**
```json
{
  "payment": {
    "_id": "67a...",
    "amount": 150.00,
    "status": "pending"
  }
}
```

---

### GET `/owner/qr-payments`
🔒 Roles: `captain`, `owner`. List QR payments for the shop.

**Response `200`**
```json
{
  "payments": [
    {
      "_id": "67a...",
      "amount": 150.00,
      "status": "completed",
      "createdAt": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

---

## 11. Owner — Captain Management

### POST `/owner/captains`
🔒 Roles: `owner`. Create a new captain account for the shop.

**Request**
```json
{
  "username": "captain_raj",
  "password": "SecurePass123",
  "name": "Raj Kumar",
  "email": "raj@example.com",
  "phone": "+919876543211"
}
```

**Response `201`**
```json
{
  "message": "Captain created successfully",
  "captain": {
    "_id": "68a...",
    "username": "captain_raj",
    "name": "Raj Kumar",
    "role": "captain",
    "shop": "64c..."
  }
}
```

---

### GET `/owner/captains`
🔒 Roles: `owner`. List all captains for the shop.

**Response `200`**
```json
{
  "captains": [
    {
      "_id": "68a...",
      "name": "Raj Kumar",
      "username": "captain_raj",
      "email": "raj@example.com",
      "status": "active"
    }
  ]
}
```

---

### DELETE `/owner/captains/:captainId`
🔒 Roles: `owner`. Deactivate a captain account.

**Response `200`**
```json
{ "message": "Captain removed successfully" }
```

---

## 12. Image Proxy (Public)

Images stored in Garage S3 are served through the backend proxy. No authentication required.

### GET `/images/:folder/:filename`
```
GET /images/avatars/user-64a-avatar.png
```

### GET `/images/:folder/:subfolder/:filename`
```
GET /images/meccanteen/menu/chicken-burger.png
```

**Response** — Binary image data with appropriate `Content-Type` header. Cached for 24 hours.

---

## 13. Socket.IO Events

**Connection:** `wss://api.mec.welocalhost.com`

Authentication — pass JWT in handshake:
```js
const socket = io("wss://api.mec.welocalhost.com", {
  auth: { token: accessToken }
});
```

---

### Client → Server Events (emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `join:order` | `orderId: string` | Subscribe to real-time updates for a specific order |
| `leave:order` | `orderId: string` | Unsubscribe from an order room |
| `join:user` | `userId: string` | Subscribe to personal notifications (own userId only) |
| `join:shop` | `shopId: string` | *(Captain/Owner)* Subscribe to shop-level order events |
| `join:vendor` | `vendorId: string` | *(Captain/Owner)* Subscribe to vendor events |
| `delivery:location:update` | `{ orderId, location: { lat, lng } }` | Broadcast delivery location |

---

### Server → Client Events (listen)

| Event | Payload | Description |
|-------|---------|-------------|
| `joined:order` | `{ orderId }` | Confirmed subscription to order room |
| `joined:user` | `{ userId }` | Confirmed subscription to user room |
| `joined:shop` | `{ shopId }` | Confirmed subscription to shop room |
| `order:status:changed` | `{ orderId, orderNumber, status, previousStatus, shopName, updatedAt }` | Order status updated |
| `order:new` | `{ orderId, orderNumber, totalAmount, items, customer }` | *(Captain/Owner)* New order received |
| `order:cancelled` | `{ orderId, orderNumber }` | Order was cancelled |
| `delivery:location:update` | `{ orderId, location: { lat, lng } }` | Delivery location update |
| `error` | `{ message: string }` | Socket-level error |

---

### Typical Student Flow
```js
// 1. Connect after login
const socket = io(API_URL, { auth: { token } });

// 2. Subscribe to personal room (auto-joined on connect)
// No need to emit join:user — server auto-joins user:<id> on connect

// 3. After placing an order, subscribe to it
socket.emit("join:order", orderId);

// 4. Listen for status updates
socket.on("order:status:changed", ({ orderNumber, status }) => {
  console.log(`Order ${orderNumber} is now ${status}`);
});
```

### Typical Captain Flow
```js
const socket = io(API_URL, { auth: { token } });

// Server auto-joins shop:<shopId> on connect for captain/owner
// Listen for new orders
socket.on("order:new", (order) => {
  console.log("New order:", order.orderNumber);
});

socket.on("order:status:changed", (update) => {
  console.log("Status change:", update);
});
```

---

## Error Responses

All endpoints return consistent error objects:

```json
{
  "error": "Error message here",
  "details": [ ... ]
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Validation error — check `details` for field errors |
| `401` | Unauthenticated — missing or invalid/expired JWT |
| `403` | Forbidden — insufficient role |
| `404` | Resource not found |
| `409` | Conflict — e.g. duplicate username |
| `422` | Insufficient wallet balance |
| `500` | Internal server error |

---

## Notes

- **All dates** are ISO 8601 strings in UTC.
- **All amounts** are in INR (Indian Rupees).
- **Access tokens** expire in 15 minutes. Use `POST /auth/refresh` with the refresh token to get a new one.
- **Image URLs** always use the proxy format: `https://api.mec.welocalhost.com/api/v1/images/{folder}/{filename}`
- **Push notifications** are sent automatically on order status changes. Register the FCM token after every login and remove it on logout.
