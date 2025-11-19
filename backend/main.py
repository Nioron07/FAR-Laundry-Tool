"""Flask backend for FAR Laundry Tool"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file FIRST before any other imports
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    print('[Server] Loading environment variables from .env file...')
    load_dotenv(env_file)
else:
    print('[Server] No .env file found, using system environment variables')

# Now import other modules that depend on environment variables
from flask import Flask
from flask_cors import CORS
from api.routes import api_bp
from utils.cache import is_cache_valid, generate_and_save_cache
from utils.download_models import download_models_from_gcs

# Download models from GCS on startup if needed
try:
    download_models_from_gcs()
except Exception as e:
    print(f'[Server] Failed to download models from GCS: {e}')
    print('[Server] Will attempt to use local models if available')

app = Flask(__name__)

# Enable CORS only for production frontend domain
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://farlaundry.com",
            "http://localhost:3000",  # For local frontend development
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": False
    }
})

# Register API blueprint
app.register_blueprint(api_bp, url_prefix='/api')

# Initialize prediction cache on startup
print('[Server] Initializing prediction cache system...')
if not is_cache_valid():
    print('[Server] Cache is invalid or missing, generating fresh predictions...')
    try:
        generate_and_save_cache()
    except Exception as e:
        print(f'[Server] Error generating cache: {e}')
        print('[Server] Will continue without cache, predictions will be generated on demand')
else:
    print('[Server] Cache is valid and up to date')


@app.route('/')
def index():
    return {'status': 'OK', 'message': 'FAR Laundry Backend API'}


@app.route('/health')
def health():
    return {'status': 'healthy'}


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
