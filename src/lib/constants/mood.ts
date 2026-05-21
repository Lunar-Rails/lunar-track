import type { MoodEnergy, MoodProductivity } from '@/lib/types/database'

export const ENERGY_OPTIONS: { value: MoodEnergy; emoji: string; label: string }[] = [
  { value: 'terrible', emoji: '😩', label: 'Terrible' },
  { value: 'meh', emoji: '😐', label: 'Meh' },
  { value: 'okay', emoji: '🙂', label: 'Okay' },
  { value: 'great', emoji: '🔥', label: 'Great' },
]

export const PRODUCTIVITY_OPTIONS: { value: MoodProductivity; emoji: string; label: string }[] = [
  { value: 'waste', emoji: '🐌', label: 'Waste of time' },
  { value: 'fine', emoji: '👍', label: "Can't complain" },
  { value: 'ludicrous', emoji: '🚀', label: 'LudicrousSpeed' },
]

export const ENERGY_META: Record<MoodEnergy, { emoji: string; label: string; level: number; color: string }> = {
  terrible: { emoji: '😩', label: 'Terrible', level: 1, color: 'bg-red-400' },
  meh: { emoji: '😐', label: 'Meh', level: 2, color: 'bg-yellow-400' },
  okay: { emoji: '🙂', label: 'Okay', level: 3, color: 'bg-blue-400' },
  great: { emoji: '🔥', label: 'Great', level: 4, color: 'bg-green-400' },
}

export const PRODUCTIVITY_META: Record<MoodProductivity, { emoji: string; label: string; level: number; color: string }> = {
  waste: { emoji: '🐌', label: 'Waste of time', level: 1, color: 'bg-red-400' },
  fine: { emoji: '👍', label: "Can't complain", level: 2, color: 'bg-blue-400' },
  ludicrous: { emoji: '🚀', label: 'LudicrousSpeed', level: 3, color: 'bg-green-400' },
}
