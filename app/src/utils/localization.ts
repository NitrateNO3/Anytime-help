/**
 * Localization helpers for Categories & Subcategories (English & Hindi)
 */

export const getNextLanguage = (currentLang: string): string => {
  return currentLang === 'hi' ? 'en' : 'hi';
};

export const getLanguageBadge = (lang: string): string => {
  return lang === 'hi' ? 'हिंदी' : 'EN';
};

export const getLanguageDisplayName = (lang: string): string => {
  return lang === 'hi' ? 'हिंदी (Hindi)' : 'English';
};


export const CATEGORY_TRANSLATIONS: Record<string, { hi: string; en: string }> = {
  'tree trimming': { hi: 'पेड़ की कटाई', en: 'Tree trimming' },
  'tree cutting': { hi: 'पेड़ काटना', en: 'Tree cutting' },
  'rainwater drainage': { hi: 'वर्षा जल निकासी', en: 'Rainwater drainage' },
  'water drainage': { hi: 'जल निकासी', en: 'Water drainage' },
  'water service': { hi: 'जल सेवा', en: 'Water service' },
  'street light': { hi: 'स्ट्रीट लाइट', en: 'Street light' },
  'garbage': { hi: 'कचरा', en: 'Garbage' },
  'sweeping': { hi: 'सफाई', en: 'Sweeping' },
  'sewage cleaning': { hi: 'सीवेज सफाई', en: 'Sewage cleaning' },
  'electricity': { hi: 'बिजली', en: 'Electricity' },
  'security': { hi: 'सुरक्षा', en: 'Security' },
  'lift': { hi: 'लिफ्ट', en: 'Lift' },
  'plumbing': { hi: 'प्लंबिंग', en: 'Plumbing' },
  'park': { hi: 'पार्क', en: 'Park' },
  'park complaints': { hi: 'पार्क शिकायतें', en: 'Park complaints' },
  'others': { hi: 'अन्य', en: 'Others' },
  'other': { hi: 'अन्य', en: 'Other' },
  // Reverse translations (Hindi to English)
  'पेड़ की कटाई': { hi: 'पेड़ की कटाई', en: 'Tree trimming' },
  'पेड़ काटना': { hi: 'पेड़ काटना', en: 'Tree cutting' },
  'वर्षा जल निकासी': { hi: 'वर्षा जल निकासी', en: 'Rainwater drainage' },
  'जल निकासी': { hi: 'जल निकासी', en: 'Water drainage' },
  'जल सेवा': { hi: 'जल सेवा', en: 'Water service' },
  'स्ट्रीट लाइट': { hi: 'स्ट्रीट लाइट', en: 'Street light' },
  'कचरा': { hi: 'कचरा', en: 'Garbage' },
  'सफाई': { hi: 'सफाई', en: 'Sweeping' },
  'सीवेज सफाई': { hi: 'सीवेज सफाई', en: 'Sewage cleaning' },
  'बिजली': { hi: 'बिजली', en: 'Electricity' },
  'सुरक्षा': { hi: 'सुरक्षा', en: 'Security' },
  'लिफ्ट': { hi: 'लिफ्ट', en: 'Lift' },
  'प्लंबिंग': { hi: 'प्लंबिंग', en: 'Plumbing' },
  'पार्क': { hi: 'पार्क', en: 'Park' },
  'पार्क शिकायतें': { hi: 'पार्क शिकायतें', en: 'Park complaints' },
  'अन्य': { hi: 'अन्य', en: 'Others' }
};

