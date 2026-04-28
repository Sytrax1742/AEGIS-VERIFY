FROM python:3.11

WORKDIR /app

# Forces Python to print errors instantly instead of hiding them
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Use shell form so the PORT environment variable is evaluated dynamically
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}