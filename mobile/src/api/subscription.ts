import client from './client';
import {
  SubscriptionPlansResponse,
  SubscriptionOrderResponse,
  SubscriptionStatusResponse,
  MySubscriptionResponse,
} from '../types/subscription';

export const getSubscriptionPlans = async (): Promise<SubscriptionPlansResponse> => {
  const { data } = await client.get<SubscriptionPlansResponse>('/v2/subscriptions/plans');
  return data;
};

export const createSubscriptionOrder = async (
  plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME',
  appRedirect?: string
): Promise<SubscriptionOrderResponse> => {
  const { data } = await client.post<SubscriptionOrderResponse>('/v2/subscriptions/create-order', {
    plan,
    appRedirect,
  });
  return data;
};

export const getSubscriptionOrderStatus = async (orderId: string): Promise<SubscriptionStatusResponse> => {
  const { data } = await client.get<SubscriptionStatusResponse>(`/v2/subscriptions/status/${orderId}`);
  return data;
};

export const getMySubscription = async (): Promise<MySubscriptionResponse> => {
  const { data } = await client.get<MySubscriptionResponse>('/v2/subscriptions/me');
  return data;
};