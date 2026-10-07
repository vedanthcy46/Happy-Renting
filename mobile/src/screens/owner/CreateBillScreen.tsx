import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  createBill, addBillItem, publishBill, deleteBill, getBillDetail, updateBillItem, removeBillItem,
  MonthlyBill, BillItem, BillItemType,
} from '../../api/billing';
import { getOwnerTenants } from '../../api/owner';
import { spacing, radius, shadows } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { AppButton, AppInput, KeyboardSafeBottomSheet } from '../../components';
import { CalendarPicker } from '../../components/CalendarPicker';

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatMonth = (m: string) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const monthOptions = () => {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ label: formatMonth(val), value: val });
  }
  return opts;
};

const defaultDueDate = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 5);
  return d.toISOString().split('T')[0];
};

const CHARGE_TYPES: { type: BillItemType; label: string; icon: string }[] = [
  { type: 'ELECTRICITY', label: 'Electricity', icon: 'flash-outline' },
  { type: 'WATER',       label: 'Water',       icon: 'water-outline' },
  { type: 'MAINTENANCE', label: 'Maintenance', icon: 'construct-outline' },
  { type: 'INTERNET',    label: 'Internet',    icon: 'wifi-outline' },
  { type: 'GAS',         label: 'Gas',         icon: 'flame-outline' },
  { type: 'PARKING',     label: 'Parking',     icon: 'car-outline' },
  { type: 'LATE_FEE',    label: 'Late Fee',    icon: 'alert-circle-outline' },
  { type: 'OTHER',       label: 'Other',       icon: 'ellipsis-horizontal-outline' },
];

type Step = 'select' | 'charges' | 'preview';

interface CreateBillScreenProps {
  editBillId?: string;
}

