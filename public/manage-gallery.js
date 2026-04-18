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

  const res = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });

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

const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");

const modal = document.getElementById("modal");
const modalImage = document.getElementById("modal-image");
const modalOverlay = document.getElementById("modal-overlay");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

const copyLinkBtn = document.getElementById("copy-link-btn");
const deleteGalleryBtn = document.getElementById("delete-gallery-btn");
const editGalleryBtn = document.getElementById("edit-gallery-btn");

const editDialog = document.getElementById("edit-gallery-dialog");
const editForm = document.getElementById("edit-gallery-form");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const saveGalleryBtn = document.getElementById("save-gallery-btn");

const editTitleInput = document.getElementById("edit-title");
const editClientNameInput = document.getElementById("edit-client-name");
const editDescriptionInput = document.getElementById("edit-description");
const editPasswordInput = document.getElementById("edit-password");
const editExpiryInput = document.getElementById("edit-expiry");

const dropArea = document.getElementById("drop-area");
const isMobile = window.matchMedia("(pointer: coarse)").matches;

const progressWrap = document.getElementById("upload-progress-wrap");
const progressFill = document.getElementById("upload-progress-fill");
const progressText = document.getElementById("upload-progress-text");

const appModal = document.getElementById("app-modal");
const appModalTitle = document.getElementById("app-modal-title");
const appModalMessage = document.getElementById("app-modal-message");
const appModalClose = document.getElementById("app-modal-close");
const appModalCancel = document.getElementById("app-modal-cancel");
const appModalConfirm = document.getElementById("app-modal-confirm");
const appModalBackdrop = document.querySelector(".app-modal-backdrop");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCaption = document.getElementById("modal-caption");

let modalConfirmHandler = null;

function openAppModal({
  title = "Confirm Action",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  confirmClass = "app-btn-danger",
  onConfirm = null,
}) {
  appModalTitle.textContent = title;
  appModalMessage.textContent = message;
  appModalConfirm.textContent = confirmText;
  appModalConfirm.className = `app-btn ${confirmClass}`;
  modalConfirmHandler = onConfirm;
  appModal.classList.remove("hidden");
}

function closeAppModal() {
  appModal.classList.add("hidden");
  modalConfirmHandler = null;
}

if (appModalClose) {
  appModalClose.addEventListener("click", closeAppModal);
}

if (appModalCancel) {
  appModalCancel.addEventListener("click", closeAppModal);
}

if (appModalBackdrop) {
  appModalBackdrop.addEventListener("click", closeAppModal);
}

if (appModalConfirm) {
  appModalConfirm.addEventListener("click", async () => {
    if (typeof modalConfirmHandler === "function") {
      await modalConfirmHandler();
    }
    closeAppModal();
  });
}

let currentImages = [];
let currentIndex = 0;
let currentGallery = null;

function getGalleryId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function checkSession() {
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();

    if (!response.ok) {
      window.location.href = "/login.html";
      return false;
    }

    return true;
  } catch (error) {
    console.error("Session check failed:", error);
    window.location.href = "/login.html";
    return false;
  }
}

function handleUnauthorized(status) {
  if (status === 401) {
    window.location.href = "/login.html";
    return true;
  }

  return false;
}

