export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const data = body.data

    if (!data || !Array.isArray(data) || data.length < 3) {
      throw createError({
        statusCode: 400,
        message: 'Invalid data format',
      })
    }

    const [washers, dryers, hall] = data

    // Get current time in Central timezone (US/Central)
    const now = new Date()

    // Use Intl.DateTimeFormat to get proper Central time components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'long',
      hour12: false
    })

    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0'

    const year = parseInt(getPart('year'))
    const month = parseInt(getPart('month'))
    const day = parseInt(getPart('day'))
    const hour = parseInt(getPart('hour'))
    const minute = parseInt(getPart('minute'))
    const second = parseInt(getPart('second'))

    // Get weekday (0 = Sunday, 1 = Monday, etc.)
    const weekdayName = getPart('weekday')
    const weekdayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }
    const weekday = weekdayMap[weekdayName] || 0

    // Format as MySQL datetime: YYYY-MM-DD HH:MM:SS
    const dateAdded = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`

    const insertQuery = `
      INSERT INTO laundry
      (washers_available, dryers_available, hall, month, weekday, hour, minute, year, date_added, day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    await queryDatabase(insertQuery, [
      washers,
      dryers,
      hall,
      month,
      weekday,
      hour,
      minute,
      year,
      dateAdded,
      day,
    ])

    return {
      success: true,
      message: 'Data submitted successfully',
    }
  }
  catch (error: any) {
    console.error('Contribute error:', error)

    // Check if it's a duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      throw createError({
        statusCode: 400,
        message: 'Duplicate submission',
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to submit data',
    })
  }
})
