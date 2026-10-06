import client from './client';

export type BillItemType =
  | 'RENT' | 'ELECTRICITY' | 'WATER' | 'MAINTENANCE'
  | 'INTERNET' | 'GAS' | 'PARKING' | 'CLEANING'
  | 'SOCIETY' | 'GARBAGE' | 'LATE_FEE' | 'OTHER';

export type BillStatus = 'DRAFT' | 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';

export interface BillItem {
  _id: string;
  type: BillItemType;
  description: string;
  amount: number;
  effectiveAmount: number;
  metadata?: {
    previousReading?: number;
    currentReading?: number;
    unitsConsumed?: number;
    ratePerUnit?: number;
  } | null;
  isWaived: boolean;
  waivedAmount: number;
  waiverReason?: string | null;
  waivedAt?: string | null;
}

export interface MonthlyBill {
  _id: string;
  tenantId: { _id: string; status: string } | string;
  userId: { _id: string; name: string; email: string; phone?: string } | string;
  roomId: { _id: string; roomNumber: string; floor?: string; monthlyRent: number } | string;
  propertyId: { _id: string; name: string; address: string } | string;
  ownerId: { _id: string; name: string; email: string } | string;
  rentRecordId?: { _id: string; totalRent: number; totalPaid: number; remainingAmount: number; status: string } | string | null;
  month: string;
  dueDate: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  status: BillStatus;
  isPublished: boolean;
  publishedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringCharge {
  _id: string;
  tenantId: { _id: string; status: string } | string;
  ownerId: string;
  propertyId: string;
  roomId: { _id: string; roomNumber: string } | string;
  type: Exclude<BillItemType, 'RENT' | 'ELECTRICITY' | 'LATE_FEE'>;
  description: string;
  amount: number;
  isActive: boolean;
  createdAt: string;
}

// ── Bills ─────────────────────────────────────────────────────────────────────

export const getBills = async (params?: {
  tenantId?: string;
  propertyId?: string;
  month?: string;
  status?: BillStatus;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; count: number; total: number; bills: MonthlyBill[] }> => {
  const { data } = await client.get('/v2/bills', { params });
  return data;
};

export const getBillDetail = async (billId: string): Promise<{ success: boolean; bill: MonthlyBill }> => {
  const { data } = await client.get(`/v2/bills/${billId}`);
  return data;
};

export const createBill = async (payload: {
  tenantId: string;
  month: string;
  dueDate: string;
  notes?: string;
}): Promise<{ success: boolean; bill: MonthlyBill }> => {
  const { data } = await client.post('/v2/bills', payload);
  return data;
};

export const addBillItem = async (
  billId: string,
  payload: {
    type: BillItemType;
    description: string;
    amount?: number;
    metadata?: {
      previousReading?: number;
      currentReading?: number;
      ratePerUnit?: number;
    };
  }
): Promise<{ success: boolean; bill: MonthlyBill }> => {
  const { data } = await client.post(`/v2/bills/${billId}/items`, payload);
  return data;
};

export const updateBillItem = async (
  billId: string,
  itemId: string,
  payload: { description?: string; amount?: number; metadata?: object }
): Promise<{ success: boolean; bill: MonthlyBill }> => {
  const { data } = await client.patch(`/v2/bills/${billId}/items/${itemId}`, payload);
  return data;
};

export const removeBillItem = async (
  billId: string,
  itemId: string
): Promise<{ success: boolean; bill: MonthlyBill }> => {
  const { data } = await client.delete(`/v2/bills/${billId}/items/${itemId}`);
  return data;
};

export const waiveBillItem = async (
  billId: string,
  itemId: string,
  payload: { waiverReason?: string; waivedAmount?: number }
): Promise<{ success: boolean; bill: MonthlyBill }> => {
  const { data } = await client.post(`/v2/bills/${billId}/items/${itemId}/waive`, payload);
  return data;
};

export const publishBill = async (
  billId: string
): Promise<{ success: boolean; bill: MonthlyBill; rentRecord: any }> => {
  const { data } = await client.post(`/v2/bills/${billId}/publish`);
  return data;
};

export const deleteBill = async (billId: string): Promise<{ success: boolean }> => {
  const { data } = await client.delete(`/v2/bills/${billId}`);
  return data;
};

export const bulkPublishBills = async (billIds: string[]): Promise<{ success: boolean; publishedIds: string[] }> => {
  const { data } = await client.post('/v2/bills/bulk-publish', { billIds });
  return data;
};

export const bulkDeleteBills = async (billIds: string[]): Promise<{ success: boolean }> => {
  const { data } = await client.post('/v2/bills/bulk-delete', { billIds });
  return data;
};

// ── Recurring Charges ─────────────────────────────────────────────────────────

export const getRecurringCharges = async (tenantId?: string): Promise<{ success: boolean; charges: RecurringCharge[] }> => {
  const { data } = await client.get('/v2/bills/recurring', {
    params: tenantId ? { tenantId } : undefined,
  });
  return data;
};

export const createRecurringCharge = async (payload: {
  tenantId: string;
  type: RecurringCharge['type'];
  description: string;
  amount: number;
}): Promise<{ success: boolean; charge: RecurringCharge }> => {
  const { data } = await client.post('/v2/bills/recurring', payload);
  return data;
};

export const updateRecurringCharge = async (
  chargeId: string,
  payload: { description?: string; amount?: number; isActive?: boolean }
): Promise<{ success: boolean; charge: RecurringCharge }> => {
  const { data } = await client.patch(`/v2/bills/recurring/${chargeId}`, payload);
  return data;
};

export const deleteRecurringCharge = async (chargeId: string): Promise<{ success: boolean }> => {
  const { data } = await client.delete(`/v2/bills/recurring/${chargeId}`);
  return data;
};
