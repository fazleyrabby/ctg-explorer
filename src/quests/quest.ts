export interface QuestStop {
  /** Must match a named building's `name` exactly. */
  landmark: string;
}

export interface Quest {
  id: string;
  title: string;
  subtitle: string;
  stops: QuestStop[];
}

/**
 * A first guided route through real Chittagong landmarks in the spawn district
 * (spec §75 quests/missions). Discover a stop by walking up to it.
 */
export const CHEARGI_WALK: Quest = {
  id: "cheragi-walk",
  title: "From the sea to the city",
  subtitle: "A compact journey through Chittagong",
  stops: [
    { landmark: "Patenga Sea Beach" },
    { landmark: "Lalkhan Bazar · Expressway" },
    { landmark: "Cheragi Pahar" },
    { landmark: "DC Hill" },
    { landmark: "Chittagong Buddhist Bihar" },
    { landmark: "Anderkilla Shahi Jame Masjid" },
    { landmark: "Laldighi" },
    { landmark: "Chittagong Court Building" },
    { landmark: "Shah Amanat Bridge · Notun Bridge" },
    { landmark: "Bahaddarhat" },
  ],
};

export const OLD_TOWN_BAZAARS: Quest = {
  id: "old-town-bazaars",
  title: "Old town bazaars",
  subtitle: "Markets, mosques and book stalls of the old city",
  stops: [
    { landmark: "Chittagong New Market" },
    { landmark: "Kadam Mobarak Shahi Jame Mosque" },
    { landmark: "Andarkilla Book Market" },
    { landmark: "Anderkilla Shahi Jame Masjid" },
    { landmark: "Laldighi" },
    { landmark: "Khatunganj" },
    { landmark: "Chawkbazar" },
  ],
};

export const RAILS_AND_PORT: Quest = {
  id: "rails-and-port",
  title: "Rails, trade and the port",
  subtitle: "How goods and people reach the city",
  stops: [
    { landmark: "Chattogram Railway Station" },
    { landmark: "Khatunganj" },
    { landmark: "Agrabad Commercial Area" },
    { landmark: "Chittagong Port · Container Terminal" },
    { landmark: "Shah Amanat International Airport" },
  ],
};

export const NORTHERN_HILLS: Quest = {
  id: "northern-hills",
  title: "Hills and northern quarters",
  subtitle: "From CRB to Foy's Lake",
  stops: [
    { landmark: "CRB" },
    { landmark: "Chittagong Medical College" },
    { landmark: "Muradpur · Akhtaruzzaman Flyover" },
    { landmark: "GEC Circle" },
    { landmark: "Nasirabad" },
    { landmark: "Khulshi" },
    { landmark: "Foy's Lake" },
    { landmark: "Pahartali" },
  ],
};

/** Every guided route; the first is followed until the visitor picks another. */
export const QUESTS: readonly Quest[] = [CHEARGI_WALK, OLD_TOWN_BAZAARS, RAILS_AND_PORT, NORTHERN_HILLS];
