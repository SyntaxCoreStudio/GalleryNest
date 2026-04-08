const modal = document.getElementById("modal");
const modalImage = document.getElementById("modal-image");
const modalOverlay = document.getElementById("modal-overlay");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCaption = document.getElementById("modal-caption");

const passwordBox = document.getElementById("password-protect-box");
const passwordInput = document.getElementById("gallery-password");
const unlockBtn = document.getElementById("unlock-gallery-btn");
const passwordMessage = document.getElementById("password-message");

const downloadAllBtn = document.getElementById("download-all-btn");

let currentImages = [];
let currentIndex = 0;

function getShareToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

function renderGallery(data) {
  const statusEl = document.getElementById("status");
  const container = document.getElementById("gallery");
  const titleEl = document.getElementById("gallery-title");
  const clientEl = document.getElementById("gallery-client");
  const descriptionEl = document.getElementById("gallery-description");

  if (data.gallery) {
    titleEl.textContent = data.gallery.title || "Gallery";
    clientEl.textContent = data.gallery.clientName
      ? `Client: ${data.gallery.clientName}`
      : "";
    descriptionEl.textContent = data.gallery.description || "";
  }

  container.innerHTML = "";

  if (!data.images || data.images.length === 0) {
    currentImages = [];
    statusEl.textContent = "No images yet.";
    return;
  }

  currentImages = data.images;
  statusEl.textContent = `Showing ${data.images.length} image(s)`;

  data.images.forEach((img) => {
    const card = document.createElement("div");
    card.className = "image-card";

    const imageEl = document.createElement("img");
    imageEl.src = img.url;
    imageEl.alt = img.originalName || "Gallery image";

    imageEl.addEventListener("click", () => {
      currentIndex = currentImages.findIndex((image) => image.id === img.id);
      openModal();
    });

    const nameEl = document.createElement("p");
    nameEl.className = "image-name";
    nameEl.textContent = img.originalName || img.filename;

    card.appendChild(imageEl);
    card.appendChild(nameEl);
    container.appendChild(card);
  });
}

async function loadImages() {
  const shareToken = getShareToken();
  const statusEl = document.getElementById("status");
  const container = document.getElementById("gallery");
  const titleEl = document.getElementById("gallery-title");
  const clientEl = document.getElementById("gallery-client");
  const descriptionEl = document.getElementById("gallery-description");

  if (!shareToken) {
    statusEl.textContent = "No gallery token found in the URL.";
    return;
  }

  try {
    const response = await fetch(`/api/public/gallery/${shareToken}`);
    const data = await response.json();

    console.log("Public gallery API response:", data);

    if (!data.ok) {
      statusEl.textContent = data.message || "Failed to load gallery.";
      return;
    }

    if (data.requiresPassword) {
      titleEl.textContent = data.gallery?.title || "Protected Gallery";
      clientEl.textContent = "";
      descriptionEl.textContent = "";
      container.innerHTML = "";
      statusEl.textContent = "";
      passwordBox.style.display = "block";

      if (downloadAllBtn) {
        downloadAllBtn.style.display = "none";
      }

      return;
    }

    passwordBox.style.display = "none";

    if (downloadAllBtn) {
      downloadAllBtn.style.display = "inline-block";
    }

    renderGallery(data);
  } catch (error) {
    console.error("Failed to load gallery:", error);
    statusEl.textContent = "Something went wrong while loading the gallery.";
  }
}

async function unlockGallery() {
  const shareToken = getShareToken();
  const password = passwordInput.value;

  if (!password.trim()) {
    passwordMessage.textContent = "Please enter the gallery password.";
    return;
  }

  try {
    unlockBtn.disabled = true;
    unlockBtn.textContent = "Unlocking...";

    const response = await fetch(`/api/public/gallery/${shareToken}/unlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (!data.ok) {
      passwordMessage.textContent = data.message || "Incorrect password.";
      return;
    }

    passwordBox.style.display = "none";
    passwordInput.value = "";

    if (downloadAllBtn) {
      downloadAllBtn.style.display = "inline-block";
    }

    renderGallery(data);
  } catch (error) {
    console.error("Failed to unlock gallery:", error);
    passwordMessage.textContent =
      "Something went wrong while unlocking the gallery.";
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.textContent = "Unlock Gallery";
  }
}

function openModal() {
  if (!currentImages.length) return;

  const currentImage = currentImages[currentIndex];

  modal.classList.remove("hidden");
  modalImage.src = currentImage.url;
  modalCaption.textContent =
    currentImage.originalName || currentImage.filename || "";
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.add("hidden");
  modalImage.src = "";
  modalCaption.textContent = "";
  document.body.style.overflow = "";
}

function showNextImage() {
  if (!currentImages.length) return;

  currentIndex = (currentIndex + 1) % currentImages.length;
  const currentImage = currentImages[currentIndex];

  modalImage.style.opacity = "0";

  setTimeout(() => {
    modalImage.src = currentImage.url;
    modalCaption.textContent =
      currentImage.originalName || currentImage.filename || "";
    modalImage.style.opacity = "1";
  }, 100);
}

function showPrevImage() {
  if (!currentImages.length) return;

  currentIndex =
    (currentIndex - 1 + currentImages.length) % currentImages.length;
  const currentImage = currentImages[currentIndex];

  modalImage.style.opacity = "0";

  setTimeout(() => {
    modalImage.src = currentImage.url;
    modalCaption.textContent =
      currentImage.originalName || currentImage.filename || "";
    modalImage.style.opacity = "1";
  }, 100);
}

function downloadAllImages() {
  const shareToken = getShareToken();

  if (!shareToken) {
    passwordMessage.textContent = "No gallery token found.";
    return;
  }

  window.location.href = `/api/public/gallery/${shareToken}/download`;
}

if (downloadAllBtn) {
  downloadAllBtn.addEventListener("click", downloadAllImages);
}

if (unlockBtn) {
  unlockBtn.addEventListener("click", unlockGallery);
}

if (passwordInput) {
  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      unlockGallery();
    }
  });
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", closeModal);
}

if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", closeModal);
}

if (prevBtn) {
  prevBtn.addEventListener("click", showPrevImage);
}

if (nextBtn) {
  nextBtn.addEventListener("click", showNextImage);
}

document.addEventListener("keydown", (event) => {
  if (!modal || modal.classList.contains("hidden")) return;

  if (event.key === "ArrowRight") {
    showNextImage();
  }

  if (event.key === "ArrowLeft") {
    showPrevImage();
  }

  if (event.key === "Escape") {
    closeModal();
  }
});

loadImages();
