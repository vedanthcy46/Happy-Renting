import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import {
  getExpenses,
  getRecurringExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  getProperties,
  type OwnerExpense,
  type Property,
} from '../../api/owner';

// ─── Helpers ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  'maintenance',
  'electricity',
  'water',
  'society',
  'repairs',
  'cleaning',
  'internet',
  'misc',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: 'Maintenance',
  electricity: 'Electricity',
  water: 'Water',
  society: 'Society',
  repairs: 'Repairs',
  cleaning: 'Cleaning',
  internet: 'Internet',
  misc: 'Misc',
};

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatSigned = (n: number) =>
  n === 0
    ? '₹0'
    : n > 0
      ? `+₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
      : `-₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const todayISO = () => new Date().toISOString().split('T')[0];

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const addMonths = (d: Date, delta: number) =>
  new Date(d.getFullYear(), d.getMonth() + delta, 1);

const toPropId = (p?: string | { _id: string; name: string }) =>
  typeof p === 'string' ? p : p?._id ?? '';

// ─── Category badge ───────────────────────────────────────────────────────

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.infoLight }]}>
      <Text style={[styles.badgeText, { color: colors.info }]}>
        {CATEGORY_LABELS[category] ?? category}
      </Text>
    </View>
  );
};

// ─── Expense form bottom sheet ─────────────────────────────────────────────

interface ExpenseFormValues {
  propertyId: string;
  category: string;
  title: string;
  amount: string;
  month: string;
  expenseDate: string;
  notes: string;
  isRecurring: boolean;
}

