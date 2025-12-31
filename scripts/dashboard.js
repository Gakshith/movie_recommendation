// Dashboard JavaScript - Fetch user data and handle logout

const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const welcomeNameEl = document.getElementById("welcomeName");
const infoUsernameEl = document.getElementById("infoUsername");
const infoEmailEl = document.getElementById("infoEmail");
const logoutBtn = document.getElementById("logoutBtn");

// Fetch user data from protected endpoint
async function fetchUserData() {
    try {
        const token = localStorage.getItem("access_token");

        const response = await fetch("/api/user", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` })
            },
            credentials: "include" // Include cookies
        });

        if (!response.ok) {
            // If unauthorized, redirect to login
            if (response.status === 401) {
                window.location.href = "/login";
                return;
            }
            throw new Error("Failed to fetch user data");
        }

        const userData = await response.json();

        // Update UI with user data
        if (userNameEl) userNameEl.textContent = userData.username;
        if (userEmailEl) userEmailEl.textContent = userData.email;
        if (welcomeNameEl) welcomeNameEl.textContent = userData.username;
        if (infoUsernameEl) infoUsernameEl.textContent = userData.username;
        if (infoEmailEl) infoEmailEl.textContent = userData.email;

    } catch (error) {
        console.error("Error fetching user data:", error);
        // Redirect to login on error
        window.location.href = "/login";
    }
}

// Logout functionality
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            // Call logout endpoint
            await fetch("/logout", {
                method: "POST",
                credentials: "include"
            });

            // Clear local storage
            localStorage.removeItem("access_token");

            // Redirect to login
            window.location.href = "/login";
        } catch (error) {
            console.error("Logout error:", error);
            // Still redirect to login even if logout fails
            localStorage.removeItem("access_token");
            window.location.href = "/login";
        }
    });
}

// Initialize dashboard
fetchUserData();
