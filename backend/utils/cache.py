"""Prediction cache management"""
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional

from .predict import predict_day
from .predict_week import predict_week

# Cache file path
CACHE_DIR = Path(__file__).parent.parent / 'cache'
CACHE_FILE_PATH = CACHE_DIR / 'predictions-cache.json'


def ensure_cache_dir():
    """Ensure cache directory exists"""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def is_cache_valid() -> bool:
    """Check if cache file exists and is from today (Central Time)"""
    try:
        if not CACHE_FILE_PATH.exists():
            return False

        with open(CACHE_FILE_PATH, 'r') as f:
            cache = json.load(f)

        # Get today's date in Central Time
        now_central = datetime.now(ZoneInfo('America/Chicago'))
        today_date = now_central.strftime('%Y-%m-%d')

        # Check if cache is from today
        return cache.get('generatedDate') == today_date
    except Exception as e:
        print(f'Error checking cache validity: {e}')
        return False


def load_cache() -> Optional[Dict]:
    """Load cache from file"""
    try:
        with open(CACHE_FILE_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f'Error loading cache: {e}')
        return None


def generate_and_save_cache():
    """Generate all predictions and save to cache"""
    print('[Cache] Generating fresh predictions...')

    ensure_cache_dir()

    halls = ['0', '1']  # Oglesby and Trelease
    target_types = ['washers', 'dryers']

    now_central = datetime.now(ZoneInfo('America/Chicago'))

    cache_data = {
        'generatedAt': now_central.isoformat(),
        'generatedDate': now_central.strftime('%Y-%m-%d'),
        'halls': {}
    }

    # Generate predictions for each hall
    for hall in halls:
        print(f'[Cache] Generating predictions for hall {hall}...')

        hall_predictions = {
            'day': {'washers': [], 'dryers': []},
            'week': {'washers': [], 'dryers': []}
        }

        # Generate day and week predictions for washers and dryers
        for target_type in target_types:
            print(f'[Cache]   - {target_type} (day)...')
            day_predictions = predict_day(hall, target_type, [])
            hall_predictions['day'][target_type] = day_predictions

            print(f'[Cache]   - {target_type} (week)...')
            week_predictions = predict_week(hall, target_type, [])
            hall_predictions['week'][target_type] = week_predictions

        cache_data['halls'][hall] = hall_predictions

    # Save to file
    print('[Cache] Saving predictions to cache file...')
    with open(CACHE_FILE_PATH, 'w') as f:
        json.dump(cache_data, f, indent=2)

    print('[Cache] Cache generation complete!')


def get_cached_predictions(hall: str, prediction_type: str) -> Optional[Dict[str, List]]:
    """Get cached predictions for a specific hall and type

    Args:
        hall: Hall ID ('0' or '1')
        prediction_type: 'day' or 'week'

    Returns:
        Dict with 'washers' and 'dryers' lists, or None if not found
    """
    cache = load_cache()
    if not cache:
        return None

    hall_data = cache.get('halls', {}).get(hall)
    if not hall_data:
        return None

    return hall_data.get(prediction_type)


