/**
 * owner.ts
 * API calls used exclusively by the owner workspace.
 * Mirrors the web app's API layer, typed against actual backend response shapes.
 */
import { Platform } from 'react-native';
import client from './client';

// ─── Types ────────────────────────────────────────────────────────────────

export interface Property {
  _id: string;
  name: string;
  address: string;
  city?: string;
  isActive: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  _id: string;
  roomNumber: string;
  floor?: string;
  monthlyRent: number;
  securityDeposit: number;
  capacity: number;
  currentOccupancy: number;
  propertyId: string | { _id: string; name: string };
  ownerId: string;
  isActive: boolean;
}

export interface CoOccupant {
  _id: string;
  name: string;
  phone?: string;
  idProof?: string;
  status?: string;
}

export interface OwnerTenant {
  _id: string;
  status: 'active' | 'vacated' | 'pending_deletion';
  joinDate: string;
  moveInDate?: string;
  exitDate?: string;
  phone?: string;
  idProof?: string;
  advancePaid?: number;
  advanceRefundAmount?: number;
  refundSettled?: boolean;
  refundSettledAt?: string;
  refundNote?: string;
  securityDeposit?: number;
  notes?: string;
  coOccupants?: CoOccupant[];
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  roomId: {
    _id: string;
    roomNumber: string;
    floor?: string;
    monthlyRent: number;
    currentOccupancy: number;
    capacity: number;
  };
  propertyId: {
    _id: string;
    name: string;
    address: string;
  };
  createdAt: string;
}

export interface PaymentSummaryMetrics {
  totalDue: number;
  totalCollected: number;
  totalOutstanding: number;
  totalPending: number;
  totalOverdue: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  overdueCount: number;
  collectionsToday: number;
}

export interface OwnerAnalytics {
  success: boolean;
  months: number;
  month: string;
  collectionTrend: { month: string; expected: number; collected: number; pending: number }[];
  incomeTrend: { month: string; income: number }[];
  paidVsPending: { paid: number; pending: number };
  occupancy: { totalRooms: number; occupiedRooms: number; vacantRooms: number; occupancyRate: number };
  tenantPaymentStatus: { paid: number; partial: number; pending: number; overdue: number };
  paymentMethods: { method: string; amount: number; count: number }[];
  propertyCollection: { propertyId: string; name: string; expected: number; collected: number; pending: number }[];
  propertyOccupancy: { propertyId: string; name: string; totalRooms: number; occupiedRooms: number; occupancyRate: number }[];
}

export const getOwnerAnalytics = async (params?: { month?: string }): Promise<OwnerAnalytics> => {
  const { data } = await client.get('/v2/analytics/owner', { params });
  return data;
};

export interface OwnerRentRecord {
  _id: string;
  month: string;
  totalRent: number;
  totalPaid: number;
  remainingAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  dueDate: string;
  billingType: string;
  userId: { _id: string; name: string; email: string };
  roomId: { _id: string; roomNumber: string; monthlyRent: number };
  propertyId: { _id: string; name: string };
  tenantId: { _id: string; status: string };
  createdAt: string;
  updatedAt: string;
}

// ─── Properties ───────────────────────────────────────────────────────────

export const getProperties = async (): Promise<{ success: boolean; count: number; properties: Property[] }> => {
  const { data } = await client.get('/properties');
  return data;
};

export const createProperty = async (payload: { name: string; address: string; city?: string }) => {
  const { data } = await client.post('/properties', payload);
  return data;
};

export const updateProperty = async (id: string, payload: { name?: string; address?: string; city?: string; isActive?: boolean }) => {
  const { data } = await client.patch(`/properties/${id}`, payload);
  return data;
};

export const deleteProperty = async (id: string) => {
  const { data } = await client.delete(`/properties/${id}`);
  return data;
};

// ─── Rooms ────────────────────────────────────────────────────────────────

export const getRooms = async (propertyId?: string): Promise<{ success: boolean; count: number; rooms: Room[] }> => {
  const { data } = await client.get('/rooms', {
    params: propertyId ? { propertyId } : undefined,
  });
  return data;
};

// ─── Tenants ──────────────────────────────────────────────────────────────

export const getOwnerTenants = async (params?: {
  status?: 'active' | 'vacated';
  propertyId?: string;
}): Promise<{ success: boolean; count: number; tenants: OwnerTenant[] }> => {
  const { data } = await client.get('/tenants', { params });
  return data;
};

export const getTenantDetail = async (id: string): Promise<{ success: boolean; tenant: OwnerTenant }> => {
  const { data } = await client.get(`/tenants/${id}`);
  return data;
};

