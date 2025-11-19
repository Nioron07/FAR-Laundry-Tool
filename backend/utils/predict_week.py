import json
import sys
import numpy as np
import pandas as pd
import pickle
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import warnings
import os

warnings.filterwarnings('ignore')

# Import the shared model cache from predict.py
from .predict import load_model

def predict_week(hall, target_type, historical_data):
    """Generate predictions from now until Sunday midnight (end of week) using Random Forest"""

    # Load model (will use cached version if available)
    model = load_model(target_type)

    # Get current time in Central Time (timezone-naive)
    now_utc = datetime.now(timezone.utc)
    now_central = now_utc.astimezone(ZoneInfo('America/Chicago'))
    now = now_central.replace(tzinfo=None)

    # Calculate end of week (Sunday 23:59:59)
    days_until_sunday = (6 - now.weekday()) % 7  # 0 = Monday, 6 = Sunday
    if days_until_sunday == 0 and now.hour < 23:
        # If today is Sunday but before midnight, end is tonight
        end_of_week = now.replace(hour=23, minute=59, second=59, microsecond=0)
    else:
        # Otherwise, find next Sunday
        end_of_week = now + timedelta(days=days_until_sunday)
        end_of_week = end_of_week.replace(hour=23, minute=59, second=59, microsecond=0)

    # Generate prediction timestamps (every 5 minutes)
    # Round current time to nearest 5-minute interval
    prediction_times = []
    current_minute = now.minute
    rounded_minute = round(current_minute / 5) * 5
    if rounded_minute >= 60:
        current = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    else:
        current = now.replace(minute=rounded_minute, second=0, microsecond=0)

    while current <= end_of_week:
        prediction_times.append(current)
        current += timedelta(minutes=5)

    if len(prediction_times) == 0:
        return []

    # Create DataFrame with all predictions at once (batch prediction)
    # Features: hall, month, weekday, hour, minute, year, day
    features_list = []
    for pred_time in prediction_times:
        features_list.append({
            'hall': int(hall),
            'month': pred_time.month,
            'weekday': pred_time.weekday(),
            'hour': pred_time.hour,
            'minute': pred_time.minute,
            'year': pred_time.year,
            'day': pred_time.day
        })

    features_df = pd.DataFrame(features_list)

    # Batch predict all values at once
    predicted_values = model.predict(features_df)

    # Format results
    predictions = []
    for i, pred_time in enumerate(prediction_times):
        new_value = max(0, int(round(predicted_values[i])))

        # Keep timestamps in Central Time to match historical data format
        pred_time_aware = pred_time.replace(tzinfo=ZoneInfo('America/Chicago'))

        predictions.append({
            'timestamp': pred_time_aware.isoformat(),
            'value': new_value
        })

    return predictions

if __name__ == "__main__":
    # Read input from command line
    hall = sys.argv[1]
    target_type = sys.argv[2]  # 'washers' or 'dryers'

    # Third argument is now a file path instead of JSON string
    if len(sys.argv) > 3:
        historical_file = sys.argv[3]

        # Check if it's a file path or JSON string (for backwards compatibility)
        if os.path.exists(historical_file):
            # Read from file
            with open(historical_file, 'r') as f:
                historical_data = json.load(f)
        else:
            # Fallback to parsing as JSON string
            historical_data = json.loads(historical_file)
    else:
        historical_data = []

    predictions = predict_week(hall, target_type, historical_data)

    print(json.dumps(predictions))
