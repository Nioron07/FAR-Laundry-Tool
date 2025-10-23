import { generateAndSaveCache } from './cache-manager'

/**
 * Calculate milliseconds until next midnight in Central Time
 */
function getMillisecondsUntilMidnight(): number {
  // Get current time in Central Time
  const nowCentral = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  const now = new Date(nowCentral)

  // Calculate next midnight Central Time
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0) // Next midnight

  const diff = midnight.getTime() - now.getTime()
  return diff
}

/**
 * Schedule cache regeneration at midnight Central Time
 */
export function scheduleMidnightRegeneration(): void {
  const scheduleNext = () => {
    const msUntilMidnight = getMillisecondsUntilMidnight()

    console.log(`[Scheduler] Next cache regeneration scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`)

    setTimeout(async () => {
      console.log('[Scheduler] Midnight reached, regenerating cache...')

      try {
        await generateAndSaveCache()
        console.log('[Scheduler] Midnight cache regeneration complete')
      }
      catch (error) {
        console.error('[Scheduler] Error during midnight regeneration:', error)
      }

      // Schedule the next midnight regeneration
      scheduleNext()
    }, msUntilMidnight)
  }

  // Start the scheduler
  scheduleNext()
}
