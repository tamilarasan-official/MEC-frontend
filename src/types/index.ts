// ============================================================
// MadrasOne - Unified Type System (matches backend API)
// ============================================================

// ---- Enums / Literal Types ----
export type UserRole = 'student' | 'captain' | 'owner' | 'accountant' | 'superadmin';
export type DietFilter = 'all' | 'veg' | 'nonveg';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'partially_delivered' | 'completed' | 'cancelled';
export type ServiceType = 'food' | 'laundry' | 'stationery';
export type TransactionType = 'credit' | 'debit' | 'refund';
export type ShopCategory = 'canteen' | 'classic' | 'bites' | 'laundry' | 'stationery' | 'other';

// ---- User ----
export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isApproved?: boolean;
  isActive?: boolean;
  balance?: number;
  rollNumber?: string;
  department?: string;
  year?: number;
  dietPreference?: DietFilter;
  shopId?: string;
  shopName?: string;
  shopFolderName?: string;
  canCreateAdhoc?: boolean;
  canteenName?: string;
  institution?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---- Shop ----
export interface Shop {
  id: string;
  name: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  category: ShopCategory;
  isActive: boolean;
  ownerId?: string;
  rating?: number;
  bannerUrl?: string;
  totalOrders?: number;
  canGenerateQR?: boolean;
}

// ---- Food Item ----
export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  costPrice?: number;
  image: string;
  category: string;
  shopId: string;
  shopName?: string;
  isAvailable: boolean;
  isOffer?: boolean;
  offerPrice?: number;
  rating?: number;
  preparationTime?: string;
  isVeg?: boolean;
  isInstant?: boolean;
}

// ---- Cart ----
export interface CartItem extends FoodItem {
  quantity: number;
  delivered?: boolean;
}

// ---- Order ----
export interface Order {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  items: CartItem[];
  total: number;
  shopId: string;
  shopName?: string;
  status: OrderStatus;
  pickupToken: string;
  isReadyServe?: boolean;
  createdAt: string;
  completedAt?: string;
  handledBy?: string;
  notes?: string;
  serviceType?: ServiceType;
  serviceDetails?: ServiceDetails;
  orderNumber?: string;
  paymentStatus?: string;
  qrData?: string;
}

// ---- Service Details ----
export interface LaundryItem {
  category: string;
  count: number;
  pricePerItem: number;
}

export interface LaundryDetails {
  items: LaundryItem[];
  totalClothes: number;
  specialInstructions?: string;
}

export interface StationeryDetails {
  pageCount: number;
  copies: number;
  colorType: 'bw' | 'color';
  paperSize: string;
  doubleSided: boolean;
  specialInstructions?: string;
}

export interface ServiceDetails {
  type: ServiceType;
  laundry?: LaundryDetails;
  stationery?: StationeryDetails;
}

// ---- Transaction ----
export interface Transaction {
  id: string;
  userId: string;
  userName?: string;
  type: TransactionType;
  amount: number;
  description: string;
  balanceBefore?: number;
  balanceAfter?: number;
  orderId?: string;
  createdAt: string;
}

// ---- Leaderboard ----
export interface LeaderboardEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  totalOrders: number;
  totalSpent: number;
  rank?: number;
}

// ---- Dashboard Stats ----
export interface DashboardStats {
  totalOrders: number;
  todayOrders: number;
  completedToday: number;
  cancelledToday: number;
  inProgress: number;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  totalRevenue: number;
  todayRevenue: number;
}

// ---- Analytics ----
export interface AnalyticsData {
  thisMonthRevenue: number;
  thisMonthProfit: number;
  thisMonthOrders: number;
  lastMonthRevenue: number;
  revenueGrowth: number;
  uniqueCustomers: number;
  avgOrderValue: number;
  totalCompletedOrders: number;
  profitMargin: number;
  topItems: Array<{
    id?: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

// ---- Notification ----
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'wallet' | 'announcement' | 'system';
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

// ---- Auth ----
export interface LoginResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn?: string;
  };
}

export interface RegisterData {
  username: string;
  password: string;
  name: string;
  email?: string;
  phone: string;
  rollNumber?: string;
  department?: string;
  year?: number;
}

// ---- API Response ----
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---- Navigation ----
export type RootStackParamList = {
  Auth: undefined;
  StudentMain: undefined;
  CaptainMain: undefined;
  OwnerMain: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type StudentTabParamList = {
  Home: undefined;
  Orders: undefined;
  Scanner: undefined;
};

export type StudentHomeStackParamList = {
  Dashboard: undefined;
  Stores: undefined;
  Menu: { shopId: string; shopName: string };
  Stationery: { shopId: string; shopName: string };
  Offers: undefined;
  Cart: undefined;
  OrderHistory: undefined;
  Leaderboard: undefined;
  Profile: undefined;
  Wallet: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  PrivacySecurity: undefined;
  HelpSupport: undefined;
};

export type CaptainTabParamList = {
  Home: undefined;
  PrepList: undefined;
  History: undefined;
  EatFood: undefined;
  EatOrders: undefined;
};

export type OwnerTabParamList = {
  Home: undefined;
  PrepList: undefined;
  Menu: undefined;
  History: undefined;
  Analytics: undefined;
  StationeryDashboard: undefined;
  EatFood: undefined;
  EatOrders: undefined;
};


// ---- SuperAdmin Types ----
export interface SuperAdminDashboardStats {
  monthlyRevenue: number;
  monthlyProfit: number;
  totalOrders: number;
  totalStudents: number;
  activeShops: number;
  totalShops: number;
  totalMenuItems: number;
  totalTransactions: number;
}

export interface SuperAdminUser extends User {
  canCreateAdhoc?: boolean;
}

export interface PaymentRequest {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'active' | 'closed' | 'cancelled';
  targetType: 'all' | 'department' | 'year' | 'selected';
  targetDepartment?: string;
  targetYear?: number;
  paidCount: number;
  totalCount: number;
  totalCollected: number;
  isVisibleOnDashboard: boolean;
  createdAt: string;
}

// ---- QR Payment (Owner) ----
export interface QRPaymentPayer {
  studentName: string;
  studentRollNumber?: string;
  amount: number;
  paidAt: string;
}

export interface QRPayment {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: string;
  paidCount: number;
  totalCollected: number;
  createdAt: string;
  payers: QRPaymentPayer[];
}

export interface LoginSession {
  _id: string;
  user: { _id: string; name: string; email?: string; username?: string; role: string };
  ipAddress: string;
  userAgent: string;
  deviceType: 'android' | 'ios' | 'web' | 'unknown';
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  deviceId?: string;
  macAddress?: string;
  imei?: string;
  loginTime: string;
  logoutTime?: string;
  isActive: boolean;
  deviceInfo?: Record<string, unknown>;
}

// ---- Accountant Types ----
export interface AccountantDashboardStats {
  totalStudents: number;
  totalBalance: number;
  pendingApprovals: number;
  monthRecharges: number;
  todayCredits: number;
  todayTransactions: number;
}

export interface StudentWithWallet extends User {
  walletSummary: {
    totalCredits: number;
    totalDebits: number;
    transactionCount: number;
    lastTransaction?: string;
  };
}

export interface VendorPayable {
  shopId: string;
  shopName: string;
  category: string;
  revenue: number;
  estimatedCost: number;
  profitMargin: number;
  payableAmount: number;
  orderCount: number;
  transferStatus: 'pending' | 'completed';
  transferId?: string;
  completedAt?: string;
}
