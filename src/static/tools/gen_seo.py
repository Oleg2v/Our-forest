# Generates partials/seo/*.html (OG/Twitter image, canonical, JSON-LD). Owned by the business agent.
# SITE is the production origin — change it here (and in public/robots.txt + public/sitemap.xml) if the domain changes.
# Usage: python3 src/static/tools/gen_seo.py   (rewrites partials/seo/*.html)
import json, os, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
SITE = 'https://ourforest.kikkey.com'
ORG_ID = f'{SITE}/#forest'
WA = None  # no real phone yet → no telephone / contactPoint in structured data (placeholder)

ORG = {
  '@type': 'LocalBusiness',
  '@id': ORG_ID,
  'name': 'היער שלנו',
  'alternateName': 'Our Forest',
  'description': 'יער מאכל במושב פדיה שמחבר בין אנשים, אדמה וכלבים. מקום לצמיחה, ריפוי והתפתחות אישית וקהילתית.',
  'slogan': 'מקום לצמוח, להתחבר ולהעמיק שורשים',
  'url': f'{SITE}/',
  'logo': f'{SITE}/favicon.svg',
  'image': f'{SITE}/og/home.jpg',
  'address': { '@type': 'PostalAddress', 'addressLocality': 'מושב פדיה', 'addressCountry': 'IL' },
  'areaServed': { '@type': 'Country', 'name': 'ישראל' },
  'knowsLanguage': 'he',
  'currenciesAccepted': 'ILS',
  'priceRange': '₪180–₪18,000',
}
ORG_REF = { '@type': 'LocalBusiness', '@id': ORG_ID, 'name': 'היער שלנו', 'url': f'{SITE}/' }
PLACE = { '@type': 'Place', 'name': 'היער שלנו', 'address': { '@type': 'PostalAddress', 'addressLocality': 'מושב פדיה', 'addressCountry': 'IL' } }
WEBSITE = { '@type': 'WebSite', '@id': f'{SITE}/#website', 'url': f'{SITE}/', 'name': 'היער שלנו', 'inLanguage': 'he-IL', 'publisher': { '@id': ORG_ID } }

def crumbs(*items):
  return { '@type': 'BreadcrumbList', 'itemListElement': [
    { '@type': 'ListItem', 'position': i + 1, 'name': n, 'item': f'{SITE}{p}' } for i, (n, p) in enumerate(items) ] }

def page(path, name, desc, extra=None):
  return { '@type': 'WebPage', '@id': f'{SITE}{path}#page', 'url': f'{SITE}{path}', 'name': name, 'description': desc,
           'inLanguage': 'he-IL', 'isPartOf': { '@id': f'{SITE}/#website' }, **(extra or {}) }

def ev(name, date, price, ws):
  # date = the session the home page lists (src/plant/catalog.ts workshopDates: next Fridays; garden on Saturdays)
  return {
    '@type': 'Event', 'name': name, 'startDate': date,
    'eventStatus': 'https://schema.org/EventScheduled',
    'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
    'location': PLACE, 'organizer': { '@id': ORG_ID }, 'image': f'{SITE}/og/home.jpg',
    'description': 'סדנת נגרות, כלבנות, גינון ועוד. יום חוויות לקבוצות',
    'inLanguage': 'he',
    'offers': { '@type': 'Offer', 'price': str(price), 'priceCurrency': 'ILS', 'availability': 'https://schema.org/InStock',
                'url': f'{SITE}/plant/?product=workshop&ws={ws}&date={date}', 'validFrom': '2026-11-01' },
  }

def head(path, image, alt, canonical=True, robots=None, w=1200, h=630):
  out = []
  if robots: out.append(f'<meta name="robots" content="{robots}">')
  if canonical:
    out.append(f'<link rel="canonical" href="{SITE}{path}">')
    out.append(f'<meta property="og:url" content="{SITE}{path}">')
  out += [
    f'<meta property="og:image" content="{SITE}/og/{image}">',
    f'<meta property="og:image:type" content="image/jpeg">',
    f'<meta property="og:image:width" content="{w}">',
    f'<meta property="og:image:height" content="{h}">',
    f'<meta property="og:image:alt" content="{alt}">',
    f'<meta name="twitter:image" content="{SITE}/og/{image}">',
    f'<meta name="twitter:image:alt" content="{alt}">',
  ]
  return out

