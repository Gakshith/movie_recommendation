"""
Movie service layer for handling movie-related business logic and ML data tracking
"""
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import uuid

import pandas as pd
import ast
import pickle

DB_PATH = Path("database.json")
CSV_PATH = Path("tmdb_5000_movies.csv")
MODEL_DIR = Path("model_data")
MOVIES_PKL = MODEL_DIR / "movies.pkl"
SIMILARITY_PKL = MODEL_DIR / "similarity.pkl"

# Global cache for CSV movies
_CSV_MOVIES_CACHE = []
_RECOMMENDER_MOVIES = None
_RECOMMENDER_SIMILARITY = None

def load_csv_movies() -> List[dict]:
    """Load and parse movies from CSV"""
    global _CSV_MOVIES_CACHE
    if _CSV_MOVIES_CACHE:
        return _CSV_MOVIES_CACHE
        
    if not CSV_PATH.exists():
        print(f"Error: {CSV_PATH} not found")
        return []

    try:
        df = pd.read_csv(CSV_PATH)
        movies = []
        
        for _, row in df.iterrows():
            try:
                # Parse genres from JSON string
                genres = [g['name'] for g in ast.literal_eval(row['genres'])]
                
                movie = {
                    "id": int(row['id']),
                    "tmdb_id": int(row['id']), # Compatibility
                    "title": row['title'],
                    "overview": row['overview'] if pd.notna(row['overview']) else "No overview available.",
                    "poster_path": f"https://placehold.co/500x750/1a1a2e/FFF?text={row['title'].replace(' ', '+')}",
                    "backdrop_path": f"https://placehold.co/1920x1080/1a1a2e/FFF?text={row['title'].replace(' ', '+')}",
                    "release_date": row['release_date'] if pd.notna(row['release_date']) else "",
                    "vote_average": float(row['vote_average']),
                    "popularity": float(row['popularity']),
                    "genres": genres[:3],
                    "runtime": int(row['runtime']) if pd.notna(row['runtime']) else 0,
                    "like_count": 0,
                    "is_tmdb": True # Treat as "remote" source for compatibility
                }
                movies.append(movie)
            except Exception as e:
                print(f"Skipping movie {row.get('title', 'Unknown')}: {e}")
                continue
                
        _CSV_MOVIES_CACHE = movies
        print(f"Loaded {len(movies)} movies from CSV")
        
        return movies
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return []

def get_movies_by_category(category: str, limit: int = 20, offset: int = 0) -> dict:
    """Get movies sorted by category"""
    movies = load_csv_movies()
    
    if category == "top_rated":
        # Sort by vote_average
        sorted_movies = sorted(movies, key=lambda x: x["vote_average"], reverse=True)
    elif category == "upcoming":
        # Sort by release_date (descending for now as 'upcoming' implies future/recent)
        # Note: Dataset is old, so 'upcoming' is relative or just 'newest'
        sorted_movies = sorted(movies, key=lambda x: x["release_date"] or "", reverse=True)
    else: # popular
        sorted_movies = sorted(movies, key=lambda x: x["popularity"], reverse=True)
        
    total = len(sorted_movies)
    paginated = sorted_movies[offset : offset + limit]
    
    return {
        "results": paginated,
        "total_results": total
    }


def read_db() -> dict:
    """Read database file"""
    if not DB_PATH.exists():
        return {"users": [], "movies": [], "comments": []}
    with open(DB_PATH, "r") as f:
        return json.load(f)


def write_db(data: dict):
    """Write to database file"""
    with open(DB_PATH, "w") as f:
        json.dump(data, f, indent=2)


def get_all_movies(limit: Optional[int] = None, offset: int = 0) -> List[dict]:
    """Get all movies from CSV (default sort by popularity)"""
    # Use load_csv_movies instead of local DB for the main feed
    movies = load_csv_movies()
    # Sort by popularity by default
    movies.sort(key=lambda x: x['popularity'], reverse=True)
    
    if limit:
        return movies[offset:offset + limit]
    return movies[offset:]


def get_movie_by_id(movie_id: int) -> Optional[dict]:
    """Get a specific movie by ID (check CSV first, then local DB)"""
    # Check CSV
    csv_movies = load_csv_movies()
    for movie in csv_movies:
        if movie["id"] == movie_id:
            return movie
            
    # Check local DB (legacy/user added)
    db = read_db()
    for movie in db.get("movies", []):
        if movie["id"] == movie_id:
            return movie
    return None


