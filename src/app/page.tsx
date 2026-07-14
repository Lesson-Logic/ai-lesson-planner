"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ── Blinking cursor component ─────────────────────────────────────────── */
function Cursor() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "2px",
        height: "1.1em",
        background: "var(--primary)",
        marginLeft: "2px",
        verticalAlign: "text-bottom",
        animation: "blink 1s step-end infinite",
      }}
    />
  );
}

/* ── Thinking dots ─────────────────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div className="thinking-dots">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function Home() {
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [objectives, setObjectives] = useState("");

  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Clarification state
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationData, setClarificationData] = useState<{ questions: string[]; suggestions: string[] } | null>(null);
  const [clarificationResponse, setClarificationResponse] = useState("");

  // Chat Refinement state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Worksheet Generator state
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [worksheetSectionText, setWorksheetSectionText] = useState("");
  const [generatedWorksheetContent, setGeneratedWorksheetContent] = useState("");
  const [generatingWorksheet, setGeneratingWorksheet] = useState(false);
  const [worksheetError, setWorksheetError] = useState<string | null>(null);

  // streaming state
  const [streaming, setStreaming] = useState(false);     // first token not yet arrived
  const [thinking, setThinking] = useState(false);       // waiting for first token
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [chatMessages, result]);

  const handleSelectHistory = (item: any) => {
    setGrade(item.grade);
    setSubject(item.subject);
    setObjectives(item.objectives);
    setSelectedHistoryId(item.id);
    setError(null);

    if (item.messages && item.messages.length > 0) {
      setChatMessages(item.messages);
      const lastAssistant = [...item.messages].reverse().find(x => x.role === "assistant");
      setResult(lastAssistant ? lastAssistant.content : item.result);
    } else {
      const initialMsgs = [
        { role: "user" as const, content: `Grade: ${item.grade}\nSubject: ${item.subject}\nObjectives: ${item.objectives}` },
        { role: "assistant" as const, content: item.result }
      ];
      setChatMessages(initialMsgs);
      setResult(item.result);
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this lesson plan from history?")) return;

    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory(prev => prev.filter(item => item.id !== id));
        if (selectedHistoryId === id) {
          setSelectedHistoryId(null);
          setResult(null);
          setChatMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent, isClarifying: boolean = false, messagesToSend?: any[]) => {
    if (e) e.preventDefault();
    setStreaming(true);
    setThinking(true);
    setError(null);

    const isFollowUp = messagesToSend && messagesToSend.length > 0;
    if (!isFollowUp && !isClarifying) {
      setResult(null);
      setSelectedHistoryId(null);
      setChatMessages([]);
    }

    try {
      const payload: any = { grade, subject, objectives };
      if (isClarifying) {
        payload.clarified = true;
        payload.clarification = clarificationResponse;
      }

      if (isFollowUp) {
        payload.messages = messagesToSend;
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Check if clarification is required
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const json = await response.json();
        if (json.clarificationRequired) {
          setStreaming(false);
          setThinking(false);
          setClarificationData(json);
          setShowClarification(true);
          return;
        }
      }

      if (!response.ok) {
        let errorMessage = "Failed to generate lesson plan";
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (_) { }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error("No response body returned from API");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulated = "";

      if (isFollowUp) {
        setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          // First chunk arrived — hide thinking dots
          if (thinking) setThinking(false);
          accumulated += decoder.decode(value, { stream: true });
          setResult(accumulated);

          if (isFollowUp) {
            setChatMessages(prev => {
              const updated = [...prev];
              if (updated.length > 0) {
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
              }
              return updated;
            });
          }
        }
      }

      // Hide clarification window on success
      if (isClarifying) {
        setShowClarification(false);
        setClarificationResponse("");
      }

      // Construct final messages to save
      let finalMessagesList: any[] = [];
      if (isFollowUp) {
        finalMessagesList = [...messagesToSend, { role: "assistant", content: accumulated }];
      } else {
        const userPrompt = isClarifying && clarificationResponse
          ? `Grade: ${grade}\nSubject: ${subject}\nObjectives: ${objectives} (Clarification: ${clarificationResponse})`
          : `Grade: ${grade}\nSubject: ${subject}\nObjectives: ${objectives}`;
        finalMessagesList = [
          { role: "user", content: userPrompt },
          { role: "assistant", content: accumulated }
        ];
        setChatMessages(finalMessagesList);
      }

      // Save to history after successful stream
      if (accumulated.trim()) {
        try {
          const finalObjectives = isClarifying && clarificationResponse
            ? `${objectives} (Clarification: ${clarificationResponse})`
            : objectives;
          const saveRes = await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: selectedHistoryId || undefined,
              grade,
              subject,
              objectives: finalObjectives,
              result: accumulated,
              messages: finalMessagesList
            })
          });
          if (saveRes.ok) {
            const saveJson = await saveRes.json();
            setHistory(prev => {
              const filtered = prev.filter(item => item.id !== saveJson.item.id);
              return [saveJson.item, ...filtered];
            });
            setSelectedHistoryId(saveJson.item.id);
          }
        } catch (saveErr) {
          console.error("Failed to save to history:", saveErr);
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setStreaming(false);
      setThinking(false);
    }
  };

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || streaming) return;

    const userFollowUpText = chatInput.trim();
    setChatInput("");

    const updatedMessages = [...chatMessages, { role: "user" as const, content: userFollowUpText }];
    setChatMessages(updatedMessages);

    await handleSubmit(undefined as any, false, updatedMessages);
  };

  const handleGenerateWorksheet = async (sectionText: string) => {
    setShowWorksheetModal(true);
    setGeneratingWorksheet(true);
    setGeneratedWorksheetContent("");
    setWorksheetError(null);
    setWorksheetSectionText(sectionText);

    try {
      const response = await fetch("/api/generate-worksheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionText, grade, subject }),
      });

      if (!response.ok) {
        let errMsg = "Failed to generate worksheet";
        try {
          const errorData = await response.json();
          if (errorData.error) errMsg = errorData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      if (!response.body) throw new Error("No response body returned from API");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          accumulated += decoder.decode(value, { stream: true });
          setGeneratedWorksheetContent(accumulated);
        }
      }
    } catch (err: any) {
      setWorksheetError(err.message || "An unexpected error occurred");
    } finally {
      setGeneratingWorksheet(false);
    }
  };

  const hasOutput = result !== null || thinking || error;

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .thinking-dots {
          display: flex;
          gap: 5px;
          align-items: center;
          padding: 4px 0;
        }
        .thinking-dots span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary);
          animation: dot-bounce 1.2s ease-in-out infinite;
        }
        .thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
        .thinking-dots span:nth-child(3) { animation-delay: 0.3s; }

        .chat-bubble {
          animation: fadeSlideIn 0.25s ease forwards;
        }
        .markdown-body h1 { font-size: 1.4rem; font-weight: 700; margin: 1.2em 0 0.4em; }
        .markdown-body h2 { font-size: 1.15rem; font-weight: 700; margin: 1em 0 0.3em; color: var(--primary); }
        .markdown-body h3 { font-size: 1rem; font-weight: 600; margin: 0.8em 0 0.2em; }
        .markdown-body ul  { padding-left: 1.25rem; margin: 0.4em 0; }
        .markdown-body li  { margin-bottom: 0.25em; line-height: 1.6; }
        .markdown-body hr  { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
        .markdown-body strong { font-weight: 600; }
        .markdown-body em    { font-style: italic; }
        .markdown-body p  { margin-bottom: 0.6em; line-height: 1.7; }

        /* History Sidebar Styles */
        .sidebar-item {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: all 0.2s ease;
          border-left: 4px solid transparent;
        }
        .sidebar-item:hover {
          background: rgba(99, 102, 241, 0.08);
        }
        .sidebar-item.active {
          background: rgba(99, 102, 241, 0.12);
          border-left-color: var(--primary);
        }
        .sidebar-delete-btn {
          opacity: 0;
          color: #ef4444;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sidebar-item:hover .sidebar-delete-btn {
          opacity: 0.7;
        }
        .sidebar-item:hover .sidebar-delete-btn:hover {
          opacity: 1;
          background: rgba(239, 68, 68, 0.1);
        }
        .sidebar-toggle-btn {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          color: var(--foreground);
          transition: all 0.2s;
        }
        .sidebar-toggle-btn:hover {
          background: rgba(99, 102, 241, 0.08);
        }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
        {/* Collapsible History Sidebar */}
        <aside
          style={{
            width: sidebarOpen ? "280px" : "0px",
            minWidth: sidebarOpen ? "280px" : "0px",
            background: "var(--surface)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "1.5rem 1rem", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--foreground)" }}>Saved Plans</h2>
            <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "2px" }}>Select or delete past queries</p>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {history.length === 0 ? (
              <div style={{ padding: "2rem 1rem", textAlign: "center", opacity: 0.4, fontSize: "0.85rem" }}>
                No saved plans yet.
              </div>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelectHistory(item)}
                  className={`sidebar-item ${selectedHistoryId === item.id ? "active" : ""}`}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.grade} - {item.subject}
                    </div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginTop: "4px" }}>
                      {item.objectives}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteHistory(e, item.id)}
                    className="sidebar-delete-btn"
                    title="Delete plan"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Work Area */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <main style={{ padding: "3rem 2rem", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
            {/* Top Navigation Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
              <button
                onClick={() => setSidebarOpen(prev => !prev)}
                className="sidebar-toggle-btn"
              >
                {sidebarOpen ? "◀ Hide History" : "▶ Show History"}
              </button>

              <button
                onClick={() => {
                  setGrade("");
                  setSubject("");
                  setObjectives("");
                  setResult(null);
                  setSelectedHistoryId(null);
                  setError(null);
                }}
                className="sidebar-toggle-btn"
                style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              >
                ➕ New Plan
              </button>
            </div>

            {/* Header */}
            <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <h1
                style={{
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  marginBottom: "0.75rem",
                  background: "linear-gradient(to right, var(--primary), #a855f7)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI Lesson Planner
              </h1>
              <p style={{ color: "var(--foreground)", opacity: 0.7, fontSize: "1.05rem" }}>
                Generate comprehensive lesson plans and differentiated worksheets in seconds.
              </p>
            </header>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem", alignItems: "start" }}>
              {/* ── Left panel: form ── */}
              <section className="glass-panel">
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1.5rem" }}>Lesson Details</h2>
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="grade">Grade Level</label>
                    <input
                      id="grade"
                      type="text"
                      className="input-field"
                      placeholder="e.g. 5th Grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      required
                      disabled={streaming}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="subject">Subject</label>
                    <input
                      id="subject"
                      type="text"
                      className="input-field"
                      placeholder="e.g. Science"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      disabled={streaming}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="objectives">Learning Objectives</label>
                    <textarea
                      id="objectives"
                      className="input-field"
                      placeholder="e.g. Understand the water cycle and its impact on weather patterns"
                      rows={4}
                      value={objectives}
                      onChange={(e) => setObjectives(e.target.value)}
                      required
                      style={{ resize: "vertical" }}
                      disabled={streaming}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    disabled={streaming}
                  >
                    {streaming ? (
                      <>
                        <span style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                        Generating…
                      </>
                    ) : (
                      "Generate Lesson Plan"
                    )}
                  </button>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </form>

                {error && (
                  <div
                    style={{
                      marginTop: "1rem",
                      color: "#ef4444",
                      padding: "1rem",
                      backgroundColor: "rgba(239,68,68,0.08)",
                      borderRadius: "8px",
                      fontSize: "0.9rem",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    ⚠ {error}
                  </div>
                )}
              </section>

              {/* ── Right panel: chat-style output ── */}
              <section className="glass-panel" style={{ display: "flex", flexDirection: "column", minHeight: "500px" }}>
                {/* Panel header */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--primary), #a855f7)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.9rem",
                      flexShrink: 0,
                    }}
                  >
                    🎓
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>AI Lesson Planner</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>
                      {streaming ? (
                        <span style={{ color: "var(--primary)" }}>● responding…</span>
                      ) : result ? (
                        "● done"
                      ) : (
                        "○ ready"
                      )}
                    </div>
                  </div>
                </div>

                {/* Message area */}
                <div
                  ref={outputRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    padding: "1.25rem",
                    maxHeight: "560px",
                    scrollBehavior: "smooth",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {!chatMessages || chatMessages.length === 0 ? (
                    <div
                      style={{
                        height: "100%",
                        minHeight: 200,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.75rem",
                        opacity: 0.4,
                        textAlign: "center",
                        margin: "auto",
                      }}
                    >
                      <div style={{ fontSize: "2.5rem" }}>✏️</div>
                      <p style={{ fontSize: "0.9rem" }}>
                        Fill out the details on the left
                        <br />
                        and click <strong>Generate</strong> to see your lesson plan here.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                      {chatMessages.map((msg, index) => {
                        const isUser = msg.role === "user";
                        const isLast = index === chatMessages.length - 1;

                        return (
                          <div
                            key={index}
                            className="chat-bubble"
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "10px",
                              flexDirection: isUser ? "row-reverse" : "row",
                            }}
                          >
                            {/* Avatar */}
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: isUser ? "linear-gradient(135deg, #a855f7, #6366f1)" : "linear-gradient(135deg, var(--primary), #a855f7)",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.75rem",
                                marginTop: 4,
                                color: "#ffffff",
                                userSelect: "none",
                              }}
                            >
                              {isUser ? "👤" : "🎓"}
                            </div>

                            {/* Content bubble */}
                            <div
                              style={{
                                background: isUser ? "rgba(99, 102, 241, 0.08)" : "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: isUser ? "12px 0 12px 12px" : "0 12px 12px 12px",
                                padding: "0.85rem 1.1rem",
                                maxWidth: "85%",
                                fontSize: "0.9rem",
                                lineHeight: 1.7,
                                overflowWrap: "break-word",
                                color: "var(--foreground)",
                              }}
                            >
                              {isUser ? (
                                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                              ) : (
                                <div className="markdown-body">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      li: ({ node, children, ...props }) => {
                                        const extractText = (n: any): string => {
                                          if (!n) return "";
                                          if (typeof n === "string") return n;
                                          if (Array.isArray(n)) return n.map(extractText).join("");
                                          if (n.props && n.props.children) return extractText(n.props.children);
                                          return "";
                                        };
                                        const text = extractText(children);

                                        // Replaces [TODO], [Verbal Q&A], and [Worksheet Task] tags with styled badges
                                        const cleanChildren = React.Children.map(children, (child) => {
                                          if (typeof child === "string") {
                                            let modified = child;
                                            if (modified.includes("[TODO]")) {
                                              const parts = modified.split("[TODO]");
                                              return (
                                                <>
                                                  {parts[0]}
                                                  <span style={{ display: "inline-block", background: "rgba(99, 102, 241, 0.15)", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", marginRight: "6px", verticalAlign: "middle" }}>TODO</span>
                                                  {parts[1]}
                                                </>
                                              );
                                            }
                                            if (modified.includes("[Verbal Q&A]")) {
                                              const parts = modified.split("[Verbal Q&A]");
                                              return (
                                                <>
                                                  {parts[0]}
                                                  <span style={{ display: "inline-block", background: "rgba(34, 197, 94, 0.12)", color: "#22c55e", fontSize: "0.725rem", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", marginRight: "6px", verticalAlign: "middle" }}>🗣️ Verbal Q&A</span>
                                                  {parts[1]}
                                                </>
                                              );
                                            }
                                            if (modified.includes("[Worksheet Task]")) {
                                              const parts = modified.split("[Worksheet Task]");
                                              return (
                                                <>
                                                  {parts[0]}
                                                  <span style={{ display: "inline-block", background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", fontSize: "0.725rem", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", marginRight: "6px", verticalAlign: "middle" }}>📄 Worksheet Task</span>
                                                  {parts[1]}
                                                </>
                                              );
                                            }
                                          }
                                          return child;
                                        });

                                        const isStep = /^(Hook|Instruction|Guided Practice|Independent Practice|Closure|Beginner|Intermediate|Advanced)\s*[-–]/i.test(text);

                                        let icon = null;
                                        let customStyle = {};

                                        if (text.includes("[TODO]")) {
                                          icon = <span style={{ color: "var(--primary)", fontSize: "1.1rem", lineHeight: "1.2", cursor: "default", userSelect: "none" }}>☑</span>;
                                          customStyle = { listStyleType: "none", display: "flex", alignItems: "flex-start", gap: "8px", margin: "6px 0" };
                                        } else if (text.includes("Physical Props:") || text.startsWith("Physical Props:")) {
                                          icon = <span style={{ color: "#eab308", fontSize: "1.1rem", lineHeight: "1.2", userSelect: "none" }}>📦</span>;
                                          customStyle = { listStyleType: "none", display: "flex", alignItems: "flex-start", gap: "8px", margin: "6px 0" };
                                        }

                                        const innerContent = (
                                          <div style={{ flex: 1 }}>
                                            <div>{cleanChildren}</div>
                                            {isStep && !streaming && (
                                              <div style={{ marginTop: "6px" }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleGenerateWorksheet(text)}
                                                  style={{
                                                    fontSize: "0.725rem",
                                                    padding: "3px 8px",
                                                    background: "rgba(168, 85, 247, 0.08)",
                                                    border: "1px solid rgba(168, 85, 247, 0.2)",
                                                    color: "#a855f7",
                                                    borderRadius: "6px",
                                                    cursor: "pointer",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "4px"
                                                  }}
                                                >
                                                  ✨ Magic AI Worksheet
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );

                                        if (icon) {
                                          return (
                                            <li style={customStyle} {...props}>
                                              {icon}
                                              {innerContent}
                                            </li>
                                          );
                                        }

                                        return (
                                          <li style={{ margin: "4px 0" }} {...props}>
                                            {innerContent}
                                          </li>
                                        );
                                      }
                                    }}
                                  >
                                    {msg.content || (isLast && thinking ? "" : "...")}
                                  </ReactMarkdown>
                                  {isLast && streaming && <Cursor />}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Thinking dots — only when thinking but first chunk not arrived yet */}
                      {thinking && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
                        <div className="chat-bubble" style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, var(--primary), #a855f7)",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              marginTop: 4,
                              color: "#ffffff"
                            }}
                          >
                            🎓
                          </div>
                          <div
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "0 12px 12px 12px",
                              padding: "0.75rem 1rem",
                            }}
                          >
                            <ThinkingDots />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Chat Refinement Input Bar */}
                {chatMessages && chatMessages.length > 0 && (
                  <form
                    onSubmit={handleSendFollowUp}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "1rem",
                      padding: "0.75rem 0 0 0",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ask AI to refine the plan (e.g. 'make it more hands-on', 'simplify wording')"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={streaming}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={streaming || !chatInput.trim()}
                      style={{ padding: "0 1.25rem", whiteSpace: "nowrap" }}
                    >
                      Send
                    </button>
                  </form>
                )}
              </section>
            </div>
            {showClarification && clarificationData && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(15, 23, 42, 0.6)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 999,
                  padding: "1rem"
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    maxWidth: "500px",
                    width: "100%",
                    background: "var(--background)",
                    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.04)",
                    border: "1px solid var(--border)",
                    animation: "fadeSlideIn 0.3s ease"
                  }}
                >
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)" }}>
                    ✨ Help Clarify Your Objectives
                  </h3>
                  <p style={{ fontSize: "0.875rem", opacity: 0.8, marginBottom: "1rem" }}>
                    To design a truly custom lesson plan, the AI needs a bit more details.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                    {clarificationData.questions && clarificationData.questions.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.6, marginBottom: "0.25rem" }}>
                          Clarifying Questions:
                        </div>
                        <ul style={{ paddingLeft: "1.2rem", fontSize: "0.875rem", color: "var(--foreground)" }}>
                          {clarificationData.questions.map((q, idx) => (
                            <li key={idx} style={{ marginBottom: "0.25rem" }}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {clarificationData.suggestions && clarificationData.suggestions.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.6, marginBottom: "0.25rem" }}>
                          Suggestions:
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                          {clarificationData.suggestions.map((s, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setClarificationResponse(prev => {
                                  const trimmed = prev.trim();
                                  return trimmed ? `${trimmed} ${s}` : s;
                                });
                              }}
                              style={{
                                background: "rgba(99, 102, 241, 0.1)",
                                border: "1px solid rgba(99, 102, 241, 0.2)",
                                color: "var(--primary)",
                                fontSize: "0.775rem",
                                fontWeight: 500,
                                padding: "4px 10px",
                                borderRadius: "20px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="clarificationResponse">Your Answer:</label>
                      <textarea
                        id="clarificationResponse"
                        className="input-field"
                        placeholder="e.g. Focus on single digit addition using visual tools like blocks."
                        rows={3}
                        value={clarificationResponse}
                        onChange={(e) => setClarificationResponse(e.target.value)}
                        style={{ resize: "none" }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowClarification(false);
                        setClarificationResponse("");
                        setStreaming(false);
                        setThinking(false);
                      }}
                      className="sidebar-toggle-btn"
                      style={{ opacity: 0.7 }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSubmit(undefined as any, true)}
                      className="btn-primary"
                      disabled={!clarificationResponse.trim()}
                    >
                      Confirm & Generate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showWorksheetModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(15, 23, 42, 0.6)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 999,
                  padding: "1rem"
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    maxWidth: "700px",
                    width: "100%",
                    maxHeight: "90vh",
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--background)",
                    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.04)",
                    border: "1px solid var(--border)",
                    animation: "fadeSlideIn 0.3s ease",
                    padding: "1.5rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1rem" }}>
                    <div>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#a855f7", display: "flex", alignItems: "center", gap: "6px" }}>
                        ✨ Magic AI Worksheet
                      </h3>
                      <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>Generated specifically for this section</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWorksheetModal(false);
                        setGeneratedWorksheetContent("");
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        color: "var(--foreground)",
                        opacity: 0.5
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "1.25rem",
                      fontSize: "0.9rem",
                      lineHeight: 1.7,
                      marginBottom: "1rem"
                    }}
                  >
                    {generatingWorksheet && !generatedWorksheetContent && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px", opacity: 0.5 }}>
                        <ThinkingDots />
                        <p style={{ fontSize: "0.85rem" }}>AI is crafting your worksheet...</p>
                      </div>
                    )}

                    {worksheetError && (
                      <div style={{ color: "#ef4444", padding: "1rem", background: "rgba(239, 68, 68, 0.08)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
                        ⚠ {worksheetError}
                      </div>
                    )}

                    {generatedWorksheetContent && (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {generatedWorksheetContent}
                        </ReactMarkdown>
                        {generatingWorksheet && <Cursor />}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWorksheetModal(false);
                        setGeneratedWorksheetContent("");
                      }}
                      className="sidebar-toggle-btn"
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedWorksheetContent);
                        alert("Worksheet copied to clipboard!");
                      }}
                      className="btn-primary"
                      disabled={!generatedWorksheetContent}
                      style={{ background: "#a855f7" }}
                    >
                      📋 Copy Worksheet
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
