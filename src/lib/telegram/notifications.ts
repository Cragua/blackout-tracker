import { Bot } from 'grammy'
import { MyContext } from './bot'
import { getScheduleForQueue } from '@/lib/scrapers/yasno-client'
import {
  getAllActiveSubscriptions,
  hasNotificationBeenSent,
  logNotification,
} from '@/lib/db/queries'
import { isDatabaseAvailable } from '@/lib/db'

const REGIONS: Record<string, string> = {
  'yasno-kyiv': 'Київ',
  'yasno-dnipro': 'Дніпро',
}

interface NotificationResult {
  sent: number
  errors: number
  skipped: number
}

// Convert "HH:MM" to minutes from midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Format time until outage
function formatTimeUntil(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60

  if (h > 0 && m > 0) {
    return `${h} год ${m} хв`
  } else if (h > 0) {
    return `${h} год`
  }
  return `${m} хв`
}

// Check and send notifications for upcoming outages
export async function checkAndSendNotifications(
  bot: Bot<MyContext>
): Promise<NotificationResult> {
  if (!isDatabaseAvailable()) {
    console.log('Database not available - skipping notifications')
    return { sent: 0, errors: 0, skipped: 0 }
  }

  const result: NotificationResult = { sent: 0, errors: 0, skipped: 0 }

  try {
    // Get all active subscriptions
    const subscriptions = await getAllActiveSubscriptions()
    console.log(`Processing ${subscriptions.length} active subscriptions`)

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const todayDate = now.toISOString().split('T')[0]

    for (const subscription of subscriptions) {
      try {
        // Fetch schedule for this subscription
        const { schedule } = await getScheduleForQueue(
          subscription.operatorCode,
          subscription.queueNumber
        )

        if (!schedule || !schedule.today.outages.length) {
          continue
        }

        const regionName = REGIONS[subscription.operatorCode] || ''

        // Check each outage for today
        for (const outage of schedule.today.outages) {
          const outageStartMinutes = timeToMinutes(outage.startTime)
          const minutesUntilOutage = outageStartMinutes - currentMinutes

          // Check if we should send notification (within the notify window)
          // Send notification if: notifyBefore >= minutesUntilOutage > 0
          if (
            minutesUntilOutage > 0 &&
            minutesUntilOutage <= subscription.notifyBefore
          ) {
            // Check if we already sent this notification
            const alreadySent = await hasNotificationBeenSent(
              subscription.id,
              todayDate,
              outage.startTime,
              'before_outage'
            )

            if (alreadySent) {
              result.skipped++
              continue
            }

            // Send notification
            const message = `
⚠️ *Увага! Скоро відключення*

🔢 Черга: ${subscription.queueNumber} (${regionName})
⏰ Відключення о *${outage.startTime}*
⏱ Через ${formatTimeUntil(minutesUntilOutage)}

Світло буде відсутнє до *${outage.endTime}*
`

            try {
              await bot.api.sendMessage(subscription.telegramId, message, {
                parse_mode: 'Markdown',
              })

              // Log the notification
              await logNotification({
                subscriptionId: subscription.id,
                outageDate: todayDate,
                outageTime: outage.startTime,
                notificationType: 'before_outage',
              })

              result.sent++
              console.log(
                `Sent notification to ${subscription.telegramId} for outage at ${outage.startTime}`
              )
            } catch (sendError) {
              console.error(
                `Failed to send notification to ${subscription.telegramId}:`,
                sendError
              )
              result.errors++
            }
          }
        }
      } catch (subError) {
        console.error(
          `Error processing subscription ${subscription.id}:`,
          subError
        )
        result.errors++
      }
    }
  } catch (error) {
    console.error('Error in notification check:', error)
    result.errors++
  }

  return result
}

// Send immediate status update to a user
export async function sendStatusUpdate(
  bot: Bot<MyContext>,
  telegramId: string,
  operatorCode: string,
  queueNumber: string
): Promise<boolean> {
  try {
    const { schedule } = await getScheduleForQueue(operatorCode, queueNumber)

    if (!schedule) {
      await bot.api.sendMessage(
        telegramId,
        '❌ Не вдалося отримати графік. Спробуйте пізніше.'
      )
      return false
    }

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const regionName = REGIONS[operatorCode] || ''

    // Check if currently in outage
    let isOutage = false
    let currentOutage = null
    let nextOutage = null

    for (const outage of schedule.today.outages) {
      const startMinutes = timeToMinutes(outage.startTime)
      const endMinutes = timeToMinutes(outage.endTime)

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        isOutage = true
        currentOutage = outage
      } else if (currentMinutes < startMinutes && !nextOutage) {
        nextOutage = outage
      }
    }

    let message: string
    if (isOutage && currentOutage) {
      const minutesUntilPower = timeToMinutes(currentOutage.endTime) - currentMinutes
      message = `
🔴 *Зараз світла немає*
Черга ${queueNumber} (${regionName})

⏱ Світло з'явиться о *${currentOutage.endTime}*
Через ${formatTimeUntil(minutesUntilPower)}
`
    } else if (nextOutage) {
      const minutesUntilOutage = timeToMinutes(nextOutage.startTime) - currentMinutes
      message = `
🟢 *Зараз світло є*
Черга ${queueNumber} (${regionName})

⚠️ Наступне відключення о *${nextOutage.startTime}*
Через ${formatTimeUntil(minutesUntilOutage)}
`
    } else {
      message = `
🟢 *Зараз світло є*
Черга ${queueNumber} (${regionName})

✨ Більше відключень сьогодні не заплановано!
`
    }

    await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' })
    return true
  } catch (error) {
    console.error('Error sending status update:', error)
    return false
  }
}
