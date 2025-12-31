let currentMovies = [];
let currentOffset = 0;
let currentCategory = 'popular';
let currentUser = null;
let searchTimeout = null;
let isSearching = false;

// DOM Elements
const moviesGrid = document.getElementById('moviesGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');
const myLikesBtn = document.getElementById('myLikesBtn');
const movieModal = document.getElementById('movieModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalBody = document.getElementById('modalBody');
const movieCount = document.getElementById('movieCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const discoverBtn = document.getElementById('discoverBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchUserInfo();
    fetchMovies();
    setupEventListeners();
    setupNavbarScroll();
});

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            searchMovies(searchInput.value.trim());
        }
    });

    // Search Icon Click
    const searchIcon = document.querySelector('.search-icon');
    if (searchIcon) {
        searchIcon.addEventListener('click', () => {
            clearTimeout(searchTimeout);
            searchMovies(searchInput.value.trim());
        });
    }

    // User menu
    userButton.addEventListener('click', toggleUserMenu);
    document.addEventListener('click', (e) => {
        if (!userButton.contains(e.target) && !userDropdown.contains(e.target)) {
            closeUserMenu();
        }
    });

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // My Likes
    myLikesBtn.addEventListener('click', showMyLikes);

    // Modal
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Load More
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreMovies);
    }

    // Category Tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-tab');
            if (btn) handleCategoryChange(btn.dataset.category);
        });
    });
}

function setupNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// Fetch user info
async function fetchUserInfo() {
    try {
        const response = await fetch('/api/user', {
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.href = '/login';
            return;
        }

        const data = await response.json();
        currentUser = data;

        // Update UI
        document.getElementById('username').textContent = data.username;
        document.getElementById('likedCount').textContent = data.stats?.liked_count || 0;
        document.getElementById('viewedCount').textContent = data.stats?.viewed_count || 0;

    } catch (error) {
        console.error('Error fetching user info:', error);
        window.location.href = '/login';
    }
}

// Fetch movies
async function fetchMovies(limit = 100, offset = 0) {
    try {
        showLoading();

        const response = await fetch(`/api/movies?limit=${limit}&offset=${offset}&category=${currentCategory}`, {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch movies');

        const data = await response.json();

        if (offset === 0) {
            currentMovies = data.movies;
        } else {
            currentMovies = [...currentMovies, ...data.movies];
        }

        currentOffset = offset;
        renderMovies(currentMovies);
        updateMovieCount(data.total);

        // Show/hide load more button
        if (currentMovies.length < data.total) {
            loadMoreContainer.style.display = 'flex';
        } else {
            loadMoreContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('Error fetching movies:', error);
        showEmpty();
    }
    hideRecommendations();
}

function loadMoreMovies() {
    const newOffset = currentOffset + 20;
    fetchMovies(20, newOffset);
}

function handleCategoryChange(category) {
    if (category === currentCategory) return;

    currentCategory = category;

    // Update UI
    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.category-tab[data-category="${category}"]`).classList.add('active');

    // Reset and fetch
    currentMovies = [];
    currentOffset = 0;
    fetchMovies(20, 0);
}

// Search movies
function handleSearch(e) {
    const query = e.target.value.trim();

    clearTimeout(searchTimeout);

    if (query.length === 0) {
        isSearching = false;
        fetchMovies();
        return;
    }

    if (query.length < 2) return;

    searchTimeout = setTimeout(() => {
        searchMovies(query);
    }, 500);
}

async function searchMovies(query) {
    try {
        isSearching = true;
        showLoading();

        const response = await fetch('/api/movies/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query }),
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        currentMovies = data.movies;
        renderMovies(currentMovies);

        // Handle recommendations
        if (data.recommendations && data.recommendations.length > 0) {
            renderRecommendations(data.recommendations);
        } else {
            hideRecommendations();
        }

        updateMovieCount(currentMovies.length);
        loadMoreContainer.style.display = 'none';

    } catch (error) {
        console.error('Error searching movies:', error);
        showEmpty();
        hideRecommendations();
    }
}

function renderRecommendations(movies) {
    const section = document.getElementById('recommendationsSection');
    const grid = document.getElementById('recommendationsGrid');

    section.style.display = 'block';
    grid.innerHTML = '';

    movies.forEach((movie, index) => {
        const card = createMovieCard(movie, index);
        grid.appendChild(card);
    });
}

function hideRecommendations() {
    const section = document.getElementById('recommendationsSection');
    if (section) section.style.display = 'none';
}

// Render movies
function renderMovies(movies) {
    hideLoading();

    if (movies.length === 0) {
        showEmpty();
        return;
    }

    emptyState.style.display = 'none';
    moviesGrid.innerHTML = '';

    movies.forEach((movie, index) => {
        const card = createMovieCard(movie, index);
        moviesGrid.appendChild(card);
    });
}

function createMovieCard(movie, index) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
    const genres = movie.genres.slice(0, 2);

    card.innerHTML = `
    <img src="${movie.poster_path}" alt="${movie.title}" class="movie-poster" 
         onerror="this.src='https://via.placeholder.com/300x450/1a1a2e/ffffff?text=No+Image'">
    <div class="movie-info">
      <div class="movie-header">
        <h3 class="movie-title">${movie.title}</h3>
        <button class="like-button ${movie.is_liked ? 'liked' : ''}" data-movie-id="${movie.id}">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="${movie.is_liked ? 'currentColor' : 'none'}">
            <path d="M10 17.5L8.5 16.1C4 12.1 1 9.4 1 6.1C1 3.4 3.1 1.3 5.8 1.3C7.3 1.3 8.8 2 10 3.1C11.2 2 12.7 1.3 14.2 1.3C16.9 1.3 19 3.4 19 6.1C19 9.4 16 12.1 11.5 16.1L10 17.5Z" 
                  stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </div>
      <div class="movie-meta">
        <div class="movie-rating">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M7 0L8.5 5H14L9.5 8L11 13L7 10L3 13L4.5 8L0 5H5.5L7 0Z"/>
          </svg>
          ${movie.vote_average.toFixed(1)}
        </div>
        <span class="movie-year">${year}</span>
      </div>
      <div class="movie-genres">
        ${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}
      </div>
    </div>
  `;

    // Click to view details - navigate to detail page
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.like-button')) {
            window.location.href = `/movie/${movie.id}`;
        }
    });

    // Like button
    const likeBtn = card.querySelector('.like-button');
    likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLike(movie.id, likeBtn);
    });

    return card;
}

// Toggle like
async function toggleLike(movieId, button) {
    try {
        const response = await fetch(`/api/movies/${movieId}/like`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to toggle like');

        const data = await response.json();

        // Update button
        if (data.is_liked) {
            button.classList.add('liked');
            button.querySelector('path').setAttribute('fill', 'currentColor');
        } else {
            button.classList.remove('liked');
            button.querySelector('path').setAttribute('fill', 'none');
        }

        // Update user stats
        fetchUserInfo();

    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

// Show movie detail
async function showMovieDetail(movieId) {
    try {
        const response = await fetch(`/api/movies/${movieId}`, {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch movie details');

        const movie = await response.json();

        // Fetch comments
        const commentsResponse = await fetch(`/api/movies/${movieId}/comments`, {
            credentials: 'include'
        });
        const commentsData = await commentsResponse.json();

        renderMovieDetail(movie, commentsData.comments);
        openModal();

    } catch (error) {
        console.error('Error fetching movie details:', error);
    }
}

function renderMovieDetail(movie, comments) {
    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';

    modalBody.innerHTML = `
    <div style="position: relative;">
      <img src="${movie.backdrop_path}" alt="${movie.title}" 
           style="width: 100%; height: 400px; object-fit: cover;"
           onerror="this.src='https://via.placeholder.com/900x400/1a1a2e/ffffff?text=${encodeURIComponent(movie.title)}'">
      <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 0%, var(--bg-card) 100%);"></div>
    </div>

    <div style="padding: 32px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 36px; font-weight: 800; margin-bottom: 12px;">${movie.title}</h2>
          <div style="display: flex; gap: 16px; align-items: center; color: var(--text-muted); font-size: 15px;">
            <div style="display: flex; align-items: center; gap: 6px; color: #ffd700; font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L9.7 5.7H16L11 9.2L12.7 15L8 11.5L3.3 15L5 9.2L0 5.7H6.3L8 0Z"/>
              </svg>
              ${movie.vote_average.toFixed(1)}
            </div>
            <span>${year}</span>
            <span>${movie.runtime} min</span>
          </div>
        </div>
        <button class="like-button ${movie.is_liked ? 'liked' : ''}" id="detailLikeBtn" 
                style="padding: 12px 24px; background: rgba(229, 9, 20, 0.15); border: 2px solid var(--primary); border-radius: 8px; font-size: 16px; font-weight: 600;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="${movie.is_liked ? 'currentColor' : 'none'}" style="vertical-align: middle; margin-right: 8px;">
            <path d="M10 17.5L8.5 16.1C4 12.1 1 9.4 1 6.1C1 3.4 3.1 1.3 5.8 1.3C7.3 1.3 8.8 2 10 3.1C11.2 2 12.7 1.3 14.2 1.3C16.9 1.3 19 3.4 19 6.1C19 9.4 16 12.1 11.5 16.1L10 17.5Z" 
                  stroke="currentColor" stroke-width="1.5"/>
          </svg>
          ${movie.is_liked ? 'Liked' : 'Like'}
        </button>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
          ${movie.genres.map(g => `<span class="genre-tag" style="padding: 6px 14px; font-size: 13px;">${g}</span>`).join('')}
        </div>
        <p style="color: var(--text-secondary); line-height: 1.6; font-size: 15px;">${movie.overview}</p>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 24px;">
        <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Comments (${comments.length})</h3>
        
        <div style="margin-bottom: 24px;">
          <textarea id="commentInput" placeholder="Add a comment..." 
                    style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.05); border: 2px solid var(--border-color); border-radius: 8px; color: white; font-family: inherit; font-size: 14px; resize: vertical; min-height: 80px;"></textarea>
          <button id="submitComment" 
                  style="margin-top: 12px; padding: 10px 24px; background: var(--primary); border: none; border-radius: 6px; color: white; font-weight: 600; cursor: pointer;">
            Post Comment
          </button>
        </div>

        <div id="commentsList" style="display: flex; flex-direction: column; gap: 16px;">
          ${comments.length === 0 ? '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No comments yet. Be the first to comment!</p>' : ''}
          ${comments.map(c => `
            <div style="padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600; color: var(--primary);">${c.username}</span>
                <span style="font-size: 12px; color: var(--text-muted);">${formatDate(c.timestamp)}</span>
              </div>
              <p style="color: var(--text-secondary); line-height: 1.5;">${c.text}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

    // Setup like button
    const detailLikeBtn = document.getElementById('detailLikeBtn');
    detailLikeBtn.addEventListener('click', () => toggleLike(movie.id, detailLikeBtn));

    // Setup comment submission
    const submitCommentBtn = document.getElementById('submitComment');
    const commentInput = document.getElementById('commentInput');
    submitCommentBtn.addEventListener('click', () => submitComment(movie.id, commentInput));
}

async function submitComment(movieId, inputElement) {
    const text = inputElement.value.trim();
    if (!text) return;

    try {
        const response = await fetch(`/api/movies/${movieId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ movie_id: movieId, text })
        });

        if (!response.ok) throw new Error('Failed to post comment');

        // Reload movie details
        inputElement.value = '';
        showMovieDetail(movieId);

    } catch (error) {
        console.error('Error posting comment:', error);
    }
}

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

// Show my liked movies
async function showMyLikes() {
    try {
        const response = await fetch('/api/user/liked-movies', {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch liked movies');

        const data = await response.json();
        currentMovies = data.movies;
        isSearching = true;
        renderMovies(currentMovies);
        updateMovieCount(currentMovies.length);
        loadMoreContainer.style.display = 'none';
        searchInput.value = '';
        closeUserMenu();

    } catch (error) {
        console.error('Error fetching liked movies:', error);
    }
}

// UI helpers
function showLoading() {
    loadingState.style.display = 'flex';
    moviesGrid.style.display = 'none';
    emptyState.style.display = 'none';
}

function hideLoading() {
    loadingState.style.display = 'none';
    moviesGrid.style.display = 'grid';
}

function showEmpty() {
    loadingState.style.display = 'none';
    moviesGrid.style.display = 'none';
    emptyState.style.display = 'block';
}

function updateMovieCount(count) {
    movieCount.textContent = `${count} movies`;
}

function toggleUserMenu() {
    userButton.parentElement.classList.toggle('active');
}

function closeUserMenu() {
    userButton.parentElement.classList.remove('active');
}

function openModal() {
    movieModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    movieModal.classList.remove('active');
    document.body.style.overflow = '';
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
