// Get movie ID from URL
const movieId = parseInt(window.location.pathname.split('/').pop());

// DOM Elements
const loadingState = document.getElementById('loadingState');
const mainContent = document.getElementById('mainContent');
const heroSection = document.getElementById('heroSection');
const moviePoster = document.getElementById('moviePoster');
const movieTitle = document.getElementById('movieTitle');
const movieMeta = document.getElementById('movieMeta');
const movieGenres = document.getElementById('movieGenres');
const movieOverview = document.getElementById('movieOverview');
const likeButton = document.getElementById('likeButton');
const likeButtonText = document.getElementById('likeButtonText');
const likeIcon = document.getElementById('likeIcon');
const commentInput = document.getElementById('commentInput');
const submitCommentBtn = document.getElementById('submitCommentBtn');
const commentsList = document.getElementById('commentsList');
const commentCount = document.getElementById('commentCount');
const logoutBtn = document.getElementById('logoutBtn');

// State
let currentMovie = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (isNaN(movieId)) {
        window.location.href = '/movies';
        return;
    }

    loadMovieDetails();
    setupEventListeners();
});

function setupEventListeners() {
    likeButton.addEventListener('click', toggleLike);
    submitCommentBtn.addEventListener('click', submitComment);
    logoutBtn.addEventListener('click', handleLogout);
}

// Load movie details
async function loadMovieDetails() {
    try {
        showLoading();

        // Fetch movie details
        const movieResponse = await fetch(`/api/movies/${movieId}`, {
            credentials: 'include'
        });

        if (!movieResponse.ok) {
            if (movieResponse.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to fetch movie');
        }

        currentMovie = await movieResponse.json();

        // Fetch comments
        const commentsResponse = await fetch(`/api/movies/${movieId}/comments`, {
            credentials: 'include'
        });

        const commentsData = await commentsResponse.json();

        renderMovie(currentMovie);
        renderComments(commentsData.comments);
        hideLoading();

    } catch (error) {
        console.error('Error loading movie:', error);
        alert('Failed to load movie details');
        window.location.href = '/movies';
    }
}

// Render movie
function renderMovie(movie) {
    // Set hero backdrop
    heroSection.style.backgroundImage = `url(${movie.backdrop_path})`;

    // Set poster
    moviePoster.src = movie.poster_path;
    moviePoster.alt = movie.title;
    moviePoster.onerror = function () {
        this.src = 'https://via.placeholder.com/300x450/1a1a2e/ffffff?text=No+Image';
    };

    // Set title
    movieTitle.textContent = movie.title;
    document.title = `${movie.title} - CineTrack`;

    // Set meta
    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
    movieMeta.innerHTML = `
    <div class="meta-item rating">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M9 0L11 6H18L12.5 10L14.5 16L9 12L3.5 16L5.5 10L0 6H7L9 0Z"/>
      </svg>
      ${movie.vote_average.toFixed(1)}
    </div>
    <div class="meta-item">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M9 5V9L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      ${movie.runtime} min
    </div>
    <div class="meta-item">${year}</div>
  `;

    // Set genres
    movieGenres.innerHTML = movie.genres
        .map(genre => `<span class="genre-tag">${genre}</span>`)
        .join('');

    // Set overview
    movieOverview.textContent = movie.overview;

    // Set like button
    updateLikeButton(movie.is_liked);
}

// Update like button
function updateLikeButton(isLiked) {
    if (isLiked) {
        likeButton.classList.add('liked');
        likeButtonText.textContent = 'Liked';
        likeIcon.querySelector('path').setAttribute('fill', 'currentColor');
    } else {
        likeButton.classList.remove('liked');
        likeButtonText.textContent = 'Like';
        likeIcon.querySelector('path').setAttribute('fill', 'none');
    }
}

// Toggle like
async function toggleLike() {
    try {
        const response = await fetch(`/api/movies/${movieId}/like`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to toggle like');

        const data = await response.json();
        updateLikeButton(data.is_liked);

    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

// Render comments
function renderComments(comments) {
    commentCount.textContent = `(${comments.length})`;

    if (comments.length === 0) {
        commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
        return;
    }

    commentsList.innerHTML = comments
        .map(comment => `
      <div class="comment-card">
        <div class="comment-header">
          <span class="comment-author">${comment.username}</span>
          <span class="comment-time">${formatDate(comment.timestamp)}</span>
        </div>
        <p class="comment-text">${escapeHtml(comment.text)}</p>
      </div>
    `)
        .join('');
}

// Submit comment
async function submitComment() {
    const text = commentInput.value.trim();

    if (!text) {
        alert('Please enter a comment');
        return;
    }

    if (text.length > 500) {
        alert('Comment is too long (max 500 characters)');
        return;
    }

    try {
        submitCommentBtn.disabled = true;
        submitCommentBtn.textContent = 'Posting...';

        const response = await fetch(`/api/movies/${movieId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ movie_id: movieId, text })
        });

        if (!response.ok) throw new Error('Failed to post comment');

        // Reload comments
        const commentsResponse = await fetch(`/api/movies/${movieId}/comments`, {
            credentials: 'include'
        });
        const commentsData = await commentsResponse.json();

        renderComments(commentsData.comments);
        commentInput.value = '';

    } catch (error) {
        console.error('Error posting comment:', error);
        alert('Failed to post comment');
    } finally {
        submitCommentBtn.disabled = false;
        submitCommentBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2 10L18 2L10 18L8 11L2 10Z" fill="currentColor"/>
      </svg>
      Post Comment
    `;
    }
}

// Format date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// UI helpers
function showLoading() {
    loadingState.style.display = 'flex';
    mainContent.style.display = 'none';
}

function hideLoading() {
    loadingState.style.display = 'none';
    mainContent.style.display = 'block';
}

// Logout
async function handleLogout() {
    try {
        await fetch('/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login';
    } catch (error) {
        console.error('Error logging out:', error);
        window.location.href = '/login';
    }
}
