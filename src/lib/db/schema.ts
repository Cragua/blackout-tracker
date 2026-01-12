import { pgTable, serial, text, integer, boolean, timestamp, varchar, unique } from 'drizzle-orm/pg-core'

// Users table - stores Telegram user info
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: varchar('telegram_id', { length: 50 }).notNull().unique(),
  username: varchar('username', { length: 100 }),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  languageCode: varchar('language_code', { length: 10 }).default('uk'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Subscriptions table - stores user queue subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  operatorCode: varchar('operator_code', { length: 50 }).notNull(), // 'yasno-kyiv', 'yasno-dnipro'
  queueNumber: varchar('queue_number', { length: 10 }).notNull(), // '1.1', '2.2', etc.
  notifyBefore: integer('notify_before').default(30).notNull(), // minutes before outage
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Each user can only have one subscription per queue
  uniqueUserQueue: unique().on(table.userId, table.operatorCode, table.queueNumber),
}))

// Notifications log - tracks sent notifications to avoid duplicates
export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id).notNull(),
  outageDate: varchar('outage_date', { length: 10 }).notNull(), // '2026-01-11'
  outageTime: varchar('outage_time', { length: 5 }).notNull(), // '04:00'
  notificationType: varchar('notification_type', { length: 20 }).notNull(), // 'before_outage', 'outage_start', 'power_restored'
  sentAt: timestamp('sent_at').defaultNow().notNull(),
})

// Types for TypeScript
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type NotificationLog = typeof notificationLogs.$inferSelect
export type NewNotificationLog = typeof notificationLogs.$inferInsert
