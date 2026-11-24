/* Supervisor dashboard (S1–S5) for the registration deduplication prototype.
 *
 *  #/flags          S1 Flag queue (delivery alerts first, then by tier)
 *  #/flags/<id>     S2 Side by side review, or S3 Delivery alert review
 *  #/aliases        S4 Alias map
 *  #/insights       S5 Insights
 *
 * Same people as the worker demo data. Decisions persist in localStorage.
 */
(function () {
  "use strict";

  const STORE_KEY = "duplication-supervisor-v2";
  const TIER_RANK = { Definite: 3, Strong: 2, Low: 1 };
  const ROOT_CAUSES = ["Sync failed", "Spelling", "Info mismatch", "Area overlap", "Other"];
  const DELIVERY_CAUSES = ["Sync failed", "Area overlap", "Other"];

  // ---------- Demo flags ----------
  const SEED_FLAGS = () => [
    {
      id: "FLG-1042", type: "delivery", tier: "Definite", status: "Open", area: "Solimbo", team: "Team 2", collector: "J. Koroma", raised: "Today, 10:05",
      title: "Aissatou Sow", household: "Ousmane Sow", age: "3 years 5 months", gender: "Female", round: 2,
      deliveries: [
        { time: "Yesterday, 15:05", coords: "8.48311, -13.23102", worker: "M. Kargbo (Team 1)", sync: "Succeeded, yesterday 08:02" },
        { time: "Today, 10:02", coords: "8.48309, -13.23098", worker: "J. Koroma (Team 2)", sync: "Failed. Last succeeded yesterday 07:40", failed: true }
      ]
    },
    {
      id: "FLG-1040", type: "delivery", tier: "Strong", status: "Open", area: "Kanu", team: "Team 3", collector: "F. Bangura", raised: "Today, 09:12",
      title: "Hawa Bah and Awa Bah", household: "Muhammad Bah", age: "2 years 6 months", gender: "Female", round: 2,
      note: "Two records the server matched as a Strong pair each received a vaccination this round.",
      deliveries: [
        { time: "Today, 08:40", coords: "8.49120, -13.22410", worker: "F. Bangura (Team 3)", sync: "Succeeded, today 07:55", person: "Hawa Bah" },
        { time: "Today, 09:05", coords: "8.49118, -13.22414", worker: "S. Turay (Team 3)", sync: "Succeeded, today 08:10", person: "Awa Bah" }
      ]
    },
    {
      id: "FLG-1039", type: "household", tier: "Strong", status: "Open", area: "Solimbo", team: "Team 2", collector: "J. Koroma", raised: "Today, 08:47",
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
      id: "FLG-1038", type: "individual", tier: "Strong", status: "Open", area: "Solimbo", team: "Team 1", collector: "A. Sesay", raised: "Yesterday, 16:20",
      title: "Kadiatou Kamara and Khadija Kamara", household: "Seydou Kamara",
      signals: ["Similar name", "Same age", "Same gender"], reason: "Twin or sibling",
      a: { id: "IND-55102", name: "Kadiatou Kamara", gender: "Female", age: "0 years 10 months", dob: "24/01/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "03 Nov 2026", sync: "Succeeded" },
      b: { id: "IND-55871", name: "Khadija Kamara", gender: "Female", age: "0 years 10 months", dob: "24/01/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "Yesterday, 16:18", sync: "Succeeded" }
    },
    {
      id: "FLG-1036", type: "individual", tier: "Low", status: "Open", area: "Kanu", team: "Team 3", collector: "F. Bangura", raised: "Yesterday, 11:02",
      title: "Husseini Bah and Husain Bah", household: "Muhammad Bah",
      signals: ["Similar name", "Same age", "Same gender"], reason: "Twin or sibling",
      a: { id: "IND-54020", name: "Husseini Bah", gender: "Male", age: "1 year 11 months", dob: "24/12/2024", mobile: "–", idNo: "–", by: "F. Bangura (Team 3)", at: "28 Oct 2026", sync: "Succeeded" },
      b: { id: "IND-55790", name: "Husain Bah", gender: "Male", age: "1 year 11 months", dob: "24/12/2024", mobile: "–", idNo: "–", by: "F. Bangura (Team 3)", at: "Yesterday, 11:00", sync: "Succeeded" }
    },
    {
      id: "FLG-1035", type: "household", tier: "Low", status: "Open", area: "Kanu", team: "Team 3", collector: "S. Turay", raised: "Yesterday, 09:30",
      title: "Muhammad Bah and Mamadu Bah", distance: 48,
      signals: ["Similar head name", "48 m apart"],
      a: { id: "HH-19876", head: "Muhammad Bah", coords: "8.49120, -13.22410", members: 4, by: "F. Bangura (Team 3)", at: "28 Oct 2026", sync: "Succeeded" },
      b: { id: "HH-20903", head: "Mamadu Bah", coords: "8.49155, -13.22385", members: 2, by: "S. Turay (Team 3)", at: "Yesterday, 09:28", sync: "Succeeded" },
      pairs: [{ a: "Hawa Bah, F, 2 years 6 months", b: "Awa Bah, F, 2 years 6 months", match: "Strong" }],
      searchTerm: "Mamadu"
    },
    {
      id: "FLG-1031", type: "individual", tier: "Definite", status: "Confirmed", area: "Solimbo", team: "Team 1", collector: "A. Sesay", raised: "20 Nov 2026",
      title: "Mariama Camara and Mariatu Camara", household: "Fatoumata Camara", signals: ["Same ID number", "Similar name", "Same age"], rootCause: "Spelling",
      a: { id: "IND-50211", name: "Mariama Camara", gender: "Female", age: "4 years 0 months", dob: "12/11/2022", mobile: "–", idNo: "BC-77120", by: "A. Sesay (Team 1)", at: "12 Nov 2026", sync: "Succeeded" },
      b: { id: "IND-51980", name: "Mariatu Camara", gender: "Female", age: "4 years 0 months", dob: "12/11/2022", mobile: "–", idNo: "BC-77120", by: "M. Kargbo (Team 1)", at: "19 Nov 2026", sync: "Succeeded" }
    },
    {
      id: "FLG-1027", type: "individual", tier: "Strong", status: "Not a duplicate", area: "Solimbo", team: "Team 1", collector: "A. Sesay", raised: "18 Nov 2026",
      title: "Ibrahima Diallo and Ibrahim Diallo", household: "Mohammed Diallo", signals: ["Similar name", "Age within 1 month", "Same gender"], reason: "Twin or sibling", rootCause: "Other",
      a: { id: "IND-49870", name: "Ibrahima Diallo", gender: "Male", age: "0 years 8 months", dob: "24/03/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "02 Nov 2026", sync: "Succeeded" },
      b: { id: "IND-51203", name: "Ibrahim Diallo", gender: "Male", age: "0 years 9 months", dob: "24/02/2026", mobile: "–", idNo: "–", by: "A. Sesay (Team 1)", at: "18 Nov 2026", sync: "Succeeded" }
    },
    {
      id: "FLG-1024", type: "household", tier: "Strong", status: "Open", area: "Makeni Road", team: "Team 4", collector: "K. Sesay", raised: "17 Nov 2026",
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
  const tierTag = t => tag(t, { Definite: "error", Strong: "warning", Low: "success" }[t]);
  const typeTag = t => (t === "delivery" ? tag("Delivery alert", "error") : tag(t === "household" ? "Household" : "Individual", "neutral"));
  const statusTag = s => tag(s, { Open: "info", Confirmed: "success", "Not a duplicate": "neutral", Suggested: "info", Approved: "success", Rejected: "neutral" }[s] || "neutral");
  const crumbs = items => `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it, i) => (i < items.length - 1 ? `<a href="${it[1]}">${esc(it[0])}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(it[0])}</span>`)).join("")}</nav>`;
  const head = (title, desc, actions = "") => `<div class="page-head"><div><h1 class="page-title">${esc(title)}</h1><p class="page-desc">${esc(desc)}</p></div>${actions ? `<div class="head-actions">${actions}</div>` : ""}</div>`;
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
    return [...store.flags].sort((x, y) =>
      ((y.type === "delivery") - (x.type === "delivery")) ||
      ((x.status === "Open" ? 0 : 1) - (y.status === "Open" ? 0 : 1)) ||
      (TIER_RANK[y.tier] - TIER_RANK[x.tier]));
  }
  function filteredFlags() {
    const q = ui.q.trim().toLowerCase();
    return sortedFlags().filter(f =>
      (!q || f.id.toLowerCase().includes(q) || f.title.toLowerCase().includes(q)) &&
      (!ui.area || f.area === ui.area) && (!ui.team || f.team === ui.team) &&
      (!ui.collector || f.collector === ui.collector) && (!ui.status || f.status === ui.status));
  }
  function queueRows() {
    const rows = filteredFlags();
    if (!rows.length) return `<tr class="empty-row"><td colspan="9">No flags match your filters. <button class="link" data-action="clear">Clear filters</button></td></tr>`;
    return rows.map(f => `<tr class="${f.type === "delivery" && f.status === "Open" ? "is-alert" : ""}">
        <td><span class="cell-strong">${esc(f.id)}</span><span class="cell-sub">${esc(f.raised)}</span></td>
        <td>${typeTag(f.type)}</td>
        <td>${tierTag(f.tier)}</td>
        <td>${esc(f.title)}${f.syncFailed ? `<span class="cell-sub">Created after a failed sync</span>` : ""}</td>
        <td>${esc(f.area)}</td>
        <td>${esc(f.team)}</td>
        <td>${esc(f.collector)}</td>
        <td>${statusTag(f.status)}</td>
        <td><a class="btn btn-secondary btn-sm" href="#/flags/${esc(f.id)}">${f.status === "Open" ? "Review" : "View"}</a></td>
      </tr>`).join("");
  }
  function viewFlags() {
    const all = store.flags, open = all.filter(f => f.status === "Open");
    const n = filteredFlags().length;
    return `${crumbs([["Home", "index.html"], ["Flag Queue"]])}
      ${head("Flag Queue", "Possible duplicates and double deliveries found after records sync are here. Delivery alerts come first, then flags by match strength. Open a flag to compare the records and decide.")}
      ${stats([
        [open.length, "Open flags"],
        [open.filter(f => f.type === "delivery").length, "Delivery alerts", true],
        [all.filter(f => f.status === "Confirmed").length, "Confirmed duplicates"],
        [all.filter(f => f.status === "Not a duplicate").length, "Not a duplicate"]
      ])}
      <div class="card">
        <div class="filters">
          <div class="filter"><label for="f-q">Flag ID or name</label><input class="input" id="f-q" type="search" placeholder="Search flags" value="${esc(ui.q)}" /></div>
          ${select("f-area", "Area", ui.area, uniq(all.map(f => f.area)), "All areas")}
          ${select("f-team", "Team", ui.team, uniq(all.map(f => f.team)), "All teams")}
          ${select("f-collector", "Collector", ui.collector, uniq(all.map(f => f.collector)), "All collectors")}
          ${select("f-status", "Status", ui.status, ["Open", "Confirmed", "Not a duplicate"], "All statuses")}
          <div class="filter-actions"><button class="link" data-action="clear">Clear</button></div>
        </div>
      </div>
      <div class="card">
        <div class="table-bar"><span id="flag-count">${n} flag${n === 1 ? "" : "s"}</span></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Flag ID</th><th>Type</th><th>Match</th><th>Records</th><th>Area</th><th>Team</th><th>Collector</th><th>Status</th><th><span class="sr-only">Action</span></th></tr></thead>
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

  // ---------- S2 Side by side review ----------
  function cmpTable(rows, aTitle, bTitle) {
    return `<table class="cmp">
      <caption class="sr-only">Record A compared with record B</caption>
      <thead><tr><th scope="col">Field</th><th scope="col">${aTitle}</th><th scope="col">${bTitle}</th></tr></thead>
      <tbody>${rows.map(([l, a, b, check = true]) => { const d = check && String(a) !== String(b); return `<tr><th scope="row">${esc(l)}</th><td>${esc(a)}</td><td class="${d ? "is-diff" : ""}">${esc(b)}${d ? '<span class="sr-only"> (different)</span>' : ""}</td></tr>`; }).join("")}</tbody>
    </table>`;
  }
  function decisionCard(f, kind) {
    const done = f.status !== "Open";
    const causes = kind === "delivery" ? DELIVERY_CAUSES : ROOT_CAUSES;
    const choices = kind === "delivery"
      ? [["Confirmed", "Confirm double delivery", "The child was vaccinated twice this round."],
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
        <label for="root-cause">Root cause</label>
        <select class="input" id="root-cause" ${done ? "disabled" : ""}><option value="">Select</option>${causes.map(c => `<option ${f.rootCause === c ? "selected" : ""}>${c}</option>`).join("")}</select>
        <p class="err" id="cause-err" hidden>Select a root cause</p>
      </div>
      <div class="field">
        <label for="comment">Comment</label>
        <textarea class="input" id="comment" ${done ? "disabled" : ""}>${esc(f.comment || "")}</textarea>
      </div>
      ${done ? `<p class="done-note">${esc(f.status)}${f.rootCause ? ` · Root cause: ${esc(f.rootCause)}` : ""}</p>`
        : `<div class="card-actions"><a class="btn btn-secondary" href="#/flags">Cancel</a><button class="btn btn-primary" data-action="save-decision" data-id="${esc(f.id)}">Save Decision</button></div>`}
    </div>`;
  }
  function viewReview(f) {
    const isHH = f.type === "household";
    const rows = isHH
      ? [["Household head", f.a.head, f.b.head], ["Household coordinates", f.a.coords, f.b.coords, false], ["Number of members", f.a.members, f.b.members],
         ["Created by", f.a.by, f.b.by, false], ["Created", f.a.at, f.b.at, false], ["Sync at creation", f.a.sync, f.b.sync, false]]
      : [["Full name", f.a.name, f.b.name], ["Gender", f.a.gender, f.b.gender], ["Age", f.a.age, f.b.age], ["Date of birth", f.a.dob, f.b.dob],
         ["Mobile number", f.a.mobile, f.b.mobile], ["ID number", f.a.idNo, f.b.idNo], ["Created by", f.a.by, f.b.by, false], ["Created", f.a.at, f.b.at, false], ["Sync at creation", f.a.sync, f.b.sync, false]];
    return `${crumbs([["Home", "index.html"], ["Flag Queue", "#/flags"], [f.id]])}
      ${head("Review Possible Duplicate", isHH ? "Two households close to each other may be the same household. Compare the households and the people in them, then decide." : "Two people in the same household may be the same person. Compare the records, then decide.")}
      <div class="signals">${typeTag(f.type)}${tierTag(f.tier)}${statusTag(f.status)}${f.syncFailed ? tag("Created after a failed sync", "warning") : ""}</div>
      <div class="review-grid">
        <div>
          <div class="card card-pad">
            <h2 class="card-title">${isHH ? "Households" : "Individuals"}</h2>
            <p class="card-sub">${isHH ? "" : `Household: ${esc(f.household)} · `}Signals matched: ${f.signals.map(esc).join(", ")}</p>
            ${cmpTable(rows, `Record A<span class="cell-sub">${esc(f.a.id)}</span>`, `Record B<span class="cell-sub">${esc(f.b.id)}</span>`)}
            ${f.reason ? `<p class="section-label">Worker’s reason</p><p class="card-sub" style="color:var(--text)">The worker added record B as a new person: “${esc(f.reason)}”.</p>` : ""}
            ${f.searchTerm ? `<p class="section-label">Search before create</p><p class="card-sub" style="color:var(--text)">The worker searched “${esc(f.searchTerm)}” before creating household B.</p>` : ""}
          </div>
          ${isHH ? `<div class="card card-pad">
            <h2 class="card-title">People in both households</h2>
            <table class="cmp"><thead><tr><th scope="col">Household A</th><th scope="col">Household B</th><th scope="col">Match</th></tr></thead>
              <tbody>${f.pairs.map(p => `<tr><td>${esc(p.a)}</td><td>${esc(p.b)}</td><td>${p.match ? tierTag(p.match) : "–"}</td></tr>`).join("")}</tbody></table>
          </div>` : ""}
        </div>
        <div>
          ${isHH ? `<div class="card card-pad"><h2 class="card-title">Location</h2><p class="card-sub">Household coordinates of A and B.</p>${mapSvg(f.distance, [f.a.head, f.b.head])}</div>` : ""}
          ${decisionCard(f, "review")}
        </div>
      </div>`;
  }

  // ---------- S3 Delivery alert review ----------
  function viewAlert(f) {
    return `${crumbs([["Home", "index.html"], ["Flag Queue", "#/flags"], [f.id]])}
      ${head("Review Delivery Alert", "The same child may have been vaccinated twice this round. Check both deliveries, decide and tag the root cause.")}
      <div class="signals">${typeTag(f.type)}${tierTag(f.tier)}${statusTag(f.status)}</div>
      <div class="review-grid">
        <div>
          <div class="card card-pad">
            <h2 class="card-title">${esc(f.title)}</h2>
            <p class="card-sub">Household: ${esc(f.household)} · ${esc(f.gender)}, ${esc(f.age)} · Round ${f.round}</p>
            ${f.note ? `<p class="card-sub" style="color:var(--text)">${esc(f.note)}</p>` : ""}
            <table class="cmp">
              <caption class="sr-only">Both deliveries this round</caption>
              <thead><tr><th scope="col">Delivery</th><th scope="col">Time</th><th scope="col">Household coordinates</th><th scope="col">Worker</th><th scope="col">Device sync</th></tr></thead>
              <tbody>${f.deliveries.map((d, i) => `<tr><th scope="row">${i + 1}${d.person ? `<span class="cell-sub">${esc(d.person)}</span>` : ""}</th><td>${esc(d.time)}</td><td>${esc(d.coords)}</td><td>${esc(d.worker)}</td><td class="${d.failed ? "is-diff" : ""}">${esc(d.sync)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        </div>
        <div>${decisionCard(f, "delivery")}</div>
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
  function viewInsights() {
    const per = v => v.toFixed(1), pct = v => `${v}%`;
    return `${crumbs([["Home", "index.html"], ["Insights"]])}
      ${head("Insights", "See where duplicates come from, by team, area and collector, and why they happen. Use this to plan support and training for this round.")}
      ${stats([["18.4", "Duplicates per 1,000 registrations"], ["23", "Confirmed duplicates"], ["7%", "Registrations after a failed sync", true], ["2", "Double deliveries"]])}
      <div class="insight-grid" style="margin-top:0">
        ${barCard("team", "Duplicates by team", "Confirmed duplicates per 1,000 registrations, round 2.", "Per 1,000 registrations", per)}
        ${barCard("area", "Duplicates by area", "Confirmed duplicates per 1,000 registrations, round 2.", "Per 1,000 registrations", per)}
        ${barCard("collector", "Duplicates by collector", "Confirmed duplicates per 1,000 registrations, round 2.", "Per 1,000 registrations", per)}
        ${barCard("cause", "Duplicates by root cause", "Share of confirmed duplicates by the root cause tagged in review.", "Share of confirmed duplicates", pct)}
      </div>
      <p class="chart-note">Figures are demo data for the prototype.</p>`;
  }

  // ---------- Router ----------
  const TITLES = { flags: "Flag Queue", aliases: "Alias Map", insights: "Insights" };
  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "flags").split("/");
    const section = TITLES[parts[0]] ? parts[0] : "flags";
    let html, title = TITLES[section];
    if (section === "flags" && parts[1]) {
      const f = store.flags.find(x => x.id === parts[1]);
      if (f) { html = f.type === "delivery" ? viewAlert(f) : viewReview(f); title = f.type === "delivery" ? "Review Delivery Alert" : "Review Possible Duplicate"; }
    }
    if (!html) html = { flags: viewFlags, aliases: viewAliases, insights: viewInsights }[section]();
    $page.innerHTML = html;
    document.title = `${title} – Duplication Flow`;
    document.querySelectorAll(".sidenav a").forEach(a => (a.dataset.nav === section ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    window.scrollTo(0, 0);
    $page.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", route);

  // ---------- Actions ----------
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const a = b.dataset.action;
    if (a === "help") return toast("Review delivery alerts first. Every decision needs a root cause.");
    if (a === "clear") { Object.assign(ui, { q: "", area: "", team: "", collector: "", status: "" }); return route(); }
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
      toast({ Confirmed: f.type === "delivery" ? `${f.id} confirmed as a double delivery.` : `${f.id} confirmed as a duplicate. The records are linked.`, "Not a duplicate": `${f.id} marked not a duplicate. It won’t be raised again.` }[decision]);
    }
  });
  document.addEventListener("input", e => {
    const map = { "f-q": "q", "f-area": "area", "f-team": "team", "f-collector": "collector", "f-status": "status" };
    if (map[e.target.id]) { ui[map[e.target.id]] = e.target.value; refreshQueue(); }
    if (e.target.id === "root-cause") document.getElementById("cause-err").hidden = true;
    if (e.target.name === "decision") document.getElementById("decision-err").hidden = true;
  });

  route();
})();
