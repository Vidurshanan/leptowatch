# API + dashboard in one image:  docker build -t leptowatch . && docker run -p 8501:8501 -p 8000:8000 leptowatch
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN pip install --no-cache-dir -e .
ENV LW_DATA_ROOT=/app/data
EXPOSE 8000 8501
CMD ["sh", "-c", "uvicorn leptowatch.api.app:app --host 0.0.0.0 --port 8000 & streamlit run dashboard/app.py --server.port 8501 --server.address 0.0.0.0"]
