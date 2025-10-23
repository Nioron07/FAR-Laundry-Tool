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

def predict_single_day(hall, target_type, date_str):
    """Generate predictions for a full day (00:00 to 23:59) using Random Forest"""

    # Load model
    base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
    model_path = os.path.join(base_path, f'{target_type}_model.pkl')

    with open(model_path, 'rb') as f:
        model = pickle.load(f)

    # Parse the date string (YYYY-MM-DD)
    try:
        date_parts = date_str.split('-')
        year = int(date_parts[0])
        month = int(date_parts[1])
        day = int(date_parts[2])
    except:
        print(f"Error parsing date: {date_str}", file=sys.stderr)
        return []

    # Create start and end times for the day in Central Time
    central_tz = ZoneInfo('America/Chicago')
    start_of_day = datetime(year, month, day, 0, 0, 0, tzinfo=central_tz)
    end_of_day = datetime(year, month, day, 23, 59, 59, tzinfo=central_tz)

    # Generate prediction timestamps (every 5 minutes)
    prediction_times = []
    current = start_of_day

    while current <= end_of_day:
        prediction_times.append(current)
        current += timedelta(minutes=5)

    if len(prediction_times) == 0:
        return []

    # Create DataFrame with all predictions at once (batch prediction)
    # Features: hall, month, weekday, hour, minute, year, day
    features_list = []
    for pred_time in prediction_times:
        # Convert to naive datetime for feature extraction
        pred_time_naive = pred_time.replace(tzinfo=None)
        features_list.append({
            'hall': int(hall),
            'month': pred_time_naive.month,
            'weekday': pred_time_naive.weekday(),
            'hour': pred_time_naive.hour,
            'minute': pred_time_naive.minute,
            'year': pred_time_naive.year,
            'day': pred_time_naive.day
        })

    features_df = pd.DataFrame(features_list)

    # Batch predict all values at once
    predicted_values = model.predict(features_df)

    # Format results
    predictions = []
    for i, pred_time in enumerate(prediction_times):
        new_value = max(0, int(round(predicted_values[i])))

        # Keep timestamps in Central Time to match historical data format
        predictions.append({
            'timestamp': pred_time.isoformat(),
            'value': new_value
        })

    return predictions

if __name__ == "__main__":
    # Read input from command line
    hall = sys.argv[1]
    target_type = sys.argv[2]  # 'washers' or 'dryers'
    date_str = sys.argv[3]  # 'YYYY-MM-DD'

    predictions = predict_single_day(hall, target_type, date_str)

    print(json.dumps(predictions))
