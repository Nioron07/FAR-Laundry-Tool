# Start from a slim Python 3.12 base image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=True
ENV APP_HOME=/app
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies including git and git-lfs
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    git \
    git-lfs \
    && git lfs install \
    && rm -rf /var/lib/apt/lists/*

# Create and switch to the application directory
WORKDIR $APP_HOME

# Copy requirements first (better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (including .git for LFS)
COPY . ./

# Pull LFS files if .git exists
RUN if [ -d .git ]; then git lfs pull; fi

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app $APP_HOME
USER app

# Expose 8080 (the standard Cloud Run port)
EXPOSE 8080

# Run the web service on container startup using gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
