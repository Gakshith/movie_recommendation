const form = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");

const usernameHint = document.getElementById("usernameHint");
const emailHint = document.getElementById("emailHint");
const passwordHint = document.getElementById("passwordHint");
const confirmPasswordHint = document.getElementById("confirmPasswordHint");
const messageEl = document.getElementById("message");

const strengthFill = document.getElementById("strengthFill");
const strengthText = document.getElementById("strengthText");

const togglePasswordBtn = document.getElementById("togglePassword");
const toggleConfirmPasswordBtn = document.getElementById("toggleConfirmPassword");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

// Password visibility toggles
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePasswordBtn.classList.toggle("active");
  });
}

if (toggleConfirmPasswordBtn && confirmPasswordInput) {
  toggleConfirmPasswordBtn.addEventListener("click", () => {
    const type = confirmPasswordInput.type === "password" ? "text" : "password";
    confirmPasswordInput.type = type;
    toggleConfirmPasswordBtn.classList.toggle("active");
  });
}

function setMessage(text, type) {
  if (!messageEl) return;
  messageEl.textContent = text || "";
  messageEl.className = "message" + (type ? ` ${type}` : "");
}

function clearHints() {
  if (usernameHint) usernameHint.textContent = "";
  if (emailHint) emailHint.textContent = "";
  if (passwordHint) passwordHint.textContent = "";
  if (confirmPasswordHint) confirmPasswordHint.textContent = "";
  setMessage("");
}

function setLoading(isLoading) {
  if (!submitBtn) return;

  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoader = submitBtn.querySelector(".btn-loader");
  const btnIcon = submitBtn.querySelector(".btn-icon");

  if (isLoading) {
    submitBtn.disabled = true;
    if (btnText) btnText.style.display = "none";
    if (btnIcon) btnIcon.style.display = "none";
    if (btnLoader) btnLoader.style.display = "block";
  } else {
    submitBtn.disabled = false;
    if (btnText) btnText.style.display = "block";
    if (btnIcon) btnIcon.style.display = "block";
    if (btnLoader) btnLoader.style.display = "none";
  }
}

// Password strength checker
function checkPasswordStrength(password) {
  let strength = 0;

  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 10;

  return Math.min(strength, 100);
}

// Update password strength indicator
if (passwordInput) {
  passwordInput.addEventListener("input", (e) => {
    const password = e.target.value;
    const strength = checkPasswordStrength(password);

    if (strengthFill && strengthText) {
      strengthFill.style.width = strength + "%";

      if (strength < 25) {
        strengthFill.setAttribute("data-strength", "weak");
        strengthText.textContent = "Weak password";
        strengthText.style.color = "rgba(245, 101, 101, 0.9)";
      } else if (strength < 50) {
        strengthFill.setAttribute("data-strength", "fair");
        strengthText.textContent = "Fair password";
        strengthText.style.color = "rgba(237, 137, 54, 0.9)";
      } else if (strength < 75) {
        strengthFill.setAttribute("data-strength", "good");
        strengthText.textContent = "Good password";
        strengthText.style.color = "rgba(236, 201, 75, 0.9)";
      } else {
        strengthFill.setAttribute("data-strength", "strong");
        strengthText.textContent = "Strong password";
        strengthText.style.color = "rgba(72, 187, 120, 0.9)";
      }
    }
  });
}

if (!form) {
  console.error("registerForm not found in HTML");
} else {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearHints();

    const username = document.getElementById("username")?.value.trim() || "";
    const email = document.getElementById("email")?.value.trim() || "";
    const password = document.getElementById("password")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

    let ok = true;

    if (username.length < 3) {
      if (usernameHint) usernameHint.textContent = "Username must be at least 3 characters.";
      ok = false;
    }

    if (!email.includes("@") || !email.includes(".")) {
      if (emailHint) emailHint.textContent = "Enter a valid email address.";
      ok = false;
    }

    if (password.length < 8) {
      if (passwordHint) passwordHint.textContent = "Password must be at least 8 characters.";
      ok = false;
    }

    if (password !== confirmPassword) {
      if (confirmPasswordHint) confirmPasswordHint.textContent = "Passwords do not match.";
      ok = false;
    }

    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch("/register/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          password: password,
          email: email
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.detail || "Registration failed.", "error");
        return;
      }

      setMessage("Registration successful! Redirecting to login...", "success");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);

    } catch (err) {
      console.error("Registration error:", err);
      setMessage("Server error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  });
}
