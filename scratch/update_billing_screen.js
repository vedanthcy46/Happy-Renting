const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Imports
code = code.replace(
  /TextInput, ActivityIndicator,/,
  'TextInput, ActivityIndicator, Alert,'
);
code = code.replace(
  /import \{ useQuery \} from '@tanstack\/react-query';/,
  "import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';"
);
code = code.replace(
  /import \{ getBills, MonthlyBill, BillStatus \} from '\.\.\/\.\.\/api\/billing';/,
  "import { getBills, MonthlyBill, BillStatus, bulkPublishBills, bulkDeleteBills } from '../../api/billing';"
);

// Hooks and logic
const hooksCode = `  const queryClient = useQueryClient();

  const draftBills = useMemo(() => bills.filter(b => b.status === 'DRAFT'), [bills]);

  const mutationBulkPublish = useMutation({
    mutationFn: (ids: string[]) => bulkPublishBills(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      Alert.alert('Success', \`\${data.publishedIds.length} bills published successfully.\`);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to publish bills'),
  });

  const mutationBulkDelete = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteBills(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      Alert.alert('Success', 'Draft bills deleted.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to delete bills'),
  });

  const handleBulkPublish = () => {
    if (draftBills.length === 0) return;
    Alert.alert(
      'Publish All Drafts',
      \`Are you sure you want to publish \${draftBills.length} draft bills for \${formatMonth(selectedMonth)}? Tenants will be notified.\`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', style: 'default', onPress: () => mutationBulkPublish.mutate(draftBills.map(b => b._id)) }
      ]
    );
  };

  const handleBulkDelete = () => {
    if (draftBills.length === 0) return;
    Alert.alert(
      'Delete All Drafts',
      \`Are you sure you want to delete \${draftBills.length} draft bills? This action cannot be undone.\`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => mutationBulkDelete.mutate(draftBills.map(b => b._id)) }
      ]
    );
  };

  const stats = useMemo(() => {`;

code = code.replace(/  const stats = useMemo\(\(\) => \{/, hooksCode);

// UI
const uiCode = `            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text.primary }]}
                placeholder="Search tenant or room..."
                placeholderTextColor={colors.text.tertiary}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {/* Bulk Actions */}
            {draftBills.length > 0 && !search && (
              <View style={[styles.bulkActionBar, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.bulkActionText, { color: colors.primary }]}>
                  {draftBills.length} Draft{draftBills.length > 1 ? 's' : ''} Ready
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity 
                    style={[styles.bulkBtn, { backgroundColor: colors.background, borderColor: colors.error, borderWidth: 1 }]}
                    onPress={handleBulkDelete}
                  >
                    <Text style={[styles.bulkBtnText, { color: colors.error }]}>Delete All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.bulkBtn, { backgroundColor: colors.primary }]}
                    onPress={handleBulkPublish}
                  >
                    <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Publish All</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}`;

code = code.replace(
  /\{\/\* Search \*\/\}(.|\n)*?onChangeText=\{setSearch\}\s*\/>\s*<\/View>/,
  uiCode
);

// Styles
const styleCode = `  searchInput: { flex: 1, fontSize: 15, marginLeft: spacing.sm, height: '100%' },
  bulkActionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  bulkActionText: { fontSize: 13, fontWeight: '700' },
  bulkBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  bulkBtnText: { fontSize: 12, fontWeight: '700' },`;

code = code.replace(/  searchInput: \{ flex: 1, fontSize: 15, marginLeft: spacing\.sm, height: '100%' \},/, styleCode);

fs.writeFileSync(filePath, code);
console.log("Bulk action logic added to BillingScreen.tsx");
