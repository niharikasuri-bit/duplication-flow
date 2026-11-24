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
    home:       { name: "Home", desc: "See whether the data on this device is up to date before you start." },
    search:     { name: "Search Beneficiary", desc: "Type the name of anyone in the household. Search checks the household head and every member, and allows for spelling differences." },
    household:  { name: "Household Details", desc: "Add the household head and capture the household location. Nearby households are checked so the same household is not registered twice." },
    overview:   { name: "Household Overview", desc: "See everyone in this household, add members and record vaccinations." },
    individual: { name: "Individual Details", desc: "Add the person’s details. They are compared with the people already in this household." },
    compare:    { name: "Possible Match", desc: "Compare the person you’re adding with the person already registered, then choose whether they are the same person." },
    matches:    { name: "Possible Matches", desc: "More than one person in this household looks like the person you’re adding. Compare each one." },
    reason:     { name: "Add as New Person", desc: "Tell us why this is a different person. Your supervisor sees this reason." },
    check:      { name: "Vaccination Check", desc: "Check whether this child was already vaccinated this round before you vaccinate." },
    checklist:  { name: "Vaccination Checklist", desc: "Confirm the vaccination by completing the required checklist." },
    success:    { name: "Vaccination Successful", desc: "Vaccination has been recorded successfully." }
  };

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
      { id: "p-13", name: "Aminata Diallo", gender: "Female", age: Y(3, 2), status: "done", servedAt: "Today, 09:20", servedBy: "A. Sesay" },
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
      { id: "p-52", name: "Aissatou Sow", gender: "Female", age: Y(3, 5), status: "done", servedAt: "Yesterday, 15:05", servedBy: "M. Kargbo" }
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
    sync: "fresh",            // fresh | stale | incomplete | offline | uploadFailed
    retryWorks: true,
    retryFailed: false,       // a retry has failed → offer Continue Without Sync
    staleMode: false,
    gpsOk: true,
    progress: { completed: 15, target: 80 },
    log: []                   // search terms + candidates shown before a create
  });
  let store;
  try { store = JSON.parse(localStorage.getItem(STORE_KEY)) || freshStore(); } catch (e) { store = freshStore(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } };

  const fresh = () => store.sync === "fresh";
  const deviceHouseholds = () => store.households.filter(h => !(h.late && (store.sync === "stale" || store.sync === "incomplete")));
  const findHH = id => store.households.find(h => h.id === id);

  // ---------- Session state ----------
  const blankPerson = () => ({ name: "", isHead: false, idType: "", idNumber: "", dob: "", years: "", months: "", gender: "", mobile: "" });
  const state = {
    route: "home",
    history: [],
    query: "",
    hhId: null,
    draftHH: null,            // { head, noGps } while creating a household
    person: blankPerson(),
    matches: [],              // [{ member, tier, same[], diff[] }]
    compareIdx: 0,
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
    // exact/starts-with first, then closer spelling, then nearest
    return out.sort((a, b) => (a.fuzzy - b.fuzzy) || (b.score - a.score) || (a.h.m - b.h.m)).slice(0, 10);
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
  function householdCard(h, { matched, fuzzy, q = "", action = "open-hh", label = "Open Household", note = "" } = {}) {
    const kids = h.members.filter(p => !p.head);
    return `<li><article class="hh-card" aria-labelledby="hh-${h.id}">
      <div class="hh-top">
        <h3 class="hh-name" id="hh-${h.id}">${highlight(h.head, q)}</h3>
        <span class="hh-dist">${ICON.pin}${h.m < 1000 ? `${h.m} m` : `${(h.m / 1000).toFixed(1)} km`}</span>
      </div>
      <p class="hh-sub">Household head · ${plural(h.members.length, "member")}</p>
      ${kids.length ? `<ul class="hh-members">${kids.map(p => `<li><span>${highlight(p.name, q)}</span><span>${esc(p.gender)}, ${esc(ageLabel(p.age))}</span></li>`).join("")}</ul>` : ""}
      ${fuzzy ? `<p class="hint">${ICON.info}Similar spelling: ${esc(matched)}</p>` : ""}
      ${note ? `<p class="hint">${ICON.info}${esc(note)}</p>` : ""}
      <button class="btn btn-secondary card-btn" data-action="${action}" data-id="${h.id}" aria-describedby="hh-${h.id}">${esc(label)}</button>
    </article></li>`;
  }

  function highlight(name, q) {
    const t = tokens(q).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!t.length) return esc(name);
    const re = new RegExp(`\\b(${t.join("|")})`, "gi");
    return name.split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
  }

  // ---------- Sync wording (W1 + W11) ----------
  const SYNC = {
    fresh:        { pill: "Up to date", kind: "ok", reg: "Today, 08:10", status: "Today, 08:10", flags: "Today, 08:10", records: "1,248" },
    stale:        { pill: "Out of date", kind: "warn", reg: "Yesterday, 17:40", status: "Yesterday, 17:40", flags: "Today, 08:10", records: "1,236",
                    text: "Registrations from other workers since yesterday may be missing. Sync before you register.", btn: "Retry Sync" },
    incomplete:   { pill: "Incomplete", kind: "warn", reg: "Stopped at 812 of 1,248", status: "Today, 08:10", flags: "Today, 08:10", records: "812",
                    text: "Sync stopped before all records downloaded. Some households won’t show in search.", btn: "Resume Sync" },
    offline:      { pill: "Offline", kind: "info", reg: "Today, 08:10", status: "Today, 08:10", flags: "Today, 08:10", records: "1,248",
                    text: "No internet connection. You can keep working. Records upload when you’re back online.", btn: "Retry Sync" },
    uploadFailed: { pill: "Upload failed", kind: "error", reg: "Today, 08:10", status: "Today, 08:10", flags: "Today, 08:10", records: "1,248",
                    text: "Some records didn’t upload. Your records are saved on this device.", btn: "Retry Upload" }
  };

  function syncCard() {
    const s = SYNC[store.sync];
    const row = (l, v) => `<div class="pair"><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`;
    const canContinue = store.retryFailed && (store.sync === "stale" || store.sync === "incomplete") && !store.staleMode;
    return `<section class="card sync-card" aria-labelledby="sync-title">
      <div class="sync-head">
        <h2 class="card-title" id="sync-title">Data on this device</h2>
        <span class="pill pill-${s.kind}">${esc(s.pill)}</span>
      </div>
      <dl class="pairs sync-rows">
        ${row("Registrations", s.reg)}
        ${row("Vaccination status", s.status)}
        ${row("Flags", s.flags)}
        ${row("Records on device", s.records)}
        ${row("Waiting to upload", String(store.pending))}
      </dl>
      ${s.text ? notice(s.kind === "error" ? "error" : s.kind === "info" ? "info" : "warn", esc(store.staleMode ? "You’re working without the latest data. New records are checked again after upload." : s.text)) : ""}
      ${s.btn ? `<div class="sync-actions">
        <button class="btn btn-secondary btn-sm" data-action="retry-sync">${ICON.sync}${esc(s.btn)}</button>
        ${canContinue ? `<button class="btn-link" data-action="continue-stale">Continue Without Sync</button>` : ""}
      </div>` : ""}
    </section>`;
  }

  // W11: thin banner under the header on every inner screen.
  function sysBanner() {
    const n = store.pending;
    const b = {
      stale: ["warn", "Working without the latest data.", "Retry"],
      incomplete: ["warn", "Some records didn’t download. Search may miss households.", "Resume"],
      offline: ["info", `Offline. ${plural(n, "record")} waiting to upload.`, ""],
      uploadFailed: ["error", `${plural(n || 3, "record")} didn’t upload.`, "Retry"]
    }[store.sync];
    if (!b) return "";
    return `<div class="sys-banner banner-${b[0]}" role="status">${ICON[b[0] === "error" ? "stop" : b[0]]}<span>${esc(b[1])}</span>${b[2] ? `<button class="banner-btn" data-action="retry-sync">${esc(b[2])}</button>` : ""}</div>`;
  }

  // ---------- Screens ----------
  const VIEWS = {
    // W1
    home() {
      const p = store.progress, pct = Math.min(100, Math.round((p.completed / p.target) * 100));
      const tile = (action, icon, label) => `<li><button class="home-tile" data-action="${action}">${ICON[icon]}<span>${esc(label)}</span></button></li>`;
      return {
        body: `<h1 class="sr-only" id="page-title" tabindex="-1">Home</h1>
          <section class="card progress-card" aria-labelledby="progress-title">
            <h2 class="progress-title" id="progress-title">My Progress</h2>
            <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${p.target}" aria-valuenow="${p.completed}" aria-labelledby="progress-title">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="progress-text"><span>${p.completed} completed</span> / ${p.target}</p>
          </section>
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
      const gps = d.noGps
        ? notice("info", "Saving without location. Your supervisor checks this household against a wider area.")
        : store.gpsOk
          ? `<input class="input" id="hh-gps" value="Accuracy: 6 m" readonly aria-describedby="gps-ok" /><p class="gps" id="gps-ok">${ICON.gps}Location captured</p>`
          : notice("error", "Location not captured. Move to an open area and try again.",
              `<div class="notice-actions"><button class="btn btn-secondary btn-sm" data-action="retry-gps">${ICON.sync}Retry</button><button class="btn-link" data-action="no-gps">Save Without Location</button></div>`);
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Household Details")}
          <div class="card">
            ${textField({ id: "hh-head", label: "Household head name", value: d.head, required: true })}
            <div class="field" id="hh-loc-group">
              <p class="field-label">Household location${reqMark(true)}</p>
              ${gps}
              ${errorText("hh-loc", state.errors["hh-loc"])}
            </div>
          </div>
          ${nearbyDialogHtml()}`,
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
              <div class="pair"><dt>Member Count</dt><dd>${String(h.members.length).padStart(2, "0")}</dd></div>
            </dl>
            <ul class="member-list">${h.members.map(card).join("")}</ul>
          </div>`,
        footer: `<button class="btn btn-primary" data-action="add-member">${ICON.personAdd}Add Member</button>`
      };
    },

    // W6
    individual() {
      const p = state.person;
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Individual Details")}
          <div class="card">
            ${textField({ id: "p-name", label: "Name of the individual", value: p.name, required: true })}
            <label class="checkbox head-check"><input type="checkbox" id="p-head" ${p.isHead ? "checked" : ""} ${state.draftHH ? "disabled" : ""}/><span class="box">${ICON.tick}</span>Head of household</label>
            ${selectField({ id: "p-idtype", label: "ID type", value: p.idType, options: ID_TYPES, required: true })}
            <div id="p-idnumber-wrap" ${p.idType === "Not available" ? "hidden" : ""}>${textField({ id: "p-idnumber", label: "ID number", value: p.idNumber, required: true })}</div>
            ${dobAgeField(p)}
            ${selectField({ id: "p-gender", label: "Gender", value: p.gender, options: ["Female", "Male"] })}
            ${textField({ id: "p-mobile", label: "Mobile number", value: p.mobile, type: "tel", inputmode: "tel" })}
          </div>`,
        footer: `<button class="btn btn-primary" data-action="person-continue">Continue</button>`
      };
    },

    // W8
    matches() {
      const alike = (a, b) => nameSim(a.member.name, b.member.name) >= 0.85 && Math.abs(a.member.age - b.member.age) <= 3;
      const item = (m, i) => {
        const twin = state.matches.find((o, j) => j !== i && alike(m, o));
        return `<li><article class="match-card" aria-labelledby="mc-${i}">
          <h3 class="member-name" id="mc-${i}">${esc(m.member.name)}</h3>
          <p class="member-sub"><span>${esc(m.member.gender || "Gender not recorded")}</span><span class="sep" aria-hidden="true"></span><span>${esc(ageLabel(m.member.age))}</span></p>
          <p class="reasons-line">${esc([...m.same, ...m.diff].join(", "))}</p>
          ${twin ? `<p class="hint">${ICON.info}Looks like ${esc(twin.member.name)}, also in this household</p>` : ""}
          ${m.member.flag ? `<div class="chip-row"><span class="status-chip chip-warn">${ICON.warn}Needs supervisor check</span></div>` : ""}
          <button class="btn btn-secondary card-btn" data-action="open-compare" data-i="${i}" aria-describedby="mc-${i}">Compare</button>
        </article></li>`;
      };
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Possible Matches")}
          <p class="page-desc">${plural(state.matches.length, "person")} in this household look like ${esc(state.person.name.trim())}.</p>
          <ul class="match-list">${state.matches.map(item).join("")}</ul>`,
        footer: `<button class="btn btn-secondary" data-action="new-person">${ICON.personAdd}Add as New Person</button>`
      };
    },

    // W7
    compare() {
      const m = state.matches[state.compareIdx], e = m.member, p = state.person;
      const newAge = personMonths(p);
      const rows = [
        ["Name", e.name, p.name.trim(), nameSim(e.name, p.name) < 0.99],
        ["Gender", e.gender || "–", p.gender || "–", !!(e.gender && p.gender && e.gender !== p.gender)],
        ["Age", ageLabel(e.age), ageLabel(newAge), e.age !== newAge],
        ["Mobile number", e.mobile || "–", p.mobile || "–", !!(e.mobile && p.mobile && e.mobile !== p.mobile.replace(/\D/g, ""))],
        ["ID number", e.idNumber || "–", p.idType === "Not available" ? "–" : p.idNumber || "–", !!(e.idNumber && p.idNumber && e.idNumber !== p.idNumber)]
      ];
      const low = m.tier === "Low";
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Possible Match")}
          <div class="card">
            <p class="match-lead"><b>${esc(e.name)}</b> is already registered in this household.</p>
            <ul class="reason-list">
              ${m.same.map(r => `<li class="r-same">${ICON.ok}<span>${esc(r)}</span></li>`).join("")}
              ${m.diff.map(r => `<li class="r-diff">${ICON.info}<span>${esc(r)}</span></li>`).join("")}
            </ul>
          </div>
          <div class="card compare-card">
            <table class="compare">
              <caption class="sr-only">Already registered compared with this registration</caption>
              <thead><tr><th scope="col"><span class="sr-only">Detail</span></th><th scope="col">Already registered</th><th scope="col">This registration</th></tr></thead>
              <tbody>${rows.map(([l, a, b, d]) => `<tr class="${d ? "is-diff" : ""}"><th scope="row">${esc(l)}</th><td>${esc(a)}</td><td>${esc(b)}${d ? '<span class="sr-only"> (different)</span>' : ""}</td></tr>`).join("")}</tbody>
            </table>
          </div>
          ${low ? quickReasonHtml() : ""}`,
        footer: `<button class="btn btn-primary" data-action="same-person">Same Person</button>
          <button class="btn btn-secondary" data-action="${low ? "open-quick-reason" : "new-person"}">${ICON.personAdd}Add as New Person</button>`
      };
    },

    // W9
    reason() {
      const r = state.reason, err = state.errors["r-why"];
      const names = state.matches.map(m => m.member.name);
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Add as New Person")}
          <p class="page-desc">${esc(state.person.name.trim())} looks like ${esc(names.join(" and "))}, already in this household.</p>
          <div class="card">
            <fieldset class="field radios ${err ? "has-error" : ""}" id="r-why-group" aria-describedby="r-why-err">
              <legend>Why is this a different person?${reqMark(true)}</legend>
              ${NEW_PERSON_REASONS.map(o => `<label class="radio"><input type="radio" name="r-why" value="${esc(o)}" ${o === r.why ? "checked" : ""}/>${esc(o)}</label>`).join("")}
              ${errorText("r-why", err)}
            </fieldset>
            <label class="checkbox sup-check"><input type="checkbox" id="r-sup" ${r.supervisor ? "checked" : ""}/><span class="box">${ICON.tick}</span>Ask my supervisor to check these records</label>
          </div>
          ${confirmDialogHtml()}`,
        footer: `<button class="btn btn-primary" data-action="reason-submit">${ICON.personAdd}Add as New Person</button>`
      };
    },

    // W10
    check() {
      const p = member();
      let box, footer;
      if (p.status === "done") {
        box = notice("error", `<b>Already vaccinated this round.</b> ${esc(p.servedAt)} by ${esc(p.servedBy)}. Don’t vaccinate again.`);
        footer = `<button class="btn btn-primary" data-action="to-overview">Back to Household</button>`;
      } else if (p.flag) {
        box = notice("warn", "<b>This child may be registered twice.</b> Your supervisor will check the records. You can still vaccinate, so the child isn’t missed.");
        footer = `<button class="btn btn-primary" data-action="vaccinate">Vaccinate</button><button class="btn btn-secondary" data-action="hold">Hold and Flag</button>`;
      } else if (!fresh()) {
        box = notice("warn", `<b>Vaccination status may be out of date.</b> Last updated ${esc(SYNC[store.sync].status.toLowerCase())}. Ask the caregiver whether the child was vaccinated this round.`);
        footer = `<button class="btn btn-primary" data-action="vaccinate">Vaccinate</button><button class="btn btn-secondary" data-action="hold">Hold and Flag</button>`;
      } else {
        box = notice("ok", "<b>Not vaccinated this round.</b> You can vaccinate this child.");
        footer = `<button class="btn btn-primary" data-action="vaccinate">Vaccinate</button>`;
      }
      return {
        tag: ASSIGNED_AREA,
        body: `${title("Vaccination Check")}
          <div class="card">
            <dl class="pairs">
              <div class="pair"><dt>Name</dt><dd>${esc(p.name)}</dd></div>
              <div class="pair"><dt>Gender</dt><dd>${esc(p.gender || "–")}</dd></div>
              <div class="pair"><dt>Age</dt><dd>${esc(ageLabel(p.age))}</dd></div>
              <div class="pair"><dt>Status updated</dt><dd>${esc(SYNC[store.sync].status)}</dd></div>
            </dl>
          </div>
          ${box}`,
        footer
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

  // ---------- Search results (W3) ----------
  function searchResultsHtml() {
    const q = state.query.trim();
    const hits = searchHouseholds(q);
    const meta = !fresh() ? `<p class="search-meta">${ICON.warn}Searching records on this device, last synced ${esc(SYNC[store.sync].reg.toLowerCase())}.</p>` : "";
    if (!hits) return meta;
    if (!hits.length) {
      return `${meta}<div class="empty" role="status">
        ${ICON.notFound}
        <h3>Beneficiary not found!</h3>
        <p>We couldn’t find this beneficiary in the records. You can add them as a new beneficiary.</p>
      </div>`;
    }
    return `${meta}<p class="search-meta" role="status">${plural(hits.length, "household")} found</p>
      <ul class="hh-list">${hits.map(r => householdCard(r.h, { matched: r.matched, fuzzy: r.fuzzy, q })).join("")}</ul>
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
    return `<div class="dialog-backdrop sheet-bottom" id="nearby-dialog">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="nearby-title">
        <div class="dialog-head">
          <h2 class="dialog-title" id="nearby-title">Is this one of these households?</h2>
          <button class="dialog-close" data-action="close-nearby" aria-label="Close">${ICON.close}</button>
        </div>
        <p class="dialog-desc">${plural(nearby.length, "household")} within ${NEARBY_M} m ${nearby.length === 1 ? "has" : "have"} someone with a similar name.</p>
        <ul class="hh-list dialog-scroll">${nearby.map(n => householdCard(n.h, { action: "nearby-open", label: "Same Household", note: `Similar name: ${n.matched}` })).join("")}</ul>
        <div class="dialog-actions"><button class="btn btn-primary" data-action="nearby-new">No, Create New Household</button></div>
      </div>
    </div>`;
  }

  function quickReasonHtml() {
    return `<div class="dialog-backdrop sheet-bottom" id="quick-dialog" hidden>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="quick-title">
        <div class="dialog-head">
          <h2 class="dialog-title" id="quick-title">Why is this a different person?</h2>
          <button class="dialog-close" data-action="close-quick" aria-label="Close">${ICON.close}</button>
        </div>
        <ul class="quick-list">${NEW_PERSON_REASONS.map(r => `<li><button class="quick-opt" data-action="quick-reason" data-r="${esc(r)}">${esc(r)}</button></li>`).join("")}</ul>
      </div>
    </div>`;
  }

  function confirmDialogHtml() {
    const m = state.matches[0];
    return `<div class="dialog-backdrop" id="confirm-dialog" hidden>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
        <h2 class="dialog-title" id="confirm-title">Add a new person?</h2>
        <p class="dialog-desc" id="confirm-desc">${esc(m.member.name)} is already in this household (${esc(m.same.join(", ").toLowerCase())}). Adding ${esc(state.person.name.trim())} creates a second record.</p>
        <div class="dialog-actions stack">
          <button class="btn btn-primary" data-action="confirm-new">Add New Person</button>
          <button class="btn btn-secondary" data-action="close-confirm">Go Back</button>
        </div>
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
      <div class="body body-${state.route}" id="screen-body">${view.tag ? tagPill(view.tag) : ""}${view.body}</div>
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
    document.title = `${SCREENS[state.route].name} – Duplication Flow`;
    if (document.getElementById("nearby-dialog")) document.querySelector("#nearby-dialog button")?.focus();
    else if (focusTitle) document.getElementById("page-title")?.focus({ preventScroll: true });
    if (state.route === "search" && !state.query) document.getElementById("search-input")?.focus();
    syncDemoPanel();
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
    document.getElementById("help-title").textContent = SCREENS[state.route].name;
    document.getElementById("help-desc").textContent = SCREENS[state.route].desc;
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
    if (fresh()) setTimeout(() => { store.pending = Math.max(0, store.pending - 1); save(); syncDemoPanel(); }, 4000);
  }
  const recordTags = () => [!fresh() ? "STALE_SYNC" : "", state.draftHH?.noGps ? "NO_GPS" : ""].filter(Boolean);

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
      store.households.unshift({ id, head: rec.name, m: 0, members: [rec], meta: { noGps: !!d.noGps, searchTerm: d.searchTerm, candidates: d.candidates, tags: recordTags() } });
      state.hhId = id;
      state.draftHH = null;
      queueUpload();
      state.history = state.history.slice(0, state.history.lastIndexOf("search") + 1);
      state.route = "overview"; state.errors = {}; render();
      toast(fresh() ? "Household created. Uploading now." : "Household created. Saved on this device.");
      return;
    }
    hh().members.push(rec);
    queueUpload();
    backTo("overview");
    toast(extra.flag ? `${rec.name} added. Your supervisor will check the records.` : `${rec.name} added to the household.`);
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
      const was = store.sync;
      if (was === "offline" && !store.retryWorks) return toast("Still offline. Records upload when you’re back online.");
      if (store.retryWorks) {
        store.sync = "fresh"; store.retryFailed = false; store.staleMode = false;
        if (was === "uploadFailed" || was === "offline") store.pending = 0;
        save(); render({ focusTitle: false });
        toast(was === "uploadFailed" ? "Upload complete." : "Sync complete. Data is up to date.");
      } else {
        store.retryFailed = true; save(); render({ focusTitle: false });
        toast(was === "uploadFailed" ? "Upload failed again. Records stay saved on this device." : "Sync failed. Try again, or continue without sync.");
      }
    },
    "continue-stale"() {
      store.staleMode = true; save(); render({ focusTitle: false });
      toast("Working without the latest data. New records are checked again after upload.");
    },

    // W3
    "open-hh"(btn) { state.hhId = btn.dataset.id; go("overview"); },
    register() {
      const hits = searchHouseholds(state.query.trim()) || [];
      state.draftHH = { head: state.query.trim(), noGps: false, searchTerm: state.query.trim(), candidates: hits.map(h => h.h.id) };
      store.log.push({ term: state.query.trim(), shown: hits.length, at: new Date().toISOString() }); save();
      nearby = [];
      go("household");
    },

    // W4
    "retry-gps"() { if (store.gpsOk) render({ focusTitle: false }); else toast("Location still not captured. Try again in an open area."); },
    "no-gps"() { state.draftHH.noGps = true; render({ focusTitle: false }); },
    "hh-continue"() {
      const d = state.draftHH;
      const ok = showErrors({
        "hh-head": d.head.trim() ? "" : "Enter the household head name",
        "hh-loc": store.gpsOk || d.noGps ? "" : "Capture the location, or save without location"
      });
      if (!ok) return;
      nearby = d.noGps ? [] : deviceHouseholds().filter(h => h.m <= NEARBY_M).map(h => {
        let best = null;
        for (const p of h.members) { const s = nameSim(d.head, p.name); if (s >= 0.8 && (!best || s > best.s)) best = { s, matched: p.name }; }
        return best && { h, ...best };
      }).filter(Boolean).sort((a, b) => b.s - a.s);
      if (nearby.length) return render({ focusTitle: false });
      ACTIONS["nearby-new"]();
    },
    "close-nearby"() { nearby = []; render(); },
    "nearby-open"(btn) {
      nearby = []; state.draftHH = null; state.hhId = btn.dataset.id;
      state.history = state.history.slice(0, state.history.lastIndexOf("search") + 1);
      state.route = "overview"; render();
      toast("Opened the existing household. No new household created.");
    },
    "nearby-new"() {
      nearby = [];
      state.person = { ...blankPerson(), name: state.draftHH.head.trim(), isHead: true };
      go("individual");
    },

    // W5
    "add-member"() { state.person = blankPerson(); go("individual"); },
    "take-action"(btn) { state.memberId = btn.dataset.id; go("check"); },
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
      if (state.draftHH) return savePerson();
      state.matches = hh().members.map(m => compare(m, p)).filter(Boolean).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.n - a.n);
      state.reason = { why: "", supervisor: false };
      if (!state.matches.length) return savePerson();
      if (state.matches.length === 1) { state.compareIdx = 0; return go("compare"); }
      go("matches");
    },

    // W7 / W8
    "open-compare"(btn) { state.compareIdx = Number(btn.dataset.i); go("compare"); },
    "same-person"() {
      const e = state.matches[state.compareIdx].member;
      backTo("overview");
      toast(`${e.name} is already registered. No new record added.`);
    },
    "new-person"() { go("reason"); },
    "open-quick-reason"() { openDialog("quick-dialog"); },
    "close-quick"() { closeDialog("quick-dialog"); },
    "quick-reason"(btn) { savePerson({ override: { reason: btn.dataset.r, tier: "Low" } }); },

    // W9
    "reason-submit"() {
      if (!showErrors({ "r-why": state.reason.why ? "" : "Select a reason" })) return;
      openDialog("confirm-dialog");     // second confirm on Strong or Definite
    },
    "close-confirm"() { closeDialog("confirm-dialog"); },
    "confirm-new"() {
      savePerson({ flag: state.reason.supervisor, override: { reason: state.reason.why, tier: topTier(), matched: state.matches.map(m => m.member.id) } });
    },

    // W10
    vaccinate() { go("checklist"); },
    hold() {
      member().flag = true; save();
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
    "hh-head": v => (state.draftHH.head = v),
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
    if (t.id === "p-head") { state.person.isHead = t.checked; return; }
    if (t.id === "r-sup") { state.reason.supervisor = t.checked; return; }
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
  $phone.addEventListener("change", e => { if (e.target.id === "p-head") state.person.isHead = e.target.checked; if (e.target.id === "r-sup") state.reason.supervisor = e.target.checked; });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("help-sheet")?.hidden) closeHelp();
    ["quick-dialog", "confirm-dialog"].forEach(id => { const d = document.getElementById(id); if (d && !d.hidden) closeDialog(id); });
    if (document.getElementById("nearby-dialog")) ACTIONS["close-nearby"]();
  });

  // ---------- Prototype controls (outside the phone) ----------
  const demo = document.getElementById("demo");
  function syncDemoPanel() {
    if (!demo) return;
    demo.querySelector("#demo-sync").value = store.sync;
    demo.querySelector("#demo-retry").value = store.retryWorks ? "yes" : "no";
    demo.querySelector("#demo-gps").value = store.gpsOk ? "yes" : "no";
    demo.querySelector("#demo-pending").textContent = String(store.pending);
  }
  demo?.addEventListener("change", e => {
    if (e.target.id === "demo-sync") {
      store.sync = e.target.value; store.retryFailed = false; store.staleMode = false;
      if (store.sync === "uploadFailed" && !store.pending) store.pending = 3;
    }
    if (e.target.id === "demo-retry") store.retryWorks = e.target.value === "yes";
    if (e.target.id === "demo-gps") store.gpsOk = e.target.value === "yes";
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
