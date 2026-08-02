export interface RentRecord {
  _id: string;
  month: string; // YYYY-MM
  totalRent: number;
  totalPaid: number;
  remainingAmount: number;
  advanceBalance?: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'overpaid';
  dueDate: string;
  updatedAt?: string;
  ownerId?: {
    name?: string;
    email?: string;
    upiId?: string;
    upiNumber?: string;
    qrCodeImage?: {
      secureUrl?: string;
    };
  };
}

export interface PaymentTransaction {
  _id: string;
  rentRecordId: string;
  amount: number;
  paymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  paymentDate: string;
  status: 'pending' | 'verified' | 'rejected' | 'reversed' | 'verifying' | 'completed';
  referenceId?: string;
  queued?: boolean;
}

export interface RentRecordsResponse {
  success: boolean;
  count: number;
  rentRecords: RentRecord[];
}

export interface RentRecordDetailResponse {
  success: boolean;
  rentRecord: RentRecord;
  transactions: PaymentTransaction[];
}

export interface CashfreeOrderResponse {
  success: boolean;
  paymentSessionId: string;
  orderId: string;
  paymentUrl: string;
}

export interface CashfreeStatusResponse {
  success: boolean;
  status: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED';
  orderId: string;
}

export interface TransactionHistoryResponse {
  success: boolean;
  transactions: PaymentTransaction[];
}

