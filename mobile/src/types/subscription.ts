export interface SubscriptionPlan {
  key: 'MONTHLY' | 'ANNUAL' | 'LIFETIME';
  label: string;
  price: number;
}

export interface SubscriptionPlansResponse {
  success: boolean;
  enabled: boolean;
  plans: SubscriptionPlan[];
}

export interface SubscriptionOrderResponse {
  success: boolean;
  orderId: string;
  paymentSessionId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
  subscriptionOrderId: string;
}

export interface SubscriptionStatusResponse {
  success: boolean;
  status: 'success' | 'pending' | 'failed';
  plan?: string;
  activatedUntil?: string | null;
}

export interface MySubscription {
  plan: string;
  status: string;
  billingPeriod: string | null;
  purchasedAt: string | null;
  expiresAt: string | null;
  lifetime: boolean;
  entitlementVersion: number;
}

export interface MySubscriptionResponse {
  success: boolean;
  subscription: MySubscription;
}