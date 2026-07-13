import client from './client';
import { 
  RentRecordsResponse, 
  RentRecordDetailResponse, 
  CashfreeOrderResponse, 
  CashfreeStatusResponse,
  PaymentTransaction,
  TransactionHistoryResponse
} from '../types/payment';

export const getRentRecords = async (): Promise<RentRecordsResponse> => {
  const { data } = await client.get<RentRecordsResponse>('/v2/payments');
  return data;
};

export const getRentRecordDetail = async (id: string): Promise<RentRecordDetailResponse> => {
  const { data } = await client.get<RentRecordDetailResponse>(`/v2/payments/${id}`);
  return data;
};

export const createCashfreeOrder = async (rentRecordId: string, amount: number, appRedirect?: string): Promise<CashfreeOrderResponse> => {
  const { data } = await client.post<CashfreeOrderResponse>(`/v2/payments/cashfree/create-order/${rentRecordId}`, {
    amount,
    appRedirect,
  });
  return data;
};

export const submitManualPayment = async (rentRecordId: string, formData: FormData): Promise<{ success: boolean; transaction: PaymentTransaction }> => {
  const { data } = await client.post(`/v2/payments/${rentRecordId}/transactions`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const getCashfreePaymentStatus = async (orderId: string): Promise<CashfreeStatusResponse> => {
  const { data } = await client.get<CashfreeStatusResponse>(`/v2/payments/cashfree/status/${orderId}`);
  return data;
};

export const triggerBillingSync = async (): Promise<{ success: boolean; details: any }> => {
  const { data } = await client.post('/v2/payments/sync');
  return data;
};

export const getTransactionHistory = async (): Promise<TransactionHistoryResponse> => {
  const { data } = await client.get<TransactionHistoryResponse>('/v2/payments/history/transactions');
  return data;
};
