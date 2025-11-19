"""Download model files from Google Cloud Storage on startup"""
import os
from pathlib import Path
from google.cloud import storage


def download_models_from_gcs():
    """
    Download model files from GCS bucket if they don't exist locally.
    Set environment variable GCS_BUCKET_NAME to your bucket name.
    """
    bucket_name = os.environ.get('GCS_BUCKET_NAME')

    if not bucket_name:
        print('[Models] GCS_BUCKET_NAME not set, skipping model download')
        return

    models_dir = Path(__file__).parent.parent / 'models'
    models_dir.mkdir(exist_ok=True)

    model_files = ['washers_model.pkl', 'dryers_model.pkl']

    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)

        for model_file in model_files:
            local_path = models_dir / model_file

            # Skip if file already exists
            if local_path.exists():
                print(f'[Models] {model_file} already exists locally, skipping download')
                continue

            print(f'[Models] Downloading {model_file} from GCS bucket {bucket_name}...')
            blob = bucket.blob(f'models/{model_file}')
            blob.download_to_filename(str(local_path))
            print(f'[Models] Successfully downloaded {model_file} ({local_path.stat().st_size / 1024 / 1024:.1f} MB)')

    except Exception as e:
        print(f'[Models] Error downloading models from GCS: {e}')
        raise
