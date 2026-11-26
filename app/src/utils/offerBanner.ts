// Offer details page for home header banners.
// The home screen already has the banner, so it is handed over here and the page
// opens instantly; the page then refreshes it from the server by id.

export interface BannerOffer {
  enabled?: boolean;
  theme?: string;
  tag?: string;
  title?: string;
  description?: string;
  partnerName?: string;
  partnerVerified?: boolean;
  distance?: string;
  rating?: number | null;
  ratingCount?: number | null;
  points?: string[];
  validText?: string;
  address?: string;
  mapLink?: string;
  phone?: string;
  terms?: string[];
  footerLabel?: string;
  ctaLabel?: string;
  ctaLink?: string;
  couponCode?: string;
}

export interface OfferBanner {
  _id: string;
  title?: string;
  url?: string;
  style?: 'image' | 'card';
  tag?: string;
  subtitle?: string;
  ctaLabel?: string;
  icon?: string;
  expiresAt?: string | null;
  offer?: BannerOffer;
}

const cache = new Map<string, OfferBanner>();

export const rememberOfferBanner = (b: OfferBanner) => {
  if (b?._id) cache.set(b._id, b);
};

export const cachedOfferBanner = (id?: string) => (id ? cache.get(id) : undefined);

export const hasOfferPage = (b: any) => !!(b?._id && b?.offer?.enabled && b?.offer?.title);

// Same keys as the admin panel and backend/routes/staffBanners.js
export const OFFER_THEMES: Record<string, { hero: [string, string]; accent: string; tagBg: string; tagText: string }> = {
  teal: { hero: ['#0D3346', '#1C6A66'], accent: '#0F766E', tagBg: '#5EE9C9', tagText: '#064E3B' },
  green: { hero: ['#064E3B', '#0F9F6E'], accent: '#047857', tagBg: '#A7F3D0', tagText: '#064E3B' },
  blue: { hero: ['#1E3A8A', '#2563EB'], accent: '#1D4ED8', tagBg: '#BFDBFE', tagText: '#1E3A8A' },
  purple: { hero: ['#3B0764', '#7C3AED'], accent: '#6D28D9', tagBg: '#DDD6FE', tagText: '#4C1D95' },
  orange: { hero: ['#7C2D12', '#EA580C'], accent: '#C2410C', tagBg: '#FDE68A', tagText: '#7C2D12' },
  red: { hero: ['#7F1D1D', '#DC2626'], accent: '#B91C1C', tagBg: '#FECACA', tagText: '#7F1D1D' },
  pink: { hero: ['#831843', '#DB2777'], accent: '#BE185D', tagBg: '#FBCFE8', tagText: '#831843' },
  amber: { hero: ['#78350F', '#D97706'], accent: '#B45309', tagBg: '#FDE68A', tagText: '#78350F' },
};

export const offerTheme = (key?: string) => OFFER_THEMES[key || ''] || OFFER_THEMES.teal;
