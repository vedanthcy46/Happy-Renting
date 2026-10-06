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

// update handleBulkPublish and handleBulkDelete
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

// update renderBillRow
const renderRegex = /      <TouchableOpacity[\s\S]*?onPress=\{\(\) => router\.navigate\(\`\/owner\/billing\/\$\{item\._id\}\` as any\)\}[\s\S]*?>\s*<View style=\{styles\.billRowLeft\}>/;

const renderReplacement = `      <TouchableOpacity
        style={[styles.billRow, { backgroundColor: colors.surface }, shadows.sm]}
        onPress={() => {
          if (selectionMode && item.status === 'DRAFT') {
            setSelectedDraftIds(prev => prev.includes(item._id) ? prev.filter(id => id !== item._id) : [...prev, item._id]);
          } else {
            router.navigate(\`/owner/billing/\${item._id}\` as any);
          }
        }}
        activeOpacity={0.75}
      >
        <View style={styles.billRowLeft}>
          {selectionMode && item.status === 'DRAFT' && (
            <View style={{ marginRight: 12, justifyContent: 'center' }}>
              <Ionicons 
                name={selectedDraftIds.includes(item._id) ? 'checkbox' : 'square-outline'} 
                size={22} 
                color={selectedDraftIds.includes(item._id) ? colors.primary : colors.text.tertiary} 
              />
            </View>
          )}`;

code = code.replace(renderRegex, renderReplacement);

// update flex direction for left row to accommodate checkbox
code = code.replace(/billRowLeft: \{ flex: 1, marginRight: spacing\.md \}/, "billRowLeft: { flex: 1, marginRight: spacing.md, flexDirection: 'row', alignItems: 'center' }");

// wait, the tenant name etc were inside billRowLeft but not wrapped.
// let me check the exact renderBillRow JSX.
