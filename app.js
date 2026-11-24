/* Registration deduplication – field worker app (mobile prototype)
 *
 * Built from the "Registration deduplication: process flow and screens" spec.
 * Worker screens only (W1–W11). Supervisor screens (S1–S5) come later.
 *
 *  W1  Home + sync status            home
 *  W2  Name search / W3 results      search
 *  W4  Create household              household
 *  W5  Household open                overview
 *  W6  Add individual                individual
 *  W7  Possible match, single        compare
 *  W8  Possible matches, list        matches
 *  W9  Add as new person: reason     reason
 *  W10 Delivery check                check → checklist → success
 *  W11 System states                 banner on every inner screen + home sync card
 *
 * Workers see plain reasons ("Similar name, same age"); tiers stay internal.
 * A "Prototype controls" panel beside the phone switches sync / GPS states.
 */
(function () {
  "use strict";

  // ---------- Config ----------
  const ASSIGNED_AREA = "Solimbo";
  const NEARBY_M = 50;            // households compared at creation
  const STORE_KEY = "duplication-flow-v1";

  const SCREENS = {
    home:       { name: "Home", desc: "Check the data on this device before you start." },
    search:     { name: "Search Beneficiary", desc: "Search for the household by the name of any member." },
    household:  { name: "Household Details", desc: "Add the number of members. The household coordinates are captured automatically." },
    hoh:        { name: "Head of Household Details", desc: "Add the details of the household head." },
    overview:   { name: "Household Overview", desc: "See everyone in this household and record vaccinations." },
    individual: { name: "Individual Details", desc: "Add the details of the person you are registering." },
    matches:    { name: "Existing Matches", desc: "Select the record that matches the person you are registering." },
    reason:     { name: "Add as New Person", desc: "Tell us why this is a different person." },
    checklist:  { name: "Vaccination Checklist", desc: "Confirm the vaccination by completing the checklist." },
    success:    { name: "Vaccination Successful", desc: "Vaccination has been recorded successfully." }
  };
  // The individual form doubles as the head of household form while a household is being created.
  const screenKey = () => (state.route === "individual" && state.draftHH ? "hoh" : state.route);
  const screen = () => SCREENS[screenKey()];

  // Alias groups: spelling variants the sound of a name hides (per country, starter list).
  const ALIAS_GROUPS = [
    ["mohammed", "muhammad", "mohamed", "mohamad", "mamadou", "mamadu", "mohd", "momodu"],
    ["fatima", "fatou", "fatoumata", "fatuma", "fatma", "fatimata"],
    ["aminata", "aminatou", "amina", "aminah"],
    ["ibrahima", "ibrahim", "ebrahim", "brahima"],
    ["aissatou", "aisha", "aicha", "aysatu", "aichatou", "isatu"],
    ["kadiatou", "khadija", "kadija", "hadja", "kadi"],
    ["hawa", "awa", "hauwa"],
    ["mariama", "maryam", "mariam", "mariatu"],
    ["ousmane", "usman", "osman", "usmane"],
    ["seydou", "saidu", "seidu", "saido"],
    ["alpha", "alfa"],
    ["hassan", "hasan", "assan"],
    ["husseini", "hussein", "husein", "usseini"]
  ];
  const ALIAS = {};
  ALIAS_GROUPS.forEach((g, i) => g.forEach(n => (ALIAS[n] = i)));

  const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "dr", "alhaji", "alhaja", "hajia", "haja", "pa", "ma"]);
  const FILLER = new Set(["of", "the"]);

  // ---------- Demo data (stands in for the downsynced registrations) ----------
  const Y = (y, m = 0) => y * 12 + m;
  const SEED_HH = () => [
    { id: "hh-1", head: "Mohammed Diallo", m: 20, members: [
      { id: "p-11", name: "Mohammed Diallo", gender: "Male", age: Y(34, 2), head: true },
      { id: "p-12", name: "Fatou Diallo", gender: "Female", age: Y(29), mobile: "076123456" },
      { id: "p-13", name: "Aminata Diallo", gender: "Female", age: Y(3, 2), status: "done", servedAt: "Today, 09:20", servedBy: "A. Sesay", servedWhere: "this household" },
      { id: "p-14", name: "Ibrahima Diallo", gender: "Male", age: Y(0, 8), status: "pending" }
    ] },
    { id: "hh-2", head: "Fatoumata Camara", m: 35, members: [
      { id: "p-21", name: "Fatoumata Camara", gender: "Female", age: Y(31), head: true },
      { id: "p-22", name: "Mariama Camara", gender: "Female", age: Y(4), status: "not" },
      { id: "p-23", name: "Mamadou Camara", gender: "Male", age: Y(4), status: "pending" },
      { id: "p-24", name: "Baby of Fatoumata", gender: "Female", age: Y(0, 1), status: "pending" }
    ] },
    { id: "hh-6", head: "Aissatou Barry", m: 45, late: true, members: [
      { id: "p-61", name: "Aissatou Barry", gender: "Female", age: Y(26), head: true },
      { id: "p-62", name: "Alpha Barry", gender: "Male", age: Y(1, 4), status: "pending" }
    ] },
    { id: "hh-4", head: "Seydou Kamara", m: 60, members: [
      { id: "p-41", name: "Seydou Kamara", gender: "Male", age: Y(38), head: true },
      { id: "p-42", name: "Kadiatou Kamara", gender: "Female", age: Y(0, 10), status: "pending", flag: true },
      { id: "p-43", name: "Khadija Kamara", gender: "Female", age: Y(0, 10), status: "pending", flag: true }
    ] },
    { id: "hh-3", head: "Muhammad Bah", m: 140, members: [
      { id: "p-31", name: "Muhammad Bah", gender: "Male", age: Y(40), head: true },
      { id: "p-32", name: "Hawa Bah", gender: "Female", age: Y(2, 6), status: "pending" },
      { id: "p-33", name: "Hassan Bah", gender: "Male", age: Y(1, 11), status: "pending" },
      { id: "p-34", name: "Husseini Bah", gender: "Male", age: Y(1, 11), status: "pending" }
    ] },
    { id: "hh-5", head: "Ousmane Sow", m: 900, members: [
      { id: "p-51", name: "Ousmane Sow", gender: "Male", age: Y(45), head: true },
      { id: "p-52", name: "Aissatou Sow", gender: "Female", age: Y(3, 5), status: "done", servedAt: "Yesterday, 15:05", servedBy: "M. Kargbo", servedWhere: "this household" }
    ] }
  ];

  const ID_TYPES = ["National ID", "Birth certificate", "Not available"];
  const NEW_PERSON_REASONS = ["Twin or sibling", "Different person with a similar name", "Checked with the caregiver", "Other"];
  const CHECKLIST = [
    { id: "chk-drops", label: "Two drops administered" },
    { id: "chk-finger", label: "Finger marked" }
  ];

  // ---------- Persistence ----------
  const freshStore = () => ({
    households: SEED_HH(),
    pending: 0,
    // Sync is all or nothing: everything syncs or nothing does. No partial states.
    synced: true,
    hold: false,              // prototype only: keep records waiting (Sync pending)
    retryWorks: true,
    retryFailed: false,       // a retry has failed → offer Continue Without Sync
    continued: false,         // worker carried on after a failed sync
    progress: { completed: 15, target: 80 },
    log: []                   // search terms + candidates shown before a create
  });
  let store;
  try { store = JSON.parse(localStorage.getItem(STORE_KEY)) || freshStore(); } catch (e) { store = freshStore(); }
  if (typeof store.synced !== "boolean") store = freshStore();   // older demo data
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } };

  const LAST_OK = "Today, 08:10", LAST_GOOD_BEFORE = "Yesterday, 17:40";
  const syncOk = () => store.synced;
  const lastOk = ok => (ok ? LAST_OK : LAST_GOOD_BEFORE);
  // Households registered by other workers since the last successful registration sync.
  const deviceHouseholds = () => store.households.filter(h => !(h.late && !store.synced));
  const findHH = id => store.households.find(h => h.id === id);

  // ---------- Session state ----------
  const blankPerson = () => ({ name: "", isHead: false, idType: "", idNumber: "", dob: "", years: "", months: "", gender: "", mobile: "" });
  const state = {
    route: "home",
    history: [],
    query: "",
    hhId: null,
    draftHH: null,            // { head, searchTerm, candidates } while creating a household
    person: blankPerson(),
    matches: [],              // [{ member, tier, same[], diff[] }]
    compareIdx: 0,
    compareOpen: false,       // W7 alert open over Individual Details or the matches list
    reason: { why: "", supervisor: false },
    memberId: null,
    errors: {}
  };

  // ---------- Helpers ----------
  const $phone = document.getElementById("phone");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const ageLabel = m => `${plural(Math.floor(m / 12), "year")} ${plural(m % 12, "month")}`;
  const hh = () => findHH(state.hhId);
  const member = () => hh()?.members.find(p => p.id === state.memberId);
  const isChild = p => p.age < 60;

  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function ageFromDob(iso) {
    const dob = new Date(`${iso}T00:00`), now = new Date();
    let total = (now.getFullYear() - dob.getFullYear()) * 12 + now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) total--;
    return total < 0 ? null : { years: String(Math.floor(total / 12)), months: String(total % 12) };
  }
  function dobFromAge(years, months) {
    const d = new Date();
    d.setMonth(d.getMonth() - (Number(years) || 0) * 12 - (Number(months) || 0));
    return isoDate(d);
  }
  const personMonths = p => (Number(p.years) || 0) * 12 + (Number(p.months) || 0);

  // ---------- Fuzzy name matching ----------
  // 1 normalise · 2 starts-with · 3 edit distance (Jaro-Winkler) · 4 alias map
  const tokens = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ").split(/\s+/).filter(t => t && !HONORIFICS.has(t) && !FILLER.has(t));

  function jaro(a, b) {
    if (a === b) return 1;
    const la = a.length, lb = b.length;
    if (!la || !lb) return 0;
    const win = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
    const am = new Array(la).fill(false), bm = new Array(lb).fill(false);
    let m = 0;
    for (let i = 0; i < la; i++) {
      for (let j = Math.max(0, i - win); j < Math.min(i + win + 1, lb); j++) {
        if (bm[j] || a[i] !== b[j]) continue;
        am[i] = bm[j] = true; m++; break;
      }
    }
    if (!m) return 0;
    let t = 0, k = 0;
    for (let i = 0; i < la; i++) {
      if (!am[i]) continue;
      while (!bm[k]) k++;
      if (a[i] !== b[k]) t++;
      k++;
    }
    return (m / la + m / lb + (m - t / 2) / m) / 3;
  }
  function jw(a, b) {
    const j = jaro(a, b);
    let l = 0;
    while (l < 4 && a[l] && a[l] === b[l]) l++;
    return j + l * 0.1 * (1 - j);
  }
  const isAlias = (a, b) => ALIAS[a] !== undefined && ALIAS[a] === ALIAS[b];
  const tokSim = (a, b) => (a === b ? 1 : Math.max(isAlias(a, b) ? 0.95 : 0, jw(a, b)));

  // Whole-name similarity. Words both names share exactly (usually the family name) are set
  // aside, so people in one household are compared on the words that differ. A weak word caps
  // the score, so one good word never carries a bad one.
  function nameSim(A, B) {
    let ta = tokens(A), tb = tokens(B);
    if (!ta.length || !tb.length) return 0;
    const shared = ta.filter(t => tb.includes(t));
    ta = ta.filter(t => !shared.includes(t));
    tb = tb.filter(t => !shared.includes(t));
    if (!ta.length || !tb.length) return shared.length ? 1 : 0;   // one name is part of the other
    if (ta.length > tb.length) [ta, tb] = [tb, ta];
    const bests = ta.map(t => Math.max(...tb.map(u => tokSim(t, u))));
    const mean = bests.reduce((s, x) => s + x, 0) / bests.length;
    return Math.min(mean, Math.min(...bests) + 0.1);
  }

  // Search: every typed word must match a word in the name. Returns { score, fuzzy } or null.
  function searchName(q, name) {
    const qt = tokens(q), nt = tokens(name);
    if (!qt.length || !nt.length) return null;
    let total = 0, fuzzy = false;
    for (const t of qt) {
      let best = 0, exact = false;
      for (const u of nt) {
        if (u === t || u.startsWith(t)) { best = 1; exact = true; break; }
        if (t.length <= 3) continue;                       // short names: starts-with only
        const s = tokSim(t, u);
        if (s > best) best = s;
      }
      if (best < (t.length <= 5 ? 0.88 : 0.85)) return null;
      if (!exact) fuzzy = true;
      total += best;
    }
    return { score: total / qt.length, fuzzy };
  }

  function searchHouseholds(q) {
    if (q.trim().length < 2) return null;
    const out = [];
    for (const h of deviceHouseholds()) {
      let best = null;
      for (const p of h.members) {
        const r = searchName(q, p.name);
        if (r && (!best || r.score > best.score || (r.score === best.score && best.fuzzy && !r.fuzzy))) best = { ...r, matched: p.name };
      }
      if (best) out.push({ h, ...best });
    }
    // Name closeness only: exact/starts-with first, then closer spelling. No distance at this layer.
    return out.sort((a, b) => (a.fuzzy - b.fuzzy) || (b.score - a.score)).slice(0, 10);
  }

  // ---------- Individual comparison (inside one household) ----------
  const ageWindow = months => (months < 60 ? 3 : months < 216 ? 6 : 12);

  function compare(existing, p) {
    const n = nameSim(existing.name, p.name);
    const newAge = personMonths(p);
    const diffM = Math.abs(existing.age - newAge);
    const win = ageWindow(Math.min(existing.age, newAge));
    const genderKnown = existing.gender && p.gender;
    const sameGender = !genderKnown || existing.gender === p.gender;
    const ageOk = diffM <= win, ageClose = diffM <= win * 2;
    const idSame = p.idNumber && existing.idNumber && p.idNumber.trim() === existing.idNumber;
    const mobileSame = p.mobile && existing.mobile && p.mobile.replace(/\D/g, "") === existing.mobile;

    let tier = "";
    if (idSame) tier = "Definite";
    else if ((n >= 0.9 && ageOk && sameGender) || (mobileSame && n >= 0.9)) tier = "Strong";
    // A mismatch lowers the score but never rejects the pair on its own.
    else if ((n - (sameGender ? 0 : 0.05) >= 0.8 && ageClose) || (n >= 0.9 && (ageOk || sameGender))) tier = "Low";
    if (!tier) return null;

    const same = [], diff = [];
    same.push(n >= 0.99 ? "Same name" : "Similar name");
    if (diffM === 0) same.push("Same age");
    else if (ageOk) same.push(`Age within ${plural(diffM, "month")}`);
    else diff.push(`Age differs by ${plural(diffM, "month")}`);
    if (genderKnown) (sameGender ? same : diff).push(sameGender ? "Same gender" : "Different gender");
    if (mobileSame) same.push("Same mobile number");
    if (idSame) same.push("Same ID number");
    return { member: existing, tier, n, same, diff };
  }
  const TIER_RANK = { Definite: 3, Strong: 2, Low: 1 };
  const topTier = () => state.matches.reduce((t, m) => (TIER_RANK[m.tier] > TIER_RANK[t] ? m.tier : t), "Low");

  // ---------- Icons ----------
  const ICON = {
    back: '<svg viewBox="0 0 8 10" aria-hidden="true"><path d="M7 0v10L0 5z" fill="currentColor"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.5-2.8 4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z"/></svg>',
    personAdd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8V4a1 1 0 0 1 1-1h4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="7" y="7" width="10" height="3" rx=".5" fill="currentColor"/><rect x="7" y="14" width="10" height="3" rx=".5" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    caret: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    hourglass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5-4-4V4h8v3.5l-4 4z"/></svg>',
    check: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="3"/><path d="m14 24.5 7 7 13-14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
    family: '<svg class="tile-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A2.01 2.01 0 0 0 18.06 7h-.12a2 2 0 0 0-1.9 1.37l-.86 2.58c1.08.6 1.82 1.73 1.82 3.05v8h3zm-7.5-10.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6h1.5v7h4zm6.5 0v-4h1v-4c0-.82-.68-1.5-1.5-1.5h-2c-.82 0-1.5.68-1.5 1.5v4h1v4h3z"/></svg>',
    outside: '<svg class="tile-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 10h5l3-3-3-3h-5V2h-2v2H4v6h7v2H6l-3 3 3 3h5v4h2v-4h7v-6h-7v-2z"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gps: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m4.8 8.2 2.2 2.2 4.2-4.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar: '<svg class="date-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11z"/></svg>',
    error: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 4.5v4.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.3" r="1" fill="#fff"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11H7v-2h10v2z"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    alertWarn: '<svg class="dialog-icon" viewBox="0 0 48 44" aria-hidden="true"><path d="M24 1 47 43H1z" fill="#B91900"/><path d="M24 15v14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><circle cx="24" cy="36" r="2.6" fill="#fff"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
    notFound: '<svg class="empty-art" viewBox="0 0 160 124" fill="none" aria-hidden="true">'
      + '<rect x="34" y="14" width="68" height="84" rx="3" fill="#fff" stroke="#B1B4B6" stroke-width="2"/>'
      + '<circle cx="48" cy="32" r="6" fill="#DEEFFF" stroke="#0B4B66" stroke-width="1.5"/><path d="M60 30h32M60 35h22" stroke="#B1B4B6" stroke-width="2" stroke-linecap="round"/>'
      + '<circle cx="48" cy="56" r="6" fill="#DEEFFF" stroke="#0B4B66" stroke-width="1.5"/><path d="M60 54h32M60 59h22" stroke="#B1B4B6" stroke-width="2" stroke-linecap="round"/>'
      + '<circle cx="48" cy="80" r="6" fill="#DEEFFF" stroke="#0B4B66" stroke-width="1.5"/><path d="M60 78h32M60 83h22" stroke="#B1B4B6" stroke-width="2" stroke-linecap="round"/>'
      + '<circle cx="74" cy="56" r="15" fill="#fff" fill-opacity=".6" stroke="#363636" stroke-width="5"/><path d="m63 67-14 14" stroke="#363636" stroke-width="6" stroke-linecap="round"/>'
      + '<path d="M112 70 132 104H92z" fill="#fff" stroke="#363636" stroke-width="2.5" stroke-linejoin="round"/><circle cx="112" cy="92" r="9" fill="#B91900"/><path d="M112 87v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="112" cy="96" r="1.2" fill="#fff"/>'
      + '</svg>'
  };

  // ---------- Shared components ----------
  const tagPill = text => `<div class="tag">${ICON.person}<span>${esc(text)}</span></div>`;
  const title = text => `<h1 class="page-title" id="page-title" tabindex="-1">${esc(text)}</h1>`;
  const errorText = (id, msg) => `<p class="field-error" id="${id}-err" ${msg ? "" : "hidden"}>${ICON.error}<span>${esc(msg || "")}</span></p>`;
  const reqMark = r => (r ? '<span class="req" aria-hidden="true">*</span>' : "");
  const notice = (kind, text, extra = "") => `<div class="notice notice-${kind}" role="${kind === "error" ? "alert" : "status"}">${ICON[{ ok: "ok", warn: "warn", error: "stop", info: "info" }[kind]]}<div><p>${text}</p>${extra}</div></div>`;

  function textField({ id, label, value, required, type = "text", inputmode, help }) {
    const err = state.errors[id];
    return `<div class="field">
      <label class="field-label" for="${id}">${esc(label)}${reqMark(required)}</label>
      <input class="input ${err ? "invalid" : ""}" id="${id}" type="${type}" value="${esc(value)}" autocomplete="off"
        ${inputmode ? `inputmode="${inputmode}"` : ""} ${required ? 'aria-required="true"' : ""} aria-invalid="${!!err}" aria-describedby="${help ? `${id}-help ` : ""}${id}-err" />
      ${help ? `<p class="field-help" id="${id}-help">${esc(help)}</p>` : ""}
      ${errorText(id, err)}
    </div>`;
  }

  function selectField({ id, label, value, options, required, hidden }) {
    const err = state.errors[id];
    return `<div class="field" id="${id}-wrap" ${hidden ? "hidden" : ""}>
      <label class="field-label" for="${id}">${esc(label)}${reqMark(required)}</label>
      <div class="select-wrap">
        <select class="input ${err ? "invalid" : ""}" id="${id}" ${required ? 'aria-required="true"' : ""} aria-invalid="${!!err}" aria-describedby="${id}-err">
          <option value="" ${value ? "" : "selected"}></option>
          ${options.map(o => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}
        </select>${ICON.caret}
      </div>
      ${errorText(id, err)}
    </div>`;
  }

  function dobAgeField(p) {
    const err = state.errors["p-age"], inv = err ? "invalid" : "";
    return `<div class="field" id="p-age-group">
      <p class="field-label" id="p-age-label">Date of birth or age${reqMark(true)}</p>
      <div class="dob-age secondary-container" role="group" aria-labelledby="p-age-label">
        <label class="field-label" for="p-dob">Date of birth</label>
        <div class="date-wrap">
          <input class="input date-input ${inv} ${p.dob ? "" : "is-empty"}" id="p-dob" type="date" value="${esc(p.dob)}" max="${isoDate(new Date())}" aria-describedby="p-age-err" />
          ${ICON.calendar}
        </div>
        <p class="or-divider" aria-hidden="true">(or)</p>
        <fieldset class="age-fieldset">
          <legend class="field-label">Age</legend>
          <div class="age-grid">
            <input class="input ${inv}" id="p-years" inputmode="numeric" maxlength="3" placeholder="Years" aria-label="Age in years" value="${esc(p.years)}" aria-describedby="p-age-err" />
            <input class="input ${inv}" id="p-months" inputmode="numeric" maxlength="2" placeholder="Months" aria-label="Age in months" value="${esc(p.months)}" aria-describedby="p-age-err" />
          </div>
        </fieldset>
      </div>
      ${errorText("p-age", err)}
    </div>`;
  }

  // Status chip on member cards (product wording).
  function statusChip(p) {
    const chips = [];
    if (p.flag) chips.push(`<span class="status-chip chip-warn">${ICON.warn}Needs supervisor check</span>`);
    if (p.status === "pending") chips.push(`<span class="status-chip chip-pending">${ICON.hourglass}Visit Pending</span>`);
    if (p.status === "not") chips.push(`<span class="status-chip chip-info">Not Administered</span>`);
    if (p.status === "done") chips.push(`<span class="status-chip chip-ok">${ICON.tick}Vaccinated</span>`);
    return chips.length ? `<div class="chip-row">${chips.join("")}</div>` : "";
  }

  // Household card used on search results and in the nearby-household check.
  // showDistance: only in the nearby-household check (Layer 2); search results are name only.
  // matchTag ("Similar spelling" / "Similar name") sits right next to the matched person's name.
  function householdCard(h, { matched, matchTag = "", q = "", action = "open-hh", label = "Open Household", showDistance = false } = {}) {
    const kids = h.members.filter(p => !p.head);
    const tagFor = name => (matchTag && name === matched ? `<span class="match-tag">${esc(matchTag)}</span>` : "");
    return `<li><article class="hh-card" aria-labelledby="hh-${h.id}">
      <div class="hh-top">
        <h3 class="hh-name" id="hh-${h.id}">${highlight(h.head, q)}</h3>
        ${tagFor(h.head)}
        ${showDistance ? `<span class="hh-dist">${ICON.pin}${h.m} m away</span>` : ""}
      </div>
      <p class="hh-sub">Household head · ${plural(h.members.length, "member")}</p>
      ${kids.length ? `<ul class="hh-members">${kids.map(p => `<li class="${p.name === matched ? "is-match" : ""}"><span class="hh-member-name">${highlight(p.name, q)}${tagFor(p.name)}</span><span>${esc(p.gender)}, ${esc(ageLabel(p.age))}</span></li>`).join("")}</ul>` : ""}
      <button class="btn btn-secondary card-btn" data-action="${action}" data-id="${h.id}" aria-describedby="hh-${h.id}">${esc(label)}</button>
    </article></li>`;
  }

  function highlight(name, q) {
    const t = tokens(q).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!t.length) return esc(name);
    const re = new RegExp(`\\b(${t.join("|")})`, "gi");
    return name.split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
  }

  // ---------- Sync result (W1 + W11) ----------
  // Two states per sync type: succeeded or failed. Failed shows when it last succeeded.
  const syncResult = ok => (ok ? `Succeeded, ${LAST_OK.toLowerCase()}` : `Failed. Last succeeded ${LAST_GOOD_BEFORE.toLowerCase()}`);

  function syncCard() {
    const ok = syncOk();
    // Compact: status pill + one summary line.
    const summary = [
      ok ? `Synced ${LAST_OK.toLowerCase()}` : `Last succeeded ${LAST_GOOD_BEFORE.toLowerCase()}`,
      `${ok ? "1,248" : "1,236"} records`,
      `${store.pending} waiting to sync`
    ];
    let msg = "", btn = "";
    if (ok && store.pending > 0) {
      btn = `<button class="btn btn-secondary btn-sm" data-action="retry-sync">${ICON.sync}Sync Now</button>`;
    }
    if (!ok) {
      msg = store.continued
        ? notice("error", "<b>Sync failed.</b> You’re continuing without the latest data. New records are checked again once they sync.")
        : "";
      btn = `<button class="btn btn-secondary btn-sm" data-action="retry-sync">${ICON.sync}Retry Sync</button>
        ${store.retryFailed && !store.continued ? `<button class="btn-link" data-action="continue-failed">Continue Without Sync</button>` : ""}`;
    }
    // Pill: failed (red) > pending, records waiting to sync (amber) > succeeded (green).
    const failed = !ok;
    const pending = !failed && store.pending > 0;
    const pill = failed ? ["error", "Sync failed"] : pending ? ["warn", "Sync pending"] : ["ok", "Sync succeeded"];
    return `<section class="card sync-card" aria-labelledby="sync-title">
      <div class="sync-head">
        <h2 class="card-title" id="sync-title">Data on this device</h2>
        <span class="pill pill-${pill[0]}">${pill[1]}</span>
      </div>
      <p class="sync-summary">${summary.map(t => `<span>${esc(t)}</span>`).join('<span class="sep" aria-hidden="true"></span>')}</p>
      ${msg}
      ${btn ? `<div class="sync-actions">${btn}</div>` : ""}
    </section>`;
  }

  // W11: thin banner under the Back / Help row on every inner screen.
  function sysBanner() {
    const n = store.pending;
    let b = null;
    if (!syncOk()) b = ["error", store.continued ? "Sync failed. Continuing without the latest data." : "Sync failed. Recent records may be missing.", "Retry", "retry-sync"];
    if (!b) return "";
    return `<div class="sys-banner banner-${b[0]}" role="status">${ICON[b[0] === "error" ? "stop" : "info"]}<span>${esc(b[1])}</span>${b[2] ? `<button class="banner-btn" data-action="${b[3]}">${esc(b[2])}</button>` : ""}</div>`;
  }

  // ---------- Screens ----------
  const VIEWS = {
    // W1
    home() {
      const tile = (action, icon, label) => `<li><button class="home-tile" data-action="${action}">${ICON[icon]}<span>${esc(label)}</span></button></li>`;
      return {
        body: `<h1 class="sr-only" id="page-title" tabindex="-1">Home</h1>
          ${syncCard()}
          <ul class="home-tiles">
            ${tile("start-search", "family", "Enumeration and Vaccination")}
            ${tile("not-in-prototype", "outside", "Outside Household Vaccination")}
          </ul>
          <p class="powered">Powered by <b>DIGIT</b></p>`
      };
    },

    // W2 + W3
    search() {
      return {
        body: `${title("Search Beneficiary")}
          <div class="search" role="search">
            <label class="sr-only" for="search-input">Name of the beneficiary</label>
            <div class="search-box">${ICON.search}
              <input class="input search-input" id="search-input" type="search" placeholder="To start, enter the name of the beneficiary" value="${esc(state.query)}" autocomplete="off" />
            </div>
          </div>
          <div id="search-results">${searchResultsHtml()}</div>`,
        footer: searchFooterHtml()
      };
    },

    // W4
    household() {
      const d = state.draftHH;
      const err = state.errors["hh-size"], n = Number(d.size) || 0;
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Household Details")}
          <div class="card">
            <div class="field" id="hh-size-group">
              <label class="field-label" for="hh-size">Number of members${reqMark(true)}</label>
              <div class="counter ${err ? "invalid" : ""}">
                <button class="counter-btn" data-action="size-down" aria-label="Decrease number of members" ${n <= 1 ? "disabled" : ""}>${ICON.minus}</button>
                <input class="counter-input" id="hh-size" inputmode="numeric" maxlength="2" value="${esc(d.size)}" aria-required="true" aria-invalid="${!!err}" aria-describedby="hh-size-help hh-size-err" />
                <button class="counter-btn" data-action="size-up" aria-label="Increase number of members" ${n >= 99 ? "disabled" : ""}>${ICON.plus}</button>
              </div>
              <p class="field-help" id="hh-size-help">Include the household head.</p>
              ${errorText("hh-size", err)}
            </div>
            <div class="field coords-field">
              <label class="field-label" for="hh-coords">Household coordinates</label>
              <input class="input" id="hh-coords" value="8.48402, -13.22994" disabled aria-describedby="hh-coords-help" />
              <p class="gps" id="hh-coords-help">${ICON.gps}Captured automatically. Accuracy 6 m</p>
            </div>
          </div>`,
        footer: `<button class="btn btn-primary" data-action="hh-continue">Continue</button>`
      };
    },

    // W5
    overview() {
      const h = hh();
      const head = h.members.find(p => p.head) || { name: h.head };
      const card = p => {
        const btn = !isChild(p) ? ""
          : p.status === "not"
            ? `<button class="btn btn-secondary card-btn" data-action="unable" data-id="${p.id}">Unable to Vaccinate</button>`
            : `<button class="btn btn-primary card-btn" data-action="take-action" data-id="${p.id}">Take Action</button>`;
        return `<li><article class="member-card ${p.flag ? "is-flagged" : ""}" aria-labelledby="m-${p.id}">
          <div class="member-top">
            <h3 class="member-name" id="m-${p.id}">${esc(p.name)}</h3>
            <button class="edit-link" data-action="not-in-prototype" aria-label="Edit ${esc(p.name)}">${ICON.edit}Edit</button>
          </div>
          <p class="member-sub"><span>${esc(p.gender || "Gender not recorded")}</span><span class="sep" aria-hidden="true"></span><span>${esc(ageLabel(p.age))}</span></p>
          ${statusChip(p)}
          ${btn}
        </article></li>`;
      };
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Household Overview")}
          <button class="btn btn-secondary btn-auto" data-action="not-in-prototype">${ICON.edit}Edit Household</button>
          <div class="card hh-overview">
            <dl class="pairs">
              <div class="pair"><dt>Household Head</dt><dd>${esc(head.name)}</dd></div>
              <div class="pair"><dt>Member Count</dt><dd>${String(Math.max(h.size || 0, h.members.length)).padStart(2, "0")}</dd></div>
            </dl>
            <ul class="member-list">${h.members.map(card).join("")}</ul>
          </div>
          ${deliveryAlertHtml()}`,
        footer: `<button class="btn btn-primary" data-action="add-member">${ICON.personAdd}Add Member</button>`
      };
    },

    // W6
    individual() {
      const p = state.person;
      return {
        tag: ASSIGNED_AREA,
        body: `${title(screen().name)}
          <div class="card">
            ${textField({ id: "p-name", label: state.draftHH ? "Name of the household head" : "Name of the individual", value: p.name, required: true })}
            ${selectField({ id: "p-idtype", label: "ID type", value: p.idType, options: ID_TYPES, required: true })}
            <div id="p-idnumber-wrap" ${p.idType === "Not available" ? "hidden" : ""}>${textField({ id: "p-idnumber", label: "ID number", value: p.idNumber, required: true })}</div>
            ${dobAgeField(p)}
            <fieldset class="field plain-fieldset" id="p-gender-group">
              <legend class="field-label">Gender</legend>
              <div class="secondary-container radios toggle">
                ${["Female", "Male"].map(o => `<label class="toggle-opt"><input type="radio" name="p-gender" value="${o}" ${o === p.gender ? "checked" : ""}/><span>${o}</span></label>`).join("")}
              </div>
            </fieldset>
            ${textField({ id: "p-mobile", label: "Mobile number", value: p.mobile, type: "tel", inputmode: "tel" })}
          </div>
          ${state.compareOpen ? compareDialogHtml() : ""}
          ${state.matches.length ? quickReasonHtml() : ""}
          ${nearbyDialogHtml()}`,
        footer: `<button class="btn btn-primary" data-action="person-continue">Continue</button>`
      };
    },

    // W8: existing "Existing matches" list, opened straight away (no "N matches found" step).
    matches() {
      const item = (m, i) => `<li><article class="xm-card" aria-labelledby="xm-${i}">
          <div class="xm-head">
            <span class="xm-id" id="xm-${i}">ID ${esc(regId(m.member))}</span>
          </div>
          <ul class="xm-reasons" aria-label="Why this may be the same person">${m.same.map(r => `<li>${esc(r)}</li>`).join("")}${m.diff.map(r => `<li class="is-diff">${esc(r)}</li>`).join("")}</ul>
          <dl class="xm-grid">
            <div><dt>Full name</dt><dd>${esc(m.member.name)}</dd></div>
            <div><dt>Age</dt><dd>${esc(ageLabel(m.member.age))}</dd></div>
            <div><dt>Gender</dt><dd>${esc(m.member.gender || "–")}</dd></div>
          </dl>
          <div class="xm-actions">
            <button class="btn btn-primary" data-action="same-person" data-i="${i}" aria-describedby="xm-${i}">Use Matched Registration</button>
            <button class="btn-link xm-compare" data-action="open-compare" data-i="${i}" aria-describedby="xm-${i}">Compare Details</button>
          </div>
        </article></li>`;
      return {
        body: `<h1 class="xm-title" id="page-title" tabindex="-1">Existing matches (${state.matches.length})</h1>
          <p class="xm-desc">Select the record that matches the person you are registering.</p>
          <ul class="xm-list">${state.matches.map(item).join("")}</ul>
          ${state.compareOpen ? compareDialogHtml() : ""}
          ${quickReasonHtml()}`,
        footer: `<button class="btn btn-secondary" data-action="continue-current">Continue Current Registration</button>`
      };
    },

    // W9
    reason() {
      const r = state.reason, err = state.errors["r-why"];
      const names = state.matches.map(m => m.member.name);
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Add as New Person")}
          <p class="page-desc page-desc-2">${esc(state.person.name.trim())} looks like ${esc(names.join(" and "))}, already in this household.</p>
          <div class="card">
            <fieldset class="field radios ${err ? "has-error" : ""}" id="r-why-group" aria-describedby="r-why-err">
              <legend>Why is this a different person?${reqMark(true)}</legend>
              ${NEW_PERSON_REASONS.map(o => `<label class="radio"><input type="radio" name="r-why" value="${esc(o)}" ${o === r.why ? "checked" : ""}/>${esc(o)}</label>`).join("")}
              ${errorText("r-why", err)}
            </fieldset>
          </div>
          <p class="or-line">Not sure? Choose Needs Supervisor Check. The person is added and your supervisor checks the records.</p>
          ${confirmDialogHtml()}`,
        footer: `<button class="btn btn-primary" data-action="reason-submit">${ICON.personAdd}Add as New Person</button>
          <button class="btn btn-secondary" data-action="needs-check">Needs Supervisor Check</button>`
      };
    },

    checklist() {
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Vaccination Checklist")}
          <div class="card">
            <fieldset class="plain-fieldset checklist" disabled>
              <legend class="sr-only">Vaccination checklist</legend>
              ${CHECKLIST.map(i => `<label class="checkbox"><input type="checkbox" checked disabled/><span class="box">${ICON.tick}</span>${esc(i.label)}</label>`).join("")}
            </fieldset>
          </div>`,
        footer: `<button class="btn btn-primary" data-action="submit-checklist">Submit</button>`
      };
    },

    success() {
      return {
        tag: ASSIGNED_AREA,
        body: `<div class="card panel-card">
            <div class="success-panel" role="status">
              ${ICON.check}
              <h1 class="success-title" id="page-title" tabindex="-1">Vaccination Successful</h1>
            </div>
            <p class="success-desc">${esc(SCREENS.success.desc)}</p>
            <div class="panel-actions">
              <button class="btn btn-primary" data-action="to-overview">Back to Household</button>
            </div>
          </div>`
      };
    }
  };

  // ---------- W7 Possible Match Found (existing alert component) ----------
  const regId = m => `REG-${100000 + (parseInt(String(m.id).replace(/\D/g, "").slice(-5), 10) || 0)}`;
  function compareDialogHtml() {
    const m = state.matches[state.compareIdx], e = m.member, p = state.person;
    const newAge = personMonths(p);
    const rows = [
      ["Full Name", e.name, p.name.trim(), nameSim(e.name, p.name) < 0.99],
      ["Age", ageLabel(e.age), ageLabel(newAge), e.age !== newAge],
      ["Gender", e.gender || "–", p.gender || "–", !!(e.gender && p.gender && e.gender !== p.gender)],
      ["Mobile Number", e.mobile || "–", p.mobile || "–", !!(e.mobile && p.mobile && e.mobile !== p.mobile.replace(/\D/g, ""))],
      ["ID Number", e.idNumber || "–", p.idType === "Not available" ? "–" : p.idNumber || "–", !!(e.idNumber && p.idNumber && e.idNumber !== p.idNumber)]
    ];
    return `<div class="dialog-backdrop" id="compare-dialog">
      <div class="dialog alert" role="alertdialog" aria-modal="true" aria-labelledby="pm-title" aria-describedby="pm-desc">
        <button class="dialog-close" data-action="close-compare" aria-label="Close">${ICON.close}</button>
        ${ICON.alertWarn}
        <h2 class="dialog-title" id="pm-title">Possible Match Found</h2>
        <p class="dialog-desc" id="pm-desc"><strong>${esc(e.name)}</strong> is already registered in this household and may be the same person. Review the details to confirm.</p>
        <ul class="alert-reasons" aria-label="Why this may be the same person">
          ${m.same.map(r => `<li>${ICON.ok}<span>${esc(r)}</span></li>`).join("")}
          ${m.diff.map(r => `<li class="is-diff">${ICON.info}<span>${esc(r)}</span></li>`).join("")}
        </ul>
        <table class="pm-table">
          <caption class="sr-only">Existing record compared with this registration</caption>
          <thead><tr>
            <th scope="col"><span class="sr-only">Field</span></th>
            <th scope="col">Existing record<span class="pm-id">ID ${esc(regId(e))}</span></th>
            <th scope="col">This registration</th>
          </tr></thead>
          <tbody>${rows.map(([l, a, b, d]) => `<tr class="${d ? "is-diff" : ""}"><th scope="row">${esc(l)}</th><td>${esc(a)}</td><td>${esc(b)}${d ? '<span class="sr-only"> (different)</span>' : ""}</td></tr>`).join("")}</tbody>
        </table>
        <div class="dialog-actions">
          <button class="btn btn-primary" data-action="same-person" data-i="${state.compareIdx}">Use Matched Registration</button>
          <button class="btn btn-secondary" data-action="continue-current">Continue Current Registration</button>
        </div>
      </div>
    </div>`;
  }

  // ---------- Search results (W3) ----------
  function searchResultsHtml() {
    const q = state.query.trim();
    const hits = searchHouseholds(q);
    const meta = !store.synced ? `<p class="search-meta search-failed">${ICON.stop}Sync failed. Last succeeded ${esc(LAST_GOOD_BEFORE.toLowerCase())}. Search may miss households.</p>` : "";
    if (!hits) return meta;
    if (!hits.length) {
      return `${meta}<div class="empty" role="status">
        ${ICON.notFound}
        <h3>Beneficiary not found!</h3>
        <p>We couldn’t find this beneficiary in the records. You can add them as a new beneficiary.</p>
      </div>`;
    }
    return `${meta}<p class="search-meta" role="status">${plural(hits.length, "household")} found</p>
      <ul class="hh-list">${hits.map(r => householdCard(r.h, { matched: r.matched, matchTag: r.fuzzy ? "Similar spelling" : "", q })).join("")}</ul>
      <p class="none-line">Not in this list? Register a new beneficiary.</p>`;
  }
  // Register unlocks only once a search has run.
  const searchFooterHtml = () => `<button class="btn btn-primary" id="register-btn" data-action="register" ${searchHouseholds(state.query.trim()) ? "" : "disabled"}>${ICON.personAdd}Register New Beneficiary</button>
    <button class="btn btn-secondary" data-action="not-in-prototype">${ICON.qr}Scan QR Code</button>`;
  function refreshSearch() {
    document.getElementById("search-results").innerHTML = searchResultsHtml();
    document.getElementById("register-btn").outerHTML = searchFooterHtml().split("\n")[0];
  }

  // ---------- Dialogs ----------
  let nearby = [];
  function nearbyDialogHtml() {
    if (!nearby.length) return "";
    return `<div class="dialog-backdrop" id="nearby-dialog">
      <div class="dialog alert" role="alertdialog" aria-modal="true" aria-labelledby="nearby-title" aria-describedby="nearby-desc">
        <button class="dialog-close" data-action="close-nearby" aria-label="Close">${ICON.close}</button>
        ${ICON.alertWarn}
        <h2 class="dialog-title" id="nearby-title">Household May Already Exist</h2>
        <p class="dialog-desc" id="nearby-desc">${nearby.length === 1 ? "A household" : `${nearby.length} households`} within ${NEARBY_M} m ${nearby.length === 1 ? "has" : "have"} someone with a similar name. Is this one of these households?</p>
        <ul class="hh-list alert-list">${nearby.map(n => householdCard(n.h, { action: "nearby-open", label: "Use This Household", matched: n.matched, matchTag: "Similar name", showDistance: true })).join("")}</ul>
        <div class="dialog-actions">
          <button class="btn btn-secondary" data-action="nearby-new">Create New Household</button>
        </div>
      </div>
    </div>`;
  }

  function quickReasonHtml() {
    return `<div class="dialog-backdrop" id="quick-dialog" hidden>
      <div class="dialog alert" role="dialog" aria-modal="true" aria-labelledby="quick-title" aria-describedby="quick-desc">
        <button class="dialog-close" data-action="close-quick" aria-label="Close">${ICON.close}</button>
        <h2 class="dialog-title" id="quick-title">Add as New Person</h2>
        <p class="dialog-desc" id="quick-desc">Why is this a different person?</p>
        <div class="dialog-actions">${NEW_PERSON_REASONS.map(r => `<button class="btn btn-secondary" data-action="quick-reason" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
      </div>
    </div>`;
  }

  function confirmDialogHtml() {
    const m = state.matches[0];
    return `<div class="dialog-backdrop" id="confirm-dialog" hidden>
      <div class="dialog alert" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
        <button class="dialog-close" data-action="close-confirm" aria-label="Close">${ICON.close}</button>
        ${ICON.alertWarn}
        <h2 class="dialog-title" id="confirm-title">Person May Already Exist</h2>
        <p class="dialog-desc" id="confirm-desc"><strong>${esc(m.member.name)}</strong> is already in this household. Adding <strong>${esc(state.person.name.trim())}</strong> may create a duplicate record. Do you want to add a new person anyway?</p>
        <div class="dialog-actions">
          <button class="btn btn-primary" data-action="close-confirm">Go Back</button>
          <button class="btn btn-secondary" data-action="confirm-new">Add New Person Anyway</button>
        </div>
      </div>
    </div>`;
  }

  // W10: shown on Household Overview only when the child is not clear to vaccinate.
  let deliveryAlert = "";   // "" | served | flag | sync
  function deliveryAlertHtml() {
    if (!deliveryAlert) return "";
    const p = member(), n = `<strong>${esc(p.name)}</strong>`;
    const a = {
      served: ["Already Vaccinated", `${n} was vaccinated this round. ${esc(p.servedAt)} by ${esc(p.servedBy)} at ${esc(p.servedWhere || "this household")}. Don’t vaccinate again.`,
        `<button class="btn btn-primary" data-action="close-delivery">Back to Household</button><button class="btn btn-secondary" data-action="hold">Flag for Supervisor</button>`],
      flag: ["Possible Duplicate", `${n} may be registered twice. Your supervisor will check the records. You can still vaccinate, so the child isn’t missed.`,
        `<button class="btn btn-primary" data-action="vaccinate">Vaccinate</button><button class="btn btn-secondary" data-action="hold">Hold and Flag</button>`],
      sync: ["Sync Failed", `Recent vaccinations may be missing. Ask the caregiver whether ${n} was vaccinated this round.`,
        `<button class="btn btn-primary" data-action="vaccinate">Vaccinate</button><button class="btn btn-secondary" data-action="hold">Hold and Flag</button>`]
    }[deliveryAlert];
    return `<div class="dialog-backdrop" id="delivery-dialog">
      <div class="dialog alert" role="alertdialog" aria-modal="true" aria-labelledby="dl-title" aria-describedby="dl-desc">
        <button class="dialog-close" data-action="close-delivery" aria-label="Close">${ICON.close}</button>
        ${ICON.alertWarn}
        <h2 class="dialog-title" id="dl-title">${a[0]}</h2>
        <p class="dialog-desc" id="dl-desc">${a[1]}</p>
        <div class="dialog-actions">${a[2]}</div>
      </div>
    </div>`;
  }

  let dialogReturn = null;
  function openDialog(id) {
    const d = document.getElementById(id);
    if (!d) return;
    dialogReturn = document.activeElement;
    d.hidden = false;
    d.querySelector("button")?.focus();
  }
  function closeDialog(id) {
    const d = document.getElementById(id);
    if (!d) return;
    d.hidden = true;
    dialogReturn?.focus();
  }

  // ---------- Render ----------
  function render({ focusTitle = true } = {}) {
    const view = VIEWS[state.route]();
    const inner = state.route !== "home";
    $phone.innerHTML = `
      <header class="home-bar">
        <button class="icon-btn" data-action="not-in-prototype" aria-label="Menu">${ICON.menu}</button>
        <button class="area-btn" data-action="not-in-prototype" aria-haspopup="menu">${esc(ASSIGNED_AREA)}${ICON.caret}</button>
      </header>
      ${inner ? `<div class="app-bar">
          <button class="back-btn" data-action="back">${ICON.back}Back</button>
          <button class="help-btn" data-action="help" aria-haspopup="dialog">Help${ICON.help}</button>
        </div>${sysBanner()}` : ""}
      <div class="body body-${state.route}" id="screen-body">${view.tag ? tagPill(view.tag) : ""}${withDescription(view.body)}</div>
      ${view.footer ? `<footer class="footer">${view.footer}</footer>` : ""}
      <div class="sheet-backdrop" id="help-sheet" hidden>
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div class="sheet-handle" aria-hidden="true"></div>
          <h2 id="help-title"></h2>
          <p id="help-desc"></p>
          <button class="btn btn-primary" data-action="close-help">Got it</button>
        </div>
      </div>
      <div class="toast" id="toast" role="status" hidden></div>`;
    document.title = `${screen().name} – Duplication Flow`;
    if (document.getElementById("compare-dialog")) document.querySelector("#compare-dialog .btn-primary")?.focus();
    else if (document.getElementById("nearby-dialog")) document.querySelector("#nearby-dialog button")?.focus();
    else if (focusTitle) document.getElementById("page-title")?.focus({ preventScroll: true });
    if (state.route === "search" && !state.query) document.getElementById("search-input")?.focus();
    syncDemoPanel();
  }

  // Page description sits directly under the page title (same pattern as polio-app).
  function withDescription(body) {
    if (["home", "success", "matches"].includes(state.route)) return body;
    return body.replace("</h1>", `</h1><p class="page-desc" id="page-desc">${esc(screen().desc)}</p>`);
  }

  function go(route, { replace = false } = {}) {
    if (!replace) state.history.push(state.route);
    state.route = route;
    state.errors = {};
    render();
    document.getElementById("screen-body").scrollTop = 0;
  }
  // Return to an earlier screen in the history, dropping everything after it.
  function backTo(route) {
    const i = state.history.lastIndexOf(route);
    if (i >= 0) state.history = state.history.slice(0, i);
    state.route = route;
    state.errors = {};
    render();
  }
  function back() {
    if (!state.history.length) return toast("You’re on the first screen of this flow.");
    nearby = [];
    state.route = state.history.pop();
    state.errors = {};
    render();
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  let helpReturn = null;
  function openHelp() {
    document.getElementById("help-title").textContent = screen().name;
    document.getElementById("help-desc").textContent = screen().desc;
    helpReturn = document.activeElement;
    document.getElementById("help-sheet").hidden = false;
    document.querySelector('[data-action="close-help"]').focus();
  }
  function closeHelp() { document.getElementById("help-sheet").hidden = true; helpReturn?.focus(); }

  // ---------- Validation ----------
  function showErrors(errors) {
    state.errors = errors;
    for (const [id, msg] of Object.entries(errors)) {
      const err = document.getElementById(`${id}-err`);
      if (err) { err.hidden = !msg; err.querySelector("span").textContent = msg || ""; }
      const input = document.getElementById(id);
      if (input) { input.classList.toggle("invalid", !!msg); input.setAttribute("aria-invalid", String(!!msg)); }
      document.getElementById(`${id}-group`)?.classList.toggle("has-error", !!msg);
      document.querySelectorAll(`#${id}-group .input`).forEach(el => { el.classList.toggle("invalid", !!msg); el.setAttribute("aria-invalid", String(!!msg)); });
    }
    const first = Object.keys(errors).find(id => errors[id]);
    if (first) { (document.getElementById(first) || document.querySelector(`#${first}-group input, #${first}-group button`))?.focus(); return false; }
    return true;
  }

  // ---------- Saving ----------
  function queueUpload() {
    store.pending++;
    save();
    if (store.synced && !store.hold) setTimeout(() => {
      if (!store.synced || store.hold) return;
      store.pending = Math.max(0, store.pending - 1); save(); syncDemoPanel();
      const b = document.querySelector(".sys-banner"); if (b && !store.pending && syncOk()) b.remove();
    }, 4000);
  }
  const recordTags = () => (syncOk() ? [] : ["SYNC_FAILED"]);

  function savePerson(extra = {}) {
    const p = state.person;
    const rec = {
      id: `p-${Date.now()}`, name: p.name.trim(), gender: p.gender, age: personMonths(p), head: p.isHead,
      mobile: p.mobile.replace(/\D/g, ""), idNumber: p.idType === "Not available" ? "" : p.idNumber.trim(),
      status: personMonths(p) < 60 ? "pending" : undefined,
      meta: { collector: "You", round: 2, tags: recordTags(), at: new Date().toISOString() },
      ...extra
    };
    if (state.draftHH) {
      const d = state.draftHH;
      const id = `hh-${Date.now()}`;
      store.households.unshift({ id, head: rec.name, size: Number(d.size) || 1, m: 0, lat: 8.48402, lng: -13.22994, accuracy: 6, members: [rec], meta: { searchTerm: d.searchTerm, candidates: d.candidates, tags: recordTags() } });
      state.hhId = id;
      state.draftHH = null;
      queueUpload();
      state.history = state.history.slice(0, state.history.lastIndexOf("search") + 1);
      state.route = "overview"; state.errors = {}; render();
      toast(store.synced && !store.hold ? "Household created. Syncing now." : "Household created. Saved on this device.");
      return;
    }
    hh().members.push(rec);
    queueUpload();
    backTo("overview");
    toast(extra.flag ? `${rec.name} added. Your supervisor will check the records.` : `${rec.name} added to the household.`);
  }

  function setSize(n) {
    n = Math.max(1, Math.min(99, n));
    state.draftHH.size = String(n);
    const el = document.getElementById("hh-size");
    el.value = state.draftHH.size;
    document.querySelector('[data-action="size-down"]').disabled = n <= 1;
    document.querySelector('[data-action="size-up"]').disabled = n >= 99;
    if (state.errors["hh-size"]) { showErrors({ "hh-size": "" }); document.querySelector(".counter").classList.remove("invalid"); }
  }

  // ---------- Actions ----------
  const ACTIONS = {
    back,
    help: openHelp,
    "close-help": closeHelp,
    "not-in-prototype"() { toast("This isn’t part of the prototype."); },

    // W1
    "start-search"() { state.query = ""; go("search"); },
    "retry-sync"() {
      if (store.retryWorks) {
        store.synced = true; store.hold = false; store.pending = 0; store.retryFailed = false; store.continued = false;
        save(); render({ focusTitle: false });
        toast("Sync succeeded.");
      } else {
        store.retryFailed = true; save(); render({ focusTitle: false });
        toast("Sync failed again. Try again, or continue without sync.");
      }
    },
    "continue-failed"() {
      store.continued = true; save(); render({ focusTitle: false });
      toast("Continuing without the latest data. New records are checked again once they sync.");
    },

    // W3
    "open-hh"(btn) { state.hhId = btn.dataset.id; go("overview"); },
    register() {
      const hits = searchHouseholds(state.query.trim()) || [];
      state.draftHH = { size: "1", searchTerm: state.query.trim(), candidates: hits.map(h => h.h.id) };
      store.log.push({ term: state.query.trim(), shown: hits.length, at: new Date().toISOString() }); save();
      nearby = [];
      go("household");
    },

    // W4
    "size-down"() { setSize((Number(state.draftHH.size) || 1) - 1); },
    "size-up"() { setSize((Number(state.draftHH.size) || 0) + 1); },
    "hh-continue"() {
      const n = Number(state.draftHH.size);
      if (!showErrors({ "hh-size": !state.draftHH.size ? "Enter the number of members" : !(n >= 1 && n <= 99) ? "Enter a number from 1 to 99" : "" })) return;
      // Next: the head of household's details, on the same form used for every individual.
      state.person = { ...blankPerson(), name: state.draftHH.searchTerm, isHead: true };
      go("individual");
    },
    "close-nearby"() { nearby = []; render({ focusTitle: false }); },
    "nearby-open"(btn) {
      nearby = []; state.draftHH = null; state.hhId = btn.dataset.id;
      state.history = state.history.slice(0, state.history.lastIndexOf("search") + 1);
      state.route = "overview"; render();
      toast("Opened the existing household. No new household created.");
    },
    // No, Create New Household: save the head and create the household.
    "nearby-new"() { nearby = []; savePerson(); },

    // W5
    "add-member"() { state.person = blankPerson(); go("individual"); },
    // W10 delivery check: clear → straight to the checklist; otherwise an alert on the household.
    "take-action"(btn) {
      state.memberId = btn.dataset.id;
      const p = member();
      deliveryAlert = p.status === "done" ? "served" : p.flag ? "flag" : !store.synced ? "sync" : "";
      if (!deliveryAlert) return go("checklist");
      render({ focusTitle: false });
      document.querySelector("#delivery-dialog .btn-primary")?.focus();
    },
    unable() { toast("Recording a reason isn’t part of the prototype."); },

    // W6
    "person-continue"() {
      const p = state.person;
      let ageErr = "";
      if (!p.dob && !p.years && !p.months) ageErr = "Enter the date of birth or age";
      else if (p.dob && !ageFromDob(p.dob)) ageErr = "Date of birth can’t be in the future";
      else if (Number(p.months) > 11) ageErr = "Months must be from 0 to 11";
      const ok = showErrors({
        "p-name": p.name.trim() ? "" : "Enter the name of the individual",
        "p-idtype": p.idType ? "" : "Select the ID type",
        "p-idnumber": p.idType === "Not available" || p.idNumber.trim() ? "" : "Enter the ID number",
        "p-age": ageErr
      });
      if (!ok) return;
      if (state.draftHH) {
        nearby = deviceHouseholds().filter(h => h.m <= NEARBY_M).map(h => {
          let best = null;
          for (const m of h.members) { const s = nameSim(p.name, m.name); if (s >= 0.8 && (!best || s > best.s)) best = { s, matched: m.name }; }
          return best && { h, ...best };
        }).filter(Boolean).sort((a, b) => b.s - a.s);
        if (nearby.length) return render({ focusTitle: false });
        return savePerson();
      }
      state.matches = hh().members.map(m => compare(m, p)).filter(Boolean).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.n - a.n);
      state.reason = { why: "", supervisor: false };
      if (!state.matches.length) return savePerson();
      if (state.matches.length === 1) { state.compareIdx = 0; state.compareOpen = true; return render({ focusTitle: false }); }
      state.compareOpen = false;
      go("matches");
    },

    // W7 / W8
    "open-compare"(btn) { state.compareIdx = Number(btn.dataset.i); state.compareOpen = true; render({ focusTitle: false }); },
    "close-compare"() { state.compareOpen = false; render({ focusTitle: false }); },
    // Continue Current Registration: weak match -> one-tap reason; strong -> reason screen with second confirm.
    "continue-current"() {
      const tier = state.route === "matches" && !state.compareOpen ? topTier() : state.matches[state.compareIdx].tier;
      state.compareOpen = false;
      render({ focusTitle: false });
      if (tier === "Low") openDialog("quick-dialog"); else go("reason");
    },
    "same-person"(btn) {
      if (btn && btn.dataset.i) state.compareIdx = Number(btn.dataset.i);
      state.compareOpen = false;
      const e = state.matches[state.compareIdx].member;
      backTo("overview");
      toast(`${e.name} is already registered. No new record added.`);
    },
    "close-quick"() { closeDialog("quick-dialog"); },
    "quick-reason"(btn) { savePerson({ override: { reason: btn.dataset.r, tier: "Low" } }); },

    // W9
    "reason-submit"() {
      if (!showErrors({ "r-why": state.reason.why ? "" : "Select a reason" })) return;
      openDialog("confirm-dialog");     // second confirm on Strong or Definite
    },
    "close-confirm"() { closeDialog("confirm-dialog"); },
    "confirm-new"() {
      savePerson({ override: { reason: state.reason.why, tier: topTier(), matched: state.matches.map(m => m.member.id) } });
    },
    "needs-check"() {
      savePerson({ flag: true, override: { reason: state.reason.why || "Needs supervisor check", tier: topTier(), matched: state.matches.map(m => m.member.id) } });
    },

    // W10
    vaccinate() { deliveryAlert = ""; go("checklist"); },
    "close-delivery"() { deliveryAlert = ""; render({ focusTitle: false }); },
    hold() {
      member().flag = true; save();
      deliveryAlert = "";
      backTo("overview");
      toast("Vaccination on hold. Your supervisor will check this child’s records.");
    },
    "submit-checklist"() {
      const p = member();
      p.status = "done"; p.servedAt = "Today, " + new Date().toTimeString().slice(0, 5); p.servedBy = "You";
      store.progress.completed++;
      queueUpload();
      state.history = state.history.filter(r => r !== "check" && r !== "checklist");
      go("success", { replace: true });
    },
    "to-overview"() { backTo("overview"); }
  };

  $phone.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (btn && !btn.disabled) ACTIONS[btn.dataset.action]?.(btn);
    else if (e.target.id === "help-sheet") closeHelp();
    else if (e.target.id === "quick-dialog") closeDialog("quick-dialog");
    else if (e.target.id === "confirm-dialog") closeDialog("confirm-dialog");
  });

  // Form fields write straight into state; no re-render, so focus is kept.
  const FIELD_MAP = {
    "hh-size": v => (state.draftHH.size = v.replace(/\D/g, "").slice(0, 2)),
    "p-name": v => (state.person.name = v),
    "p-idtype": v => (state.person.idType = v),
    "p-idnumber": v => (state.person.idNumber = v),
    "p-dob": v => (state.person.dob = v),
    "p-years": v => (state.person.years = v),
    "p-months": v => (state.person.months = v),
    "p-gender": v => (state.person.gender = v),
    "p-mobile": v => (state.person.mobile = v),
    "r-why": v => (state.reason.why = v)
  };
  function clearError(id) { if (state.errors[id]) showErrors({ [id]: "" }); }

  $phone.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "search-input") { state.query = t.value; refreshSearch(); return; }
    const key = t.type === "radio" ? t.name : t.id;
    if (FIELD_MAP[key]) { FIELD_MAP[key](t.value); clearError(key); }
    if (key === "p-idtype") document.getElementById("p-idnumber-wrap").hidden = t.value === "Not available";
    if (key === "p-dob") {
      const a = t.value ? ageFromDob(t.value) : { years: "", months: "" };
      if (a) { Object.assign(state.person, a); document.getElementById("p-years").value = a.years; document.getElementById("p-months").value = a.months; }
      t.classList.toggle("is-empty", !t.value);
    }
    if (key === "p-years" || key === "p-months") {
      t.value = t.value.replace(/\D/g, "").slice(0, key === "p-years" ? 3 : 2);
      FIELD_MAP[key](t.value);
      const p = state.person, dobEl = document.getElementById("p-dob");
      p.dob = p.years || p.months ? dobFromAge(p.years, p.months) : "";
      dobEl.value = p.dob; dobEl.classList.toggle("is-empty", !p.dob);
    }
    if (["p-dob", "p-years", "p-months"].includes(key)) clearError("p-age");
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("help-sheet")?.hidden) closeHelp();
    ["quick-dialog", "confirm-dialog"].forEach(id => { const d = document.getElementById(id); if (d && !d.hidden) closeDialog(id); });
    if (document.getElementById("nearby-dialog")) ACTIONS["close-nearby"]();
    if (document.getElementById("compare-dialog")) ACTIONS["close-compare"]();
    if (document.getElementById("delivery-dialog")) ACTIONS["close-delivery"]();
  });

  // ---------- Prototype controls (outside the phone) ----------
  const demo = document.getElementById("demo");
  function syncDemoPanel() {
    if (!demo) return;
    demo.querySelector("#demo-sync").value = !syncOk() ? "failed" : store.hold ? "pending" : "ok";
    demo.querySelector("#demo-retry").value = store.retryWorks ? "yes" : "no";
    demo.querySelector("#demo-pending").textContent = String(store.pending);
  }
  demo?.addEventListener("change", e => {
    if (e.target.id === "demo-sync") {
      const v = e.target.value;
      store.synced = v !== "failed"; store.hold = v === "pending"; store.retryFailed = false; store.continued = false;
      if (v === "ok") store.pending = 0;
      else if (!store.pending) store.pending = 3;
    }
    if (e.target.id === "demo-retry") store.retryWorks = e.target.value === "yes";
    save();
    render({ focusTitle: false });
  });
  demo?.addEventListener("click", e => {
    if (e.target.id !== "demo-reset") return;
    store = freshStore(); save();
    Object.assign(state, { route: "home", history: [], query: "", hhId: null, draftHH: null, person: blankPerson(), matches: [], errors: {} });
    nearby = [];
    render({ focusTitle: false });
  });

  render({ focusTitle: false });
})();