async function loadImages() {
  const galleryId = getGalleryId();
  const statusEl = document.getElementById("status");
  const container = document.getElementById("gallery");
  const titleEl = document.getElementById("gallery-title");
  const clientEl = document.getElementById("gallery-client");
  const descriptionEl = document.getElementById("gallery-description");

  if (!galleryId) {
    statusEl.textContent = "No gallery ID found in the URL.";
    return;
  }

  try {
    statusEl.textContent = "Loading images...";

    const response = await fetch(`/api/galleries/${galleryId}/images`);
    const data = await response.json();

    console.log("Manage gallery API response:", data);

    if (handleUnauthorized(response.status)) {
      return;
    }

    if (!data.ok) {
      statusEl.textContent = data.message || "Failed to load gallery.";
      return;
    }

    currentGallery = data.gallery || null;

    if (currentGallery) {
      titleEl.textContent = currentGallery.title || "Manage Gallery";
      clientEl.textContent = currentGallery.clientName
        ? `Client: ${currentGallery.clientName}`
        : "";
      descriptionEl.textContent = currentGallery.description || "";
    }

    container.innerHTML = "";

    if (!data.images || data.images.length === 0) {
      currentImages = [];
      statusEl.textContent =
        "No images yet. Upload your first images to start building this gallery.";
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

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "Delete Image";

      deleteBtn.addEventListener("click", () => {
        openAppModal({
          title: "Delete image",
          message:
            "Are you sure you want to delete this image? This action cannot be undone.",
          confirmText: "Delete Image",
          confirmClass: "app-btn-danger",
          onConfirm: async () => {
            try {
              const res = await apiFetch(`/api/images/${img.id}`, {
                method: "DELETE",
              });

              const result = await res.json();

              if (handleUnauthorized(res.status)) return;

              if (result.ok) {
                loadImages();
              } else {
                openAppModal({
                  title: "Could not delete image",
                  message:
                    result.message ||
                    "Something went wrong while deleting the image.",
                  confirmText: "Okay",
                  confirmClass: "app-btn-primary",
                });
              }
            } catch (error) {
              console.error("Delete image failed:", error);
              openAppModal({
                title: "Delete failed",
                message: "Something went wrong while deleting the image.",
                confirmText: "Okay",
                confirmClass: "app-btn-primary",
              });
            }
          },
        });
      });

      card.appendChild(imageEl);
      card.appendChild(nameEl);
      card.appendChild(deleteBtn);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Failed to load manage gallery:", error);
    statusEl.textContent = "Something went wrong while loading the gallery.";
  }
}

function showProgress() {
  if (!progressWrap) return;
  progressWrap.classList.remove("hidden");
}

function hideProgress() {
  if (!progressWrap) return;
  progressWrap.classList.add("hidden");
}

function updateProgress(percent) {
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }

  if (progressText) {
    progressText.textContent = `Uploading ${percent}%`;
  }
}

