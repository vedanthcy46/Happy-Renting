import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { getOwnerTenants, moveOutTenant, reverseMoveOutTenant, updateTenant, markRefundSettled, type OwnerTenant } from '../../api/owner';

// ─── Helpers ──────────────────────────────────────────────────────────────

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// ─── Status badge ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: OwnerTenant['status'] }> = ({ status }) => {
  const { colors } = useTheme();
  const config = {
    active: { bg: colors.successLight, text: colors.success, label: 'Active' },
    vacated: { bg: colors.borderLight, text: colors.text.secondary, label: 'Vacated' },
    pending_deletion: { bg: colors.errorLight, text: colors.error, label: 'Pending Deletion' },
  }[status] ?? { bg: colors.borderLight, text: colors.text.secondary, label: status };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

// ─── Tenant detail bottom sheet ────────────────────────────────────────────

interface TenantDetailSheetProps {
  tenant: OwnerTenant | null;
  visible: boolean;
  onClose: () => void;
  onMoveOut: (tenant: OwnerTenant) => void;
  onReverseOut: (tenant: OwnerTenant) => void;
  onEdit: (tenant: OwnerTenant) => void;
  onSettleRefund: (tenant: OwnerTenant) => void;
}

const TenantDetailSheet: React.FC<TenantDetailSheetProps> = ({
  tenant, visible, onClose, onMoveOut, onReverseOut, onEdit, onSettleRefund,
}) => {
  const { colors } = useTheme();
  if (!tenant) return null;

  const row = (label: string, value: string) => (
    <View style={styles.detailRow} key={label}>
      <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text.primary }]}>{value}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetName, { color: colors.text.primary }]}>
                {tenant.userId.name}
              </Text>
              <Text style={[styles.sheetEmail, { color: colors.text.secondary }]}>
                {tenant.userId.email}
              </Text>
            </View>
            <StatusBadge status={tenant.status} />
          </View>

          <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
            {row('Room', `Room ${tenant.roomId.roomNumber}${tenant.roomId.floor ? ` · Floor ${tenant.roomId.floor}` : ''}`)}
            {row('Property', tenant.propertyId.name)}
            {row('Monthly Rent', `₹${tenant.roomId.monthlyRent.toLocaleString('en-IN')}`)}
            {row('Move-in Date', formatDate(tenant.moveInDate ?? tenant.joinDate))}
            {tenant.exitDate && row('Exit Date', formatDate(tenant.exitDate))}
            {tenant.phone && row('Phone', tenant.phone)}
            {tenant.idProof && row('ID Number', tenant.idProof)}
            {tenant.securityDeposit != null && row('Security Deposit', `₹${Number(tenant.securityDeposit).toLocaleString('en-IN')}`)}
            {tenant.advancePaid != null && row('Advance Paid', `₹${Number(tenant.advancePaid).toLocaleString('en-IN')}`)}
            {tenant.notes ? row('Notes', tenant.notes) : null}
          </ScrollView>

          {tenant.status === 'active' && (
            <>
              <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                onPress={() => { onClose(); onEdit(tenant); }}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit Details</Text>
              </TouchableOpacity>
              <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                onPress={() => { onClose(); onMoveOut(tenant); }}
                activeOpacity={0.8}
              >
                <Ionicons name="exit-outline" size={18} color={colors.error} />
                <Text style={[styles.actionBtnText, { color: colors.error }]}>Move Out Tenant</Text>
              </TouchableOpacity>
            </>
          )}
          {tenant.status === 'vacated' && (
            <>
              {(Number(tenant.advanceRefundAmount || 0) > 0 || Number(tenant.advancePaid || 0) > 0) && (
                <>
                  <View style={styles.sheetDivider} />
                  <View style={[styles.refundCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={[styles.refundTitle, { color: tenant.refundSettled ? colors.success : colors.warning }]}>
                          {tenant.refundSettled ? 'Refund Settled' : 'Refund Due'}
                        </Text>
                        <Text style={[styles.refundAmount, { color: colors.text.primary }]}>
                          ₹{(Number(tenant.advanceRefundAmount) > 0 ? Number(tenant.advanceRefundAmount) : Number(tenant.advancePaid)).toLocaleString('en-IN')}
                        </Text>
                        {tenant.refundSettled && tenant.refundSettledAt && (
                          <Text style={[styles.refundDate, { color: colors.text.tertiary }]}>
                            {formatDate(tenant.refundSettledAt)}
                          </Text>
                        )}
                        {tenant.refundSettled && tenant.refundNote ? (
                          <Text style={[styles.refundDate, { color: colors.text.tertiary }]} numberOfLines={2}>
                            {tenant.refundNote}
                          </Text>
                        ) : null}
                      </View>
                      {!tenant.refundSettled && (
                        <TouchableOpacity
                          style={[styles.refundBtn, { backgroundColor: colors.warning }]}
                          onPress={() => { onClose(); onSettleRefund(tenant); }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.refundBtnText}>Mark Settled</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </>
              )}
              <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.successLight, borderColor: colors.success }]}
                onPress={() => { onClose(); onReverseOut(tenant); }}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-undo-outline" size={18} color={colors.success} />
                <Text style={[styles.actionBtnText, { color: colors.success }]}>Reverse Move-Out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Move-out confirmation modal ──────────────────────────────────────────

interface MoveOutModalProps {
  tenant: OwnerTenant | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (exitDate: string, notes: string) => void;
  saving: boolean;
}

const MoveOutModal: React.FC<MoveOutModalProps> = ({
  tenant, visible, onClose, onConfirm, saving,
}) => {
  const { colors } = useTheme();
  const todayISO = new Date().toISOString().split('T')[0];
  const [exitDate, setExitDate] = useState(todayISO);
  const [notes, setNotes] = useState('');

  // Reset on open
  React.useEffect(() => {
    if (visible) { setExitDate(todayISO); setNotes(''); }
  }, [visible]);

  if (!tenant) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.moveOutSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.moveOutTitle, { color: colors.text.primary }]}>Move Out Tenant</Text>
          <Text style={[styles.moveOutSub, { color: colors.text.secondary }]}>
            {tenant.userId.name} · Room {tenant.roomId.roomNumber}
          </Text>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Exit Date *</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={exitDate}
              onChangeText={setExitDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Reason for move-out…"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.error }]}
              onPress={() => onConfirm(exitDate, notes)}
              activeOpacity={0.8}
              disabled={saving || !exitDate}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Confirm Move Out</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Edit tenant modal (Finance / Profile) ────────────────────────────────

interface EditTenantModalProps {
  tenant: OwnerTenant | null;
  visible: boolean;
  onClose: () => void;
  onSave: (payload: {
    advancePaid: number;
    securityDeposit: number;
    name: string;
    email: string;
    phone: string;
    idProof: string;
  }) => void;
  saving: boolean;
}

const EditTenantModal: React.FC<EditTenantModalProps> = ({
  tenant, visible, onClose, onSave, saving,
}) => {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'finance' | 'profile'>('finance');
  const [deposit, setDeposit] = useState('');
  const [advance, setAdvance] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idProof, setIdProof] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible && tenant) {
      setTab('finance');
      setDeposit(String(tenant.securityDeposit ?? ''));
      setAdvance(String(tenant.advancePaid ?? ''));
      setName(tenant.userId.name || '');
      setEmail(tenant.userId.email || '');
      setPhone(tenant.phone || '');
      setIdProof(tenant.idProof || '');
      setError('');
    }
  }, [visible, tenant]);

  if (!tenant) return null;

  const handleSave = () => {
    const depositNum = Number(deposit) || 0;
    const advanceNum = Number(advance) || 0;
    if (advanceNum > depositNum) {
      setError('Advance paid should be less than or equal to the security deposit.');
      return;
    }
    setError('');
    onSave({
      advancePaid: advanceNum,
      securityDeposit: depositNum,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      idProof: idProof.trim(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.moveOutSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.moveOutTitle, { color: colors.text.primary }]}>Edit Tenant</Text>
          <Text style={[styles.moveOutSub, { color: colors.text.secondary }]}>
            {tenant.userId.name} · Room {tenant.roomId.roomNumber}
          </Text>

          {/* Tabs */}
          <View style={[styles.editTabRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {(['finance', 'profile'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.editTab, tab === t && { backgroundColor: colors.primary }]}
                onPress={() => setTab(t)}
                activeOpacity={0.8}
              >
                <Text style={[styles.editTabText, { color: tab === t ? '#FFFFFF' : colors.text.secondary }]}>
                  {t === 'finance' ? 'Finance' : 'Profile'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? (
            <View style={[styles.editError, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <Text style={[styles.editErrorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {tab === 'finance' ? (
            <>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Target Security Deposit (Total ₹)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={deposit}
                  onChangeText={setDeposit}
                  keyboardType="numeric"
                  placeholder="Total amount expected to pay"
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={[styles.fieldHint, { color: colors.text.tertiary }]}>Total amount the tenant is expected to pay.</Text>
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Currently Paid (₹)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={advance}
                  onChangeText={setAdvance}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Full Name</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Tenant full name"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Email</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="tenant@example.com"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Phone</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Tenant phone"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>ID Number</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={idProof}
                  onChangeText={setIdProof}
                  placeholder="Aadhaar / Govt ID number"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Refund settle modal (optional note) ──────────────────────────────────

interface RefundSettleModalProps {
  tenant: OwnerTenant | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  saving: boolean;
}

const RefundSettleModal: React.FC<RefundSettleModalProps> = ({
  tenant, visible, onClose, onConfirm, saving,
}) => {
  const { colors } = useTheme();
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (visible) setNote('');
  }, [visible]);

  if (!tenant) return null;

  const amount = Number(tenant.advanceRefundAmount) > 0 ? Number(tenant.advanceRefundAmount) : Number(tenant.advancePaid);

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.moveOutSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.moveOutTitle, { color: colors.text.primary }]}>Mark Refund Settled</Text>
          <Text style={[styles.moveOutSub, { color: colors.text.secondary }]}>
            {tenant.userId.name} · ₹{amount.toLocaleString('en-IN')}
          </Text>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Note (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={note}
              onChangeText={setNote}
              placeholder="Optional note for this refund…"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.warning }]}
              onPress={() => onConfirm(note.trim())}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Mark Settled</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Tenant list card ─────────────────────────────────────────────────────

const TenantCard: React.FC<{ tenant: OwnerTenant; onPress: () => void }> = ({ tenant, onPress }) => {
  const { colors } = useTheme();
  const initials = tenant.userId.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <TouchableOpacity
      style={[styles.tenantCard, { backgroundColor: colors.surface }, shadows.sm]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.tenantName, { color: colors.text.primary }]} numberOfLines={1}>
          {tenant.userId.name}
        </Text>
        <Text style={[styles.tenantSub, { color: colors.text.secondary }]} numberOfLines={1}>
          Room {tenant.roomId.roomNumber} · {tenant.propertyId.name}
        </Text>
        <Text style={[styles.tenantDate, { color: colors.text.tertiary }]}>
          Since {formatDate(tenant.moveInDate ?? tenant.joinDate)}
        </Text>
      </View>

      <View style={styles.cardRight}>
        <StatusBadge status={tenant.status} />
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} style={{ marginTop: 6 }} />
      </View>
    </TouchableOpacity>
  );
};

// ─── Filter tab ───────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'vacated';

// ─── Main screen ──────────────────────────────────────────────────────────

export const OwnerTenantsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<FilterTab>('active');
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<OwnerTenant | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [moveOutTarget, setMoveOutTarget] = useState<OwnerTenant | null>(null);
  const [editTarget, setEditTarget] = useState<OwnerTenant | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [refundTarget, setRefundTarget] = useState<OwnerTenant | null>(null);
  const [refundVisible, setRefundVisible] = useState(false);
  const [moveOutVisible, setMoveOutVisible] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<OwnerTenant | null>(null);

  const queryStatus = filter === 'all' ? undefined : filter;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerTenants', filter],
    queryFn: () => getOwnerTenants(queryStatus ? { status: queryStatus } : {}),
    staleTime: 2 * 60 * 1000,
  });

  const tenants = data?.tenants ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(t =>
      t.userId.name.toLowerCase().includes(q) ||
      t.userId.email.toLowerCase().includes(q) ||
      t.roomId.roomNumber.toLowerCase().includes(q) ||
      t.propertyId.name.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const moveOutMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { exitDate: string; notes?: string } }) =>
      moveOutTenant(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      setMoveOutVisible(false);
      setMoveOutTarget(null);
      Alert.alert('Done', 'Tenant has been moved out successfully.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Move-out failed. Please try again.'),
  });

  const reverseMoveOutMutation = useMutation({
    mutationFn: (id: string) => reverseMoveOutTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      setReverseTarget(null);
      Alert.alert('Reversed', 'Tenant has been restored to active status.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Reversal failed. Please try again.'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTenant>[1] }) =>
      updateTenant(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      setEditTarget(null);
      setEditVisible(false);
      Alert.alert('Saved', 'Tenant details updated successfully.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Update failed. Please try again.'),
  });

  const handleMoveOut = (exitDate: string, notes: string) => {
    if (!moveOutTarget) return;
    moveOutMutation.mutate({
      id: moveOutTarget._id,
      payload: { exitDate, notes: notes.trim() || undefined },
    });
  };

  const handleEditSave = (payload: Parameters<typeof updateTenant>[1]) => {
    if (!editTarget) return;
    editMutation.mutate({ id: editTarget._id, payload });
  };

  const refundMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => markRefundSettled(id, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      setRefundTarget(null);
      setRefundVisible(false);
      Alert.alert('Settled', 'Refund marked as settled.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Failed to settle refund. Please try again.'),
  });

  const handleSettleRefund = (note: string) => {
    if (!refundTarget) return;
    refundMutation.mutate({ id: refundTarget._id, note });
  };

  const openDetail = (t: OwnerTenant) => {
    setSelectedTenant(t);
    setDetailVisible(true);
  };

  const triggerMoveOut = (t: OwnerTenant) => {
    setMoveOutTarget(t);
    setMoveOutVisible(true);
  };

  const triggerReverseOut = (t: OwnerTenant) => {
    setReverseTarget(t);
    if (/@deleted\.local$/.test(t.userId.email || '')) {
      Alert.alert(
        'Cannot Reverse Move-Out',
        'This tenant\u2019s account has been deleted. Move-out cannot be reversed.',
        [{ text: 'OK', onPress: () => setReverseTarget(null) }]
      );
      return;
    }
    Alert.alert(
      'Reverse Move-Out',
      `Restore ${t.userId.name} (Room ${t.roomId.roomNumber}) back to active? This will re-occupy the room.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setReverseTarget(null) },
        {
          text: 'Restore',
          onPress: () => reverseMoveOutMutation.mutate(t._id),
        },
      ]
    );
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'vacated', label: 'Vacated' },
    { key: 'all', label: 'All' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Tenants</Text>
          {!isLoading && (
            <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
              {filtered.length} {filter === 'all' ? 'total' : filter}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.push('/owner/add-tenant' as any)}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, filter === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: filter === t.key ? colors.primary : colors.text.secondary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, room, property…"
            placeholderTextColor={colors.text.tertiary}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
            {search ? 'No results found' : `No ${filter === 'all' ? '' : filter} tenants`}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {filtered.map(t => (
            <TenantCard key={t._id} tenant={t} onPress={() => openDetail(t)} />
          ))}
        </ScrollView>
      )}

      <TenantDetailSheet
        tenant={selectedTenant}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onMoveOut={triggerMoveOut}
        onReverseOut={triggerReverseOut}
        onEdit={(t) => { setEditTarget(t); setEditVisible(true); }}
        onSettleRefund={(t) => { setRefundTarget(t); setRefundVisible(true); }}
      />

      <MoveOutModal
        tenant={moveOutTarget}
        visible={moveOutVisible}
        onClose={() => setMoveOutVisible(false)}
        onConfirm={handleMoveOut}
        saving={moveOutMutation.isPending}
      />

      <EditTenantModal
        tenant={editTarget}
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSave={handleEditSave}
        saving={editMutation.isPending}
      />

      <RefundSettleModal
        tenant={refundTarget}
        visible={refundVisible}
        onClose={() => setRefundVisible(false)}
        onConfirm={handleSettleRefund}
        saving={refundMutation.isPending}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    paddingVertical: spacing.md,
    marginRight: spacing.xxl,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '600' },

  // Search
  searchWrap: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14 },

  scroll: { padding: spacing.xl, gap: spacing.md },

  // Tenant card
  tenantCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  tenantName: { fontSize: 15, fontWeight: '700' },
  tenantSub: { fontSize: 12, marginTop: 2 },
  tenantDate: { fontSize: 11, marginTop: 3 },
  cardRight: { alignItems: 'flex-end' },

  // Badge
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },

  // Detail sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sheetName: { fontSize: 18, fontWeight: '700' },
  sheetEmail: { fontSize: 13, marginTop: 2 },
  sheetDivider: { height: 1, marginVertical: spacing.md },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },
  moveOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  moveOutBtnText: { fontSize: 15, fontWeight: '600' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600' },

  // Move-out modal
  moveOutSheet: {
    margin: spacing.xl,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
  },
  moveOutTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  moveOutSub: { fontSize: 13, marginBottom: spacing.xl },
  formField: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  modalBtn: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },

  // Edit modal
  editTabRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xs,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  editTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  editTabText: { fontSize: 14, fontWeight: '600' },
  fieldHint: { fontSize: 11, marginTop: spacing.xs + 2 },
  editError: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  editErrorText: { fontSize: 13, fontWeight: '600' },

  // Refund
  refundCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  refundTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  refundAmount: { fontSize: 18, fontWeight: '700', marginTop: spacing.xs },
  refundDate: { fontSize: 11, marginTop: 2 },
  refundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  refundBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
});
