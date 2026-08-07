import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  EMPTY_RUNTIME,
  EMPTY_STATE,
  type RuntimeState,
  type StateAdapter,
  type WatcherState,
} from "../core/types.js";

const STATE_DIR = path.resolve("state");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const RUNTIME_FILE = path.join(STATE_DIR, "runtime.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

export function fsStateAdapter(): StateAdapter {
  return {
    loadState: () => readJson<WatcherState>(STATE_FILE, EMPTY_STATE),
    saveState: (s) => writeJsonAtomic(STATE_FILE, s),
    loadRuntime: () => readJson<RuntimeState>(RUNTIME_FILE, EMPTY_RUNTIME),
    saveRuntime: (s) => writeJsonAtomic(RUNTIME_FILE, s),
  };
}