function resetProgress() {
  updateProgress(0);
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

async function copyClientLink() {
  if (!currentGallery || !currentGallery.shareToken) {
    openAppModal({
      title: "No link available",
      message: "This gallery does not have a public share link yet.",
      confirmText: "Okay",
      confirmClass: "app-btn-primary",
    });
    return;
  }

  const url = `${window.location.origin}/gallery.html?token=${currentGallery.shareToken}`;

  try {
    await navigator.clipboard.writeText(url);

    copyLinkBtn.textContent = "Copied ✓";
    copyLinkBtn.style.background = "#4f8b6f";

    setTimeout(() => {
      copyLinkBtn.textContent = "Copy Client Link";
      copyLinkBtn.style.background = "";
    }, 2000);
  } catch (error) {
    console.error("Copy link failed:", error);
    alert("Could not copy the link.");
  }
}

async function deleteGallery() {
  const galleryId = getGalleryId();

  openAppModal({
    title: "Delete gallery",
    message:
      "Delete this entire gallery and all its images? This action cannot be undone.",
    confirmText: "Delete Gallery",
    confirmClass: "app-btn-danger",
    onConfirm: async () => {
      try {
        const res = await apiFetch(`/api/galleries/${galleryId}`, {
          method: "DELETE",
        });

        const data = await res.json();

        if (handleUnauthorized && handleUnauthorized(res.status)) {
          return;
        }

        if (!data.ok) {
          openAppModal({
            title: "Could not delete gallery",
            message: data.message || "Failed to delete gallery.",
            confirmText: "Okay",
            confirmClass: "app-btn-primary",
            onConfirm: null,
          });
          return;
        }

        window.location.href = "/dashboard";
      } catch (error) {
        console.error("Delete gallery failed:", error);
        openAppModal({
          title: "Delete failed",
          message: "Something went wrong while deleting the gallery.",
          confirmText: "Okay",
          confirmClass: "app-btn-primary",
          onConfirm: null,
        });
      }
    },
  });
}

function openEditDialog() {
  if (!currentGallery) return;

  editTitleInput.value = currentGallery.title || "";
  editClientNameInput.value = currentGallery.clientName || "";
  editDescriptionInput.value = currentGallery.description || "";

  editPasswordInput.value = "";
  editExpiryInput.value = currentGallery.expiresAt
    ? currentGallery.expiresAt.split("T")[0]
    : "";

  editDialog.showModal();
}

function closeEditDialog() {
  editDialog.close();
}

async function saveGalleryChanges(event) {
  event.preventDefault();

  const galleryId = getGalleryId();

  const payload = {
    title: editTitleInput.value.trim(),
    clientName: editClientNameInput.value.trim(),
    description: editDescriptionInput.value.trim(),
    password: editPasswordInput.value.trim(),
    expiresAt: editExpiryInput.value || null,
  };

  if (!payload.title) {
    alert("Gallery title is required");
    return;
  }

  try {
    saveGalleryBtn.disabled = true;
    saveGalleryBtn.textContent = "Saving...";

    const res = await apiFetch(`/api/galleries/${galleryId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (handleUnauthorized(res.status)) {
      return;
    }

    if (!data.ok) {
      alert(data.message || "Failed to update gallery");
      return;
    }

    closeEditDialog();
    await loadImages();
  } catch (error) {
    console.error("Update gallery failed:", error);
    alert("Something went wrong while updating the gallery.");
  } finally {
    saveGalleryBtn.disabled = false;
    saveGalleryBtn.textContent = "Save Changes";
  }
}

function chunkFiles(files, batchSize) {
  const chunks = [];
  for (let i = 0; i < files.length; i += batchSize) {
    chunks.push(files.slice(i, i + batchSize));
  }
  return chunks;
}

async function handleFiles(files) {
  const galleryId = getGalleryId();

  const fileArray = Array.from(files);
  const batchSize = 5; // matches backend multer limit
  const batches = chunkFiles(fileArray, batchSize);

  let uploadedCount = 0;
  const totalFiles = fileArray.length;

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
    showProgress();
    resetProgress();

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const formData = new FormData();

      for (const file of batch) {
        formData.append("images", file);
      }

      await uploadSingleBatch(formData, (batchPercent) => {
        // convert batch progress into global progress
        const batchWeight = batch.length / totalFiles;
        const overall =
          (uploadedCount / totalFiles) * 100 + batchPercent * batchWeight;

        updateProgress(Math.round(overall));
      });

      uploadedCount += batch.length;
    }

    updateProgress(100);
    fileInput.value = "";
    await loadImages();
  } catch (error) {
    console.error("Upload failed:", error);
    alert(error.message || "Upload failed");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Select Files";

    setTimeout(() => {
      hideProgress();
      resetProgress();
    }, 600);
  }
}

async function uploadSingleBatch(formData, onProgress) {
  const galleryId = getGalleryId();
  const csrfToken = await getCsrfToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `/api/galleries/${galleryId}/upload`);
    xhr.setRequestHeader("x-csrf-token", csrfToken);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;

      const percent = event.lengthComputable
        ? (event.loaded / event.total) * 100
        : 0;

      onProgress(percent);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 401) {
        window.location.href = "/login.html";
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);

          if (data.ok) {
            resolve();
          } else {
            reject(new Error(data.message || "Batch upload failed"));
          }
        } catch {
          reject(new Error("Invalid server response"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    xhr.send(formData);
  });
}

if (uploadBtn) {
  uploadBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    fileInput.click();
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

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", copyClientLink);
}

if (deleteGalleryBtn) {
  deleteGalleryBtn.addEventListener("click", deleteGallery);
}

if (editGalleryBtn) {
  editGalleryBtn.addEventListener("click", openEditDialog);
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", closeEditDialog);
}

if (editForm) {
  editForm.addEventListener("submit", saveGalleryChanges);
}

if (fileInput) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
      handleFiles(fileInput.files);
    }
  });
}

if (dropArea && !isMobile) {
  dropArea.addEventListener("click", () => {
    fileInput.click();
  });

  dropArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropArea.classList.add("dragover");
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("dragover");
  });

  dropArea.addEventListener("drop", (event) => {
    event.preventDefault();
    dropArea.classList.remove("dragover");

    const files = event.dataTransfer.files;

    if (!files.length) return;

    handleFiles(files);
  });
}

if (isMobile && dropArea) {
  const text = dropArea.querySelector("p");
  if (text) {
    text.textContent = "Tap to upload images";
  }
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

async function initManageGallery() {
  const loggedIn = await checkSession();

  if (!loggedIn) {
    return;
  }

  await loadImages();
}

initManageGallery();
