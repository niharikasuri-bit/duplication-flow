/* District Supervisor – mobile app for the registration deduplication prototype.
 * Same flags as the desktop supervisor (possible duplicate households and people),
 * laid out like the inventory app: home tiles, a Pending/Reviewed list of cards,
 * a review screen that compares Record 1 and Record 2 field by field, a decision
 * screen (root cause + comment) and a success screen.
 *
 *  home      Home tiles
 *  queue     Review Flags list (Pending | Reviewed tabs, search)
 *  review    Review Duplicates
 *  decide    Confirm Duplicate / Not a Duplicate: root cause and comment
 *  success   Decision Saved
 */
(() => {
  "use strict";
  const STORE_KEY = "duplication-district-v2";
  const ROOT_CAUSES = ["Sync failed", "Spelling", "Info mismatch", "Area overlap", "Other"];
  const TIER_RANK = { Definite: 3, Strong: 2, Low: 1 };
  const ISSUE = { delivery: "Possible double vaccination", household: "Possible duplicate household", individual: "Possible duplicate person" };
  const DELIVERY_CAUSES = ["Sync failed", "Area overlap", "Other"];

  // ---------- Demo flags (same as the desktop supervisor) ----------
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

  const fresh = () => ({ flags: SEED_FLAGS() });
  let store;
  try { store = JSON.parse(localStorage.getItem(STORE_KEY)) || fresh(); } catch (e) { store = fresh(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } };

  const state = { route: "home", history: [], tab: "Pending", q: "", flagId: null, decision: "", cause: "", comment: "" };

  // ---------- Helpers ----------
  const $phone = document.getElementById("phone");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const flag = () => store.flags.find(f => f.id === state.flagId);
  const pending = () => store.flags.filter(f => f.status === "Open").sort((a, b) => ((b.type === "delivery") - (a.type === "delivery")) || TIER_RANK[b.tier] - TIER_RANK[a.tier]);
  const reviewed = () => store.flags.filter(f => f.status !== "Open");

  const ICON = {
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
    caret: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m7 10 5 5 5-5z"/></svg>',
    back: '<svg viewBox="0 0 8 10" aria-hidden="true"><path d="M7 0v10L0 5z" fill="currentColor"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.5-2.8 4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>',
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 14-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="3"/><path d="m14 24.5 7 7 13-14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>'
  };
  const tierPill = t => `<span class="dq-pill tier-${t.toLowerCase()}">${esc(t)}</span>`;
  const statusPill = s => s === "Confirmed" ? `<span class="dq-pill st-ok">${ICON.tick}Confirmed</span>` : `<span class="dq-pill st-none">Not a duplicate</span>`;

  // ---------- Screens ----------
  function home() {
    const n = pending().length, done = reviewed().length, total = n + done;
    return {
      bar: "home",
      body: `<div class="card progress-card">
          <p class="progress-title">Flagged Duplicates</p>
          <div class="progress-track" role="progressbar" aria-label="Flags reviewed" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><div class="progress-fill" style="width:${total ? Math.round(done / total * 100) : 0}%"></div></div>
          <p class="progress-text"><span>${done} reviewed</span> · ${n} flag${n === 1 ? "" : "s"} to review</p>
          <div class="dq-metrics">
            <div class="dq-metric dq-total"><span class="dq-mval">${total}</span><span class="dq-mlbl">Total flagged</span></div>
            ${[["delivery", "Double vaccinations"], ["household", "Duplicate households"], ["individual", "Duplicate people"]].map(([t, l]) => `<div class="dq-metric"><span class="dq-mval">${store.flags.filter(f => f.type === t).length}</span><span class="dq-mlbl">${l}</span></div>`).join("")}
          </div>
        </div>
        <ul class="home-tiles">
          <li><button class="home-tile" data-action="open-queue" data-tab="Pending">${ICON.flag.replace("<svg", '<svg class="tile-icon"')}<span>Review Flags</span></button></li>
          <li><button class="home-tile" data-action="open-queue" data-tab="Reviewed">${ICON.done.replace("<svg", '<svg class="tile-icon"')}<span>Reviewed Flags</span></button></li>
        </ul>
        <p class="powered">Powered by DIGIT</p>`
    };
  }

  // Why the flag was raised, in plain words (no worker names).
  function whyFlagged(f) {
    if (f.type === "delivery") return f.deliveries.some(d => d.failed) ? "Vaccinated twice this round, once after a failed sync" : "Two matched records were each vaccinated this round";
    if (f.reason) return `Added as new despite a match: ${f.reason.charAt(0).toLowerCase()}${f.reason.slice(1)}`;
    if (f.syncFailed) return "Created after a failed sync";
    return f.source ? f.source.replace(/^Server match across teams$/, "Found by the server across teams") : "Found by the server after sync";
  }
  function queueCards(list) {
    const q = state.q.trim().toLowerCase();
    const rows = list.filter(f => !q || f.id.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.area.toLowerCase().includes(q));
    if (!rows.length) return `<div class="dq-empty">${ICON.flag}<p>${state.tab === "Pending" ? "No flags waiting for review." : "No reviewed flags yet."}</p></div>`;
    return `<ul class="dq-list">${rows.map(f => `<li><article class="dq-card ${f.status === "Confirmed" ? "acc-ok" : f.status === "Not a duplicate" ? "acc-none" : ""}" aria-labelledby="t-${f.id}">
        <p class="dq-time">${ICON.clock}${esc(f.raised)} · ${esc(f.area)}</p>
        <div class="dq-head"><h3 class="dq-id" id="t-${f.id}">${esc(f.id)}</h3>${f.status === "Open" ? tierPill(f.tier) : statusPill(f.status)}</div>
        <div class="dq-info"><span class="dq-label">Reason</span><span class="dq-value">${esc(ISSUE[f.type])}</span></div>
        <p class="dq-meta">${esc(f.collector)} · ${esc(f.team)}${f.syncFailed ? ` · <span class="dq-warn">Created after a failed sync</span>` : ""}</p>
        <button class="btn btn-primary dq-btn" data-action="open-flag" data-id="${esc(f.id)}">${f.status === "Open" ? "Review" : "View"}</button>
      </article></li>`).join("")}</ul>`;
  }
  function queue() {
    const list = state.tab === "Pending" ? pending() : reviewed();
    return {
      title: "Review Flags",
      desc: "Open a flag to compare the two records and decide.",
      body: `<div class="dq-tabs" role="tablist" aria-label="Flags">
          ${["Pending", "Reviewed"].map(t => `<button class="dq-tab" role="tab" aria-selected="${state.tab === t}" data-action="tab" data-tab="${t}">${t} (${(t === "Pending" ? pending() : reviewed()).length})</button>`).join("")}
        </div>
        <div class="dq-search">${ICON.search}<input class="dq-search-input" id="dq-q" type="search" placeholder="Search by flag ID, name or area" value="${esc(state.q)}" aria-label="Search flags"/></div>
        <div id="dq-results">${queueCards(list)}</div>`
    };
  }

  // Field-by-field comparison, inventory style: Record A box (grey) next to Record B box (tinted by match).
  function kind(a, b, k) {
    if (k === false) return "";
    if (String(a) === String(b)) return "same";
    return k === "similar" ? "similar" : "diff";
  }
  const KIND_LABEL = { same: "Same", similar: "Similar", diff: "Different" };
  // Same table as the worker app's Possible Match Found alert: field | A | B, differences highlighted.
  function compareTable(rows, ha, hb, caption) {
    return `<table class="pm-table dq-table">
        <caption class="sr-only">${esc(caption)}</caption>
        <thead><tr><th scope="col"><span class="sr-only">Field</span></th><th scope="col">${ha}</th><th scope="col">${hb}</th></tr></thead>
        <tbody>${rows.map(([l, a, b, k]) => { const m = kind(a, b, k); return `<tr class="${m ? `mt-${m}` : ""}"><th scope="row">${esc(l)}</th><td>${esc(a)}</td><td>${esc(b)}${m ? `<span class="sr-only"> (${KIND_LABEL[m].toLowerCase()})</span>` : ""}</td></tr>`; }).join("")}</tbody>
      </table>`;
  }
  // One sync notice, same component and wording in the desktop and mobile review.
  const lastSync = s => { const m = /Last succeeded (.+)$/.exec(String(s || "")); return m ? m[1] : ""; };
  function syncNotice(f) {
    const items = f.type === "delivery"
      ? f.deliveries.map((d, i) => d.failed ? [i + 1, `This vaccination was saved while the phone was not synced${lastSync(d.sync) ? `. Last synced ${lastSync(d.sync)}` : ""}. The worker might not have seen the other vaccination.`] : null).filter(Boolean)
      : f.syncFailed ? [[2, `This record was saved while the phone was not synced${lastSync(f.b.sync) ? `. Last synced ${lastSync(f.b.sync)}` : ""}. The worker might not have seen record 1.`]] : [];
    return items.map(([n, t]) => `<div class="sync-notice" role="note"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg><div><p class="sync-notice-title">Record ${n}: sync failed</p><p>${esc(t)}</p></div></div>`).join("");
  }
  // Header: label on the left, value on the right.
  const flagHead = f => `<div class="card dq-flaghead">
      <dl class="dq-kv">
        <div><dt>Flag ID</dt><dd>${esc(f.id)}</dd></div>
        <div><dt>Reason</dt><dd>${esc(ISSUE[f.type])}</dd></div>
        <div><dt>Match</dt><dd>${tierPill(f.tier)}</dd></div>
        ${f.type === "household" ? `<div><dt>Distance</dt><dd>${esc(f.distance)} m apart</dd></div>` : `<div><dt>Household</dt><dd>${esc(f.household)}</dd></div>`}
        ${f.reason ? `<div><dt>Worker’s reason</dt><dd>${esc(f.reason)}</dd></div>` : ""}
      </dl>
    </div>
    ${syncNotice(f)}`;
  const LEGEND = `<ul class="dq-legend" aria-label="Highlight key"><li class="k-same">Same</li><li class="k-similar">Similar</li><li class="k-diff">Different</li></ul>`;
  const section = (title, inner, legend = true) => `<section class="card dq-block"><h2 class="dq-section">${title}</h2>${legend ? LEGEND : ""}${inner}</section>`;
  const doneCard = f => f.status !== "Open" ? `<div class="card dq-done">${statusPill(f.status)}<p>Reason for decision: ${esc(f.rootCause || "–")}</p>${f.comment ? `<p>${esc(f.comment)}</p>` : ""}</div>` : "";

  function reviewDelivery(f) {
    const done = f.status !== "Open", [d1, d2] = f.deliveries;
    const rows = [["Child", d1.person || f.title, d2.person || f.title, "similar"], ["Gender", f.gender, f.gender], ["Age", f.age, f.age], ["Vaccinated", d1.time, d2.time, false]];
    return {
      title: "Review Duplicates",
      body: `${flagHead(f)}
        ${section("Vaccinations", compareTable(rows, "Record 1", "Record 2", "Record 1 compared with record 2"))}
        ${doneCard(f)}`,
      footer: done ? "" : `<button class="btn btn-primary" data-action="decide" data-d="Confirmed">Confirm Double Vaccination</button>
        <button class="btn btn-secondary" data-action="decide" data-d="Not a duplicate">Not a Duplicate</button>`
    };
  }
  function review() {
    if (flag().type === "delivery") return reviewDelivery(flag());
    const f = flag(), isHH = f.type === "household", done = f.status !== "Open";
    const rows = isHH
      ? [["Household head", f.a.head, f.b.head, "similar"], ["Number of members", f.a.members, f.b.members], ["Created", f.a.at, f.b.at, false]]
      : [["Full name", f.a.name, f.b.name, "similar"], ["Gender", f.a.gender, f.b.gender], ["Age", f.a.age, f.b.age, "similar"], ["Date of birth", f.a.dob, f.b.dob, "similar"], ["ID number", f.a.idNo, f.b.idNo], ["Created", f.a.at, f.b.at, false]];
    const parse = s => { if (!s || s === "–") return null; const [name, g, age] = s.split(", "); return { name, gender: { F: "Female", M: "Male" }[g] || g, age }; };
    const people = isHH ? `<table class="pm-table dq-table dq-people-table">
        <caption class="sr-only">People in both households</caption>
        <thead><tr><th scope="col">Record 1</th><th scope="col">Record 2</th></tr></thead>
        <tbody>${(f.pairs || []).map(p => {
          const a = parse(p.a), b = parse(p.b);
          const m = b ? (a.name === b.name && a.age === b.age ? "same" : "similar") : "";
          const cell = x => x ? `<span class="dq-pname">${esc(x.name)}</span><span class="dq-pmeta">${esc(x.gender)}, ${esc(x.age)}</span>` : `<span class="dq-pmeta">No match</span>`;
          return `<tr class="${m ? `mt-${m}` : ""}"><td>${cell(a)}</td><td>${cell(b)}</td></tr>`;
        }).join("")}</tbody>
      </table>` : "";
    return {
      title: "Review Duplicates",
      body: `${flagHead(f)}
        ${section(isHH ? "Households" : "People", compareTable(rows, `Record 1<span class="pm-id">${esc(f.a.id)}</span>`, `Record 2<span class="pm-id">${esc(f.b.id)}</span>`, "Record 1 compared with record 2"))}
        ${isHH ? section("People in both households", people, false) : ""}
        ${doneCard(f)}`,
      footer: done ? "" : `<button class="btn btn-primary" data-action="decide" data-d="Confirmed">Confirm Duplicate</button>
        <button class="btn btn-secondary" data-action="decide" data-d="Not a duplicate">Not a Duplicate</button>`
    };
  }

  function decide() {
    const f = flag(), conf = state.decision === "Confirmed", del = f.type === "delivery";
    return {
      title: conf ? (del ? "Confirm Double Vaccination" : "Confirm Duplicate") : "Not a Duplicate",
      desc: conf ? (del ? "The child is recorded as vaccinated twice this round." : "Both records are kept, marked as the same and linked.") : (del ? "The earlier vaccination stands." : "This pair won’t be flagged again unless a record changes."),
      body: `<p class="dq-ctx ${conf ? "ctx-ok" : ""}">${esc(f.id)} · ${esc(f.title)}</p>
        <div class="card">
          <fieldset class="radios" id="cause-group" aria-describedby="cause-err">
            <legend class="field-label">Reason for decision<span class="req">*</span></legend>
            ${(f.type === "delivery" ? DELIVERY_CAUSES : ROOT_CAUSES).map(c => `<label class="radio"><input type="radio" name="cause" value="${esc(c)}" ${state.cause === c ? "checked" : ""}/>${esc(c)}</label>`).join("")}
          </fieldset>
          <p class="field-error" id="cause-err" hidden>Select a reason for the decision</p>
          <div class="field dq-comment">
            <label class="field-label" for="dq-comment">Comment</label>
            <textarea class="input" id="dq-comment" rows="3">${esc(state.comment)}</textarea>
          </div>
        </div>`,
      footer: `<button class="btn btn-primary" data-action="submit">Submit Decision</button>`
    };
  }

  function success() {
    const f = flag(), next = pending()[0];
    return {
      title: "",
      body: `<div class="card panel-card">
          <div class="success-panel">${ICON.check}<h1 class="success-title" id="page-title" tabindex="-1">Decision Saved</h1></div>
          <p class="success-desc">${esc(f.id)} is marked ${f.status === "Confirmed" ? (f.type === "delivery" ? "as a double vaccination" : "as a confirmed duplicate. The records are linked") : "as not a duplicate"}. Workers see the change after their next sync.</p>
          <div class="panel-actions">
            ${next ? `<button class="btn btn-primary" data-action="open-flag" data-id="${esc(next.id)}" data-fresh="1">Review Next Flag</button>` : ""}
            <button class="btn btn-secondary" data-action="go-home">Go to Home</button>
          </div>
        </div>`
    };
  }

  const VIEWS = { home, queue, review, decide, success };

  // ---------- Render ----------
  function render() {
    const v = VIEWS[state.route]();
    const homeBar = `<header class="home-bar">
        <button class="icon-btn" data-action="noop" aria-label="Menu">${ICON.menu}</button>
        <button class="area-btn" data-action="noop">Kanu District${ICON.caret}</button>
      </header>`;
    $phone.innerHTML = `${homeBar}
      ${v.bar === "home" ? "" : `<div class="app-bar">
          <button class="back-btn" data-action="back">${ICON.back}Back</button>
          <button class="help-btn" data-action="noop">Help${ICON.help}</button>
        </div>`}
      <div class="body ${v.bar === "home" ? "body-home" : ""}" id="screen-body">
        ${v.title ? `<h1 class="page-title" id="page-title" tabindex="-1">${esc(v.title)}</h1>` : ""}
        ${v.desc ? `<p class="page-desc">${esc(v.desc)}</p>` : ""}
        ${v.body}
      </div>
      ${v.footer ? `<footer class="footer">${v.footer}</footer>` : ""}`;
    document.title = `${v.title || (state.route === "home" ? "Home" : "Decision Saved")} – District Supervisor`;
    const t = document.getElementById("page-title"); if (t) t.focus({ preventScroll: true });
  }
  function go(route, { replace = false } = {}) {
    if (!replace) state.history.push(state.route);
    state.route = route; render();
  }

  const ACTIONS = {
    noop() {},
    back() { state.route = state.history.pop() || "home"; render(); },
    "go-home"() { state.history = []; state.route = "home"; render(); },
    "open-queue"(b) { state.tab = b.dataset.tab; state.q = ""; go("queue"); },
    tab(b) { state.tab = b.dataset.tab; render(); },
    "open-flag"(b) {
      state.flagId = b.dataset.id;
      if (b.dataset.fresh) { state.history = ["home", "queue"]; state.tab = "Pending"; state.route = "review"; return render(); }
      go("review");
    },
    decide(b) { state.decision = b.dataset.d; state.cause = ""; state.comment = ""; go("decide"); },
    submit() {
      const err = document.getElementById("cause-err");
      if (!state.cause) { err.hidden = false; document.querySelector('input[name="cause"]').focus(); return; }
      const f = flag();
      f.status = state.decision; f.rootCause = state.cause; f.comment = state.comment.trim(); save();
      state.history = ["home", "queue"];
      go("success", { replace: true });
    }
  };
  $phone.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (b && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action](b);
  });
  $phone.addEventListener("input", e => {
    if (e.target.id === "dq-q") { state.q = e.target.value; document.getElementById("dq-results").innerHTML = queueCards(state.tab === "Pending" ? pending() : reviewed()); }
    if (e.target.id === "dq-comment") state.comment = e.target.value;
  });
  $phone.addEventListener("change", e => {
    if (e.target.name === "cause") { state.cause = e.target.value; document.getElementById("cause-err").hidden = true; }
  });
  document.getElementById("demo-reset")?.addEventListener("click", () => {
    store = fresh(); save(); Object.assign(state, { route: "home", history: [], tab: "Pending", q: "" }); render();
  });
  render();
})();
