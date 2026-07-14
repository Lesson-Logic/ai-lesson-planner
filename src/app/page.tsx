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
  }, [result]);

  const handleSelectHistory = (item: any) => {
    setGrade(item.grade);
    setSubject(item.subject);
    setObjectives(item.objectives);
    setResult(item.result);
    setSelectedHistoryId(item.id);
    setError(null);
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
        }
      }
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStreaming(true);
    setThinking(true);
    setError(null);
    setResult(null);
    setSelectedHistoryId(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, objectives }),
      });

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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          // First chunk arrived — hide thinking dots
          if (thinking) setThinking(false);
          accumulated += decoder.decode(value, { stream: true });
          setResult(accumulated);
        }
      }

      // Save to history after successful stream
      if (accumulated.trim()) {
        try {
          const saveRes = await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grade, subject, objectives, result: accumulated })
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
                  }}
                >
                  {!hasOutput && (
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
                      }}
                    >
                      <div style={{ fontSize: "2.5rem" }}>✏️</div>
                      <p style={{ fontSize: "0.9rem" }}>
                        Fill out the details on the left
                        <br />
                        and click <strong>Generate</strong> to see your lesson plan here.
                      </p>
                    </div>
                  )}

                  {/* Thinking dots — while waiting for first token */}
                  {thinking && !result && (
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
                          marginTop: 2,
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

                  {/* Streamed result */}
                  {result && (
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
                        }}
                      >
                        🎓
                      </div>
                      <div
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "0 12px 12px 12px",
                          padding: "1rem 1.25rem",
                          flex: 1,
                          fontSize: "0.9rem",
                          lineHeight: 1.7,
                          overflowWrap: "break-word",
                        }}
                      >
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

                                if (text.includes("[TODO]")) {
                                  const cleanChildren = React.Children.map(children, (child) => {
                                    if (typeof child === "string" && child.includes("[TODO]")) {
                                      const parts = child.split("[TODO]");
                                      return (
                                        <>
                                          {parts[0]}
                                          <span
                                            style={{
                                              display: "inline-block",
                                              background: "rgba(99, 102, 241, 0.15)",
                                              color: "var(--primary)",
                                              fontSize: "0.75rem",
                                              fontWeight: 700,
                                              padding: "2px 6px",
                                              borderRadius: "4px",
                                              marginRight: "6px",
                                              verticalAlign: "middle"
                                            }}
                                          >
                                            TODO
                                          </span>
                                          {parts[1]}
                                        </>
                                      );
                                    }
                                    return child;
                                  });

                                  return (
                                    <li style={{ listStyleType: "none", display: "flex", alignItems: "flex-start", gap: "8px", margin: "6px 0" }} {...props}>
                                      <span style={{ color: "var(--primary)", fontSize: "1.1rem", lineHeight: "1.2", cursor: "default", userSelect: "none" }}>☑</span>
                                      <div style={{ flex: 1 }}>{cleanChildren}</div>
                                    </li>
                                  );
                                }

                                if (text.includes("Physical Props:") || text.startsWith("Physical Props:")) {
                                  return (
                                    <li style={{ listStyleType: "none", display: "flex", alignItems: "flex-start", gap: "8px", margin: "6px 0" }} {...props}>
                                      <span style={{ color: "#eab308", fontSize: "1.1rem", lineHeight: "1.2", userSelect: "none" }}>📦</span>
                                      <div style={{ flex: 1 }}>{children}</div>
                                    </li>
                                  );
                                }

                                return <li {...props}>{children}</li>;
                              }
                            }}
                          >
                            {result}
                          </ReactMarkdown>
                          {streaming && <Cursor />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
