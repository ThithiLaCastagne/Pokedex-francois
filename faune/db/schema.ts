import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  code: text("code").notNull().unique(),
  created: text("created").notNull(),
});
export const observations = sqliteTable(
  "observations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    species: text("species").notNull(),
    photos: text("photos").notNull(),
    date: text("date").notNull(),
    region: text("region").notNull().default(""),
    notes: text("notes").notNull().default(""),
    visibility: text("visibility").notNull().default("private"),
    sensitive: integer("sensitive").notNull().default(0),
    lat: real("lat"),
    lng: real("lng"),
    favorite: integer("favorite").notNull().default(0),
    created: text("created").notNull(),
  },
  (t) => [index("idx_observations_user_date").on(t.userId, t.date)],
);
export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    created: text("created").notNull(),
  },
  (t) => [index("idx_photos_user").on(t.userId)],
);
export const friends = sqliteTable(
  "friends",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    friendId: text("friend_id")
      .notNull()
      .references(() => profiles.id),
    created: text("created").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.friendId] })],
);
export const requests = sqliteTable(
  "requests",
  {
    sender: text("sender")
      .notNull()
      .references(() => profiles.id),
    recipient: text("recipient")
      .notNull()
      .references(() => profiles.id),
    created: text("created").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sender, t.recipient] }),
    index("idx_requests_recipient").on(t.recipient),
  ],
);
export const likes = sqliteTable(
  "likes",
  {
    observationId: text("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
  },
  (t) => [primaryKey({ columns: [t.observationId, t.userId] })],
);
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    observationId: text("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body").notNull(),
    created: text("created").notNull(),
  },
  (t) => [index("idx_comments_observation").on(t.observationId, t.created)],
);
