/* Supervisor dashboard (S1–S5) for the registration deduplication prototype.
 *
 *  #/flags          S1 Flag queue (delivery alerts first, then by tier)
 *  #/flags/<id>     S2 Side by side review, or S3 Delivery alert review
 *  #/insights       S5 Insights
 *
 * Same people as the worker demo data. Decisions persist in localStorage.
 */
(function () {
  "use strict";

  const STORE_KEY = "duplication-supervisor-v7";
  const TIER_RANK = { Definite: 3, Strong: 2, Low: 1 };
  const ROOT_CAUSES = ["Sync failed", "Spelling", "Info mismatch", "Area overlap", "Other"];
  const DELIVERY_CAUSES = ["Sync failed", "Area overlap", "Other"];

  // ---------- Demo flags ----------
  const SEED_FLAGS = () => [
    {
      id: "FLG-1042", type: "delivery", tier: "Definite", status: "Open", area: "Solimbo", team: "Team 2", collector: "J. Koroma", raised: "Today, 10:05", source: "Server: two deliveries on one record",
      title: "Aissatou Sow", household: "Ousmane Sow", age: "3 years 5 months", gender: "Female", round: 2,
      deliveries: [
        { time: "Yesterday, 15:05", coords: "8.48311, -13.23102", worker: "M. Kargbo (Team 1)", sync: "Succeeded, yesterday 08:02" },
        { time: "Today, 10:02", coords: "8.48309, -13.23098", worker: "J. Koroma (Team 2)", sync: "Failed. Last succeeded yesterday 07:40", failed: true }
      ]
    },
    {
      id: "FLG-1040", type: "delivery", tier: "Strong", status: "Open", area: "Kanu", team: "Team 3", collector: "F. Bangura", raised: "Today, 09:12", source: "Server: deliveries on two matched records",
      title: "Hawa Bah and Awa Bah", household: "Muhammad Bah", age: "2 years 6 months", gender: "Female", round: 2,
      note: "Two records the server matched as a Strong pair each received a vaccination this round.",
      deliveries: [
        { time: "Today, 08:40", coords: "8.49120, -13.22410", worker: "F. Bangura (Team 3)", sync: "Succeeded, today 07:55", person: "Hawa Bah" },
        { time: "Today, 09:05", coords: "8.49118, -13.22414", worker: "S. Turay (Team 3)", sync: "Succeeded, today 08:10", person: "Awa Bah" }
      ]
    },
    {
      id: "FLG-1033", type: "individual", tier: "Definite", status: "Open", area: "Lunsar", team: "Team 2", collector: "J. Koroma", raised: "Yesterday, 08:55", source: "Server match. The device had no match to show", syncFailed: true,
      title: "Alusine Koroma and Alusine Koroma", household: "Santigie Koroma",
      signals: ["Same ID number", "Same name", "Same age", "Same gender"],
      a: { id: "IND-52210", name: "Alusine Koroma", gender: "Male", age: "2 years 3 months", dob: "05/08/2024", mobile: "–", idNo: "BC-80431", by: "M. Kargbo (Team 1)", at: "10 Nov 2026", sync: "Succeeded" },
      b: { id: "IND-55910", name: "Alusine Koroma", gender: "Male", age: "2 years 3 months", dob: "05/08/2024", mobile: "–", idNo: "BC-80431", by: "J. Koroma (Team 2)", at: "Yesterday, 08:50", sync: "Failed. Last succeeded 2 days ago" }
    },
    {
      id: "FLG-1039", type: "household", tier: "Strong", status: "Open", area: "Solimbo", team: "Team 2", collector: "J. Koroma", raised: "Today, 08:47", source: "Server match. The device had no match to show",
      title: "Fatoumata Camara and Fatou Camara", distance: 35, syncFailed: true,
      signals: ["Similar head name", "35 m apart", "2 members match"],
      a: { id: "HH-20418", head: "Fatoumata Camara", coords: "8.48402, -13.22994", members: 4, by: "A. Sesay (Team 1)", at: "12 Nov 2026", sync: "Succeeded" },
      b: { id: "HH-20977", head: "Fatou Camara", coords: "8.48425, -13.23021", members: 3, by: "J. Koroma (Team 2)", at: "Today, 08:44", sync: "Failed. Last succeeded yesterday 07:40" },
      pairs: [
        { a: "Mariama Camara, F, 4 years 0 months", b: "Mariam Camara, F, 4 years 1 month", match: "Strong" },
        { a: "Mamadou Camara, M, 4 years 0 months", b: "Mamadu Camara, M, 4 years 0 months", match: "Strong" },
        { a: "Baby of Fatoumata, F, 0 years 1 month", b: "–", match: "" }
      ],
      searchTerm: "Fatou Camra"
    },
    {
      id: "FLG-1038", type: "individual", tier: "Strong", status: "Open", area: "Solimbo", team: "Team 1", collector: "A. Sesay", raised: "Yesterday, 16:20", source: "Worker added as new despite a match",
      title: "Kadiatou Kamara and Khadija Kamara", household: "Seydou Kamara",
      signals: ["Similar name", "Same age", "Same gender"], reason: "Twin or sibling",
      a: { id: "IND-55102", name: "Kadiatou Kamara", gender: "Female", age: "0 years 10 months", dob: "24/01/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "03 Nov 2026", sync: "Succeeded" },
      b: { id: "IND-55871", name: "Khadija Kamara", gender: "Female", age: "0 years 10 months", dob: "24/01/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "Yesterday, 16:18", sync: "Succeeded" }
    },
    {
      id: "FLG-1036", type: "individual", tier: "Low", status: "Open", area: "Kanu", team: "Team 3", collector: "F. Bangura", raised: "Yesterday, 11:02", source: "Worker added as new despite a match",
      title: "Husseini Bah and Husain Bah", household: "Muhammad Bah",
      signals: ["Similar name", "Same age", "Same gender"], reason: "Twin or sibling",
      a: { id: "IND-54020", name: "Husseini Bah", gender: "Male", age: "1 year 11 months", dob: "24/12/2024", mobile: "–", idNo: "–", by: "F. Bangura (Team 3)", at: "28 Oct 2026", sync: "Succeeded" },
      b: { id: "IND-55790", name: "Husain Bah", gender: "Male", age: "1 year 11 months", dob: "24/12/2024", mobile: "–", idNo: "–", by: "F. Bangura (Team 3)", at: "Yesterday, 11:00", sync: "Succeeded" }
    },
    {
      id: "FLG-1035", type: "household", tier: "Low", status: "Open", area: "Kanu", team: "Team 3", collector: "S. Turay", raised: "Yesterday, 09:30", source: "Worker created as new despite a match", reason: "Different family with a similar name",
      title: "Muhammad Bah and Mamadu Bah", distance: 48,
      signals: ["Similar head name", "48 m apart"],
      a: { id: "HH-19876", head: "Muhammad Bah", coords: "8.49120, -13.22410", members: 4, by: "F. Bangura (Team 3)", at: "28 Oct 2026", sync: "Succeeded" },
      b: { id: "HH-20903", head: "Mamadu Bah", coords: "8.49155, -13.22385", members: 2, by: "S. Turay (Team 3)", at: "Yesterday, 09:28", sync: "Succeeded" },
      pairs: [{ a: "Hawa Bah, F, 2 years 6 months", b: "Awa Bah, F, 2 years 6 months", match: "Strong" }],
      searchTerm: "Mamadu"
    },
    {
      id: "FLG-1031", type: "individual", tier: "Definite", status: "Confirmed", area: "Solimbo", team: "Team 1", collector: "A. Sesay", raised: "20 Nov 2026", source: "Worker added as new despite a match",
      title: "Mariama Camara and Mariatu Camara", household: "Fatoumata Camara", signals: ["Same ID number", "Similar name", "Same age"], rootCause: "Spelling",
      a: { id: "IND-50211", name: "Mariama Camara", gender: "Female", age: "4 years 0 months", dob: "12/11/2022", mobile: "–", idNo: "BC-77120", by: "A. Sesay (Team 1)", at: "12 Nov 2026", sync: "Succeeded" },
      b: { id: "IND-51980", name: "Mariatu Camara", gender: "Female", age: "4 years 0 months", dob: "12/11/2022", mobile: "–", idNo: "BC-77120", by: "M. Kargbo (Team 1)", at: "19 Nov 2026", sync: "Succeeded" }
    },
    {
      id: "FLG-1027", type: "individual", tier: "Strong", status: "Not a duplicate", area: "Solimbo", team: "Team 1", collector: "A. Sesay", raised: "18 Nov 2026", source: "Worker added as new despite a match",
      title: "Ibrahima Diallo and Ibrahim Diallo", household: "Mohammed Diallo", signals: ["Similar name", "Age within 1 month", "Same gender"], reason: "Twin or sibling", rootCause: "Other",
      a: { id: "IND-49870", name: "Ibrahima Diallo", gender: "Male", age: "0 years 8 months", dob: "24/03/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "02 Nov 2026", sync: "Succeeded" },
      b: { id: "IND-51203", name: "Ibrahim Diallo", gender: "Male", age: "0 years 9 months", dob: "24/02/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "18 Nov 2026", sync: "Succeeded" }
    },
    {
      id: "FLG-1024", type: "household", tier: "Strong", status: "Open", area: "Makeni Road", team: "Team 4", collector: "K. Sesay", raised: "17 Nov 2026", source: "Server match across teams",
      title: "Seydou Kamara and Saidu Kamara", distance: 22, signals: ["Similar head name", "22 m apart", "1 member matches"],
      a: { id: "HH-18440", head: "Seydou Kamara", coords: "8.48650, -13.22780", members: 3, by: "A. Sesay (Team 1)", at: "03 Nov 2026", sync: "Succeeded" },
      b: { id: "HH-20112", head: "Saidu Kamara", coords: "8.48662, -13.22795", members: 2, by: "K. Sesay (Team 4)", at: "17 Nov 2026", sync: "Succeeded" },
      pairs: [{ a: "Kadiatou Kamara, F, 0 years 10 months", b: "Kadija Kamara, F, 0 years 10 months", match: "Strong" }],
      searchTerm: "Saidu"
    }
  ];

  const SEED_ALIASES = () => [
    { id: "AL-31", names: ["Mamadou", "Mamadu"], lang: "Sierra Leone · Krio", from: "FLG-1035", term: "Mamadu", status: "Suggested" },
    { id: "AL-30", names: ["Fatou", "Fatu"], lang: "Sierra Leone · Krio", from: "FLG-1039", term: "Fatu Camara", status: "Suggested" },
    { id: "AL-29", names: ["Mariama", "Mariatu"], lang: "Sierra Leone · Krio", from: "FLG-1031", term: "Mariatu", status: "Suggested" },
    { id: "AL-28", names: ["Seydou", "Saidu"], lang: "Sierra Leone · Krio", from: "FLG-1024", term: "Saidu", status: "Suggested" },
    { id: "AL-12", names: ["Mohammed", "Muhammad", "Mamadou", "Mohd"], lang: "Sierra Leone · Krio", from: "Starter list", term: "–", status: "Approved" },
    { id: "AL-11", names: ["Fatima", "Fatou", "Fatoumata"], lang: "Sierra Leone · Krio", from: "Starter list", term: "–", status: "Approved" },
    { id: "AL-10", names: ["Kadiatou", "Khadija", "Kadija"], lang: "Sierra Leone · Krio", from: "Starter list", term: "–", status: "Approved" },
    { id: "AL-09", names: ["Aminata", "Amina"], lang: "Sierra Leone · Krio", from: "Starter list", term: "–", status: "Approved" },
    { id: "AL-22", names: ["Hawa", "Hassan"], lang: "Sierra Leone · Krio", from: "FLG-1019", term: "Hasan", status: "Rejected" }
  ];

  // Insight figures (single series each).
  const INSIGHTS = {
    team: [["Team 2", 31.6], ["Team 3", 22.4], ["Team 4", 14.8], ["Team 1", 9.3]],
    area: [["Kanu", 27.1], ["Solimbo", 18.2], ["Makeni Road", 12.6], ["Lunsar", 6.4]],
    collector: [["J. Koroma", 38.5], ["S. Turay", 24.0], ["F. Bangura", 19.7], ["K. Sesay", 14.8], ["A. Sesay", 8.1], ["M. Kargbo", 6.2]],
    cause: [["Sync failed", 41], ["Spelling", 27], ["Info mismatch", 16], ["Area overlap", 11], ["Other", 5]]
  };

  // ---------- Store ----------
  let store;
  const fresh = () => ({ flags: SEED_FLAGS(), aliases: SEED_ALIASES() });
  try { store = JSON.parse(localStorage.getItem(STORE_KEY)) || fresh(); } catch (e) { store = fresh(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } };

  const ui = { q: "", area: "", team: "", collector: "", status: "", aliasTab: "Suggested", tables: {} };

  // ---------- Helpers ----------
  const $page = document.getElementById("page");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uniq = arr => [...new Set(arr)].sort();
  const tag = (text, kind) => `<span class="tag tag-${kind}">${esc(text)}</span>`;
  const tierTag = t => t ? tag(t, { Definite: "error", Strong: "warning", Low: "success" }[t]) : `<span class="cell-sub">No match score</span>`;
  // Plain-language issue labels (what the supervisor is being asked to check).
  const ISSUE = { delivery: "Possible double vaccination", vaccination: "Vaccination record flagged", household: "Possible duplicate household", individual: "Possible duplicate person" };
  const typeTag = t => tag(ISSUE[t], t === "delivery" ? "error" : t === "vaccination" ? "warning" : "neutral");
  const TYPE_RANK = { delivery: 3, vaccination: 2 };
  const statusTag = s => tag(s, { Open: "info", Confirmed: "success", "Not a duplicate": "neutral", Suggested: "info", Approved: "success", Rejected: "neutral" }[s] || "neutral");
  const crumbs = items => `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it, i) => (i < items.length - 1 ? `<a href="${it[1]}">${esc(it[0])}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(it[0])}</span>`)).join("")}</nav>`;
  const head = (title, desc, actions = "") => `<div class="page-head"><div><h1 class="page-title">${esc(title)}</h1>${desc ? `<p class="page-desc">${esc(desc)}</p>` : ""}</div>${actions ? `<div class="head-actions">${actions}</div>` : ""}</div>`;
  const stats = list => `<div class="stats">${list.map(([n, l, alert]) => `<div class="stat ${alert ? "is-alert" : ""}"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const select = (id, label, value, options, all) => `<div class="filter"><label for="${id}">${esc(label)}</label><select class="input" id="${id}">${all ? `<option value="">${esc(all)}</option>` : ""}${options.map(o => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3000);
  }

  // ---------- S1 Flag queue ----------
  function sortedFlags() {
    // A flag queue holds only flags waiting for review; a decided flag leaves the queue.
    return store.flags.filter(f => f.status === "Open").sort((x, y) =>
      ((TYPE_RANK[y.type] || 0) - (TYPE_RANK[x.type] || 0)) ||
      ((TIER_RANK[y.tier] || 0) - (TIER_RANK[x.tier] || 0)));
  }
  function filteredFlags() {
    const q = ui.q.trim().toLowerCase();
    return sortedFlags().filter(f =>
      (!q || f.id.toLowerCase().includes(q) || f.title.toLowerCase().includes(q)) &&
      (!ui.area || f.area === ui.area) && (!ui.team || f.team === ui.team) &&
      (!ui.collector || f.collector === ui.collector));
  }
  function queueRows() {
    const rows = filteredFlags();
    if (!rows.length) return `<tr class="empty-row"><td colspan="8">No flags match your filters. <button class="link" data-action="clear">Clear filters</button></td></tr>`;
    return rows.map(f => `<tr class="${f.type === "delivery" ? "is-alert" : ""}">
        <td><span class="cell-strong">${esc(f.id)}</span><span class="cell-sub">${esc(f.raised)}</span></td>
        <td>${typeTag(f.type)}</td>
        <td>${tierTag(f.tier)}</td>
        <td>${esc(f.title)}<span class="cell-sub">${esc(f.source)}${f.reason ? ` · “${esc(f.reason)}”` : ""}</span>${f.syncFailed ? `<span class="cell-sub">Created after a failed sync</span>` : ""}</td>
        <td>${esc(f.area)}</td>
        <td>${esc(f.team)}</td>
        <td>${esc(f.collector)}</td>
        <td><a class="btn btn-secondary btn-sm" href="#/flags/${esc(f.id)}">Review</a></td>
      </tr>`).join("");
  }
  function viewFlags() {
    const all = store.flags, open = all.filter(f => f.status === "Open");
    const n = filteredFlags().length;
    return `${crumbs([["Home", "index.html"], ["Flag Queue"]])}
      ${head("Flag Queue", "Possible double vaccinations and duplicate households and people found after records sync are here. Double vaccinations come first, then the strongest match. Open a flag to compare the records and decide.")}
      ${stats([
        [open.length, "Flags to review"],
        [open.filter(f => f.type === "delivery").length, "Possible double vaccinations", true],
        [open.filter(f => f.type === "household").length, "Possible duplicate households"],
        [open.filter(f => f.type === "individual").length, "Possible duplicate people"]
      ])}
      <div class="card">
        <div class="filters">
          <div class="filter"><label for="f-q">Flag ID or name</label><input class="input" id="f-q" type="search" placeholder="Search flags" value="${esc(ui.q)}" /></div>
          ${select("f-area", "Area", ui.area, uniq(all.map(f => f.area)), "All areas")}
          ${select("f-team", "Team", ui.team, uniq(all.map(f => f.team)), "All teams")}
          ${select("f-collector", "Collector", ui.collector, uniq(all.map(f => f.collector)), "All collectors")}
          <div class="filter-actions"><button class="link" data-action="clear">Clear</button></div>
        </div>
      </div>
      <div class="card">
        <div class="table-bar"><span id="flag-count">${n} flag${n === 1 ? "" : "s"}</span></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Flag ID</th><th>Issue</th><th>Match</th><th>Records</th><th>Area</th><th>Team</th><th>Collector</th><th><span class="sr-only">Action</span></th></tr></thead>
            <tbody id="flag-rows">${queueRows()}</tbody>
          </table>
        </div>
        <div class="table-foot"><span>Rows per page 10</span><span id="flag-range">${n ? `1–${n} of ${n}` : "0 of 0"}</span></div>
      </div>`;
  }
  function refreshQueue() {
    const n = filteredFlags().length;
    document.getElementById("flag-rows").innerHTML = queueRows();
    document.getElementById("flag-count").textContent = `${n} flag${n === 1 ? "" : "s"}`;
    document.getElementById("flag-range").textContent = n ? `1–${n} of ${n}` : "0 of 0";
  }

  // ---------- Map: both household coordinates and the distance ----------
  function mapSvg(distance, labels) {
    const x2 = 120 + Math.min(220, distance * 4);
    return `<svg class="map" viewBox="0 0 400 170" role="img" aria-label="${esc(labels[0])} and ${esc(labels[1])} are ${distance} m apart">
      <rect width="400" height="170" fill="#E9EFE8"/>
      <path d="M0 120 C 80 100, 160 140, 400 95" stroke="#FFFFFF" stroke-width="10" fill="none"/>
      <path d="M210 0 L 230 170" stroke="#FFFFFF" stroke-width="6" fill="none"/>
      <rect x="40" y="20" width="60" height="40" fill="#DCE5DA"/><rect x="290" y="120" width="70" height="36" fill="#DCE5DA"/>
      <line x1="120" y1="80" x2="${x2}" y2="80" stroke="#363636" stroke-width="1.5" stroke-dasharray="4 4"/>
      <text x="${(120 + x2) / 2}" y="70" text-anchor="middle" font-size="13" font-weight="700" fill="#363636">${distance} m</text>
      <g transform="translate(120 80)"><path d="M0 0 C -9 -12 -9 -24 0 -24 C 9 -24 9 -12 0 0 Z" fill="#0B4B66"/><circle cy="-16" r="3.5" fill="#fff"/></g>
      <g transform="translate(${x2} 80)"><path d="M0 0 C -9 -12 -9 -24 0 -24 C 9 -24 9 -12 0 0 Z" fill="#C84C0E"/><circle cy="-16" r="3.5" fill="#fff"/></g>
      <text x="120" y="100" text-anchor="middle" font-size="12" fill="#363636">A</text>
      <text x="${x2}" y="100" text-anchor="middle" font-size="12" fill="#363636">B</text>
    </svg>`;
  }

  // One sync notice, same component and wording in the desktop and mobile review.
  const lastSync = s => { const m = /Last succeeded (.+)$/.exec(String(s || "")); return m ? m[1] : ""; };
  // Why the flag might have happened: shown in the summary, under the reason.
  function possibleCause(f) {
    const failed = f.type === "delivery" ? f.deliveries.map((d, i) => d.failed ? [i + 1, d.sync] : null).filter(Boolean) : f.syncFailed ? [[2, f.b.sync]] : [];
    if (!failed.length) return "";
    return failed.map(([n, sync]) => `<div class="cause-row"><dt>Possible cause</dt><dd><span class="cause-val"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>Sync failed for record ${n}</span></dd></div>`).join("");
  }
  function syncNotice(f) {
    const items = f.type === "delivery"
      ? f.deliveries.map((d, i) => d.failed ? [i + 1, `This vaccination was saved while the phone was not synced${lastSync(d.sync) ? `. Last synced ${lastSync(d.sync)}` : ""}. The worker might not have seen the other vaccination.`] : null).filter(Boolean)
      : f.syncFailed ? [[2, `This record was saved while the phone was not synced${lastSync(f.b.sync) ? `. Last synced ${lastSync(f.b.sync)}` : ""}. The worker might not have seen record 1.`]] : [];
    return items.map(([n, t]) => `<div class="sync-notice" role="note"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg><div><p class="sync-notice-title">Record ${n}: sync failed</p><p>${esc(t)}</p></div></div>`).join("");
  }

  // Same structure on every review: summary, sync notice, records, people.
  function flagSummary(f) {
    return `<div class="card card-pad">
        <dl class="flag-kv">
          <div><dt>Flag ID</dt><dd>${esc(f.id)}</dd></div>
          <div><dt>Reason</dt><dd>${esc(ISSUE[f.type])}</dd></div>
        ${possibleCause(f)}
          <div><dt>Match</dt><dd>${tierTag(f.tier)}</dd></div>
          <div><dt>Area</dt><dd>${esc(f.area)}</dd></div>
          <div><dt>Team</dt><dd>${esc(f.team)}</dd></div>
          ${f.reason ? `<div><dt>Worker’s reason</dt><dd>${esc(f.reason)}</dd></div>` : ""}
        </dl>
      </div>`;
  }
  // ---------- S2 Side by side review ----------
  // Two record containers side by side inside the main container (DIGIT secondary containers).
  // Each compared field is highlighted in both records: same (green), similar (amber) or different (red).
  // rows: [label, valueA, valueB, kind] where kind is false (not compared), "similar", or omitted (same/different by value).
  const MATCH_LABEL = { same: "Same", similar: "Similar", diff: "Different" };
  function matchKind(va, vb, kind) {
    if (kind === false) return "";
    if (String(va) === "–" && String(vb) === "–") return "";
    if (String(va) === String(vb)) return "same";
    return kind === "similar" ? "similar" : "diff";
  }
  function recPanel(uid, title, idText, rows, side) {
    return `<section class="rec" aria-labelledby="rec-${uid}">
        <header class="rec-head"><h3 id="rec-${uid}">${esc(title)}</h3>${idText ? `<span class="rec-id">${esc(idText)}</span>` : ""}</header>
        <dl class="rec-rows">${rows.map(([l, va, vb, kind]) => {
          const v = side === "A" ? va : vb, k = matchKind(String(va).split(" · ")[0], String(vb).split(" · ")[0], kind);
          const val = esc(v).replace(/ · (.+)$/, '<span class="rec-sub">$1</span>');
          return `<div class="${k ? `m-${k}` : ""}"><dt>${esc(l)}</dt><dd>${val}${k ? `<span class="sr-only"> (${MATCH_LABEL[k].toLowerCase()})</span>` : ""}</dd></div>`;
        }).join("")}</dl>
      </section>`;
  }
  const LEGEND = `<ul class="m-legend" aria-label="Highlight key"><li class="m-same">Same</li><li class="m-similar">Similar</li><li class="m-diff">Different</li></ul>`;
  function recordPanels(rows, a, b) {
    return `${LEGEND}<div class="rec-pair">${recPanel("A", "Record 1", a.id, rows, "A")}${recPanel("B", "Record 2", b.id, rows, "B")}</div>`;
  }
  // People in both households: each pair uses the same Household A / Household B containers and highlights.
  function personPairs(pairs) {
    const parse = s => { if (!s || s === "–") return null; const [name, g, age] = s.split(", "); return { name, gender: { F: "Female", M: "Male" }[g] || g, age }; };
    return pairs.map((p, i) => {
      const a = parse(p.a), b = parse(p.b);
      const rows = b ? [["Name", a.name, b.name, "similar"], ["Gender", a.gender, b.gender], ["Age", a.age, b.age, "similar"]]
                     : [["Name", a.name, "", false], ["Gender", a.gender, "", false], ["Age", a.age, "", false]];
      return `<div class="person-pair">
          <div class="person-pair-head"><h4>Person ${i + 1}</h4>${p.match ? tierTag(p.match) : `<span class="pair-none">No match in record 2</span>`}</div>
          <div class="rec-pair">${recPanel(`p${i}A`, "Record 1", "", rows, "A")}${b ? recPanel(`p${i}B`, "Record 2", "", rows, "B")
            : `<section class="rec rec-empty" aria-labelledby="rec-p${i}B"><header class="rec-head"><h3 id="rec-p${i}B">Record 2</h3></header><p>No matching person in record 2.</p></section>`}</div>
        </div>`;
    }).join("");
  }
  function cmpTable(rows, aTitle, bTitle) {
    return `<table class="cmp">
      <caption class="sr-only">Record 1 compared with record 2</caption>
      <thead><tr><th scope="col">Field</th><th scope="col">${aTitle}</th><th scope="col">${bTitle}</th></tr></thead>
      <tbody>${rows.map(([l, a, b, check = true]) => { const d = check && String(a) !== String(b); return `<tr><th scope="row">${esc(l)}</th><td>${esc(a)}</td><td class="${d ? "is-diff" : ""}">${esc(b)}${d ? '<span class="sr-only"> (different)</span>' : ""}</td></tr>`; }).join("")}</tbody>
    </table>`;
  }
  function decisionCard(f, kind) {
    const done = f.status !== "Open";
    const causes = kind === "delivery" ? DELIVERY_CAUSES : ROOT_CAUSES;
    const choices = kind === "vaccination"
      ? [["Confirmed", "Confirm flag", "The vaccination record is wrong. It is marked as wrong and the child shows not vaccinated, so the worker can vaccinate."],
         ["Not a duplicate", "Record is correct", "The vaccination record stands."]]
      : kind === "delivery"
      ? [["Confirmed", "Confirm double vaccination", "The child was vaccinated twice this round."],
         ["Not a duplicate", "Not a duplicate", "For example, the wrong member was marked as vaccinated."]]
      : [["Confirmed", "Confirm duplicate", "Mark both records as the same and link them. Both records are kept."],
         ["Not a duplicate", "Not a duplicate", "This pair won’t be flagged again unless a record changes."]];
    const options = `<fieldset class="decide"><legend class="section-label">Decision</legend>
          ${choices
            .map(([v, l, s]) => `<label class="radio"><input type="radio" name="decision" value="${v}" ${f.status === v ? "checked" : ""} ${done ? "disabled" : ""}/><span>${l}<small>${s}</small></span></label>`).join("")}
          <p class="err" id="decision-err" hidden>Select a decision</p>
        </fieldset>`;
    return `<div class="card card-pad">
      ${options}
      <div class="field">
        <label for="root-cause">Reason for decision</label>
        <select class="input" id="root-cause" ${done ? "disabled" : ""}><option value="">Select</option>${causes.map(c => `<option ${f.rootCause === c ? "selected" : ""}>${c}</option>`).join("")}</select>
        <p class="err" id="cause-err" hidden>Select a reason for the decision</p>
      </div>
      <div class="field">
        <label for="comment">Comment</label>
        <textarea class="input" id="comment" ${done ? "disabled" : ""}>${esc(f.comment || "")}</textarea>
      </div>
      ${done ? `<p class="done-note">${esc(f.status)}${f.rootCause ? ` · Reason: ${esc(f.rootCause)}` : ""}</p>`
        : `<div class="card-actions"><a class="btn btn-secondary" href="#/flags">Cancel</a><button class="btn btn-primary" data-action="save-decision" data-id="${esc(f.id)}">Save Decision</button></div>`}
    </div>`;
  }
  function viewReview(f) {
    const isHH = f.type === "household";
    const rows = isHH
      ? [["Household head", f.a.head, f.b.head, "similar"], ["Number of members", f.a.members, f.b.members], ["Household coordinates", f.a.coords, `${f.b.coords} · ${f.distance} m from record 1`, false],
         ["Created by", f.a.by, f.b.by, false], ["Created", f.a.at, f.b.at, false]]
      : [["Full name", f.a.name, f.b.name, "similar"], ["Gender", f.a.gender, f.b.gender], ["Age", f.a.age, f.b.age, "similar"], ["Date of birth", f.a.dob, f.b.dob, "similar"],
         ["ID number", f.a.idNo, f.b.idNo], ["Household", f.household, f.household], ["Created by", f.a.by, f.b.by, false], ["Created", f.a.at, f.b.at, false]];
    return `${crumbs([["Home", "index.html"], ["Flag Queue", "#/flags"], [f.id]])}
      ${head("Review Duplicates", "")}
      <div class="review-grid">
        <div class="review-main">
          ${flagSummary(f)}
          <div class="card card-pad">
            <h2 class="card-title">${isHH ? "Households" : "People"}</h2>
            ${recordPanels(rows, f.a, f.b)}
          </div>
          ${isHH ? `<div class="card card-pad"><h2 class="card-title">People in both households</h2>${personPairs(f.pairs)}</div>` : ""}
        </div>
        <div class="review-side">
          ${decisionCard(f, "review")}
        </div>
      </div>`;
  }

  // ---------- Vaccination record flagged by a worker ----------
  function viewWorkerFlag(f) {
    const c = f.child, d = f.delivery;
    return `${crumbs([["Home", "index.html"], ["Flag Queue", "#/flags"], [f.id]])}
      ${head("Review Flagged Vaccination", "A frontline worker flagged this vaccination record. Check the record and the worker’s reason, then decide.")}
      <div class="signals">${typeTag(f.type)}${d.failed ? tag("Recorded after a failed sync", "warning") : ""}</div>
      <div class="review-grid">
        <div>
          <div class="card card-pad">
            <h2 class="card-title">${esc(f.title)}</h2>
            <p class="card-sub">Household: ${esc(f.household)} · Flagged by ${esc(f.flaggedBy)} · ${esc(f.raised)}</p>
            <div class="rec-pair">
              <section class="rec" aria-labelledby="wf-child"><header class="rec-head"><h3 id="wf-child">Child</h3><span class="rec-id">${esc(c.id)}</span></header>
                <dl class="rec-rows"><div><dt>Full name</dt><dd>${esc(c.name)}</dd></div><div><dt>Gender</dt><dd>${esc(c.gender)}</dd></div><div><dt>Age</dt><dd>${esc(c.age)}</dd></div><div><dt>Date of birth</dt><dd>${esc(c.dob)}</dd></div></dl></section>
              <section class="rec" aria-labelledby="wf-vac"><header class="rec-head"><h3 id="wf-vac">Vaccination record</h3></header>
                <dl class="rec-rows"><div><dt>Time</dt><dd>${esc(d.time)}</dd></div><div><dt>Household coordinates</dt><dd>${esc(d.coords)}</dd></div><div><dt>Worker</dt><dd>${esc(d.worker)}</dd></div><div class="${d.failed ? "is-diff" : ""}"><dt>Device sync</dt><dd>${esc(d.sync)}</dd></div></dl></section>
            </div>
            <div class="rec-notes">
              <div><h3>Worker’s reason</h3><p>“${esc(f.reason)}”${f.note ? `. ${esc(f.note)}` : ""}</p></div>
            </div>
          </div>
        </div>
        <div class="review-side">${decisionCard(f, "vaccination")}</div>
      </div>`;
  }

  // ---------- S3 Delivery alert review ----------
  function viewAlert(f) {
    const [d1, d2] = f.deliveries;
    const rows = [["Child", d1.person || f.title, d2.person || f.title, "similar"], ["Gender", f.gender, f.gender], ["Age", f.age, f.age], ["Household", f.household, f.household], ["Round", f.round, f.round],
      ["Vaccinated", d1.time, d2.time, false], ["Household coordinates", d1.coords, d2.coords, false], ["Worker", d1.worker, d2.worker, false]];
    return `${crumbs([["Home", "index.html"], ["Flag Queue", "#/flags"], [f.id]])}
      ${head("Review Duplicates", "")}
      <div class="review-grid">
        <div class="review-main">
          ${flagSummary(f)}
          <div class="card card-pad">
            <h2 class="card-title">Vaccinations</h2>
            ${recordPanels(rows, { id: "" }, { id: "" })}
          </div>
        </div>
        <div class="review-side">${decisionCard(f, "delivery")}</div>
      </div>`;
  }

  // ---------- S4 Alias map ----------
  function viewAliases() {
    const all = store.aliases, count = s => all.filter(a => a.status === s).length;
    const list = all.filter(a => a.status === ui.aliasTab);
    const rows = list.length ? list.map(a => `<tr>
        <td><div class="alias-names">${a.names.map(n => tag(n, "neutral")).join("")}</div></td>
        <td>${esc(a.lang)}</td>
        <td>${a.from.startsWith("FLG") ? `<a class="link" href="#/flags/${esc(a.from)}">${esc(a.from)}</a><span class="cell-sub">Searched “${esc(a.term)}”</span>` : esc(a.from)}</td>
        <td>${statusTag(a.status)}</td>
        <td>${a.status === "Suggested" ? `<div class="row-actions"><button class="btn btn-primary btn-sm" data-action="alias" data-id="${a.id}" data-to="Approved">Approve</button><button class="btn btn-secondary btn-sm" data-action="alias" data-id="${a.id}" data-to="Rejected">Reject</button></div>` : "–"}</td>
      </tr>`).join("") : `<tr class="empty-row"><td colspan="5">No ${ui.aliasTab.toLowerCase()} name groups.</td></tr>`;
    return `${crumbs([["Home", "index.html"], ["Alias Map"]])}
      ${head("Alias Map", "Spelling variants that count as the same name in search and matching. Suggestions come from searches that found nothing before a duplicate was confirmed. Nothing is added until you approve it.")}
      ${stats([[count("Suggested"), "Suggested"], [count("Approved"), "Approved"], [count("Rejected"), "Rejected"]])}
      <div class="card">
        <div class="tabs" role="tablist" aria-label="Alias status">
          ${["Suggested", "Approved", "Rejected"].map(t => `<button class="tab" role="tab" aria-selected="${ui.aliasTab === t}" data-action="alias-tab" data-tab="${t}">${t} (${count(t)})</button>`).join("")}
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Names that count as the same</th><th>Country and language</th><th>Suggested from</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ---------- S5 Insights ----------
  function barCard(key, title, sub, unit, fmt) {
    const data = INSIGHTS[key], max = Math.max(...data.map(d => d[1]));
    const asTable = ui.tables[key];
    const body = asTable
      ? `<table class="cmp"><thead><tr><th scope="col">${esc(title.split(" by ")[1] || "Item")}</th><th scope="col">${esc(unit)}</th></tr></thead><tbody>${data.map(([l, v]) => `<tr><th scope="row" style="color:var(--text)">${esc(l)}</th><td>${fmt(v)}</td></tr>`).join("")}</tbody></table>`
      : `<ul class="bars">${data.map(([l, v]) => `<li class="bar-row" tabindex="0">
            <span class="bar-label">${esc(l)}</span>
            <span class="bar-track"><span class="bar" style="width:${(v / max) * 100}%"></span></span>
            <span class="bar-val">${fmt(v)}</span>
            <span class="bar-tip" role="tooltip">${esc(l)}: ${fmt(v)} ${esc(unit.toLowerCase())}</span>
          </li>`).join("")}</ul>`;
    return `<div class="card card-pad">
      <h2 class="card-title">${esc(title)}</h2>
      <p class="card-sub">${esc(sub)}</p>
      ${body}
      <button class="link toggle-table" data-action="toggle-table" data-key="${key}">${asTable ? "Show as Chart" : "Show as Table"}</button>
    </div>`;
  }
  // ---------- S5 Duplication Dashboard ----------
  // Palette: first five categorical slots of the dataviz reference palette (validated: adjacent CVD ΔE 9.1,
  // normal-vision 19.6). Three slots sit under 3:1 on white, so every slice has a labelled legend row and a table view.
  const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
  const TREND = [["Day 1", 9.8], ["Day 2", 12.4], ["Day 3", 21.7], ["Day 4", 24.9], ["Day 5", 19.2], ["Day 6", 16.0], ["Day 7", 14.1]];

  function donutCard(key, title, sub, data, unit) {
    const total = data.reduce((s, d) => s + d[1], 0);
    const R = 70, r = 44, C = 90;
    let a0 = -Math.PI / 2;
    const arcs = data.map(([label, v], i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${(C + rad * Math.cos(ang)).toFixed(2)} ${(C + rad * Math.sin(ang)).toFixed(2)}`;
      const path = `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
      a0 = a1;
      const pct = Math.round((v / total) * 100);
      return `<path class="slice" d="${path}" fill="${SERIES[i]}" tabindex="0" data-tip="${esc(label)}: ${v} ${esc(unit)} (${pct}%)"><title>${esc(label)}: ${v} (${pct}%)</title></path>`;
    }).join("");
    const legend = data.map(([label, v], i) => `<li><span class="sw" style="background:${SERIES[i]}"></span><span class="lg-label">${esc(label)}</span><span class="lg-val">${v}</span><span class="lg-pct">${Math.round((v / total) * 100)}%</span></li>`).join("");
    const body = ui.tables[key]
      ? `<table class="cmp"><thead><tr><th scope="col">Item</th><th scope="col">${esc(unit)}</th><th scope="col">Share</th></tr></thead><tbody>${data.map(([l, v]) => `<tr><th scope="row" style="color:var(--text)">${esc(l)}</th><td>${v}</td><td>${Math.round((v / total) * 100)}%</td></tr>`).join("")}</tbody></table>`
      : `<div class="donut-wrap">
          <svg class="donut" viewBox="0 0 180 180" role="img" aria-label="${esc(title)}">${arcs}
            <text x="90" y="86" text-anchor="middle" class="donut-total">${total}</text>
            <text x="90" y="106" text-anchor="middle" class="donut-unit">${esc(unit)}</text>
          </svg>
          <ul class="legend">${legend}</ul>
        </div>`;
    return `<div class="card card-pad chart-card">
      <h2 class="card-title">${esc(title)}</h2>
      <p class="card-sub">${esc(sub)}</p>
      ${body}
      <button class="link toggle-table" data-action="toggle-table" data-key="${key}">${ui.tables[key] ? "Show as Chart" : "Show as Table"}</button>
    </div>`;
  }

  function trendCard() {
    const W = 520, H = 200, L = 36, B = 28, T = 12, Rr = 12;
    const max = 30, xs = i => L + (i * (W - L - Rr)) / (TREND.length - 1), ys = v => T + (1 - v / max) * (H - T - B);
    const grid = [0, 10, 20, 30].map(g => `<line x1="${L}" x2="${W - Rr}" y1="${ys(g)}" y2="${ys(g)}" class="grid"/><text x="${L - 8}" y="${ys(g) + 4}" text-anchor="end" class="axis">${g}</text>`).join("");
    const line = TREND.map(([, v], i) => `${i ? "L" : "M"} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(" ");
    const pts = TREND.map(([d, v], i) => `<g class="pt" tabindex="0" data-tip="${d}: ${v} per 1,000"><rect x="${xs(i) - 22}" y="${T}" width="44" height="${H - T - B}" class="hit"/><circle cx="${xs(i)}" cy="${ys(v)}" r="4"/><text x="${xs(i)}" y="${H - 8}" text-anchor="middle" class="axis">${d}</text><title>${d}: ${v} per 1,000 registrations</title></g>`).join("");
    const body = ui.tables.trend
      ? `<table class="cmp"><thead><tr><th scope="col">Day</th><th scope="col">Per 1,000 registrations</th></tr></thead><tbody>${TREND.map(([d, v]) => `<tr><th scope="row" style="color:var(--text)">${d}</th><td>${v.toFixed(1)}</td></tr>`).join("")}</tbody></table>`
      : `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Duplicates per 1,000 registrations by day, round 2">${grid}<path d="${line}" class="trend-line"/>${pts}</svg>`;
    return `<div class="card card-pad chart-card">
      <h2 class="card-title">Duplicates over the round</h2>
      <p class="card-sub">Confirmed duplicates per 1,000 registrations, by day of round 2.</p>
      ${body}
      <button class="link toggle-table" data-action="toggle-table" data-key="trend">${ui.tables.trend ? "Show as Chart" : "Show as Table"}</button>
    </div>`;
  }

  function viewDashboard() {
    const per = v => v.toFixed(1);
    const open = store.flags.filter(f => f.status === "Open");
    const issues = [["Possible duplicate person", open.filter(f => f.type === "individual").length], ["Possible duplicate household", open.filter(f => f.type === "household").length], ["Possible double vaccination", open.filter(f => f.type === "delivery").length], ["Vaccination record flagged", open.filter(f => f.type === "vaccination").length]].filter(d => d[1] > 0);
    const kpi = (n, l, note, alert) => `<div class="kpi ${alert ? "is-alert" : ""}"><span class="kpi-num">${n}</span><span class="kpi-label">${l}</span><span class="kpi-note">${note}</span></div>`;
    return `${crumbs([["Home", "index.html"], ["Duplication Dashboard"]])}
      ${head("Duplication Dashboard", "See how many duplicates are found, where they come from and why. Use this to plan support and training for this round.", `<a class="btn btn-primary" href="#/flags">Go to Flag Queue</a>`)}
      <div class="kpis">
        ${kpi("18.4", "Duplicates per 1,000 registrations", "Round 2")}
        ${kpi("23", "Confirmed duplicates", "Round 2")}
        ${kpi(open.length, "Flags to review", `${open.filter(f => f.type === "delivery").length} possible double vaccinations`, true)}
        ${kpi("7%", "Registrations after a failed sync", "Of all registrations this round")}
      </div>
      <div class="dash-grid">
        ${donutCard("cause", "Duplicates by root cause", "Confirmed duplicates this round, by the root cause tagged in review.", [["Sync failed", 9], ["Spelling", 6], ["Info mismatch", 4], ["Area overlap", 3], ["Other", 1]], "duplicates")}
        ${donutCard("issue", "Flags to review by issue", "Open flags in the queue right now.", issues, "flags")}
        ${trendCard()}
        ${barCard("team", "Duplicates by team", "Confirmed duplicates per 1,000 registrations, round 2.", "Per 1,000 registrations", per)}
        ${barCard("area", "Duplicates by area", "Confirmed duplicates per 1,000 registrations, round 2.", "Per 1,000 registrations", per)}
        ${barCard("collector", "Duplicates by collector", "Confirmed duplicates per 1,000 registrations, round 2.", "Per 1,000 registrations", per)}
      </div>
      <div class="chart-tip" id="chart-tip" role="tooltip" hidden></div>
      <p class="chart-note">Figures are demo data for the prototype.</p>`;
  }

  // ---------- Router ----------
  const TITLES = { flags: "Flag Queue" };
  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "flags").split("/");
    const section = TITLES[parts[0]] ? parts[0] : "flags";
    let html, title = TITLES[section];
    if (section === "flags" && parts[1]) {
      const f = store.flags.find(x => x.id === parts[1]);
      if (f) { html = f.type === "delivery" ? viewAlert(f) : f.type === "vaccination" ? viewWorkerFlag(f) : viewReview(f); title = "Review Duplicates"; }
    }
    if (!html) html = viewFlags();
    $page.innerHTML = html;
    document.title = `${title} – Duplication Flow`;
    document.querySelectorAll(".sidenav a").forEach(a => (a.dataset.nav === (section === "insights" ? "dashboard" : section) ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    window.scrollTo(0, 0);
    $page.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", route);

  // ---------- Actions ----------
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const a = b.dataset.action;
    if (a === "help") return toast("Review delivery alerts first. Every decision needs a reason.");
    if (a === "clear") { Object.assign(ui, { q: "", area: "", team: "", collector: "" }); return route(); }
    if (a === "alias-tab") { ui.aliasTab = b.dataset.tab; return route(); }
    if (a === "alias") {
      const al = store.aliases.find(x => x.id === b.dataset.id); al.status = b.dataset.to; save(); route();
      return toast(b.dataset.to === "Approved" ? `${al.names.join(" and ")} now count as the same name. Devices get this in the next sync.` : "Suggestion rejected. It won’t be suggested again.");
    }
    if (a === "toggle-table") { ui.tables[b.dataset.key] = !ui.tables[b.dataset.key]; return route(); }
    if (a === "save-decision" || a === "mark-reviewed") {
      const f = store.flags.find(x => x.id === b.dataset.id);
      const decision = a === "mark-reviewed" ? "Reviewed" : (document.querySelector('input[name="decision"]:checked') || {}).value;
      const cause = document.getElementById("root-cause").value;
      const de = document.getElementById("decision-err"), ce = document.getElementById("cause-err");
      if (de) de.hidden = !!decision;
      ce.hidden = !!cause;
      if (!decision || !cause) return (decision ? document.getElementById("root-cause") : document.querySelector('input[name="decision"]')).focus();
      f.status = decision; f.rootCause = cause; f.comment = document.getElementById("comment").value; save();
      location.hash = "#/flags";
      toast(f.type === "vaccination"
        ? { Confirmed: `${f.id} confirmed. The vaccination record is marked as wrong.`, "Not a duplicate": `${f.id} closed. The vaccination record stands.` }[decision]
        : { Confirmed: f.type === "delivery" ? `${f.id} confirmed as a double delivery.` : `${f.id} confirmed as a duplicate. The records are linked.`, "Not a duplicate": `${f.id} marked not a duplicate. It won’t be raised again.` }[decision]);
    }
  });
  function showTip(el, x, y) {
    const tip = document.getElementById("chart-tip");
    if (!tip) return;
    tip.textContent = el.dataset.tip; tip.hidden = false;
    tip.style.left = `${x + 12}px`; tip.style.top = `${y + 12}px`;
  }
  document.addEventListener("mousemove", e => {
    const el = e.target.closest("[data-tip]");
    const tip = document.getElementById("chart-tip");
    if (el) showTip(el, e.clientX, e.clientY); else if (tip) tip.hidden = true;
  });
  document.addEventListener("focusin", e => {
    const el = e.target.closest("[data-tip]");
    if (el) { const r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); }
  });

  document.addEventListener("input", e => {
    const map = { "f-q": "q", "f-area": "area", "f-team": "team", "f-collector": "collector" };
    if (map[e.target.id]) { ui[map[e.target.id]] = e.target.value; refreshQueue(); }
    if (e.target.id === "root-cause") document.getElementById("cause-err").hidden = true;
    if (e.target.name === "decision") document.getElementById("decision-err").hidden = true;
  });

  route();
})();