interface ExpenseFormModalProps {
  visible: boolean;
  initial: OwnerExpense | null;
  monthDefault: string;
  properties: Property[];
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues, id?: string) => void;
  saving: boolean;
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  visible, initial, monthDefault, properties, onClose, onSubmit, saving,
}) => {
  const { colors } = useTheme();
  const [propertyId, setPropertyId] = useState('');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(monthDefault);
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setPropertyId(initial ? toPropId(initial.propertyId) : '');
    setCategory(initial?.category ?? '');
    setTitle(initial?.title ?? '');
    setAmount(initial ? String(initial.amount) : '');
    setMonth(initial?.month ?? monthDefault);
    setExpenseDate(initial?.expenseDate ?? todayISO());
    setNotes(initial?.notes ?? '');
    setIsRecurring(initial?.isRecurring ?? false);
    setPickerVisible(false);
  }, [visible, initial, monthDefault]);

  const propertyName = properties.find(p => p._id === propertyId)?.name ?? '';

  const isValid =
    Number(amount) > 0 && propertyId.length > 0 && category.length > 0;

  const submit = () => {
    if (!isValid) return;
    onSubmit(
      {
        propertyId,
        category,
        title: title.trim(),
        amount: amount.trim(),
        month: month.trim(),
        expenseDate: expenseDate.trim(),
        notes: notes.trim(),
        isRecurring,
      },
      initial?._id,
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>
              {initial ? 'Edit Expense' : 'Add Expense'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flexShrink: 1 }}>
            {/* Property picker */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Property *</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerField, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: propertyName ? colors.text.primary : colors.text.tertiary, fontSize: 15 }}>
                  {propertyName || 'Select property…'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {/* Category chips */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Category *</Text>
              <View style={styles.chipWrap}>
                {CATEGORIES.map(c => {
                  const selected = category === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.chip,
                        { backgroundColor: selected ? colors.primary : colors.borderLight },
                        selected && chipSelectedStyle,
                      ]}
                      onPress={() => setCategory(c)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text.secondary }]}>
                        {CATEGORY_LABELS[c]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Title</Text>
              <TextInput
                style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Water pump fix"
                placeholderTextColor={colors.text.tertiary}
                maxLength={120}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Amount *</Text>
              <TextInput
                style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Month</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={month}
                  onChangeText={setMonth}
                  placeholder="YYYY-MM"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                />
              </View>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Expense Date</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={expenseDate}
                  onChangeText={setExpenseDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional note…"
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={3}
                maxLength={300}
              />
            </View>

            <View style={[styles.recurringRow, { borderTopColor: colors.borderLight }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recurringTitle, { color: colors.text.primary }]}>
                  Recurring monthly expense
                </Text>
                <Text style={[styles.recurringSub, { color: colors.text.tertiary }]}>
                  Log this amount automatically every month
                </Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={isRecurring ? colors.primary : '#ccc'}
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
                style={[styles.modalBtn, { backgroundColor: isValid ? colors.primary : colors.border }]}
                onPress={submit}
                activeOpacity={0.8}
                disabled={!isValid || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>{initial ? 'Save Changes' : 'Add Expense'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Property picker modal */}
        <Modal visible={pickerVisible} animationType="fade" transparent presentationStyle="overFullScreen">
          <TouchableOpacity
            style={styles.pickerOverlay}
            onPress={() => setPickerVisible(false)}
            activeOpacity={1}
          >
            <View style={[styles.pickerSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.text.primary }]}>Select Property</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                {properties.map(p => {
                  const selected = p._id === propertyId;
                  return (
                    <TouchableOpacity
                      key={p._id}
                      style={[styles.pickerItem, { borderBottomColor: colors.borderLight }]}
                      onPress={() => { setPropertyId(p._id); setPickerVisible(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerItemName, { color: selected ? colors.primary : colors.text.primary }]}>
                        {p.name}
                      </Text>
                      <Text style={[styles.pickerItemSub, { color: colors.text.tertiary }]} numberOfLines={1}>
                        {p.address}
                      </Text>
                      {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const chipSelectedStyle = { borderWidth: 1, borderColor: 'transparent' };

// ─── Expense row ──────────────────────────────────────────────────────────

interface ExpenseRowProps {
  expense: OwnerExpense;
  propertyName: string;
  onDelete: () => void;
  onEdit: () => void;
}

const ExpenseRow: React.FC<ExpenseRowProps> = ({ expense, propertyName, onDelete, onEdit }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.expenseRow, { backgroundColor: colors.surface }, shadows.sm]}>
      <View style={styles.expenseDateCol}>
        <Text style={[styles.expenseDateDay, { color: colors.text.primary }]}>
          {new Date(expense.expenseDate || expense.month).getDate()}
        </Text>
        <Text style={[styles.expenseDateMonth, { color: colors.text.tertiary }]}>
          {new Date(expense.expenseDate || expense.month).toLocaleString('en-IN', { month: 'short' })}
        </Text>
      </View>
      <View style={styles.expenseBody}>
        <View style={styles.expenseTop}>
          <Text style={[styles.expenseTitle, { color: colors.text.primary }]} numberOfLines={1}>
            {(expense.title || CATEGORY_LABELS[expense.category]) ?? 'Expense'}
          </Text>
          <Text style={[styles.expenseAmount, { color: colors.text.primary }]}>
            {formatCurrency(expense.amount)}
          </Text>
        </View>
        <View style={styles.expenseMeta}>
          <CategoryBadge category={expense.category} />
          {expense.isRecurring && (
            <View style={[styles.recurringTag, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="repeat" size={11} color={colors.warning} />
              <Text style={[styles.recurringTagText, { color: colors.warning }]}>Monthly</Text>
            </View>
          )}
        </View>
        {propertyName ? (
          <Text style={[styles.expenseProp, { color: colors.text.tertiary }]} numberOfLines={1}>
            {propertyName}
          </Text>
        ) : null}
      </View>
      <View style={styles.expenseActions}>
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="create-outline" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────

export const OwnerExpensesScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedProperty, setSelectedProperty] = useState<string | undefined>(undefined);
  const [formVisible, setFormVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OwnerExpense | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const month = monthKey(currentMonth);

  const { data: propsData } = useQuery({
    queryKey: ['ownerProperties'],
    queryFn: getProperties,
    staleTime: 5 * 60 * 1000,
  });

  const { data: expData, isLoading: expLoading, refetch: refetchExp } = useQuery({
    queryKey: ['ownerExpenses', month, selectedProperty],
    queryFn: () => getExpenses({ month, propertyId: selectedProperty }),
    staleTime: 60 * 1000,
  });

  const { data: summaryData, refetch: refetchSum } = useQuery({
    queryKey: ['ownerExpenseSummary', month, selectedProperty],
    queryFn: () => getExpenseSummary({ month, propertyId: selectedProperty }),
    staleTime: 60 * 1000,
  });

  const { data: recData, refetch: refetchRec } = useQuery({
    queryKey: ['ownerRecurringExpenses', selectedProperty],
    queryFn: () => getRecurringExpenses(selectedProperty),
    staleTime: 2 * 60 * 1000,
  });

  const properties = propsData?.properties ?? [];
  const expenses = expData?.expenses ?? [];
  const summary = summaryData?.summary;
  const recurring = recData?.expenses ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchExp(), refetchSum(), refetchRec(), qc.refetchQueries({ queryKey: ['ownerProperties'] })]);
    setRefreshing(false);
  }, [refetchExp, refetchSum, refetchRec, qc]);

  const invalidateExpenses = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['ownerExpenses'] });
    qc.invalidateQueries({ queryKey: ['ownerExpenseSummary'] });
    qc.invalidateQueries({ queryKey: ['ownerRecurringExpenses'] });
  }, [qc]);

  const propNameFor = (expense: OwnerExpense) => {
    const id = toPropId(expense.propertyId);
    return properties.find(p => p._id === id)?.name ?? '';
  };

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      invalidateExpenses();
      setFormVisible(false);
      setEditingExpense(null);
      Alert.alert('Added', 'Expense has been recorded.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to add expense.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateExpense>[1] }) =>
      updateExpense(id, payload),
    onSuccess: () => {
      invalidateExpenses();
      setFormVisible(false);
      setEditingExpense(null);
      Alert.alert('Updated', 'Expense has been updated.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to update expense.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      invalidateExpenses();
      Alert.alert('Deleted', 'Expense has been removed.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to delete expense.'),
  });

  const logRecurringMutation = useMutation({
    mutationFn: (recurringExpense: OwnerExpense) =>
      createExpense({
        propertyId: toPropId(recurringExpense.propertyId),
        category: recurringExpense.category,
        title: recurringExpense.title,
        amount: recurringExpense.amount,
        month,
        isRecurring: true,
      }),
    onSuccess: () => {
      invalidateExpenses();
      Alert.alert('Logged', 'Recurring expense added for this month.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to log recurring expense.'),
  });

  const handleSubmit = (values: ExpenseFormValues, id?: string) => {
    const payload = {
      propertyId: values.propertyId,
      category: values.category,
      title: values.title || undefined,
      amount: Number(values.amount),
      month: values.month,
      isRecurring: values.isRecurring,
      notes: values.notes || undefined,
      expenseDate: values.expenseDate,
    };
    if (id) {
      updateMutation.mutate({ id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (expense: OwnerExpense) => {
    Alert.alert(
      'Delete Expense',
      `Remove "${(expense.title || CATEGORY_LABELS[expense.category]) ?? 'this expense'}" (${formatCurrency(expense.amount)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(expense._id),
        },
      ]
    );
  };

  const handleLogRecurring = (recurringExpense: OwnerExpense) => {
    if (!toPropId(recurringExpense.propertyId)) {
      Alert.alert('Missing Property', 'This recurring expense has no property. Please add it manually.');
      return;
    }
    logRecurringMutation.mutate(recurringExpense);
  };

  const openAdd = () => {
    setEditingExpense(null);
    setFormVisible(true);
  };

  const openEdit = (expense: OwnerExpense) => {
    setEditingExpense(expense);
    setFormVisible(true);
  };

  const netProfit = summary?.netProfit ?? 0;
  const isSaving = createMutation.isPending || updateMutation.isPending || logRecurringMutation.isPending;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Expenses</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
            {formattedMonthSummary(month)}
          </Text>
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

      {/* Month selector */}
      <View style={[styles.monthRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, -1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text.primary }]}>{month}</Text>
        <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Property filter chips */}
      <View style={[styles.filterRow, { backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: selectedProperty === undefined ? colors.primary : colors.surface },
            ]}
            onPress={() => setSelectedProperty(undefined)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, { color: selectedProperty === undefined ? '#FFFFFF' : colors.text.secondary }]}>
              All properties
            </Text>
          </TouchableOpacity>
          {properties.map(p => {
            const selected = selectedProperty === p._id;
            return (
              <TouchableOpacity
                key={p._id}
                style={[
                  styles.filterChip,
                  { backgroundColor: selected ? colors.primary : colors.surface },
                ]}
                onPress={() => setSelectedProperty(selected ? undefined : p._id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: selected ? '#FFFFFF' : colors.text.secondary }]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {expLoading && expenses.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Summary card */}
          {summary && (
            <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadows.md]}>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>Net Profit</Text>
                  <Text style={[styles.netProfit, { color: netProfit >= 0 ? colors.success : colors.error }]}>
                    {formatSigned(netProfit)}
                  </Text>
                </View>
                <View style={[styles.netIcon, { backgroundColor: netProfit >= 0 ? colors.successLight : colors.errorLight }]}>
                  <Ionicons
                    name={netProfit >= 0 ? 'trending-up' : 'trending-down'}
                    size={20}
                    color={netProfit >= 0 ? colors.success : colors.error}
                  />
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>
                    {formatCurrency(summary.totalIncome)}
                  </Text>
                  <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>Rent Collected</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.error }]}>
                    {formatCurrency(summary.totalExpenses)}
                  </Text>
                  <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>Total Expenses</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                    {summary.expenseCount}
                  </Text>
                  <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>Expense Count</Text>
                </View>
              </View>
            </View>
          )}

          {/* Recurring expenses */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Recurring Monthly</Text>
          </View>
          {recurring.length === 0 ? (
            <View style={[styles.recurringCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.recurringEmpty, { color: colors.text.tertiary }]}>
                No recurring expenses set up.
              </Text>
            </View>
          ) : (
            <View style={styles.recurringList}>
              {recurring.map(r => (
                <View key={r._id} style={[styles.recurringCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                  <View style={styles.recurringCardLeft}>
                    <View style={styles.recurringCardTop}>
                      <Text style={[styles.recurringCardTitle, { color: colors.text.primary }]} numberOfLines={1}>
                        {(r.title || CATEGORY_LABELS[r.category]) ?? 'Recurring expense'}
                      </Text>
                      <CategoryBadge category={r.category} />
                    </View>
                    <Text style={[styles.recurringCardSub, { color: colors.text.tertiary }]}>
                      {month} · {formatCurrency(r.amount)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.logBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleLogRecurring(r)}
                    activeOpacity={0.8}
                    disabled={logRecurringMutation.isPending}
                  >
                    {logRecurringMutation.isPending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                        <Text style={styles.logBtnText}>Log this month</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Expense list */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Expenses</Text>
            <Text style={[styles.sectionCount, { color: colors.text.tertiary }]}>{expenses.length}</Text>
          </View>
          {expenses.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="receipt-outline" size={40} color={colors.text.tertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
                No expenses for {month}.
              </Text>
              <Text style={[styles.emptySub, { color: colors.text.tertiary }]}>
                Tap Add to record one.
              </Text>
            </View>
          ) : (
            <View style={styles.expenseList}>
              {expenses.map(e => (
                <ExpenseRow
                  key={e._id}
                  expense={e}
                  propertyName={propNameFor(e)}
                  onDelete={() => handleDelete(e)}
                  onEdit={() => openEdit(e)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <ExpenseFormModal
        visible={formVisible}
        initial={editingExpense}
        monthDefault={month}
        properties={properties}
        onClose={() => { setFormVisible(false); setEditingExpense(null); }}
        onSubmit={handleSubmit}
        saving={isSaving}
      />
    </View>
  );
};

const formattedMonthSummary = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) + " this month's net profit";
};

// ─── Styles ───────────────────────────────────────────────────────────────

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

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthLabel: { fontSize: 16, fontWeight: '700' },

  filterRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  filterContent: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipText: { fontSize: 13, fontWeight: '600' },

  scroll: { padding: spacing.xl, gap: spacing.lg },

  // Summary
  summaryCard: { borderRadius: radius.xl, padding: spacing.xl },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  netProfit: { fontSize: 32, fontWeight: '700', letterSpacing: -1, marginTop: spacing.xs },
  netIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginVertical: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryItemLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  summaryDivider: { width: 1, height: 30 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionCount: { fontSize: 14, fontWeight: '600' },

  // Recurring
  recurringList: { gap: spacing.sm },
  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
  },
  recurringCardLeft: { flex: 1 },
  recurringCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recurringCardTitle: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  recurringCardSub: { fontSize: 12, marginTop: 4 },
  recurringEmpty: { fontSize: 13 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  logBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // Expense list
  expenseList: { gap: spacing.sm },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  expenseDateCol: { alignItems: 'center', width: 40 },
  expenseDateDay: { fontSize: 18, fontWeight: '700' },
  expenseDateMonth: { fontSize: 10, textTransform: 'uppercase', marginTop: 1 },
  expenseBody: { flex: 1 },
  expenseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expenseTitle: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  expenseAmount: { fontSize: 14, fontWeight: '700' },
  expenseMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 5 },
  expenseProp: { fontSize: 11, marginTop: 4 },
  expenseActions: { gap: spacing.md },
  recurringTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingHorizontal: 6, borderRadius: radius.full },
  recurringTagText: { fontSize: 10, fontWeight: '600' },

  // Badge
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 10, fontWeight: '600' },

  // Sheet / form
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
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  formField: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  pickerField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formRow: { flexDirection: 'row', gap: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  recurringTitle: { fontSize: 14, fontWeight: '600' },
  recurringSub: { fontSize: 12, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalBtn: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  modalBtnSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // Property picker
  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: spacing.xl },
  pickerSheet: { width: '100%', borderRadius: radius.xxl, padding: spacing.xxl, borderWidth: 1 },
  pickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemName: { fontSize: 15, fontWeight: '600', flex: 1 },
  pickerItemSub: { fontSize: 12, flex: 1 },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  centerBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
  emptySub: { fontSize: 12, textAlign: 'center' },
});