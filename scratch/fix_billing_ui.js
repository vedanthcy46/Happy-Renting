const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const target = `            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text.primary }]}
                placeholder="Search tenant or room..."
                placeholderTextColor={colors.text.tertiary}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>`;

const replacement = `            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text.primary }]}
                placeholder="Search tenant or room..."
                placeholderTextColor={colors.text.tertiary}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Bulk Actions */}
            {draftBills.length > 0 && !search && (
              <View style={[styles.bulkActionBar, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.bulkActionText, { color: colors.primary }]}>
                  {draftBills.length} Draft{draftBills.length > 1 ? 's' : ''} Ready
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
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

code = code.replace(target, replacement);

fs.writeFileSync(filePath, code);
console.log("Fixed Bulk Action UI injection");
