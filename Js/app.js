(() => {
  const KEY = "nonzero-data-v1";

  const defaultCare = [
    { id: "teeth", text: "Brush teeth", value: 1 },
    { id: "shower", text: "Shower", value: 2 },
    { id: "clothes", text: "Clean clothes", value: 1 },
    { id: "dishes", text: "Dishes / kitchen wipe", value: 2 },
    { id: "tidy", text: "One tidy pass or one bag of trash", value: 2 },
    { id: "eat", text: "Eat something", value: 2 },
    { id: "water", text: "Drink water", value: 1 },
    { id: "move", text: "Move a little (walk, stretch, stand)", value: 2 }
  ];

  const empty = () => ({
    version: 1,
    profile: { name: "", theme: "dark" },
    care: defaultCare.map((x) => ({ ...x })),
    goals: [],
    checkins: [],
    careLogs: {},
    goalTouches: {}
  });

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function todayKey(d = new Date()) {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return { ...empty(), ...JSON.parse(raw) };
    } catch {
      return empty();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  let state = load();
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  function checkin(date = todayKey()) {
    let row = state.checkins.find((c) => c.date === date);
    if (!row) {
      row = {
        date,
        weight: "",
        waist: "",
        chest: "",
        armL: "",
        armR: "",
        calories: "",
        exerciseWhat: "",
        exerciseMin: "",
        space: 5,
        hygiene: 5,
        wellbeing: 5,
        note: "",
        saved: false
      };
      state.checkins.push(row);
    }
    return row;
  }

  function pretty(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.profile.theme === "light" ? "light" : "dark");
    const btn = $("#theme-btn");
    if (btn) btn.textContent = state.profile.theme === "light" ? "Dark mode" : "Light mode";
  }

  function careToday() {
    return state.careLogs[todayKey()] || {};
  }

  function report() {
    const row = checkin();
    const logs = careToday();
    const done = state.care.filter((t) => logs[t.id]);
    const points = done.reduce((s, t) => s + Number(t.value || 0), 0);
    const possible = state.care.reduce((s, t) => s + Number(t.value || 0), 0);
    const touches = state.goalTouches[todayKey()] || [];
    const goalTouched = touches.length > 0;
    const logged = row.saved || done.length > 0 || goalTouched;
    const nonzero = logged;
    const fullSend = state.care.length > 0 && done.length === state.care.length && goalTouched;
    const low = Math.min(Number(row.space), Number(row.hygiene), Number(row.wellbeing));
    return { row, done, points, possible, goalTouched, nonzero, fullSend, low };
  }

  function guidance(r) {
    const { row, nonzero, fullSend, done, points, possible, goalTouched, low } = r;
    let title = "Not logged yet";
    let body = "Open the lists. One box is a complete day. Future you only needs a gift, not a masterpiece.";
    if (fullSend) {
      title = "Full send";
      body = "You emptied the tank on purpose. That is a gift. Tomorrow is allowed to be smaller. Forgiveness still applies.";
    } else if (nonzero && (done.length >= 3 || (possible && points >= possible * 0.5))) {
      title = "Care plus motion";
      body = "Baseline is intact. Present you showed up. If a goal still has an inch in it, you can touch it — or not.";
    } else if (nonzero) {
      title = "Non-zero";
      body = "The day is not empty. One sentence, one dish, one check-in — that counts. You do not owe the essay.";
    }

    if (!row.saved && !nonzero) {
      title = "Waiting on present you";
      body = "Log the weather. Tick one care box. That is the whole system.";
    }

    let next = "Pick the smallest item on the care list and do only that.";
    if (low <= 3) {
      if (Number(row.wellbeing) <= 3) {
        next = "Do not rebuild your life tonight. Water, eat if you can, tell one person you are low. Logging this already broke the zero. 1–3 is a moment for support, not a bigger list. US: call or text 988 if you need it.";
      } else if (Number(row.hygiene) <= 3) {
        next = "Teeth now. Shower can be the next non-zero — both only if you want both.";
      } else {
        next = "One bag of trash or one pile off the floor. That is a complete win.";
      }
    } else if (Number(row.wellbeing) >= 7 && Number(row.space) >= 5 && Number(row.hygiene) >= 5) {
      next = "Good weather for a real goal, even 10 minutes. Touch one. Or keep stacking care. Both are legal.";
    } else if (goalTouched) {
      next = "Goal got a gift already. A care box still helps future you.";
    }

    return { title, body, next };
  }

  function renderHeader() {
    const r = report();
    $("#status-line").textContent = r.fullSend ? "Full send logged." : r.nonzero ? "Non-zero day." : "No zero days.";
    if (state.profile.name) {
      $("#hello").textContent = state.profile.name;
      $("#hello").classList.remove("hidden");
    } else {
      $("#hello").classList.add("hidden");
    }
  }

  function renderRead() {
    const g = guidance(report());
    const r = report();
    $("#read-box").innerHTML = `
      <div class="title">${esc(g.title)}</div>
      <p>${esc(g.body)}</p>
      <p class="muted">${r.done.length}/${state.care.length} care · ${r.points} pts · ${r.goalTouched ? "goal touched" : "no goal touch yet"}</p>
      <div class="next">
        <div class="title">Suggested next</div>
        <p>${esc(g.next)}</p>
      </div>
    `;
  }

  function renderScales() {
    const row = checkin();
    $("#scale-space").value = row.space;
    $("#scale-hygiene").value = row.hygiene;
    $("#scale-wellbeing").value = row.wellbeing;
    $("#val-space").textContent = row.space;
    $("#val-hygiene").textContent = row.hygiene;
    $("#val-wellbeing").textContent = row.wellbeing;
    $("#note").value = row.note || "";
  }

  function renderBody() {
    const row = checkin();
    ["weight", "waist", "chest", "armL", "armR", "calories", "exerciseWhat", "exerciseMin"].forEach((k) => {
      const el = document.getElementById(k);
      if (el) el.value = row[k] ?? "";
    });
  }

  function renderCare() {
    const logs = careToday();
    $("#care-list").innerHTML = state.care.map((t) => `
      <label class="task">
        <input type="checkbox" data-care="${esc(t.id)}" ${logs[t.id] ? "checked" : ""}>
        <span class="meta">${esc(t.text)} <span class="pts">${t.value} pt</span></span>
      </label>
    `).join("") || `<p class="muted">Add a tiny care item.</p>`;
  }

  function renderGoals() {
    const touches = state.goalTouches[todayKey()] || [];
    const order = { short: 0, medium: 1, long: 2 };
    const list = [...state.goals].sort((a, b) => (order[a.horizon] || 9) - (order[b.horizon] || 9));
    $("#goal-list").innerHTML = list.map((g) => `
      <article class="item">
        <div class="horizon">${esc(g.horizon)} term</div>
        <h3>${esc(g.title)}</h3>
        ${g.why ? `<p>${esc(g.why)}</p>` : ""}
        <div class="actions">
          <button class="small primary" data-act="touch" data-id="${g.id}">${touches.includes(g.id) ? "Touched today" : "Touch today"}</button>
          <button class="small" data-act="edit-goal" data-id="${g.id}">Edit</button>
          <button class="small" data-act="del-goal" data-id="${g.id}">Remove</button>
        </div>
      </article>
    `).join("") || `<p class="muted">One goal is plenty. Add it when you know the why.</p>`;
  }

  function spark(values) {
    const max = Math.max(10, ...values, 1);
    return `<div class="bars">${values.map((v) => `<i style="height:${Math.max(4, (Number(v) || 0) / max * 100)}%"></i>`).join("")}</div>`;
  }

  function renderHistory() {
    const days = [...state.checkins].sort((a, b) => a.date.localeCompare(b.date));
    const last7 = days.slice(-7);
    const last30 = days.slice(-30);
    const year = days.filter((d) => d.date.slice(0, 4) === todayKey().slice(0, 4));

    const nonzeroCount = (arr) =>
      arr.filter((d) => {
        const logs = state.careLogs[d.date] || {};
        const touches = state.goalTouches[d.date] || [];
        return d.saved || Object.values(logs).some(Boolean) || touches.length;
      }).length;

    $("#hist-week").innerHTML = `
      <p class="muted">Last ${last7.length} logged days · non-zero ${nonzeroCount(last7)}</p>
      ${spark(last7.map((d) => d.wellbeing))}
      <p class="legend">Wellbeing, recent days (empty days are just empty — not a failure)</p>
    `;
    $("#hist-month").innerHTML = `
      <p class="muted">Last ${last30.length} logged days · non-zero ${nonzeroCount(last30)}</p>
      ${spark(last30.map((d) => d.wellbeing))}
    `;
    $("#hist-year").innerHTML = `
      <p class="muted">${year.length} logged days this year · non-zero ${nonzeroCount(year)}</p>
    `;

    const recentBody = [...days].reverse().slice(0, 14);
    $("#hist-body").innerHTML = recentBody.length
      ? recentBody.map((d) => {
          const bits = [];
          if (d.weight) bits.push(`wt ${d.weight}`);
          if (d.waist) bits.push(`waist ${d.waist}`);
          if (d.calories) bits.push(`${d.calories} cal`);
          if (d.exerciseWhat || d.exerciseMin) bits.push(`${d.exerciseWhat || "moved"} ${d.exerciseMin ? d.exerciseMin + "m" : ""}`.trim());
          return `<div class="item"><h3>${pretty(d.date)}</h3><p>S${d.space} H${d.hygiene} W${d.wellbeing}${bits.length ? " · " + bits.join(" · ") : ""}</p></div>`;
        }).join("")
      : `<p class="muted">History shows up after you save a few days.</p>`;
  }

  function renderSettings() {
    $("#profile-name").value = state.profile.name || "";
  }

  function render() {
    applyTheme();
    renderHeader();
    renderRead();
    renderScales();
    renderBody();
    renderCare();
    renderGoals();
    renderHistory();
    renderSettings();
  }

  function persistCheckinFields() {
    const row = checkin();
    row.space = Number($("#scale-space").value);
    row.hygiene = Number($("#scale-hygiene").value);
    row.wellbeing = Number($("#scale-wellbeing").value);
    row.note = $("#note").value;
    ["weight", "waist", "chest", "armL", "armR", "calories", "exerciseWhat", "exerciseMin"].forEach((k) => {
      row[k] = document.getElementById(k).value;
    });
  }

  function markSaved() {
    persistCheckinFields();
    checkin().saved = true;
    save();
    render();
  }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.addEventListener("input", (e) => {
    if (e.target.id && e.target.id.startsWith("scale-")) {
      const key = e.target.id.replace("scale-", "");
      checkin()[key] = Number(e.target.value);
      const val = document.getElementById("val-" + key);
      if (val) val.textContent = e.target.value;
      save();
      renderRead();
      renderHeader();
    }
    if (["note", "weight", "waist", "chest", "armL", "armR", "calories", "exerciseWhat", "exerciseMin"].includes(e.target.id)) {
      persistCheckinFields();
      save();
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.dataset.care) {
      const day = todayKey();
      state.careLogs[day] = state.careLogs[day] || {};
      state.careLogs[day][e.target.dataset.care] = e.target.checked;
      save();
      renderRead();
      renderHeader();
    }
    if (e.target.id === "restore-file" && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || typeof parsed !== "object") throw new Error("bad");
          state = { ...empty(), ...parsed };
          save();
          render();
          alert("Backup restored on this device.");
        } catch {
          alert("That file is not a NONZERO backup.");
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if (act === "theme") {
      state.profile.theme = state.profile.theme === "light" ? "dark" : "light";
      save();
      applyTheme();
    }
    if (act === "save") markSaved();
    if (act === "one-thing") {
      const logs = careToday();
      const first = state.care.find((t) => !logs[t.id]);
      if (first) {
        state.careLogs[todayKey()] = state.careLogs[todayKey()] || {};
        state.careLogs[todayKey()][first.id] = true;
      }
      checkin().saved = true;
      save();
      render();
    }
    if (act === "save-name") {
      state.profile.name = $("#profile-name").value.trim();
      save();
      render();
    }
    if (act === "reset-today") {
      state.careLogs[todayKey()] = {};
      save();
      render();
    }
    if (act === "add-care") {
      const text = prompt("Care item (keep it tiny)");
      if (!text) return;
      const value = Number(prompt("Point value", "1")) || 1;
      state.care.push({ id: uid(), text: text.trim(), value });
      save();
      render();
    }
    if (act === "edit-care") {
      const names = state.care.map((t, i) => `${i + 1}. ${t.text} (${t.value})`).join("\n");
      const n = Number(prompt("Number to edit or 0 to cancel\n" + names));
      if (!n || !state.care[n - 1]) return;
      const item = state.care[n - 1];
      const text = prompt("Text", item.text);
      if (text === null) return;
      const value = prompt("Points", String(item.value));
      if (value === null) return;
      item.text = text.trim() || item.text;
      item.value = Number(value) || item.value;
      save();
      render();
    }
    if (act === "del-care") {
      const names = state.care.map((t, i) => `${i + 1}. ${t.text}`).join("\n");
      const n = Number(prompt("Number to remove or 0 to cancel\n" + names));
      if (!n || !state.care[n - 1]) return;
      state.care.splice(n - 1, 1);
      save();
      render();
    }
    if (act === "add-goal") {
      const title = prompt("Goal");
      if (!title) return;
      const horizon = (prompt("short, medium, or long", "short") || "short").toLowerCase();
      const why = prompt("Why it matters (optional)") || "";
      state.goals.push({
        id: uid(),
        title: title.trim(),
        horizon: ["short", "medium", "long"].includes(horizon) ? horizon : "short",
        why: why.trim()
      });
      save();
      render();
    }
    if (act === "edit-goal") {
      const g = state.goals.find((x) => x.id === id);
      if (!g) return;
      const title = prompt("Goal", g.title);
      if (title === null) return;
      const horizon = prompt("short, medium, or long", g.horizon);
      if (horizon === null) return;
      const why = prompt("Why", g.why || "");
      if (why === null) return;
      g.title = title.trim() || g.title;
      g.horizon = ["short", "medium", "long"].includes((horizon || "").toLowerCase()) ? horizon.toLowerCase() : g.horizon;
      g.why = why.trim();
      save();
      render();
    }
    if (act === "del-goal") {
      state.goals = state.goals.filter((g) => g.id !== id);
      save();
      render();
    }
    if (act === "touch") {
      const day = todayKey();
      const arr = new Set(state.goalTouches[day] || []);
      if (arr.has(id)) arr.delete(id);
      else arr.add(id);
      state.goalTouches[day] = [...arr];
      save();
      render();
    }
    if (act === "backup") {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nonzero-backup-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    if (act === "erase") {
      if (confirm("Erase all NONZERO data in this browser? Download a backup first.")) {
        state = empty();
        save();
        render();
      }
    }
  });

  applyTheme();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
