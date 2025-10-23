import { getCachedPredictions, mergePredictionsWithSQL } from '../../utils/cache-manager'

export default defineEventHandler(async (event) => {
  const hall = getRouterParam(event, 'hall')

  if (!hall || isNaN(Number(hall))) {
    throw createError({
      statusCode: 400,
      message: 'Invalid hall parameter',
    })
  }

  try {
    // Fetch all data from today (since midnight Central Time)
    // Database stores timestamps in Central Time
    const nowCentral = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
    const nowCentralDate = new Date(nowCentral)

    // Get midnight today in Central Time
    const midnightTodayCentral = new Date(nowCentralDate)
    midnightTodayCentral.setHours(0, 0, 0, 0)

    // Format as MySQL datetime: YYYY-MM-DD HH:MM:SS
    const formatMySQLDateTime = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      const second = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
    }

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

    // Format historical data for charts
    // Database stores timestamps in Central Time as naive DATETIME
    // We get the raw string from SQL and interpret it as Central Time, then convert to UTC
    const formattedHistorical = (historicalData || []).map((row) => {
      // Use the raw datetime string from SQL (format: "2025-10-21T19:57:06")
      const dateStr = row.date_added_str

      // Interpret this as Central Daylight Time (UTC-5) and convert to UTC
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

    if (!cachedPredictions) {
      throw createError({
        statusCode: 500,
        message: 'Cache not available',
      })
    }

    // Merge SQL data with cached predictions
    const mergedData = mergePredictionsWithSQL(formattedHistorical, cachedPredictions)

    // Split into historical and predictions based on isHistorical flag
    const historical = mergedData.filter(d => d.isHistorical)
    const predictions = mergedData.filter(d => !d.isHistorical)

    // Calculate statistics for annotations
    const allWasherValues = mergedData.map(d => d.washers).filter(v => v !== null && v !== undefined)
    const allDryerValues = mergedData.map(d => d.dryers).filter(v => v !== null && v !== undefined)

    const stats = {
      washers: {
        min: allWasherValues.length > 0 ? Math.min(...allWasherValues) : 0,
        max: allWasherValues.length > 0 ? Math.max(...allWasherValues) : 0,
        current: historical.length > 0 ? historical[historical.length - 1]!.washers : 0,
      },
      dryers: {
        min: allDryerValues.length > 0 ? Math.min(...allDryerValues) : 0,
        max: allDryerValues.length > 0 ? Math.max(...allDryerValues) : 0,
        current: historical.length > 0 ? historical[historical.length - 1]!.dryers : 0,
      },
    }

    return {
      historical,
      predictions,
      stats,
      lastUpdate: new Date().toISOString(),
    }
  }
  catch (error) {
    console.error('Forecast error:', error)
    throw createError({
      statusCode: 500,
      message: 'Error generating forecast',
    })
  }
})