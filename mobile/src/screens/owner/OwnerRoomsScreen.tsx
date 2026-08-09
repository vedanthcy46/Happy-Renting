import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Alert, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { getRooms, getProperties, createRoom, updateRoom, deleteRoom, type Room } from '../../api/owner';

const formatCurrency = (n?: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface RoomFormModalProps {
  visible: boolean;
  initial?: Room | null;
  propertyId: string;
  onClose: () => void;
  onSave: (payload: any) => void;
  saving: boolean;
  t: (key: string) => string;
}

const RoomFormModal: React.FC<RoomFormModalProps> = ({ visible, initial, propertyId, onClose, onSave, saving, t }) => {
  const { colors } = useTheme();
  const [roomNumber, setRoomNumber] = useState(initial?.roomNumber ?? '');
  const [floor, setFloor] = useState(initial?.floor ?? '');
  const [capacity, setCapacity] = useState(initial ? String(initial.capacity) : '1');
  const [monthlyRent, setMonthlyRent] = useState(initial ? String(initial.monthlyRent ?? '') : '');
  const [securityDeposit, setSecurityDeposit] = useState(initial ? String(initial.securityDeposit ?? '') : '');
  const [description, setDescription] = useState('');

  React.useEffect(() => {
    if (visible) {
      setRoomNumber(initial?.roomNumber ?? '');
      setFloor(initial?.floor ?? '');
      setCapacity(initial ? String(initial.capacity) : '1');
      setMonthlyRent(initial ? String(initial.monthlyRent ?? '') : '');
      setSecurityDeposit(initial ? String(initial.securityDeposit ?? '') : '');
      setDescription('');
    }
  }, [visible, initial]);

  const capNum = parseInt(capacity, 10);
  const rentNum = parseFloat(monthlyRent);
  const depositNum = parseFloat(securityDeposit);
  const capacityValid = !isNaN(capNum) && capNum >= 1 && (!initial || capNum >= initial.currentOccupancy);
  const rentValid = monthlyRent === '' ? true : !isNaN(rentNum) && rentNum >= 0;
  const depositValid = securityDeposit === '' ? true : !isNaN(depositNum) && depositNum >= 0;
  const isValid = roomNumber.trim().length > 0 && capacityValid && rentValid && depositValid;

  const save = () => {
    onSave({
      roomNumber: roomNumber.trim(),
      propertyId,
      capacity: capNum,
      floor: floor.trim() || undefined,
      monthlyRent: monthlyRent === '' ? undefined : rentNum,
      securityDeposit: securityDeposit === '' ? undefined : depositNum,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
              {initial ? t('owner.rooms.editTitle') : t('owner.rooms.addTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1, maxHeight: 460 }}>
            {initial && (
              <View style={[styles.infoBanner, { backgroundColor: colors.infoLight }]}>
                <Text style={[styles.infoText, { color: colors.info }]}>
                  {t('owner.rooms.infoOccupied', { occupied: initial.currentOccupancy, capacity: initial.capacity })}
                </Text>
              </View>
            )}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldRoomNumber')}</Text>
              <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={roomNumber} onChangeText={setRoomNumber} placeholder="e.g. 101" placeholderTextColor={colors.text.tertiary} maxLength={30} />
            </View>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldFloor')}</Text>
              <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={floor} onChangeText={setFloor} placeholder="e.g. Ground" placeholderTextColor={colors.text.tertiary} maxLength={30} />
            </View>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.rooms.fieldCapacity')}</Text>
              <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.text.tertiary} />
              {initial && capacityValid === false && (
                <Text style={[styles.errText, { color: colors.error }]}>{t('owner.rooms.errCapacityMin', { min: initial.currentOccupancy })}</Text>
              )}
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
               <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.rooms.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: isValid ? colors.primary : colors.border }]} onPress={save} activeOpacity={0.8} disabled={!isValid || saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> :                  <Text style={styles.modalBtnSaveText}>{initial ? t('owner.rooms.saveChanges') : t('owner.rooms.saveAdd')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const RoomCard: React.FC<{ room: Room; onEdit: () => void; onDelete: () => void; t: (key: string) => string }> = ({ room, onEdit, onDelete, t }) => {
  const { colors } = useTheme();
  const occupancy = room.currentOccupancy ?? 0;
  const isFull = occupancy >= room.capacity;
  const pct = Math.min(100, Math.round((occupancy / room.capacity) * 100));

  return (
    <View style={[styles.roomCard, { backgroundColor: colors.surface }, shadows.sm]}>
      <View style={styles.cardTop}>
        <View style={[styles.roomIconWrap, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="bed-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
             <Text style={[styles.roomName, { color: colors.text.primary }]}>Room {room.roomNumber}</Text>
             {room.floor ? <Text style={[styles.roomFloor, { color: colors.text.tertiary }]}>{t('owner.rooms.floorPrefix', { floor: room.floor })}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: 6 }}>
             <Text style={[styles.roomMeta, { color: colors.text.secondary }]}>{t('owner.rooms.rent', { amount: formatCurrency(room.monthlyRent) })}</Text>
             {room.securityDeposit ? <Text style={[styles.roomMeta, { color: colors.text.secondary }]}>{t('owner.rooms.deposit', { amount: formatCurrency(room.securityDeposit) })}</Text> : null}
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="create-outline" size={19} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="trash-outline" size={19} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
      <View style={styles.occRow}>
        <View style={styles.occLabelRow}>
          <View style={[styles.badge, { backgroundColor: isFull ? colors.successLight : colors.warningLight }]}>
             <Text style={[styles.badgeText, { color: isFull ? colors.success : colors.warning }]}>{isFull ? t('owner.rooms.badgeFull') : t('owner.rooms.badgeAvailable')}</Text>
          </View>
          <Text style={[styles.occCount, { color: colors.text.secondary }]}>{t('owner.rooms.occupiedCount', { occupied: occupancy, capacity: room.capacity })}</Text>
        </View>
        <View style={[styles.occBar, { backgroundColor: colors.borderLight }]}>
          <View style={[styles.occFill, { backgroundColor: isFull ? colors.success : colors.primary, width: `${pct}%` }]} />
        </View>
      </View>
    </View>
  );
};

export const OwnerRoomsScreen: React.FC<{ propertyId: string }> = ({ propertyId }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const { data: roomsData, isLoading, refetch } = useQuery({
    queryKey: ['ownerRooms', propertyId],
    queryFn: () => getRooms(propertyId),
    staleTime: 2 * 60 * 1000,
  });

  const { data: propData } = useQuery({
    queryKey: ['ownerProperties'],
    queryFn: getProperties,
    staleTime: 5 * 60 * 1000,
  });

  const property = propData?.properties.find((p: any) => p._id === propertyId);
  const rooms = roomsData?.rooms ?? [];

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerRooms'] });
      setModalVisible(false);
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.rooms.errCreate')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateRoom(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerRooms'] });
      setModalVisible(false);
      setEditingRoom(null);
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.rooms.errUpdate')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ownerRooms'] }),
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.rooms.errRemove')),
  });

  const handleSave = (payload: any) => {
    if (editingRoom) updateMutation.mutate({ id: editingRoom._id, payload });
    else createMutation.mutate(payload);
  };

  const handleDelete = (room: Room) => {
    Alert.alert(
      t('owner.rooms.removeTitle'),
      t('owner.rooms.removeMsg', { number: room.roomNumber }),
      [
        { text: t('owner.rooms.cancel'), style: 'cancel' },
        { text: t('owner.commonOwner.remove'), style: 'destructive', onPress: () => deleteMutation.mutate(room._id) },
      ]
    );
  };

  const openAdd = () => { setEditingRoom(null); setModalVisible(true); };
  const openEdit = (r: Room) => { setEditingRoom(r); setModalVisible(true); };
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.rooms.title')}</Text>
          {!isLoading && (
            <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
              {property ? property.name : t('owner.rooms.propertyFallback')} · {t(rooms.length === 1 ? 'owner.rooms.count_one' : 'owner.rooms.count_other', { count: rooms.length })}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>{t('common.add')}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : rooms.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bed-outline" size={48} color={colors.text.tertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('owner.rooms.emptyTitle')}</Text>
          <Text style={[styles.emptySub, { color: colors.text.tertiary }]}>{t('owner.rooms.emptySub')}</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
             <Text style={styles.emptyBtnText}>{t('owner.rooms.saveAdd')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {rooms.map(r => (
            <RoomCard key={r._id} room={r} onEdit={() => openEdit(r)} onDelete={() => handleDelete(r)} t={t} />
          ))}
        </ScrollView>
      )}

      <RoomFormModal
        visible={modalVisible}
        initial={editingRoom}
        propertyId={propertyId}
        onClose={() => { setModalVisible(false); setEditingRoom(null); }}
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  scroll: { padding: spacing.xl, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.huge },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.full, marginTop: spacing.sm },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  roomCard: { borderRadius: radius.xl, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  roomIconWrap: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  roomName: { fontSize: 15, fontWeight: '700' },
  roomFloor: { fontSize: 12 },
  roomMeta: { fontSize: 12, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  cardDivider: { height: 1, marginVertical: spacing.md },
  occRow: { gap: spacing.sm },
  occLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  occCount: { fontSize: 12 },
  occBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  occFill: { height: '100%', borderRadius: 3 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xxl, paddingBottom: spacing.xxxl + spacing.xxl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  infoBanner: { padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  infoText: { fontSize: 13, fontWeight: '500' },
  formField: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15 },
  inputMultiline: { height: 60, textAlignVertical: 'top', paddingTop: spacing.sm },
  errText: { fontSize: 12, marginTop: spacing.xs },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  modalBtn: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  modalBtnSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});