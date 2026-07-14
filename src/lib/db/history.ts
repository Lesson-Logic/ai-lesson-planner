import fs from "fs";
import path from "path";

export interface HistoryItem {
  id: string;
  grade: string;
  subject: string;
  objectives: string;
  result: string;
  createdAt: string;
}

// Store the history file in the workspace's src/lib/db folder
const HISTORY_FILE_PATH = path.join(process.cwd(), "src/lib/db/history.json");

// Ensure the file exists
function ensureFileExists() {
  const dir = path.dirname(HISTORY_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE_PATH)) {
    fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify([], null, 2), "utf8");
  }
}

export function getHistory(): HistoryItem[] {
  try {
    ensureFileExists();
    const fileData = fs.readFileSync(HISTORY_FILE_PATH, "utf8");
    const items: HistoryItem[] = JSON.parse(fileData);
    // Sort by newest first
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Failed to read history:", error);
    return [];
  }
}

export function saveHistoryItem(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem {
  ensureFileExists();
  const items = getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    createdAt: new Date().toISOString()
  };
  items.unshift(newItem); // Add to beginning
  fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(items, null, 2), "utf8");
  return newItem;
}

export function getHistoryItemById(id: string): HistoryItem | null {
  const items = getHistory();
  return items.find(item => item.id === id) || null;
}

export function deleteHistoryItem(id: string): boolean {
  ensureFileExists();
  const items = getHistory();
  const initialLength = items.length;
  const filteredItems = items.filter(item => item.id !== id);
  if (filteredItems.length === initialLength) return false;
  fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(filteredItems, null, 2), "utf8");
  return true;
}
