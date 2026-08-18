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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { getOwnerTenants, moveOutTenant, reverseMoveOutTenant, updateTenant, markRefundSettled, addCoOccupant, updateCoOccupant, deleteCoOccupant, type OwnerTenant, type CoOccupant, type RefundSettlementPayload } from '../../api/owner';
import { KeyboardSafeModal } from '../../components';

// ─── Helpers ──────────────────────────────────────────────────────────────

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Status badge ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: OwnerTenant['status']; t: (key: string) => string }> = ({ status, t }) => {
  const { colors } = useTheme();
  const config = {
    active: { bg: colors.successLight, text: colors.success, label: t('owner.tenants.statusActive') },
    vacated: { bg: colors.borderLight, text: colors.text.secondary, label: t('owner.tenants.statusVacated') },
    pending_deletion: { bg: colors.errorLight, text: colors.error, label: t('owner.tenants.statusPendingDeletion') },
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
  onAddCoOccupant: (tenant: OwnerTenant) => void;
  onEditCoOccupant: (tenant: OwnerTenant, co: CoOccupant) => void;
  onDeleteCoOccupant: (tenant: OwnerTenant, co: CoOccupant) => void;
  t: (key: string) => string;
}

const TenantDetailSheet: React.FC<TenantDetailSheetProps> = ({
  tenant, visible, onClose, onMoveOut, onReverseOut, onEdit, onSettleRefund, onAddCoOccupant, onEditCoOccupant, onDeleteCoOccupant, t
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
            <StatusBadge status={tenant.status} t={t} />
          </View>

          <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: spacing.sm }}>
            {row(t('owner.tenants.detailRoom'), `Room ${tenant.roomId.roomNumber}${tenant.roomId.floor ? ` · Floor ${tenant.roomId.floor}` : ''}`)}
            {row(t('owner.tenants.detailProperty'), tenant.propertyId.name)}
            {row(t('owner.tenants.detailMonthlyRent'), `₹${tenant.roomId.monthlyRent.toLocaleString('en-IN')}`)}
            {row(t('owner.tenants.detailMoveIn'), formatDate(tenant.moveInDate ?? tenant.joinDate))}
            {tenant.exitDate && row(t('owner.tenants.detailExit'), formatDate(tenant.exitDate))}
            {tenant.phone && row(t('owner.tenants.detailPhone'), tenant.phone)}
            {tenant.idProof && row(t('owner.tenants.detailIdNumber'), tenant.idProof)}
            {tenant.securityDeposit != null && row(t('owner.tenants.detailSecurityDeposit'), `₹${Number(tenant.securityDeposit).toLocaleString('en-IN')}`)}
            {tenant.advancePaid != null && row(t('owner.tenants.detailAdvancePaid'), `₹${Number(tenant.advancePaid).toLocaleString('en-IN')}`)}
            {tenant.notes ? row(t('owner.tenants.detailNotes'), tenant.notes) : null}

            {/* Co-Occupants */}
            <View style={[styles.coSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.coHeader}>
                <Text style={[styles.coTitle, { color: colors.text.primary }]}>
                  {t('owner.tenants.coTitle')} ({tenant.coOccupants?.length ?? 0})
                </Text>
                {tenant.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.coAddBtn, { backgroundColor: colors.primary }]}
                    onPress={() => { onClose(); onAddCoOccupant(tenant); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                    <Text style={styles.coAddBtnText}>{t('owner.tenants.coAdd')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!tenant.coOccupants || tenant.coOccupants.length === 0 ? (
                <Text style={[styles.coEmpty, { color: colors.text.tertiary }]}>{t('owner.tenants.coEmpty')}</Text>
              ) : (
                tenant.coOccupants.map(co => (
                  <View key={co._id} style={[styles.coRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.coName, { color: colors.text.primary }]} numberOfLines={1}>{co.name}</Text>
                      {(co.phone || co.idProof) && (
                        <Text style={[styles.coMeta, { color: colors.text.tertiary }]} numberOfLines={1}>
                          {[co.phone, co.idProof ? `ID: ${co.idProof}` : ''].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                    {tenant.status === 'active' && (
                      <View style={styles.coActions}>
                        <TouchableOpacity
                          style={[styles.coActionBtn, { backgroundColor: colors.primaryLight }]}
                          onPress={() => { onClose(); onEditCoOccupant(tenant, co); }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.coActionBtn, { backgroundColor: colors.errorLight }]}
                          onPress={() => { onClose(); onDeleteCoOccupant(tenant, co); }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            {tenant.status === 'active' && (
              <>
                <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                  onPress={() => { onClose(); onEdit(tenant); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>{t('owner.tenants.detailEdit')}</Text>
                </TouchableOpacity>
                <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                  onPress={() => { onClose(); onMoveOut(tenant); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="exit-outline" size={18} color={colors.error} />
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>{t('owner.tenants.detailMoveOut')}</Text>
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
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.refundTitle, { color: tenant.refundSettled ? colors.success : colors.warning }]}>
                            {tenant.refundSettled ? t('owner.tenants.refundSettled') : t('owner.tenants.refundDue')}
                          </Text>
                          <Text style={[styles.refundAmount, { color: colors.text.primary }]}>
                            ₹{((tenant.refundSettled ? (Number(tenant.refundAmount) || Number(tenant.advanceRefundAmount) || 0) : (Number(tenant.advanceRefundAmount) || Number(tenant.advancePaid) || 0))).toLocaleString('en-IN')}
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
                          {tenant.refundSettled && (tenant.refundDeductions?.length || tenant.refundTotalDeductions) ? (
                            <View style={[styles.settlementMini, { borderColor: colors.border }]}>
                              <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementOriginal')}</Text>
                                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>₹{(Number(tenant.refundOriginalDeposit) || Number(tenant.advancePaid) || 0).toLocaleString('en-IN')}</Text>
                              </View>
                              <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementTotalDeductions')}</Text>
                                <Text style={[styles.summaryValue, { color: colors.error }]}>− ₹{(Number(tenant.refundTotalDeductions) || 0).toLocaleString('en-IN')}</Text>
                              </View>
                              <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementRefunded')}</Text>
                                <Text style={[styles.summaryValue, { color: colors.success, fontWeight: '800' }]}>₹{(Number(tenant.refundAmount) || Number(tenant.advanceRefundAmount) || 0).toLocaleString('en-IN')}</Text>
                              </View>
                              {tenant.refundMethod ? (
                                <Text style={[styles.refundDate, { color: colors.text.tertiary }]} numberOfLines={1}>
                                  {tenant.refundMethod.toUpperCase()}{tenant.refundReference ? ` · ${tenant.refundReference}` : ''}
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                        {!tenant.refundSettled && (
                          <TouchableOpacity
                            style={[styles.refundBtn, { backgroundColor: colors.warning }]}
                            onPress={() => { onClose(); onSettleRefund(tenant); }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                            <Text style={styles.refundBtnText}>{t('owner.tenants.markSettled')}</Text>
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
                  <Text style={[styles.actionBtnText, { color: colors.success }]}>{t('owner.tenants.detailReverse')}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Calendar modal ────────────────────────────────────────────────────────

interface CalendarModalProps {
  visible: boolean;
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
  title: string;
}

const CalendarModal: React.FC<CalendarModalProps> = ({ visible, value, onSelect, onClose, title }) => {
  const { colors } = useTheme();
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selYear, setSelYear] = useState(initial.getFullYear());
  const [selMonth, setSelMonth] = useState(initial.getMonth());
  const [selDay, setSelDay] = useState(initial.getDate());

  React.useEffect(() => {
    if (!visible) return;
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setSelYear(base.getFullYear());
    setSelMonth(base.getMonth());
    setSelDay(base.getDate());
  }, [visible, value]);

  const today = new Date();
  const todayISOStr = toISO(today);

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
  };

  const pick = (day: number) => {
    onSelect(toISO(new Date(viewYear, viewMonth, day)));
    onClose();
  };

  const isSel = (day: number) => viewYear === selYear && viewMonth === selMonth && day === selDay;
  const isToday = (day: number) => toISO(new Date(viewYear, viewMonth, day)) === todayISOStr;

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={styles.calendarOverlay} onPress={onClose} activeOpacity={1}>
        <View style={[styles.calendarSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.calendarTitle, { color: colors.text.primary }]}>{title}</Text>

          <View style={styles.calendarNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={[styles.calendarMonthLabel, { color: colors.text.primary }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarWeekRow}>
            {DAYS.map((d, i) => (
              <Text key={i} style={[styles.calendarWeekDay, { color: colors.text.tertiary }]}>{d}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {Array.from({ length: firstDow }).map((_, i) => (
              <View key={`pad-${i}`} style={styles.calendarCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.calendarCell,
                    isSel(day) && { backgroundColor: colors.primary },
                    isToday(day) && !isSel(day) && { borderWidth: 1, borderColor: colors.primary },
                  ]}
                  onPress={() => pick(day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.calendarDay,
                      { color: isSel(day) ? '#FFFFFF' : colors.text.primary },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
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
  t: (key: string) => string;
}

const MoveOutModal: React.FC<MoveOutModalProps> = ({
  tenant, visible, onClose, onConfirm, saving, t
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const todayISO = new Date().toISOString().split('T')[0];
  const [exitDate, setExitDate] = useState(todayISO);
  const [notes, setNotes] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);

  // Reset on open
  React.useEffect(() => {
    if (visible) { setExitDate(todayISO); setNotes(''); }
  }, [visible]);

  if (!tenant) return null;

  return (
    <>
      <KeyboardSafeModal
        visible={visible}
        animationType="fade"
        overlayStyle={[styles.sheetOverlay, { paddingBottom: insets.bottom + 64 }]}
        onRequestClose={onClose}
      >
        <View style={[styles.moveOutSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.moveOutTitle, { color: colors.text.primary }]}>{t('owner.tenants.moveOutTitle')}</Text>
          <Text style={[styles.moveOutSub, { color: colors.text.secondary }]}>
            {tenant.userId.name} · Room {tenant.roomId.roomNumber}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.moveOutFieldExitDate')}</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateField, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setCalendarVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: exitDate ? colors.text.primary : colors.text.tertiary, fontSize: 15 }}>
                  {exitDate || t('owner.tenants.moveOutEmptyExitDate')}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.moveOutFieldNotes')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('owner.tenants.moveOutPlaceholderNotes')}
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.commonOwner.cancel')}</Text>
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
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('owner.tenants.moveOutConfirm')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardSafeModal>

      <CalendarModal
        visible={calendarVisible}
        value={exitDate}
        onSelect={setExitDate}
        onClose={() => setCalendarVisible(false)}
        title={t('owner.tenants.moveOutFieldExitDate')}
      />
    </>
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
  t: (key: string) => string;
}

const EditTenantModal: React.FC<EditTenantModalProps> = ({
  tenant, visible, onClose, onSave, saving, t
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
      setError(t('owner.tenants.editErrAdvanceDeposit'));
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
    <KeyboardSafeModal
      visible={visible}
      animationType="slide"
      overlayStyle={[styles.sheetOverlay, { paddingBottom: insets.bottom + 64 }]}
      onRequestClose={onClose}
    >
      <View style={[styles.moveOutSheet, { backgroundColor: colors.surface }]}>
        <Text style={[styles.moveOutTitle, { color: colors.text.primary }]}>{t('owner.tenants.editTitle')}</Text>
        <Text style={[styles.moveOutSub, { color: colors.text.secondary }]}>
          {tenant.userId.name} · Room {tenant.roomId.roomNumber}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
          {/* Tabs */}
          <View style={[styles.editTabRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {(['finance', 'profile'] as const).map(tabKey => (
              <TouchableOpacity
                key={tabKey}
                style={[styles.editTab, tab === tabKey && { backgroundColor: colors.primary }]}
                onPress={() => setTab(tabKey)}
                activeOpacity={0.8}
              >
                <Text style={[styles.editTabText, { color: tab === tabKey ? '#FFFFFF' : colors.text.secondary }]}>
                  {tabKey === 'finance' ? t('owner.tenants.editTabFinance') : t('owner.tenants.editTabProfile')}
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
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.editFieldTargetDeposit')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={deposit}
                  onChangeText={setDeposit}
                  keyboardType="numeric"
                  placeholder={t('owner.tenants.editPlaceholderDeposit')}
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={[styles.fieldHint, { color: colors.text.tertiary }]}>{t('owner.tenants.editHintDeposit')}</Text>
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.editFieldPaid')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={advance}
                  onChangeText={setAdvance}
                  keyboardType="numeric"
                  placeholder={t('owner.tenants.editPlaceholderPaid')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.editFieldFullName')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('owner.tenants.editPlaceholderName')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.editFieldEmail')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('owner.tenants.editPlaceholderEmail')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.editFieldPhone')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder={t('owner.tenants.editPlaceholderPhone')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.editFieldIdNumber')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={idProof}
                  onChangeText={setIdProof}
                  placeholder={t('owner.tenants.editPlaceholderId')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.commonOwner.cancel')}</Text>
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
              <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('owner.tenants.editTitle')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardSafeModal>
  );
};

// ─── Refund settle modal (deposit + deductions + refund amount) ───────────

interface RefundDeductionDraft {
  category: string;
  description: string;
  amount: string;
}

interface RefundSettleModalProps {
  tenant: OwnerTenant | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (payload: RefundSettlementPayload) => void;
  saving: boolean;
  t: (key: string) => string;
}

const RefundSettleModal: React.FC<RefundSettleModalProps> = ({
  tenant, visible, onClose, onConfirm, saving, t
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [originalDeposit, setOriginalDeposit] = useState('');
  const [deductions, setDeductions] = useState<RefundDeductionDraft[]>([{ category: 'rent', description: '', amount: '' }]);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible && tenant) {
      const deposit = Number(tenant.advancePaid) || Number(tenant.advanceRefundAmount) || Number(tenant.roomId?.securityDeposit) || 0;
      setOriginalDeposit(deposit ? String(deposit) : '');
      setDeductions([{ category: 'rent', description: '', amount: '' }]);
      setMethod('cash');
      setReference('');
      setNote('');
      setError('');
    }
  }, [visible, tenant]);

  if (!tenant) return null;

  const totalDeductions = deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const refundable = Math.max(0, (Number(originalDeposit) || 0) - totalDeductions);

  const updateDeduction = (idx: number, field: keyof RefundDeductionDraft, value: string) => {
    setDeductions(ds => ds.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
    setError('');
  };

  const addDeduction = () => setDeductions(ds => [...ds, { category: 'damage', description: '', amount: '' }]);
  const removeDeduction = (idx: number) => {
    setDeductions(ds => {
      const next = ds.filter((_, i) => i !== idx);
      return next.length ? next : [{ category: 'rent', description: '', amount: '' }];
    });
  };

  const handleConfirm = () => {
    const cleanDeductions = deductions
      .filter(d => (Number(d.amount) || 0) > 0 || d.description)
      .map(d => ({
        category: d.category.trim() || 'other',
        description: d.description.trim(),
        amount: Number(d.amount) || 0,
      }));

    if (cleanDeductions.length === 0 && !originalDeposit) {
      setError(t('owner.tenants.settlementRequired'));
      return;
    }

    onConfirm({
      originalDeposit: Number(originalDeposit) || 0,
      deductions: cleanDeductions,
      refundAmount: refundable,
      refundMethod: method,
      refundReference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <KeyboardSafeModal
      visible={visible}
      animationType="fade"
      overlayStyle={[styles.sheetOverlay, { paddingBottom: insets.bottom + 64 }]}
      onRequestClose={onClose}
    >
      <View style={[styles.moveOutSheet, { backgroundColor: colors.surface }]}>
        <Text style={[styles.moveOutTitle, { color: colors.text.primary }]}>{t('owner.tenants.settlementTitle')}</Text>
        <Text style={[styles.moveOutSub, { color: colors.text.secondary }]}>
          {tenant.userId.name} · Room {tenant.roomId.roomNumber}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementFieldDeposit')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={originalDeposit}
              onChangeText={setOriginalDeposit}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementDeductionsLabel')}</Text>
            {deductions.map((d, idx) => (
              <View key={idx} style={[styles.deductionRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, styles.deductionCategory, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={d.category}
                    onChangeText={v => updateDeduction(idx, 'category', v)}
                    placeholder={t('owner.tenants.settlementDeductionCategory')}
                    placeholderTextColor={colors.text.tertiary}
                    maxLength={40}
                  />
                  <TextInput
                    style={[styles.input, styles.deductionAmount, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={d.amount}
                    onChangeText={v => updateDeduction(idx, 'amount', v)}
                    keyboardType="numeric"
                    placeholder="₹0"
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <TouchableOpacity onPress={() => removeDeduction(idx)} style={styles.deductionRemove} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={d.description}
                  onChangeText={v => updateDeduction(idx, 'description', v)}
                  placeholder={t('owner.tenants.settlementDeductionDesc')}
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={120}
                />
              </View>
            ))}
            <TouchableOpacity onPress={addDeduction} style={styles.addDeductionBtn} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.addDeductionText, { color: colors.primary }]}>{t('owner.tenants.settlementAddDeduction')}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementTotalDeductions')}</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>− ₹{totalDeductions.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementRefundable')}</Text>
              <Text style={[styles.summaryValue, { color: colors.success, fontWeight: '800' }]}>₹{refundable.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementFieldMethod')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {['cash', 'upi', 'bank', 'other'].map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMethod(m)}
                  activeOpacity={0.8}
                  style={[
                    styles.methodChip,
                    { borderColor: method === m ? colors.primary : colors.border, backgroundColor: method === m ? colors.primaryLight : colors.background },
                  ]}
                >
                  <Text style={{ color: method === m ? colors.primary : colors.text.secondary, fontSize: 12, fontWeight: '700' }}>
                    {t(`owner.tenants.settlementMethod_${m}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.settlementFieldReference')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={reference}
              onChangeText={setReference}
              placeholder={t('owner.tenants.settlementPlaceholderReference')}
              placeholderTextColor={colors.text.tertiary}
              maxLength={60}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.refundFieldNote')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={note}
              onChangeText={setNote}
              placeholder={t('owner.tenants.refundPlaceholderNote')}
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          {error ? (
            <View style={[styles.editError, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <Text style={[styles.editErrorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.commonOwner.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: colors.warning }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('owner.tenants.settlementConfirm')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardSafeModal>
  );
};

// ─── Co-occupant modal (Add/Edit) ─────────────────────────────────────────

interface CoOccupantModalProps {
  tenant: OwnerTenant | null;
  coOccupant: CoOccupant | null;
  visible: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; phone: string; idProof: string }) => void;
  saving: boolean;
  t: (key: string) => string;
}

const CoOccupantModal: React.FC<CoOccupantModalProps> = ({
  tenant, coOccupant, visible, onClose, onSave, saving, t
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idProof, setIdProof] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setName(coOccupant?.name || '');
      setPhone(coOccupant?.phone || '');
      setIdProof(coOccupant?.idProof || '');
      setError('');
    }
  }, [visible, coOccupant]);

  if (!tenant) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setError(t('owner.tenants.coNameRequired'));
      return;
    }
    setError('');
    onSave({ name: name.trim(), phone: phone.trim(), idProof: idProof.trim() });
  };

  return (
    <KeyboardSafeModal
      visible={visible}
      animationType="fade"
      overlayStyle={[styles.sheetOverlay, { paddingBottom: insets.bottom + 64 }]}
      onRequestClose={onClose}
    >
      <View style={[styles.moveOutSheet, { backgroundColor: colors.surface }]}>
        <Text style={[styles.moveOutTitle, { color: colors.text.primary }]}>
          {coOccupant ? t('owner.tenants.coEditTitle') : t('owner.tenants.coAddTitle')}
        </Text>
        <Text style={[styles.moveOutSub, { color: colors.text.secondary }]}>
          {tenant.userId.name} · {t('owner.tenants.coRoomLabel')} {tenant.roomId.roomNumber}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
          {error ? (
            <View style={[styles.editError, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <Text style={[styles.editErrorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.coFieldName')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={name}
              onChangeText={setName}
              placeholder={t('owner.tenants.coPlaceholderName')}
              placeholderTextColor={colors.text.tertiary}
              maxLength={60}
            />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.coFieldPhone')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder={t('owner.tenants.coPlaceholderPhone')}
              placeholderTextColor={colors.text.tertiary}
            />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.coFieldId')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={idProof}
              onChangeText={setIdProof}
              placeholder={t('owner.tenants.coPlaceholderId')}
              placeholderTextColor={colors.text.tertiary}
            />
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.commonOwner.cancel')}</Text>
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
              <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>
                {coOccupant ? t('owner.commonOwner.saveChanges') : t('owner.tenants.coAdd')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardSafeModal>
  );
};

// ─── Tenant list card ─────────────────────────────────────────────────────

const TenantCard: React.FC<{ tenant: OwnerTenant; onPress: () => void; t: (key: string) => string }> = ({ tenant, onPress, t }) => {
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
          {t('owner.tenants.since', { date: formatDate(tenant.moveInDate ?? tenant.joinDate) })}
        </Text>
      </View>

      <View style={styles.cardRight}>
        <StatusBadge status={tenant.status} t={t} />
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} style={{ marginTop: 6 }} />
      </View>
    </TouchableOpacity>
  );
};

// ─── Filter tab ───────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'vacated';

// ─── Main screen ──────────────────────────────────────────────────────────

export const OwnerTenantsScreen: React.FC = () => {
  const { t } = useTranslation();
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
  const [coTarget, setCoTarget] = useState<OwnerTenant | null>(null);
  const [coOccupant, setCoOccupant] = useState<CoOccupant | null>(null);
  const [coVisible, setCoVisible] = useState(false);

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
      Alert.alert(t('owner.tenants.moveOutAlertTitle'), t('owner.tenants.moveOutAlertMsg'));
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.tenants.moveOutErr')),
  });

  const reverseMoveOutMutation = useMutation({
    mutationFn: (id: string) => reverseMoveOutTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      setReverseTarget(null);
      Alert.alert(t('owner.tenants.reverseDoneTitle'), t('owner.tenants.reverseDoneMsg'));
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.tenants.reverseErr')),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTenant>[1] }) =>
      updateTenant(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      setEditTarget(null);
      setEditVisible(false);
      Alert.alert(t('owner.tenants.editSavedTitle'), t('owner.tenants.editSavedMsg'));
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.tenants.editErr')),
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
    mutationFn: ({ id, payload }: { id: string; payload: RefundSettlementPayload }) => markRefundSettled(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      setRefundTarget(null);
      setRefundVisible(false);
      Alert.alert(t('owner.tenants.settlementAlertTitle'), t('owner.tenants.settlementAlertMsg'));
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.tenants.refundErr')),
  });

  const handleSettleRefund = (payload: RefundSettlementPayload) => {
    if (!refundTarget) return;
    refundMutation.mutate({ id: refundTarget._id, payload });
  };

  const addCoMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; phone: string; idProof: string } }) =>
      addCoOccupant(id, [payload]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      setCoTarget(null);
      setCoVisible(false);
      Alert.alert(t('owner.tenants.coSavedTitle'), t('owner.tenants.coAddedMsg'));
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('owner.tenants.coErr')),
  });

  const updateCoMutation = useMutation({
    mutationFn: ({ id, coId, payload }: { id: string; coId: string; payload: { name: string; phone: string; idProof: string } }) =>
      updateCoOccupant(id, coId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      setCoTarget(null);
      setCoVisible(false);
      Alert.alert(t('owner.tenants.coSavedTitle'), t('owner.tenants.coUpdatedMsg'));
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('owner.tenants.coErr')),
  });

  const deleteCoMutation = useMutation({
    mutationFn: ({ id, coId }: { id: string; coId: string }) => deleteCoOccupant(id, coId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      Alert.alert(t('owner.tenants.coSavedTitle'), t('owner.tenants.coDeletedMsg'));
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('owner.tenants.coErrDelete')),
  });

  const openAddCoOccupant = (tenant: OwnerTenant) => {
    setCoOccupant(null);
    setCoTarget(tenant);
    setCoVisible(true);
  };

  const openEditCoOccupant = (tenant: OwnerTenant, co: CoOccupant) => {
    setCoOccupant(co);
    setCoTarget(tenant);
    setCoVisible(true);
  };

  const triggerDeleteCoOccupant = (tenant: OwnerTenant, co: CoOccupant) => {
    Alert.alert(
      t('owner.tenants.coDeleteTitle'),
      t('owner.tenants.coDeleteMsg', { name: co.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('owner.tenants.coDeleteConfirm'),
          style: 'destructive',
          onPress: () => deleteCoMutation.mutate({ id: tenant._id, coId: co._id }),
        },
      ]
    );
  };

  const handleSaveCoOccupant = (payload: { name: string; phone: string; idProof: string }) => {
    if (!coTarget) return;
    if (coOccupant) {
      updateCoMutation.mutate({ id: coTarget._id, coId: coOccupant._id, payload });
    } else {
      addCoMutation.mutate({ id: coTarget._id, payload });
    }
  };

  const openDetail = (t: OwnerTenant) => {
    setSelectedTenant(t);
    setDetailVisible(true);
  };

  const triggerMoveOut = (t: OwnerTenant) => {
    setMoveOutTarget(t);
    setMoveOutVisible(true);
  };

  const triggerReverseOut = (tenant: OwnerTenant) => {
    setReverseTarget(tenant);
    if (/@deleted\.local$/.test(tenant.userId.email || '')) {
      Alert.alert(
        t('owner.tenants.reverseDeletedTitle'),
        t('owner.tenants.reverseDeletedMsg'),
        [{ text: t('common.ok'), onPress: () => setReverseTarget(null) }]
      );
      return;
    }
    Alert.alert(
      t('owner.tenants.reverseAlertTitle'),
      t('owner.tenants.reverseAlertMsg', { name: tenant.userId.name, room: tenant.roomId.roomNumber }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => setReverseTarget(null) },
        {
          text: t('owner.tenants.reverseAlertRestore'),
          onPress: () => reverseMoveOutMutation.mutate(tenant._id),
        },
      ]
    );
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'active', label: t('owner.tenants.tabActive') },
    { key: 'vacated', label: t('owner.tenants.tabVacated') },
    { key: 'all', label: t('owner.tenants.tabAll') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.tenants.title')}</Text>
          {!isLoading && (
            <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
              {t(filtered.length === 1 ? 'owner.tenants.count_one' : 'owner.tenants.count_other', { count: filtered.length })}
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
            placeholder={t('owner.tenants.searchPlaceholder')}
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
            {search ? t('owner.tenants.emptyNoSearch') : filter === 'active' ? t('owner.tenants.emptyNoActive') : filter === 'vacated' ? t('owner.tenants.emptyNoVacated') : t('owner.tenants.emptyNoTenants')}
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
          {filtered.map(tenant => (
            <TenantCard key={tenant._id} tenant={tenant} onPress={() => openDetail(tenant)} t={t} />
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
        onAddCoOccupant={openAddCoOccupant}
        onEditCoOccupant={openEditCoOccupant}
        onDeleteCoOccupant={triggerDeleteCoOccupant}
        t={t}
      />

      <MoveOutModal
        tenant={moveOutTarget}
        visible={moveOutVisible}
        onClose={() => setMoveOutVisible(false)}
        onConfirm={handleMoveOut}
        saving={moveOutMutation.isPending}
        t={t}
      />

      <EditTenantModal
        tenant={editTarget}
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSave={handleEditSave}
        saving={editMutation.isPending}
        t={t}
      />

      <RefundSettleModal
        tenant={refundTarget}
        visible={refundVisible}
        onClose={() => setRefundVisible(false)}
        onConfirm={handleSettleRefund}
        saving={refundMutation.isPending}
        t={t}
      />

      <CoOccupantModal
        tenant={coTarget}
        coOccupant={coOccupant}
        visible={coVisible}
        onClose={() => { setCoVisible(false); setCoTarget(null); setCoOccupant(null); }}
        onSave={handleSaveCoOccupant}
        saving={addCoMutation.isPending || updateCoMutation.isPending}
        t={t}
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
    maxHeight: '90%',
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
    maxHeight: '90%',
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
  dateField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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

  // Refund settlement modal & breakdown
  deductionRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  deductionCategory: { flex: 2 },
  deductionAmount: { flex: 1, textAlign: 'right' },
  deductionRemove: { padding: spacing.xs, marginLeft: spacing.xs },
  addDeductionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addDeductionText: { fontSize: 13, fontWeight: '700' },
  summaryBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  methodChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settlementMini: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: 2,
  },

  // Co-Occupants
  coSection: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  coHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  coTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  coAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  coAddBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  coEmpty: { fontSize: 12, fontStyle: 'italic' },
  coRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  coName: { fontSize: 13, fontWeight: '600' },
  coMeta: { fontSize: 11, marginTop: 1 },
  coActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  coActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyTitle: { fontSize: 15, textAlign: 'center' },

  // Calendar modal
  calendarOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: spacing.xl },
  calendarSheet: { width: '100%', maxWidth: 360, borderRadius: radius.xxl, padding: spacing.xl, borderWidth: 1 },
  calendarTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.lg },
  calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  calendarMonthLabel: { fontSize: 16, fontWeight: '700' },
  calendarWeekRow: { flexDirection: 'row' },
  calendarWeekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: spacing.sm },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  calendarDay: { fontSize: 14, fontWeight: '600' },
});
