import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000";

function App() {
  const [file, setFile] = useState(null);
  const [standards, setStandards] = useState({});
  const [selected, setSelected] = useState([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStandards();
  }, []);

  const fetchStandards = async () => {
    try {
      const res = await fetch(`${API_BASE}/standards`);
      const data = await res.json();
      setStandards(data || {});
    } catch (e) {
      console.error(e);
    }
  };

  const uploadFile = async (e) => {
    e.preventDefault();
    if (!file) return alert("Choose a file first");

    const fd = new FormData();
    fd.append("standardFile", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        setFile(null);
        await fetchStandards();
        alert(`Uploaded ${data.filename}`);
      } else {
        alert("Upload failed: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error(err);
      alert("Upload error");
    }
  };

  const toggle = (name) => {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const summarize = async () => {
    if (selected.length === 0) return alert("Select at least one standard");
    setLoading(true);
    setSummary("");
    try {
      const res = await fetch(`${API_BASE}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedStandards: selected, prompt: "Summarize key points in plain language." })
      });
      const data = await res.json();
      if (res.ok) setSummary(data.summary || JSON.stringify(data.raw));
      else setSummary("Error: " + (data.error || JSON.stringify(data)));
    } catch (err) {
      console.error(err);
      setSummary("Error summarizing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Standards Summarizer (Demo)</h1>

      <form onSubmit={uploadFile} style={{ marginBottom: 20 }}>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button type="submit" style={{ marginLeft: 8 }}>Upload Standard</button>
      </form>

      <h3>Available Standards</h3>
      <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #ddd", padding: 8 }}>
        {Object.keys(standards).length === 0 && <div style={{ color: "#777" }}>No standards uploaded yet</div>}
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {Object.entries(standards).map(([name, uri]) => (
            <li key={name} style={{ marginBottom: 6 }}>
              <label>
                <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
                <strong style={{ marginLeft: 8 }}>{name}</strong>
                <div style={{ fontSize: 12, color: "#666" }}>{uri}</div>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={summarize} disabled={loading}>
          {loading ? "Summarizing..." : "Summarize Selected Standards"}
        </button>
      </div>

      {summary && (
        <div style={{ marginTop: 20 }}>
          <h3>Summary</h3>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12 }}>{summary}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
