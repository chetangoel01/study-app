const appState = {
  data: window.STUDY_GUIDE_DATA,
  storageKey: "ciu-study-guide-state",
  search: "",
  phase: "All",
  pace: 6,
  hideComplete: false,
  selectedId: null,
  progress: {},
  notes: {},
  graph: {
    status: "idle",
    data: null,
    error: "",
    topicId: null,
    search: "",
    relation: "all",
  },
};

function loadState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(appState.storageKey) || "{}");
    appState.progress = stored.progress || {};
    appState.notes = stored.notes || {};
    appState.phase = stored.phase || "All";
    appState.search = stored.search || "";
    appState.pace = Number(stored.pace) || 6;
    appState.hideComplete = Boolean(stored.hideComplete);
    appState.selectedId = stored.selectedId || null;
    appState.graph.topicId = stored.graphTopicId || null;
    appState.graph.search = stored.graphSearch || "";
    appState.graph.relation = stored.graphRelation || "all";
  } catch {
    appState.progress = {};
    appState.notes = {};
  }
}

function saveState() {
  window.localStorage.setItem(
    appState.storageKey,
    JSON.stringify({
      progress: appState.progress,
      notes: appState.notes,
      phase: appState.phase,
      search: appState.search,
      pace: appState.pace,
      hideComplete: appState.hideComplete,
      selectedId: appState.selectedId,
      graphTopicId: appState.graph.topicId,
      graphSearch: appState.graph.search,
      graphRelation: appState.graph.relation,
    }),
  );
}

function completedCount(section) {
  const sectionProgress = appState.progress[section.id] || {};
  return section.items.filter((_, index) => Boolean(sectionProgress[index])).length;
}

function sectionPercent(section) {
  if (!section.items.length) {
    return 0;
  }
  return Math.round((completedCount(section) / section.items.length) * 100);
}

function sectionState(section) {
  const percent = sectionPercent(section);
  if (percent === 100) return "Done";
  if (percent > 0) return "In progress";
  return "Not started";
}

function normalize(text) {
  return text.toLowerCase().trim();
}

function matchesSearch(section, term) {
  if (!term) {
    return true;
  }

  const resources = (section.resources || []).map((resource) => resource.label);
  const checks = section.checks || [];
  const haystack = [section.title, section.summary, section.phase, ...section.items, ...resources, ...checks]
    .join(" ")
    .toLowerCase();

  return haystack.includes(term);
}

function filteredSections() {
  const searchTerm = normalize(appState.search);
  return appState.data.sections.filter((section) => {
    const phaseMatch = appState.phase === "All" || section.phase === appState.phase;
    const completeMatch = !appState.hideComplete || sectionPercent(section) < 100;
    return phaseMatch && completeMatch && matchesSearch(section, searchTerm);
  });
}

function nextFocusSection() {
  return appState.data.sections.find((section) => sectionPercent(section) < 100) || appState.data.sections[0];
}

function remainingItems(section) {
  const sectionProgress = appState.progress[section.id] || {};
  return section.items.filter((_, index) => !sectionProgress[index]);
}

function aggregateProgress() {
  const totalItems = appState.data.totalItems;
  const completedItems = appState.data.sections.reduce((sum, section) => sum + completedCount(section), 0);
  const finishedSections = appState.data.sections.filter((section) => sectionPercent(section) === 100).length;
  const remainingSessions = appState.data.sections.reduce((sum, section) => {
    if (section.countsTowardSchedule === false) {
      return sum;
    }
    const percentLeft = 1 - sectionPercent(section) / 100;
    return sum + section.sessions * percentLeft;
  }, 0);

  return { totalItems, completedItems, finishedSections, remainingSessions: Math.ceil(remainingSessions) };
}

function ensureSelectedVisible(sections) {
  if (!sections.length) {
    appState.selectedId = null;
    return null;
  }

  const existing = sections.find((section) => section.id === appState.selectedId);
  if (existing) {
    return existing;
  }

  const nextFocus = nextFocusSection();
  const visibleFocus = sections.find((section) => section.id === nextFocus.id);
  appState.selectedId = (visibleFocus || sections[0]).id;
  saveState();
  return sections.find((section) => section.id === appState.selectedId) || sections[0];
}

function selectedSection(sections) {
  return ensureSelectedVisible(sections);
}

