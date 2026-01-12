import { NextRequest, NextResponse } from 'next/server'
import { getBot } from '@/lib/telegram/bot'

// Set up webhook for production
export async function POST(request: NextRequest) {
  const bot = getBot()

  if (!bot) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const webhookUrl = searchParams.get('url')

    if (!webhookUrl) {
      // Get webhook URL from request body or environment
      const body = await request.json().catch(() => ({}))
      const url = body.url || process.env.TELEGRAM_WEBHOOK_URL

      if (!url) {
        return NextResponse.json({
          error: 'Webhook URL required. Provide ?url= param or TELEGRAM_WEBHOOK_URL env var'
        }, { status: 400 })
      }

      await bot.api.setWebhook(url)
      return NextResponse.json({ success: true, webhook: url })
    }

    await bot.api.setWebhook(webhookUrl)
    return NextResponse.json({ success: true, webhook: webhookUrl })
  } catch (error) {
    console.error('Setup webhook error:', error)
    return NextResponse.json({
      error: 'Failed to set webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get webhook info
export async function GET() {
  const bot = getBot()

  if (!bot) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
  }

  try {
    const info = await bot.api.getWebhookInfo()
    return NextResponse.json(info)
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get webhook info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Delete webhook (for switching to polling mode)
export async function DELETE() {
  const bot = getBot()

  if (!bot) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
  }

  try {
    await bot.api.deleteWebhook()
    return NextResponse.json({ success: true, message: 'Webhook deleted' })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to delete webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
