import { Bot, Context, session, SessionFlavor } from 'grammy'
import { getScheduleForQueue } from '@/lib/scrapers/yasno-client'
import { isDatabaseAvailable } from '@/lib/db'
import {
  getOrCreateUser,
  getUserSubscriptions,
  createOrUpdateSubscription,
} from '@/lib/db/queries'

// Session data interface
interface SessionData {
  odatabaseUserId?: number
  operatorCode?: string
  queueNumber?: string
  notifyBefore?: number // minutes before outage
}

type MyContext = Context & SessionFlavor<SessionData>

// Ukrainian month names
const MONTHS_UK = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
]

function formatDateUk(date: Date): string {
  const day = date.getDate()
  const month = MONTHS_UK[date.getMonth()]
  return `${day} ${month}`
}

// Available regions
const REGIONS = [
  { code: 'yasno-kyiv', name: 'Київ' },
  { code: 'yasno-dnipro', name: 'Дніпро' },
]

// Available queues
const QUEUES = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2']

// Create bot instance
export function createBot(token: string): Bot<MyContext> {
  const bot = new Bot<MyContext>(token)

  // Use session
  bot.use(session({
    initial: (): SessionData => ({
      notifyBefore: 30, // Default: notify 30 minutes before
    }),
  }))

  // /start command
  bot.command('start', async (ctx) => {
    // Save user to database
    if (isDatabaseAvailable() && ctx.from) {
      const user = await getOrCreateUser(String(ctx.from.id), {
        username: ctx.from.username || undefined,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name || undefined,
        languageCode: ctx.from.language_code || 'uk',
      })
      if (user) {
        ctx.session.odatabaseUserId = user.id

        // Load existing subscriptions
        const subs = await getUserSubscriptions(user.id)
        if (subs.length > 0) {
          ctx.session.operatorCode = subs[0].operatorCode
          ctx.session.queueNumber = subs[0].queueNumber
          ctx.session.notifyBefore = subs[0].notifyBefore
        }
      }
    }

    const dbStatus = isDatabaseAvailable()
      ? '✅ Сповіщення увімкнено'
      : '⚠️ Сповіщення недоступні (БД не підключена)'

    const welcomeMessage = `
👋 *Вітаю у Svitlo Tracker Bot!*

Я допоможу відстежувати графіки відключень електроенергії та надсилати сповіщення перед відключеннями.

*Доступні команди:*
/region - Обрати регіон (Київ/Дніпро)
/queue - Обрати чергу відключень
/schedule - Переглянути графік на сьогодні
/tomorrow - Переглянути графік на завтра
/status - Поточний статус (є світло чи ні)
/subscribe - Підписатися на сповіщення
/settings - Налаштування
/help - Показати цю довідку

${dbStatus}

Почніть з вибору регіону: /region
`
    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' })
  })

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(`
*Svitlo Tracker Bot - Довідка*

/region - Обрати регіон
/queue - Обрати чергу (1.1-6.2)
/schedule - Графік на сьогодні
/tomorrow - Графік на завтра
/status - Поточний статус
/subscribe - Підписатися на сповіщення
/settings - Налаштування

*Як користуватися:*
1. Оберіть регіон командою /region
2. Оберіть вашу чергу командою /queue
3. Підпишіться на сповіщення /subscribe
4. Перегляньте графік командою /schedule

Бот надсилатиме сповіщення за 30 хвилин до відключення!
`, { parse_mode: 'Markdown' })
  })

  // /region command
  bot.command('region', async (ctx) => {
    await ctx.reply('Оберіть ваш регіон:', {
      reply_markup: {
        inline_keyboard: REGIONS.map(r => ([{
          text: r.name,
          callback_data: `region:${r.code}`
        }]))
      }
    })
  })

  // /queue command
  bot.command('queue', async (ctx) => {
    if (!ctx.session.operatorCode) {
      await ctx.reply('Спочатку оберіть регіон командою /region')
      return
    }

    // Create keyboard with queue buttons (4 per row)
    const keyboard = []
    for (let i = 0; i < QUEUES.length; i += 4) {
      keyboard.push(
        QUEUES.slice(i, i + 4).map(q => ({
          text: q,
          callback_data: `queue:${q}`
        }))
      )
    }

    await ctx.reply('Оберіть вашу чергу:', {
      reply_markup: { inline_keyboard: keyboard }
    })
  })

  // /subscribe command
  bot.command('subscribe', async (ctx) => {
    if (!ctx.session.operatorCode || !ctx.session.queueNumber) {
      await ctx.reply('Спочатку оберіть регіон (/region) та чергу (/queue)')
      return
    }

    if (!isDatabaseAvailable()) {
      await ctx.reply('❌ Сповіщення недоступні. База даних не підключена.')
      return
    }

    if (!ctx.from) {
      await ctx.reply('❌ Помилка: не вдалося отримати дані користувача')
      return
    }

    // Get or create user
    const user = await getOrCreateUser(String(ctx.from.id), {
      username: ctx.from.username || undefined,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name || undefined,
      languageCode: ctx.from.language_code || 'uk',
    })

    if (!user) {
      await ctx.reply('❌ Помилка збереження даних. Спробуйте пізніше.')
      return
    }

    // Create subscription
    const subscription = await createOrUpdateSubscription(
      user.id,
      ctx.session.operatorCode,
      ctx.session.queueNumber,
      ctx.session.notifyBefore || 30
    )

    if (!subscription) {
      await ctx.reply('❌ Помилка створення підписки. Спробуйте пізніше.')
      return
    }

    const regionName = REGIONS.find(r => r.code === ctx.session.operatorCode)?.name

    await ctx.reply(`
✅ *Підписку оформлено!*

📍 Регіон: ${regionName}
🔢 Черга: ${ctx.session.queueNumber}
🔔 Сповіщення: за ${subscription.notifyBefore} хв до відключення

Ви отримуватимете сповіщення перед кожним запланованим відключенням.
`, { parse_mode: 'Markdown' })
  })

  // /schedule command
  bot.command('schedule', async (ctx) => {
    await sendSchedule(ctx, 'today')
  })

  // /tomorrow command
  bot.command('tomorrow', async (ctx) => {
    await sendSchedule(ctx, 'tomorrow')
  })

  // /status command
  bot.command('status', async (ctx) => {
    if (!ctx.session.operatorCode || !ctx.session.queueNumber) {
      await ctx.reply('Спочатку оберіть регіон (/region) та чергу (/queue)')
      return
    }

    try {
      const { schedule } = await getScheduleForQueue(
        ctx.session.operatorCode,
        ctx.session.queueNumber
      )

      if (!schedule) {
        await ctx.reply('Графік не знайдено. Спробуйте пізніше.')
        return
      }

      const regionName = REGIONS.find(r => r.code === ctx.session.operatorCode)?.name || ''

      // Check for emergency shutdowns
      if (schedule.today.status === 'EmergencyShutdowns') {
        await ctx.reply(`
⚠️ *АВАРІЙНІ ВІДКЛЮЧЕННЯ*
Черга ${ctx.session.queueNumber} (${regionName})

🚨 Графіки не діють.
Відключення можуть відбуватися у будь-який час.

Слідкуйте за оновленнями.
`, { parse_mode: 'Markdown' })
        return
      }

      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      // Check if currently in outage
      let isOutage = false
      let currentOutage = null
      let nextOutage = null

      for (const outage of schedule.today.outages) {
        const [startH, startM] = outage.startTime.split(':').map(Number)
        const [endH, endM] = outage.endTime.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM

        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          isOutage = true
          currentOutage = outage
        } else if (currentMinutes < startMinutes && !nextOutage) {
          nextOutage = outage
        }
      }

      if (isOutage && currentOutage) {
        await ctx.reply(`
🔴 *Зараз світла немає*
Черга ${ctx.session.queueNumber} (${regionName})

⏱ Відключення до *${currentOutage.endTime}*

Наступне увімкнення через ${formatTimeUntil(currentOutage.endTime)}
`, { parse_mode: 'Markdown' })
      } else {
        let message = `
🟢 *Зараз світло є*
Черга ${ctx.session.queueNumber} (${regionName})
`
        if (nextOutage) {
          message += `
⏱ Наступне відключення о *${nextOutage.startTime}*
Через ${formatTimeUntil(nextOutage.startTime)}
`
        } else if (schedule.today.outages.length === 0) {
          message += `\n✨ Сьогодні відключень не заплановано!`
        } else {
          message += `\n✅ Всі відключення на сьогодні завершені`
        }

        await ctx.reply(message, { parse_mode: 'Markdown' })
      }
    } catch (error) {
      console.error('Error fetching status:', error)
      await ctx.reply('Помилка отримання даних. Спробуйте пізніше.')
    }
  })

  // /settings command
  bot.command('settings', async (ctx) => {
    const regionName = ctx.session.operatorCode
      ? REGIONS.find(r => r.code === ctx.session.operatorCode)?.name
      : 'не обрано'

    const dbStatus = isDatabaseAvailable() ? '✅ Активні' : '❌ Недоступні'

    await ctx.reply(`
⚙️ *Ваші налаштування*

📍 Регіон: ${regionName}
🔢 Черга: ${ctx.session.queueNumber || 'не обрано'}
🔔 Сповіщення: за ${ctx.session.notifyBefore || 30} хв до відключення
📊 Статус сповіщень: ${dbStatus}

Змінити:
/region - змінити регіон
/queue - змінити чергу
/subscribe - оновити підписку
`, { parse_mode: 'Markdown' })
  })

  // Handle callback queries (button presses)
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data

    if (data.startsWith('region:')) {
      const regionCode = data.replace('region:', '')
      ctx.session.operatorCode = regionCode
      ctx.session.queueNumber = undefined // Reset queue when region changes

      const regionName = REGIONS.find(r => r.code === regionCode)?.name
      await ctx.answerCallbackQuery({ text: `Обрано: ${regionName}` })
      await ctx.editMessageText(`✅ Регіон: *${regionName}*\n\nТепер оберіть чергу: /queue`, {
        parse_mode: 'Markdown'
      })
    }

    if (data.startsWith('queue:')) {
      const queue = data.replace('queue:', '')
      ctx.session.queueNumber = queue

      const regionName = REGIONS.find(r => r.code === ctx.session.operatorCode)?.name

      await ctx.answerCallbackQuery({ text: `Обрано чергу: ${queue}` })

      let message = `✅ Черга: *${queue}* (${regionName})\n\n`
      message += `Переглянути графік: /schedule\n`

      if (isDatabaseAvailable()) {
        message += `Підписатися на сповіщення: /subscribe`
      }

      await ctx.editMessageText(message, { parse_mode: 'Markdown' })
    }
  })

  return bot
}

