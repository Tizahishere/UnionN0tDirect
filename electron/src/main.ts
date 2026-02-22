import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import DownloadManager from "./download-manager";

let mainWindow: BrowserWindow | null = null;
const manager = new DownloadManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("downloads:start", async (_e, args) => {
  return manager.startTask({
    ...args,
    onProgress: (p) => {
      mainWindow?.webContents.send("downloads:progress", p);
    },
  });
});

ipcMain.handle("downloads:cancel", async (_e, args) => {
  const id = args.appid || args.destination;
  await manager.cancelTask(id);
  return { ok: true };
});