import { NextRequest, NextResponse } from 'next/server'
import { getScheduleForQueue, fetchYasnoSchedule } from '@/lib/scrapers/yasno-client'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const operatorCode = searchParams.get('operator')
  const queueNumber = searchParams.get('queue')

  try {
    // If specific queue requested
    if (operatorCode && queueNumber) {
      const { schedule, noOutages } = await getScheduleForQueue(operatorCode, queueNumber)

      if (!schedule) {
        return NextResponse.json(
          { error: 'Графік не знайдено', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: schedule,
        noOutages,
        meta: {
          operatorCode,
          queueNumber,
          fetchedAt: new Date().toISOString(),
        },
      })
    }

    // Return all schedules
    const { operators, noOutages } = await fetchYasnoSchedule()

    return NextResponse.json({
      success: true,
      data: operators,
      noOutages,
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Schedule API error:', error)
    return NextResponse.json(
      {
        error: 'Помилка завантаження графіку',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
