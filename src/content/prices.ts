/* Placeholder prices for the demo (₪). Real prices are set by the forest.
   Main prices are multiples of 18 (ח״י) — the familiar Israeli "gift" amount. */
export const prices = {
  seed: 180,            // tree in the shared grove, name on the forest wall, digital certificate
  tree: 540,            // own fruit tree, engraved plaque, point on the map, personal page
  familyPlanting: 1080, // own tree + come and plant it with the team (extra = 540)
  guardiansMonthly: 36, // "שומרי העץ" subscription
  bench: 4800,          // bench / table / fire spot with a plaque — from
  corner: 18000,        // own corner: tree, herbs, seating, light, plaque — from
  workshopMin: 150,     // per person
  workshopMax: 280,
  teamDay: 220,         // per participant — from
  companyGrove: 9000,   // 18 trees — from
  holidayGift: 180,     // per employee — from
  privateEvent: 3600,   // from
  certificateFramed: 90,
  forestBox: 144,
  greetingOptions: [18, 36, 54],
  greetingMin: 18,
} as const;
