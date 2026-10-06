const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const target = `                    <View style={{ flexDirection: 'row', gap: 8 }}>
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
                    </View>`;

const replacement = `                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => setSelectionMode(true)}
                      >
                        <Text style={[styles.bulkBtnText, { color: colors.text.primary }]}>Select</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: colors.background, borderColor: colors.error, borderWidth: 1 }]}
                        onPress={() => handleBulkDelete(draftBills.map(b => b._id), true)}
                      >
                        <Text style={[styles.bulkBtnText, { color: colors.error }]}>Delete All</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleBulkPublish(draftBills.map(b => b._id), true)}
                      >
                        <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Publish All</Text>
                      </TouchableOpacity>
                    </View>`;

code = code.replace(target, replacement);
fs.writeFileSync(filePath, code);
console.log("Added Delete All button back.");
