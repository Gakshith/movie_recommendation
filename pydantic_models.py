from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class login_pydantic(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=8)

class register_pydantic(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=8)
    email: EmailStr

class MovieComment(BaseModel):
    movie_id: int
    text: str = Field(min_length=1, max_length=500)

class MovieLike(BaseModel):
    movie_id: int

class MovieView(BaseModel):
    movie_id: int

class MovieSearch(BaseModel):
    query: str = Field(min_length=1)
