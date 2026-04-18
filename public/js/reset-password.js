let csrfTokenCache = null;

async function getCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;

  const res = await fetch("/api/csrf-token", {
    credentials: "same-origin",
  });

  const data = await res.json();

  if (!res.ok || !data.csrfToken) {
    throw new Error("Failed to get CSRF token");
  }

  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
}

async function apiFetch(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = await getCsrfToken();
    headers["x-csrf-token"] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 403) {
    try {
      const data = await response.clone().json();
      if (data.message === "Invalid CSRF token") {
        csrfTokenCache = null;
      }
    } catch (error) {
      console.error("Failed to parse CSRF error response:", error);
    }
  }

  return response;
}

const form = document.getElementById("reset-password-form");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    messageEl.textContent = "Invalid or missing reset token.";
    return;
  }

  if (password.length < 8) {
    messageEl.textContent = "Password must be at least 8 characters long.";
    return;
  }

  if (password !== confirmPassword) {
    messageEl.textContent = "Passwords do not match.";
    return;
  }

  messageEl.textContent = "Resetting password...";

  try {
    const response = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      messageEl.textContent = data.message || "Password reset failed.";
      return;
    }

    messageEl.textContent =
      "Password reset successful. Redirecting to login...";

    setTimeout(() => {
      window.location.href = "/login.html";
    }, 1500);
  } catch (error) {
    console.error("Reset password failed:", error);
    messageEl.textContent = "Something went wrong.";
  }
});