// Helper function to send schedule
async function sendSchedule(ctx: MyContext, day: 'today' | 'tomorrow') {
  if (!ctx.session.operatorCode || !ctx.session.queueNumber) {
    await ctx.reply('Спочатку оберіть регіон (/region) та чергу (/queue)')
    return
  }

  try {
    const { schedule, noOutages } = await getScheduleForQueue(
      ctx.session.operatorCode,
      ctx.session.queueNumber
    )

    if (!schedule) {
      await ctx.reply('Графік не знайдено. Спробуйте пізніше.')
      return
    }

    const daySchedule = day === 'today' ? schedule.today : schedule.tomorrow
    const regionName = REGIONS.find(r => r.code === ctx.session.operatorCode)?.name || ''
    const dateStr = day === 'today'
      ? `Сьогодні, ${formatDateUk(new Date())}`
      : `Завтра, ${formatDateUk(new Date(Date.now() + 86400000))}`

    // Check for emergency shutdowns
    if (daySchedule.status === 'EmergencyShutdowns') {
      await ctx.reply(`
⚠️ *${dateStr}*
Черга ${ctx.session.queueNumber} (${regionName})

🚨 *АВАРІЙНІ ВІДКЛЮЧЕННЯ*

Графіки не діють. Відключення можуть відбуватися у будь-який час.

Слідкуйте за оновленнями.
`, { parse_mode: 'Markdown' })
      return
    }

    // Check for waiting for schedule
    if (daySchedule.status === 'WaitingForSchedule') {
      await ctx.reply(`
⏳ *${dateStr}*
Черга ${ctx.session.queueNumber} (${regionName})

Графік ще не опублікований.
Перевірте пізніше.
`, { parse_mode: 'Markdown' })
      return
    }

    if (noOutages || daySchedule.outages.length === 0) {
      await ctx.reply(`
🎉 *${dateStr}*
Черга ${ctx.session.queueNumber} (${regionName})

✨ Відключень не заплановано!
Світло буде цілодобово.
`, { parse_mode: 'Markdown' })
      return
    }

    // Build schedule message
    let message = `📅 *${dateStr}*\nЧерга ${ctx.session.queueNumber} (${regionName})\n\n`
    message += `*Заплановані відключення:*\n`

    for (const outage of daySchedule.outages) {
      const icon = outage.isConfirmed ? '🔴' : '🟡'
      const status = outage.isConfirmed ? 'точно' : 'можливо'
      message += `${icon} ${outage.startTime} - ${outage.endTime} (${status})\n`
    }

    // Add visual timeline
    message += `\n*Графік:*\n`
    message += generateTextTimeline(daySchedule.outages)

    await ctx.reply(message, { parse_mode: 'Markdown' })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    await ctx.reply('Помилка отримання графіку. Спробуйте пізніше.')
  }
}

