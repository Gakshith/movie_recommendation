from fastapi import FastAPI, Depends, HTTPException, Response, Query
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic_models import login_pydantic, register_pydantic, MovieComment, MovieSearch
from auth import hash_password, verify_password, create_access_token
from middleware import auth_middleware
import movie_service
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
# Trigger reload (auth update)

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()

app.mount("/styles", StaticFiles(directory=BASE_DIR / "styles"), name="styles")
app.mount("/scripts", StaticFiles(directory=BASE_DIR / "scripts"), name="scripts")


@app.get("/")
def home():
    return RedirectResponse(url="/login")


@app.get("/login")
def login_page():
    return FileResponse(BASE_DIR / "templates" / "login.html", media_type="text/html")


@app.post("/login/details")
def login_details(details: login_pydantic, response: Response):
    db = movie_service.read_db()
    user_details = None
    
    for user in db["users"]:
        if user["username"] == details.username:
            user_details = user
            break

    if not user_details:
        raise HTTPException(status_code=400, detail="User not found")
    
    if not verify_password(details.password, user_details["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")
    
    access_token = create_access_token(data={"sub": details.username, "email": user_details["email"]})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=1800,  
        samesite="lax"
    )
    
    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "username": details.username,
        "redirect": "/movies"
    }


@app.get("/register")
def register():
    return FileResponse(BASE_DIR / "templates" / "register.html", media_type="text/html")


@app.post("/register/details")
async def register_details(details: register_pydantic):
    db = movie_service.read_db()
    for user in db["users"]:
        if user["username"] == details.username:
            raise HTTPException(status_code=400, detail="Username already exists")
        if user["email"] == details.email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = hash_password(details.password)
    
    db["users"].append({
        "username": details.username,
        "email": details.email,
        "password": hashed_password,
        "liked_movies": [],
        "viewed_movies": [],
        "search_history": []
    })
    movie_service.write_db(db)

    return {"message": "Registration successful", "username": details.username}


@app.get("/movies")
def movies_page(token_data: dict = Depends(auth_middleware)):
    """Main movie browsing page"""
    return FileResponse(BASE_DIR / "templates" / "movies.html", media_type="text/html")


@app.get("/movie/{movie_id}")
def movie_detail_page(movie_id: int, token_data: dict = Depends(auth_middleware)):
    """Movie detail page"""
    return FileResponse(BASE_DIR / "templates" / "movie-detail.html", media_type="text/html")


@app.get("/api/movies")
async def get_movies(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str = Query("popular", regex="^(popular|top_rated|upcoming)$"),
    token_data: dict = Depends(auth_middleware)
):
    """Get paginated list of movies (from local CSV)"""
    
    # Get movies based on category from CSV service
    data = movie_service.get_movies_by_category(category, limit, offset)
    movies = data["results"]
    total = data["total_results"]
    
    # Add user's liked status to each movie
    username = token_data.get("sub")
    db = movie_service.read_db()
    user = next((u for u in db["users"] if u["username"] == username), None)
    liked_movie_ids = user.get("liked_movies", []) if user else []
    
    for movie in movies:
        movie["is_liked"] = movie["id"] in liked_movie_ids
    
    return {"movies": movies, "total": total}


@app.get("/api/movies/{movie_id}")
async def get_movie(movie_id: int, token_data: dict = Depends(auth_middleware)):
    """Get specific movie details"""
    movie = movie_service.get_movie_by_id(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Track view for ML
    username = token_data.get("sub")
    movie_service.track_movie_view(username, movie_id)
    
    # Add user's liked status
    db = movie_service.read_db()
    user = next((u for u in db["users"] if u["username"] == username), None)
    liked_movie_ids = user.get("liked_movies", []) if user else []
    movie["is_liked"] = movie_id in liked_movie_ids
    
    return movie


@app.post("/api/movies/{movie_id}/like")
async def toggle_like(movie_id: int, token_data: dict = Depends(auth_middleware)):
    """Like or unlike a movie"""
    username = token_data.get("sub")
    result = movie_service.like_movie(username, movie_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@app.get("/api/movies/{movie_id}/comments")
async def get_comments(movie_id: int, token_data: dict = Depends(auth_middleware)):
    """Get all comments for a movie"""
    comments = movie_service.get_movie_comments(movie_id)
    return {"comments": comments}


@app.post("/api/movies/{movie_id}/comments")
async def add_comment(
    movie_id: int,
    comment: MovieComment,
    token_data: dict = Depends(auth_middleware)
):
    """Add a comment to a movie"""
    username = token_data.get("sub")
    result = movie_service.add_comment(username, movie_id, comment.text)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@app.post("/api/movies/search")
async def search_movies(
    search_data: MovieSearch,
    token_data: dict = Depends(auth_middleware)
):
    """Search movies by title (local CSV)"""
    q = search_data.query
    """Search movies by title, overview, or genre (local CSV)"""
    username = token_data.get("sub")

    movie_service.track_search(username, q)
    all_results = movie_service.search_movies(q)
    recommendations = movie_service.get_similar_movies(q)
    db = movie_service.read_db()
    user = next((u for u in db["users"] if u["username"] == username), None)
    liked_movie_ids = user.get("liked_movies", []) if user else []
    
    for movie in all_results:
        movie["is_liked"] = movie.get("id") in liked_movie_ids
        
    for movie in recommendations:
        movie["is_liked"] = movie.get("id") in liked_movie_ids
    
    return {
        "movies": all_results, 
        "recommendations": recommendations,
        "query": q, 
        "tmdb_enabled": False
    }








@app.get("/api/user")
async def get_user(token_data: dict = Depends(auth_middleware)):
    """Get current user information"""
    username = token_data.get("sub")
    stats = movie_service.get_user_stats(username)
    
    return {
        "username": username,
        "email": token_data.get("email"),
        "stats": stats
    }


@app.get("/api/user/liked-movies")
async def get_user_liked_movies(token_data: dict = Depends(auth_middleware)):
    """Get user's liked movies"""
    username = token_data.get("sub")
    movies = movie_service.get_user_liked_movies(username)
    return {"movies": movies}


@app.post("/logout")
async def logout(response: Response, token_data: dict = Depends(auth_middleware)):
    """Logout user"""
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}
