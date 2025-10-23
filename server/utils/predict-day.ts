import { spawn } from 'child_process'
import path from 'path'

interface PredictionPoint {
  timestamp: string
  value: number
}

/**
 * Generate predictions for a specific date using Python script
 */
export async function generatePredictionsForDate(
  hall: string,
  targetDate: Date,
  targetType: 'washers' | 'dryers'
): Promise<PredictionPoint[]> {
  return new Promise((resolve, reject) => {
    const predictScript = path.join(process.cwd(), 'server', 'utils', 'predict_single_day.py')

    // Format date as YYYY-MM-DD
    const dateStr = targetDate.toISOString().split('T')[0]

    const python = spawn('python', [predictScript, hall, targetType, dateStr])

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
        console.error(`Python script error for ${targetType}:`, error)
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
