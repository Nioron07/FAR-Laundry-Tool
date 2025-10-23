import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// Force www to non-www redirect only
app.use((req, res, next) => {
  const host = req.hostname

  // Only redirect if www is present (let App Engine handle HTTPS)
  if (host && host.startsWith('www.')) {
    const newHost = host.slice(4)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https'
    return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`)
  }

  next()
})

// Serve static files from .output/public
app.use(express.static(path.join(__dirname, '.output/public'), {
  maxAge: '1y',
  etag: true,
}))

// Handle SPA routing - serve index.html for all unmatched routes
app.get('*', (req, res) => {
  // Try to serve the specific page's index.html first
  const pagePath = path.join(__dirname, '.output/public', req.path, 'index.html')
  const fallbackPath = path.join(__dirname, '.output/public', '200.html')
  const notFoundPath = path.join(__dirname, '.output/public', '404.html')

  // Check if page-specific HTML exists
  res.sendFile(pagePath, (err) => {
    if (err) {
      // Fall back to 200.html for client-side routing
      res.sendFile(fallbackPath, (err) => {
        if (err) {
          // Final fallback to 404.html
          res.status(404).sendFile(notFoundPath)
        }
      })
    }
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`)
})
