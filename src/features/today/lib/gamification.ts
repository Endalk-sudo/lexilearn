export type DailyChallenge = {
  key: 'sprint' | 'recall' | 'streak'
  title: string
  description: string
  target: number
  reward: number
  progress: number
  icon: 'target' | 'brain' | 'flame'
}

export function getDailyChallenge(stats: { learnedToday: number; todayCorrect: number; streak: number; dailyGoal: number; xpToday: number }): DailyChallenge {
  const day = Math.floor(Date.now() / 86_400_000)
  const type = day % 3
  if (type === 0) return { key: 'sprint', title: '10-word Sprint', description: 'Review or learn 10 words today.', target: 10, reward: 35, progress: Math.min(10, stats.learnedToday), icon: 'target' }
  if (type === 1) return { key: 'recall', title: 'Recall Run', description: 'Get 8 answers right today.', target: 8, reward: 40, progress: Math.min(8, stats.todayCorrect), icon: 'brain' }
  return { key: 'streak', title: 'Show Up', description: 'Keep your daily streak alive.', target: 1, reward: 25, progress: stats.streak > 0 ? 1 : 0, icon: 'flame' }
}

export function formatRelativeDay(date: string | null) {
  if (!date) return 'Never'
  const then = new Date(`${date}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - then.getTime()) / 86_400_000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}
