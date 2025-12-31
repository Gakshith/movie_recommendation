from datetime import datetime
from pathlib import Path
import pickle

import numpy as np
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator


BASE_DIR = Path(__file__).resolve().parents[1]
MOVIES_PKL = BASE_DIR / "model_data" / "movies.pkl"
SIMILARITY_PKL = BASE_DIR / "model_data" / "similarity.pkl"


def evaluate_similarity() -> None:
    with open(MOVIES_PKL, "rb") as f:
        movies = pickle.load(f)
    with open(SIMILARITY_PKL, "rb") as f:
        similarity = pickle.load(f)

    if not hasattr(similarity, "shape"):
        raise ValueError("Similarity matrix is not a numpy array.")

    n_items = similarity.shape[0]
    top_k = min(10, n_items - 1)
    top_k_scores = []

    for i in range(n_items):
        row = similarity[i]
        if row.shape[0] != n_items:
            raise ValueError("Similarity matrix has invalid shape.")
        indices = np.argsort(row)[::-1]
        indices = [idx for idx in indices if idx != i][:top_k]
        if indices:
            top_k_scores.append(np.mean(row[indices]))

    avg_top_k = float(np.mean(top_k_scores)) if top_k_scores else 0.0
    print(f"Movies in model: {len(movies)}")
    print(f"Avg top-{top_k} cosine similarity: {avg_top_k:.4f}")


with DAG(
    dag_id="retrain_recommender_daily",
    start_date=datetime(2024, 1, 1),
    schedule_interval="@daily",
    catchup=False,
    tags=["recommender"],
) as dag:
    retrain = BashOperator(
        task_id="retrain_model",
        bash_command=f"python3 {BASE_DIR / 'ml_model.py'}",
    )

    evaluate = PythonOperator(
        task_id="evaluate_model",
        python_callable=evaluate_similarity,
    )

    retrain >> evaluate
