import ast
import pickle
import re
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "model_data"
MOVIES_PKL = MODEL_DIR / "movies.pkl"
SIMILARITY_PKL = MODEL_DIR / "similarity.pkl"


def load_csv(path: Path) -> pd.DataFrame:
    if path.suffix == ".zip":
        return pd.read_csv(path)
    return pd.read_csv(path)


def find_dataset(name: str) -> Path:
    candidates = [
        BASE_DIR / f"{name}.csv",
        BASE_DIR / f"{name}.csv.zip",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"Missing dataset: {name}.csv or {name}.csv.zip")


def preprocess_list(value: str) -> str:
    names = []
    value = ast.literal_eval(value)
    for item in value:
        names.append(item.get("name", ""))
    return " ".join([n for n in names if n])


def preprocess_cast(value: str) -> str:
    names = []
    value = ast.literal_eval(value)
    for item in value:
        names.append(item.get("name", ""))
        names.append(item.get("character", ""))
    return " ".join([n for n in names if n])


def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\\s]", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text


def build_recommender() -> None:
    movies_path = find_dataset("tmdb_5000_movies")
    movies = load_csv(movies_path)

    movies["genres"] = movies["genres"].apply(preprocess_list)
    movies["keywords"] = movies["keywords"].apply(preprocess_list)
    movies["production_companies"] = movies["production_companies"].apply(preprocess_list)
    movies["production_countries"] = movies["production_countries"].apply(preprocess_list)

    movies["overview"] = movies["overview"].fillna("")
    movies["information"] = (
        movies["genres"]
        + " "
        + movies["keywords"]
        + " "
        + movies["overview"]
        + " "
        + movies["production_companies"]
        + " "
        + movies["production_countries"]
    )
    movies["information"] = movies["information"].apply(clean_text)

    tfidf = TfidfVectorizer(stop_words="english", max_features=5000)
    matrix = tfidf.fit_transform(movies["information"])
    similarity = cosine_similarity(matrix)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    movies_out = movies[["id", "title"]].copy()

    with open(MOVIES_PKL, "wb") as f:
        pickle.dump(movies_out, f)
    with open(SIMILARITY_PKL, "wb") as f:
        pickle.dump(similarity, f)

    print(f"Saved {len(movies_out)} movies to {MOVIES_PKL}")
    print(f"Saved similarity matrix {similarity.shape} to {SIMILARITY_PKL}")


if __name__ == "__main__":
    build_recommender()