def ld(graph, el_id=None):
  attr = f' id="{el_id}"' if el_id else ''
  return f'<script type="application/ld+json"{attr}>\n' + json.dumps({ '@context': 'https://schema.org', '@graph': graph }, ensure_ascii=False, indent=1) + '\n</script>'

def write(name, lines, comment):
  txt = f'<!-- seo/{name}: {comment} — owned by the business (SEO) agent. SITE = {SITE} (see docs/agent-notes/business.md) -->\n' + '\n'.join(lines) + '\n'
  with open(os.path.join(ROOT, 'partials', 'seo', f'{name}.html'), 'w', encoding='utf-8') as f: f.write(txt)

# ---------------------------------------------------------------- home
write('home', head('/', 'home.jpg', 'היער שלנו — יער מאכל במושב פדיה') + [ld([
  ORG, WEBSITE,
  page('/', 'היער שלנו — יער מאכל במושב פדיה', 'יער מאכל במושב פדיה שמחבר בין אנשים, אדמה וכלבים.', { 'about': { '@id': ORG_ID } }),
]), ld([
  # demo sessions = the first session of each workshop the home list shows on the demo date (12.11.2026).
  # The list itself is relative to "today" (src/plant/catalog.ts); #ld-events can be rewritten at runtime. Production: from the CMS.
  ev('סדנת נגרות: בונים ספסל ליער', '2026-11-13', 280, 'carpentry'),
  ev('גינון ביער מאכל למתחילים', '2026-11-14', 150, 'garden'),
  ev('כלבנות בטבע: יום עם הכלבים', '2026-11-20', 216, 'dogs'),
], 'ld-events')], 'OG image, canonical, JSON-LD (LocalBusiness, WebSite, WebPage) + #ld-events (Event × 3)')

# ---------------------------------------------------------------- plant
plant_desc = 'עץ פרי משלכם ביער, שלט עץ חרוט עם ההקדשה, מקום קבוע על מפת היער, עמוד אישי לעץ עם עדכונים ותעודה דיגיטלית. אם העץ לא נקלט, נוטעים חדש.'
write('plant', head('/plant/', 'plant.jpg', 'נוטעים עץ משלכם — שלט עץ חרוט עם הקדשה') + [ld([
  ORG_REF,
  page('/plant/', 'נוטעים עץ משלכם — היער שלנו', plant_desc, { 'mainEntity': { '@id': f'{SITE}/plant/#tree' } }),
  {
    '@type': 'Product', '@id': f'{SITE}/plant/#tree',
    'name': 'עץ פרי משלכם ביער', 'description': plant_desc,
    'brand': { '@type': 'Brand', 'name': 'היער שלנו' },
    'image': f'{SITE}/og/plant.jpg', 'url': f'{SITE}/plant/', 'category': 'נטיעת עץ עם הקדשה',
    'offers': { '@type': 'Offer', 'price': '540', 'priceCurrency': 'ILS', 'availability': 'https://schema.org/InStock',
                'url': f'{SITE}/plant/', 'seller': { '@id': ORG_ID } },
  },
  crumbs(('היער שלנו', '/'), ('נוטעים עץ משלכם', '/plant/')),
])], 'OG image, canonical, JSON-LD (Product + Offer 540 ILS)')

# ---------------------------------------------------------------- business
def pkg(name, text, price, unit=None):
  spec = { '@type': 'UnitPriceSpecification' if unit else 'PriceSpecification', 'minPrice': str(price), 'priceCurrency': 'ILS' }
  if unit: spec['unitText'] = unit
  return { '@type': 'Offer', 'price': str(price), 'priceCurrency': 'ILS', 'priceSpecification': spec,
           'url': f'{SITE}/business/#packages', 'itemOffered': { '@type': 'Service', 'name': name, 'description': text, 'provider': { '@id': ORG_ID } } }
