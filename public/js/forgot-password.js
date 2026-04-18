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

const form = document.getElementById("forgot-password-form");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();

  messageEl.textContent = "Sending reset link...";

  try {
    const response = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    messageEl.textContent =
      data.message ||
      "If an account with that email exists, a reset link has been sent.";
  } catch (error) {
    console.error("Forgot password request failed:", error);
    messageEl.textContent = "Something went wrong";
  }
});
