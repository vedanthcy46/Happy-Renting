const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const stateRegex = /const \[search, setSearch\] = useState\(''\);/;
code = code.replace(stateRegex, `const [search, setSearch] = useState('');\n  const [selectionMode, setSelectionMode] = useState(false);\n  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);`);

const effectCode = `  const draftBills = useMemo(() => bills.filter(b => b.status === 'DRAFT'), [bills]);

  React.useEffect(() => {
    if (draftBills.length === 0) {
      setSelectionMode(false);
      setSelectedDraftIds([]);
    }
  }, [draftBills.length]);`;
code = code.replace(/  const draftBills = useMemo\(\(\) => bills\.filter\(b => b\.status === 'DRAFT'\), \[bills\]\);/, effectCode);

const handlersCode = `  const handleBulkPublish = (ids: string[], isAll: boolean) => {
    if (ids.length === 0) return;
    Alert.alert(
      isAll ? 'Publish All Drafts' : 'Publish Selected',
      \`Are you sure you want to publish \${ids.length} draft bills? Tenants will be notified.\`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', style: 'default', onPress: () => { mutationBulkPublish.mutate(ids); setSelectionMode(false); setSelectedDraftIds([]); } }
      ]
    );
  };

  const handleBulkDelete = (ids: string[], isAll: boolean) => {
    if (ids.length === 0) return;
    Alert.alert(
      isAll ? 'Delete All Drafts' : 'Delete Selected',
      \`Are you sure you want to delete \${ids.length} draft bills? This action cannot be undone.\`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { mutationBulkDelete.mutate(ids); setSelectionMode(false); setSelectedDraftIds([]); } }
      ]
    );
  };`;

code = code.replace(/  const handleBulkPublish = \(\) => \{[\s\S]*?  const handleBulkDelete = \(\) => \{[\s\S]*?\]\n    \);\n  \};/, handlersCode);


const renderRegex = /  const renderBillRow = useCallback\(\(\{ item \}: \{ item: MonthlyBill \}\) => \{[\s\S]*?    \);\n  \}, \[colors, router, styles\]\);/;

const renderReplacement = `  const renderBillRow = useCallback(({ item }: { item: MonthlyBill }) => {
    const user = item.userId as any;
    const room = item.roomId as any;
    const rr = item.rentRecordId as any;
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
    const paid = rr?.totalPaid ?? 0;
    const remaining = rr?.remainingAmount ?? item.totalAmount;
    
    const isSelected = selectedDraftIds.includes(item._id);

    return (
      <TouchableOpacity
        style={[styles.billRow, { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : 'transparent', borderWidth: isSelected ? 1 : 0 }, shadows.sm]}
        onPress={() => {
          if (selectionMode && item.status === 'DRAFT') {
            setSelectedDraftIds(prev => prev.includes(item._id) ? prev.filter(id => id !== item._id) : [...prev, item._id]);
          } else {
            router.navigate(\`/owner/billing/\${item._id}\` as any);
          }
        }}
        activeOpacity={0.75}
      >
        <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
          {selectionMode && item.status === 'DRAFT' && (
            <View style={{ marginRight: 12 }}>
              <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? colors.primary : colors.text.tertiary} />
            </View>
          )}
          <View style={styles.billRowLeft}>
            <Text style={[styles.billTenantName, { color: colors.text.primary }]} numberOfLines={1}>
              {user?.name ?? 'Tenant'}
            </Text>
            <Text style={[styles.billRoomLabel, { color: colors.text.secondary }]}>
              Room {room?.roomNumber ?? '—'}
            </Text>
            {item.status !== 'DRAFT' && paid > 0 && (
              <Text style={[styles.billPaidLabel, { color: colors.success }]}>
                Paid {formatCurrency(paid)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.billRowRight}>
          <Text style={[styles.billAmount, { color: colors.text.primary }]}>
            {formatCurrency(item.totalAmount)}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusChipText, { color: cfg.color }]}>
              {cfg.dot} {cfg.label}
            </Text>
          </View>
          {item.status === 'DRAFT' && (
            <Text style={[styles.draftNote, { color: colors.text.tertiary }]}>Not sent</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [colors, router, styles, selectionMode, selectedDraftIds]);`;

code = code.replace(renderRegex, renderReplacement);

const uiRegex = /\{\/\* Bulk Actions \*\/\}(.|\n)*?<\/View>\s*\)\}/;

const uiReplacement = `{/* Bulk Actions */}
            {draftBills.length > 0 && !search && (
              <View style={[styles.bulkActionBar, { backgroundColor: selectionMode ? colors.primaryLight : colors.surface, borderColor: selectionMode ? colors.primary : colors.border, borderWidth: 1 }]}>
                {selectionMode ? (
                  <>
                    <Text style={[styles.bulkActionText, { color: colors.primary }]}>
                      {selectedDraftIds.length} Selected
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: 'transparent' }]}
                        onPress={() => { setSelectionMode(false); setSelectedDraftIds([]); }}
                      >
                        <Text style={[styles.bulkBtnText, { color: colors.text.secondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      {selectedDraftIds.length > 0 && (
                        <>
                          <TouchableOpacity 
                            style={[styles.bulkBtn, { backgroundColor: colors.error }]}
                            onPress={() => handleBulkDelete(selectedDraftIds, false)}
                          >
                            <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Delete</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.bulkBtn, { backgroundColor: colors.primary }]}
                            onPress={() => handleBulkPublish(selectedDraftIds, false)}
                          >
                            <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Publish</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.bulkActionText, { color: colors.text.primary }]}>
                      {draftBills.length} Draft{draftBills.length > 1 ? 's' : ''} Ready
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => setSelectionMode(true)}
                      >
                        <Text style={[styles.bulkBtnText, { color: colors.text.primary }]}>Select</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleBulkPublish(draftBills.map(b => b._id), true)}
                      >
                        <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Publish All</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}`;

code = code.replace(uiRegex, uiReplacement);

fs.writeFileSync(filePath, code);
console.log("Added selection mode UI");
