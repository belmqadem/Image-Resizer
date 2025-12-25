const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  shell,
  dialog,
} = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const resizeImg = require("resize-img");
require("dotenv").config();

const isMacOS = process.platform === "darwin";
const isDev = process.env.NODE_ENV === "development";

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "Image Resizer",
    width: isDev ? 1200 : 500,
    height: isDev ? 800 : 700,
    resizable: true,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function createAboutWindow() {
  const aboutWindow = new BrowserWindow({
    title: "About Image Resizer",
    width: 400,
    height: 450,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
  });

  aboutWindow.setMenu(null);

  aboutWindow.loadFile(path.join(__dirname, "renderer", "about.html"));
}

// Menu Template
const menu = [
  // App Menu (macOS only)
  ...(isMacOS
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: `About ${app.name}`,
              click: createAboutWindow,
            },
            { type: "separator" },
            {
              label: "Services",
              role: "services",
            },
            { type: "separator" },
            {
              label: `Hide ${app.name}`,
              role: "hide",
            },
            {
              label: "Hide Others",
              role: "hideOthers",
            },
            {
              label: "Show All",
              role: "unhide",
            },
            { type: "separator" },
            {
              label: `Quit ${app.name}`,
              role: "quit",
            },
          ],
        },
      ]
    : []),

  // File Menu
  {
    label: "File",
    submenu: [
      {
        label: "Open Image...",
        accelerator: "CmdOrCtrl+O",
        click: async () => {
          if (mainWindow) {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openFile"],
              filters: [
                {
                  name: "Images",
                  extensions: ["jpg", "jpeg", "png", "gif", "webp"],
                },
              ],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send("file:selected", result.filePaths[0]);
            }
          }
        },
      },
      { type: "separator" },
      {
        label: "Open Output Folder",
        accelerator: "CmdOrCtrl+Shift+O",
        click: () => {
          const destFolder = path.join(os.homedir(), "imageshrink");
          shell.openPath(destFolder);
        },
      },
      { type: "separator" },
      isMacOS ? { role: "close" } : { role: "quit" },
    ],
  },

  // View Menu
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },

  // Window Menu
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...(isMacOS
        ? [
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "window" },
          ]
        : [{ role: "close" }]),
    ],
  },
];

app.whenReady().then(() => {
  createMainWindow();

  // Implement Menu
  const mainMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(mainMenu);

  // Remove mainWindow from memory on close
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  // Add dialog handler for selecting images
  ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Listen for file:selected from menu
  ipcMain.on("file:selected", (event, filePath) => {
    if (mainWindow) {
      mainWindow.webContents.send("file:selected", filePath);
    }
  });

  // Respond to ipcRenderer events
  ipcMain.on("image:resize", (e, options) => {
    if (!options.imgPath) {
      e.sender.send("image:done");
      console.error("No file path provided from renderer process.");
      return;
    }

    options.dest = path.join(os.homedir(), "imageshrink");
    resizeImage(options);
  });
});

async function resizeImage({ imgPath, imgWidth, imgHeight, dest }) {
  try {
    const newPath = await resizeImg(fs.readFileSync(imgPath), {
      width: parseInt(imgWidth),
      height: parseInt(imgHeight),
    });

    const filename = path.basename(imgPath);

    // Create dest folder if it doesn't exist
    const destFolder = path.join(os.homedir(), "imageshrink");
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder);
    }
    const outputPath = path.join(destFolder, filename);
    fs.writeFileSync(outputPath, newPath);

    // Send success message to renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("image:done");
    }

    // Open the folder in file explorer
    shell.openPath(destFolder);
  } catch (err) {
    console.error("Error resizing image:", err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("image:error", err.message);
    }
  }
}

app.on("window-all-closed", () => {
  if (!isMacOS) {
    app.quit();
  }
});
