'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueueSelector } from '@/components/address/QueueSelector'
import { CurrentStatus } from '@/components/schedule/CurrentStatus'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import type { QueueSchedule } from '@/types/schedule'

type Tab = 'today' | 'tomorrow'

// Ukrainian month names in genitive case
const MONTHS_UK = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
]

function formatDateUk(date: Date): string {
  const day = date.getDate()
  const month = MONTHS_UK[date.getMonth()]
  return `${day} ${month}`
}

function getToday(): Date {
  return new Date()
}

function getTomorrow(): Date {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow
}

export default function Home() {
  const [selectedOperator, setSelectedOperator] = useState<string>('')
  const [selectedQueue, setSelectedQueue] = useState<string>('')
  const [schedule, setSchedule] = useState<QueueSchedule | null>(null)
  const [noOutages, setNoOutages] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('today')

  // Load saved selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('svitlo-selection')
    if (saved) {
      try {
        const { operator, queue } = JSON.parse(saved)
        if (operator && queue) {
          setSelectedOperator(operator)
          setSelectedQueue(queue)
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // Save selection to localStorage
  useEffect(() => {
    if (selectedOperator && selectedQueue) {
      localStorage.setItem(
        'svitlo-selection',
        JSON.stringify({ operator: selectedOperator, queue: selectedQueue })
      )
    }
  }, [selectedOperator, selectedQueue])

  // Fetch schedule when selection changes
  useEffect(() => {
    if (!selectedOperator || !selectedQueue) return

    const fetchSchedule = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/schedule?operator=${selectedOperator}&queue=${selectedQueue}`
        )
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Помилка завантаження')
        }

        setSchedule(data.data)
        setNoOutages(data.noOutages || false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Помилка завантаження графіку')
      } finally {
        setLoading(false)
      }
    }

    fetchSchedule()

    // Refresh every 5 minutes
    const interval = setInterval(fetchSchedule, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [selectedOperator, selectedQueue])

  const handleQueueSelect = useCallback((operator: string, queue: string) => {
    setSelectedOperator(operator)
    setSelectedQueue(queue)
  }, [])

  const currentSchedule = activeTab === 'today' ? schedule?.today : schedule?.tomorrow

  return (
    <main className="min-h-screen py-8 px-4">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">
          <span className="text-sunrise-500">Svitlo</span> Tracker
        </h1>
        <p className="text-gray-600">
          Відстежуйте графіки відключень електроенергії
        </p>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Queue Selector */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Оберіть вашу чергу
          </h2>
          <QueueSelector
            onSelect={handleQueueSelect}
            initialOperator={selectedOperator}
            initialQueue={selectedQueue}
          />
        </section>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sunrise-500 border-t-transparent" />
            <p className="mt-2 text-gray-600">Завантаження графіку...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-red-500 hover:underline"
            >
              Спробувати ще раз
            </button>
          </div>
        )}

        {/* No outages celebration! */}
        {noOutages && schedule && !loading && (
          <section className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-2xl p-8 text-center shadow-lg">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">
              Графіки відключень не застосовуються!
            </h2>
            <p className="text-green-600 mb-4">
              Наразі обмежень від НЕК &quot;Укренерго&quot; немає.
              <br />
              Світло є цілодобово!
            </p>
            <div className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-medium">
              <span className="text-2xl">💡</span>
              <span>Черга {selectedQueue} — світло є!</span>
            </div>
          </section>
        )}

        {/* Schedule display (when there are outages) */}
        {schedule && !loading && !noOutages && (
          <>
            {/* Current Status */}
            <section>
              <CurrentStatus
                schedule={schedule.today}
                queueNumber={selectedQueue}
              />
            </section>

            {/* Day tabs */}
            <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setActiveTab('today')}
                  className={`
                    flex-1 py-2 px-4 rounded-xl font-medium transition-all
                    ${activeTab === 'today'
                      ? 'bg-sunrise-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  Сьогодні, {formatDateUk(getToday())}
                </button>
                <button
                  onClick={() => setActiveTab('tomorrow')}
                  className={`
                    flex-1 py-2 px-4 rounded-xl font-medium transition-all
                    ${activeTab === 'tomorrow'
                      ? 'bg-sunrise-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  Завтра, {formatDateUk(getTomorrow())}
                </button>
              </div>

              {/* Schedule Grid */}
              <ScheduleGrid
                schedule={currentSchedule || null}
                title={`Графік на ${activeTab === 'today' ? 'сьогодні' : 'завтра'}`}
              />
            </section>
          </>
        )}

        {/* Empty state */}
        {!schedule && !loading && !error && selectedOperator && selectedQueue && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              Графік для черги {selectedQueue} не знайдено
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>
          Дані з{' '}
          <a
            href="https://yasno.com.ua"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sunrise-600 hover:underline"
          >
            YASNO
          </a>
        </p>
        <p className="mt-1">
          Svitlo Tracker &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  )
}
