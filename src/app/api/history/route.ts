import { NextResponse } from "next/server";
import { getHistory, saveHistoryItem, deleteHistoryItem } from "@/lib/db/history";

export async function GET() {
  try {
    const history = getHistory();
    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load history" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, grade, subject, objectives, result, messages } = body;

    if (!grade || !subject || !objectives || !result) {
      return NextResponse.json(
        { error: "Missing required fields: grade, subject, objectives, or result" },
        { status: 400 }
      );
    }

    const saved = saveHistoryItem({ id, grade, subject, objectives, result, messages });
    return NextResponse.json({ item: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save history" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing required query parameter: id" }, { status: 400 });
    }

    const success = deleteHistoryItem(id);
    if (!success) {
      return NextResponse.json({ error: "History item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete history item" }, { status: 500 });
  }
}
