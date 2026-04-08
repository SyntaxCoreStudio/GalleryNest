const signupForm = document.getElementById("signup-form");
const messageEl = document.getElementById("message");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  messageEl.textContent = "Creating account...";

  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
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
