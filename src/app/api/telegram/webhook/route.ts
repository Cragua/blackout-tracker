import { NextRequest, NextResponse } from 'next/server'
import { webhookCallback } from 'grammy'
import { getBot } from '@/lib/telegram/bot'

// Handle Telegram webhook
export async function POST(request: NextRequest) {
  const bot = getBot()

  if (!bot) {
    console.error('Bot not initialized - missing TELEGRAM_BOT_TOKEN')
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
  }

  try {
    const handler = webhookCallback(bot, 'std/http')
    return await handler(request)
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

// Telegram sends GET to verify webhook
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook endpoint' })
}