function moveSelection(delta) {
  const sections = filteredSections();
  const current = selectedSection(sections);
  if (!current) {
    return;
  }

  const index = sections.findIndex((section) => section.id === current.id);
  const nextIndex = Math.min(sections.length - 1, Math.max(0, index + delta));
  appState.selectedId = sections[nextIndex].id;
  saveState();
  render();

  const card = document.querySelector(`[data-card-id="${appState.selectedId}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

function renderHeroStats() {
  const target = document.getElementById("hero-stats");
  const { totalItems, completedItems, finishedSections, remainingSessions } = aggregateProgress();
  const weeksLeft = appState.pace ? (remainingSessions / appState.pace).toFixed(1) : "0.0";

  target.innerHTML = `
    <article class="stat-card">
      <span class="label">Done</span>
      <strong class="stat-value">${completedItems}/${totalItems}</strong>
      <div class="progress-bar" aria-label="Overall progress"><span style="width:${totalItems ? Math.round((completedItems / totalItems) * 100) : 0}%"></span></div>
    </article>
    <article class="stat-card">
      <span class="label">Finished modules</span>
      <strong class="stat-value">${finishedSections}</strong>
      <span class="label">Fully completed so far</span>
    </article>
    <article class="stat-card">
      <span class="label">Plan ahead</span>
      <strong class="stat-value">${remainingSessions}</strong>
      <span class="label">${weeksLeft} weeks left at ${appState.pace} sessions/week</span>
    </article>
  `;
}

function renderFocusPanel() {
  const target = document.getElementById("focus-panel");
  const focus = nextFocusSection();
  const items = remainingItems(focus).slice(0, 3);
  const percent = sectionPercent(focus);
  const resources = (focus.resources || []).slice(0, 2);

  target.innerHTML = `
    <p class="panel-label">Next up</p>
    <h2>${focus.title}</h2>
    <p>${focus.summary}</p>
    <p><strong>${focus.phase}</strong> · ${focus.estimate} · ${percent}% complete</p>
    <ul class="focus-list">
      ${items.length ? items.map((item) => `<li>${item}</li>`).join("") : "<li>Everything here is complete. Move to review or optional topics.</li>"}
    </ul>
    <ul class="focus-list">
      ${resources.map((resource) => `<li><a href="${resource.url}" target="_blank" rel="noreferrer">${resource.label}</a></li>`).join("")}
    </ul>
    <p><button class="action-link inline-action" data-open-id="${focus.id}" type="button">Open this module</button></p>
  `;

  const button = target.querySelector("[data-open-id]");
  if (button) {
    button.addEventListener("click", () => {
      appState.selectedId = button.dataset.openId;
      saveState();
      render();
      document.getElementById("detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function renderPhaseFilters() {
  const target = document.getElementById("phase-filter");
  const phases = ["All", ...new Set(appState.data.sections.map((section) => section.phase))];

  target.innerHTML = phases
    .map(
      (phase) => `
        <button class="phase-pill ${phase === appState.phase ? "active" : ""}" data-phase="${phase}" type="button">
          ${phase}
        </button>
      `,
    )
    .join("");

  target.querySelectorAll("[data-phase]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.phase = button.dataset.phase;
      saveState();
      render();
    });
  });
}

function renderSectionSummary(sections) {
  const target = document.getElementById("section-summary");
  const { finishedSections } = aggregateProgress();
  const current = selectedSection(sections);
  const index = current ? sections.findIndex((section) => section.id === current.id) + 1 : 0;

  target.innerHTML = `
    <div class="summary-copy">
      <p class="panel-label">Guide view</p>
      <h2>${sections.length} module${sections.length === 1 ? "" : "s"} available</h2>
      <p>${finishedSections} module${finishedSections === 1 ? "" : "s"} fully complete across the guide.</p>
    </div>
    <div class="summary-metrics">
      <div class="metric-pill">
        <span class="panel-label">Position</span>
        <strong>${current ? `${index}/${sections.length}` : "0/0"}</strong>
      </div>
      <div class="metric-pill">
        <span class="panel-label">Pace</span>
        <strong>${appState.pace}/week</strong>
      </div>
      <div class="metric-pill">
        <span class="panel-label">Visibility</span>
        <strong>${appState.hideComplete ? "Hide done" : "Show all"}</strong>
      </div>
    </div>
  `;
}

function roadmapCard(section, index, selected) {
  const percent = sectionPercent(section);
  const status = sectionState(section);
  const complete = percent === 100;

  return `
    <button
      class="roadmap-card ${selected ? "active" : ""} ${complete ? "done" : ""}"
      type="button"
      data-card-id="${section.id}"
      aria-pressed="${selected ? "true" : "false"}"
    >
      <span class="roadmap-step">${String(index + 1).padStart(2, "0")}</span>
      <span class="roadmap-phase">${section.phase}</span>
      <strong class="roadmap-title">${section.title}</strong>
      <span class="roadmap-estimate">${section.estimate}</span>
      <span class="roadmap-status">${status}</span>
      <div class="progress-bar roadmap-progress"><span style="width:${percent}%"></span></div>
    </button>
  `;
}

function renderRoadmap(sections) {
  const target = document.getElementById("roadmap-track");
  const current = selectedSection(sections);

  if (!sections.length) {
    target.innerHTML = '<div class="empty-state">No modules match the current search and filter combination.</div>';
    document.getElementById("prev-section").disabled = true;
    document.getElementById("next-section").disabled = true;
    return;
  }

  target.innerHTML = sections.map((section, index) => roadmapCard(section, index, current && section.id === current.id)).join("");

  const currentIndex = sections.findIndex((section) => current && section.id === current.id);
  document.getElementById("prev-section").disabled = currentIndex <= 0;
  document.getElementById("next-section").disabled = currentIndex >= sections.length - 1;

  target.querySelectorAll("[data-card-id]").forEach((card) => {
    card.addEventListener("click", () => {
      appState.selectedId = card.dataset.cardId;
      saveState();
      render();
    });
  });
}

function renderDetailPanel(sections) {
  const target = document.getElementById("detail-panel");
  const section = selectedSection(sections);

  if (!section) {
    target.innerHTML = '<div class="empty-state">Adjust the filters to show at least one module.</div>';
    return;
  }

  const percent = sectionPercent(section);
  const status = sectionState(section);
  const note = appState.notes[section.id] || "";
  const currentIndex = sections.findIndex((item) => item.id === section.id) + 1;

  target.innerHTML = `
    <div id="section-${section.id}"></div>
    <div class="card-top">
      <div>
        <p class="panel-label">Module ${currentIndex} of ${sections.length}</p>
        <h3>${section.title}</h3>
        <div class="meta-row">
          <span class="meta-chip">${section.phase}</span>
          <span class="meta-chip">${section.estimate}</span>
          <span class="meta-chip">${section.items.length} checklist items</span>
        </div>
        <p>${section.summary}</p>
      </div>
      <div class="section-progress">
        <span class="panel-label">Progress</span>
        <strong>${percent}%</strong>
        <div class="progress-bar"><span style="width:${percent}%"></span></div>
      </div>
    </div>
    <ul class="task-list">
      ${section.items
        .map((item, itemIndex) => {
          const checked = Boolean((appState.progress[section.id] || {})[itemIndex]);
          return `
            <li class="task-row ${checked ? "done" : ""}">
              <label>
                <input data-section="${section.id}" data-index="${itemIndex}" type="checkbox" ${checked ? "checked" : ""}>
                <span>${item}</span>
              </label>
            </li>
          `;
        })
        .join("")}
    </ul>
    <div class="detail-grid">
      <section class="card-subsection">
        <p class="panel-label">Start with</p>
        <ul class="resource-list">
          ${(section.resources || [])
            .map((resource) => `<li><a href="${resource.url}" target="_blank" rel="noreferrer">${resource.label}</a></li>`)
            .join("")}
        </ul>
      </section>
      <section class="card-subsection">
        <p class="panel-label">Interview check</p>
        <ul class="check-list">
          ${(section.checks || []).map((check) => `<li>${check}</li>`).join("")}
        </ul>
      </section>
    </div>
    <div class="notes-box">
      <label for="note-${section.id}">Your notes</label>
      <textarea id="note-${section.id}" data-note="${section.id}" placeholder="Capture weak spots, patterns, links, or practice prompts...">${note}</textarea>
    </div>
    <div class="card-bottom">
      <div class="section-state">
        <span class="panel-label">State</span>
        <strong>${status}</strong>
      </div>
      <a class="action-link" href="${section.sourceUrl}" target="_blank" rel="noreferrer">Open source section</a>
    </div>
  `;

  target.querySelectorAll('input[type="checkbox"][data-section]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const { section: sectionId, index } = checkbox.dataset;
      appState.progress[sectionId] = appState.progress[sectionId] || {};
      appState.progress[sectionId][index] = checkbox.checked;
      saveState();
      render();
    });
  });

  const textarea = target.querySelector("textarea[data-note]");
  if (textarea) {
    textarea.addEventListener("input", () => {
      appState.notes[textarea.dataset.note] = textarea.value;
      saveState();
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function summarizeMarkdown(markdown) {
  const text = String(markdown || "")
    .replace(/^#+\s+/gm, "")
    .replace(/[`*_>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return "Inspect this node to see how it fits into the broader curriculum.";
  }
  return text.length > 210 ? `${text.slice(0, 207)}...` : text;
}

