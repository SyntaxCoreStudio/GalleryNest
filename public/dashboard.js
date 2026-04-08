const galleriesContainer = document.getElementById("galleries");
const statusEl = document.getElementById("status");
const titleInput = document.getElementById("title");
const createGalleryBtn = document.getElementById("create-gallery-btn");
const logoutBtn = document.getElementById("logout-btn");
const sessionStatusEl = document.getElementById("session-status");

async function checkSession() {
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();

    if (!response.ok) {
      window.location.href = "/login.html";
      return false;
    }

    sessionStatusEl.textContent = `Logged in as ${data.user.email}`;
    return true;
  } catch (error) {
    console.error("Session check failed:", error);
    window.location.href = "/login.html";
    return false;
  }
}

logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
  } catch (error) {
    console.error("Logout failed:", error);
  }

  window.location.href = "/login.html";
});

async function loadGalleries() {
  try {
    statusEl.textContent = "Loading galleries...";
    galleriesContainer.innerHTML = "";

    const res = await fetch("/api/galleries");
    const data = await res.json();

    console.log("Load galleries response:", data);

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!data.ok) {
      statusEl.textContent = data.message || "Failed to load galleries.";
      return;
    }

    if (!data.galleries || data.galleries.length === 0) {
      statusEl.textContent =
        "No galleries yet. Create your first gallery to get started.";
      return;
    }

    statusEl.textContent = `Showing ${data.galleries.length} gallery(s)`;

    data.galleries.forEach((gallery) => {
      const div = document.createElement("div");
      div.className = "gallery";

      div.innerHTML = `
        <h3>${gallery.title}</h3>
        <p>${gallery.clientName || "No client name yet"}</p>
      `;

      div.addEventListener("click", () => {
        window.location.href = `/manage-gallery?id=${gallery.id}`;
      });

      galleriesContainer.appendChild(div);
    });
  } catch (error) {
    console.error("Failed to load galleries:", error);
    statusEl.textContent = "Something went wrong while loading galleries.";
  }
}

async function createGallery() {
  const title = titleInput.value.trim();

  if (!title) {
    statusEl.textContent =
      "Please enter a gallery title before creating a gallery.";
    titleInput.focus();
    return;
  }

  try {
    createGalleryBtn.disabled = true;
    createGalleryBtn.textContent = "Creating...";

    const res = await fetch("/api/galleries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        clientName: "",
        description: "",
      }),
    });

    const data = await res.json();

    console.log("Create gallery response:", data);

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!data.ok) {
      alert(data.message || "Failed to create gallery");
      return;
    }

    titleInput.value = "";
    await loadGalleries();
  } catch (error) {
    console.error("Failed to create gallery:", error);
    alert("Something went wrong while creating the gallery.");
  } finally {
    createGalleryBtn.disabled = false;
    createGalleryBtn.textContent = "Create Gallery";
  }
}

createGalleryBtn.addEventListener("click", createGallery);

titleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createGallery();
  }
});

async function initDashboard() {
  const loggedIn = await checkSession();

  if (!loggedIn) {
    return;
  }

  await loadGalleries();
}

initDashboard();
