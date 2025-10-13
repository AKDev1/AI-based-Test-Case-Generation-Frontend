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

  const [generationResults, setGenerationResults] = useState([]);
  const [currentReqView, setCurrentReqView] = useState(null); // { id, title, genId, testcases: [] }
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
        await fetchGeneratedSummary();
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

  async function viewTestcasesFor(genId) {
    try {
      const res = await fetch(
        `${API_BASE}/generated/requirement/${encodeURIComponent(genId)}`
      );
      const data = await res.json();
      if (res.ok) {
        setCurrentReqView({
          id: data.requirementId,
          genId: data.id,
          title: data.requirementTitle,
          testcases: data.testcases,
        });
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      } else {
        alert("No testcases: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error(err);
      alert("Error loading testcases");
    }
  }

  async function regenerateSingle(genId, tcId) {
    // Find the latest generated set for current requirement
    const generatedSummary = await (await fetch(`${API_BASE}/generated`)).json();
    const set = generatedSummary.find((s) => s.requirementId === currentReqView.id);
    if (!set) return alert("Generated set not found for this requirement");
    const gid = set.id;
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(gid)}/regenerate/${encodeURIComponent(tcId)}`,
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
      const generatedSummary = await (await fetch(`${API_BASE}/generated`)).json();
      const set = generatedSummary.find((s) => s.requirementId === tc.req_id);
      if (!set) return alert("Generated set not found");
      gid = set.id;
    }
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(gid)}/${encodeURIComponent(tc.tc_id)}`,
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

  async function createJira(genId, tcId) {
    const projectKey = prompt("Enter Jira project key (leave blank to use default):");
    try {
      const res = await fetch(
        `${API_BASE}/testcases/${encodeURIComponent(genId)}/${encodeURIComponent(tcId)}/jira`,
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          AI Testcase Generator
        </h1>

        {/* Upload Standard */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-medium">Upload Standard</h3>
          <form onSubmit={uploadStandard} className="mt-3 flex items-center gap-3">
            <input
              type="file"
              onChange={(e) => setStdFile(e.target.files[0])}
              className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
            >
              Upload Standard
            </button>
          </form>
        </section>

        {/* Upload Requirement */}
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-medium">Upload Requirement (file)</h3>
          <form onSubmit={uploadRequirement} className="mt-3 flex items-center gap-3">
            <input
              type="file"
              onChange={(e) => setReqFile(e.target.files[0])}
              className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
            >
              Upload Requirement
            </button>
          </form>
        </section>

        {/* Selection */}
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-medium">Select Requirements & Standards</h3>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {/* Requirements */}
            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
                Requirements
              </h4>
              {Object.keys(requirements).length === 0 ? (
                <div className="text-sm text-gray-500">No requirements uploaded</div>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(requirements).map(([id, r]) => (
                    <li key={id} className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedRequirements.includes(id)}
                          onChange={() => toggleRequirement(id)}
                          className="mt-1 size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-800"
                        />
                        <div>
                          <div className="font-medium">{r.title}</div>
                          <div className="text-xs text-gray-500 break-all">{r.fileUri}</div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Standards */}
            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
                Standards
              </h4>
              {Object.keys(standards).length === 0 ? (
                <div className="text-sm text-gray-500">No standards uploaded</div>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(standards).map(([name, uri]) => (
                    <li key={name} className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStandards.includes(name)}
                          onChange={() => toggleStandard(name)}
                          className="mt-1 size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-800"
                        />
                        <div>
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-gray-500 break-all">{uri}</div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Prompt + CTA */}
          <div className="mt-4">
            <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-600">
              Prompt (editable) — optional
            </h4>
            <textarea
              rows={4}
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
              placeholder="Optional prompt override (must instruct model to output only JSON)"
            ></textarea>

            <div className="mt-3">
              <button
                onClick={generateTestcases}
                disabled={loading}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Generating..." : "Generate Test Cases"}
              </button>
            </div>
          </div>
        </section>

        {/* Generated list */}
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Generated Requirements (click to view testcases)</h2>
          {generationResults.length === 0 ? (
            <div className="mt-2 text-sm text-gray-500">No generated sets yet</div>
          ) : (
            <ul className="mt-2 space-y-2">
              {generationResults.map((r) => {
                const reqIdForClick = r.requirementId;
                const genId = r.id;
                const title = r.requirementTitle || r.title || r.requirementId || r.req_id || r.id;
                const count = r.count || (r.testcases && r.testcases.length);
                return (
                  <li key={r.id || r.req_id || title}>
                    <button
                      onClick={() => viewTestcasesFor(genId)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
                    >
                      <span className="font-medium">{reqIdForClick}</span> — {title}{" "}
                      {count ? <span className="text-gray-500">({count} testcases)</span> : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Testcases view */}
        {currentReqView && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">
              Testcases for: {currentReqView.title} <span className="text-gray-500">({currentReqView.id})</span>
            </h2>

            {currentReqView.testcases.length === 0 ? (
              <div className="mt-2 text-sm text-gray-500">No testcases</div>
            ) : (
              <div className="mt-4 space-y-3">
                {currentReqView.testcases.map((tc) => (
                  <TestcaseCard
                    key={tc.tc_id}
                    tc={tc}
                    genId={currentReqView.genId}
                    onRegenerate={regenerateSingle}
                    onSave={saveTestcase}
                    onCreateJira={createJira}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* TestcaseCard component for viewing/editing a testcase */
function TestcaseCard({ tc, genId, onRegenerate, onSave, onCreateJira }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState({ ...tc });

  useEffect(() => setLocal({ ...tc }), [tc]);

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{local.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">ID: {local.tc_id}</div>
        </div>

        <div className="shrink-0 space-x-2">
          <button
            onClick={() => onRegenerate(genId, local.tc_id)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Regenerate
          </button>
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          {local.jira_id ? (
            <a
              href={`https://healthcaregenai.atlassian.net/browse/${local.jira_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {local.jira_id}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onCreateJira(genId, local.tc_id)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Create Jira
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <input
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
            placeholder="Title"
          />

          <label className="block text-xs font-medium text-gray-600">Preconditions (one per line)</label>
          <textarea
            rows={2}
            value={(local.preconditions || []).join("\n")}
            onChange={(e) => setLocal({ ...local, preconditions: e.target.value.split("\n") })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
          />

          <label className="block text-xs font-medium text-gray-600">Steps (one per line)</label>
          <textarea
            rows={3}
            value={(local.steps || []).join("\n")}
            onChange={(e) => setLocal({ ...local, steps: e.target.value.split("\n") })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
          />

          <label className="block text-xs font-medium text-gray-600">Expected</label>
          <input
            value={local.expected || ""}
            onChange={(e) => setLocal({ ...local, expected: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
            placeholder="Expected result"
          />

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Automatable</label>
              <select
                value={local.automatable ? "true" : "false"}
                onChange={(e) => setLocal({ ...local, automatable: e.target.value === "true" })}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600">Suggested tool</label>
              <input
                value={local.suggested_tool || ""}
                onChange={(e) => setLocal({ ...local, suggested_tool: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="e.g., Playwright"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600">Confidence (0-1)</label>
              <input
                value={local.confidence}
                onChange={(e) => setLocal({ ...local, confidence: parseFloat(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="0.8"
              />
            </div>
          </div>

          <label className="block text-xs font-medium text-gray-600">Compliance (comma separated)</label>
          <input
            value={(local.compliance || []).join(", ")}
            onChange={(e) =>
              setLocal({
                ...local,
                compliance: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
            placeholder="e.g., ISO 13485, 21 CFR Part 11"
          />

          <div className="pt-2">
            <button
              onClick={() => {
                onSave(genId, local);
                setEditing(false);
              }}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-sm">
          {local.preconditions && local.preconditions.length > 0 && (
            <>
              <div className="font-semibold">Preconditions</div>
              <ol className="list-decimal pl-5 space-y-1">
                {local.preconditions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </>
          )}

          {local.steps && local.steps.length > 0 && (
            <>
              <div className="font-semibold">Steps</div>
              <ol className="list-decimal pl-5 space-y-1">
                {local.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}

          {local.expected && (
            <div>
              <div className="font-semibold">Expected</div>
              <div>{local.expected}</div>
            </div>
          )}

          <div className="text-xs text-gray-600">
            Automatable: {local.automatable ? "Yes" : "No"} — Suggested: {local.suggested_tool} — Confidence: {local.confidence}
          </div>
          <div className="text-xs text-gray-600">
            Compliance: {(local.compliance || []).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
