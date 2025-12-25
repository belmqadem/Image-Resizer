const form = document.getElementById("img-form");
const selectImageBtn = document.getElementById("select-image-btn");
const outputPath = document.getElementById("output-path");
const filename = document.getElementById("filename");
const heightInput = document.getElementById("height");
const widthInput = document.getElementById("width");

let selectedImagePath = null;

if (
  !form ||
  !selectImageBtn ||
  !outputPath ||
  !filename ||
  !heightInput ||
  !widthInput
) {
  console.error("One or more DOM elements not found");
}

// Handle select image button click
selectImageBtn.addEventListener("click", async () => {
  const filePath = await window.ipcRenderer.invoke("dialog:openFile");

  if (filePath) {
    selectedImagePath = filePath;
    loadImage(filePath);
  }
});

function loadImage(imagePath) {
  // Extract filename from path
  const parts = imagePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1];

  // Get original dimensions
  const image = new Image();
  image.src = `file://${imagePath}`;
  image.onload = function () {
    widthInput.value = this.width;
    heightInput.value = this.height;
    console.log(widthInput.value, heightInput.value);
  };

  form.style.display = "block";
  filename.innerText = fileName;
  outputPath.innerText = window.path.join(window.os.homedir(), "imageshrink");
}

// Function to send image data to main process
function sendImage(e) {
  e.preventDefault();

  if (!selectedImagePath) {
    alertError("Please select an image first");
    return;
  }

  const imgWidth = widthInput.value;
  const imgHeight = heightInput.value;

  if (imgWidth === "" || imgHeight === "" || imgWidth <= 0 || imgHeight <= 0) {
    alertError("Width and Height must be positive numbers");
    return;
  }

  console.log(selectedImagePath, imgWidth, imgHeight);

  window.ipcRenderer.send("image:resize", {
    imgPath: selectedImagePath,
    imgWidth,
    imgHeight,
  });
}

// Listen for image:done from main process
window.ipcRenderer.on("image:done", () => {
  alertSuccess(
    `Image resized to ${widthInput.value} x ${heightInput.value} successfully!`
  );
});

// Listen for errors
window.ipcRenderer.on("image:error", (event, errorMessage) => {
  alertError(`Error: ${errorMessage}`);
});

function alertError(message) {
  window.toast.show({
    text: message,
    duration: 5000,
    close: false,
    style: {
      background: "red",
      color: "#fff",
      textAlign: "center",
      padding: "10px",
      borderRadius: "5px",
    },
  });
}

function alertSuccess(message) {
  window.toast.show({
    text: message,
    duration: 5000,
    close: false,
    style: {
      background: "#00b09b",
      color: "#fff",
      textAlign: "center",
      padding: "10px",
      borderRadius: "5px",
    },
  });
}

form.addEventListener("submit", sendImage);
