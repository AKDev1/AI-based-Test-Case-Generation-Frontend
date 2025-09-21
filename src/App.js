// frontend/src/App.js
import React, { useEffect, useState } from "react";
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

function App() {
  const [stdFile, setStdFile] = useState(null);
  const [reqFile, setReqFile] = useState(null);

  const [standards, setStandards] = useState({});
  const [requirements, setRequirements] = useState({});

  const [selectedStandards, setSelectedStandards] = useState([]);
  const [selectedRequirements, setSelectedRequirements] = useState([]);

  const [promptOverride, setPromptOverride] = useState("");

  const [generationResults, setGenerationResults] = useState([]); // results summary from POST /testcases
  const [currentReqView, setCurrentReqView] = useState(null); // { id, title, testcases: [] }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStandards();
    fetchRequirements();
    fetchGeneratedSummary();
  }, []);

  async function fetchStandards() {
    try {
      const res = await fetch(`${API_BASE}/standards`);
      const data = await res.json();
      setStandards(data || {});
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchRequirements() {
    try {
      const res = await fetch(`${API_BASE}/requirements`);
      const data = await res.json();
      setRequirements(data || {});
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchGeneratedSummary() {
    try {
      const res = await fetch(`${API_BASE}/generated`);
      if (res.ok) {
        const data = await res.json();
        setGenerationResults(data || []);
      }
    } catch (e) {
      /* ignore */
    }
  }

  // upload standard
  async function uploadStandard(e) {
    e.preventDefault();
    if (!stdFile) return alert("Choose a standard file");
    const fd = new FormData();
    fd.append("standardFile", stdFile);
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        alert("Standard uploaded");
        setStdFile(null);
        fetchStandards();
      } else alert("Upload failed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Upload error");
    }
  }

  // upload requirement (file)
  async function uploadRequirement(e) {
    e.preventDefault();
    if (!reqFile) return alert("Choose a requirement file");
    const fd = new FormData();
    fd.append("requirementFile", reqFile);
    try {
      const res = await fetch(`${API_BASE}/requirements/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        alert("Requirement uploaded: " + data.title);
        setReqFile(null);
        fetchRequirements();
      } else alert("Upload failed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Upload error");
    }
  }

  function toggleStandard(name) {
    setSelectedStandards((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }
  function toggleRequirement(id) {
    setSelectedRequirements((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // generate testcases for selected requirements
  async function generateTestcases() {
    if (selectedRequirements.length === 0)
      return alert("Select at least one requirement");
    if (selectedStandards.length === 0)
      return alert("Select at least one standard");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/testcases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedRequirements,
          selectedStandards,
          promptOverride: promptOverride || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Testcases generated");
        // refresh authoritative summary from server (avoid mixing result shapes)
        await fetchGeneratedSummary();
        // clear any stale current view if it points to a different requirement (optional)
        // setCurrentReqView(null);
        setGenerationResults((prev) => [
          ...(Array.isArray(data.results) ? data.results : []),
          ...prev,
        ]);
      } else {
        alert("Generation failed: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error(err);
      alert("Generation error");
    } finally {
      setLoading(false);
    }
  }

  // view testcases for a requirement
  async function viewTestcasesFor(reqId) {
    try {
      const res = await fetch(
        `${API_BASE}/generated/requirement/${encodeURIComponent(reqId)}`
      );
      const data = await res.json();
      if (res.ok) {
        setCurrentReqView({
          id: data.requirementId,
          genId: data.id,
          title: data.requirementTitle,
          testcases: data.testcases,
        });
        // scroll into view
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      } else {
        alert("No testcases: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error(err);
      alert("Error loading testcases");
    }
  }

  // regenerate single testcase
  async function regenerateSingle(genId, tcId) {
    if (!window.confirm("Regenerate this testcase?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(
          genId
        )}/regenerate/${encodeURIComponent(tcId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Regenerated");
        // refresh current view if it matches
        if (currentReqView && currentReqView.id === data.testcase.req_id) {
          viewTestcasesFor(currentReqView.id);
        } else {
          fetchGeneratedSummary();
        }
      } else alert("Regenerate failed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Error regenerating");
    }
  }

  // save edits to testcase (PATCH)
  async function saveTestcase(genId, tc) {
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(
          genId
        )}/${encodeURIComponent(tc.tc_id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tc),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Saved");
        // refresh view
        if (currentReqView && currentReqView.id === tc.req_id)
          viewTestcasesFor(currentReqView.id);
      } else alert("Save failed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Error saving");
    }
  }

  // create jira for testcase
  async function createJira(genId, tcId) {
    const projectKey = prompt(
      "Enter Jira project key (leave blank to use default):"
    );
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(
          genId
        )}/${encodeURIComponent(tcId)}/jira`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectKey }),
        }
      );
      const data = await res.json();
      if (res.ok) alert("Jira created: " + JSON.stringify(data.jira));
      else alert("Jira create failed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Jira create error");
    }
  }

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <h1>AI Testcase Generator — Requirements as Files</h1>

      <section
        style={{ border: "1px solid #eee", padding: 12, marginBottom: 12 }}
      >
        <h3>Upload Standard</h3>
        <form onSubmit={uploadStandard}>
          <input type="file" onChange={(e) => setStdFile(e.target.files[0])} />
          <button type="submit" style={{ marginLeft: 8 }}>
            Upload Standard
          </button>
        </form>
      </section>

      <section
        style={{ border: "1px solid #eee", padding: 12, marginBottom: 12 }}
      >
        <h3>Upload Requirement (file)</h3>
        <form onSubmit={uploadRequirement}>
          <input type="file" onChange={(e) => setReqFile(e.target.files[0])} />
          <button type="submit" style={{ marginLeft: 8 }}>
            Upload Requirement
          </button>
        </form>
      </section>

      <section
        style={{ border: "1px solid #eee", padding: 12, marginBottom: 12 }}
      >
        <h3>Select Requirements & Standards</h3>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h4>Requirements</h4>
            {Object.keys(requirements).length === 0 && (
              <div>No requirements uploaded</div>
            )}
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {Object.entries(requirements).map(([id, r]) => (
                <li key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedRequirements.includes(id)}
                      onChange={() => toggleRequirement(id)}
                    />
                    <strong style={{ marginLeft: 8 }}>{r.title}</strong>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {r.fileUri}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ flex: 1 }}>
            <h4>Standards</h4>
            {Object.keys(standards).length === 0 && (
              <div>No standards uploaded</div>
            )}
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {Object.entries(standards).map(([name, uri]) => (
                <li key={name}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedStandards.includes(name)}
                      onChange={() => toggleStandard(name)}
                    />
                    <strong style={{ marginLeft: 8 }}>{name}</strong>
                    <div style={{ fontSize: 12, color: "#666" }}>{uri}</div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <h4>Prompt (editable) — optional</h4>
          <textarea
            rows={4}
            value={promptOverride}
            onChange={(e) => setPromptOverride(e.target.value)}
            style={{ width: "100%" }}
            placeholder="Optional prompt override (must instruct model to output only JSON)"
          ></textarea>
          <div style={{ marginTop: 8 }}>
            <button onClick={generateTestcases} disabled={loading}>
              {loading ? "Generating..." : "Generate Test Cases"}
            </button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h2>Generated Requirements (click to view testcases)</h2>
        {generationResults.length === 0 && <div>No generated sets yet</div>}
        <ul>
          {generationResults.map((r) => {
            const reqIdForClick = r.requirementId; // prioritize requirementId, then req_id, fallback to id
            const genId = r.id;
            const title =
              r.requirementTitle ||
              r.title ||
              r.requirementId ||
              r.req_id ||
              r.id;
            const count = r.count || (r.testcases && r.testcases.length);
            return (
              <li key={r.id || r.req_id || title} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => viewTestcasesFor(genId)}
                  style={{ cursor: "pointer" }}
                >
                  {reqIdForClick} — {title}{" "}
                  {count ? `(${count} testcases)` : ""}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {currentReqView && (
        <section
          style={{ marginTop: 20, border: "1px solid #ddd", padding: 12 }}
        >
          <h2>
            Testcases for: {currentReqView.title} ({currentReqView.id})
          </h2>
          {currentReqView.testcases.length === 0 && <div>No testcases</div>}
          {currentReqView.testcases.map((tc) => (
            <TestcaseCard
              key={tc.tc_id}
              tc={tc}
              genId={
                /* find genId that contains this req id */ currentReqView.genId
              }
              onRegenerate={regenerateSingle}
              onSave={saveTestcase}
              onCreateJira={createJira}
            />
          ))}
        </section>
      )}
    </div>
  );

  // regenerateSingle wrapper for front-end: find a genId that contains the reqId (we can fetch generated summary)
  async function regenerateSingle(genId, tcId) {
    // wrapper mapping: we don't always have genId in current view; query /generated to find genId for current requirement
    const generatedSummary = await (
      await fetch(`${API_BASE}/generated`)
    ).json();
    const set = generatedSummary.find(
      (s) => s.requirementId === currentReqView.id
    );
    if (!set) return alert("Generated set not found for this requirement");
    const gid = set.id;
    // call the actual endpoint
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(
          gid
        )}/regenerate/${encodeURIComponent(tcId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Regenerated");
        viewTestcasesFor(currentReqView.id);
      } else alert("Regenerate failed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Error regenerating");
    }
  }

  async function saveTestcase(genId, tc) {
    // find genId from summary if not provided
    let gid = genId;
    if (!gid) {
      const generatedSummary = await (
        await fetch(`${API_BASE}/generated`)
      ).json();
      const set = generatedSummary.find((s) => s.requirementId === tc.req_id);
      if (!set) return alert("Generated set not found");
      gid = set.id;
    }
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(gid)}/${encodeURIComponent(
          tc.tc_id
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tc),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Saved");
        viewTestcasesFor(tc.req_id);
      } else alert("Save failed: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("Error saving");
    }
  }

  // async function createJira(genId, tc) {
  //   let gid = genId;
  //   if (!gid) {
  //     const generatedSummary = await (
  //       await fetch(`${API_BASE}/generated`)
  //     ).json();
  //     const set = generatedSummary.find((s) => s.requirementId === tc.req_id);
  //     if (!set) return alert("Generated set not found");
  //     gid = set.id;
  //   }
  //   try {
  //     const res = await fetch(
  //       `${API_BASE}/testcases/${encodeURIComponent(gid)}/${encodeURIComponent(
  //         tc.tc_id
  //       )}/jira`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({}),
  //       }
  //     );
  //     const data = await res.json();
  //     if (res.ok) alert("Jira created: " + JSON.stringify(data.jira));
  //     else alert("Jira create failed: " + JSON.stringify(data));
  //   } catch (err) {
  //     console.error(err);
  //     alert("Error creating Jira");
  //   }
  // }
}

/* TestcaseCard component for viewing/editing a testcase */
function TestcaseCard({ tc, genId, onRegenerate, onSave, onCreateJira }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState({ ...tc });

  useEffect(() => setLocal({ ...tc }), [tc]);

  return (
    <div
      style={{
        border: "1px solid #eee",
        padding: 12,
        marginBottom: 8,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "table", width: "100%" }}>
        <div style={{ display: "table-row"}}>
          {/* Left cell */}
          <div
            style={{
              display: "table-cell",
              width: "100%",
              verticalAlign: "middle",
            }}
          >
            <strong>{local.title}</strong>
            <div style={{ fontSize: 12, color: "#666" }}>ID: {local.tc_id}</div>
          </div>

          {/* Right cell */}
          <div
            style={{
              display: "table-cell",
              whiteSpace: "nowrap",
              verticalAlign: "middle",
            }}
          >
            <button
              onClick={() => onRegenerate(genId, local.tc_id)}
              style={{ marginRight: 8 }}
            >
              Regenerate
            </button>
            <button
              onClick={() => setEditing((e) => !e)}
              style={{ marginRight: 8 }}
            >
              {editing ? "Cancel" : "Edit"}
            </button>
            {local.jira_id ? (
              <a
                href={`https://healthcaregenai.atlassian.net/browse/${local.jira_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                <button type="button">{local.jira_id}</button>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onCreateJira(genId, local.tc_id)}
              >
                Create Jira
              </button>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <div style={{ marginTop: 8 }}>
          <input
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <label>Preconditions (one per line)</label>
          <textarea
            rows={2}
            value={(local.preconditions || []).join("\n")}
            onChange={(e) =>
              setLocal({ ...local, preconditions: e.target.value.split("\n") })
            }
            style={{ width: "100%" }}
          />
          <label>Steps (one per line)</label>
          <textarea
            rows={3}
            value={(local.steps || []).join("\n")}
            onChange={(e) =>
              setLocal({ ...local, steps: e.target.value.split("\n") })
            }
            style={{ width: "100%" }}
          />
          <label>Expected</label>
          <input
            value={local.expected || ""}
            onChange={(e) => setLocal({ ...local, expected: e.target.value })}
            style={{ width: "100%" }}
          />
          <label>Automatable</label>
          <select
            value={local.automatable ? "true" : "false"}
            onChange={(e) =>
              setLocal({ ...local, automatable: e.target.value === "true" })
            }
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <label>Suggested tool</label>
          <input
            value={local.suggested_tool || ""}
            onChange={(e) =>
              setLocal({ ...local, suggested_tool: e.target.value })
            }
            style={{ width: "100%" }}
          />
          <label>Confidence (0-1)</label>
          <input
            value={local.confidence}
            onChange={(e) =>
              setLocal({ ...local, confidence: parseFloat(e.target.value) })
            }
            style={{ width: 120 }}
          />
          <label>Compliance (comma separated)</label>
          <input
            value={(local.compliance || []).join(", ")}
            onChange={(e) =>
              setLocal({
                ...local,
                compliance: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            style={{ width: "100%" }}
          />
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                onSave(genId, local);
                setEditing(false);
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {local.preconditions && local.preconditions.length > 0 && (
            <>
              <div>
                <strong>Preconditions</strong>
              </div>
              <ol>
                {local.preconditions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </>
          )}
          {local.steps && local.steps.length > 0 && (
            <>
              <div>
                <strong>Steps</strong>
              </div>
              <ol>
                {local.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}
          {local.expected && (
            <div>
              <strong>Expected</strong>
              <div>{local.expected}</div>
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
            Automatable: {local.automatable ? "Yes" : "No"} — Suggested:{" "}
            {local.suggested_tool} — Confidence: {local.confidence}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
            Compliance: {(local.compliance || []).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
