// frontend/src/App.js
import React, { useCallback, useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

function App({ googleClientId }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("googleProfile");
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn("Unable to parse stored Google profile", error);
      return null;
    }
  });
  const [credential, setCredential] = useState(() =>
    localStorage.getItem("googleCredential") || null
  );
  const [loginError, setLoginError] = useState("");

  const [stdFile, setStdFile] = useState(null);
  const [reqFile, setReqFile] = useState(null);

  const [standards, setStandards] = useState({});
  const [requirements, setRequirements] = useState({});

  const [selectedStandards, setSelectedStandards] = useState([]);
  const [selectedRequirements, setSelectedRequirements] = useState([]);

  const [promptOverride, setPromptOverride] = useState("");

  const [generationResults, setGenerationResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regeneratingTcId, setRegeneratingTcId] = useState(null);
  const [regeneratingReqId, setRegeneratingReqId] = useState(null);
  const [regenerateReqPrompt, setRegenerateReqPrompt] = useState({});
  const [uploadingStandard, setUploadingStandard] = useState(false);
  const [uploadingRequirement, setUploadingRequirement] = useState(false);
  const [creatingJiraTcId, setCreatingJiraTcId] = useState(null);

  const [expanded, setExpanded] = useState({});         // { [genId]: true/false }
  const [reqViews, setReqViews] = useState({});         // { [genId]: { id, genId, title, testcases, selectedStandards } }


  const signOut = useCallback(() => {
    setUser(null);
    setCredential(null);
    setLoginError("");
    setStdFile(null);
    setReqFile(null);
    setStandards({});
    setRequirements({});
    setSelectedStandards([]);
    setSelectedRequirements([]);
    setPromptOverride("");
    setGenerationResults([]);
  }, [
    setCredential,
    setGenerationResults,
    setLoginError,
    setReqFile,
    setRequirements,
    setSelectedRequirements,
    setSelectedStandards,
    setStandards,
    setStdFile,
    setPromptOverride,
    setUser,
  ]);

  useEffect(() => {
    if (user && credential) {
      localStorage.setItem("googleProfile", JSON.stringify(user));
      localStorage.setItem("googleCredential", credential);
    } else {
      localStorage.removeItem("googleProfile");
      localStorage.removeItem("googleCredential");
    }
  }, [credential, user]);

  const authorizedFetch = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        },
      });

      if (response.status === 401) {
        signOut();
      }

      return response;
    },
    [credential, signOut]
  );

  const handleLoginSuccess = useCallback(
    (credentialResponse) => {
      const token = credentialResponse?.credential;

      if (!token) {
        setLoginError("Google sign-in returned an empty credential.");
        return;
      }

      try {
        const profile = jwtDecode(token);
        if (!profile || !profile.email) {
          setLoginError("Your Google account must include an email address.");
          return;
        }

        setUser({
          name: profile.name || profile.email,
          email: profile.email,
          picture: profile.picture,
        });
        setCredential(token);
        setLoginError("");
      } catch (error) {
        console.error("Failed to decode Google credential", error);
        setLoginError("Unable to verify Google credential. Please try again.");
      }
    },
    [setCredential, setLoginError, setUser]
  );

  const handleLoginError = useCallback(() => {
    setLoginError("Google sign-in failed. Please try again.");
  }, [setLoginError]);

  const fetchStandards = useCallback(async () => {
    try {
      const res = await authorizedFetch(`${API_BASE}/standards`);
      if (!res.ok) return;
      const data = await res.json();
      setStandards(data || {});
    } catch (e) {
      console.error(e);
    }
  }, [authorizedFetch]);

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await authorizedFetch(`${API_BASE}/requirements`);
      if (!res.ok) return;
      const data = await res.json();
      setRequirements(data || {});
    } catch (e) {
      console.error(e);
    }
  }, [authorizedFetch]);

  const fetchGeneratedSummary = useCallback(async () => {
    try {
      const res = await authorizedFetch(`${API_BASE}/generated`);
      if (res.ok) {
        const data = await res.json();
        setGenerationResults(data || []);
      }
    } catch (e) {
      /* ignore */
    }
  }, [authorizedFetch]);

  useEffect(() => {
    if (!user) return;
    fetchStandards();
    fetchRequirements();
    fetchGeneratedSummary();
  }, [fetchGeneratedSummary, fetchRequirements, fetchStandards, user]);

  async function uploadStandard(e) {
    e.preventDefault();
    if (!stdFile) return alert("Choose a standard file");
    setUploadingStandard(true);
    const fd = new FormData();
    fd.append("standardFile", stdFile);
    try {
      const res = await authorizedFetch(`${API_BASE}/upload`, {
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
    } finally {
      setUploadingStandard(false);
    }
  }

  async function uploadRequirement(e) {
    e.preventDefault();
    if (!reqFile) return alert("Choose a requirement file");
    setUploadingRequirement(true);
    const fd = new FormData();
    fd.append("requirementFile", reqFile);
    try {
      const res = await authorizedFetch(`${API_BASE}/requirements/upload`, {
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
    } finally {
      setUploadingRequirement(false);
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
      const res = await authorizedFetch(`${API_BASE}/testcases`, {
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

  // Load testcases for a generated set. If force===true always re-fetch
  // otherwise behave as a toggle when invoked from the UI.
  async function viewTestcasesFor(genId, force = false) {
    // If not forcing and already expanded -> collapse (UI toggle)
    if (!force && expanded[genId]) {
      setExpanded((e) => ({ ...e, [genId]: false }));
      return;
    }

    // If not forcing and we already have it cached -> just expand
    if (!force && reqViews[genId]) {
      setExpanded((e) => ({ ...e, [genId]: true }));
      return;
    }

    // Otherwise fetch fresh data and expand
    try {
      const res = await authorizedFetch(`${API_BASE}/generated/requirement/${encodeURIComponent(genId)}`);
      const data = await res.json();
      if (res.ok) {
        setReqViews((prev) => ({
          ...prev,
          [genId]: {
            id: data.requirementId,
            genId: data.id,
            title: data.requirementTitle,
            testcases: data.testcases || [],
            selectedStandards: data.selectedStandards || [],
          }
        }));
        setExpanded((e) => ({ ...e, [genId]: true }));
      } else {
        alert("No testcases: " + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error(err);
      alert("Error loading testcases");
    }
  }
  

  async function regenerateRequirement(reqId, genId, promptOverride = "") {
    setRegeneratingReqId(reqId);
    try {
      // Get the generated set to get selectedStandards
      const genRes = await authorizedFetch(
        `${API_BASE}/generated/requirement/${encodeURIComponent(genId)}`
      );
      if (!genRes.ok) {
        alert("Unable to load generated set");
        return;
      }
      const genData = await genRes.json();
      const selectedStandards = genData.selectedStandards || [];
      
      if (selectedStandards.length === 0) {
        alert("No standards found in the original generation");
        return;
      }

      const res = await authorizedFetch(
        `${API_BASE}/requirements/${encodeURIComponent(reqId)}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedStandards,
            promptOverride: promptOverride || undefined,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert(`Regenerated: ${data.count} testcases created`);
        // Refresh summary and ensure the requirement's testcases are re-fetched
        await fetchGeneratedSummary();
        try {
          await viewTestcasesFor(data.genId, true);
        } catch (e) {
          // ignore — we still refreshed the summary
        }
      } else {
        alert("Regenerate failed: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      alert("Error regenerating");
    } finally {
      setRegeneratingReqId(null);
      setRegenerateReqPrompt((prev) => {
        const newPrev = { ...prev };
        delete newPrev[reqId];
        return newPrev;
      });
    }
  }

  async function regenerateSingle(genId, tcId, promptOverride = "") {
    setRegeneratingTcId(tcId);
    try {
      const res = await authorizedFetch(
        `${API_BASE}/testcases/${encodeURIComponent(genId)}/regenerate/${encodeURIComponent(tcId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptOverride: promptOverride || undefined }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Regenerated");
        // Refresh this genId's testcases in place (force a fresh fetch)
        await viewTestcasesFor(genId, true);
        await fetchGeneratedSummary();
        // also refresh summary counts
      } else {
        alert("Regenerate failed: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      alert("Error regenerating");
    } finally {
      setRegeneratingTcId(null);
    }
  }
  

  async function saveTestcase(genId, tc) {
    const gid = genId;
    try {
      const res = await authorizedFetch(
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
        // Refresh that panel
        await viewTestcasesFor(gid, true);
        await fetchGeneratedSummary();
      } else {
        alert("Save failed: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      alert("Error saving");
    }
  }
  

  async function createJira(genId, tcId) {
    const projectKey = prompt("Enter Jira project key (leave blank to use default):");
    if (projectKey === null) return; // user cancelled
    setCreatingJiraTcId(tcId);
    try {
      const res = await authorizedFetch(
        `${API_BASE}/testcases/${encodeURIComponent(genId)}/${encodeURIComponent(tcId)}/jira`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectKey }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Jira created: " + JSON.stringify(data.jira));
        // Re-render the impacted components
        await fetchGeneratedSummary();
        try {
          await viewTestcasesFor(genId, true);
        } catch (e) {
          // ignore — summary refreshed at least
        }
      } else {
        alert("Jira create failed: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      alert("Jira create error");
    } finally {
      setCreatingJiraTcId(null);
    }
  }

  if (!googleClientId) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-lg px-5 py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">AI Testcase Generator</h1>
          <p className="mt-4 text-sm text-gray-600">
            Google login requires the environment variable <code>REACT_APP_GOOGLE_CLIENT_ID</code> to be set.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Update your <code>.env</code> file or runtime configuration and reload the app.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">AI Testcase Generator</h1>
          <p className="mt-4 text-sm text-gray-600">Sign in with your Google account to continue.</p>
          <div className="mt-8 flex justify-center">
            <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} useOneTap />
          </div>
          {loginError && <div className="mt-4 text-sm text-red-500">{loginError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            AI Testcase Generator
          </h1>
          <div className="flex items-center gap-3">
            {user?.picture && (
              <img
                src={user.picture}
                alt={user.name || user.email}
                className="size-10 rounded-full border border-gray-200 object-cover"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="text-right">
              <div className="text-sm font-medium">{user.name || user.email}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>

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
              disabled={uploadingStandard}
              className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploadingStandard ? "Uploading Standard..." : "Upload Standard"}
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
              disabled={uploadingRequirement}
              className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploadingRequirement ? "Uploading Requirement..." : "Upload Requirement"}
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
              Additional Instructions (Optional)
            </h4>
            <textarea
              rows={4}
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
              placeholder="Optional additional instructions to the prompt"
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
          <h2 className="text-xl font-semibold">Requirements List (click to view testcases)</h2>
          {generationResults.length === 0 ? (
            <div className="mt-2 text-sm text-gray-500">No generated sets yet</div>
          ) : (
            <ul className="mt-2 space-y-2">
              {generationResults.map((r) => {
                const reqIdForClick = r.requirementId;
                const genId = r.id;
                const title = r.requirementTitle || r.title || r.requirementId || r.req_id || r.id;
                const count = r.count || (r.testcases && r.testcases.length);
                const showPrompt = regenerateReqPrompt[reqIdForClick] !== undefined;
                const isRegenerating = regeneratingReqId === reqIdForClick;
                return (
                  <li key={r.id || r.req_id || title} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewTestcasesFor(genId)}
                        className="flex-1 rounded-lg border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
                      >
                        <span className="font-medium">{reqIdForClick}</span> — {title}{" "}
                        {count ? <span className="text-gray-500">({count} testcases)</span> : ""}
                      </button>
                      {!showPrompt && (
                        <button
                          onClick={() => {
                            setRegenerateReqPrompt((prev) => ({ ...prev, [reqIdForClick]: "" }));
                          }}
                          disabled={isRegenerating}
                          className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRegenerating ? "Regenerating..." : "Regenerate"}
                        </button>
                      )}
                    </div>
                    {showPrompt && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Additional Instructions (Optional)
                        </label>
                        <textarea
                          rows={3}
                          value={regenerateReqPrompt[reqIdForClick] || ""}
                          onChange={(e) => {
                            setRegenerateReqPrompt((prev) => ({
                              ...prev,
                              [reqIdForClick]: e.target.value,
                            }));
                          }}
                          placeholder="Enter any additional instructions for regenerating testcases for this requirement..."
                          className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => regenerateRequirement(reqIdForClick, genId, regenerateReqPrompt[reqIdForClick] || "")}
                            disabled={isRegenerating}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRegenerating ? "Regenerating..." : "Confirm Regenerate"}
                          </button>
                          <button
                            onClick={() => {
                              setRegenerateReqPrompt((prev) => {
                                const newPrev = { ...prev };
                                delete newPrev[reqIdForClick];
                                return newPrev;
                              });
                            }}
                            disabled={isRegenerating}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  {expanded[genId] && reqViews[genId] && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="text-sm font-semibold">
                        Testcases for: {reqViews[genId].title} <span className="text-gray-500">({reqViews[genId].id})</span>
                      </h3>
                      {reqViews[genId].testcases.length === 0 ? (
                        <div className="mt-2 text-sm text-gray-500">No testcases</div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {reqViews[genId].testcases.map((tc) => (
                            <TestcaseCard
                            key={tc.tc_id}
                              tc={tc}
                              genId={reqViews[genId].genId}
                              onRegenerate={regenerateSingle}
                              onSave={saveTestcase}
                              onCreateJira={createJira}
                              isRegenerating={regeneratingTcId === tc.tc_id}
                              isCreatingJira={creatingJiraTcId === tc.tc_id}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* TestcaseCard component for viewing/editing a testcase */
function TestcaseCard({ tc, genId, onRegenerate, onSave, onCreateJira, isRegenerating, isCreatingJira }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState({ ...tc });
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");

  useEffect(() => setLocal({ ...tc }), [tc]);
  
  const handleRegenerate = () => {
    if (showRegeneratePrompt) {
      onRegenerate(genId, local.tc_id, regeneratePrompt);
      setShowRegeneratePrompt(false);
      setRegeneratePrompt("");
    } else {
      setShowRegeneratePrompt(true);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{local.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">ID: {local.tc_id}</div>
        </div>

        <div className="shrink-0 space-x-2">
          {!showRegeneratePrompt && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </button>
          )}
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
              disabled={isCreatingJira}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingJira ? "Creating..." : "Create Jira"}
            </button>
          )}
        </div>
      </div>

      {showRegeneratePrompt && !editing ? (
        <div className="mt-4 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <label className="block text-sm font-medium text-gray-700">
            Additional Instructions (Optional)
          </label>
          <textarea
            rows={4}
            value={regeneratePrompt}
            onChange={(e) => setRegeneratePrompt(e.target.value)}
            placeholder="Enter any additional instructions for regenerating this testcase..."
            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegenerating ? "Regenerating..." : "Confirm Regenerate"}
            </button>
            <button
              onClick={() => {
                setShowRegeneratePrompt(false);
                setRegeneratePrompt("");
              }}
              disabled={isRegenerating}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
              <ul className="list-decimal pl-5 space-y-1">
                {local.preconditions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}

          {local.steps && local.steps.length > 0 && (
            <>
              <div className="font-semibold">Steps</div>
              <ul className="list-decimal pl-5 space-y-1">
                {local.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
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

App.defaultProps = {
  googleClientId: "",
};

export default App;
