import json

def flatten(d, prefix=''):
    items = {}
    for k, v in d.items():
        key = prefix + k
        if isinstance(v, dict):
            items.update(flatten(v, key + '.'))
        else:
            items[key] = v
    return items

def set_nested(d, key, value):
    parts = key.split('.')
    for part in parts[:-1]:
        if part not in d:
            d[part] = {}
        elif not isinstance(d[part], dict):
            d[part] = {}
        d = d[part]
    d[parts[-1]] = value

def load_json(path):
    for enc in ['utf-8-sig', 'utf-8']:
        try:
            with open(path, encoding=enc) as f:
                return json.load(f)
        except Exception:
            continue
    raise Exception('Cannot load ' + path)

with open('en.json', encoding='utf-8-sig') as f:
    en = json.load(f)
en_flat = flatten(en)

# Telugu translations for the 100 English fallback keys
te_translations = {
    "home.dueDay": "బాకి రోజు",
    "home.pendingAmount": "పెండింగ్ అమౌంట్",
    "home.receipts": "రసీదులు",
    "home.tryAgain": "మళ్ళీ ప్రయత్నించండి",
    "home.enterPhone": "ఫోన్ నంబర్ నమోదు చేయండి",
    "home.unknownDate": "తెలియని తేదీ",
    "home.monthlyRent": "నెలవారీ వాటకి",
    "home.propertyOwner": "ప్రాపర్టీ భద్రత",
    "home.removeRoommateConfirm": "{{name}} ని తొలగించడానికి నిర్ధారించబడినారా?",
    "home.removeRoommate": "రూమ్మేట్ తొలగించు",
    "home.room": "గది",
    "home.roomDetails": "గది వివరాలు",
    "home.roommates": "రూమ్మేట్లు",
    "home.securityDeposit": "భద్రతా పంపు",
    "home.stayEnded": "మీ స్థితి {{date}} న ఆవిరి అయ్యింది.",
    "home.tenancyEnded": "టెనెన్సీ ముగిసింది",
    "home.tenantFallback": "అద్దెదారు",
    "home.totalDeposit": "మొత్తం పంపు",
    "home.update": "अप్డేట్",
    "home.updateRoommateFailed": "రూమ్మేట్ అప్డేట్ చేయడంలో విఫలం",
    "home.addRoommate": "రూమ్మేట్ జోడించు",
    "home.addRoommateFailed": "రూమ్మేట్ జోడించడంలో విఫలం",
    "home.advanceBalance": "అధికారిక బ్యాలెన్స్",
    "home.allCleared": "ఈ నెలకోసం అన్నీ క్లియర్",
    "home.callOwner": "యజమానిని కాల్ చేయండి",
    "home.capacity": "సామర్థ్యం",
    "home.complaint": "ఫిర్యాదు",
    "home.contactOwner": "యజమానిని సంప్రదించండి",
    "home.currentMonth": "ప్రస్తుత నెల",
    "home.due": "బాకీ: {{date}}",
    "home.editRoommate": "రూమ్మేట్ సవరించు",
    "home.enterIdProof": "ID ప్రూఫ్ రిఫరెన్స్ నమోదు చేయండి",
    "home.enterName": "పేరు నమోదు చేయండి",
    "home.failedLoad": "మీ టెనెన్సీ డేటా లోడ్ చేయడంలో విఫలం. మళ్ళీ ప్రయత్నించడానికి కింద కింద చూడండి.",
    "home.goodAfternoon": "శుభ మద్యాహ్నం",
    "home.goodEvening": "శుభ సాయంత్రం",
    "home.goodMorning": "శుభ ఉదయం",
    "home.idProof": "ID ప్రూఫ్ (ఐచ్ఛికం)",
    "home.joined": "{{date}} న చేరినది",
    "home.monthRent": "{{month}} వాటకి",
    "home.name": "పేరు",
    "home.namePhoneRequired": "పేరు మరియు ఫోన్ అవసరం",
    "home.noActiveTenancy": "సక్రియ టెనెన్సీ లేదు",
    "home.noBillsDesc": "బిల్లులు ప్రతి నెల 1న జనరేట్ అవుతాయి.",
    "home.noBillsYet": "ఇంకా బిల్లులు లేవు",
    "home.noRoommates": "ఇంకా రూమ్మేట్లు లేరు. కింద ఒకను జోడించండి.",
    "home.notAssigned": "మీరు ఇంకా ఏ గదిలో నిర్వహించబడలేదు. మీ ప్రాపర్టీ యజమానిని సంప్రదించండి.",
    "home.paymentCompleted": "చెల్లింపు పూర్తయినది",
    "home.people": "జనాలు",
    "home.person": "వ్యక్తి",
    "home.phone": "ఫోన్",
    "home.privateRoom": "ఇది ఒక ప్రైవేట్ గది, ఒక అద్దెదారుకు మాత్రమే కావలసినది.",
    "home.property": "ప్రాపర్టీ",
    "home.propertyText": "{{tenant}} · గది {{room}}",
    "home.recentActivityEmpty": "ఇటీవలి కార్యకలాపం లేదు",
    "home.remaining": "{{amount}} మిగిలిపోయింది",
    "home.remove": "తొలగించు",
    "home.removeRoommateFailed": "రూమ్మేట్ తొలగించడంలో విఫలం",
    "complaint.addComplaint": "ఫిర్యాదు దాఖలు",
    "complaint.addPhotoProof": "ఫోటో ప్రూఫ్ జోడించు",
    "complaint.descriptionPlaceholderEx": "సమస్యను వివరంగా వివరించండి...",
    "complaint.failedSubmit": "ఫిర్యాదు సబ్మిట్ చేయడంలో విఫలం",
    "complaint.internet": "ఇంటర్నెట్/వైఫై",
    "complaint.noComplaintsDesc": "ఇంకా సమస్యలు రెగిస్టర్ కాలేదు. ఫిర్యాదు దాఖలు చేయడానికి + న ట్యాప్ చేయండి.",
    "complaint.noComplaintsTitle": "ఫిర్యాదులు లేవు",
    "complaint.pestControl": "పెస్ట్ కంట్రోల్",
    "complaint.photoAttachment": "ఫోటో అటాచ్మెంట్",
    "complaint.resolution": "పరిష్కారం",
    "complaint.savedOfflineDesc": "ఫిర్యాదు ఈ పరికరంలో సేవ్ అయింది. మీరు మళ్ళీ ఆన్‌లైన్ అయ్యాక స్వయంచాలితంగా సబ్మిట్ అవుతుంది.",
    "complaint.savedOfflineTitle": "ఆఫ్‌లైన్ సేవ్",
    "complaint.subtitle": "సమస్యలను ట్రాక్ చేసి నిర్వహించండి",
    "complaint.titleDescRequired": "శీర్షిక మరియు వివరణ అవసరం",
    "complaint.titlePlaceholderEx": "ఉదాహరణ: లీకింగ్ టాప్",
    "complaintDetail.attachments": "అటాచ్మెంట్లు",
    "complaintDetail.closedPlaceholder": "ఈ ఫిర్యాదు మూసివేసింది.",
    "complaintDetail.commentsTitle": "వ్యాఖ్యలు & అప్డేట్లు",
    "complaintDetail.description": "వివరణ",
    "complaintDetail.goBack": "వెనక్కి వెళ్ళు",
    "complaintDetail.inputPlaceholder": "ఫాలో-అప్ సందేశం జోడించండి...",
    "complaintDetail.noComments": "ఇంకా అప్డేట్లు లేదా వ్యాఖ్యలు లేవు.",
    "complaintDetail.notFound": "ఫిర్యాదు కనుగొనబడలేదు",
    "complaintDetail.raisedOn": "{{date}} న ఎత్తినది",
    "complaintDetail.resolutionNotes": "పరిష్కార గమనికలు",
    "complaintDetail.resolvedAt": "{{date}} న పరిష్కరించబడింది",
    "complaintDetail.statusProgress": "స్థితి పురోగతి",
    "complaintDetail.stepAssigned": "అసైన్ చేయబడింది",
    "complaintDetail.stepInProgress": "ప్రగతిలో ఉంది",
    "complaintDetail.stepRejected": "నిరాకరించబడింది",
    "complaintDetail.stepResolved": "పరిష్కరించబడింది",
    "complaintDetail.stepSubmitted": "సబ్మిట్ చేయబడింది",
    "complaintDetail.title": "ఫిర్యాదు వివరాలు",
    "notifications.loadFailed": "నోటిఫికేషన్లు లోడ్ చేయడంలో విఫలం. మళ్ళీ ప్రయత్నించడానికి పుల్ డౌన్ చేయండి.",
    "notifications.swipeHint": "సూచన: నోటిఫికేషన్‌ను తొలగించడానికి ఎడమవైపుకు స్వైప్ చేయండి",
    "owner.rooms.fieldRoomNumber": "గది నంబర్ *",
    "profile.allFieldsRequired": "అన్ని ఫీల్డ్‌లు అవసరం",
    "profile.appSettings": "ఆప్ సెట్టింగ్‌లు",
    "profile.changePassword": "పాస్‌వర్డ్ మార్చు",
    "profile.changePasswordFailed": "పాస్‌వర్డ్ మార్చడంలో విఫలం",
    "profile.confirmNewPassword": "కొత్త పాస్‌వర్డ్ ని ధృవీకరించండి",
    "profile.confirmNewPasswordPlaceholder": "కొత్త పాస్‌వర్డ్ ని ధృవీకరించండి",
    "profile.currentPassword": "ప్రస్తుత పాస్‌వర్డ్",
    "profile.enterCurrentPassword": "ప్రస్తుత పాస్‌వర్డ్ నమోదు చేయండి",
    "profile.enterEmail": "మీ ఇమెయిల్ నమోదు చేయండి",
    "profile.enterName": "మీ పేరు నమోదు చేయండి",
    "profile.enterNewPassword": "కొత్త పాస్‌వర్డ్ నమోదు చేయండి",
    "profile.enterPhone": "మీ ఫోన్ నమోదు చేయండి",
    "profile.legal": "చట్టపరమైన",
    "profile.nameEmailRequired": "పేరు మరియు ఇమెయిల్ అవసరం",
    "profile.newPassword": "కొత్త పాస్‌వర్డ్",
    "profile.passwordChanged": "పాస్‌వర్డ్ విజయవంతంగా మార్చబడింది",
    "profile.passwordsMismatch": "కొత్త పాస్‌వర్డ్‌లు సరిపోలలేదు",
    "profile.privacyPolicy": "గోప్యతా విధానం",
    "profile.quickLinks": "త్వరిత లింకులు",
    "profile.savedOfflineBody": "ప్రొఫైల్ ఈ పరికరంలో అప్డేట్ అయింది. మీరు మళ్ళీ ఆన్‌లైన్ అయ్యాక స్వయంచాలితంగా సింక్ అవుతుంది.",
    "profile.savedOfflineTitle": "ఆఫ్‌లైన్ సేవ్",
    "profile.security": "భద్రత",
    "profile.signOut": "సైన్ అవుట్",
    "profile.subtitle": "మీ ఖాతాను నిర్వహించండి",
    "profile.termsOfService": "సేవా నిబంధనలు",
    "rent.paymentMethod": "చెల్లింపు పద్ధతి",
    "rent.paymentMethodPlaceholder": "చెల్లింపు పద్ధతిని ఎంచుకోండి",
    "rent.transactionHistory": "లావాదేవీ చరిత్ర",
    "settings.shareErrorMsg": "ఆప్ లింక్ షేర్ చేయడం విఫలం. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    "tabs.dashboardDesc": "ఈ నెలకు సేకరించిన వసూళ్ళు, ముందుకు బకాయీలు, నికomal లాభం స్నాప్షాట్ చూడండి.",
    "tabs.homeDesc": "హోమ్ స్క్రీన్ పై మీ ప్రస్తుత వాటక బిల్లు, జాబిలియా తేదీ, చెల్లింపు స్థితిని చూడండి.",
    "tabs.paymentsDesc": "అన్ని వాటకి రికార్డులను సమీక్షించండి, లెక్కలను ధృవీకరించండి మరియు సేకరించినవి vs బకాయీలను ట్రాక్ చేయండి.",
    "tabs.profileDesc": "మీ ఖాతా, UPI/QR వివరాలు, సెట్టింగ్‌లు మరియు గోప్యతను నిర్వహించండి.",
    "tabs.propertiesDesc": "మీ అన్ని భవనాలను నిర్వహించండి, కొత్త ఆస్తులు జోడించండి మరియు వివరాలను అప్డేట్ చేయండి.",
    "tabs.requestsDesc": "అనుష్ఠాన అభ్యర్థనలు మరియు ఫిర్యాదులను ఎంచుకుని లైవ్ అప్డేట్‌లతో ట్రాక్ చేయండి.",
    "tabs.tenantsDesc": "సక్రియ అద్దెదారులను చూడండి, ఎంట్రీ, ఎగురుతున్నది, రిఫండ్‌లను నిర్వహించండి.",
    "transactions.methodCash": "నగదు",
    "transactions.methodOnline": "ఆన్‌లైన్",
    "transactions.methodOther": "ఇతర",
    "transactions.statusCompleted": "పూర్తయినది",
    "transactions.statusFailed": "విఫలం",
    "transactions.statusReversed": "అనధికారికంగా మార్చబడింది",
    "transactions.statusVerifying": "సరిచూస్తోంది"
}

# Apply Telugu translations
with open('te.json', encoding='utf-8') as f:
    te = json.load(f)

for key, value in te_translations.items():
    set_nested(te, key, value)

with open('te.json', 'w', encoding='utf-8') as f:
    json.dump(te, f, ensure_ascii=False, indent=2)
print('te.json updated with Telugu translations')

# For other languages, add missing keys with English fallback
for fname in ['hi.json', 'ta.json', 'kn.json', 'ml.json']:
    data = load_json(fname)
    lang_flat = flatten(data)
    missing = sorted(en_flat.keys() - lang_flat.keys())
    if len(missing) > 0:
        print(fname + ': adding ' + str(len(missing)) + ' missing keys')
        for key in missing:
            set_nested(data, key, en_flat[key])
        with open(fname, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    else:
        print(fname + ': no missing keys')

print('Done')
