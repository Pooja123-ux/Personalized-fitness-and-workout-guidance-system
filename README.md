# Personalized Fitness and AI Workout Guidance System

A web application that provides personalized fitness guidance, workout assistance, progress tracking, meal planning, and AI-powered fitness support.

## Overview

This project is organized into separate backend and frontend folders.

* **Frontend:** React, TypeScript, Vite, Axios, Chart.js
* **Backend:** Python, FastAPI, SQLAlchemy, Pydantic
* **Database:** MySQL
* **Authentication:** JWT
* **AI/ML:** MediaPipe, TensorFlow/OpenCV, and Gemini API

## Project Structure

```text
fit/
├── .gitignore
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   └── ...
│   └── ...
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   └── ...

```

## Requirements

Before running the project, install:

* Python 3.10+
* Node.js 18+
* npm
* MySQL
* Git

## Environment Setup

Create a local environment file for the backend.

### Windows

```powershell
copy backend\.env.example backend\.env
```

### macOS/Linux

```bash
cp backend/.env.example backend/.env
```

Update `backend/.env` with your local configuration, including database and API credentials.

**Do not commit `.env` files or expose API keys and passwords.**

## Backend Setup

From the project root:

```powershell
cd backend
python -m venv .venv
```

Activate the virtual environment.

### Windows PowerShell

```powershell
.\.venv\Scripts\Activate.ps1
```

### macOS/Linux

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI backend:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

## Frontend Setup

Open a new terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

## Application Architecture

```text
React + TypeScript + Vite
            │
            │ REST API / Axios
            ▼
      FastAPI Backend
            │
      ┌─────┴─────┐
      ▼           ▼
    MySQL      AI Services
                 │
          Gemini API / ML
```

## Important Notes

* Use `.env.example` as the template for required environment variables.
* Make sure MySQL is running before starting the backend.
* Make sure the backend is running before using frontend features that require API access.

## Useful Commands

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Build Frontend

```powershell
cd frontend
npm run build
```

## API Documentation

When the backend is running, FastAPI provides interactive API documentation at:

```text
http://localhost:8000/docs
```