biz_desc = 'אנו מזמינים חברות וארגונים לקחת חלק משמעותי, לתמוך בצמיחת היער, ליצור חיבור לערכים ולהנות מפעילות שנתית לעובדים.'
write('business', head('/business/', 'business.jpg', 'מחברים את העסק לשורשים — חבילות לחברות וארגונים') + [ld([
  ORG_REF,
  page('/business/', 'לחברות וארגונים — היער שלנו', biz_desc, { 'mainEntity': { '@id': f'{SITE}/business/#service' } }),
  {
    '@type': 'Service', '@id': f'{SITE}/business/#service',
    'name': 'מחברים את העסק לשורשים', 'serviceType': 'ימי צוות, חורשות ומתנות לחברות וארגונים',
    'description': biz_desc, 'provider': { '@id': ORG_ID }, 'areaServed': { '@type': 'Country', 'name': 'ישראל' },
    'url': f'{SITE}/business/', 'image': f'{SITE}/og/business.jpg',
    'hasOfferCatalog': { '@type': 'OfferCatalog', 'name': 'החבילות', 'itemListElement': [
      pkg('חורשה של החברה', '18 עצים עם שלט החברה, יום נטיעה לצוות ועדכונים לעובדים בכל עונה', 9000),
      pkg('יום צוות ביער', 'נגרות, עבודת אדמה, מפגש עם הכלבים ונטיעה משותפת', 220, 'למשתתף'),
      pkg('מתנה לחג שצומחת', 'עץ על שם כל עובד במקום עוד מארז שי', 180, 'לעובד'),
    ] },
  },
  crumbs(('היער שלנו', '/'), ('לחברות וארגונים', '/business/')),
])], 'OG image, canonical, JSON-LD (Service + OfferCatalog)')

# ---------------------------------------------------------------- tree (OG image made by the tree-ui agent)
tree_desc = 'עץ תאנה שניטע ב־14.2.2026 ביער שלנו במושב פדיה. מה שלום העץ?'
write('tree', head('/tree/0427/', 'tree-0427.jpg', 'עץ מס׳ 0427 — עץ תאנה ביער שלנו') + [ld([
  ORG_REF,
  page('/tree/0427/', 'עץ מס׳ 0427 — היער שלנו', tree_desc, {
    'about': { '@type': 'Thing', 'name': 'עץ תאנה מס׳ 0427', 'description': 'לכבוד הולדת נועה · משפחת כהן' },
    'primaryImageOfPage': { '@type': 'ImageObject', 'url': f'{SITE}/og/tree-0427.jpg', 'width': 1200, 'height': 630 },
    'datePublished': '2026-02-14',
  }),
  crumbs(('היער שלנו', '/'), ('עץ מס׳ 0427', '/tree/0427/')),
])], 'OG image (/og/tree-0427.jpg by tree-ui), canonical, JSON-LD (WebPage)')

# ---------------------------------------------------------------- legal (shared OG) + per-page canonical
write('legal', head('', 'default.jpg', 'היער שלנו — יער מאכל במושב פדיה', canonical=False), 'shared OG image for the legal documents (canonical + JSON-LD are in legal-*.html)')
for slug, title, desc in [
  ('terms', 'תקנון', 'תקנון האתר ותנאי ביטול.'),
  ('privacy', 'מדיניות פרטיות', 'מדיניות הפרטיות של היער שלנו.'),
  ('accessibility', 'הצהרת נגישות', 'הצהרת הנגישות של האתר.'),
]:
  path = f'/legal/{slug}/'
  lines = [f'<link rel="canonical" href="{SITE}{path}">', f'<meta property="og:url" content="{SITE}{path}">', '<!--#include partials/seo/legal.html -->',
           ld([ORG_REF, page(path, f'{title} — היער שלנו', desc, { 'dateModified': '2026-11-12' }), crumbs(('היער שלנו', '/'), (title, path))])]
  write(f'legal-{slug}', lines, f'canonical + JSON-LD for {path} (includes the shared legal OG)')

# ---------------------------------------------------------------- credits
write('credits', head('/credits/', 'default.jpg', 'היער שלנו — יער מאכל במושב פדיה') + [ld([
  ORG_REF, page('/credits/', 'קרדיטים — היער שלנו', 'קרדיטים לצילומים, גופנים וקוד פתוח.'), crumbs(('היער שלנו', '/'), ('קרדיטים', '/credits/')),
])], 'OG image, canonical, JSON-LD (WebPage)')

# ---------------------------------------------------------------- 404
write('notfound', head('', 'default.jpg', 'היער שלנו — יער מאכל במושב פדיה', canonical=False, robots='noindex, follow'), 'noindex + OG image (no canonical: served at any missing URL)')
print('ok')
