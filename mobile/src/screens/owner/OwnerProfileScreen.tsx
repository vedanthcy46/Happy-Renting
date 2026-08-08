import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Image, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { useAuthStore } from '../../store/useAuthStore';
import { getProfile, updateProfile } from '../../api/user';
import { uploadQrCode } from '../../api/owner';
import { getInitials } from '../../utils';

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.text.tertiary}
        autoCapitalize="none"
      />
    </View>
  );
};

export const OwnerProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setAuth, token, logout } = useAuthStore();

  const [profile, setProfile] = useState<any>(user);
  const [loading, setLoading] = useState(true);
  const [savingUpi, setSavingUpi] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  const [upi, setUpi] = useState({ upiId: '', upiName: '', upiNumber: '' });
  const [bank, setBank] = useState({ bankAccountHolder: '', bankAccountNumber: '', bankName: '', ifsc: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getProfile();
        if (res.success) {
          setProfile(res.user);
          const p: any = res.user;
          setUpi({
            upiId: p?.upiId ?? '',
            upiName: p?.upiDetails?.upiName ?? '',
            upiNumber: p?.upiNumber ?? '',
          });
          setBank({
            bankAccountHolder: p?.bankDetails?.accountHolder ?? '',
            bankAccountNumber: p?.bankDetails?.accountNumber ?? '',
            bankName: p?.bankDetails?.bankName ?? '',
            ifsc: p?.bankDetails?.ifscCode ?? '',
          });
        }
      } catch (e) {
        if (__DEV__) console.error('Failed to load profile', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const qrUrl = profile?.qrCodeImage?.secureUrl;

  const saveUpi = async () => {
    setSavingUpi(true);
    try {
      const res = await updateProfile({
        upiDetails: { upiId: upi.upiId, upiName: upi.upiName },
        upiNumber: upi.upiNumber,
      } as any);
      if (res.success) {
        const p: any = res.user;
        setProfile(res.user);
        setUpi({
          upiId: p?.upiId ?? '',
          upiName: p?.upiDetails?.upiName ?? '',
          upiNumber: p?.upiNumber ?? '',
        });
        Alert.alert(t('owner.profile.alertSavedTitle'), t('owner.profile.alertSavedUpiMsg'));
      }
    } catch (e: any) {
      Alert.alert(t('owner.commonOwner.error'), e?.response?.data?.message || t('owner.profile.alertErrUpi'));
    } finally {
      setSavingUpi(false);
    }
  };

  const saveBank = async () => {
    setSavingBank(true);
    try {
      const res = await updateProfile({
        bankDetails: {
          accountHolder: bank.bankAccountHolder,
          accountNumber: bank.bankAccountNumber,
          bankName: bank.bankName,
          ifscCode: bank.ifsc,
        },
      } as any);
      if (res.success) {
        const p: any = res.user;
        setProfile(res.user);
        setBank({
          bankAccountHolder: p?.bankDetails?.accountHolder ?? '',
          bankAccountNumber: p?.bankDetails?.accountNumber ?? '',
          bankName: p?.bankDetails?.bankName ?? '',
          ifsc: p?.bankDetails?.ifscCode ?? '',
        });
        Alert.alert(t('owner.profile.alertSavedTitle'), t('owner.profile.alertSavedBankMsg'));
      }
    } catch (e: any) {
      Alert.alert(t('owner.commonOwner.error'), e?.response?.data?.message || t('owner.profile.alertErrBank'));
    } finally {
      setSavingBank(false);
    }
  };

  const uploadQr = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('owner.profile.alertPermissionTitle'), t('owner.profile.alertPermissionMsg')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, quality: 0.9 });
    if (res.canceled) return;
    setUploadingQr(true);
    try {
      await uploadQrCode(res.assets[0].uri);
      const fresh = await getProfile();
      if (fresh.success) setProfile(fresh.user);
      Alert.alert(t('owner.profile.alertQrTitle'), t('owner.profile.alertQrMsg'));
    } catch (e: any) {
      Alert.alert(t('owner.commonOwner.error'), e?.response?.data?.message || t('owner.profile.alertErrQr'));
    } finally {
      setUploadingQr(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.profile.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>{t('owner.profile.sub')}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials(user?.name || '')}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text.primary }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: colors.text.secondary }]}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="business" size={12} color={colors.primary} />
             <Text style={[styles.roleText, { color: colors.primary }]}>{t('owner.profile.roleBadge')}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xxl }} />
        ) : (
          <>
            {/* QR code */}
            <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="qr-code-outline" size={18} color={colors.text.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.profile.sectionQr')}</Text>
              </View>
               <Text style={[styles.sectionSub, { color: colors.text.secondary }]}>
                 {t('owner.profile.qrSub')}
               </Text>
              {qrUrl ? (
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
              ) : (
                <View style={[styles.qrPlaceholder, { backgroundColor: colors.borderLight }]}>
                  <Ionicons name="qr-code-outline" size={40} color={colors.text.tertiary} />
                   <Text style={[styles.qrPlaceholderText, { color: colors.text.tertiary }]}>{t('owner.profile.qrPlaceholder')}</Text>
                </View>
              )}
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.primary }]} onPress={uploadQr} disabled={uploadingQr} activeOpacity={0.7}>
                {uploadingQr ? <ActivityIndicator size="small" color={colors.primary} /> :                  <Text style={[styles.outlineBtnText, { color: colors.primary }]}>{t('owner.profile.btnUploadQr')}</Text>}
              </TouchableOpacity>
            </View>

            {/* UPI */}
            <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.text.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.profile.sectionUpi')}</Text>
              </View>
              <Field label={t('owner.profile.fieldUpiId')} value={upi.upiId} onChange={(t) => setUpi({ ...upi, upiId: t })} />
              <Field label={t('owner.profile.fieldUpiName')} value={upi.upiName} onChange={(t) => setUpi({ ...upi, upiName: t })} />
              <Field label={t('owner.profile.fieldUpiNumber')} value={upi.upiNumber} onChange={(t) => setUpi({ ...upi, upiNumber: t })} />
               <TouchableOpacity style={[styles.fullBtn, { backgroundColor: colors.primary }]} onPress={saveUpi} disabled={savingUpi} activeOpacity={0.8}>
                 {savingUpi ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.fullBtnText}>{t('owner.profile.btnSaveUpi')}</Text>}
               </TouchableOpacity>
            </View>

            {/* Bank */}
            <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="business-outline" size={18} color={colors.text.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.profile.sectionBank')}</Text>
              </View>
               <Text style={[styles.sectionSub, { color: colors.text.secondary }]}>
                 {t('owner.profile.bankSub')}
               </Text>
              <Field label={t('owner.profile.fieldAccountHolder')} value={bank.bankAccountHolder} onChange={(t) => setBank({ ...bank, bankAccountHolder: t })} />
              <Field label={t('owner.profile.fieldAccountNumber')} value={bank.bankAccountNumber} onChange={(t) => setBank({ ...bank, bankAccountNumber: t })} />
              <Field label={t('owner.profile.fieldBankName')} value={bank.bankName} onChange={(t) => setBank({ ...bank, bankName: t })} />
              <Field label={t('owner.profile.fieldIfsc')} value={bank.ifsc} onChange={(t) => setBank({ ...bank, ifsc: t })} />
               <TouchableOpacity style={[styles.fullBtn, { backgroundColor: colors.primary }]} onPress={saveBank} disabled={savingBank} activeOpacity={0.8}>
                 {savingBank ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.fullBtnText}>{t('owner.profile.btnSaveBank')}</Text>}
               </TouchableOpacity>
            </View>

            {/* Account */}
            <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person-outline" size={18} color={colors.text.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.profile.sectionAccount')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.logoutBtn, { backgroundColor: colors.errorLight }]}
                 onPress={() => Alert.alert(t('owner.profile.btnSignOut'), t('drawer.logoutConfirmMsg'), [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/login' as any); } },
                ])}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
                 <Text style={[styles.logoutText, { color: colors.error }]}>{t('owner.profile.btnSignOut')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
  avatarSection: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 13 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, marginTop: spacing.xs },
  roleText: { fontSize: 12, fontWeight: '600' },
  section: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSub: { fontSize: 12, color: '#64748B', marginTop: -spacing.sm },
  qrImage: { width: 160, height: 160, alignSelf: 'center' },
  qrPlaceholder: { width: 160, height: 160, borderRadius: radius.lg, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  qrPlaceholderText: { fontSize: 12 },
  outlineBtn: { borderWidth: 1, borderRadius: radius.lg, height: 46, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontSize: 14, fontWeight: '700' },
  fullBtn: { height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  fullBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  field: { gap: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, height: 48 },
  logoutText: { fontSize: 15, fontWeight: '700' },
});