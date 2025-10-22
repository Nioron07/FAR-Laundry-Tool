import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

export default defineEventHandler(async (event) => {
  const hall = getRouterParam(event, 'hall')
  const dateParam = getRouterParam(event, 'date')

  console.log('Received hall:', hall, 'date:', dateParam)

  if (!hall || isNaN(Number(hall))) {
    throw createError({
      statusCode: 400,
      message: 'Invalid hall parameter',
    })
  }

  if (!dateParam) {
    throw createError({
      statusCode: 400,
      message: 'Invalid date parameter',
    })
  }

  try {
    // Parse the date parameter (expected format: YYYY-MM-DD)
    const targetDate = new Date(dateParam)
    if (isNaN(targetDate.getTime())) {
      console.error('Invalid date:', dateParam)
      throw createError({
        statusCode: 400,
        message: 'Invalid date format. Expected YYYY-MM-DD',
      })
    }

    // We're going to generate predictions for the entire day using a custom Python script
    const predictScript = path.join(process.cwd(), 'server', 'utils', 'predict_single_day.py')

    const runPrediction = async (targetType: string): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        // Pass the date and hall to the Python script
        const python = spawn('python', [predictScript, hall, targetType, dateParam])
        let output = ''
        let error = ''

        python.stdout.on('data', (data) => {
          output += data.toString()
        })

        python.stderr.on('data', (data) => {
          error += data.toString()
        })

        python.on('close', (code) => {
          if (error) {
            console.log(`Python ${targetType} stderr:`, error)
          }

          if (code !== 0) {
            console.error('Python script error:', error)
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
      })
    }

    // Get predictions for both washers and dryers
    const [washerPredictions, dryerPredictions] = await Promise.all([
      runPrediction('washers'),
      runPrediction('dryers'),
    ])

    // Combine predictions
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

    return {
      historical: [], // No historical data for future dates
      predictions: formattedPredictions,
      date: dateParam,
      lastUpdate: new Date().toISOString(),
    }
  }
  catch (error) {
    console.error('Forecast date error:', error)
    throw createError({
      statusCode: 500,
      message: 'Error generating forecast for date',
    })
  }
})
