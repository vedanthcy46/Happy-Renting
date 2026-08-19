import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { WorkspaceSwitcher } from '../../components/WorkspaceSwitcher';
import { KeyboardSafeModal } from '../../components';
import {
  getRooms, getProperties, getOwnerTenants, updateBedStatus, createRoom, updateRoom, deleteRoom,
  type Room, type Bed, type BedStatus,
} from '../../api/owner';

interface BedDraft {
  key: string;
  bedNumber: string;
  deposit: string;
  monthlyRent: string;
}

interface PgRoomFormModalProps {
  visible: boolean;
  initial?: Room | null;
  propertyId: string;
  onClose: () => void;
  onSave: (payload: any) => void;
  saving: boolean;
}

const PgRoomFormModal: React.FC<PgRoomFormModalProps> = ({ visible, initial, propertyId, onClose, onSave, saving }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [roomNumber, setRoomNumber] = useState(initial?.roomNumber ?? '');
  const [floor, setFloor] = useState(initial?.floor ?? '');
  const [monthlyRent, setMonthlyRent] = useState(initial ? String(initial.monthlyRent ?? '') : '');
  const [securityDeposit, setSecurityDeposit] = useState(initial ? String(initial.securityDeposit ?? '') : '');
  const [description, setDescription] = useState('');
  const [beds, setBeds] = useState<BedDraft[]>([]);
  const [seedKey, setSeedKey] = useState(0);

  React.useEffect(() => {
    if (visible) {
      setRoomNumber(initial?.roomNumber ?? '');
      setFloor(initial?.floor ?? '');
      setMonthlyRent(initial ? String(initial.monthlyRent ?? '') : '');
      setSecurityDeposit(initial ? String(initial.securityDeposit ?? '') : '');
      setDescription('');
      const existing = (initial?.beds ?? []).map(b => ({
        key: b._id || b.bedNumber,
        bedNumber: b.bedNumber,
        deposit: b.deposit ? String(b.deposit) : '',
        monthlyRent: b.monthlyRent ? String(b.monthlyRent) : '',
      }));
      const seeded = existing.length > 0
        ? existing
        : [{ key: `new-${Date.now()}`, bedNumber: 'Bed 1', deposit: '', monthlyRent: '' }];
      setBeds(seeded);
      setSeedKey(k => k + 1);
    }
  }, [visible, initial]);

  const rentNum = parseFloat(monthlyRent);
  const depositNum = parseFloat(securityDeposit);
  const rentValid = monthlyRent === '' ? true : !isNaN(rentNum) && rentNum >= 0;
  const depositValid = securityDeposit === '' ? true : !isNaN(depositNum) && depositNum >= 0;
  const bedsValid = beds.length > 0 && beds.every(b => b.bedNumber.trim().length > 0);
  const isValid = roomNumber.trim().length > 0 && rentValid && depositValid && bedsValid;

  const setBedField = (key: string, field: 'bedNumber' | 'deposit' | 'monthlyRent', value: string) => {
    setBeds(prev => prev.map(b => (b.key === key ? { ...b, [field]: value } : b)));
  };

  const addBed = () => {
    setBeds(prev => [...prev, {
      key: `new-${Date.now()}`,
      bedNumber: `Bed ${prev.length + 1}`,
      deposit: '',
      monthlyRent: '',
    }]);
  };

  const removeBed = (key: string) => setBeds(prev => prev.filter(b => b.key !== key));

  const save = () => {
    onSave({
      roomNumber: roomNumber.trim(),
      propertyId,
      capacity: beds.length,
      floor: floor.trim() || undefined,
      monthlyRent: monthlyRent === '' ? undefined : rentNum,
      securityDeposit: securityDeposit === '' ? undefined : depositNum,
      description: description.trim() || undefined,
      type: 'pg',
      beds: beds.filter(b => b.bedNumber.trim()).map(b => ({
        bedNumber: b.bedNumber.trim(),
        deposit: b.deposit ? parseFloat(b.deposit) : undefined,
        monthlyRent: b.monthlyRent ? parseFloat(b.monthlyRent) : undefined,
      })),
    });
  };

  return (
    <KeyboardSafeModal
      visible={visible}
      animationType="slide"
      overlayStyle={[styles.modalOverlay, { paddingBottom: insets.bottom + 64 }]}
      onRequestClose={onClose}
    >
      <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
            {initial ? t('pg.rooms.editTitle') : t('pg.rooms.addTitle')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1, maxHeight: 460 }}>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldRoomNumber')}</Text>
            <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={roomNumber} onChangeText={setRoomNumber} placeholder="e.g. 101" placeholderTextColor={colors.text.tertiary} maxLength={30} />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldFloor')}</Text>
            <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={floor} onChangeText={setFloor} placeholder="e.g. Ground" placeholderTextColor={colors.text.tertiary} maxLength={30} />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldBeds')}</Text>
            <View style={{ gap: spacing.sm }}>
              {beds.map((b, i) => (
                <View key={`${seedKey}-${b.key}`} style={[styles.bedRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <TextInput
                    style={[styles.input, styles.bedNumberInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={b.bedNumber}
                    onChangeText={v => setBedField(b.key, 'bedNumber', v)}
                    placeholder={t('owner.rooms.bedNumberPlaceholder', { index: i + 1 })}
                    placeholderTextColor={colors.text.tertiary}
                    maxLength={20}
                  />
                  <TextInput
                    style={[styles.input, styles.bedMoneyInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={b.deposit}
                    onChangeText={v => setBedField(b.key, 'deposit', v)}
                    keyboardType="numeric"
                    placeholder={t('owner.rooms.bedDepositPlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <TextInput
                    style={[styles.input, styles.bedMoneyInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={b.monthlyRent}
                    onChangeText={v => setBedField(b.key, 'monthlyRent', v)}
                    keyboardType="numeric"
                    placeholder={t('owner.rooms.bedRentPlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <TouchableOpacity onPress={() => removeBed(b.key)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} disabled={beds.length <= 1}>
                    <Ionicons name="close-circle" size={20} color={beds.length <= 1 ? colors.border : colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={addBed} style={[styles.addBedBtn, { borderColor: colors.primary }]} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.addBedText, { color: colors.primary }]}>{t('owner.rooms.addBed')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldMonthlyRent')}</Text>
            <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={monthlyRent} onChangeText={setMonthlyRent} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.tertiary} />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldSecurityDeposit')}</Text>
            <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={securityDeposit} onChangeText={setSecurityDeposit} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.tertiary} />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldDescription')}</Text>
            <TextInput style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={description} onChangeText={setDescription} placeholder="Optional notes" placeholderTextColor={colors.text.tertiary} multiline numberOfLines={2} maxLength={200} />
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('pg.rooms.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalBtn, { backgroundColor: isValid ? colors.primary : colors.border }]} onPress={save} activeOpacity={0.8} disabled={!isValid || saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalBtnSaveText}>{initial ? t('pg.rooms.saveChanges') : t('pg.rooms.saveAdd')}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardSafeModal>
  );
};

const statusBg = (s: BedStatus) => {
  switch (s) {
    case 'occupied': return '#16A34A';
    case 'reserved': return '#F59E0B';
    case 'maintenance': return '#EF4444';
    default: return '#94A3B8';
  }
};

export const PGRoomsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const { data: propertiesData } = useQuery({ queryKey: ['ownerProperties'], queryFn: getProperties, staleTime: 5 * 60 * 1000 });
  const { data: roomsData, isLoading, refetch } = useQuery({
    queryKey: ['ownerRooms', selectedPropertyId ?? 'all'],
    queryFn: () => getRooms(selectedPropertyId ?? undefined),
    staleTime: 2 * 60 * 1000,
  });
  const { data: tenantsData } = useQuery({
    queryKey: ['ownerTenants', 'active'],
    queryFn: () => getOwnerTenants({ status: 'active' }),
    staleTime: 2 * 60 * 1000,
  });

  const properties = propertiesData?.properties ?? [];
  const pgRooms = (roomsData?.rooms ?? []).filter(r => r.type === 'pg');

  const residentByBedId = useMemo(() => {
    const map = new Map<string, string>();
    for (const tn of tenantsData?.tenants ?? []) {
      if (tn.bedId && tn.userId?.name) map.set(tn.bedId, tn.userId.name);
    }
    return map;
  }, [tenantsData]);

  const bedMutation = useMutation({
    mutationFn: ({ roomId, bedId, status }: { roomId: string; bedId: string; status: Exclude<BedStatus, 'occupied'> }) =>
      updateBedStatus(roomId, bedId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ownerRooms'] }),
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('owner.rooms.errUpdate')),
  });

  const onBedPress = (room: Room, bed: Bed) => {
    if (bed.status === 'occupied') {
      const resident = residentByBedId.get(bed._id);
      Alert.alert(
        bed.bedNumber,
        resident
          ? t('pg.rooms.occupiedResident', { name: resident })
          : t('pg.rooms.occupiedHint'),
        [
          { text: t('pg.rooms.cancel'), style: 'cancel' },
          { text: t('pg.rooms.viewResident'), onPress: () => router.push('/(pg-tabs)/residents' as any) },
        ]
      );
      return;
    }
    Alert.alert(
      bed.bedNumber,
      '',
      [
        { text: t('pg.rooms.markAvailable'), onPress: () => bedMutation.mutate({ roomId: room._id, bedId: bed._id, status: 'available' }) },
        { text: t('pg.rooms.markReserved'), onPress: () => bedMutation.mutate({ roomId: room._id, bedId: bed._id, status: 'reserved' }) },
        { text: t('pg.rooms.markMaintenance'), onPress: () => bedMutation.mutate({ roomId: room._id, bedId: bed._id, status: 'maintenance' }) },
        { text: t('pg.rooms.cancel'), style: 'cancel' },
      ]
    );
  };

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerRooms'] });
      setModalVisible(false);
      setEditingRoom(null);
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('pg.rooms.errCreate')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateRoom(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerRooms'] });
      setModalVisible(false);
      setEditingRoom(null);
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('pg.rooms.errUpdate')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ownerRooms'] }),
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('pg.rooms.errRemove')),
  });

  const handleSave = (payload: any) => {
    if (editingRoom) updateMutation.mutate({ id: editingRoom._id, payload });
    else createMutation.mutate(payload);
  };

  const handleDelete = (room: Room) => {
    if ((room.currentOccupancy ?? 0) > 0 || (room.occupiedBeds ?? 0) > 0) {
      Alert.alert(t('pg.rooms.occupiedTitle'), t('pg.rooms.occupiedMsg', { count: Math.max(room.currentOccupancy ?? 0, room.occupiedBeds ?? 0) }));
      return;
    }
    Alert.alert(
      t('pg.rooms.removeTitle'),
      t('pg.rooms.removeMsg', { number: room.roomNumber }),
      [
        { text: t('pg.rooms.cancel'), style: 'cancel' },
        { text: t('owner.commonOwner.remove'), style: 'destructive', onPress: () => deleteMutation.mutate(room._id) },
      ]
    );
  };

  const openAdd = () => {
    if (!selectedPropertyId) {
      Alert.alert(t('pg.rooms.selectPropertyTitle'), t('pg.rooms.selectPropertyMsg'));
      return;
    }
    setEditingRoom(null);
    setModalVisible(true);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const grouped = useMemo(() => {
    const groups = new Map<string, Room[]>();
    for (const r of pgRooms) {
      const key = r.floor || t('pg.rooms.noFloor');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries());
  }, [pgRooms, t]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#0D9488', '#0F766E']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('pg.rooms.title')}</Text>
          <Text style={styles.headerSub}>{t('pg.rooms.sub')}</Text>
          <View style={styles.headerChipWrap}>
            <WorkspaceSwitcher variant="chip" />
          </View>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={openAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyChips}>
          <TouchableOpacity
            style={[styles.propertyChip, { backgroundColor: !selectedPropertyId ? colors.primary : colors.surface, borderColor: !selectedPropertyId ? colors.primary : colors.border }]}
            onPress={() => setSelectedPropertyId(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.propertyChipText, { color: !selectedPropertyId ? '#FFFFFF' : colors.text.secondary }]}>
              {t('pg.dashboard.allProperties')}
            </Text>
          </TouchableOpacity>
          {properties.map(p => (
            <TouchableOpacity
              key={p._id}
              style={[styles.propertyChip, { backgroundColor: selectedPropertyId === p._id ? colors.primary : colors.surface, borderColor: selectedPropertyId === p._id ? colors.primary : colors.border }]}
              onPress={() => setSelectedPropertyId(selectedPropertyId === p._id ? null : p._id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.propertyChipText, { color: selectedPropertyId === p._id ? '#FFFFFF' : colors.text.secondary }]} numberOfLines={1}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : pgRooms.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="bed-outline" size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('pg.rooms.emptyTitle')}</Text>
            <Text style={[styles.emptySub, { color: colors.text.tertiary }]}>{t('pg.rooms.emptySub')}</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(owner-tabs)/properties' as any)} activeOpacity={0.8}>
              <Text style={styles.emptyBtnText}>{t('pg.rooms.goToProperties')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          grouped.map(([floor, rooms]) => (
            <View key={floor}>
              <Text style={[styles.floorLabel, { color: colors.text.secondary }]}>{floor}</Text>
              <View style={{ gap: spacing.md }}>
                {rooms.map(room => {
                  const beds = room.beds ?? [];
                  const occupied = beds.filter(b => b.status === 'occupied').length;
                  const total = room.totalBeds ?? beds.length;
                  const isFull = total > 0 && occupied >= total;
                  return (
                    <View key={room._id} style={[styles.roomCard, { backgroundColor: colors.surface }, shadows.sm]}>
                      <View style={styles.roomHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.roomName, { color: colors.text.primary }]}>Room {room.roomNumber}</Text>
                          <Text style={[styles.roomMeta, { color: colors.text.secondary }]}>
                            {t('pg.rooms.occupancy', { occupied, total })}
                          </Text>
                        </View>
                        <View style={styles.roomActions}>
                          <TouchableOpacity onPress={() => { setEditingRoom(room); setModalVisible(true); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Ionicons name="create-outline" size={19} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(room)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Ionicons name="trash-outline" size={19} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                        <View style={[styles.badge, { backgroundColor: isFull ? colors.successLight : occupied > 0 ? colors.warningLight : colors.borderLight }]}>
                          <Text style={[styles.badgeText, { color: isFull ? colors.success : occupied > 0 ? colors.warning : colors.text.secondary }]}>
                            {isFull ? t('pg.rooms.full') : occupied > 0 ? t('pg.rooms.partial') : t('pg.rooms.vacant')}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
                      {beds.map(bed => {
                        const c = statusBg(bed.status);
                        const resident = residentByBedId.get(bed._id);
                        const label = bed.status === 'occupied'
                          ? (resident ?? t('pg.rooms.occupiedHint'))
                          : bed.status === 'reserved'
                            ? t('pg.rooms.markReserved')
                            : bed.status === 'maintenance'
                              ? t('pg.rooms.markMaintenance')
                              : t('owner.rooms.bedStatusAvailable');
                        return (
                          <TouchableOpacity
                            key={bed._id}
                            style={styles.bedRow}
                            onPress={() => onBedPress(room, bed)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.statusDot, { backgroundColor: c }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.bedNumber, { color: colors.text.primary }]}>{bed.bedNumber}</Text>
                              <Text style={[styles.bedResident, { color: bed.status === 'occupied' ? colors.text.primary : colors.text.tertiary }]}>
                                {label}
                              </Text>
                            </View>
                            {bed.status === 'occupied' && (
                              <View style={[styles.bedStatusChip, { backgroundColor: colors.successLight }]}>
                                <Text style={[styles.bedStatusText, { color: colors.success }]}>{t('pg.rooms.bedOccupied')}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <PgRoomFormModal
        visible={modalVisible}
        initial={editingRoom}
        propertyId={selectedPropertyId ?? ''}
        onClose={() => { setModalVisible(false); setEditingRoom(null); }}
        onSave={handleSave}
        saving={isSaving}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
  },
  headerCenter: { flex: 1, alignItems: 'center', marginTop: -2 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },
  headerChipWrap: { marginTop: spacing.sm },
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  propertyChips: { gap: spacing.sm, paddingVertical: 2 },
  propertyChip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 14 },
  propertyChipText: { fontSize: 13, fontWeight: '600', maxWidth: 160 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 48, paddingHorizontal: spacing.huge },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.full, marginTop: spacing.sm },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  floorLabel: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  roomCard: { borderRadius: radius.xl, padding: spacing.lg },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  roomActions: { flexDirection: 'row', gap: spacing.md, marginRight: spacing.sm },
  roomName: { fontSize: 15, fontWeight: '700' },
  roomMeta: { fontSize: 12, marginTop: 1 },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardDivider: { height: 1, marginVertical: spacing.md },
  bedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  bedNumber: { fontSize: 14, fontWeight: '600' },
  bedResident: { fontSize: 12, marginTop: 1 },
  bedStatusChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  bedStatusText: { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xxl, paddingBottom: spacing.xxxl + spacing.xxl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  formField: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15 },
  inputMultiline: { height: 60, textAlignVertical: 'top', paddingTop: spacing.sm },
  bedNumberInput: { flex: 1.4 },
  bedMoneyInput: { flex: 1 },
  addBedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  addBedText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  modalBtn: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  modalBtnSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});