export const CreateBillScreen: React.FC<CreateBillScreenProps> = ({ editBillId }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Step 1 state
  const [step, setStep] = useState<Step>(editBillId ? 'charges' : 'select');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(monthOptions()[1].value);
    
  // Step 2 state
  const [bill, setBill] = useState<MonthlyBill | null>(null);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [chargeType, setChargeType] = useState<BillItemType>('ELECTRICITY');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [elecMethod, setElecMethod] = useState<'meter' | 'fixed'>('meter');
  const [prevReading, setPrevReading] = useState('');
  const [currReading, setCurrReading] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('7');

  const months = useMemo(() => monthOptions(), []);

  // Load existing draft when editing
  const { data: editBillData, isLoading: isLoadingBill } = useQuery({
    queryKey: ['billDetail', editBillId],
    queryFn: () => getBillDetail(editBillId!),
    enabled: !!editBillId,
    staleTime: 5 * 60 * 1000,
  });

  // Sync fetched bill into local state
  const editedBill = editBillData?.bill ?? null;
  const activeBill = bill ?? editedBill;

  const { data: tenantsData, isLoading: loadingTenants } = useQuery({
    queryKey: ['ownerTenants', 'active'],
    queryFn: () => getOwnerTenants({ status: 'active' }),
    staleTime: 2 * 60 * 1000,
  });
  const tenants = tenantsData?.tenants ?? [];

  const mutationCreate = useMutation({
    mutationFn: () => createBill({ tenantId: selectedTenantId, month: selectedMonth }),
    onSuccess: (res) => {
      setBill(res.bill);
      setStep('charges');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to create bill'),
  });

  const mutationAddItem = useMutation({
    mutationFn: (payload: Parameters<typeof addBillItem>[1]) =>
      addBillItem(activeBill!._id, payload),
    onSuccess: (res) => {
      setBill(res.bill);
      resetChargeForm();
      setShowAddCharge(false);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to add charge'),
  });

  const mutationUpdateItem = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: any }) =>
      updateBillItem(activeBill!._id, itemId, payload),
    onSuccess: (res) => {
      setBill(res.bill);
      resetChargeForm();
      setEditingItemId(null);
      setShowAddCharge(false);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to update charge'),
  });

  const mutationRemoveItem = useMutation({
    mutationFn: (itemId: string) => removeBillItem(activeBill!._id, itemId),
    onSuccess: (res) => {
      setBill(res.bill);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to remove charge'),
  });

  const mutationPublish = useMutation({
    mutationFn: () => publishBill(activeBill!._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      Alert.alert('✓ Bill Generated', 'Tenant has been notified.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to publish bill'),
  });

  const mutationDelete = useMutation({
    mutationFn: () => deleteBill(activeBill!._id),
    onSuccess: () => router.back(),
  });

  const resetChargeForm = () => {
    setChargeType('ELECTRICITY');
    setChargeDesc('');
    setChargeAmount('');
    setPrevReading('');
    setCurrReading('');
    setRatePerUnit('7');
    setElecMethod('meter');
    setEditingItemId(null);
  };

  const handleEditItem = (item: BillItem) => {
    setEditingItemId(item._id);
    setChargeType(item.type);
    setChargeDesc(item.description);
    if (item.type === 'ELECTRICITY' && item.metadata?.previousReading != null) {
      setElecMethod('meter');
      setPrevReading(String(item.metadata.previousReading));
      setCurrReading(String(item.metadata.currentReading));
      setRatePerUnit(String(item.metadata.ratePerUnit));
      setChargeAmount('');
    } else {
      setElecMethod('fixed');
      setChargeAmount(String(item.amount));
      setPrevReading('');
      setCurrReading('');
      setRatePerUnit('7');
    }
    setShowAddCharge(true);
  };

  const handleAddCharge = () => {
    if (!activeBill) return;
    const payload: any = {
      type: chargeType,
      description: chargeDesc || CHARGE_TYPES.find(c => c.type === chargeType)?.label || chargeType,
    };

    if (chargeType === 'ELECTRICITY' && elecMethod === 'meter') {
      const prev = Number(prevReading);
      const curr = Number(currReading);
      const rate = Number(ratePerUnit);
      if (isNaN(prev) || isNaN(curr) || isNaN(rate) || curr < prev) {
        Alert.alert('Error', 'Check meter readings. Current must be ≥ Previous.');
        return;
      }
      payload.metadata = { previousReading: prev, currentReading: curr, ratePerUnit: rate };
    } else {
      const amt = Number(chargeAmount);
      if (isNaN(amt) || amt < 0) {
        Alert.alert('Error', 'Enter a valid amount.');
        return;
      }
      payload.amount = amt;
    }

    if (editingItemId) {
      mutationUpdateItem.mutate({ itemId: editingItemId, payload });
    } else {
      mutationAddItem.mutate(payload);
    }
  };

  const handleDiscardDraft = () => {
    Alert.alert('Discard Bill?', 'This draft will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => mutationDelete.mutate() },
    ]);
  };

  const selectedTenant = tenants.find(t => t._id === selectedTenantId);

  if (editBillId && isLoadingBill) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (step === 'select') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.text.primary }]}>Create Monthly Bill</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.chipRow}>
            {months.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface },
                  selectedMonth === m.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedMonth(m.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: colors.text.secondary },
                  selectedMonth === m.value && { color: '#FFF' }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>SELECT TENANT</Text>
          {loadingTenants ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            tenants.map(t => (
              <TouchableOpacity
                key={t._id}
                style={[styles.tenantRow, { backgroundColor: colors.surface, borderColor: colors.border },
                  selectedTenantId === t._id && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={() => setSelectedTenantId(t._id)}
                activeOpacity={0.75}
              >
                <View style={[styles.tenantAvatar, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="person" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tenantName, { color: colors.text.primary }]}>{t.userId.name}</Text>
                  <Text style={[styles.tenantRoom, { color: colors.text.secondary }]}>
                    Room {t.roomId.roomNumber} · {(t.propertyId as any)?.name ?? ''}
                  </Text>
                </View>
                {selectedTenantId === t._id && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))
          )}

          <AppButton
            title="Continue →"
            onPress={() => {
              if (!selectedTenantId) { Alert.alert('Select a tenant'); return; }
              mutationCreate.mutate();
            }}
            loading={mutationCreate.isPending}
            style={{ marginTop: spacing.xxl }}
          />
        </ScrollView>
        </KeyboardAvoidingView>

        
      </View>
    );
  }

  // ── Step 2: Add charges ───────────────────────────────────────────────────
  if (step === 'charges' && activeBill) {
    const bill = activeBill;
    const elecUnits = chargeType === 'ELECTRICITY' && elecMethod === 'meter'
      ? Math.max(0, Number(currReading) - Number(prevReading))
      : 0;
    const elecAmt = elecUnits * Number(ratePerUnit || 0);

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.text.primary }]}>Add Charges</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Bill header */}
          <View style={[styles.billHeader, { backgroundColor: colors.surface }, shadows.sm]}>
            <Text style={[styles.billHeaderName, { color: colors.text.primary }]}>
              {(bill.userId as any)?.name ?? 'Tenant'}
            </Text>
            <Text style={[styles.billHeaderSub, { color: colors.text.secondary }]}>
              Room {(bill.roomId as any)?.roomNumber} · {formatMonth(bill.month)}
            </Text>
          </View>

          {/* Line items */}
          <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>CHARGES</Text>
          <View style={[styles.itemsCard, { backgroundColor: colors.surface }, shadows.sm]}>
            {bill.items.map((item, idx) => (
              <View key={item._id} style={[styles.lineItem,
                idx < bill.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lineItemDesc, { color: colors.text.primary }]}>{item.description}</Text>
                  {item.metadata?.unitsConsumed != null && (
                    <Text style={[styles.lineItemMeta, { color: colors.text.tertiary }]}>
                      {item.metadata.unitsConsumed} units × ₹{item.metadata.ratePerUnit}
                    </Text>
                  )}
                </View>
                <View style={styles.lineItemRight}>
                  <Text style={[styles.lineItemAmt, { color: colors.text.primary }]}>
                    {formatCurrency(item.effectiveAmount)}
                  </Text>
                  {item.type !== 'RENT' && (
                    <View style={styles.itemActions}>
                      <TouchableOpacity onPress={() => handleEditItem(item)} style={[styles.itemActionBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
                        <Ionicons name="pencil" size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => Alert.alert('Delete Charge?', `Remove ${item.description}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => mutationRemoveItem.mutate(item._id) }])} style={[styles.itemActionBtn, { borderColor: colors.error }]} activeOpacity={0.7}>
                        <Ionicons name="trash" size={14} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.text.primary }]}>Total</Text>
              <Text style={[styles.totalAmt, { color: colors.primary }]}>{formatCurrency(bill.totalAmount)}</Text>
            </View>
          </View>

          {/* Add charge button */}
          {!showAddCharge && (
            <TouchableOpacity
              style={[styles.addChargeBtn, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
              onPress={() => setShowAddCharge(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.addChargeBtnText, { color: colors.primary }]}>+ Add Charge</Text>
            </TouchableOpacity>
          )}

          {/* Add charge form */}
          {showAddCharge && (
            <View style={[styles.addChargeForm, { backgroundColor: colors.surface }, shadows.sm]}>
              <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>CHARGE TYPE</Text>
              <View style={styles.chipRow}>
                {CHARGE_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct.type}
                    style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background },
                      chargeType === ct.type && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => setChargeType(ct.type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: colors.text.secondary },
                      chargeType === ct.type && { color: '#FFF' }]}>
                      {ct.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {chargeType === 'ELECTRICITY' ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>CALCULATION METHOD</Text>
                  <View style={styles.chipRow}>
                    {(['meter', 'fixed'] as const).map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background },
                          elecMethod === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setElecMethod(m)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, { color: colors.text.secondary },
                          elecMethod === m && { color: '#FFF' }]}>
                          {m === 'meter' ? 'Meter Reading' : 'Fixed Amount'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {elecMethod === 'meter' ? (
                    <>
                      <AppInput label="Previous Reading" placeholder="e.g. 12450" value={prevReading} onChangeText={setPrevReading} keyboardType="numeric" />
                      <AppInput label="Current Reading" placeholder="e.g. 12625" value={currReading} onChangeText={setCurrReading} keyboardType="numeric" />
                      <AppInput label="Rate per Unit (₹)" placeholder="e.g. 7" value={ratePerUnit} onChangeText={setRatePerUnit} keyboardType="numeric" />
                      {elecUnits > 0 && (
                        <View style={[styles.calcPreview, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.calcText, { color: colors.primary }]}>
                            {elecUnits} units × ₹{ratePerUnit} = {formatCurrency(elecAmt)}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <AppInput label="Amount (₹)" placeholder="Enter amount" value={chargeAmount} onChangeText={setChargeAmount} keyboardType="numeric" />
                  )}
                </>
              ) : (
                <AppInput label="Amount (₹)" placeholder="Enter amount" value={chargeAmount} onChangeText={setChargeAmount} keyboardType="numeric" />
              )}

              <AppInput label="Description (optional)" placeholder={CHARGE_TYPES.find(c => c.type === chargeType)?.label ?? ''} value={chargeDesc} onChangeText={setChargeDesc} />

              <View style={styles.formBtns}>
                <AppButton title="Cancel" onPress={() => { setShowAddCharge(false); resetChargeForm(); }} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
                <AppButton title={editingItemId ? 'Update Charge' : 'Add Charge'} onPress={handleAddCharge} loading={mutationAddItem.isPending || mutationUpdateItem.isPending} style={{ flex: 1, marginLeft: spacing.sm }} />
              </View>
            </View>
          )}

          <AppButton
            title="Review Bill →"
            onPress={() => setStep('preview')}
            style={{ marginTop: spacing.xxl }}
            disabled={bill.items.length === 0}
          />
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Step 3: Preview & publish ─────────────────────────────────────────────
  if (step === 'preview' && activeBill) {
    const bill = activeBill;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity onPress={() => setStep('charges')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.text.primary }]}>Review Bill</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.previewCard, { backgroundColor: colors.surface }, shadows.md]}>
            <Text style={[styles.previewTenant, { color: colors.text.primary }]}>
              {(bill.userId as any)?.name ?? 'Tenant'}
            </Text>
            <Text style={[styles.previewSub, { color: colors.text.secondary }]}>
              Room {(bill.roomId as any)?.roomNumber} · {formatMonth(bill.month)}
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            {bill.items.map((item, idx) => (
              <View key={item._id} style={[styles.previewLine,
                idx < bill.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewLineDesc, { color: colors.text.primary }]}>{item.description}</Text>
                  {item.metadata?.unitsConsumed != null && (
                    <Text style={[styles.lineItemMeta, { color: colors.text.tertiary }]}>
                      {item.metadata.unitsConsumed} units × ₹{item.metadata.ratePerUnit}
                    </Text>
                  )}
                </View>
                <Text style={[styles.previewLineAmt, { color: colors.text.primary }]}>
                  {formatCurrency(item.effectiveAmount)}
                </Text>
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.text.primary }]}>Total Due</Text>
              <Text style={[styles.totalAmt, { color: colors.primary }]}>{formatCurrency(bill.totalAmount)}</Text>
            </View>
            <Text style={[styles.dueDateLabel, { color: colors.text.secondary }]}>
              Due Date: {new Date(bill.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>

          <View style={styles.formBtns}>
            <AppButton title="Save as Draft" onPress={() => router.back()} variant="outline" style={{ flex: 1, marginRight: spacing.sm }} />
            <AppButton title="Generate Bill" onPress={() => mutationPublish.mutate()} loading={mutationPublish.isPending} style={{ flex: 1, marginLeft: spacing.sm }} />
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return null;
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.background },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '600' },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.huge + 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  tenantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, marginBottom: spacing.sm },
  tenantAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tenantName: { fontSize: 15, fontWeight: '600' },
  tenantRoom: { fontSize: 13, marginTop: 2 },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, marginBottom: spacing.sm },
  dateFieldText: { flex: 1, fontSize: 15, fontWeight: '500' },
  billHeader: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  billHeaderName: { fontSize: 17, fontWeight: '700' },
  billHeaderSub: { fontSize: 13, marginTop: 2 },
  itemsCard: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  lineItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  lineItemDesc: { fontSize: 14, fontWeight: '500' },
  lineItemMeta: { fontSize: 12, marginTop: 2 },
  lineItemAmt: { fontSize: 15, fontWeight: '600' },
  lineItemRight: { alignItems: 'flex-end', gap: spacing.xs },
  itemActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  itemActionBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1 },
  totalLabel: { fontSize: 15, fontWeight: '700' },
  totalAmt: { fontSize: 18, fontWeight: '700' },
  addChargeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: spacing.md },
  addChargeBtnText: { fontSize: 15, fontWeight: '600' },
  addChargeForm: { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.md },
  calcPreview: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  calcText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  formBtns: { flexDirection: 'row', marginTop: spacing.xl },
  previewCard: { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xxl },
  previewTenant: { fontSize: 20, fontWeight: '700' },
  previewSub: { fontSize: 14, marginTop: 4, marginBottom: spacing.md },
  divider: { height: 1, marginVertical: spacing.md },
  previewLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  previewLineDesc: { fontSize: 14, fontWeight: '500' },
  previewLineAmt: { fontSize: 15, fontWeight: '600' },
  dueDateLabel: { fontSize: 13, marginTop: spacing.sm },
});