export const SUBCATEGORY_TRANSLATIONS: Record<string, { hi: string; en: string }> = {
  'fallen tree': { hi: 'गिरा हुआ पेड़', en: 'Fallen Tree' },
  'overgrown branches': { hi: 'बढ़ी हुई टहनियाँ', en: 'Overgrown Branches' },
  'branches': { hi: 'टहनियाँ', en: 'Branches' },
  'pruning': { hi: 'छंटाई', en: 'Pruning' },
  'trimming': { hi: 'कटाई', en: 'Trimming' },
  'tree trimming': { hi: 'पेड़ की कटाई', en: 'Tree trimming' },
  'tree cutting': { hi: 'पेड़ काटना', en: 'Tree cutting' },
  'water logging': { hi: 'पानी भरना (जलभराव)', en: 'Water Logging' },
  'broken drain cover': { hi: 'नाली का ढक्कन टूटा', en: 'Broken Drain Cover' },
  'not working': { hi: 'काम नहीं कर रही', en: 'Not Working' },
  'flickering': { hi: 'लाइट टिमटिमा रही है', en: 'Flickering' },
  'pole damaged': { hi: 'खंभा क्षतिग्रस्त', en: 'Pole Damaged' },
  'no water supply': { hi: 'पानी की आपूर्ति नहीं', en: 'No Water Supply' },
  'contaminated water': { hi: 'दूषित पानी', en: 'Contaminated Water' },
  'pipeline leakage': { hi: 'पाइपलाइन लीकेज', en: 'Pipeline Leakage' },
  'waste overflow': { hi: 'कचरा फैलना', en: 'Waste Overflow' },
  'bin damaged': { hi: 'कूड़ेदान क्षतिग्रस्त', en: 'Bin Damaged' },
  'door to door pending': { hi: 'डोर-टू-डोर पेंडिंग', en: 'Door to Door Pending' },
  'drain blockage': { hi: 'नाली जाम', en: 'Drain Blockage' },
  'manhole open': { hi: 'मैनहोल खुला है', en: 'Manhole Open' },
  'other': { hi: 'अन्य', en: 'Other' },
  'others': { hi: 'अन्य', en: 'Others' },
  // Reverse translations (Hindi to English)
  'गिरा हुआ पेड़': { hi: 'गिरा हुआ पेड़', en: 'Fallen Tree' },
  'बढ़ी हुई टहनियाँ': { hi: 'बढ़ी हुई टहनियाँ', en: 'Overgrown Branches' },
  'टहनियाँ': { hi: 'टहनियाँ', en: 'Branches' },
  'छंटाई': { hi: 'छंटाई', en: 'Pruning' },
  'कटाई': { hi: 'कटाई', en: 'Trimming' },
  'पानी भरना (जलभराव)': { hi: 'पानी भरना (जलभराव)', en: 'Water Logging' },
  'नाली का ढक्कन टूटा': { hi: 'नाली का ढक्कन टूटा', en: 'Broken Drain Cover' },
  'काम नहीं कर रही': { hi: 'काम नहीं कर रही', en: 'Not Working' },
  'लाइट टिमटिमा रही है': { hi: 'लाइट टिमटिमा रही है', en: 'Flickering' },
  'खंभा क्षतिग्रस्त': { hi: 'खंभा क्षतिग्रस्त', en: 'Pole Damaged' },
  'पानी की आपूर्ति नहीं': { hi: 'पानी की आपूर्ति नहीं', en: 'No Water Supply' },
  'दूषित पानी': { hi: 'दूषित पानी', en: 'Contaminated Water' },
  'पाइपलाइन लीकेज': { hi: 'पाइपलाइन लीकेज', en: 'Pipeline Leakage' },
  'कचरा फैलना': { hi: 'कचरा फैलना', en: 'Waste Overflow' },
  'कूड़ेदान क्षतिग्रस्त': { hi: 'कूड़ेदान क्षतिग्रस्त', en: 'Bin Damaged' },
  'डोर-टू-डोर पेंडिंग': { hi: 'डोर-टू-डोर पेंडिंग', en: 'Door to Door Pending' },
  'नाली जाम': { hi: 'नाली जाम', en: 'Drain Blockage' },
  'मैनहोल खुला है': { hi: 'मैनहोल खुला है', en: 'Manhole Open' },
  'सीवर ओवरफ्लो': { hi: 'सीवर ओवरफ्लो', en: 'Sewer Overflow' },
  'कोई अन्य शिकायत': { hi: 'कोई अन्य शिकायत', en: 'Any Other Complaint' },
  'सड़क की सफाई नहीं हुई': { hi: 'सड़क की सफाई नहीं हुई', en: 'Road Not Swept' }
};

export const getLocalizedCategoryTitle = (cat: any, lang: string): string => {
  if (!cat) return '';
  const title = typeof cat === 'string' ? cat : (cat.title || '');
  const title_hi = typeof cat === 'object' ? (cat.title_hi || '') : '';

  if (lang === 'hi') {
    if (title_hi && title_hi.trim().length > 0) {
      return title_hi.trim();
    }
    const key = title.trim().toLowerCase();
    if (CATEGORY_TRANSLATIONS[key]?.hi) {
      return CATEGORY_TRANSLATIONS[key].hi;
    }
    return title;
  }
  
  // English mode
  const key = title.trim().toLowerCase();
  if (CATEGORY_TRANSLATIONS[key]?.en) {
    return CATEGORY_TRANSLATIONS[key].en;
  }
  return title;
};

export const getLocalizedSubCategoryTitle = (cat: any, sub: string, lang: string): string => {
  if (!sub) return '';

  if (lang === 'hi') {
    // 1. Look inside subCategoriesDetails if available
    if (cat && Array.isArray(cat.subCategoriesDetails) && cat.subCategoriesDetails.length > 0) {
      const found = cat.subCategoriesDetails.find((d: any) => 
        (d.en && d.en.trim().toLowerCase() === sub.trim().toLowerCase()) ||
        (d.title && d.title.trim().toLowerCase() === sub.trim().toLowerCase()) ||
        (d.hi && d.hi.trim() === sub.trim())
      );
      if (found && found.hi && found.hi.trim().length > 0) {
        return found.hi.trim();
      }
    }
    // 2. Look in subcategory dictionary
    const key = sub.trim().toLowerCase();
    if (SUBCATEGORY_TRANSLATIONS[key]?.hi) {
      return SUBCATEGORY_TRANSLATIONS[key].hi;
    }
    if (CATEGORY_TRANSLATIONS[key]?.hi) {
      return CATEGORY_TRANSLATIONS[key].hi;
    }
    return sub;
  }

  // English mode
  const key = sub.trim().toLowerCase();
  if (SUBCATEGORY_TRANSLATIONS[key]?.en) {
    return SUBCATEGORY_TRANSLATIONS[key].en;
  }
  if (CATEGORY_TRANSLATIONS[key]?.en) {
    return CATEGORY_TRANSLATIONS[key].en;
  }
  
  return sub;
};

