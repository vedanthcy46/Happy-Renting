import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { KeyboardSafeModal } from '../../components';
import { useRouter } from 'expo-router';
import {
  getProperties,
  getRooms,
  createProperty,
  updateProperty,
  deleteProperty,
  type Property,
  type Room,
} from '../../api/owner';

// ─── Property form modal ───────────────────────────────────────────────────

interface PropertyFormModalProps {
  visible: boolean;
  initial?: Property | null;
  onClose: () => void;
  onSave: (payload: { name: string; address: string; city: string }) => void;
  saving: boolean;
  t: (key: string) => string;
}

const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  visible, initial, onClose, onSave, saving, t
}) => {
  const { colors } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');

  // Sync fields when editing a different property
  React.useEffect(() => {
    setName(initial?.name ?? '');
    setAddress(initial?.address ?? '');
    setCity(initial?.city ?? '');
  }, [initial]);

  const isValid = name.trim().length >= 2 && address.trim().length >= 5;

  return (
    <KeyboardSafeModal
      visible={visible}
      animationType="slide"
      overlayStyle={styles.modalOverlay}
      onRequestClose={onClose}
    >
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
              {initial ? t('owner.properties.editTitle') : t('owner.properties.addTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
          >
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.properties.fieldName')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={name}
              onChangeText={setName}
              placeholder={t('owner.properties.placeholderName')}
              placeholderTextColor={colors.text.tertiary}
              maxLength={100}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.properties.fieldAddress')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t('owner.properties.placeholderAddress')}
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.properties.fieldCity')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={city}
              onChangeText={setCity}
              placeholder={t('owner.properties.placeholderCity')}
              placeholderTextColor={colors.text.tertiary}
              maxLength={60}
            />
          </View>
          </ScrollView>

          <View style={styles.modalActions}>
             <TouchableOpacity
               style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.border }]}
               onPress={onClose}
               activeOpacity={0.7}
             >
               <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.properties.cancel')}</Text>
             </TouchableOpacity>
             <TouchableOpacity
               style={[styles.modalBtn, styles.modalBtnSave, { backgroundColor: isValid ? colors.primary : colors.border }]}
               onPress={() => isValid && onSave({ name: name.trim(), address: address.trim(), city: city.trim() })}
               activeOpacity={0.8}
               disabled={!isValid || saving}
             >
               {saving ? (
                 <ActivityIndicator color="#FFFFFF" size="small" />
               ) : (
                 <Text style={styles.modalBtnSaveText}>{initial ? t('owner.properties.save') : t('owner.properties.saveAdd')}</Text>
               )}
             </TouchableOpacity>
          </View>
        </View>
    </KeyboardSafeModal>
  );
};

// ─── Property card ─────────────────────────────────────────────────────────

