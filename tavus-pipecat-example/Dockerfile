FROM python:3.13-slim

WORKDIR /app/tavus-pipecat-example

# Install dependencies first for better layer caching
COPY tavus-pipecat-example/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    python -c "import nltk; nltk.download('punkt_tab')"

# Copy application code
COPY tavus-pipecat-example/tavus-pipecat.py .

# Copy shared prompts (tavus-pipecat.py reads from ../prompts/)
COPY prompts/ /app/prompts/

# Run as non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 7860

CMD ["python", "tavus-pipecat.py", "--transport", "daily", "--host", "0.0.0.0", "--port", "7860"]
