export default defineEventHandler(async (event) => {
  const hall = getRouterParam(event, 'hall')

  if (!hall || isNaN(Number(hall))) {
    throw createError({
      statusCode: 400,
      message: 'Invalid hall parameter',
    })
  }

  try {
    const query = `
      SELECT washers_available, dryers_available, date_added
      FROM laundry
      WHERE hall = ?
      ORDER BY date_added DESC
      LIMIT 1
    `

    interface LaundryRecord {
      washers_available: number
      dryers_available: number
      date_added: Date
    }

    const results = await queryDatabase<LaundryRecord>(query, [Number(hall)])

    if (!results || results.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'No data found for hall',
      })
    }

    const record = results[0]
    const dateAdded = new Date(record.date_added)

    // Format time like "4:30PM"
    const hours = dateAdded.getHours()
    const minutes = dateAdded.getMinutes()
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    const timestamp = `${displayHours}:${displayMinutes}${period}`

    return {
      'Washing Machines': record.washers_available,
      'Dryers': record.dryers_available,
      'Timestamp': timestamp,
    }
  }
  catch (error) {
    console.error('Database error:', error)
    throw createError({
      statusCode: 500,
      message: 'Database error',
    })
  }
})
