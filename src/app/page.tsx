"use client";

import { useState } from "react";

export default function Home() {
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [objectives, setObjectives] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grade, subject, objectives }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate lesson plan";
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error("No response body returned from API");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let streamedResult = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          streamedResult += decoder.decode(value, { stream: true });
          setResult(streamedResult);
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "4rem 2rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "1rem", background: "linear-gradient(to right, var(--primary), #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI Lesson Planner</h1>
        <p style={{ color: "var(--foreground)", opacity: 0.8, fontSize: "1.1rem" }}>Generate comprehensive lesson plans and differentiated worksheets in seconds.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
        <section className="glass-panel">
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Lesson Details</h2>
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
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Generating..." : "Generate Lesson Plan"}
            </button>
          </form>
          {error && (
            <div style={{ marginTop: "1rem", color: "#ef4444", padding: "1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "8px" }}>
              {error}
            </div>
          )}
        </section>

        <section className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Generated Result</h2>
          <div style={{ flex: 1, backgroundColor: "var(--background)", borderRadius: "8px", border: "1px solid var(--border)", padding: "1.5rem", overflowY: "auto", maxHeight: "600px", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {result ? (
              <div>{result}</div>
            ) : loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", opacity: 0.5 }}>
                Generating your personalized lesson plan...
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", opacity: 0.5, textAlign: "center" }}>
                Fill out the details on the left and click Generate to see your lesson plan here.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
