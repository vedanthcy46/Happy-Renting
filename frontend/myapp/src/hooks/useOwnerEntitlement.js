import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

/**
 * Fetches the owner's full entitlement (resource limits) for the web portal.
 * The premium upgrade path lives in the mobile app, so Free-plan owners who hit
 * a limit are told to upgrade from the app.
 */
const useOwnerEntitlement = () => {
  const [entitlement, setEntitlement] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEntitlement = useCallback(async () => {
    try {
      const { data } = await api.get('/ai/entitlement?workspace=owner');
      setEntitlement(data.entitlement || null);
    } catch {
      setEntitlement(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntitlement(); }, [fetchEntitlement]);

  const limits = entitlement?.entitlements || {};
  const isUnlimited = (n) => n === -1 || n === null || n === undefined;

  const hitPropertyLimit =
    !isUnlimited(limits.properties?.limit) &&
    (limits.properties?.used ?? 0) >= limits.properties.limit;

  const hitRoomLimit =
    !isUnlimited(limits.rooms?.limit) &&
    (limits.rooms?.used ?? 0) >= limits.rooms.limit;

  const hitTenantLimit =
    !isUnlimited(limits.activeTenants?.limit) &&
    (limits.activeTenants?.used ?? 0) >= limits.activeTenants.limit;

  return {
    entitlement,
    loading,
    plan: entitlement?.plan || 'FREE',
    limits,
    hitPropertyLimit,
    hitRoomLimit,
    hitTenantLimit,
    refresh: fetchEntitlement,
  };
};

export default useOwnerEntitlement;
