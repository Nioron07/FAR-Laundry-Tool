# Start from a slim Python 3.14 base image
FROM python:3.14-slim

# Set environment variables
ENV PYTHONUNBUFFERED=True
ENV APP_HOME=/app
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create and switch to the application directory
WORKDIR $APP_HOME

# Copy requirements first (better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . ./

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app $APP_HOME
USER app

# Expose 8080 (the standard Cloud Run port)
EXPOSE 8080

# Run the web service on container startup using gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
