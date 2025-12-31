const form = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const messageEl = document.getElementById("message");
const togglePasswordBtn = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

// Password visibility toggle
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePasswordBtn.classList.toggle("active");
  });
}

function setMessage(text, type) {
  if (!messageEl) return;
  messageEl.textContent = text || "";
  messageEl.className = "message" + (type ? ` ${type}` : "");
}

function setLoading(isLoading) {
  if (!loginBtn) return;

  const btnText = loginBtn.querySelector(".btn-text");
  const btnLoader = loginBtn.querySelector(".btn-loader");
  const btnIcon = loginBtn.querySelector(".btn-icon");

  if (isLoading) {
    loginBtn.disabled = true;
    if (btnText) btnText.style.display = "none";
    if (btnIcon) btnIcon.style.display = "none";
    if (btnLoader) btnLoader.style.display = "block";
  } else {
    loginBtn.disabled = false;
    if (btnText) btnText.style.display = "block";
    if (btnIcon) btnIcon.style.display = "block";
    if (btnLoader) btnLoader.style.display = "none";
  }
}

if (!form) {
  console.error("loginForm not found in HTML");
} else {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMessage("");

    const username = document.getElementById("username")?.value.trim() || "";
    const password = document.getElementById("password")?.value || "";

    // Basic validation
    if (username.length < 3) {
      setMessage("Username must be at least 3 characters", "error");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters", "error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/login/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username,
          password: password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.detail || "Login failed", "error");
        return;
      }

      // Success
      setMessage("Login successful! Redirecting...", "success");

      // Store token in localStorage as backup
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
      }

      // Redirect to movies page
      setTimeout(() => {
        window.location.href = "/movies";
      }, 800);

    } catch (err) {
      console.error("Login error:", err);
      setMessage("Server error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  });
}
