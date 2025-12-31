# CineTrack

A FastAPI movie discovery app with local search, likes/comments, and ML-based recommendations.

## Features
- Login and signup with JWT cookies
- Browse movies by category
- Search by title (local CSV + DB)
- Like and comment on movies
- Similar-movie recommendations from precomputed PKLs

## Requirements
- Python 3.10+
- `pip install -r requirements.txt`

## Run Locally
```bash
uvicorn app:app --reload
```

Then open:
- `http://localhost:8000/login`

## Recommender Model
The app uses PKL files in `model_data/`:
- `movies.pkl`
- `similarity.pkl`

To regenerate using `ml_model.py` (uses movies + credits datasets):
```bash
python3 ml_model.py
```

Datasets expected in project root:
- `tmdb_5000_movies.csv` (or `.zip`)
- `tmdb_5000_credits.csv` (or `.zip`)

## Project Structure
- `app.py` — FastAPI routes
- `movie_service.py` — core business logic
- `templates/` — HTML pages
- `styles/` — CSS styles
- `scripts/` — frontend JS
- `model_data/` — ML PKLs

