import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  jsonb,
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const taskflowProfilesTable = pgTable("taskflow_profiles", {
  id: varchar("id", { length: 255 }).primaryKey(),
  role: varchar("role", { length: 32 }),
  customRole: text("custom_role"),
  theme: varchar("theme", { length: 16 }).notNull().default("system"),
  accentColor: varchar("accent_color", { length: 24 }).notNull().default("#6C5CE7"),
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  dailyStartTime: varchar("daily_start_time", { length: 5 }),
  workHours: integer("work_hours"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const taskflowListsTable = pgTable(
  "taskflow_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: varchar("owner_id", { length: 255 })
      .notNull()
      .references(() => taskflowProfilesTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 24 }).notNull().default("#DDD6FE"),
    icon: varchar("icon", { length: 32 }).notNull().default("list"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("taskflow_lists_owner_position_idx").on(table.ownerId, table.position)],
);

export const taskflowTasksTable = pgTable(
  "taskflow_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: varchar("owner_id", { length: 255 })
      .notNull()
      .references(() => taskflowProfilesTable.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => taskflowListsTable.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    priority: varchar("priority", { length: 16 }).notNull().default("medium"),
    status: varchar("status", { length: 16 }).notNull().default("todo"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    subtasks: jsonb("subtasks")
      .$type<Array<{ id: string; title: string; completed: boolean }>>()
      .notNull()
      .default([]),
    recurrence: varchar("recurrence", { length: 16 }).notNull().default("none"),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    estimatedMinutes: integer("estimated_minutes"),
    archived: boolean("archived").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("taskflow_tasks_owner_position_idx").on(table.ownerId, table.position),
    index("taskflow_tasks_owner_due_idx").on(table.ownerId, table.dueAt),
    index("taskflow_tasks_owner_status_idx").on(table.ownerId, table.status),
  ],
);

export const taskflowFeedbackTable = pgTable("taskflow_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTaskflowProfileSchema = createInsertSchema(
  taskflowProfilesTable,
).omit({ updatedAt: true });
export const insertTaskflowListSchema = createInsertSchema(
  taskflowListsTable,
).omit({ id: true, createdAt: true });
export const insertTaskflowTaskSchema = createInsertSchema(
  taskflowTasksTable,
).omit({ id: true, createdAt: true, completedAt: true });

export type TaskflowProfile = typeof taskflowProfilesTable.$inferSelect;
export type InsertTaskflowProfile = z.infer<typeof insertTaskflowProfileSchema>;
export type TaskflowList = typeof taskflowListsTable.$inferSelect;
export type InsertTaskflowList = z.infer<typeof insertTaskflowListSchema>;
export type TaskflowTask = typeof taskflowTasksTable.$inferSelect;
export type InsertTaskflowTask = z.infer<typeof insertTaskflowTaskSchema>;