def search_movies(query: str) -> List[dict]:
    """Search movies in CSV and local DB (Title only)"""
    query_lower = query.lower().strip()
    if not query_lower:
        return []
        
    results = []

    # Search local DB first (user-added movies)
    db = read_db()
    db_matches = []
    for movie in db.get("movies", []):
        title = str(movie.get("title", "")).strip()
        if title.lower().startswith(query_lower):
            db_matches.append(movie)

    db_matches.sort(
        key=lambda m: (
            str(m.get("title", "")).lower() != query_lower,
            len(str(m.get("title", "")))
        )
    )
    
    # Search CSV using Pandas
    # Ensure movies are loaded
    if not _CSV_MOVIES_CACHE:
        load_csv_movies()

    # Re-read CSV into DataFrame if needed, or better, we should cache the DataFrame.
    # For now, let's load it if not available, but 'load_csv_movies' returns a list of dicts.
    # We should really optimize this, but let's follow the user's request to "create pandas".
    
    # Efficiently, we should have the DF cached. 
    # Let's read the CSV just for this search as the user requested "create pandas for csv so you can search".
    # Note: efficient apps would cache the DF. 
    
    try:
        df = pd.read_csv(CSV_PATH)
        
        # Filter: starts with query (case insensitive)
        # Using na=False to handle potential NaNs
        mask = df['title'].str.lower().str.startswith(query_lower, na=False)
        matched_df = df[mask]
        
        # Sort by exact match then length
        # Create a temp column for length
        matched_df = matched_df.copy()
        matched_df['title_len'] = matched_df['title'].str.len()
        matched_df['exact_match'] = matched_df['title'].str.lower() == query_lower
        
        # Sort: exact match (True > False), then length (asc)
        matched_df = matched_df.sort_values(by=['exact_match', 'title_len'], ascending=[False, True])
        
        # Convert to list of dicts (format matching load_csv_movies output)
        results = []
        for _, row in matched_df.head(50).iterrows():
            try:
                # Re-use logic to parse row to dict similar to load_csv_movies
                genres = [g['name'] for g in ast.literal_eval(row['genres'])]
                movie = {
                    "id": int(row['id']),
                    "tmdb_id": int(row['id']),
                    "title": row['title'],
                    "overview": row['overview'] if pd.notna(row['overview']) else "No overview available.",
                    "poster_path": f"https://placehold.co/500x750/1a1a2e/FFF?text={row['title'].replace(' ', '+')}",
                    "backdrop_path": f"https://placehold.co/1920x1080/1a1a2e/FFF?text={row['title'].replace(' ', '+')}",
                    "release_date": row['release_date'] if pd.notna(row['release_date']) else "",
                    "vote_average": float(row['vote_average']),
                    "popularity": float(row['popularity']),
                    "genres": genres[:3],
                    "runtime": int(row['runtime']) if pd.notna(row['runtime']) else 0,
                    "like_count": 0,
                    "is_tmdb": True
                }
                results.append(movie)
            except Exception:
                continue

        # Merge DB matches first, then CSV results (dedupe by id)
        merged = []
        seen_ids = set()
        for movie in db_matches + results:
            movie_id = movie.get("id")
            if movie_id in seen_ids:
                continue
            merged.append(movie)
            seen_ids.add(movie_id)
        return merged

    except Exception as e:
        print(f"Pandas search error: {e}")
        return db_matches


def like_movie(username: str, movie_id: int) -> dict:
    """Like a movie and track for ML"""
    db = read_db()
    
    # Find user
    user = None
    for u in db["users"]:
        if u["username"] == username:
            user = u
            break
    
    if not user:
        return {"success": False, "message": "User not found"}
    
    # Find movie in DB, or seed from CSV if needed
    movie = None
    for m in db.get("movies", []):
        if m["id"] == movie_id:
            movie = m
            break

    if not movie:
        csv_movie = get_movie_by_id(movie_id)
        if not csv_movie:
            return {"success": False, "message": "Movie not found"}
        movie = dict(csv_movie)
        movie.setdefault("like_count", 0)
        db.setdefault("movies", []).append(movie)
    
    # Toggle like
    if "liked_movies" not in user:
        user["liked_movies"] = []
    
    if movie_id in user["liked_movies"]:
        # Unlike
        user["liked_movies"].remove(movie_id)
        movie["like_count"] = max(0, movie["like_count"] - 1)
        action = "unliked"
    else:
        # Like
        user["liked_movies"].append(movie_id)
        movie["like_count"] += 1
        action = "liked"
    
    write_db(db)
    return {
        "success": True,
        "action": action,
        "like_count": movie["like_count"],
        "is_liked": movie_id in user["liked_movies"]
    }


