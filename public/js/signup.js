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

const signupForm = document.getElementById("signup-form");
const messageEl = document.getElementById("message");
const termsCheckbox = document.getElementById("terms");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!termsCheckbox.checked) {
    messageEl.textContent =
      "You must agree to the Terms of Use and Privacy Policy.";
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  messageEl.textContent = "Creating account...";

  try {
    const response = await apiFetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        termsAccepted: termsCheckbox.checked,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      messageEl.textContent = data.message || "Signup failed";
      return;
    }

    messageEl.textContent = "Account created successfully";
    window.location.href = "/login.html";
  } catch (error) {
    console.error("Signup failed:", error);
    messageEl.textContent = "Something went wrong";
  }
});
