# Deployment Guide

Deploy Svitlo Tracker to Vercel (free tier) with cron-job.org for scheduled notifications.

## Prerequisites

- GitHub account with this repository
- Vercel account (free)
- cron-job.org account (free)
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- (Optional) PostgreSQL database for notification subscriptions

## Step 1: Deploy to Vercel

### 1.1 Import Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel auto-detects Next.js - keep default settings
5. Click **Deploy**

### 1.2 Configure Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Token from @BotFather |
| `CRON_SECRET` | Yes | Random string for cron auth (generate with `openssl rand -hex 32`) |
| `DATABASE_URL` | No | PostgreSQL connection string |
| `TELEGRAM_WEBHOOK_URL` | No | Auto-set after deployment |

### 1.3 Redeploy

After adding environment variables, trigger a new deployment:
- Go to Deployments tab → click "..." on latest → Redeploy

## Step 2: Setup Telegram Webhook

After deployment, configure the Telegram webhook by making a POST request:

```bash
curl -X POST "https://YOUR-DOMAIN.vercel.app/api/telegram/setup?url=https://YOUR-DOMAIN.vercel.app/api/telegram/webhook"
```

Replace `YOUR-DOMAIN` with your actual Vercel domain (e.g., `svitlo-tracker.vercel.app`).

You should see: `{"success": true, "message": "Webhook set successfully"}`

## Step 3: Setup cron-job.org

Since Vercel's free tier doesn't include cron jobs, use cron-job.org (free) to trigger notifications.

### 3.1 Create Account

1. Go to [cron-job.org](https://cron-job.org)
2. Sign up for a free account
3. Verify your email

### 3.2 Create Cron Job

1. Click **"CREATE CRONJOB"**
2. Fill in the details:

| Field | Value |
|-------|-------|
| **Title** | Svitlo Tracker Notifications |
| **URL** | `https://YOUR-DOMAIN.vercel.app/api/cron/notifications` |
| **Schedule** | Every 5 minutes (or custom) |
| **Request Method** | GET |

3. Expand **"Advanced"** settings
4. Under **"Headers"**, add:
   - Header name: `Authorization`
   - Header value: `Bearer YOUR_CRON_SECRET`

   (Use the same `CRON_SECRET` value you set in Vercel)

5. Click **"CREATE"**

### 3.3 Test the Cron Job

1. In your cron job list, click the job name
2. Click **"Test run"**
3. Check the response - should be `200 OK` with JSON response

## Step 4: Verify Everything Works

### Test the Bot

1. Open Telegram and find your bot
2. Send `/start` - should get a welcome message
3. Set your region and queue with `/region` and `/queue`
4. Check schedule with `/schedule`

### Test Notifications

1. Subscribe to notifications in the bot
2. Wait for the cron job to run (or trigger manually in cron-job.org)
3. Check Vercel logs: Dashboard → Your Project → Logs

## Troubleshooting

### Bot not responding
- Check `TELEGRAM_BOT_TOKEN` is correct in Vercel
- Verify webhook is set: visit `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Check Vercel function logs for errors

### Cron job returning 401
- Verify `Authorization` header is set correctly: `Bearer YOUR_SECRET`
- Check `CRON_SECRET` matches in both Vercel and cron-job.org

### Notifications not sending
- Ensure `DATABASE_URL` is set (required for subscriptions)
- Check database has subscriber data
- Review Vercel logs during cron execution

## Environment Variables Reference

```env
# Required
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...     # From @BotFather
CRON_SECRET=abc123...                     # Random string for cron auth

# Optional
DATABASE_URL=postgresql://...             # For notification subscriptions
TELEGRAM_WEBHOOK_URL=https://...          # Your webhook URL
TELEGRAM_WEBHOOK_SECRET=...               # Extra webhook security
```

## Cost Summary

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | Free |
| cron-job.org | Free | Free |
| PostgreSQL (Supabase/Neon) | Free tier | Free |
| **Total** | | **$0/month** |
