import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import {
  getRooms, getAvailableUsers, getOwnerTenants, sendOtp, verifyOtp, registerTenantUser, addTenant,
  type Room,
} from '../../api/owner';

const formatCurrency = (n?: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DAYS = ['S','M','T','W','T','F','S'];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface CalendarModalProps {
  visible: boolean;
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
  t: (key: string) => string;
}

const CalendarModal: React.FC<CalendarModalProps> = ({ visible, value, onSelect, onClose, t }) => {
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
          <Text style={[styles.calendarTitle, { color: colors.text.primary }]}>{t('owner.addTenant.selectDateTitle')}</Text>

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

interface SelectSheetProps {
  visible: boolean;
  title: string;
  options: { key: string; label: string; sub?: string; disabled?: boolean }[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}

const SelectSheet: React.FC<SelectSheetProps> = ({ visible, title, options, selectedKey, onSelect, onClose }) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            {options.map(o => {
              const selected = selectedKey === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  disabled={o.disabled}
                  style={[styles.selectOptionRow, { backgroundColor: colors.background, borderColor: selected ? colors.primary : colors.border }, o.disabled && { opacity: 0.5 }]}
                  onPress={() => { onSelect(o.key); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectLabel, { color: colors.text.primary }]}>{o.label}</Text>
                    {o.sub ? <Text style={[styles.selectSub, { color: colors.text.secondary }]}>{o.sub}</Text> : null}
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const OwnerAddTenantScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  const [roomSheet, setRoomSheet] = useState(false);
  const [userSheet, setUserSheet] = useState(false);

  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [idProof, setIdProof] = useState('');
  const [joinDate, setJoinDate] = useState(today);
  const [joinDatePickerVisible, setJoinDatePickerVisible] = useState(false);
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [notes, setNotes] = useState('');

  const { data: roomsData } = useQuery({ queryKey: ['ownerRooms'], queryFn: () => getRooms(), staleTime: 2 * 60 * 1000 });
  const { data: usersData } = useQuery({
    queryKey: ['ownerAvailableUsers'],
    queryFn: getAvailableUsers,
    staleTime: 60 * 1000,
    enabled: mode === 'existing',
  });
  const { data: tenantsData } = useQuery({
    queryKey: ['ownerTenants'],
    queryFn: () => getOwnerTenants(),
    staleTime: 60 * 1000,
    enabled: mode === 'existing',
  });

  const rooms = roomsData?.rooms ?? [];
  const users = usersData?.users ?? [];

  const selectedRoom = useMemo(() => rooms.find(r => r._id === selectedRoomId) ?? null, [rooms, selectedRoomId]);
  const selectedUser = useMemo(() => users.find(u => u._id === selectedUserId) ?? null, [users, selectedUserId]);

  // Users who already hold an active tenancy can't be moved in again.
  const activeTenantUserIds = useMemo(
    () => new Set((tenantsData?.tenants ?? []).filter(t => t.status === 'active').map(t => t.userId._id)),
    [tenantsData]
  );

  // Security deposit comes straight from the selected room's configuration.
  useEffect(() => {
    if (selectedRoom) {
      setSecurityDeposit(selectedRoom.securityDeposit ? String(selectedRoom.securityDeposit) : '');
    }
  }, [selectedRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendOtpMutation = useMutation({
    mutationFn: sendOtp,
    onSuccess: () => { setOtpSent(true); },
    onError: (err: any) => { if (__DEV__) console.error('OTP send failed', err); },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) => verifyOtp(email, otp),
    onSuccess: (data) => { setVerificationToken(data.verificationToken); },
    onError: (err: any) => { if (__DEV__) console.error('OTP verify failed', err); },
  });

  const registerMutation = useMutation({
    mutationFn: registerTenantUser,
    onSuccess: (res) => { setSelectedUserId(res.user._id); },
    onError: (err: any) => {
      if (__DEV__) console.error('Register failed', err);
      Alert.alert(t('owner.addTenant.alertRegisterTitle'), err?.response?.data?.message || err?.message || t('owner.addTenant.alertRegisterMsg'));
    },
  });

  const addTenantMutation = useMutation({
    mutationFn: addTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerTenants'] });
      qc.invalidateQueries({ queryKey: ['ownerRooms'] });
      Alert.alert(t('owner.addTenant.alertDone'), t('owner.addTenant.alertDoneMsg'));
      router.back();
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.addTenant.alertErr')),
  });

  const roomOptions = rooms
    .filter(r => r.isActive !== false)
    .map(r => {
      const full = (r.currentOccupancy ?? 0) >= r.capacity;
      return {
        key: r._id,
        label: `Room ${r.roomNumber}${r.floor ? ` · Floor ${r.floor}` : ''}`,
        sub: `${formatCurrency(r.monthlyRent)}/mo · ${r.currentOccupancy ?? 0}/${r.capacity} occupied`,
        disabled: full,
      };
    });

  const userOptions = users.map(u => {
    const alreadyActive = activeTenantUserIds.has(u._id);
    return {
      key: u._id,
      label: u.name,
      sub: alreadyActive ? 'Already an active tenant' : u.email,
      disabled: alreadyActive,
    };
  });

  const canSendOtp = newEmail.trim().length > 3;
  const otpVerified = !!verificationToken;

  const canAdd = !!selectedRoom &&
    (mode === 'existing' ? !!selectedUserId : otpVerified) &&
    phone.trim().length >= 7;

  const handleSendOtp = () => { if (canSendOtp) sendOtpMutation.mutate(newEmail.trim()); };
  const handleVerifyOtp = () => { if (otp.trim()) verifyOtpMutation.mutate({ email: newEmail.trim(), otp: otp.trim() }); };

  const handleRegister = () => {
    if (!newName.trim()) return Alert.alert(t('owner.addTenant.alertMissingTitle'), t('owner.addTenant.alertMissingName'));
    if (newName.trim().length < 2) return Alert.alert(t('owner.addTenant.alertInvalidNameTitle'), t('owner.addTenant.alertInvalidNameMsg'));
    if (newPassword.length < 8) return Alert.alert(t('owner.addTenant.alertWeakPwTitle'), t('owner.addTenant.alertWeakPwMin'));
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[@$!%*?&]/.test(newPassword)) {
      return Alert.alert(
        t('owner.addTenant.alertWeakPwTitle'),
        t('owner.addTenant.alertWeakPwChars')
      );
    }
    registerMutation.mutate({
      name: newName.trim(),
      email: newEmail.trim(),
      password: newPassword,
      role: 'tenant',
      verificationToken: verificationToken!,
    });
  };

  const handleSubmit = () => {
    if (!selectedRoom || !selectedUserId) return;
    addTenantMutation.mutate({
      userId: selectedUserId,
      roomId: selectedRoom._id,
      propertyId: typeof selectedRoom.propertyId === 'string' ? selectedRoom.propertyId : selectedRoom.propertyId._id,
      joinDate,
      advancePaid: advancePaid ? parseFloat(advancePaid) : undefined,
      securityDeposit: securityDeposit ? parseFloat(securityDeposit) : undefined,
      notes: notes.trim() || undefined,
      phone: phone.trim(),
      idProof: idProof.trim() || undefined,
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.addTenant.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>{t('owner.addTenant.sub')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          {/* Room */}
          <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.addTenant.sectionRoom')}</Text>
            <TouchableOpacity style={[styles.selectField, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setRoomSheet(true)} activeOpacity={0.7}>
              {selectedRoom ? (
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectValue, { color: colors.text.primary }]}>Room {selectedRoom.roomNumber}</Text>
                  <Text style={[styles.selectHint, { color: colors.text.secondary }]}>
                    {formatCurrency(selectedRoom.monthlyRent)}/mo · {selectedRoom.currentOccupancy ?? 0}/{selectedRoom.capacity} occupied
                  </Text>
                </View>
              ) : (
                 <Text style={[styles.selectPlaceholder, { color: colors.text.tertiary }]}>{t('owner.addTenant.selectRoomPlaceholder')}</Text>
              )}
              <Ionicons name="chevron-down" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
            {selectedRoom && (selectedRoom.currentOccupancy ?? 0) >= selectedRoom.capacity && (
               <Text style={[styles.errText, { color: colors.error }]}>{t('owner.addTenant.errRoomFull')}</Text>
            )}
          </View>

          {/* Tenant source */}
          <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.addTenant.sectionTenant')}</Text>
            <View style={styles.segment}>
              {(['existing', 'new'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.segmentBtn, { backgroundColor: mode === m ? colors.primary : colors.borderLight }]}
                  onPress={() => { setMode(m); }}
                  activeOpacity={0.7}
                >
                 <Text style={[styles.segmentText, { color: mode === m ? '#FFFFFF' : colors.text.secondary }]}>
                   {m === 'existing' ? t('owner.addTenant.segmentExisting') : t('owner.addTenant.segmentNew')}
                 </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'existing' ? (
              <TouchableOpacity style={[styles.selectField, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setUserSheet(true)} activeOpacity={0.7}>
                {selectedUser ? (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectValue, { color: colors.text.primary }]}>{selectedUser.name}</Text>
                    <Text style={[styles.selectHint, { color: colors.text.secondary }]}>{selectedUser.email}</Text>
                  </View>
                ) : (
                  <Text style={[styles.selectPlaceholder, { color: colors.text.tertiary }]}>{t('owner.addTenant.selectUserPlaceholder')}</Text>
                )}
                <Ionicons name="chevron-down" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.formBody}>
                 <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelFullName')}</Text>
                <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={newName} onChangeText={setNewName}                  placeholder={t('owner.addTenant.placeholderName')} placeholderTextColor={colors.text.tertiary} />

                 <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelEmail')}</Text>
                <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={newEmail} onChangeText={setNewEmail}                  placeholder={t('owner.addTenant.placeholderEmail')} placeholderTextColor={colors.text.tertiary} keyboardType="email-address" autoCapitalize="none" />

                {!otpSent && (
                  <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.primary }]} onPress={handleSendOtp} disabled={!canSendOtp || sendOtpMutation.isPending} activeOpacity={0.7}>
                    {sendOtpMutation.isPending ? <ActivityIndicator size="small" color={colors.primary} /> :                      <Text style={[styles.outlineBtnText, { color: colors.primary }]}>{t('owner.addTenant.btnSendOtp')}</Text>}
                  </TouchableOpacity>
                )}
                {otpSent && !otpVerified && (
                  <>
                     <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelOtp')}</Text>
                    <View style={styles.otpRow}>
                       <TextInput style={[styles.input, styles.otpInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder={t('owner.addTenant.placeholderOtp')} placeholderTextColor={colors.text.tertiary} maxLength={6} />
                      <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: otp.trim() ? colors.primary : colors.border }]} onPress={handleVerifyOtp} disabled={!otp.trim() || verifyOtpMutation.isPending} activeOpacity={0.8}>
                        {verifyOtpMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> :                          <Text style={styles.verifyText}>{t('owner.addTenant.btnVerify')}</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {otpVerified && (
                  <View style={[styles.verifiedBox, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                     <Text style={[styles.verifiedText, { color: colors.success }]}>{t('owner.addTenant.verified')}</Text>
                  </View>
                )}
                {otpVerified && (
                  <>
                    <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelPassword')}</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={newPassword} onChangeText={setNewPassword} placeholder="Set a password" placeholderTextColor={colors.text.tertiary} secureTextEntry />
                     <Text style={[styles.passwordHint, { color: colors.text.tertiary }]}>
                       {t('owner.addTenant.passwordHint')}
                     </Text>
                    <TouchableOpacity style={[styles.fullBtn, { backgroundColor: newPassword ? colors.primary : colors.border }]} onPress={handleRegister} disabled={!newPassword || registerMutation.isPending || !!selectedUserId} activeOpacity={0.8}>
                      {registerMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> :                        <Text style={styles.fullBtnText}>{selectedUserId ? t('owner.addTenant.btnAccountCreated') : t('owner.addTenant.btnCreateAccount')}</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Details */}
          <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.addTenant.sectionDetails')}</Text>
            <View style={styles.formBody}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelPhone')}</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={phone} onChangeText={setPhone} keyboardType="phone-pad"                  placeholder={t('owner.addTenant.placeholderPhone')} placeholderTextColor={colors.text.tertiary} />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelIdNumber')}</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={idProof} onChangeText={setIdProof}                  placeholder={t('owner.addTenant.placeholderIdNumber')} placeholderTextColor={colors.text.tertiary} />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelJoinDate')}</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateField, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setJoinDatePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: joinDate ? colors.text.primary : colors.text.tertiary, fontSize: 15 }}>
                  {joinDate ? joinDate : t('owner.addTenant.placeholderJoinDate')}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelSecurityDeposit')}</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={securityDeposit} onChangeText={setSecurityDeposit} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.tertiary} />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelAdvancePaid')}</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={advancePaid} onChangeText={setAdvancePaid} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.tertiary} />

              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.addTenant.labelNotes')}</Text>
              <TextInput style={[styles.input, styles.inputMultiline, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={notes} onChangeText={setNotes} multiline numberOfLines={3}                  placeholder={t('owner.addTenant.placeholderNotes')} placeholderTextColor={colors.text.tertiary} maxLength={500} />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canAdd && !addTenantMutation.isPending ? colors.primary : colors.border }]}
            onPress={handleSubmit}
            disabled={!canAdd || addTenantMutation.isPending}
            activeOpacity={0.8}
          >
            {addTenantMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> :              <Text style={styles.submitText}>{t('owner.addTenant.btnSubmit')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={roomSheet}
        title={t('owner.addTenant.selectRoomTitle')}
        options={roomOptions}
        selectedKey={selectedRoomId}
        onSelect={setSelectedRoomId}
        onClose={() => setRoomSheet(false)}
      />
      <SelectSheet
        visible={userSheet}
        title={t('owner.addTenant.selectUserTitle')}
        options={userOptions}
        selectedKey={selectedUserId}
        onSelect={setSelectedUserId}
        onClose={() => setUserSheet(false)}
      />

      <CalendarModal
        visible={joinDatePickerVisible}
        value={joinDate}
        onSelect={setJoinDate}
        onClose={() => setJoinDatePickerVisible(false)}
        t={t}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  section: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  selectField: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.lg,
  },
  selectValue: { fontSize: 15, fontWeight: '600' },
  selectHint: { fontSize: 12, marginTop: 2 },
  selectPlaceholder: { fontSize: 14, flex: 1 },
  segment: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: radius.lg, padding: 4 },
  segmentBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },
  formBody: { gap: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.xs },
  passwordHint: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15 },
  inputMultiline: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  dateField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  outlineBtn: { borderWidth: 1, borderRadius: radius.lg, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  outlineBtnText: { fontSize: 14, fontWeight: '700' },
  otpRow: { flexDirection: 'row', gap: spacing.sm },
  otpInput: { flex: 1 },
  verifyBtn: { height: 46, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  verifyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  verifiedBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
  verifiedText: { fontSize: 13, fontWeight: '600' },
  fullBtn: { height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  fullBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  errText: { fontSize: 12, color: '#EF4444', marginTop: spacing.xs },
  footer: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: { height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xxl, paddingBottom: spacing.xxxl + spacing.xxl },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.lg },
  selectOptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  selectLabel: { fontSize: 15, fontWeight: '600' },
  selectSub: { fontSize: 12, marginTop: 2 },

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