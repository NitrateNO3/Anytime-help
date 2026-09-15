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
  'others': { hi: 'अन्य', en: 'Others' },
  'other': { hi: 'अन्य', en: 'Other' },
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

  return sub;
};
