'use client'

import { useEffect, useState } from 'react'
import type { DaySchedule, ScheduleStatus } from '@/types/schedule'

interface CurrentStatusProps {
  schedule: DaySchedule | null
  queueNumber: string
  status?: ScheduleStatus
}

function isCurrentlyOff(schedule: DaySchedule | null): { isOff: boolean; isConfirmed: boolean } {
  if (!schedule?.outages?.length) {
    return { isOff: false, isConfirmed: true }
  }

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  for (const outage of schedule.outages) {
    if (currentTime >= outage.startTime && currentTime < outage.endTime) {
      return { isOff: true, isConfirmed: outage.isConfirmed }
    }
  }

  return { isOff: false, isConfirmed: true }
}

function getNextChange(schedule: DaySchedule | null): { time: string; type: 'on' | 'off' } | null {
  if (!schedule?.outages?.length) return null

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const { isOff } = isCurrentlyOff(schedule)

  if (isOff) {
    // Find when power comes back
    for (const outage of schedule.outages) {
      if (currentTime >= outage.startTime && currentTime < outage.endTime) {
        return { time: outage.endTime, type: 'on' }
      }
    }
  } else {
    // Find next outage
    for (const outage of schedule.outages) {
      if (outage.startTime > currentTime) {
        return { time: outage.startTime, type: 'off' }
      }
    }
  }

  return null
}

function formatTimeUntil(targetTime: string): string {
  const now = new Date()
  const [hours, minutes] = targetTime.split(':').map(Number)
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)

  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return 'зараз'

  const diffMinutes = Math.floor(diff / 1000 / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const remainingMinutes = diffMinutes % 60

  if (diffHours > 0) {
    return `${diffHours} год ${remainingMinutes} хв`
  }
  return `${diffMinutes} хв`
}

export function CurrentStatus({ schedule, queueNumber, status }: CurrentStatusProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const isEmergency = status === 'EmergencyShutdowns' || schedule?.status === 'EmergencyShutdowns'
  const { isOff, isConfirmed } = isCurrentlyOff(schedule)
  const nextChange = getNextChange(schedule)

  // Emergency shutdowns - special display
  if (isEmergency) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="relative overflow-hidden rounded-2xl p-6 text-center bg-gradient-to-br from-orange-600 to-red-700">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12" />
          </div>

          {/* Status icon */}
          <div className="relative mb-3">
            <span className="text-5xl">⚠️</span>
          </div>

          {/* Main status text */}
          <h2 className="relative text-2xl font-bold text-white mb-2">
            Аварійні відключення
          </h2>

          {/* Queue number */}
          <p className="relative text-white/80 text-sm mb-4">
            Черга {queueNumber}
          </p>

          {/* Warning message */}
          <div className="relative bg-white/20 rounded-xl px-4 py-3">
            <p className="text-white/90 text-sm">
              Графіки не діють
            </p>
            <p className="text-white font-medium text-sm mt-1">
              Відключення можуть відбуватися у будь-який час
            </p>
          </div>

          {/* Current time */}
          <p className="relative text-white/60 text-xs mt-4">
            {currentTime.toLocaleTimeString('uk-UA')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className={`
          relative overflow-hidden rounded-2xl p-6 text-center
          ${isOff
            ? isConfirmed
              ? 'bg-gradient-to-br from-red-500 to-red-600 power-off'
              : 'bg-gradient-to-br from-yellow-500 to-yellow-600 power-maybe'
            : 'bg-gradient-to-br from-green-500 to-green-600 power-on animate-glow'
          }
        `}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12" />
        </div>

        {/* Status icon */}
        <div className="relative mb-3">
          <span className="text-5xl">
            {isOff ? '🔌' : '💡'}
          </span>
        </div>

        {/* Main status text */}
        <h2 className="relative text-2xl font-bold text-white mb-2">
          {isOff
            ? isConfirmed
              ? 'Зараз світла немає'
              : 'Можливо, світла немає'
            : 'Зараз світло є'
          }
        </h2>

        {/* Queue number */}
        <p className="relative text-white/80 text-sm mb-4">
          Черга {queueNumber}
        </p>

        {/* Next change countdown */}
        {nextChange && (
          <div className="relative bg-white/20 rounded-xl px-4 py-3">
            <p className="text-white/90 text-sm">
              {nextChange.type === 'on' ? 'Світло з\'явиться' : 'Відключення'} о{' '}
              <span className="font-bold">{nextChange.time}</span>
            </p>
            <p className="text-white font-bold text-lg">
              через {formatTimeUntil(nextChange.time)}
            </p>
          </div>
        )}

        {/* Current time */}
        <p className="relative text-white/60 text-xs mt-4">
          {currentTime.toLocaleTimeString('uk-UA')}
        </p>
      </div>
    </div>
  )
}
