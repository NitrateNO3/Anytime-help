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

export const getLocalizedCategoryTitle = (cat: any, lang: string): string => {
  if (!cat) return '';
  if (lang === 'hi') {
    return cat.title_hi || cat.title || '';
  }
  return cat.title || '';
};

export const getLocalizedSubCategoryTitle = (cat: any, sub: string, lang: string): string => {
  if (!cat || !sub) return sub || '';

  // Look inside subCategoriesDetails if available
  if (Array.isArray(cat.subCategoriesDetails) && cat.subCategoriesDetails.length > 0) {
    const found = cat.subCategoriesDetails.find((d: any) => 
      d.en === sub || d.hi === sub || d.title === sub
    );
    if (found) {
      if (lang === 'hi') return found.hi || found.en || sub;
      return found.en || found.hi || sub;
    }
  }

  return sub;
};
