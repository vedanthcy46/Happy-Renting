import client from './client';
import { 
  RentRecordsResponse, 
  RentRecordDetailResponse, 
  CashfreeOrderResponse, 
  CashfreeStatusResponse,
  PaymentTransaction,
  TransactionHistoryResponse
} from '../types/payment';
import { enqueueOutbox } from '../db/outbox';
import { isOnline } from '../sync/networkStatus';
import { queryClient } from '../queryClient';
import { readFormField, formDataFileFromUri } from '../utils/formData';
import { persistImageForOutbox } from '../utils/outboxImages';

export const getRentRecords = async (updatedAfter?: string): Promise<RentRecordsResponse> => {
  const { data } = await client.get<RentRecordsResponse>('/v2/payments', {
    params: updatedAfter ? { updatedAfter } : undefined,
  });
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

export const submitManualPaymentRequest = async (rentRecordId: string, formData: FormData): Promise<{ success: boolean; transaction: PaymentTransaction }> => {
  const { data } = await client.post(`/v2/payments/${rentRecordId}/transactions`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 30000,
  });
  return data;
};

export interface ManualPaymentPayload {
  rentRecordId: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  note?: string;
  paymentDate?: string;
  imageUri?: string;
  idempotencyKey?: string;
}

export const createManualPaymentFormData = (payload: ManualPaymentPayload): FormData => {
  const formData = new FormData();
  formData.append('amount', String(payload.amount));
  formData.append('paymentMethod', payload.paymentMethod);
  if (payload.transactionId) formData.append('transactionId', payload.transactionId);
  if (payload.note) formData.append('note', payload.note);
  if (payload.paymentDate) formData.append('paymentDate', payload.paymentDate);
  if (payload.idempotencyKey) formData.append('idempotencyKey', payload.idempotencyKey);
  if (payload.imageUri) {
    formData.append('image', formDataFileFromUri(payload.imageUri) as any);
  }
  return formData;
};

export const submitManualPayment = async (rentRecordId: string, formData: FormData): Promise<{ success: boolean; transaction: PaymentTransaction }> => {
  if (isOnline()) {
    return submitManualPaymentRequest(rentRecordId, formData);
  }

  const amount = Number(readFormField(formData, 'amount'));
  const paymentMethod = String(readFormField(formData, 'paymentMethod') ?? 'upi');
  const transactionId = readFormField(formData, 'transactionId');
  const note = readFormField(formData, 'note');
  const image = readFormField(formData, 'image');
  const imageUri = typeof image?.uri === 'string' ? image.uri : undefined;

  const tempId = `local-${Date.now()}`;
  const idempotencyKey = `payment-${rentRecordId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Copy the image into app documents so it survives restarts while queued.
  const persistedImageUri = imageUri
    ? await persistImageForOutbox(imageUri, 'payment-proof.jpg')
    : undefined;

  await enqueueOutbox('payment.create', tempId, {
    rentRecordId,
    amount,
    paymentMethod,
    transactionId: transactionId ? String(transactionId) : undefined,
    note: note ? String(note) : undefined,
    imageUri: persistedImageUri,
    idempotencyKey,
  });

  const tempTransaction: PaymentTransaction = {
    _id: tempId,
    rentRecordId,
    amount,
    paymentMethod: paymentMethod as PaymentTransaction['paymentMethod'],
    paymentDate: new Date().toISOString(),
    status: 'verifying',
    referenceId: transactionId ? String(transactionId) : undefined,
    queued: true,
  };

  queryClient.setQueryData<RentRecordDetailResponse>(['rentRecordDetail', rentRecordId], (old) => {
    if (!old) return old;
    return { ...old, transactions: [tempTransaction, ...(old.transactions || [])] };
  });

  return { success: true, transaction: tempTransaction };
};

export const getCashfreePaymentStatus = async (orderId: string): Promise<CashfreeStatusResponse> => {
  const { data } = await client.get<CashfreeStatusResponse>(`/v2/payments/cashfree/status/${orderId}`);
  return data;
};

export const triggerBillingSync = async (): Promise<{ success: boolean; details: any }> => {
  const { data } = await client.post('/v2/payments/sync');
  return data;
};

export const getTransactionHistory = async (updatedAfter?: string): Promise<TransactionHistoryResponse> => {
  const { data } = await client.get<TransactionHistoryResponse>('/v2/payments/history/transactions', {
    params: updatedAfter ? { updatedAfter } : undefined,
  });
  return data;
};
