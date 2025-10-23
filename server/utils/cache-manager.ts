import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'

interface PredictionPoint {
  timestamp: string
  value: number
}

interface HallPredictions {
  day: {
    washers: PredictionPoint[]
    dryers: PredictionPoint[]
  }
  week: {
    washers: PredictionPoint[]
    dryers: PredictionPoint[]
  }
}

interface CacheData {
  generatedAt: string
  generatedDate: string
  halls: {
    [hallId: string]: HallPredictions
  }
}

const CACHE_FILE_PATH = path.join(process.cwd(), 'server', 'cache', 'predictions-cache.json')

/**
 * Check if cache file exists and is from today (Central Time)
 */
export async function isCacheValid(): Promise<boolean> {
  try {
    // Check if file exists
    await fs.access(CACHE_FILE_PATH)

    // Read cache file
    const cacheContent = await fs.readFile(CACHE_FILE_PATH, 'utf-8')
    const cache: CacheData = JSON.parse(cacheContent)

    // Get today's date in Central Time
    const nowCentral = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
    const todayDate = new Date(nowCentral).toISOString().split('T')[0]

    // Check if cache is from today
    return cache.generatedDate === todayDate
  }
  catch (error) {
    // File doesn't exist or is invalid
    return false
  }
}

/**
 * Load cache from file
 */
export async function loadCache(): Promise<CacheData | null> {
  try {
    const cacheContent = await fs.readFile(CACHE_FILE_PATH, 'utf-8')
    return JSON.parse(cacheContent)
  }
  catch (error) {
    console.error('Error loading cache:', error)
    return null
  }
}

/**
 * Run Python prediction script
 */
async function runPythonPrediction(
  scriptName: string,
  hall: string,
  targetType: string
): Promise<PredictionPoint[]> {
  return new Promise((resolve, reject) => {
    const predictScript = path.join(process.cwd(), 'server', 'utils', scriptName)
    const python = spawn('python', [predictScript, hall, targetType, '[]'])

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
        console.log(`Python ${targetType} ${scriptName} stderr:`, error)
      }

      if (code !== 0) {
        console.error(`Python script error for ${scriptName}:`, error)
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

/**
 * Generate all predictions and save to cache
 */
export async function generateAndSaveCache(): Promise<void> {
  console.log('[Cache] Generating fresh predictions...')

  const halls = ['0', '1'] // Oglesby and Trelease
  const targetTypes = ['washers', 'dryers']
  const cacheData: CacheData = {
    generatedAt: new Date().toISOString(),
    generatedDate: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }).split('T')[0]!.split(',')[0]!,
    halls: {},
  }

  // Generate predictions for each hall
  for (const hall of halls) {
    console.log(`[Cache] Generating predictions for hall ${hall}...`)

    const hallPredictions: HallPredictions = {
      day: { washers: [], dryers: [] },
      week: { washers: [], dryers: [] },
    }

    // Generate day and week predictions for washers and dryers
    for (const targetType of targetTypes) {
      console.log(`[Cache]   - ${targetType} (day)...`)
      const dayPredictions = await runPythonPrediction('predict.py', hall, targetType)
      hallPredictions.day[targetType as 'washers' | 'dryers'] = dayPredictions

      console.log(`[Cache]   - ${targetType} (week)...`)
      const weekPredictions = await runPythonPrediction('predict_week.py', hall, targetType)
      hallPredictions.week[targetType as 'washers' | 'dryers'] = weekPredictions
    }

    cacheData.halls[hall] = hallPredictions
  }

  // Save to file
  console.log('[Cache] Saving predictions to cache file...')
  await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8')
  console.log('[Cache] Cache generation complete!')
}

/**
 * Get cached predictions for a specific hall and type
 */
export async function getCachedPredictions(
  hall: string,
  predictionType: 'day' | 'week'
): Promise<{ washers: PredictionPoint[], dryers: PredictionPoint[] } | null> {
  const cache = await loadCache()
  if (!cache) {
    return null
  }

  const hallData = cache.halls[hall]
  if (!hallData) {
    return null
  }

  return hallData[predictionType]
}

/**
 * Merge SQL historical data with cached predictions
 * Uses SQL data where available, predictions for future timestamps
 */
export function mergePredictionsWithSQL(
  sqlData: Array<{ timestamp: string, washers: number, dryers: number }>,
  cachedPredictions: { washers: PredictionPoint[], dryers: PredictionPoint[] }
): Array<{ timestamp: string, washers: number, dryers: number, isHistorical: boolean }> {
  // Helper to round timestamp to nearest 5-minute interval
  const roundTo5Minutes = (timestamp: string): string => {
    const date = new Date(timestamp)
    const ms = date.getTime()
    const roundedMs = Math.round(ms / (5 * 60 * 1000)) * (5 * 60 * 1000)
    return new Date(roundedMs).toISOString()
  }

  // Create a map of SQL data by ROUNDED timestamp
  // If multiple SQL points round to the same timestamp, keep the most recent one
  const sqlMap = new Map<string, { washers: number, dryers: number }>()
  sqlData.forEach(item => {
    const roundedTimestamp = roundTo5Minutes(item.timestamp)
    sqlMap.set(roundedTimestamp, { washers: item.washers, dryers: item.dryers })
  })

  // Create map of predictions by timestamp
  const predictionMap = new Map<string, { washers: number | null, dryers: number | null }>()

  cachedPredictions.washers.forEach(pred => {
    const existing = predictionMap.get(pred.timestamp) || { washers: null, dryers: null }
    existing.washers = pred.value
    predictionMap.set(pred.timestamp, existing)
  })

  cachedPredictions.dryers.forEach(pred => {
    const existing = predictionMap.get(pred.timestamp) || { washers: null, dryers: null }
    existing.dryers = pred.value
    predictionMap.set(pred.timestamp, existing)
  })

  // Start with SQL data (using rounded timestamps)
  const result: Array<{ timestamp: string, washers: number, dryers: number, isHistorical: boolean }> = []
  sqlMap.forEach((data, roundedTimestamp) => {
    result.push({
      timestamp: roundedTimestamp,
      washers: data.washers,
      dryers: data.dryers,
      isHistorical: true,
    })
  })

  // Add predictions for timestamps not in SQL
  predictionMap.forEach((pred, timestamp) => {
    if (!sqlMap.has(timestamp)) {
      result.push({
        timestamp,
        washers: pred.washers ?? 0,
        dryers: pred.dryers ?? 0,
        isHistorical: false,
      })
    }
  })

  // Sort by timestamp
  result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return result
}
