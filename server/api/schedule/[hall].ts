import { getCachedPredictions, mergePredictionsWithSQL } from '../../utils/cache-manager'
import { generatePredictionsForDate } from '../../utils/predict-day'

interface PredictionPoint {
  timestamp: string
  value: number
}

export default defineEventHandler(async (event) => {
  const hall = getRouterParam(event, 'hall')
  const query = getQuery(event)

  if (!hall || isNaN(Number(hall))) {
    throw createError({
      statusCode: 400,
      message: 'Invalid hall parameter',
    })
  }

  const {
    startDate,
    endDate,
    frequencyDays,
    timeMin,
    timeMax,
    daysOfWeek,
    timeConstraints,
    algorithmPreference,
  } = query

  if (!startDate || !endDate || !frequencyDays) {
    throw createError({
      statusCode: 400,
      message: 'Missing required parameters: startDate, endDate, frequencyDays',
    })
  }

  try {
    console.log('[Schedule API] Raw dates received:', { startDate, endDate })

    // Parse dates - handle both ISO string and date object formats
    let start: Date
    let end: Date

    if (typeof startDate === 'string') {
      // Extract just the date part (YYYY-MM-DD) and create a date at noon UTC to avoid timezone issues
      const startDateStr = startDate.split('T')[0]
      start = new Date(startDateStr + 'T12:00:00.000Z')
    } else {
      start = new Date(startDate as any)
      start.setUTCHours(12, 0, 0, 0)
    }

    if (typeof endDate === 'string') {
      const endDateStr = endDate.split('T')[0]
      end = new Date(endDateStr + 'T12:00:00.000Z')
    } else {
      end = new Date(endDate as any)
      end.setUTCHours(12, 0, 0, 0)
    }

    console.log('[Schedule API] Parsed dates:', { start: start.toISOString(), end: end.toISOString() })

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw createError({
        statusCode: 400,
        message: 'Invalid date format',
      })
    }

    const frequency = parseInt(frequencyDays as string)
    const minHour = timeMin ? parseInt(timeMin as string) : 0
    const maxHour = timeMax ? parseInt(timeMax as string) : 23
    const allowedDays = daysOfWeek
      ? (daysOfWeek as string).split(',').map(d => parseInt(d))
      : [0, 1, 2, 3, 4, 5, 6]

    // Parse per-day time constraints if provided
    let dayTimeConstraints: Record<number, { start: number, end: number }> | null = null
    if (timeConstraints) {
      try {
        const parsed = JSON.parse(timeConstraints as string)
        dayTimeConstraints = {}
        Object.entries(parsed).forEach(([day, range]) => {
          const [start, end] = (range as string).split('-').map(Number)
          dayTimeConstraints![parseInt(day)] = { start, end }
        })
      }
      catch (e) {
        console.error('Error parsing timeConstraints:', e)
      }
    }

    if (start > end) {
      throw createError({
        statusCode: 400,
        message: 'Start date must be before end date',
      })
    }

    // Generate laundry day list
    const laundryDays: Date[] = []
    let currentDay = new Date(start)

    console.log('[Schedule API] Start date:', start.toISOString(), 'End date:', end.toISOString())
    console.log('[Schedule API] Allowed days:', allowedDays)
    console.log('[Schedule API] Day time constraints:', dayTimeConstraints)

    while (currentDay <= end) {
      // Use UTC day of week since our dates are already at noon UTC
      const dayOfWeek = currentDay.getUTCDay()

      console.log(`[Schedule API] Checking ${currentDay.toISOString()} -> Day: ${dayOfWeek} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}) -> Allowed: ${allowedDays.includes(dayOfWeek)}`)

      if (allowedDays.includes(dayOfWeek)) {
        laundryDays.push(new Date(currentDay))
      }
      currentDay.setUTCDate(currentDay.getUTCDate() + frequency)
    }

    console.log('[Schedule API] Generated laundry days:', laundryDays.length, laundryDays.map(d => d.toISOString()))

    // Helper function to get predictions for a date
    const getPredictionsForDate = async (targetDate: Date): Promise<{ washers: PredictionPoint[], dryers: PredictionPoint[] }> => {
      // Get today's date in Central Time
      const nowCentral = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
      const nowCentralDate = new Date(nowCentral)
      const todayDateStr = `${nowCentralDate.getFullYear()}-${String(nowCentralDate.getMonth() + 1).padStart(2, '0')}-${String(nowCentralDate.getDate()).padStart(2, '0')}`

      // Get target date string
      const targetYear = targetDate.getUTCFullYear()
      const targetMonth = targetDate.getUTCMonth() + 1
      const targetDay = targetDate.getUTCDate()
      const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`

      console.log(`[Schedule] Getting predictions for ${targetDateStr} (today is ${todayDateStr})`)

      // Check if this is today's date
      const isToday = targetDateStr === todayDateStr

      if (isToday) {
        console.log('[Schedule] Target date is TODAY - using cache + historical SQL data')

        // Get midnight today in Central Time
        const midnightTodayCentral = new Date(nowCentralDate)
        midnightTodayCentral.setHours(0, 0, 0, 0)

        // Format as MySQL datetime
        const formatMySQLDateTime = (date: Date) => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hour = String(date.getHours()).padStart(2, '0')
          const minute = String(date.getMinutes()).padStart(2, '0')
          const second = String(date.getSeconds()).padStart(2, '0')
          return `${year}-${month}-${day} ${hour}:${minute}:${second}`
        }

        // Fetch historical data from SQL
        const query = `
          SELECT hall, washers_available, dryers_available,
                 DATE_FORMAT(date_added, '%Y-%m-%dT%H:%i:%s') as date_added_str,
                 date_added
          FROM laundry
          WHERE hall = ? AND date_added >= ?
          ORDER BY date_added ASC
        `

        interface LaundryRecord {
          hall: number
          washers_available: number
          dryers_available: number
          date_added: Date
          date_added_str: string
        }

        const historicalData = await queryDatabase<LaundryRecord>(query, [
          Number(hall),
          formatMySQLDateTime(midnightTodayCentral),
        ])

        // Format historical data
        const formattedHistorical = (historicalData || []).map((row) => {
          const dateStr = row.date_added_str
          const centralDateStr = `${dateStr}-05:00`
          const utcDate = new Date(centralDateStr)

          return {
            timestamp: utcDate.toISOString(),
            washers: row.washers_available,
            dryers: row.dryers_available,
          }
        })

        // Get cached predictions
        const cachedPredictions = await getCachedPredictions(hall, 'day')

        if (cachedPredictions) {
          // Merge SQL data with cached predictions
          const mergedData = mergePredictionsWithSQL(formattedHistorical, cachedPredictions)

          // Convert back to separate washer and dryer arrays
          const washers = mergedData.map(d => ({ timestamp: d.timestamp, value: d.washers }))
          const dryers = mergedData.map(d => ({ timestamp: d.timestamp, value: d.dryers }))

          console.log(`[Schedule] Today: ${washers.length} merged predictions (${formattedHistorical.length} historical, ${cachedPredictions.washers.length} cached)`)

          return { washers, dryers }
        }
        else {
          console.log('[Schedule] No cache available for today, using historical data only')
          const washers = formattedHistorical.map(d => ({ timestamp: d.timestamp, value: d.washers }))
          const dryers = formattedHistorical.map(d => ({ timestamp: d.timestamp, value: d.dryers }))
          return { washers, dryers }
        }
      }
      else {
        // Future date - generate predictions on-demand
        console.log(`[Schedule] Future date - generating on-demand predictions for ${targetDateStr}`)
        const [washerPreds, dryerPreds] = await Promise.all([
          generatePredictionsForDate(hall, targetDate, 'washers'),
          generatePredictionsForDate(hall, targetDate, 'dryers'),
        ])

        return { washers: washerPreds, dryers: dryerPreds }
      }
    }

    // Helper function to find best time for a specific day
    const findBestTimeForDay = async (targetDate: Date) => {
      // Use UTC day of week since our dates are at noon UTC
      const dayOfWeekIndex = targetDate.getUTCDay()
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeekIndex]

      // Get predictions for this date (cached or on-demand)
      const predictions = await getPredictionsForDate(targetDate)

      // Determine time constraints for this specific day
      let dayMinHour = minHour
      let dayMaxHour = maxHour

      if (dayTimeConstraints && dayTimeConstraints[dayOfWeekIndex]) {
        dayMinHour = dayTimeConstraints[dayOfWeekIndex].start
        dayMaxHour = dayTimeConstraints[dayOfWeekIndex].end
      }

      console.log(`[Schedule] ${dayOfWeek}: ${predictions.washers.length} washers, ${predictions.dryers.length} dryers before filtering. Time range: ${dayMinHour}-${dayMaxHour}`)

      // Debug: Log sample timestamps and hours for Monday
      if (dayOfWeek === 'Monday' && predictions.washers.length > 0) {
        const sampleHours = predictions.washers.slice(0, 5).map(p => {
          const d = new Date(p.timestamp)
          return { timestamp: p.timestamp, hour: d.getHours(), utcHour: d.getUTCHours() }
        })
        console.log(`[Schedule] Monday sample hours:`, JSON.stringify(sampleHours))
      }

      // Filter predictions by time constraints
      const washerPredictions = predictions.washers.filter(pred => {
        const predDate = new Date(pred.timestamp)
        const predHour = predDate.getHours()
        return predHour >= dayMinHour && predHour <= dayMaxHour
      })

      const dryerPredictions = predictions.dryers.filter(pred => {
        const predDate = new Date(pred.timestamp)
        const predHour = predDate.getHours()
        return predHour >= dayMinHour && predHour <= dayMaxHour
      })

      console.log(`[Schedule] ${dayOfWeek}: ${washerPredictions.length} washers, ${dryerPredictions.length} dryers after time filtering`)

      // Create combined score map
      const scoreMap = new Map<string, { washers: number, dryers: number, combined: number }>()

      washerPredictions.forEach(pred => {
        const existing = scoreMap.get(pred.timestamp) || { washers: 0, dryers: 0, combined: 0 }
        existing.washers = pred.value
        scoreMap.set(pred.timestamp, existing)
      })

      dryerPredictions.forEach(pred => {
        const existing = scoreMap.get(pred.timestamp) || { washers: 0, dryers: 0, combined: 0 }
        existing.dryers = pred.value
        scoreMap.set(pred.timestamp, existing)
      })

      // Calculate combined scores based on algorithm preference
      const preference = (algorithmPreference as string) || 'balanced'
      scoreMap.forEach((value, key) => {
        if (preference === 'washers') {
          value.combined = value.washers * 0.7 + value.dryers * 0.3
        }
        else if (preference === 'dryers') {
          value.combined = value.washers * 0.3 + value.dryers * 0.7
        }
        else {
          // balanced
          value.combined = (value.washers + value.dryers) / 2
        }
      })

      if (scoreMap.size === 0) {
        return {
          date: targetDate.toISOString().split('T')[0],
          dayOfWeek,
          bestTime: null,
          bestTimeFormatted: 'No availability',
          washersAvailable: 0,
          dryersAvailable: 0,
          combinedScore: 0,
          alternativeTimes: [],
        }
      }

      // Find best times (top 3)
      const sortedTimes = Array.from(scoreMap.entries())
        .sort((a, b) => b[1].combined - a[1].combined)

      const best = sortedTimes[0]
      const bestDate = new Date(best[0])
      const bestTime = `${String(bestDate.getHours()).padStart(2, '0')}:${String(bestDate.getMinutes()).padStart(2, '0')}`

      const formatTime12h = (hour: number, minute: number) => {
        const period = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
      }

      return {
        date: targetDate.toISOString().split('T')[0],
        dayOfWeek,
        bestTime,
        bestTimeFormatted: formatTime12h(bestDate.getHours(), bestDate.getMinutes()),
        washersAvailable: Math.round(best[1].washers),
        dryersAvailable: Math.round(best[1].dryers),
        combinedScore: Math.round(best[1].combined * 10) / 10,
        alternativeTimes: sortedTimes.slice(1, 4).map(([timestamp]) => {
          const dt = new Date(timestamp)
          return formatTime12h(dt.getHours(), dt.getMinutes())
        }),
        allSortedTimes: sortedTimes.map(([timestamp, scores]) => ({
          time: `${String(new Date(timestamp).getHours()).padStart(2, '0')}:${String(new Date(timestamp).getMinutes()).padStart(2, '0')}`,
          formatted: formatTime12h(new Date(timestamp).getHours(), new Date(timestamp).getMinutes()),
          washers: Math.round(scores.washers),
          dryers: Math.round(scores.dryers),
          score: Math.round(scores.combined * 10) / 10,
        })),
      }
    }

    // Generate schedule (process each day in parallel for speed)
    const schedule = await Promise.all(laundryDays.map(day => findBestTimeForDay(day)))

    // Calculate summary stats
    const validSchedules = schedule.filter(s => s.bestTime !== null)
    const averageAvailability = validSchedules.length > 0
      ? validSchedules.reduce((sum, s) => sum + s.combinedScore, 0) / validSchedules.length
      : 0

    return {
      schedule,
      summary: {
        totalDays: laundryDays.length,
        validDays: validSchedules.length,
        averageAvailability: Math.round(averageAvailability * 10) / 10,
        constraintsApplied: timeMin !== undefined || timeMax !== undefined || daysOfWeek !== undefined || timeConstraints !== undefined,
        perDayConstraints: dayTimeConstraints !== null,
      },
    }
  }
  catch (error) {
    console.error('Schedule generation error:', error)
    throw createError({
      statusCode: 500,
      message: 'Error generating schedule',
    })
  }
})
