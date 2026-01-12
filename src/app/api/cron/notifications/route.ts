import { NextResponse } from 'next/server'
import { getBot } from '@/lib/telegram/bot'
import { checkAndSendNotifications } from '@/lib/telegram/notifications'

// Vercel cron config - run every 5 minutes
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds max

// GET handler for cron job (Vercel cron uses GET)
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const bot = getBot()

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not configured - TELEGRAM_BOT_TOKEN missing' },
        { status: 500 }
      )
    }

    console.log('Starting notification check...')
    const result = await checkAndSendNotifications(bot)
    console.log('Notification check complete:', result)

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron notification error:', error)
    return NextResponse.json(
      { error: 'Failed to process notifications', details: String(error) },
      { status: 500 }
    )
  }
}

// POST handler for manual triggers
export async function POST(request: Request) {
  return GET(request)
}