export const ROLE_TRANSLATIONS: Record<string, { hi: string; en: string }> = {
  'president': { hi: 'अध्यक्ष', en: 'President' },
  'vp': { hi: 'उपाध्यक्ष', en: 'VP' },
  'vice-president': { hi: 'उपाध्यक्ष', en: 'Vice-President' },
  'vice president': { hi: 'उपाध्यक्ष', en: 'Vice President' },
  'general secretary': { hi: 'महासचिव', en: 'General Secretary' },
  'g.secretary': { hi: 'महासचिव', en: 'G.Secretary' },
  'asstt. gen. secretary': { hi: 'सहायक महासचिव', en: 'Asstt. Gen. Secretary' },
  'asst. secretary': { hi: 'सहायक सचिव', en: 'Asst. Secretary' },
  'treasurer': { hi: 'कोषाध्यक्ष', en: 'Treasurer' },
  'executive': { hi: 'कार्यकारी', en: 'Executive' },
  
  // Reverse translations (Hindi to English)
  'अध्यक्ष': { hi: 'अध्यक्ष', en: 'President' },
  'उपाध्यक्ष': { hi: 'उपाध्यक्ष', en: 'Vice President' },
  'महासचिव': { hi: 'महासचिव', en: 'General Secretary' },
  'सहायक महासचिव': { hi: 'सहायक महासचिव', en: 'Asstt. Gen. Secretary' },
  'सहायक सचिव': { hi: 'सहायक सचिव', en: 'Asst. Secretary' },
  'कोषाध्यक्ष': { hi: 'कोषाध्यक्ष', en: 'Treasurer' },
  'कार्यकारी': { hi: 'कार्यकारी', en: 'Executive' }
};

export const getLocalizedRole = (role: string, lang: string): string => {
  if (!role) return '';
  const key = role.trim().toLowerCase();
  
  if (lang === 'hi') {
    if (ROLE_TRANSLATIONS[key]?.hi) {
      return ROLE_TRANSLATIONS[key].hi;
    }
    return role;
  }
  
  // English mode
  if (ROLE_TRANSLATIONS[key]?.en) {
    return ROLE_TRANSLATIONS[key].en;
  }
  return role;
};

export const getLocalizedNameWithRole = (name: string, lang: string): string => {
  if (!name) return '';
  // Always try to translate roles found inside parentheses, regardless of lang direction.
  const match = name.match(/\((.*?)\)/);
  if (match && match[1]) {
    const originalRole = match[1];
    const translatedRole = getLocalizedRole(originalRole, lang);
    if (translatedRole !== originalRole) {
      return name.replace(`(${originalRole})`, `(${translatedRole})`);
    }
  }
  return name;
};

export const getLocalizedAddress = (address: string, lang: string): string => {
  if (!address) return '';
  if (lang === 'hi') {
    let trans = address;
    trans = trans.replace(/House\/Flat:/gi, 'मकान/फ्लैट:');
    trans = trans.replace(/Floor/gi, 'मंजिल');
    trans = trans.replace(/Block/gi, 'ब्लॉक');
    trans = trans.replace(/\(Owned\)/gi, '(मालिक)');
    trans = trans.replace(/\(Rented\)/gi, '(किरायेदार)');
    trans = trans.replace(/1ST/gi, 'पहली');
    trans = trans.replace(/2ND/gi, 'दूसरी');
    trans = trans.replace(/3RD/gi, 'तीसरी');
    trans = trans.replace(/4TH/gi, 'चौथी');
    return trans;
  } else {
    // Revert to English from Hindi
    let trans = address;
    trans = trans.replace(/मकान\/फ्लैट:/gi, 'House/Flat:');
    trans = trans.replace(/मंजिल/gi, 'Floor');
    trans = trans.replace(/ब्लॉक/gi, 'Block');
    trans = trans.replace(/\(मालिक\)/gi, '(Owned)');
    trans = trans.replace(/\(किरायेदार\)/gi, '(Rented)');
    trans = trans.replace(/पहली/gi, '1st');
    trans = trans.replace(/दूसरी/gi, '2nd');
    trans = trans.replace(/तीसरी/gi, '3rd');
    trans = trans.replace(/चौथी/gi, '4th');
    return trans;
  }
  return address;
};
