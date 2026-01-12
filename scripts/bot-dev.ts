/**
 * Development script to run Telegram bot in polling mode
 *
 * Usage: npx ts-node --esm scripts/bot-dev.ts
 * Or add to package.json: "bot:dev": "ts-node --esm scripts/bot-dev.ts"
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

// Import dynamically to handle ESM
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables')
    console.log('Create a .env.local file with:')
    console.log('TELEGRAM_BOT_TOKEN=your_bot_token_here')
    process.exit(1)
  }

  console.log('🤖 Starting Svitlo Tracker Bot in polling mode...')

  // Dynamic import for ESM compatibility
  const { createBot } = await import('../src/lib/telegram/bot')

  const bot = createBot(token)

  // Delete any existing webhook before starting polling
  await bot.api.deleteWebhook()
  console.log('✅ Webhook deleted (if any)')

  // Start polling
  bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot started: @${botInfo.username}`)
      console.log('📱 Open Telegram and search for your bot')
      console.log('Press Ctrl+C to stop')
    },
  })

  // Handle graceful shutdown
  process.once('SIGINT', () => {
    console.log('\n🛑 Stopping bot...')
    bot.stop()
  })
  process.once('SIGTERM', () => {
    console.log('\n🛑 Stopping bot...')
    bot.stop()
  })
}

main().catch(console.error)
