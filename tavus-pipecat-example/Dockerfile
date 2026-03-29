FROM python:3.13-slim

WORKDIR /app/tavus-pipecat-example

# Install dependencies first for better layer caching
COPY tavus-pipecat-example/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY tavus-pipecat-example/tavus-pipecat.py .

# Copy shared prompts (tavus-pipecat.py reads from ../prompts/)
COPY prompts/ /app/prompts/

EXPOSE 7860

CMD ["python", "tavus-pipecat.py", "--transport", "webrtc", "--host", "0.0.0.0", "--port", "7860"]
