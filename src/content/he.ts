/* ==========================================================================
   All site copy — Hebrew, verbatim from the brief (section 10 "Тексты" and
   the in-section phrases of sections 5–9). Punctuation lightly corrected,
   proper Hebrew typography: gershayim ״ (U+05F4), geresh ׳ (U+05F3),
   maqaf ־ (U+05BE), NBSP before ₪.
   DO NOT replace these with invented copy. Testimonials are NOT written:
   leave empty slots. Company logos are neutral placeholders.
   Numbers, names and dedications on the map / demo tree are demo data.
   ========================================================================== */

export const NBSP = ' ';
export const ILS = '₪';

export const he = {
  brand: 'היער שלנו',
  place: 'מושב פדיה',

  nav: {
    story: 'הסיפור שלנו',
    whatAwaits: 'מה מחכה לכם ביער?',
    partners: 'בואו להיות שותפים',
    contact: 'צרו קשר',
    menu: 'תפריט',
    close: 'סגירה',
    accessibility: 'נגישות',
    sound: 'צלילי היער',
    skip: 'דלגו לתוכן',
    home: 'לעמוד הבית',
  },

  /* new selling CTAs (same voice: present tense, "we do") */
  cta: {
    plant: 'נוטעים עץ משלכם',
    plantShort: 'נוטעים עץ',
    gift: 'עץ במתנה',
    business: 'לחברות וארגונים',
    more: 'מידע נוסף',
    whatsapp: 'וואטסאפ',
  },

  hero: {
    title: 'היער שלנו',
    subtitle: 'מקום לצמוח, להתחבר ולהעמיק שורשים',
    text:
      'יער מאכל במושב פדיה שמחבר בין אנשים, אדמה וכלבים. מקום לצמיחה, ריפוי והתפתחות אישית וקהילתית – שבו עבודת אדמה, מפגש עם בעלי חיים, יצירה ועשייה משותפת הופכים לחוויה עם ערך אמיתי.',
    button: 'הכירו את היער שלנו',
    /** live counter — 127 is placeholder data */
    counter: (n: number | string) => `${n} משפחות כבר נטעו כאן`,
    counterValue: 127,
    greetings: { morning: 'בוקר טוב', noon: 'צהריים טובים', evening: 'ערב טוב', night: 'לילה טוב' },
  },

  preloader: {
    label: 'טבעות שנים',
  },

  /* "Under the ground" section */
  story: {
    eyebrow: 'מתחת לפני השטח',
    title: 'ריפוי דרך שיקום האדמה',
    text:
      '״היער שלנו״ נולד מתוך רצון ליצור מרחב עם יכולת ריפוי אמיתית, כזה שכל אדם שיגיע אליו יוכל להרגיש כאילו הוא שלו. מקום שמאפשר אתנחתא בעזרת חיבור לפשטות, אדמה, עשייה ומפגש אנושי.',
    button: 'הסיפור שלנו',
  },

  directions: {
    title: 'מה מחכה לכם ביער?',
    items: [
      { id: 'nature', title: 'חיבור לטבע', text: 'לחזור לפשטות ולמשמעות' },
      { id: 'dogs', title: 'עבודה עם כלבים', text: 'מפגש, חיבור ופעילות עם בעלי חיים' },
      { id: 'teams', title: 'ימי גיבוש וכיף', text: 'חוויה קבוצתית עם ערך' },
      { id: 'workshops', title: 'תהליכים וסדנאות', text: 'מרחב לצמיחה והתפתחות אישית' },
      { id: 'soil', title: 'עבודת אדמה', text: 'לגעת, לטפח ולראות תוצאות' },
    ],
  },

  /* "Seasons" horizontal strip */
  experiences: {
    title: 'קונים חוויה, יוצרים השפעה',
    items: [
      { id: 'teams', title: 'ימי גיבוש לחברות', text: 'יום צוות אחר, המשלב טבע, עשייה ותרומה ממשית ליער' },
      { id: 'gift', title: 'מעניקים יום חוויה', text: 'רכישת יום פעילות עבור קבוצות ואוכלוסיות שיכולות להיתרם ממנו' },
      { id: 'events', title: 'אירועים וחוויות ביער', text: 'אירועים מיוחדים, מפגשים וחוויות לאורך השנה' },
    ],
  },

  workshops: {
    title: 'הסדנאות הקרובות',
    items: [
      { id: 'carpentry', title: 'סדנת נגרות: בונים ספסל ליער' },
      { id: 'dogs', title: 'כלבנות בטבע: יום עם הכלבים' },
      { id: 'garden', title: 'גינון ביער מאכל למתחילים' },
    ],
    seatsLeft: (n: number) => `נשארו ${n} מקומות`,
    reserve: 'שומרים מקום',
  },

  /* participation (next to the map) */
  participate: {
    title: 'איך אפשר להיות חלק בהקמה של היער?',
    cards: [
      { id: 'tree', title: 'נוטעים עץ עם משמעות', text: 'עץ לציון לידה, זוגיות, אירוע משמעותי או לזכר אדם אהוב' },
      { id: 'carpentry', title: 'נגרות עם הקדשה', text: 'קונים ליער ספסל, שולחן, פינת מדורה, מטבח, כיתת חוץ ועוד' },
      { id: 'workshop', title: 'מגיעים לסדנה ביער', text: 'סדנת נגרות, כלבנות, גינון ועוד. יום חוויות לקבוצות' },
      { id: 'corner', title: 'מאמצים פינה ביער', text: 'מרכיבים פינה משלכם עם עץ, תבלינים, ישיבה, תאורה ועוד' },
    ],
    more: 'מידע נוסף',
  },

  map: {
    title: 'איך אפשר להיות חלק בהקמה של היער?',
    subtitle: 'כל נקודה במפה היא סיפור. הנקודות שזוהרות מחכות לסיפור שלכם.',
    legend: { planted: 'כבר ניטע', reserved: 'שמור', free: 'מחכה לכם' },
    free: 'המקום הזה מחכה לעץ שלכם',
    choose: 'בוחרים את המקום',
    /** example of a planted-tree card (demo data) */
    plantedExample: { species: 'עץ תאנה', planted: 'ניטע ב־14.2.2026', dedication: 'לכבוד הולדת נועה', by: 'משפחת כהן' },
    plantedOn: (date: string) => `ניטע ב־${date}`,
  },

  companies: {
    title: 'מחברים את העסק לשורשים',
    subtitle: 'רוצים להיות שותפים אמיתיים בהקמת היער?',
    text: 'אנו מזמינים חברות וארגונים לקחת חלק משמעותי, לתמוך בצמיחת היער, ליצור חיבור לערכים ולהנות מפעילות שנתית לעובדים.',
    button: 'בואו להיות שותפים',
    packages: [
      { id: 'grove', title: 'חורשה של החברה', text: '18 עצים עם שלט החברה, יום נטיעה לצוות ועדכונים לעובדים בכל עונה', price: 9000, unit: null },
      { id: 'teamday', title: 'יום צוות ביער', text: 'נגרות, עבודת אדמה, מפגש עם הכלבים ונטיעה משותפת', price: 220, unit: 'participant' },
      { id: 'holiday', title: 'מתנה לחג שצומחת', text: 'עץ על שם כל עובד במקום עוד מארז שי', price: 180, unit: 'employee' },
    ],
  },

  wall: {
    title: 'היער הזה צומח בזכות אנשים שמאמינים בו',
    text1:
      'כל עץ שניטע, כל פינה שנבנית וכל פעילות המתקיימת מקרבים אותנו עוד קצת אל החזון – ליצור מרחב חי שמחבר בין אנשים, טבע, עשייה וקהילה.',
    text2:
      'אפשר לנטוע זיכרון, לבנות מקום שיישאר לשנים, להעניק חוויה לאחרים או פשוט לבחור להיות חלק ממשהו טוב שצומח מהאדמה.',
    button: 'דברו איתנו',
  },

  contact: {
    title: 'צרו קשר',
    subtitle: 'רוצים לשמוע עוד, להתייעץ או להצטרף לפרויקט?',
    text: 'מלאו פרטים ונחזור אליכם בהקדם.',
    form: {
      name: 'שם מלא',
      phone: 'טלפון',
      email: 'אימייל',
      message: 'הודעה / נושא הפניה',
      submit: 'שלח',
    },
    interest: {
      label: 'מה מעניין אתכם?',
      options: ['נטיעת עץ', 'ספסל או פינה', 'סדנה', 'יום גיבוש', 'אירוע', 'אחר'],
    },
    consent: 'בשליחת הטופס אני מאשר/ת את מדיניות הפרטיות והשימוש בפרטים לצורך יצירת קשר.',
    address: 'מושב פדיה',
  },

  footer: {
    big: 'בואו לנטוע',
    rights: 'כל הזכויות שמורות',
    privacy: 'מדיניות פרטיות',
    accessibility: 'הצהרת נגישות',
    terms: 'תקנון',
  },

  cursor: { plant: 'שתלו', look: 'גלו', drag: 'גררו' },

  pricing: {
    from: 'החל מ־',
    perMonth: 'לחודש',
    perParticipant: 'למשתתף',
    perEmployee: 'לעובד',
  },

  seasonalBanner: 'ט״ו בשבט מתקרב: מזמינים עכשיו, והעץ נכנס לאדמה בשבוע של החג',

  /* ---------------- configurator /plant ---------------- */
  plant: {
    title: 'העץ שלכם',
    steps: ['בוחרים עץ', 'לכבוד מה?', 'מה ייכתב על השלט?', 'איפה הוא יגדל?', 'רוצים להוסיף?'],
    species: [
      { id: 'olive', name: 'זית', text: 'שורשים עמוקים לדורות' },
      { id: 'fig', name: 'תאנה', text: 'משבעת המינים, מתיקות של בית' },
      { id: 'pomegranate', name: 'רימון', text: 'שפע וברכה' },
      { id: 'carob', name: 'חרוב', text: 'עץ שנוטעים בשביל הנכדים' },
      { id: 'almond', name: 'שקד', text: 'הראשון לפרוח בט״ו בשבט' },
      { id: 'mulberry', name: 'תות', text: 'פירות לכל הילדים בשכונה' },
    ],
    occasions: [
      { id: 'birth', label: 'לידה' },
      { id: 'mitzvah', label: 'בר / בת מצווה' },
      { id: 'wedding', label: 'חתונה וזוגיות' },
      { id: 'birthday', label: 'יום הולדת' },
      { id: 'memorial', label: 'לזכר אדם אהוב' },
      { id: 'team', label: 'צוות וחברה' },
      { id: 'justbecause', label: 'סתם, כי בא לנו' },
    ],
    plaquePlaceholder: 'לדוגמה: לנועה, שתצמחי איתו',
    plaqueMax: 40,
    location: { map: 'בוחרים על המפה', forUs: 'תבחרו בשבילנו' },
    extras: [
      { id: 'family', title: 'נטיעה משפחתית', text: 'באים ונוטעים יחד איתנו' },
      { id: 'guardians', title: 'שומרי העץ', text: 'תמונות ועדכון בכל עונה והזמנה לימי קטיף' },
      { id: 'certificate', title: 'תעודה מודפסת וממוסגרת', text: '' },
      { id: 'box', title: 'מארז מהיער', text: '' },
    ],
    gift: { toggle: 'זו מתנה', to: 'למי?', when: 'מתי לשלוח?', message: 'ברכה אישית' },
    includes: {
      title: 'מה מקבלים:',
      items: [
        'עץ פרי משלכם ביער',
        'שלט עץ חרוט עם ההקדשה',
        'מקום קבוע על מפת היער',
        'עמוד אישי לעץ עם עדכונים',
        'תעודה דיגיטלית',
        'אם העץ לא נקלט, נוטעים חדש',
      ],
    },
    summary: { title: 'מה מקבלים', total: 'סה״כ', checkout: 'ממשיכים לתשלום' },
    after: { title: 'העץ שלכם בדרך לאדמה', view: 'צפו בעמוד העץ', share: 'שתפו בוואטסאפ' },
  },

  /* ---------------- living tree /tree/0427 ---------------- */
  tree: {
    yourTree: 'העץ שלכם',
    number: (id: string) => `עץ מס׳ ${id}`,
    how: 'מה שלום העץ?',
    milestones: ['יום הנטיעה', 'העלים הראשונים', 'הקיץ הראשון', 'הפרי הראשון (בקרוב)'],
    buttons: { visit: 'באים לבקר', guardians: 'מצטרפים לשומרי העץ', share: 'משתפים', another: 'נוטעים עץ נוסף', homescreen: 'מוסיפים למסך הבית' },
    qrNote: 'הקוד על השלט מוביל לכאן',
    states: {
      plantingIn: (days: number) => `הנטיעה בעוד ${days} ימים`,
      planted: 'העץ שלכם ניטע',
      news: 'יש חדש אצל העץ',
      missedYou: 'התגעגענו',
      born: 'העץ שלכם נולד',
    },
    birth: { waterFirst: 'משקים בפעם הראשונה', share: 'משתפים' },
    water: {
      hold: 'לחצו והחזיקו כדי להשקות',
      community: 'השקיות הקהילה',
      communitySponsored: (company: string) => `השקיות הקהילה היום בחסות ${company}`,
      done: 'העץ שתה היום. נתראה מחר',
      honest: 'את ההשקיה האמיתית עושה הצוות שלנו, לפי מה שהעץ צריך',
    },
    gestures: {
      whenHarvest: 'מתי קוטפים?',
      rootsDepth: (cm: number) => `השורשים כבר בעומק ${cm} ס״מ`,
    },
    greetings: {
      everyGreeting: 'כל ברכה הופכת לעלה',
      inviteFriends: 'מזמינים חברים להשקות',
      newLeaves: (name: string, n: number) => `${name}, יש לך ${n} עלים חדשים`,
    },
    timeline: {
      title: 'ציר הזמן',
      planted: 'יום הנטיעה',
      today: 'היום',
      future: 'בעוד 5 שנים',
      futureCaption: 'ככה הוא ייראה בעוד 5 שנים',
      futureLink: 'מצטרפים לשומרי העץ כדי לראות את זה קורה',
    },
    herbarium: {
      title: 'ההרבריום שלי',
      fullYear: 'שנה שלמה עם העץ',
      firstFruit: 'הפרי הראשון',
      firstVisit: 'ביקור ראשון ביער',
    },
    shareTitle: 'שתפו את העץ',
    upsell: {
      guardians: 'מצטרפים לשומרי העץ',
      sibling: 'עץ אח',
    },
    memorial: {
      words: (name: string) => `מילים לזכר ${name}`,
      candle: 'מדליקים נר',
    },
    /** demo: November, fig No. 0427 */
    seasonNote: { fig_autumn: 'התאנה נכנסת למנוחת חורף' },
    a11yDescription: 'עץ תאנה, בן 9 חודשים, מתכונן לחורף, הושקה היום',
  },

  pages: {
    tabAway: 'העץ מחכה לכם',
    notFound: 'העלה הזה הלך לאיבוד',
  },
} as const;

export type He = typeof he;
