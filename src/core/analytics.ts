/* Analytics stub: GA4 (gtag/dataLayer) + Meta Pixel events from the brief.
   In the demo nothing is sent anywhere — events go to window.dataLayer and the console (dev). */
export type AnalyticsEvent =
  | 'view_item' | 'select_item' | 'add_to_cart' | 'begin_checkout' | 'purchase'
  | 'generate_lead' | 'whatsapp_click' | 'gift_started' | 'tree_watered' | 'share_tree';

const META_MAP: Partial<Record<AnalyticsEvent, string>> = {
  view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase', generate_lead: 'Lead',
};

export function track(event: AnalyticsEvent, params: Record<string, unknown> = {}) {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
  if (typeof w.gtag === 'function') w.gtag('event', event, params);
  const meta = META_MAP[event];
  if (meta && typeof w.fbq === 'function') w.fbq('track', meta, params);
  if (import.meta.env.DEV) console.debug('[analytics]', event, params);
}
