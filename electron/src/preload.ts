import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ucDownloads", {
  startDownload: (args: { url: string; destination: string; appid?: string; concurrency?: number }) =>
    ipcRenderer.invoke("downloads:start", args),

  cancelDownload: (args: { appid?: string; destination?: string }) =>
    ipcRenderer.invoke("downloads:cancel", args),

  onProgress: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on("downloads:progress", handler);
    return () => ipcRenderer.removeListener("downloads:progress", handler);
  },
});