// Generate text-based timeline with clear hour labels
function generateTextTimeline(outages: Array<{ startTime: string; endTime: string; isConfirmed: boolean }>): string {
  // Determine status for each hour
  const hourStatus: ('on' | 'off')[] = []

  for (let h = 0; h < 24; h++) {
    const hourStart = h * 60
    const hourEnd = (h + 1) * 60

    let isOutage = false
    for (const outage of outages) {
      const [startH, startM] = outage.startTime.split(':').map(Number)
      const [endH, endM] = outage.endTime.split(':').map(Number)
      const outageStart = startH * 60 + startM
      const outageEnd = endH * 60 + endM

      if (hourStart < outageEnd && hourEnd > outageStart) {
        isOutage = true
        break
      }
    }

    hourStatus.push(isOutage ? 'off' : 'on')
  }

  // Build timeline in 6-hour blocks for readability
  const periods = [
    { label: 'Ніч', start: 0, end: 6 },
    { label: 'Ранок', start: 6, end: 12 },
    { label: 'День', start: 12, end: 18 },
    { label: 'Вечір', start: 18, end: 24 },
  ]

  let timeline = ''

  for (const period of periods) {
    const hours = []
    const blocks = []

    for (let h = period.start; h < period.end; h++) {
      hours.push(String(h).padStart(2, ' '))
      blocks.push(hourStatus[h] === 'off' ? '🔴' : '🟢')
    }

    timeline += `\`${period.label.padEnd(5)} ${hours.join(' ')}\`\n`
    timeline += `\`      ${blocks.join('  ')}\`\n`
  }

  timeline += `\n🟢 світло є  🔴 немає світла`

  return timeline
}

// Format time until
function formatTimeUntil(timeStr: string): string {
  const now = new Date()
  const [hours, minutes] = timeStr.split(':').map(Number)
  const target = new Date()
  target.setHours(hours, minutes, 0, 0)

  if (target <= now) {
    target.setDate(target.getDate() + 1)
  }

  const diffMs = target.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const h = Math.floor(diffMins / 60)
  const m = diffMins % 60

  if (h > 0) {
    return `${h} год ${m} хв`
  }
  return `${m} хв`
}

// Export bot instance getter
let botInstance: Bot<MyContext> | null = null

export function getBot(): Bot<MyContext> | null {
  if (!botInstance && process.env.TELEGRAM_BOT_TOKEN) {
    botInstance = createBot(process.env.TELEGRAM_BOT_TOKEN)
  }
  return botInstance
}
