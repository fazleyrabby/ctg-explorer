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
