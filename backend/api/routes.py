"""API routes for FAR Laundry Tool"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict
import traceback

from utils.cache import (
    get_cached_predictions,
    is_cache_valid,
    generate_and_save_cache
)
from utils.predict_single_day import predict_single_day
from utils.vertex_predict import vertex_batch_predict

api_bp = Blueprint('api', __name__)


def get_central_time() -> datetime:
    """Get current time in Central timezone"""
    return datetime.now(ZoneInfo('America/Chicago'))


# 1. GET /api/current/{hall} - Get current predicted availability
@api_bp.route('/current/<int:hall>', methods=['GET'])
def get_current_availability(hall):
    """Get predicted availability for the current time"""
    try:
        now = get_central_time()

        features = [{
            'hall': int(hall),
            'month': now.month,
            'weekday': now.weekday(),
            'hour': now.hour,
            'minute': now.minute,
            'year': now.year,
            'day': now.day
        }]

        washer_pred = vertex_batch_predict('washers', features)
        dryer_pred = vertex_batch_predict('dryers', features)

        washers = max(0, int(round(washer_pred[0])))
        dryers = max(0, int(round(dryer_pred[0])))

        # Format time like "4:30PM"
        period = 'PM' if now.hour >= 12 else 'AM'
        display_hours = now.hour % 12 or 12
        display_minutes = str(now.minute).zfill(2)
        timestamp = f'{display_hours}:{display_minutes}{period}'

        return jsonify({
            'Washing Machines': washers,
            'Dryers': dryers,
            'Timestamp': timestamp
        })

    except Exception as e:
        print(f'Prediction error: {e}')
        traceback.print_exc()
        return jsonify({'error': 'Prediction error'}), 500


# 2. GET /api/forecast/{hall} - Get day forecast
@api_bp.route('/forecast/<int:hall>', methods=['GET'])
def get_forecast(hall):
    """Get day forecast with predictions"""
    try:
        # Get cached predictions
        cached_predictions = get_cached_predictions(str(hall), 'day')

        if not cached_predictions:
            return jsonify({'historical': [], 'predictions': [], 'stats': {}}), 200

        # Build predictions list from cache
        pred_map = {}
        for pred in cached_predictions.get('washers', []):
            ts = pred['timestamp']
            if ts not in pred_map:
                pred_map[ts] = {'washers': None, 'dryers': None}
            pred_map[ts]['washers'] = pred['value']

        for pred in cached_predictions.get('dryers', []):
            ts = pred['timestamp']
            if ts not in pred_map:
                pred_map[ts] = {'washers': None, 'dryers': None}
            pred_map[ts]['dryers'] = pred['value']

        predictions = []
        for ts, values in pred_map.items():
            predictions.append({
                'timestamp': ts,
                'washers': values['washers'] or 0,
                'dryers': values['dryers'] or 0,
                'isHistorical': False
            })

        predictions.sort(key=lambda x: datetime.fromisoformat(x['timestamp']))

        # Calculate stats
        all_washers = [p['washers'] for p in predictions if p['washers'] is not None]
        all_dryers = [p['dryers'] for p in predictions if p['dryers'] is not None]

        stats = {
            'avgWashers': sum(all_washers) / len(all_washers) if all_washers else 0,
            'avgDryers': sum(all_dryers) / len(all_dryers) if all_dryers else 0,
            'maxWashers': max(all_washers) if all_washers else 0,
            'maxDryers': max(all_dryers) if all_dryers else 0,
            'minWashers': min(all_washers) if all_washers else 0,
            'minDryers': min(all_dryers) if all_dryers else 0
        }

        return jsonify({
            'historical': [],
            'predictions': predictions,
            'stats': stats
        })

    except Exception as e:
        print(f'Forecast error: {e}')
        traceback.print_exc()
        return jsonify({'error': 'Server error'}), 500


# 3. GET /api/forecast-week/{hall} - Get week forecast
@api_bp.route('/forecast-week/<int:hall>', methods=['GET'])
def get_week_forecast(hall):
    """Get week forecast with predictions"""
    try:
        # Get cached predictions
        cached_predictions = get_cached_predictions(str(hall), 'week')

        if not cached_predictions:
            return jsonify({'historical': [], 'predictions': [], 'stats': {}}), 200

        # Build predictions list from cache
        pred_map = {}
        for pred in cached_predictions.get('washers', []):
            ts = pred['timestamp']
            if ts not in pred_map:
                pred_map[ts] = {'washers': None, 'dryers': None}
            pred_map[ts]['washers'] = pred['value']

        for pred in cached_predictions.get('dryers', []):
            ts = pred['timestamp']
            if ts not in pred_map:
                pred_map[ts] = {'washers': None, 'dryers': None}
            pred_map[ts]['dryers'] = pred['value']

        predictions = []
        for ts, values in pred_map.items():
            predictions.append({
                'timestamp': ts,
                'washers': values['washers'] or 0,
                'dryers': values['dryers'] or 0,
                'isHistorical': False
            })

        predictions.sort(key=lambda x: datetime.fromisoformat(x['timestamp']))

        # Calculate stats
        all_washers = [p['washers'] for p in predictions if p['washers'] is not None]
        all_dryers = [p['dryers'] for p in predictions if p['dryers'] is not None]

        stats = {
            'avgWashers': sum(all_washers) / len(all_washers) if all_washers else 0,
            'avgDryers': sum(all_dryers) / len(all_dryers) if all_dryers else 0,
            'maxWashers': max(all_washers) if all_washers else 0,
            'maxDryers': max(all_dryers) if all_dryers else 0,
            'minWashers': min(all_washers) if all_washers else 0,
            'minDryers': min(all_dryers) if all_dryers else 0
        }

        return jsonify({
            'historical': [],
            'predictions': predictions,
            'stats': stats
        })

    except Exception as e:
        print(f'Week forecast error: {e}')
        traceback.print_exc()
        return jsonify({'error': 'Server error'}), 500


# 4. GET /api/forecast-date/{hall}/{date} - Get forecast for specific date
@api_bp.route('/forecast-date/<int:hall>/<string:date>', methods=['GET'])
def get_date_forecast(hall, date):
    """Get forecast for a specific date"""
    try:
        # Generate predictions for this date
        washer_predictions = predict_single_day(str(hall), 'washers', date)
        dryer_predictions = predict_single_day(str(hall), 'dryers', date)

        # Format predictions
        pred_map = {}

        for pred in washer_predictions:
            timestamp = pred['timestamp']
            if timestamp not in pred_map:
                pred_map[timestamp] = {'washers': None, 'dryers': None}
            pred_map[timestamp]['washers'] = pred['value']

        for pred in dryer_predictions:
            timestamp = pred['timestamp']
            if timestamp not in pred_map:
                pred_map[timestamp] = {'washers': None, 'dryers': None}
            pred_map[timestamp]['dryers'] = pred['value']

        predictions = []
        for timestamp, values in pred_map.items():
            predictions.append({
                'timestamp': timestamp,
                'washers': values['washers'] or 0,
                'dryers': values['dryers'] or 0
            })

        predictions.sort(key=lambda x: datetime.fromisoformat(x['timestamp']))

        return jsonify({
            'historical': [],
            'predictions': predictions
        })

    except Exception as e:
        print(f'Date forecast error: {e}')
        traceback.print_exc()
        return jsonify({'error': 'Server error'}), 500


# 5. GET /api/schedule/{hall} - Get schedule planner results
@api_bp.route('/schedule/<int:hall>', methods=['GET'])
def get_schedule(hall):
    """Get schedule planner results"""
    try:
        # Get query parameters
        start_date_str = request.args.get('startDate')
        end_date_str = request.args.get('endDate')
        frequency_days_str = request.args.get('frequencyDays')
        days_of_week_str = request.args.get('daysOfWeek')
        time_constraints_str = request.args.get('timeConstraints')
        algorithm_preference = request.args.get('algorithmPreference', 'balanced')

        if not start_date_str or not end_date_str or not frequency_days_str:
            return jsonify({'error': 'Missing required parameters: startDate, endDate, frequencyDays'}), 400

        # Parse dates (YYYY-MM-DD format)
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        frequency_days = int(frequency_days_str)

        # Parse allowed days of week
        allowed_days = []
        if days_of_week_str:
            allowed_days = [int(d) for d in days_of_week_str.split(',')]
        else:
            allowed_days = [0, 1, 2, 3, 4, 5, 6]

        # Parse per-day time constraints if provided
        day_time_constraints = None
        if time_constraints_str:
            try:
                import json
                parsed = json.loads(time_constraints_str)
                day_time_constraints = {}
                for day, range_str in parsed.items():
                    start, end = range_str.split('-')
                    day_time_constraints[int(day)] = {'start': int(start), 'end': int(end)}
            except Exception as e:
                print(f'Error parsing timeConstraints: {e}')

        if start_date > end_date:
            return jsonify({'error': 'Start date must be before end date'}), 400

        # Generate laundry day list
        laundry_days = []
        current_day = start_date

        while current_day <= end_date:
            day_of_week = current_day.weekday()  # Monday=0, Sunday=6
            # Convert to Sunday=0 format (like JavaScript)
            day_of_week_sunday = (day_of_week + 1) % 7

            if day_of_week_sunday in allowed_days:
                laundry_days.append(current_day)

            current_day += timedelta(days=frequency_days)

        # Helper function to get predictions for a date
        def get_predictions_for_date(target_date):
            target_date_str = target_date.strftime('%Y-%m-%d')
            washer_preds = predict_single_day(str(hall), 'washers', target_date_str)
            dryer_preds = predict_single_day(str(hall), 'dryers', target_date_str)
            return {'washers': washer_preds, 'dryers': dryer_preds}

        # Helper function to find best time for a specific day
        def find_best_time_for_day(target_date):
            day_of_week_index = (target_date.weekday() + 1) % 7  # Convert to Sunday=0
            day_of_week = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day_of_week_index]

            # Get predictions for this date
            predictions = get_predictions_for_date(target_date)

            # Determine time constraints for this specific day
            day_min_hour = 0
            day_max_hour = 23

            if day_time_constraints and day_of_week_index in day_time_constraints:
                day_min_hour = day_time_constraints[day_of_week_index]['start']
                day_max_hour = day_time_constraints[day_of_week_index]['end']

            # Filter predictions by time constraints
            washer_predictions = []
            for pred in predictions['washers']:
                pred_date = datetime.fromisoformat(pred['timestamp'].replace('Z', '+00:00'))
                pred_date_central = pred_date.astimezone(ZoneInfo('America/Chicago'))
                pred_hour = pred_date_central.hour
                if day_min_hour <= pred_hour <= day_max_hour:
                    washer_predictions.append(pred)

            dryer_predictions = []
            for pred in predictions['dryers']:
                pred_date = datetime.fromisoformat(pred['timestamp'].replace('Z', '+00:00'))
                pred_date_central = pred_date.astimezone(ZoneInfo('America/Chicago'))
                pred_hour = pred_date_central.hour
                if day_min_hour <= pred_hour <= day_max_hour:
                    dryer_predictions.append(pred)

            # Create combined score map
            score_map = {}

            for pred in washer_predictions:
                if pred['timestamp'] not in score_map:
                    score_map[pred['timestamp']] = {'washers': 0, 'dryers': 0, 'combined': 0}
                score_map[pred['timestamp']]['washers'] = pred['value']

            for pred in dryer_predictions:
                if pred['timestamp'] not in score_map:
                    score_map[pred['timestamp']] = {'washers': 0, 'dryers': 0, 'combined': 0}
                score_map[pred['timestamp']]['dryers'] = pred['value']

            # Calculate combined scores based on algorithm preference
            for timestamp, scores in score_map.items():
                if algorithm_preference == 'washers':
                    scores['combined'] = scores['washers'] * 0.7 + scores['dryers'] * 0.3
                elif algorithm_preference == 'dryers':
                    scores['combined'] = scores['washers'] * 0.3 + scores['dryers'] * 0.7
                else:  # balanced
                    scores['combined'] = (scores['washers'] + scores['dryers']) / 2

            if not score_map:
                return {
                    'date': target_date.strftime('%Y-%m-%d'),
                    'dayOfWeek': day_of_week,
                    'bestTime': None,
                    'bestTimeFormatted': 'No availability',
                    'washersAvailable': 0,
                    'dryersAvailable': 0,
                    'combinedScore': 0,
                    'alternativeTimes': []
                }

            # Sort times by combined score
            sorted_times = sorted(score_map.items(), key=lambda x: x[1]['combined'], reverse=True)

            # Get best time
            best_timestamp, best_scores = sorted_times[0]
            best_date = datetime.fromisoformat(best_timestamp.replace('Z', '+00:00'))
            best_date_central = best_date.astimezone(ZoneInfo('America/Chicago'))

            best_time = f"{best_date_central.hour:02d}:{best_date_central.minute:02d}"

            def format_time_12h(hour, minute):
                period = 'PM' if hour >= 12 else 'AM'
                hour_12 = hour % 12 or 12
                return f"{hour_12}:{minute:02d} {period}"

            best_time_formatted = format_time_12h(best_date_central.hour, best_date_central.minute)

            # Get alternative times (top 3 after best)
            alternative_times = []
            for timestamp, scores in sorted_times[1:4]:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                dt_central = dt.astimezone(ZoneInfo('America/Chicago'))
                alternative_times.append(format_time_12h(dt_central.hour, dt_central.minute))

            # Store all sorted times for swapping functionality
            all_sorted_times = []
            for timestamp, scores in sorted_times:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                dt_central = dt.astimezone(ZoneInfo('America/Chicago'))
                all_sorted_times.append({
                    'time': f"{dt_central.hour:02d}:{dt_central.minute:02d}",
                    'formatted': format_time_12h(dt_central.hour, dt_central.minute),
                    'washers': round(scores['washers']),
                    'dryers': round(scores['dryers']),
                    'score': round(scores['combined'] * 10) / 10
                })

            return {
                'date': target_date.strftime('%Y-%m-%d'),
                'dayOfWeek': day_of_week,
                'bestTime': best_time,
                'bestTimeFormatted': best_time_formatted,
                'washersAvailable': round(best_scores['washers']),
                'dryersAvailable': round(best_scores['dryers']),
                'combinedScore': round(best_scores['combined'] * 10) / 10,
                'alternativeTimes': alternative_times,
                'allSortedTimes': all_sorted_times
            }

        # Generate schedule for all laundry days
        schedule = []
        for day in laundry_days:
            schedule.append(find_best_time_for_day(day))

        # Calculate summary stats
        valid_schedules = [s for s in schedule if s['bestTime'] is not None]
        average_availability = 0
        if valid_schedules:
            average_availability = sum(s['combinedScore'] for s in valid_schedules) / len(valid_schedules)

        summary = {
            'totalDays': len(laundry_days),
            'validDays': len(valid_schedules),
            'averageAvailability': round(average_availability * 10) / 10,
            'constraintsApplied': day_time_constraints is not None,
            'perDayConstraints': day_time_constraints is not None
        }

        return jsonify({
            'schedule': schedule,
            'summary': summary
        })

    except Exception as e:
        print(f'Schedule error: {e}')
        traceback.print_exc()
        return jsonify({'error': 'Server error'}), 500
