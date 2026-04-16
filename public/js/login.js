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

const loginForm = document.getElementById("login-form");
const messageEl = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  messageEl.textContent = "Logging in...";

  try {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      messageEl.textContent = data.message || "Login failed";
      return;
    }

    messageEl.textContent = "Login successful";
    window.location.href = "/dashboard.html";
  } catch (error) {
    console.error("Login failed:", error);
    messageEl.textContent = "Something went wrong";
  }
});
