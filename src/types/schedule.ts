// Outage types as defined by Ukrainian energy ministry
export type OutageType = 'planned' | 'emergency' | 'stabilization'
export type OutageStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'

// YASNO API specific types
export type YasnoOutageType = 'DEFINITE_OUTAGE' | 'POSSIBLE_OUTAGE'

export interface Outage {
  id?: number
  startTime: string // "08:00"
  endTime: string   // "11:00"
  type: OutageType
  isConfirmed: boolean // definite vs possible
  status: OutageStatus
}

// Schedule status from YASNO API
export type ScheduleStatus = 'ScheduleApplies' | 'WaitingForSchedule' | 'EmergencyShutdowns'

export interface DaySchedule {
  date: string // ISO date
  outages: Outage[]
  status?: ScheduleStatus
}

export interface QueueSchedule {
  queueNumber: string // "1", "1.1", "1.2", etc.
  today: DaySchedule
  tomorrow: DaySchedule
}

export interface OperatorSchedule {
  operatorCode: string
  operatorName: string
  region: string
  queues: Record<string, QueueSchedule>
  lastUpdated: string
}

// YASNO API response types
export interface YasnoOutage {
  start: string
  end: string
  type: YasnoOutageType
}

export interface YasnoGroupSchedule {
  [groupId: string]: {
    outages: YasnoOutage[]
  }
}

export interface YasnoDaySchedule {
  title: string
  groups: YasnoGroupSchedule
}

export interface YasnoRegionSchedule {
  today: YasnoDaySchedule
  tomorrow: YasnoDaySchedule
}

export interface YasnoScheduleComponent {
  template_name: string
  available_regions: string[]
  dailySchedule: {
    [region: string]: YasnoRegionSchedule
  }
}

export interface YasnoApiResponse {
  components: YasnoScheduleComponent[]
}

// Address types
export interface Address {
  id: number
  operatorId: number
  queueId: number
  cityUk: string
  streetUk: string
  buildingNumbers?: string
}

export interface Queue {
  id: number
  operatorId: number
  queueNumber: string
  operatorCode: string
}

export interface AddressSearchResult {
  address: Address
  queue: Queue
  displayText: string
}

// User types
export interface UserAddress {
  id: number
  queueId: number
  queueNumber: string
  operatorCode: string
  customLabel?: string
  cityUk: string
  streetUk: string
  notifyBeforeMinutes: number
  isPrimary: boolean
}
