# Use Python 3.12 explicitly — spacy's blis/thinc Cython extensions
# fail to compile on Python 3.14 (Render's current default)
FROM python:3.12-slim

WORKDIR /app

# Install C/C++ compilers needed for some package extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cached layer — only re-runs if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the small spacy model (12MB vs 700MB for lg)
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY . .

# Ensure required directories exist
RUN mkdir -p chroma_data temp_uploads

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
