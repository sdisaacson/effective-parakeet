FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (including psycopg with binary backend)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "psycopg[binary]" && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directory structure if it doesn't exist
RUN mkdir -p static/css static/js templates

# Copy static files and templates
COPY static/css/styles.css static/css/
COPY static/js/script.js static/js/
COPY templates/index.html templates/

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]