import { eq, and } from 'drizzle-orm'
import { db, users, subscriptions, notificationLogs } from './index'
import type { User, NewUser, Subscription, NewSubscription, NewNotificationLog } from './schema'

// ============ USER QUERIES ============

export async function findUserByTelegramId(telegramId: string): Promise<User | null> {
  if (!db) return null

  const result = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1)

  return result[0] || null
}

export async function createUser(data: NewUser): Promise<User | null> {
  if (!db) return null

  const result = await db
    .insert(users)
    .values(data)
    .returning()

  return result[0] || null
}

export async function updateUser(telegramId: string, data: Partial<NewUser>): Promise<User | null> {
  if (!db) return null

  const result = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.telegramId, telegramId))
    .returning()

  return result[0] || null
}

export async function getOrCreateUser(
  telegramId: string,
  userData: Omit<NewUser, 'telegramId'>
): Promise<User | null> {
  if (!db) return null

  let user = await findUserByTelegramId(telegramId)

  if (!user) {
    user = await createUser({ telegramId, ...userData })
  }

  return user
}

// ============ SUBSCRIPTION QUERIES ============

export async function getUserSubscriptions(userId: number): Promise<Subscription[]> {
  if (!db) return []

  return db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.isActive, true)))
}

export async function getSubscription(
  userId: number,
  operatorCode: string,
  queueNumber: string
): Promise<Subscription | null> {
  if (!db) return null

  const result = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.operatorCode, operatorCode),
        eq(subscriptions.queueNumber, queueNumber)
      )
    )
    .limit(1)

  return result[0] || null
}

export async function createOrUpdateSubscription(
  userId: number,
  operatorCode: string,
  queueNumber: string,
  notifyBefore: number = 30
): Promise<Subscription | null> {
  if (!db) return null

  // Try to find existing subscription
  const existing = await getSubscription(userId, operatorCode, queueNumber)

  if (existing) {
    // Update existing subscription
    const result = await db
      .update(subscriptions)
      .set({
        notifyBefore,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id))
      .returning()

    return result[0] || null
  }

  // Create new subscription
  const result = await db
    .insert(subscriptions)
    .values({
      userId,
      operatorCode,
      queueNumber,
      notifyBefore,
      isActive: true,
    })
    .returning()

  return result[0] || null
}

export async function deactivateSubscription(subscriptionId: number): Promise<void> {
  if (!db) return

  await db
    .update(subscriptions)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
}

// Get all active subscriptions (for notification service)
export async function getAllActiveSubscriptions(): Promise<
  Array<Subscription & { telegramId: string }>
> {
  if (!db) return []

  const result = await db
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      operatorCode: subscriptions.operatorCode,
      queueNumber: subscriptions.queueNumber,
      notifyBefore: subscriptions.notifyBefore,
      isActive: subscriptions.isActive,
      createdAt: subscriptions.createdAt,
      updatedAt: subscriptions.updatedAt,
      telegramId: users.telegramId,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .where(eq(subscriptions.isActive, true))

  return result
}

// ============ NOTIFICATION LOG QUERIES ============

export async function hasNotificationBeenSent(
  subscriptionId: number,
  outageDate: string,
  outageTime: string,
  notificationType: string
): Promise<boolean> {
  if (!db) return false

  const result = await db
    .select()
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.subscriptionId, subscriptionId),
        eq(notificationLogs.outageDate, outageDate),
        eq(notificationLogs.outageTime, outageTime),
        eq(notificationLogs.notificationType, notificationType)
      )
    )
    .limit(1)

  return result.length > 0
}

export async function logNotification(data: NewNotificationLog): Promise<void> {
  if (!db) return

  await db.insert(notificationLogs).values(data)
}
