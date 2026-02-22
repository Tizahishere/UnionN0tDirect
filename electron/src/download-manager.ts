import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import got from "got";
import { URL } from "url";

const pipe = promisify(pipeline);

export type DownloadProgress = {
  appid?: string;
  url: string;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  status: "running" | "paused" | "cancelled" | "finished" | "failed";
  error?: string;
};

export type DownloadTaskOptions = {
  url: string;
  destination: string;
  appid?: string;
  concurrency?: number;
  minChunkSize?: number;
  onProgress?: (p: DownloadProgress) => void;
};

type Chunk = {
  index: number;
  start: number;
  end: number;
};

export default class DownloadManager extends EventEmitter {
  private tasks = new Map<string, AbortController[]>();

  async startTask(opts: DownloadTaskOptions) {
    const { url, destination, appid } = opts;
    const id = appid || destination;
    if (this.tasks.has(id)) return { ok: false, error: "Task already running" };
    this.tasks.set(id, []);
    try {
      await this.downloadWithSegments(opts);
      this.tasks.delete(id);
      return { ok: true };
    } catch (err: any) {
      this.tasks.delete(id);
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async cancelTask(id: string) {
    const controllers = this.tasks.get(id);
    if (controllers) {
      for (const c of controllers) c.abort();
      this.tasks.delete(id);
    }
  }

  private async downloadWithSegments(opts: DownloadTaskOptions) {
    const { url, destination, appid, concurrency = 6, minChunkSize = 2 * 1024 * 1024, onProgress } = opts;
    new URL(url);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });

    let totalBytes: number | null = null;
    let acceptRanges = false;

    try {
      const head = await got.head(url);
      totalBytes = head.headers["content-length"] ? Number(head.headers["content-length"]) : null;
      acceptRanges = (head.headers["accept-ranges"] || "").includes("bytes");
    } catch {}

    if (!acceptRanges || !totalBytes || totalBytes <= minChunkSize) {
      return this.singleStreamDownload(opts);
    }

    const fd = await fs.promises.open(destination, "w");
    await fd.truncate(totalBytes);
    await fd.close();

    const chunkCount = Math.min(concurrency, Math.ceil(totalBytes / minChunkSize));
    const chunkSize = Math.floor(totalBytes / chunkCount);
    const chunks: Chunk[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = i === chunkCount - 1 ? totalBytes - 1 : (i + 1) * chunkSize - 1;
      chunks.push({ index: i, start, end });
    }

    let downloadedBytes = 0;
    const id = appid || destination;
    const controllers: AbortController[] = [];
    this.tasks.set(id, controllers);

    const update = (status: DownloadProgress["status"], error?: string) => {
      const percent = totalBytes ? (downloadedBytes / totalBytes) * 100 : null;
      const payload: DownloadProgress = {
        appid,
        url,
        downloadedBytes,
        totalBytes,
        percent,
        status,
        error,
      };
      onProgress?.(payload);
      this.emit("progress", payload);
    };

    const runChunk = async (chunk: Chunk) => {
      const controller = new AbortController();
      controllers.push(controller);
      const headers = { Range: `bytes=${chunk.start}-${chunk.end}` };
      const resp = got.stream(url, { headers, signal: controller.signal });
      const ws = fs.createWriteStream(destination, { flags: "r+", start: chunk.start });

      resp.on("data", (b: Buffer) => {
        downloadedBytes += b.length;
        update("running");
      });

      await pipe(resp, ws);
    };

    await Promise.all(chunks.map(runChunk));
    update("finished");
  }

  private async singleStreamDownload(opts: DownloadTaskOptions) {
    const { url, destination, appid, onProgress } = opts;
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    const controller = new AbortController();
    const id = appid || destination;
    this.tasks.set(id, [controller]);

    let downloadedBytes = 0;
    let totalBytes: number | null = null;

    const resp = got.stream(url, { signal: controller.signal });
    resp.on("response", (r) => {
      totalBytes = r.headers["content-length"] ? Number(r.headers["content-length"]) : null;
    });

    resp.on("data", (b: Buffer) => {
      downloadedBytes += b.length;
      const percent = totalBytes ? (downloadedBytes / totalBytes) * 100 : null;
      const payload: DownloadProgress = {
        appid,
        url,
        downloadedBytes,
        totalBytes,
        percent,
        status: "running",
      };
      onProgress?.(payload);
      this.emit("progress", payload);
    });

    await pipe(resp, fs.createWriteStream(destination));
    this.emit("progress", {
      appid,
      url,
      downloadedBytes,
      totalBytes,
      percent: 100,
      status: "finished",
    });
  }
}