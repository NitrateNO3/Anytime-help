/**
 * Localization helpers for Categories, Subcategories, and multi-language switching
 */

export const getNextLanguage = (currentLang: string): string => {
  if (currentLang === 'en') return 'hi';
  if (currentLang === 'hi') return 'hinglish';
  return 'en';
};

export const getLanguageBadge = (lang: string): string => {
  if (lang === 'hi') return 'हिंदी';
  if (lang === 'hinglish') return 'Hinglish';
  return 'EN';
};

export const getLanguageDisplayName = (lang: string): string => {
  if (lang === 'hi') return 'हिंदी (Hindi)';
  if (lang === 'hinglish') return 'Hinglish';
  return 'English';
};

export const getLocalizedCategoryTitle = (cat: any, lang: string): string => {
  if (!cat) return '';
  if (lang === 'hi') {
    return cat.title_hi || cat.title_hinglish || cat.title || '';
  }
  if (lang === 'hinglish') {
    return cat.title_hinglish || cat.title_hi || cat.title || '';
  }
  return cat.title || '';
};

export const getLocalizedSubCategoryTitle = (cat: any, sub: string, lang: string): string => {
  if (!cat || !sub) return sub || '';

  // Look inside subCategoriesDetails if available
  if (Array.isArray(cat.subCategoriesDetails) && cat.subCategoriesDetails.length > 0) {
    const found = cat.subCategoriesDetails.find((d: any) => d.en === sub || d.title === sub);
    if (found) {
      if (lang === 'hi') return found.hi || found.hinglish || found.en || sub;
      if (lang === 'hinglish') return found.hinglish || found.hi || found.en || sub;
      return found.en || sub;
    }
  }

  return sub;
};
