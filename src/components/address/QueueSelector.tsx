'use client'

import { useState, useEffect } from 'react'

interface QueueSelectorProps {
  onSelect: (operatorCode: string, queueNumber: string) => void
  initialOperator?: string
  initialQueue?: string
}

const OPERATORS = [
  { code: 'yasno-kyiv', name: 'YASNO Київ', region: 'Київ' },
  { code: 'yasno-dnipro', name: 'YASNO Дніпро', region: 'Дніпро' },
]

// YASNO queue numbers - groups with sub-groups only (1.1, 1.2, 2.1, etc.)
const QUEUE_NUMBERS = [
  '1.1', '1.2',
  '2.1', '2.2',
  '3.1', '3.2',
  '4.1', '4.2',
  '5.1', '5.2',
  '6.1', '6.2',
]

export function QueueSelector({ onSelect, initialOperator, initialQueue }: QueueSelectorProps) {
  const [selectedOperator, setSelectedOperator] = useState(initialOperator || '')
  const [selectedQueue, setSelectedQueue] = useState(initialQueue || '')

  useEffect(() => {
    if (selectedOperator && selectedQueue) {
      onSelect(selectedOperator, selectedQueue)
    }
  }, [selectedOperator, selectedQueue, onSelect])

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Region/Operator selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Оберіть регіон
        </label>
        <div className="grid grid-cols-2 gap-2">
          {OPERATORS.map((op) => (
            <button
              key={op.code}
              onClick={() => setSelectedOperator(op.code)}
              className={`
                p-3 rounded-xl text-center transition-all
                ${selectedOperator === op.code
                  ? 'bg-sunrise-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-sunrise-50 border border-gray-200'
                }
              `}
            >
              <span className="block font-medium">{op.region}</span>
              <span className="block text-xs opacity-75">{op.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Queue selector */}
      {selectedOperator && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Оберіть чергу (групу)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {QUEUE_NUMBERS.map((queue) => (
              <button
                key={queue}
                onClick={() => setSelectedQueue(queue)}
                className={`
                  p-3 rounded-xl text-center transition-all font-medium
                  ${selectedQueue === queue
                    ? 'bg-sunrise-500 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-sunrise-50 border border-gray-200'
                  }
                `}
              >
                {queue}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Не знаєте свою чергу? Перевірте на сайті{' '}
            <a
              href="https://kyiv.yasno.com.ua/schedule-turn-off-electricity"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sunrise-600 hover:underline"
            >
              YASNO
            </a>
            {' '}або у квитанції за електроенергію.
          </p>
        </div>
      )}
    </div>
  )
}
