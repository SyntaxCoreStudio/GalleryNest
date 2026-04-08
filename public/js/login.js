const loginForm = document.getElementById("login-form");
const messageEl = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  messageEl.textContent = "Logging in...";

  try {
    const response = await fetch("/api/auth/login", {
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