function moduleTitleForId(moduleId) {
  const section = appState.data.sections.find((item) => item.id === moduleId);
  return section ? section.title : moduleId;
}

function normalizeKnowledgeGraph(payload) {
  const topics = (Array.isArray(payload.topics) ? payload.topics : [])
    .map((topic) => ({ ...topic }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const topicMap = new Map();
  const edgeStore = new Map();
  const moduleTopics = new Map();

  topics.forEach((topic) => {
    topicMap.set(topic.id, topic);
    edgeStore.set(topic.id, { incoming: [], outgoing: [] });
    (topic.module_ids || []).forEach((moduleId) => {
      if (!moduleTopics.has(moduleId)) {
        moduleTopics.set(moduleId, []);
      }
      moduleTopics.get(moduleId).push(topic.id);
    });
  });

  moduleTopics.forEach((ids) => {
    ids.sort((left, right) => topicMap.get(left).label.localeCompare(topicMap.get(right).label));
  });

  const edges = (Array.isArray(payload.topic_edges) ? payload.topic_edges : [])
    .filter((edge) => topicMap.has(edge.from) && topicMap.has(edge.to))
    .map((edge) => ({ ...edge }));

  edges.forEach((edge) => {
    edgeStore.get(edge.from).outgoing.push(edge);
    edgeStore.get(edge.to).incoming.push(edge);
  });

  return {
    topics,
    edges,
    topicMap,
    edgeStore,
    moduleTopics,
    stats: payload.stats || {},
  };
}

async function loadKnowledgeGraph() {
  if (appState.graph.status === "loading") {
    return;
  }

  appState.graph.status = "loading";
  appState.graph.error = "";
  render();

  try {
    const response = await window.fetch("./knowledge-base.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`knowledge-base.json returned ${response.status}`);
    }

    const payload = await response.json();
    appState.graph.data = normalizeKnowledgeGraph(payload);
    appState.graph.status = "ready";
    appState.graph.error = "";

    if (!appState.graph.topicId || !appState.graph.data.topicMap.has(appState.graph.topicId)) {
      appState.graph.topicId = defaultGraphTopicId(filteredSections(), appState.graph.data);
    }
    saveState();
  } catch (error) {
    appState.graph.status = "error";
    appState.graph.data = null;
    appState.graph.error = error instanceof Error ? error.message : String(error);
  }

  render();
}

function graphReady() {
  return appState.graph.status === "ready" && Boolean(appState.graph.data);
}

function defaultGraphTopicId(sections, graphData = appState.graph.data) {
  if (!graphData || !graphData.topics.length) {
    return null;
  }

  const currentSection = sections.length ? selectedSection(sections) : null;
  if (currentSection) {
    const moduleTopicIds = graphData.moduleTopics.get(currentSection.id) || [];
    if (moduleTopicIds.length) {
      return moduleTopicIds[0];
    }
  }

  return graphData.topics[0].id;
}

function ensureGraphTopic(sections) {
  if (!graphReady()) {
    return null;
  }

  if (appState.graph.topicId && appState.graph.data.topicMap.has(appState.graph.topicId)) {
    return appState.graph.data.topicMap.get(appState.graph.topicId);
  }

  const fallbackTopicId = defaultGraphTopicId(sections);
  if (!fallbackTopicId) {
    return null;
  }

  appState.graph.topicId = fallbackTopicId;
  saveState();
  return appState.graph.data.topicMap.get(fallbackTopicId);
}

function graphMatchesSearch(topic, term) {
  const moduleTitles = (topic.module_ids || []).map((moduleId) => moduleTitleForId(moduleId));
  const haystack = [
    topic.label,
    ...(topic.aliases || []),
    ...(topic.concepts || []),
    ...moduleTitles,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(term);
}

function graphTopicCandidates(sections) {
  if (!graphReady()) {
    return { title: "Topic index", topics: [] };
  }

  const searchTerm = normalize(appState.graph.search);
  if (searchTerm) {
    const topics = appState.graph.data.topics.filter((topic) => graphMatchesSearch(topic, searchTerm)).slice(0, 18);
    return {
      title: topics.length ? "Search results" : "No matching topics",
      topics,
    };
  }

  const currentSection = sections.length ? selectedSection(sections) : null;
  if (currentSection) {
    const moduleTopicIds = appState.graph.data.moduleTopics.get(currentSection.id) || [];
    if (moduleTopicIds.length) {
      return {
        title: `Topics in ${currentSection.title}`,
        topics: moduleTopicIds.map((topicId) => appState.graph.data.topicMap.get(topicId)).slice(0, 18),
      };
    }
  }

  return {
    title: "Topic index",
    topics: appState.graph.data.topics.slice(0, 18),
  };
}

function graphNeighborEntries(topicId) {
  if (!graphReady()) {
    return [];
  }

  const relationFilter = appState.graph.relation;
  const graphEntry = appState.graph.data.edgeStore.get(topicId) || { incoming: [], outgoing: [] };
  const neighborMap = new Map();

  const absorb = (edge, direction, neighborId) => {
    if (relationFilter !== "all" && edge.type !== relationFilter) {
      return;
    }

    const neighborTopic = appState.graph.data.topicMap.get(neighborId);
    if (!neighborTopic) {
      return;
    }

    const existing = neighborMap.get(neighborId) || {
      topic: neighborTopic,
      incoming: [],
      outgoing: [],
      relations: new Set(),
      roles: new Set(),
    };

    existing[direction].push(edge);
    existing.relations.add(edge.type);

    if (edge.type === "prerequisite") {
      existing.roles.add(direction === "incoming" ? "prerequisite" : "unlocks");
    } else {
      existing.roles.add(edge.type);
    }

    neighborMap.set(neighborId, existing);
  };

  graphEntry.incoming.forEach((edge) => absorb(edge, "incoming", edge.from));
  graphEntry.outgoing.forEach((edge) => absorb(edge, "outgoing", edge.to));

  return [...neighborMap.values()].sort((left, right) => left.topic.label.localeCompare(right.topic.label));
}

function graphPrimaryRelation(entry) {
  if (entry.roles.has("prerequisite") || entry.roles.has("unlocks")) {
    return "prerequisite";
  }
  if (entry.relations.has("extends")) {
    return "extends";
  }
  if (entry.relations.has("variant-of")) {
    return "variant-of";
  }
  return "related";
}

function graphRelationLabel(relation) {
  const labels = {
    all: "All links",
    prerequisite: "Prerequisite",
    related: "Related",
    extends: "Extends",
    "variant-of": "Variant-of",
  };
  return labels[relation] || relation;
}

function graphToneClass(relation) {
  return String(relation).replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

function graphLinkCaption(entry) {
  if (entry.roles.has("prerequisite")) {
    return "Need before this";
  }
  if (entry.roles.has("unlocks")) {
    return "Unlocked by this";
  }
  return [...entry.relations].map((relation) => graphRelationLabel(relation)).join(" · ");
}

function renderGraphTopicButton(topic, extraClass = "") {
  const selected = topic.id === appState.graph.topicId ? " active" : "";
  return `
    <button class="graph-topic-button${selected}${extraClass ? ` ${extraClass}` : ""}" type="button" data-graph-topic-id="${topic.id}">
      <span>${escapeHtml(topic.label)}</span>
      <small>${escapeHtml((topic.module_ids || []).map((moduleId) => moduleTitleForId(moduleId)).join(" · "))}</small>
    </button>
  `;
}

function renderGraphLegend() {
  return `
    <span class="graph-legend-chip tone-prerequisite">Prerequisite</span>
    <span class="graph-legend-chip tone-related">Related</span>
    <span class="graph-legend-chip tone-extends">Extends</span>
    <span class="graph-legend-chip tone-variant-of">Variant-of</span>
  `;
}

function renderGraphButtonGroup(entries, emptyText) {
  if (!entries.length) {
    return `<p class="graph-empty-copy">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="graph-link-grid">
      ${entries
        .map(
          (entry) => `
            <button class="graph-topic-chip tone-${graphToneClass(graphPrimaryRelation(entry))}" type="button" data-graph-topic-id="${entry.topic.id}">
              <span>${escapeHtml(entry.topic.label)}</span>
              <small>${escapeHtml(graphLinkCaption(entry))}</small>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderGraphDetail(topic, entries, currentSection) {
  const prerequisites = entries.filter((entry) => entry.roles.has("prerequisite"));
  const unlocks = entries.filter((entry) => entry.roles.has("unlocks"));
  const adjacent = entries.filter((entry) => !entry.roles.has("prerequisite") && !entry.roles.has("unlocks"));
  const moduleButtons = (topic.module_ids || [])
    .map((moduleId) => {
      const active = currentSection && currentSection.id === moduleId ? " active" : "";
      return `<button class="ghost-button graph-module-button${active}" type="button" data-open-id="${moduleId}">${escapeHtml(moduleTitleForId(moduleId))}</button>`;
    })
    .join("");

  return `
    <div class="graph-topic-header">
      <p class="panel-label">Centered topic</p>
      <h3>${escapeHtml(topic.label)}</h3>
      <p class="graph-topic-copy">${escapeHtml(summarizeMarkdown(topic.study_guide_markdown))}</p>
      <div class="meta-row">
        <span class="meta-chip">${Math.round((topic.confidence || 0) * 100)}% confidence</span>
        <span class="meta-chip">${(topic.source_urls || []).length} source${(topic.source_urls || []).length === 1 ? "" : "s"}</span>
        <span class="meta-chip">${(topic.evidence_chunk_ids || []).length} evidence chunk${(topic.evidence_chunk_ids || []).length === 1 ? "" : "s"}</span>
        <span class="meta-chip">${entries.length} visible link${entries.length === 1 ? "" : "s"}</span>
      </div>
      ${moduleButtons ? `<div class="graph-module-row"><p class="panel-label">Lives in modules</p><div class="graph-module-buttons">${moduleButtons}</div></div>` : ""}
    </div>
    <div class="graph-groups">
      <section class="card-subsection graph-group">
        <p class="panel-label">Prerequisites</p>
        ${renderGraphButtonGroup(prerequisites, "No upstream prerequisites are mapped for this topic yet.")}
      </section>
      <section class="card-subsection graph-group">
        <p class="panel-label">Unlocked next</p>
        ${renderGraphButtonGroup(unlocks, "Nothing downstream is explicitly unlocked from this topic yet.")}
      </section>
      <section class="card-subsection graph-group graph-group-wide">
        <p class="panel-label">${appState.graph.relation === "all" ? "Adjacent ideas" : `${graphRelationLabel(appState.graph.relation)} links`}</p>
        ${renderGraphButtonGroup(adjacent, "No adjacent links match the current filter.")}
      </section>
    </div>
  `;
}

function wrapGraphLabel(label, maxChars = 18, maxLines = 3) {
  const words = String(label).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  if (!lines.length) {
    return ["Topic"];
  }

  if (lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines);
    truncated[maxLines - 1] = `${truncated[maxLines - 1].slice(0, Math.max(3, maxChars - 3))}...`;
    return truncated;
  }

  return lines;
}

function graphDirection(entry) {
  if (entry.roles.has("prerequisite")) {
    return "incoming";
  }
  if (entry.roles.has("unlocks")) {
    return "outgoing";
  }
  if (entry.outgoing.length && !entry.incoming.length) {
    return "outgoing";
  }
  if (entry.incoming.length && !entry.outgoing.length) {
    return "incoming";
  }
  return "undirected";
}

function renderGraphNode(topic, position, options = {}) {
  const lines = wrapGraphLabel(topic.label, options.center ? 20 : 16, options.center ? 3 : 2);
  const width = options.center ? 192 : 154;
  const lineHeight = options.center ? 19 : 17;
  const height = Math.max(options.center ? 72 : 58, 24 + lines.length * lineHeight);
  const x = position.x - width / 2;
  const y = position.y - height / 2;
  const tone = options.center ? "related" : options.tone;

  return `
    <g class="graph-node tone-${graphToneClass(tone)}${options.center ? " is-center" : ""}" data-graph-topic-id="${topic.id}" transform="translate(${x}, ${y})">
      <rect width="${width}" height="${height}" rx="${options.center ? 20 : 16}" ry="${options.center ? 20 : 16}"></rect>
      <text x="${width / 2}" y="${height / 2 - ((lines.length - 1) * lineHeight) / 2 + 1}" text-anchor="middle">
        ${lines
          .map((line, index) => `<tspan x="${width / 2}" dy="${index === 0 ? 0 : lineHeight}">${escapeHtml(line)}</tspan>`)
          .join("")}
      </text>
    </g>
  `;
}

function renderGraphSvg(topic, entries) {
  const width = 760;
  const height = 500;
  const center = { x: 380, y: 250 };
  const prerequisites = entries.filter((entry) => entry.roles.has("prerequisite"));
  const unlocks = entries.filter((entry) => entry.roles.has("unlocks"));
  const adjacent = entries.filter((entry) => !entry.roles.has("prerequisite") && !entry.roles.has("unlocks"));
  const positions = new Map();

  const placeColumn = (items, x) => {
    if (!items.length) {
      return;
    }
    const span = Math.min(300, Math.max(0, (items.length - 1) * 84));
    const startY = center.y - span / 2;
    items.forEach((entry, index) => {
      positions.set(entry.topic.id, {
        x,
        y: items.length === 1 ? center.y : startY + (span / (items.length - 1)) * index,
        tone: graphPrimaryRelation(entry),
      });
    });
  };

  const placeRow = (items, y) => {
    if (!items.length) {
      return;
    }
    const span = Math.min(430, Math.max(0, (items.length - 1) * 118));
    const startX = center.x - span / 2;
    items.forEach((entry, index) => {
      positions.set(entry.topic.id, {
        x: items.length === 1 ? center.x : startX + (span / (items.length - 1)) * index,
        y,
        tone: graphPrimaryRelation(entry),
      });
    });
  };

  placeColumn(prerequisites, 144);
  placeColumn(unlocks, 616);
  placeRow(adjacent.filter((_, index) => index % 2 === 0), 108);
  placeRow(adjacent.filter((_, index) => index % 2 === 1), 392);

  const edgeMarkup = entries
    .map((entry) => {
      const position = positions.get(entry.topic.id);
      if (!position) {
        return "";
      }

      const relation = graphPrimaryRelation(entry);
      const direction = graphDirection(entry);
      let start = center;
      let end = position;
      let markerEnd = "";

      if (direction === "incoming") {
        start = position;
        end = center;
        markerEnd = `marker-end="url(#marker-${graphToneClass(relation)})"`;
      } else if (direction === "outgoing" && relation !== "related") {
        markerEnd = `marker-end="url(#marker-${graphToneClass(relation)})"`;
      }

      return `
        <line
          class="graph-edge tone-${graphToneClass(relation)}${direction === "undirected" ? " is-undirected" : ""}"
          x1="${start.x}"
          y1="${start.y}"
          x2="${end.x}"
          y2="${end.y}"
          ${markerEnd}
        ></line>
      `;
    })
    .join("");

  const headingMarkup = `
    <text class="graph-heading" x="104" y="54">Need first</text>
    <text class="graph-heading" x="580" y="54">Leads to</text>
    <text class="graph-heading" x="332" y="54">Adjacent ideas</text>
  `;

  return `
    <defs>
      <marker id="marker-prerequisite" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--graph-prerequisite)"></path>
      </marker>
      <marker id="marker-related" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--graph-related)"></path>
      </marker>
      <marker id="marker-extends" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--graph-extends)"></path>
      </marker>
      <marker id="marker-variant-of" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--graph-variant-of)"></path>
      </marker>
    </defs>
    ${headingMarkup}
    ${edgeMarkup}
    ${entries
      .map((entry) => {
        const position = positions.get(entry.topic.id);
        if (!position) {
          return "";
        }
        return renderGraphNode(entry.topic, position, { tone: position.tone });
      })
      .join("")}
    ${renderGraphNode(topic, center, { center: true })}
  `;
}

function renderGraphEmptySvg(message) {
  return `
    <rect class="graph-empty-backdrop" x="20" y="20" width="720" height="460" rx="24" ry="24"></rect>
    <text class="graph-empty-label" x="380" y="250" text-anchor="middle">${escapeHtml(message)}</text>
  `;
}

function renderGraphPanel(sections) {
  const summary = document.getElementById("graph-summary");
  const listTarget = document.getElementById("graph-topic-list");
  const detailTarget = document.getElementById("graph-detail");
  const canvas = document.getElementById("graph-canvas");
  const legend = document.getElementById("graph-legend");

  if (!summary || !listTarget || !detailTarget || !canvas || !legend) {
    return;
  }

  legend.innerHTML = renderGraphLegend();

  if (appState.graph.status === "loading" || appState.graph.status === "idle") {
    summary.textContent = "Loading knowledge-base.json so the topic relationships can be explored in the app.";
    listTarget.innerHTML = '<div class="empty-state">Topic search becomes available as soon as the graph is loaded.</div>';
    detailTarget.innerHTML = '<div class="empty-state">The graph panel will center on a topic and expose its prerequisite chain once the JSON is available.</div>';
    canvas.innerHTML = renderGraphEmptySvg("Loading topic graph...");
    return;
  }

  if (appState.graph.status === "error") {
    summary.textContent = `Graph unavailable: ${appState.graph.error}`;
    listTarget.innerHTML = '<div class="empty-state">The app could not load knowledge-base.json. Regenerate it with the pipeline and reload the page.</div>';
    detailTarget.innerHTML = '<div class="empty-state">The study guide still works without the graph, but this panel needs the generated knowledge graph artifact.</div>';
    canvas.innerHTML = renderGraphEmptySvg("Graph unavailable");
    return;
  }

  const currentSection = sections.length ? selectedSection(sections) : null;
  const topic = ensureGraphTopic(sections);
  if (!topic) {
    summary.textContent = "No topics were found in the generated graph.";
    listTarget.innerHTML = '<div class="empty-state">The graph file loaded, but it did not contain any topics to explore.</div>';
    detailTarget.innerHTML = "";
    canvas.innerHTML = renderGraphEmptySvg("No topics available");
    return;
  }

  const candidates = graphTopicCandidates(sections);
  const entries = graphNeighborEntries(topic.id);
  const stats = appState.graph.data.stats || {};
  summary.innerHTML = `
    ${(stats.total_topics || appState.graph.data.topics.length)} topics · ${(stats.total_topic_edges || appState.graph.data.edges.length)} links
    ${currentSection ? `· current module: <strong>${escapeHtml(currentSection.title)}</strong>` : ""}
  `;

  listTarget.innerHTML = `
    <div class="graph-topic-list-head">
      <p class="panel-label">${escapeHtml(candidates.title)}</p>
      <p>${appState.graph.search ? "Search across topic labels, aliases, concepts, and module titles." : "Click any topic to center the map."}</p>
    </div>
    <div class="graph-topic-buttons">
      ${
        candidates.topics.length
          ? candidates.topics.map((candidate) => renderGraphTopicButton(candidate)).join("")
          : '<div class="empty-state">No topics match the current search.</div>'
      }
    </div>
  `;
  detailTarget.innerHTML = renderGraphDetail(topic, entries, currentSection);
  canvas.innerHTML = renderGraphSvg(topic, entries);

  document.querySelectorAll("#graph-panel [data-graph-topic-id]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.graph.topicId = button.getAttribute("data-graph-topic-id");
      saveState();
      render();
    });
  });

  document.querySelectorAll("#graph-panel [data-open-id]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedId = button.getAttribute("data-open-id");
      saveState();
      render();
      document.getElementById("detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindGraphControls() {
  const search = document.getElementById("graph-search");
  const relation = document.getElementById("graph-relation-filter");

  if (!search || !relation) {
    return;
  }

  if (search.dataset.bound === "true") {
    search.value = appState.graph.search;
    relation.value = appState.graph.relation;
    return;
  }

  search.value = appState.graph.search;
  relation.value = appState.graph.relation;
  search.dataset.bound = "true";

  search.addEventListener("input", () => {
    appState.graph.search = search.value;
    saveState();
    render();
  });

  relation.addEventListener("change", () => {
    appState.graph.relation = relation.value;
    saveState();
    render();
  });
}

function bindControls() {
  const search = document.getElementById("search-input");
  const pace = document.getElementById("pace-select");
  const hideComplete = document.getElementById("hide-complete");
  const reset = document.getElementById("reset-progress");
  const prev = document.getElementById("prev-section");
  const next = document.getElementById("next-section");

  if (search.dataset.bound === "true") {
    search.value = appState.search;
    pace.value = String(appState.pace);
    hideComplete.checked = appState.hideComplete;
    return;
  }

  search.value = appState.search;
  pace.value = String(appState.pace);
  hideComplete.checked = appState.hideComplete;
  search.dataset.bound = "true";

  search.addEventListener("input", () => {
    appState.search = search.value;
    saveState();
    render();
  });

  pace.addEventListener("change", () => {
    appState.pace = Number(pace.value) || 6;
    saveState();
    render();
  });

  hideComplete.addEventListener("change", () => {
    appState.hideComplete = hideComplete.checked;
    saveState();
    render();
  });

  reset.addEventListener("click", () => {
    const confirmed = window.confirm("Clear all saved task progress and notes for this study guide?");
    if (!confirmed) {
      return;
    }
    appState.progress = {};
    appState.notes = {};
    saveState();
    render();
  });

  prev.addEventListener("click", () => moveSelection(-1));
  next.addEventListener("click", () => moveSelection(1));
}

function render() {
  const sections = filteredSections();
  renderHeroStats();
  renderFocusPanel();
  renderPhaseFilters();
  renderSectionSummary(sections);
  renderGraphPanel(sections);
  renderRoadmap(sections);
  renderDetailPanel(sections);
  bindControls();
  bindGraphControls();
}

loadState();
render();
loadKnowledgeGraph();
