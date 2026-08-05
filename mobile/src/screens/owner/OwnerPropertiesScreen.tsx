import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
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
}

const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  visible, initial, onClose, onSave, saving,
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
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
              {initial ? 'Edit Property' : 'Add Property'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Property Name *</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Green Valley Apartments"
              placeholderTextColor={colors.text.tertiary}
              maxLength={100}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Address *</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Street, area, landmark…"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>City</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Chennai"
              placeholderTextColor={colors.text.tertiary}
              maxLength={60}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>Cancel</Text>
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
                <Text style={styles.modalBtnSaveText}>{initial ? 'Save Changes' : 'Add Property'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Property card ─────────────────────────────────────────────────────────

interface PropertyCardProps {
  property: Property;
  rooms: Room[];
  onEdit: () => void;
  onDelete: () => void;
  onManageRooms: () => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, rooms, onEdit, onDelete, onManageRooms }) => {
  const { colors } = useTheme();
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
    <View style={[styles.propertyCard, { backgroundColor: colors.surface }, shadows.sm]}>
      {/* Card header */}
      <TouchableOpacity style={styles.cardHeader} onPress={onManageRooms} activeOpacity={0.7}>
        <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="business" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.text.primary }]} numberOfLines={1}>
            {property.name}
          </Text>
          <Text style={[styles.cardAddress, { color: colors.text.secondary }]} numberOfLines={2}>
            {property.address}{property.city ? `, ${property.city}` : ''}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
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
              <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>Total</Text>
            </View>
            <View style={[styles.roomStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.roomStatItem}>
              <Text style={[styles.roomStatValue, { color: colors.success }]}>{occupiedRooms}</Text>
              <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>Occupied</Text>
            </View>
            <View style={[styles.roomStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.roomStatItem}>
              <Text style={[styles.roomStatValue, { color: colors.warning }]}>{vacantRooms}</Text>
              <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>Vacant</Text>
            </View>
            <View style={[styles.roomStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.roomStatItem}>
              <Text style={[styles.roomStatValue, { color: colors.primary }]}>{occupancyPct}%</Text>
              <Text style={[styles.roomStatLabel, { color: colors.text.secondary }]}>Occupancy</Text>
            </View>
          </View>
        </>
      )}

      {totalRooms === 0 && (
        <View style={[styles.noRoomsBanner, { backgroundColor: colors.borderLight }]}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.tertiary} />
          <Text style={[styles.noRoomsText, { color: colors.text.tertiary }]}>
            No rooms yet. Tap the card to add rooms.
          </Text>
        </View>
      )}
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────

export const OwnerPropertiesScreen: React.FC = () => {
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
      Alert.alert('Error', err?.message || 'Failed to create property.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateProperty(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerProperties'] });
      setModalVisible(false);
      setEditingProperty(null);
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Failed to update property.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ownerProperties'] }),
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Failed to remove property.'),
  });

  const handleSave = (payload: { name: string; address: string; city: string }) => {
    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (property: Property) => {
    Alert.alert(
      'Remove Property',
      `Remove "${property.name}"? This will deactivate the property. Tenant and room data will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(property._id),
        },
      ]
    );
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
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Properties</Text>
          {!isLoading && (
            <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
              {properties.length} {properties.length === 1 ? 'property' : 'properties'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openAdd}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading properties…</Text>
        </View>
      ) : properties.length === 0 ? (
        <View style={styles.emptyCenter}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="business-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No properties yet</Text>
          <Text style={[styles.emptyBody, { color: colors.text.secondary }]}>
            Tap the Add button to create your first property.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={openAdd}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>Add Property</Text>
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
              onDelete={() => handleDelete(p)}
              onManageRooms={() => router.push({ pathname: '/owner/rooms/[propertyId]', params: { propertyId: p._id } } as any)}
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
  cardName: { fontSize: 15, fontWeight: '700' },
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
