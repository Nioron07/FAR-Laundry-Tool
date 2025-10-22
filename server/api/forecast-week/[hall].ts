import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

export default defineEventHandler(async (event) => {
  const hall = getRouterParam(event, 'hall')

  if (!hall || isNaN(Number(hall))) {
    throw createError({
      statusCode: 400,
      message: 'Invalid hall parameter',
    })
  }

  try {
    // Fetch all data from start of week (Monday) to now
    // Database stores timestamps in Central Time
    const nowCentral = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
    const nowCentralDate = new Date(nowCentral)

    // Get Monday 00:00:00 of current week in Central Time
    const mondayThisWeek = new Date(nowCentralDate)
    const dayOfWeek = mondayThisWeek.getDay() // 0 = Sunday, 1 = Monday, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // If Sunday, go back 6 days to Monday
    mondayThisWeek.setDate(mondayThisWeek.getDate() - daysToSubtract)
    mondayThisWeek.setHours(0, 0, 0, 0)

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
      formatMySQLDateTime(mondayThisWeek),
    ])

    if (!historicalData || historicalData.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'No historical data found for hall',
      })
    }

    // Run Python script for predictions (using week mode)
    const predictScript = path.join(process.cwd(), 'server', 'utils', 'predict_week.py')

    const runPrediction = async (targetType: string): Promise<any[]> => {
      return new Promise(async (resolve, reject) => {
        // Write historical data to temp file to avoid command line length limit
        const tmpFile = path.join(os.tmpdir(), `laundry_week_${hall}_${targetType}_${Date.now()}.json`)

        try {
          const historicalJson = JSON.stringify(
            historicalData.map(row => ({
              hall: row.hall,
              [`${targetType}_available`]: targetType === 'washers' ? row.washers_available : row.dryers_available,
              date_added: row.date_added_str,  // Use string format from MySQL (Central Time)
            }))
          )

          await fs.writeFile(tmpFile, historicalJson, 'utf8')

          // Pass the temp file path instead of the JSON string
          const python = spawn('python', [predictScript, hall, targetType, tmpFile])
          let output = ''
          let error = ''

          python.stdout.on('data', (data) => {
            output += data.toString()
          })

          python.stderr.on('data', (data) => {
            error += data.toString()
          })

          python.on('close', async (code) => {
            // Clean up temp file
            try {
              await fs.unlink(tmpFile)
            }
            catch (e) {
              console.error('Error deleting temp file:', e)
            }

            // Log stderr output for debugging
            if (error) {
              console.log(`Python ${targetType} stderr:`, error)
            }

            if (code !== 0) {
              console.error('Python script error:', error)
              // Return empty predictions on error
              resolve([])
            }
            else {
              try {
                const predictions = JSON.parse(output)
                resolve(predictions)
              }
              catch (e) {
                console.error('Error parsing predictions:', e)
                resolve([])
              }
            }
          })
        }
        catch (err) {
          console.error('Error in runPrediction:', err)
          try {
            await fs.unlink(tmpFile)
          }
          catch (e) {
            // Ignore cleanup errors
          }
          resolve([])
        }
      })
    }

    // Get predictions for both washers and dryers
    const [washerPredictions, dryerPredictions] = await Promise.all([
      runPrediction('washers'),
      runPrediction('dryers'),
    ])

    // Format historical data for charts
    // Database stores timestamps in Central Time as naive DATETIME
    // We get the raw string from SQL and interpret it as Central Time, then convert to UTC
    const formattedHistorical = historicalData.map((row) => {
      // Use the raw datetime string from SQL (format: "2025-10-21T19:57:06")
      const dateStr = row.date_added_str

      // Interpret this as Central Daylight Time (UTC-5) and convert to UTC
      const centralDateStr = `${dateStr}-05:00`
      const utcDate = new Date(centralDateStr)

      return {
        timestamp: utcDate.toISOString(),
        washers: row.washers_available,
        dryers: row.dryers_available,
        isHistorical: true,
      }
    })

    // Combine predictions (if any)
    const formattedPredictions = []
    const predictionCount = Math.max(washerPredictions.length, dryerPredictions.length)

    for (let i = 0; i < predictionCount; i++) {
      const timestamp = washerPredictions[i]?.timestamp || dryerPredictions[i]?.timestamp
      if (timestamp) {
        formattedPredictions.push({
          timestamp,
          washers: washerPredictions[i]?.value ?? null,
          dryers: dryerPredictions[i]?.value ?? null,
          isHistorical: false,
        })
      }
    }

    // Calculate statistics for annotations
    const allWasherValues = [
      ...historicalData.map(r => r.washers_available),
      ...washerPredictions.map(p => p.value),
    ].filter(v => v !== null && v !== undefined)

    const allDryerValues = [
      ...historicalData.map(r => r.dryers_available),
      ...dryerPredictions.map(p => p.value),
    ].filter(v => v !== null && v !== undefined)

    const stats = {
      washers: {
        min: Math.min(...allWasherValues),
        max: Math.max(...allWasherValues),
        current: historicalData[historicalData.length - 1]?.washers_available || 0,
      },
      dryers: {
        min: Math.min(...allDryerValues),
        max: Math.max(...allDryerValues),
        current: historicalData[historicalData.length - 1]?.dryers_available || 0,
      },
    }

    return {
      historical: formattedHistorical,
      predictions: formattedPredictions,
      stats,
      lastUpdate: new Date().toISOString(),
    }
  }
  catch (error) {
    console.error('Week forecast error:', error)
    throw createError({
      statusCode: 500,
      message: 'Error generating week forecast',
    })
  }
})
