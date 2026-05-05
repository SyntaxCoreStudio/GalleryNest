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
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = {
    ...(options.headers || {}),
  };

  if (isStateChanging) {
    const csrfToken = await getCsrfToken();
    headers["x-csrf-token"] = csrfToken;
  }

  const res = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });

  // If CSRF fails, clear cache so it retries next time
  if (res.status === 403) {
    try {
      const data = await res.clone().json();
      if (data.message === "Invalid CSRF token") {
        csrfTokenCache = null;
      }
    } catch (_) {}
  }

  return res;
}

const galleriesContainer = document.getElementById("galleries");
const statusEl = document.getElementById("status");
const titleInput = document.getElementById("title");
const createGalleryBtn = document.getElementById("create-gallery-btn");
const logoutBtn = document.getElementById("logout-btn");
const sessionStatusEl = document.getElementById("session-status");

const storagePlanEl = document.getElementById("storage-plan");
const storageLabelEl = document.getElementById("storage-label");
const storagePercentEl = document.getElementById("storage-percent");
const storageFillEl = document.getElementById("storage-fill");

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 Bytes";
  }

  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatPlanName(plan) {
  if (!plan) return "Free Plan";
  return `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;
}

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

async function loadStorageUsage() {
  try {
    storagePlanEl.textContent = "Loading...";
    storageLabelEl.textContent = "Loading storage...";
    storagePercentEl.textContent = "0%";
    storageFillEl.style.width = "0%";

    const res = await fetch("/api/galleries/storage");
    const data = await res.json();

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!res.ok || !data.ok) {
      storagePlanEl.textContent = "Storage unavailable";
      storageLabelEl.textContent =
        data.message || "Could not load storage usage.";
      storagePercentEl.textContent = "0%";
      storageFillEl.style.width = "0%";
      return;
    }

    const used = data.storageUsed || 0;
    const limit = data.storageLimit || 1;
    const percent = Math.min(Math.round((used / limit) * 100), 100);

    storagePlanEl.textContent = formatPlanName(data.plan);
    storageLabelEl.textContent = `${formatBytes(used)} of ${formatBytes(limit)} used`;
    storagePercentEl.textContent = `${percent}%`;
    storageFillEl.style.width = `${percent}%`;
  } catch (error) {
    console.error("Failed to load storage usage:", error);
    storagePlanEl.textContent = "Storage unavailable";
    storageLabelEl.textContent = "Something went wrong while loading storage.";
    storagePercentEl.textContent = "0%";
    storageFillEl.style.width = "0%";
  }
}

logoutBtn.addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", {
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

      const titleEl = document.createElement("h3");
      titleEl.textContent = gallery.title;

      const clientEl = document.createElement("p");
      clientEl.textContent = gallery.clientName || "No client name yet";

      div.appendChild(titleEl);
      div.appendChild(clientEl);

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

    const res = await apiFetch("/api/galleries", {
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
    await loadStorageUsage();
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

  await loadStorageUsage();
  await loadGalleries();
}

async function loadCsrfToken() {
  const res = await fetch("/api/csrf-token");
  const data = await res.json();
  window.csrfToken = data.csrfToken;
}

loadCsrfToken();

async function startCheckout(plan) {
  try {
    const res = await apiFetch("/api/billing/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.message || "Checkout failed");
      return;
    }

    window.location.href = data.url;
  } catch (err) {
    console.error(err);
    alert("Something went wrong");
  }
}

const params = new URLSearchParams(window.location.search);

if (params.get("payment") === "success") {
  alert("Payment successful. Your plan will update shortly.");
}

if (params.get("payment") === "cancelled") {
  alert("Payment cancelled.");
}

initDashboard();
