import { readTransactionHistoryCache, writeTransactionHistoryCache, mergeTransactions } from './rentRepository';
import { PaymentTransaction } from '../types/payment';

export { readTransactionHistoryCache, writeTransactionHistoryCache };

export async function mergeTransactionHistory(transactions: PaymentTransaction[]): Promise<number> {
  return mergeTransactions(transactions);
}
