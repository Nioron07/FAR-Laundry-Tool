"""Vertex AI endpoint prediction client"""
import os
from google.cloud import aiplatform

# Vertex AI endpoint IDs
ENDPOINT_IDS = {
    'washers': os.environ.get('VERTEX_WASHER_ENDPOINT', '7528504549452021760'),
    'dryers': os.environ.get('VERTEX_DRYER_ENDPOINT', '7462076454948306944'),
}

PROJECT = os.environ.get('VERTEX_PROJECT', 'far-laundry-backend')
LOCATION = os.environ.get('VERTEX_LOCATION', 'us-central1')

# Cache endpoint objects to avoid re-initializing
_endpoint_cache = {}


def _get_endpoint(target_type):
    """Get or create a cached Vertex AI endpoint client"""
    if target_type not in _endpoint_cache:
        aiplatform.init(project=PROJECT, location=LOCATION)
        endpoint_id = ENDPOINT_IDS[target_type]
        _endpoint_cache[target_type] = aiplatform.Endpoint(endpoint_id)
        print(f'[Vertex] Initialized {target_type} endpoint: {endpoint_id}')
    return _endpoint_cache[target_type]


def vertex_batch_predict(target_type, features_list):
    """Send a batch of feature rows to a Vertex AI endpoint.

    Args:
        target_type: 'washers' or 'dryers'
        features_list: list of dicts with keys: hall, month, weekday, hour, minute, year, day

    Returns:
        list of predicted values (floats)
    """
    endpoint = _get_endpoint(target_type)

    # Vertex AI expects instances as lists of feature values (matching training order)
    instances = [
        [f['hall'], f['month'], f['weekday'], f['hour'], f['minute'], f['year'], f['day']]
        for f in features_list
    ]

    response = endpoint.predict(instances=instances)
    return response.predictions
