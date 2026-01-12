'use client'

import { useMemo } from 'react'
import type { DaySchedule, Outage } from '@/types/schedule'

interface ScheduleGridProps {
  schedule: DaySchedule | null
  title?: string
}

interface TimeBlock {
  hour: number
  minute: number // 0 or 30
  status: 'on' | 'off' | 'maybe'
  outage: Outage | null
}

// Convert "HH:MM" to total minutes from midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function getTimeBlocks(schedule: DaySchedule | null): TimeBlock[] {
  // Create 48 blocks (24 hours * 2 half-hours)
  const blocks: TimeBlock[] = Array.from({ length: 48 }, (_, i) => ({
    hour: Math.floor(i / 2),
    minute: (i % 2) * 30,
    status: 'on' as const,
    outage: null,
  }))

  if (!schedule?.outages) return blocks

  for (const outage of schedule.outages) {
    const startMinutes = timeToMinutes(outage.startTime)
    const endMinutes = timeToMinutes(outage.endTime)

    // Mark each 30-minute block that falls within the outage
    for (let i = 0; i < 48; i++) {
      const blockStartMinutes = i * 30
      const blockEndMinutes = blockStartMinutes + 30

      // Block is affected if it overlaps with outage period
      if (blockStartMinutes < endMinutes && blockEndMinutes > startMinutes) {
        blocks[i] = {
          hour: Math.floor(i / 2),
          minute: (i % 2) * 30,
          status: outage.isConfirmed ? 'off' : 'maybe',
          outage,
        }
      }
    }
  }

  return blocks
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// Get current 30-minute block index
function getCurrentBlockIndex(): number {
  const now = new Date()
  return now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0)
}

export function ScheduleGrid({ schedule, title }: ScheduleGridProps) {
  const timeBlocks = useMemo(() => getTimeBlocks(schedule), [schedule])
  const currentBlockIndex = getCurrentBlockIndex()

  const isEmergency = schedule?.status === 'EmergencyShutdowns'
  const isWaiting = schedule?.status === 'WaitingForSchedule'

  return (
    <div className="w-full max-w-2xl mx-auto">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      )}

      {/* Emergency shutdowns warning */}
      {isEmergency && (
        <div className="mb-4 p-4 bg-red-100 border-2 border-red-400 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h4 className="font-bold text-red-800">Аварійні відключення</h4>
              <p className="text-red-700 text-sm">
                Графіки не діють. Відключення можуть відбуватися у будь-який час.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for schedule */}
      {isWaiting && (
        <div className="mb-4 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⏳</span>
            <div>
              <h4 className="font-bold text-yellow-800">Очікується графік</h4>
              <p className="text-yellow-700 text-sm">
                Графік ще не опублікований. Перевірте пізніше.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-gray-600">Світло є</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span className="text-gray-600">Відключення</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span className="text-gray-600">Можливе</span>
        </div>
      </div>

      {/* Grid - 8 columns for better fit with 48 blocks */}
      <div className="grid grid-cols-8 gap-0.5 sm:gap-1">
        {timeBlocks.map((block, index) => (
          <div
            key={index}
            className={`
              schedule-cell relative p-1 sm:p-2 text-center rounded-lg
              ${block.status === 'on'
                ? 'bg-green-100 hover:bg-green-200'
                : block.status === 'off'
                  ? 'bg-red-100 hover:bg-red-200'
                  : 'bg-yellow-100 hover:bg-yellow-200'
              }
              ${index === currentBlockIndex ? 'ring-2 ring-sunrise-500 ring-offset-1' : ''}
            `}
            title={
              block.outage
                ? `${block.outage.startTime} - ${block.outage.endTime} (${block.outage.isConfirmed ? 'точно' : 'можливо'})`
                : 'Світло є'
            }
          >
            {/* Time label */}
            <span className={`
              text-[10px] sm:text-xs font-medium
              ${block.status === 'on'
                ? 'text-green-700'
                : block.status === 'off'
                  ? 'text-red-700'
                  : 'text-yellow-700'
              }
            `}>
              {formatTime(block.hour, block.minute)}
            </span>

            {/* Status icon */}
            <div className="mt-0.5">
              {block.status === 'on' ? (
                <span className="text-green-500 text-xs sm:text-sm">●</span>
              ) : block.status === 'off' ? (
                <span className="text-red-500 text-xs sm:text-sm">●</span>
              ) : (
                <span className="text-yellow-500 text-xs sm:text-sm">●</span>
              )}
            </div>

            {/* Current block indicator */}
            {index === currentBlockIndex && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-sunrise-500 rounded-full animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {schedule?.outages && schedule.outages.length > 0 && (
        <div className="mt-4 p-4 bg-cream-100 rounded-xl">
          <h4 className="font-medium text-gray-700 mb-2">Заплановані відключення:</h4>
          <ul className="space-y-1">
            {schedule.outages.map((outage, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <span className={`
                  inline-block w-2 h-2 rounded-full
                  ${outage.isConfirmed ? 'bg-red-500' : 'bg-yellow-500'}
                `} />
                <span className="font-medium">{outage.startTime} - {outage.endTime}</span>
                <span className="text-gray-400">
                  ({outage.isConfirmed ? 'точно' : 'можливо'})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
