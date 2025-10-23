import { isCacheValid, generateAndSaveCache } from '../utils/cache-manager'
import { scheduleMidnightRegeneration } from '../utils/scheduler'

export default defineNitroPlugin(async (nitroApp) => {
  console.log('[Server] Initializing prediction cache system...')

  try {
    // Check if cache is valid (exists and is from today)
    const cacheValid = await isCacheValid()

    if (!cacheValid) {
      console.log('[Server] Cache is invalid or missing, generating fresh predictions...')
      await generateAndSaveCache()
    }
    else {
      console.log('[Server] Cache is valid, using existing predictions')
    }

    // Schedule midnight regeneration
    scheduleMidnightRegeneration()

    console.log('[Server] Cache system initialized successfully')
  }
  catch (error) {
    console.error('[Server] Error initializing cache:', error)
    // Don't crash the server, but log the error
  }
})