export const moveOutTenant = async (id: string, payload: { exitDate: string; notes?: string }) => {
  const { data } = await client.patch(`/tenants/${id}/moveout`, payload);
  return data;
};

export const reverseMoveOutTenant = async (id: string) => {
  const { data } = await client.patch(`/tenants/${id}/reverse-moveout`);
  return data;
};

// ─── Payment Summary (dashboard) ─────────────────────────────────────────

export const getPaymentSummary = async (propertyId?: string): Promise<{ success: boolean; metrics: PaymentSummaryMetrics }> => {
  const { data } = await client.get('/v2/payments/summary/metrics', {
    params: propertyId ? { propertyId } : undefined,
  });
  return data;
};

// ─── Rent Records (owner view) ────────────────────────────────────────────

export const getOwnerRentRecords = async (params?: {
  status?: string;
  propertyId?: string;
  tenantId?: string;
  month?: string;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; count: number; total: number; rentRecords: OwnerRentRecord[] }> => {
  const { data } = await client.get('/v2/payments', { params });
  return data;
};

export const verifyTransaction = async (transactionId: string) => {
  const { data } = await client.post(`/v2/payments/transactions/${transactionId}/verify`);
  return data;
};

export const rejectTransaction = async (transactionId: string, reason: string) => {
  const { data } = await client.post(`/v2/payments/transactions/${transactionId}/reject`, { reason });
  return data;
};

export const reverseTransaction = async (transactionId: string, reason: string) => {
  const { data } = await client.post(`/v2/payments/transactions/${transactionId}/reverse`, { reason });
  return data;
};

export const getPaymentDetail = async (rentRecordId: string): Promise<{ success: boolean; rentRecord: OwnerRentRecordMeta; transactions: OwnerTransaction[] }> => {
  const { data } = await client.get(`/v2/payments/${rentRecordId}`);
  return data;
};

export const getPendingApprovals = async (): Promise<{ success: boolean; transactions: OwnerTransaction[] }> => {
  const { data } = await client.get('/v2/payments/history/transactions?status=verifying');
  return data;
};

export const addTransaction = async (
  rentRecordId: string,
  payload: FormData,
): Promise<{ success: boolean }> => {
  const { data } = await client.post(`/v2/payments/${rentRecordId}/transactions`, payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
};

// ─── Rooms CRUD ───────────────────────────────────────────────────────────

export const createRoom = async (payload: {
  roomNumber: string;
  propertyId: string;
  capacity: number;
  floor?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  description?: string;
}) => {
  const { data } = await client.post('/rooms', payload);
  return data;
};

export const updateRoom = async (id: string, payload: Partial<{
  roomNumber: string;
  capacity: number;
  floor: string;
  monthlyRent: number;
  securityDeposit: number;
  description: string;
}>) => {
  const { data } = await client.patch(`/rooms/${id}`, payload);
  return data;
};

export const deleteRoom = async (id: string) => {
  const { data } = await client.delete(`/rooms/${id}`);
  return data;
};

// ─── Complaints (owner) ───────────────────────────────────────────────────

export interface OwnerComplaint {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'rejected' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  tenantId?: { userId?: { name: string } };
  roomId?: { roomNumber: string };
  propertyId?: { name: string };
}

export const getComplaints = async (): Promise<{ success: boolean; complaints: OwnerComplaint[] }> => {
  const { data } = await client.get('/complaints');
  return data;
};

export const updateComplaint = async (
  id: string,
  payload: { status?: string; resolutionNotes?: string },
) => {
  const { data } = await client.patch(`/complaints/${id}`, payload);
  return data;
};

// ─── Expenses ─────────────────────────────────────────────────────────────

export interface OwnerExpense {
  _id: string;
  category: string;
  title?: string;
  amount: number;
  month: string;
  isRecurring: boolean;
  notes?: string;
  expenseDate: string;
  propertyId?: { _id: string; name: string } | string;
}

export interface ExpenseSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  expenseCount: number;
  month: string;
}

export const getExpenses = async (params: { month: string; propertyId?: string }) => {
  const { data } = await client.get('/v2/expenses', { params });
  return data as { success: boolean; expenses: OwnerExpense[] };
};

export const getRecurringExpenses = async (propertyId?: string) => {
  const { data } = await client.get('/v2/expenses/recurring', {
    params: propertyId ? { propertyId } : undefined,
  });
  return data as { success: boolean; expenses: OwnerExpense[] };
};

export const getExpenseSummary = async (params: { month: string; propertyId?: string }) => {
  const { data } = await client.get('/v2/expenses/summary', { params });
  return data as { success: boolean; summary: ExpenseSummary };
};

export const createExpense = async (payload: {
  propertyId: string;
  category: string;
  title?: string;
  amount: number;
  month: string;
  isRecurring?: boolean;
  notes?: string;
  expenseDate?: string;
}) => {
  const { data } = await client.post('/v2/expenses', payload);
  return data;
};

export const updateExpense = async (id: string, payload: Partial<{
  propertyId: string;
  category: string;
  title: string;
  amount: number;
  month: string;
  isRecurring: boolean;
  notes: string;
  expenseDate: string;
}>) => {
  const { data } = await client.patch(`/v2/expenses/${id}`, payload);
  return data;
};

export const deleteExpense = async (id: string) => {
  const { data } = await client.delete(`/v2/expenses/${id}`);
  return data;
};

// ─── Add Tenant (Move-In) ─────────────────────────────────────────────────

export const getAvailableUsers = async (): Promise<{ success: boolean; users: { _id: string; name: string; email: string; phone?: string }[] }> => {
  const { data } = await client.get('/users?role=tenant');
  return data;
};

export const sendOtp = async (email: string) => {
  const { data } = await client.post('/auth/send-otp', { email });
  return data;
};

export const verifyOtp = async (email: string, otp: string): Promise<{ verificationToken: string }> => {
  const { data } = await client.post('/auth/verify-otp', { email, otp });
  return data;
};

export const registerTenantUser = async (payload: {
  name: string;
  email: string;
  password: string;
  role: string;
  verificationToken: string;
}): Promise<{ user: { _id: string } }> => {
  const { data } = await client.post('/auth/register', payload);
  return data;
};

export const addTenant = async (payload: {
  userId: string;
  roomId: string;
  propertyId: string;
  joinDate: string;
  advancePaid?: number;
  securityDeposit?: number;
  notes?: string;
  phone: string;
  idProof?: string;
  coOccupants?: { name: string; phone?: string; idProof?: string }[];
  tempPassword?: string;
}) => {
  const { data } = await client.post('/tenants', payload);
  return data;
};

export const updateTenant = async (id: string, payload: Partial<{
  advancePaid: number;
  securityDeposit: number;
  name: string;
  email: string;
  phone: string;
  idProof: string;
}>) => {
  const { data } = await client.patch(`/tenants/${id}`, payload);
  return data;
};

export const addCoOccupant = async (tenantId: string, coOccupants: { name: string; phone?: string; idProof?: string }[]) => {
  const { data } = await client.post(`/tenants/${tenantId}/co-occupants`, { coOccupants });
  return data;
};

export const updateCoOccupant = async (tenantId: string, coId: string, payload: { name: string; phone?: string; idProof?: string }) => {
  const { data } = await client.patch(`/tenants/${tenantId}/co-occupants/${coId}`, payload);
  return data;
};

export const deleteCoOccupant = async (tenantId: string, coId: string) => {
  const { data } = await client.delete(`/tenants/${tenantId}/co-occupants/${coId}`);
  return data;
};

export const markRefundSettled = async (tenantId: string, note?: string) => {
  const { data } = await client.patch(`/tenants/${tenantId}/mark-refund-settled`, { note });
  return data;
};

// ─── Owner profile (UPI / QR / bank) ──────────────────────────────────────

export const uploadQrCode = async (imageUri: string) => {
  const formData = new FormData();
  const filename = imageUri.split('/').pop() || 'qr.png';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/png';
  formData.append('image', {
    uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
    name: filename,
    type,
  } as any);
  const { data } = await client.post('/users/owner/upload-qr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
};

// ─── Transaction type ─────────────────────────────────────────────────────

export interface OwnerRentRecordMeta {
  _id: string;
  month: string;
  totalRent: number;
  totalPaid: number;
  remainingAmount: number;
  advanceBalance: number;
  status?: string;
}

export interface OwnerTransaction {
  _id: string;
  amount: number;
  paymentMethod: string;
  transactionType?: string;
  transactionId?: string;
  paymentDate: string;
  note?: string;
  status: 'completed' | 'verifying' | 'reversed' | 'failed';
  entrySource?: string;
  createdByRole?: string;
  recordedBy?: { name: string };
  proofImage?: { secureUrl: string };
  rentRecordId?: { month: string };
  tenantId?: { userId?: { name: string }; roomId?: { roomNumber: string } };
  createdAt: string;
}
