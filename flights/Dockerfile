FROM python:3.11-slim

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    && pip install --no-cache-dir requests \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all files
COPY . .

# Ensure script is executable (optional, but nice)
RUN chmod +x callflightapi.py

# Run the script
ENTRYPOINT ["python", "callflightapi.py"]
