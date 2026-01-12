import type {
  OperatorSchedule,
  QueueSchedule,
  DaySchedule,
  Outage,
} from '@/types/schedule'

// New YASNO API endpoints (app.yasno.ua)
const PLANNED_OUTAGES_URL = 'https://app.yasno.ua/api/blackout-service/public/shutdowns/regions/{regionId}/dsos/{dsoId}/planned-outages'

// Region configuration with proper IDs
interface RegionConfig {
  code: string
  name: string
  region: string
  regionId: number
  dsoId: number
}

const REGIONS: RegionConfig[] = [
  { code: 'yasno-kyiv', name: 'YASNO Київ', region: 'Київ', regionId: 25, dsoId: 902 },
  { code: 'yasno-dnipro', name: 'YASNO Дніпро', region: 'Дніпро', regionId: 3, dsoId: 301 },
]

// API response types
interface PlannedSlot {
  start: number  // Minutes from midnight (0-1440)
  end: number
  type: 'Definite' | 'NotPlanned'
}

interface DayData {
  date: string
  status: 'ScheduleApplies' | 'WaitingForSchedule' | 'EmergencyShutdowns'
  slots: PlannedSlot[]
  updatedOn?: string
}

interface GroupSchedule {
  today: DayData
  tomorrow: DayData
}

type PlannedOutagesResponse = Record<string, GroupSchedule>

// Convert minutes from midnight to "HH:MM" format
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// Parse slots into outages (only "Definite" slots are actual outages)
function parseSlotsToOutages(slots: PlannedSlot[]): Outage[] {
  if (!slots || !Array.isArray(slots)) return []

  return slots
    .filter((slot) => slot.type === 'Definite')
    .map((slot) => ({
      startTime: minutesToTime(slot.start),
      endTime: minutesToTime(slot.end),
      type: 'planned' as const,
      isConfirmed: true,
      status: 'scheduled' as const,
    }))
}

// Parse day data into DaySchedule
function parseDaySchedule(dayData: DayData | undefined): DaySchedule {
  if (!dayData) {
    return {
      date: new Date().toISOString().split('T')[0],
      outages: [],
    }
  }

  return {
    date: dayData.date ? dayData.date.split('T')[0] : new Date().toISOString().split('T')[0],
    outages: parseSlotsToOutages(dayData.slots),
    status: dayData.status,
  }
}

// Fetch planned outages for a specific region
async function fetchRegionSchedule(regionConfig: RegionConfig): Promise<OperatorSchedule | null> {
  const url = PLANNED_OUTAGES_URL
    .replace('{regionId}', String(regionConfig.regionId))
    .replace('{dsoId}', String(regionConfig.dsoId))

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SvitloTracker/1.0',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      console.error(`YASNO API error for ${regionConfig.code}: ${response.status}`)
      return null
    }

    const data: PlannedOutagesResponse = await response.json()

    // Build queue schedules from response
    const queues: Record<string, QueueSchedule> = {}

    for (const [groupKey, groupSchedule] of Object.entries(data)) {
      // Group keys are like "1.1", "1.2", "2.1", etc.
      const queueNumber = groupKey

      queues[queueNumber] = {
        queueNumber,
        today: parseDaySchedule(groupSchedule.today),
        tomorrow: parseDaySchedule(groupSchedule.tomorrow),
      }
    }

    return {
      operatorCode: regionConfig.code,
      operatorName: regionConfig.name,
      region: regionConfig.region,
      queues,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Error fetching schedule for ${regionConfig.code}:`, error)
    return null
  }
}

export async function fetchYasnoSchedule(): Promise<{ operators: OperatorSchedule[]; noOutages: boolean }> {
  try {
    // Fetch schedules for all regions in parallel
    const results = await Promise.all(
      REGIONS.map((region) => fetchRegionSchedule(region))
    )

    const operators = results.filter((op): op is OperatorSchedule => op !== null)

    // Check if there are any actual outages
    const hasOutages = operators.some((op) =>
      Object.values(op.queues).some(
        (q) => q.today.outages.length > 0 || q.tomorrow.outages.length > 0
      )
    )

    if (!hasOutages) {
      console.log('No outages scheduled - good news for Ukraine!')
    }

    return { operators, noOutages: !hasOutages }
  } catch (error) {
    console.error('Error fetching YASNO schedule:', error)
    throw error
  }
}

export async function getScheduleForQueue(
  operatorCode: string,
  queueNumber: string
): Promise<{ schedule: QueueSchedule | null; noOutages: boolean }> {
  const { operators, noOutages } = await fetchYasnoSchedule()

  const operator = operators.find((s) => s.operatorCode === operatorCode)

  if (!operator) {
    return { schedule: null, noOutages }
  }

  const schedule = operator.queues[queueNumber] || null

  // If schedule exists but has no outages, it's still valid (just empty)
  return { schedule, noOutages: schedule ? noOutages : false }
}

// Get available queue numbers for a region
export async function getAvailableQueues(operatorCode: string): Promise<string[]> {
  const { operators } = await fetchYasnoSchedule()
  const operator = operators.find((s) => s.operatorCode === operatorCode)

  if (!operator) return []

  return Object.keys(operator.queues).sort((a, b) => {
    // Sort numerically: "1.1" < "1.2" < "2.1"
    const [aMain, aSub] = a.split('.').map(Number)
    const [bMain, bSub] = b.split('.').map(Number)
    if (aMain !== bMain) return aMain - bMain
    return (aSub || 0) - (bSub || 0)
  })
}