def add_comment(username: str, movie_id: int, text: str) -> dict:
    """Add a comment to a movie"""
    db = read_db()
    
    # Verify movie exists
    movie_exists = any(m["id"] == movie_id for m in db.get("movies", []))
    if not movie_exists:
        movie_exists = get_movie_by_id(movie_id) is not None
    if not movie_exists:
        return {"success": False, "message": "Movie not found"}
    
    # Create comment
    comment = {
        "id": str(uuid.uuid4()),
        "movie_id": movie_id,
        "username": username,
        "text": text,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if "comments" not in db:
        db["comments"] = []
    
    db["comments"].append(comment)
    write_db(db)
    
    return {"success": True, "comment": comment}


def get_movie_comments(movie_id: int) -> List[dict]:
    """Get all comments for a movie"""
    db = read_db()
    comments = [c for c in db.get("comments", []) if c["movie_id"] == movie_id]
    # Sort by timestamp, newest first
    comments.sort(key=lambda x: x["timestamp"], reverse=True)
    return comments


def track_movie_view(username: str, movie_id: int):
    """Track when a user views a movie (for ML)"""
    db = read_db()
    
    # Find user
    for user in db["users"]:
        if user["username"] == username:
            if "viewed_movies" not in user:
                user["viewed_movies"] = []
            
            # Add view with timestamp
            view_entry = {
                "movie_id": movie_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            user["viewed_movies"].append(view_entry)
            
            # Keep only last 100 views per user to prevent database bloat
            if len(user["viewed_movies"]) > 100:
                user["viewed_movies"] = user["viewed_movies"][-100:]
            
            write_db(db)
            return True
    
    return False


def track_search(username: str, query: str):
    """Track user search queries (for ML)"""
    db = read_db()
    
    # Find user
    for user in db["users"]:
        if user["username"] == username:
            if "search_history" not in user:
                user["search_history"] = []
            
            # Add search with timestamp
            search_entry = {
                "query": query,
                "timestamp": datetime.utcnow().isoformat()
            }
            user["search_history"].append(search_entry)
            
            # Keep only last 50 searches per user
            if len(user["search_history"]) > 50:
                user["search_history"] = user["search_history"][-50:]
            
            write_db(db)
            return True
    
    return False


def get_user_liked_movies(username: str) -> List[dict]:
    """Get all movies liked by a user"""
    db = read_db()
    
    # Find user
    user = None
    for u in db["users"]:
        if u["username"] == username:
            user = u
            break
    
    if not user or "liked_movies" not in user:
        return []
    
    # Get full movie objects
    liked_movie_ids = user["liked_movies"]
    movies = [m for m in db.get("movies", []) if m["id"] in liked_movie_ids]
    
    return movies


def get_user_stats(username: str) -> dict:
    """Get user statistics for ML insights"""
    db = read_db()
    
    # Find user
    user = None
    for u in db["users"]:
        if u["username"] == username:
            user = u
            break
    
    if not user:
        return {}
    
    # Calculate stats
    liked_count = len(user.get("liked_movies", []))
    viewed_count = len(user.get("viewed_movies", []))
    search_count = len(user.get("search_history", []))
    
    # Get genre preferences from liked movies
    genre_counts = {}
    liked_movie_ids = user.get("liked_movies", [])
    for movie in db.get("movies", []):
        if movie["id"] in liked_movie_ids:
            for genre in movie["genres"]:
                genre_counts[genre] = genre_counts.get(genre, 0) + 1
    
    favorite_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    
    return {
        "liked_count": liked_count,
        "viewed_count": viewed_count,
        "search_count": search_count,
        "favorite_genres": [g[0] for g in favorite_genres]
    }


def get_similar_movies(movie_title: str) -> List[dict]:
    """Get similar movies using precomputed similarity PKLs"""
    global _CSV_MOVIES_CACHE, _RECOMMENDER_MOVIES, _RECOMMENDER_SIMILARITY

    # Ensure catalog loaded
    if not _CSV_MOVIES_CACHE:
        load_csv_movies()

    if _RECOMMENDER_MOVIES is None or _RECOMMENDER_SIMILARITY is None:
        if not MOVIES_PKL.exists() or not SIMILARITY_PKL.exists():
            print("Recommender PKL files not found. Run scripts/build_recommender.py")
            return []
        try:
            with open(MOVIES_PKL, "rb") as f:
                _RECOMMENDER_MOVIES = pickle.load(f)
            with open(SIMILARITY_PKL, "rb") as f:
                _RECOMMENDER_SIMILARITY = pickle.load(f)
        except Exception as e:
            print(f"Failed to load recommender PKLs: {e}")
            return []

    try:
        titles = _RECOMMENDER_MOVIES["title"].astype(str)
        lower_titles = titles.str.lower()
        query = movie_title.lower().strip()

        matches = lower_titles == query
        if matches.any():
            idx = matches.idxmax()
        else:
            starts = lower_titles.str.startswith(query)
            if not starts.any():
                return []
            idx = starts.idxmax()

        sims = _RECOMMENDER_SIMILARITY[idx]
        similar_idx = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)
        similar_idx = [i for i in similar_idx if i != idx][:10]

        movie_map = {m["id"]: m for m in _CSV_MOVIES_CACHE}
        recommendations = []
        for i in similar_idx:
            movie_id = _RECOMMENDER_MOVIES.iloc[i].get("id")
            movie = movie_map.get(int(movie_id)) if movie_id is not None else None
            if movie:
                recommendations.append(movie)
            else:
                recommendations.append({
                    "id": int(movie_id) if movie_id is not None else i,
                    "title": _RECOMMENDER_MOVIES.iloc[i]["title"],
                    "overview": "No overview available.",
                    "poster_path": "https://placehold.co/500x750/1a1a2e/FFF?text=No+Image",
                    "backdrop_path": "https://placehold.co/1920x1080/1a1a2e/FFF?text=No+Image",
                    "release_date": "",
                    "vote_average": 0.0,
                    "genres": [],
                    "runtime": 0,
                    "like_count": 0,
                    "is_tmdb": True
                })

        return recommendations
    except Exception as e:
        print(f"Recommender error: {e}")
        return []
