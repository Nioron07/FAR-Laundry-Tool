import json
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .vertex_predict import vertex_batch_predict


def predict_week(hall, target_type):
    """Generate predictions for the full week (Monday 00:00 to Sunday 23:59) via Vertex AI endpoint"""

    # Get current date in Central Time
    now_utc = datetime.now(timezone.utc)
    now_central = now_utc.astimezone(ZoneInfo('America/Chicago'))
    today = now_central.replace(tzinfo=None)

    # Calculate start of week (Monday 00:00) and end of week (Sunday 23:59:59)
    days_since_monday = today.weekday()  # 0 = Monday, 6 = Sunday
    start_of_week = (today - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    end_of_week = (start_of_week + timedelta(days=6)).replace(
        hour=23, minute=59, second=59, microsecond=0
    )

    # Generate prediction timestamps (every 5 minutes)
    prediction_times = []
    current = start_of_week

    while current <= end_of_week:
        prediction_times.append(current)
        current += timedelta(minutes=5)

    if len(prediction_times) == 0:
        return []

    # Build feature rows
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

    # Call Vertex AI endpoint
    predicted_values = vertex_batch_predict(target_type, features_list)

    # Format results
    predictions = []
    for i, pred_time in enumerate(prediction_times):
        new_value = max(0, int(round(predicted_values[i])))

        pred_time_aware = pred_time.replace(tzinfo=ZoneInfo('America/Chicago'))

        predictions.append({
            'timestamp': pred_time_aware.isoformat(),
            'value': new_value
        })

    return predictions

if __name__ == "__main__":
    hall = sys.argv[1]
    target_type = sys.argv[2]  # 'washers' or 'dryers'

    predictions = predict_week(hall, target_type)

    print(json.dumps(predictions))