interface PropertyCardProps {
  property: Property;
  rooms: Room[];
  onEdit: () => void;
  onToggleActive: () => void;
  onManageRooms: () => void;
  t: (key: string) => string;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, rooms, onEdit, onToggleActive, onManageRooms, t }) => {
  const { colors } = useTheme();
  const inactive = property.isActive === false;
  const propertyRooms = rooms.filter(r =>
    typeof r.propertyId === 'string'
      ? r.propertyId === property._id
      : r.propertyId._id === property._id
  );
  const totalRooms = propertyRooms.length;
  const occupiedRooms = propertyRooms.filter(r => r.currentOccupancy > 0).length;
  const vacantRooms = totalRooms - occupiedRooms;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return (
    <View
      style={[
        styles.propertyCard,
        { backgroundColor: colors.surface },
        shadows.sm,
        inactive && { opacity: 0.72, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
      ]}
    >
      {/* Card header */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={inactive ? undefined : onManageRooms}
        activeOpacity={0.7}
        disabled={inactive}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: inactive ? colors.borderLight : colors.primaryLight }]}>
          <Ionicons name={inactive ? 'lock-closed' : 'business'} size={20} color={inactive ? colors.text.tertiary : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardNameRow}>
            <Text style={[styles.cardName, { color: colors.text.primary }]} numberOfLines={1}>
              {property.name}
            </Text>
            {inactive && (
              <View style={[styles.inactiveBadge, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.inactiveBadgeText, { color: colors.error }]}>{t('owner.properties.inactive')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardAddress, { color: colors.text.secondary }]} numberOfLines={2}>
            {property.address}{property.city ? `, ${property.city}` : ''}
          </Text>
        </View>
        <View style={styles.cardActions}>
          {!inactive && (
            <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onToggleActive} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            {inactive ? (
              <Ionicons name="refresh" size={20} color={colors.success} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Room stats row */}
      {totalRooms > 0 && (
        <>
          <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.roomStats}>
            <View style={styles.roomStatItem}>
              <Text style={[styles.roomStatValue, { color: colors.text.primary }]}>{totalRooms}</Text>
              <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>{t('owner.properties.statsTotal')}</Text>
            </View>
            <View style={[styles.roomStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.roomStatItem}>
              <Text style={[styles.roomStatValue, { color: colors.success }]}>{occupiedRooms}</Text>
               <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>{t('owner.properties.statsOccupied')}</Text>
            </View>
            <View style={[styles.roomStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.roomStatItem}>
              <Text style={[styles.roomStatValue, { color: colors.warning }]}>{vacantRooms}</Text>
               <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>{t('owner.properties.statsVacant')}</Text>
            </View>
            <View style={[styles.roomStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.roomStatItem}>
              <Text style={[styles.roomStatValue, { color: colors.primary }]}>{occupancyPct}%</Text>
               <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>{t('owner.properties.statsOccupancy')}</Text>
            </View>
          </View>
        </>
      )}

      {totalRooms === 0 && !inactive && (
        <View style={[styles.noRoomsBanner, { backgroundColor: colors.borderLight }]}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.tertiary} />
          <Text style={[styles.noRoomsText, { color: colors.text.tertiary }]}>
            {t('owner.properties.noRooms')}
          </Text>
        </View>
      )}
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────

export const OwnerPropertiesScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const router = useRouter();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const { data: propData, isLoading: loadingProps, refetch: refetchProps } = useQuery({
    queryKey: ['ownerProperties'],
    queryFn: getProperties,
    staleTime: 5 * 60 * 1000,
  });

  const { data: roomsData, isLoading: loadingRooms, refetch: refetchRooms } = useQuery({
    queryKey: ['ownerRooms'],
    queryFn: () => getRooms(),
    staleTime: 5 * 60 * 1000,
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchProps(), refetchRooms()]);
  }, [refetchProps, refetchRooms]);

  const properties = propData?.properties ?? [];
  const rooms = roomsData?.rooms ?? [];
  const isLoading = loadingProps || loadingRooms;

  const createMutation = useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerProperties'] });
      setModalVisible(false);
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.properties.errCreate')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateProperty(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerProperties'] });
      setModalVisible(false);
      setEditingProperty(null);
    },
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.properties.errUpdate')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ownerProperties'] }),
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('owner.properties.errRemove')),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => updateProperty(id, { isActive: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ownerProperties'] }),
    onError: (err: any) =>
      Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('owner.properties.errReactivate')),
  });

  const handleSave = (payload: { name: string; address: string; city: string }) => {
    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleActive = (property: Property) => {
    if (property.isActive !== false) {
      Alert.alert(
        t('owner.properties.deactivateTitle'),
        t('owner.properties.deactivateMsg', { name: property.name }),
        [
          { text: t('owner.properties.cancel'), style: 'cancel' },
          {
            text: t('owner.properties.deactivate'),
            style: 'destructive',
            onPress: () => deleteMutation.mutate(property._id),
          },
        ]
      );
    } else {
      activateMutation.mutate(property._id);
    }
  };

  const openAdd = () => {
    setEditingProperty(null);
    setModalVisible(true);
  };

  const openEdit = (p: Property) => {
    setEditingProperty(p);
    setModalVisible(true);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.properties.title')}</Text>
          {!isLoading && (
            <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
              {t(properties.length === 1 ? 'owner.properties.count_one' : 'owner.properties.count_other', { count: properties.length })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openAdd}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>{t('owner.properties.addBtn')}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>{t('owner.properties.loading')}</Text>
        </View>
      ) : properties.length === 0 ? (
        <View style={styles.emptyCenter}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="business-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{t('owner.properties.emptyTitle')}</Text>
          <Text style={[styles.emptyBody, { color: colors.text.secondary }]}>
            {t('owner.properties.emptyBody')}
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={openAdd}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
             <Text style={styles.emptyBtnText}>{t('owner.properties.saveAdd')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {properties.map(p => (
            <PropertyCard
              key={p._id}
              property={p}
              rooms={rooms}
              onEdit={() => openEdit(p)}
              onToggleActive={() => handleToggleActive(p)}
              onManageRooms={() => router.push({ pathname: '/owner/rooms/[propertyId]', params: { propertyId: p._id } } as any)}
              t={t}
            />
          ))}
        </ScrollView>
      )}

      <PropertyFormModal
        visible={modalVisible}
        initial={editingProperty}
        onClose={() => { setModalVisible(false); setEditingProperty(null); }}
        onSave={handleSave}
        saving={isSaving}
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  scroll: { padding: spacing.xl, gap: spacing.md },

  // Property card
  propertyCard: { borderRadius: radius.xl, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardIconWrap: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  inactiveBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  inactiveBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardAddress: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  cardActions: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  cardDivider: { height: 1, marginVertical: spacing.md },
  roomStats: { flexDirection: 'row', alignItems: 'center' },
  roomStatItem: { flex: 1, alignItems: 'center' },
  roomStatValue: { fontSize: 16, fontWeight: '700' },
  roomStatLabel: { fontSize: 11, marginTop: 2 },
  roomStatDivider: { width: 1, height: 28 },
  noRoomsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  noRoomsText: { fontSize: 12, flex: 1 },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    paddingBottom: spacing.xxxl + spacing.xxl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
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
  modalBtnCancel: { borderWidth: 1 },
  modalBtnSave: {},
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  modalBtnSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // States
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: 14 },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.huge, gap: spacing.lg },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.full, marginTop: spacing.sm },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
