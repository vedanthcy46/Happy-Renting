'use strict';

/**
 * backend i18n.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized, language-aware string resolution for the backend so that push
 * notifications, emails, WhatsApp templates and AI follow the user's
 * `preferredLanguage` (default 'en'). Supported languages:
 *   en (English), kn (Kannada), hi (Hindi), ta (Tamil), te (Telugu), ml (Malayalam)
 *
 * Design notes:
 *  - Lightweight, dependency-free (no i18next on the server).
 *  - Keys are flat strings with {{placeholder}} tokens substituted by `t`.
 *  - `t(key, { variables }, language)` resolves a key across all languages and
 *    substitutes {{placeholder}} tokens so callers never hardcode user-facing text.
 *  - Missing language always degrades gracefully to English, then to the key.
 */

const SUPPORTED_LANGUAGES = ['en', 'kn', 'hi', 'ta', 'te', 'ml'];

const DICTIONARY = {
  /* ── Rent reminders & payments ─────────────────────────────────── */
  'reminder.dueTomorrow.title': {
    en: 'Rent Due Tomorrow',
    kn: 'ನಾಳೆ ಬಾಡಿಗೆ ಗಡುವು',
    hi: 'कल किराया देय है',
    ta: 'நாளை வாடகை செலுத்த வேண்டும்',
    te: 'రేపు అద్దె చెల్లించాలి',
    ml: 'നാളെ വാടക നൽകണം',
  },
  'reminder.dueTomorrow.body': {
    en: 'Rent of ₹{{amount}} for {{month}} is due tomorrow.',
    kn: '{{month}} ತಿಂಗಳ ಬಾಡಿಗೆ ₹{{amount}} ನಾಳೆ ಗಡುವು.',
    hi: '{{month}} का ₹{{amount}} किराया कल देय है।',
    ta: '{{month}} மாத வாடகை ₹{{amount}} நாளை செலுத்த வேண்டும்.',
    te: '{{month}} నెల అద్దె ₹{{amount}} రేపు చెల్లించాలి.',
    ml: '{{month}} മാസത്തെ ₹{{amount}} വാടക നാളെ നൽകണം.',
  },
  'reminder.dueToday.title': {
    en: 'Rent Due Today',
    kn: 'ಇಂದು ಬಾಡಿಗೆ ಗಡುವು',
    hi: 'आज किराया देय है',
    ta: 'இன்று வாடகை செலுத்த வேண்டும்',
    te: 'ఈరోజు అద్దె చెల్లించాలి',
    ml: 'ഇന്ന് വാടക നൽകണം',
  },
  'reminder.overdue.title': {
    en: 'Rent Overdue',
    kn: 'ಬಾಡಿಗೆ ವಿಳಂಬವಾಗಿದೆ',
    hi: 'किराया अतिदेय है',
    ta: 'வாடகை நிலுவை',
    te: 'అద్దె బాకీ',
    ml: 'വാടക കുടിശ്ശിക',
  },
  'reminder.overdue.body': {
    en: 'Your rent of ₹{{amount}} for {{month}} is overdue. Please pay at the earliest.',
    kn: '{{month}} ತಿಂಗಳ ಬಾಡಿಗೆ ₹{{amount}} ವಿಳಂಬವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ಪಾವತಿಸಿ.',
    hi: '{{month}} का ₹{{amount}} किराया अतिदेय है। कृपया जल्द से जल्द भुगतान करें।',
    ta: '{{month}} மாத வாடகை ₹{{amount}} நிலுவையில் உள்ளது. தயவுசெய்து விரைவில் செலுத்தவும்.',
    te: '{{month}} నెల అద్దె ₹{{amount}} బాకీ ఉంది. దయచేసి వీలైనంత త్వరగా చెల్లించండి.',
    ml: '{{month}} മാസത്തെ ₹{{amount}} വാടക കുടിശ്ശികയാണ്. ദയവായി ഉടൻ നൽകുക.',
  },
  'reminder.rentReminder.title': {
    en: 'Rent Reminder',
    kn: 'ಬಾಡಿಗೆ ಜ್ಞಾಪನೆ',
    hi: 'किराया अनुस्मारक',
    ta: 'வாடகை நினைவூட்டல்',
    te: 'అద్దె రిమైండర్',
    ml: 'വാടക ഓർമ്മപ്പെടുത്തൽ',
  },
  'reminder.rentReminder.body': {
    en: 'Your rent of ₹{{amount}} for {{month}} is still pending. Please pay at the earliest.',
    kn: '{{month}} ತಿಂಗಳ ಬಾಡಿಗೆ ₹{{amount}} ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ಪಾವತಿಸಿ.',
    hi: '{{month}} का ₹{{amount}} किराया अभी भी बकाया है। कृपया जल्द से जल्द भुगतान करें।',
    ta: '{{month}} மாத வாடகை ₹{{amount}} இன்னும் நிலுவையில் உள்ளது. தயவுசெய்து விரைவில் செலுத்தவும்.',
    te: '{{month}} నెల అద్దె ₹{{amount}} ఇంకా బాకీ ఉంది. దయచేసి వీలైనంత త్వరగా చెల్లించండి.',
    ml: '{{month}} മാസത്തെ ₹{{amount}} വാടക ഇനിയും ബാക്കിയുണ്ട്. ദയവായി ഉടൻ നൽകുക.',
  },
  'payment.received.title': {
    en: 'Payment Received',
    kn: 'ಪಾವತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ',
    hi: 'भुगतान प्राप्त हुआ',
    ta: 'கட்டணம் பெறப்பட்டது',
    te: 'చెల్లింపు అందింది',
    ml: 'പണമടവ് സ്വീകരിച്ചു',
  },
  'payment.verified.title': {
    en: 'Rent Payment Verified',
    kn: 'ಬಾಡಿಗೆ ಪಾವತಿ ದೃಢೀಕರಿಸಲಾಗಿದೆ',
    hi: 'किराया भुगतान सत्यापित किया गया',
    ta: 'வாடகை செலுத்தம் சரிபார்க்கப்பட்டது',
    te: 'అద్దె చెల్లింపు ధృవీకరించబడింది',
    ml: 'വാടക നൽകൽ സ്ഥിരീകരിച്ചു',
  },
  'payment.issue.title': {
    en: 'Rent Payment Issue',
    kn: 'ಬಾಡಿಗೆ ಪಾವತಿ ಸಮಸ್ಯೆ',
    hi: 'किराया भुगतान में समस्या',
    ta: 'வாடகை செலுத்தத்தில் சிக்கல்',
    te: 'అద్దె చెల్లింపులో సమస్య',
    ml: 'വാടക നൽകലിൽ പ്രശ്നം',
  },
  'payment.body.recorded': {
    en: 'Your payment of ₹{{amount}} for {{month}} has been recorded.',
    kn: '{{month}} ತಿಂಗಳ ಬಾಡಿಗೆ ₹{{amount}} ಪಾವತಿ ದಾಖಲಿಸಲಾಗಿದೆ.',
    hi: '{{month}} का ₹{{amount}} भुगतान दर्ज कर लिया गया है।',
    ta: '{{month}} மாத வாடகை ₹{{amount}} உங்கள் செலுத்தம் பதிவு செய்யப்பட்டது.',
    te: '{{month}} నెల అద్దె ₹{{amount}} చెల్లింపు నమోదు చేయబడింది.',
    ml: '{{month}} മാസത്തെ ₹{{amount}} വാടക നൽകൽ രേഖപ്പെടുത്തിയിരിക്കുന്നു.',
  },

  /* ── complaints ───────────────────────────────────────────────── */
  'complaint.new.title': {
    en: 'New Complaint',
    kn: 'ಹೊಸ ದೂರು',
    hi: 'नई शिकायत',
    ta: 'புதிய புகார்',
    te: 'కొత్త ఫిర్యాదు',
    ml: 'പുതിയ പരാതി',
  },
  'complaint.new.body': {
    en: '{{title}}',
    kn: '{{title}}',
    hi: '{{title}}',
    ta: '{{title}}',
    te: '{{title}}',
    ml: '{{title}}',
  },
  'complaint.resolved.title': {
    en: 'Complaint Resolved',
    kn: 'ದೂರು ಪರಿಹರಿಸಲಾಗಿದೆ',
    hi: 'शिकायत हल हो गई',
    ta: 'புகார் தீர்க்கப்பட்டது',
    te: 'ఫిర్యాదు పరిష్కరించబడింది',
    ml: 'പരാതി പരിഹരിച്ചു',
  },

  /* ── misc / generic ───────────────────────────────────────────── */
  'notification.generic.body': {
    en: 'You have a new notification.',
    kn: 'ನಿಮಗೆ ಹೊಸ ಅಧಿಸೂಚನೆ ಇದೆ.',
    hi: 'आपके पास एक नई सूचना है।',
    ta: 'உங்களுக்கு ஒரு புதிய அறிவிப்பு உள்ளது.',
    te: 'మీకు కొత్త నోటిఫికేషన్ ఉంది.',
    ml: 'നിങ്ങൾക്ക് ഒരു പുതിയ അറിയിപ്പ് ഉണ്ട്.',
  },
  'billing.completed': {
    en: 'Billing cycle for {{month}} completed: {{count}} bills generated.',
    kn: '{{month}} ಬಿಲ್ಲಿಂಗ್ ಸೈಕಲ್ ಪೂರ್ಣಗೊಂಡಿದೆ: {{count}} ಬಿಲ್ಗಳನ್ನು ರಚಿಸಲಾಗಿದೆ.',
    hi: '{{month}} की बिलिंग साइकिल पूरी हुई: {{count}} बिल बनाए गए।',
    ta: '{{month}} பில்லிங் சுழற்சி முடிந்தது: {{count}} பில்கள் உருவாக்கப்பட்டன.',
    te: '{{month}} బిల్లింగ్ చక్రం పూర్తయింది: {{count}} బిల్లులు రూపొందించబడ్డాయి.',
    ml: '{{month}} ബില്ലിംഗ് സൈക്കിൾ പൂർത്തിയായി: {{count}} ബില്ലുകൾ സൃഷ്ടിച്ചു.',
  },

  /* ── drafts / WhatsApp ─────────────────────────────────────────── */
  'whatsapp.reminder': {
    en: 'Dear {{name}} (Room {{room}}), your rent for {{month}} of Rs.{{amount}} is still pending. Kindly pay at the earliest. - Happy Renting',
    kn: 'ಪ್ರಿಯ {{name}} (ಕೊಠಡಿ {{room}}), ನಿಮ್ಮ {{month}} ತಿಂಗಳ ಬಾಡಿಗೆ ₹{{amount}} ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ಪಾವತಿಸಿ. - ಹ್ಯಾಪಿ ರೆಂಟಿಂಗ್',
    hi: 'प्रिय {{name}} (कमरा {{room}}), आपका {{month}} का ₹{{amount}} किराया अभी भी बकाया है। कृपया जल्द से जल्द भुगतान करें। - हैपी रेंटिंग',
    ta: 'அன்புள்ள {{name}} (அறை {{room}}), உங்கள் {{month}} மாத வாடகை ₹{{amount}} இன்னும் நிலுவையில் உள்ளது. தயவுசெய்து விரைவில் செலுத்தவும். - Happy Renting',
    te: 'ప్రియమైన {{name}} (గది {{room}}), మీ {{month}} నెల అద్దె ₹{{amount}} ఇంకా బాకీ ఉంది. దయచేసి వీలైనంత త్వరగా చెల్లించండి. - హ్యాపీ రెంటింగ్',
    ml: 'ബഹുമാനപ്പെട്ട {{name}} (മുറി {{room}}), നിങ്ങളുടെ {{month}} മാസത്തെ ₹{{amount}} വാടക ഇനിയും ബാക്കിയുണ്ട്. ദയവായി ഉടൻ നൽകുക. - ഹാപ്പി റെന്റിംഗ്',
  },

  /* ── months (used in WhatsApp/reminders, human friendly) ─────────── */
  'monthJan': { en: 'January', kn: 'ಜನವರಿ', hi: 'जनवरी', ta: 'ஜனவரி', te: 'జనవరి', ml: 'ജനുവരി' },
  'monthFeb': { en: 'February', kn: 'ಫೆಬ್ರವರಿ', hi: 'फ़रवरी', ta: 'பிப்ரவரி', te: 'ఫిబ్రవరి', ml: 'ഫെബ്രുവരി' },
  'monthMar': { en: 'March', kn: 'ಮಾರ್ಚ್', hi: 'मार्च', ta: 'மார்ச்', te: 'మార్చి', ml: 'മാർച്ച്' },
  'monthApr': { en: 'April', kn: 'ಏಪ್ರಿಲ್', hi: 'अप्रैल', ta: 'ஏப்ரல்', te: 'ఏప్రిల్', ml: 'ഏപ്രിൽ' },
  'monthMay': { en: 'May', kn: 'ಮೇ', hi: 'मई', ta: 'மே', te: 'మే', ml: 'മേയ്' },
  'monthJun': { en: 'June', kn: 'ಜೂನ್', hi: 'जून', ta: 'ஜூன்', te: 'జూన్', ml: 'ജൂൺ' },
  'monthJul': { en: 'July', kn: 'ಜುಲೈ', hi: 'जुलाई', ta: 'ஜூலை', te: 'జూలై', ml: 'ജൂലൈ' },
  'monthAug': { en: 'August', kn: 'ಆಗಸ್ಟ್', hi: 'अगस्त', ta: 'ஆகஸ்ட்', te: 'ఆగస్టు', ml: 'ഓഗസ്റ്റ്' },
  'monthSep': { en: 'September', kn: 'ಸೆಪ್ಟೆಂಬರ್', hi: 'सितंबर', ta: 'செப்டம்பர்', te: 'సెప్టెంబర్', ml: 'സെപ്റ്റംബർ' },
  'monthOct': { en: 'October', kn: 'ಅಕ್ಟೋಬರ್', hi: 'अक्टूबर', ta: 'அக்டோபர்', te: 'అక్టోబర్', ml: 'ഒക്ടോബർ' },
  'monthNov': { en: 'November', kn: 'ನವೆಂಬರ್', hi: 'नवंबर', ta: 'நவம்பர்', te: 'నవంబర్', ml: 'നവംബർ' },
  'monthDec': { en: 'December', kn: 'ಡಿಸೆಂಬರ್', hi: 'दिसंबर', ta: 'டிசம்பர்', te: 'డిసెంబర్', ml: 'ഡിസംബർ' },
};

/** Resolve a translated string with {{placeholder}} variable interpolation. */
function t(key, vars, language) {
  const lang = normalizeLanguage(language);
  const entry = DICTIONARY[key];
  let str = entry ? entry[lang] : key;
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (m, name) => {
    return vars[name] !== undefined ? String(vars[name]) : m;
  });
}

/** Normalize a raw user language value to a supported code, falling back to en. */
function normalizeLanguage(language) {
  if (!language) return 'en';
  const code = String(language).toLowerCase().split('-')[0].split('_')[0];
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'en';
}

/** Helper: translate a month key (e.g. '2026-08') to the user's language. */
function translateMonth(monthKey, language) {
  if (!monthKey) return monthKey || '';
  const match = String(monthKey).match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(monthKey);
  const [, year, m] = match;
  const key = 'month' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
  return `${t(key, null, language)} ${year}`;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  t,
  normalizeLanguage,
  translateMonth,
  DICTIONARY,
};
