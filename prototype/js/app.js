/* ===== B. STATE (kept in sessionStorage) ===== */
const $ = (s) => document.querySelector(s);
const ld = (k, d) => {
  try {
    return JSON.parse(sessionStorage[k]) || d;
  } catch (e) {
    return d;
  }
};
const sv = (k, v) => (sessionStorage[k] = JSON.stringify(v));
let P = ld("props",[]),
  V = ld("visits", []),
  user = ld("user", null),
  scr = "welcome",
  cur = null,
  gi = 0,
  mode = "in";
const role = () => (user ? user.role : null);

/* ===== C. HELPERS ===== */
const KEY = (c) =>
  `<svg viewBox="0 0 100 100"><circle cx="66" cy="34" r="20" fill="${c}"/><circle cx="66" cy="34" r="6.5" fill="#fff"/><path d="M53 48 20 82" stroke="${c}" stroke-width="10"/><path d="M27 75l9 9M19 83l9 9" stroke="${c}" stroke-width="7"/></svg>`;
const pic = (src) => `<img src="${src}" alt="">`;
const gallery = (p) => {
  const f = p.img || IMAGES.gallery[0];
  return [f, ...IMAGES.gallery.filter((x) => x !== f)];
};
function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.style.display = "block";
  clearTimeout(t.h);
  t.h = setTimeout(() => (t.style.display = "none"), 2600);
}
const money = (n) => Number(n).toLocaleString() + " $";
const pname = (id) =>
  (P.find((p) => p.id == id) || { title: "(deleted)" }).title;

/* Generic modal: fields=[{k,l,t,v,opts}], onOk(values) returns error text or nothing */
function modal(title, fields, ok, okLabel) {
  $("#mb").innerHTML =
    `<h3>${title}</h3>` +
    fields
      .map(
        (f) =>
          `<label>${f.l}</label>` +
          (f.opts
            ? `<select id="f_${f.k}">${f.opts.map((o) => `<option>${o}</option>`).join("")}</select>`
            : `<input id="f_${f.k}" type="${f.t || "text"}" value="${f.v || ""}" ${f.min ? `min="${f.min}"` : ""}>`),
      )
      .join("") +
    `<div class="err" id="me"></div><div class="row"><button onclick="closeM()">Cancel</button><button style="background:var(--gold);color:var(--navy)" id="mok">${okLabel || "Save"}</button></div>`;
  $("#ov").classList.add("on");
   $("#mok").onclick = async () => {
    const btn = $("#mok");
    if (btn.disabled) return;
    btn.disabled = true;

    const v = {};
    fields.forEach((f) => {
      const raw = $("#f_" + f.k).value;
      // don't trim password fields — spaces can be meaningful
      v[f.k] = f.t === "password" ? raw : raw.trim();
    });

    const e = await ok(v);
    if (e) {
      $("#me").textContent = e;
      btn.disabled = false;
    } else {
      closeM();
    }
  };
}
function closeM() {
  $("#ov").classList.remove("on");
}

/* ===== D. NAVIGATION ===== */
function show(s) {
  scr = s;
  document
    .querySelectorAll(".screen")
    .forEach((e) => e.classList.toggle("on", e.id === s));
  $("#nav").classList.toggle("hide", s === "welcome");
  nav();
  scrollTo(0, 0);
  if (s === "home") renderList();
  if (s === "aprops") renderProps();
  if (s === "avis") renderVisits();
}
function goHome() {
  show(role() === "agent" ? "aprops" : "home");
}
function nav() {
  const a = role() === "agent";
   $("#mid").innerHTML = a
    ? `<button class="pill ${scr == "aprops" ? "act" : ""}" onclick="show('aprops')">Properties</button><button class="pill ${scr == "avis" ? "act" : ""}" onclick="show('avis')">Visits</button><button class="pill" onclick="whoClick()">Account</button>`
    : user
      ? `<button class="pill ${scr == "home" || scr == "detail" ? "act" : ""}" onclick="goHome()">Buy</button><button class="pill" onclick="toast('Sell is coming soon (not part of this prototype)')">Sell</button><button class="pill" onclick="myVisits()">My Visits</button><button class="pill" onclick="whoClick()">Account</button>`
      : `<button class="pill ${scr == "auth" && mode == "in" ? "act" : ""}" onclick="auth('in')">Sign In</button><button class="pill ${scr == "auth" && mode == "up" ? "act" : ""}" onclick="auth('up')">Sign Up</button>`;
}

function whoClick() {
  if (!user) {
    toast("Browsing as a visitor");
    show("home");
    return;
  }
  $("#mb").innerHTML = `
    <h3>${user.name}</h3>
    <p style="margin:-8px 0 18px;opacity:.7;font-size:13px">${user.email || ""}</p>
    <div class="row" style="flex-direction:column;align-items:stretch;gap:10px">
      <button style="background:var(--gold);color:var(--navy)" onclick="changePasswordForm()">Change Password</button>
      <button style="background:#c0503a;color:#fff" onclick="logout()">Log Out</button>
      <button onclick="closeM()">Cancel</button>
    </div>`;
  $("#ov").classList.add("on");
}

async function logout() {
  try {
    await fetch("http://127.0.0.1:5000/api/logout", {
      method: "GET",
      credentials: "include",
    });
  } catch (e) {
    console.error("Logout request failed", e);
  }
  user = null;
  sessionStorage.removeItem("user");
  closeM();
  show("welcome");
  toast("You have been logged out");
}

function changePasswordForm() {
  modal(
    "Change Password",
    [
      { k: "current", l: "Current password",          t: "password" },
      { k: "next",    l: "New password (min 6 chars)", t: "password" },
      { k: "confirm", l: "Confirm new password",      t: "password" },
    ],
    async (v) => {
      if (!v.current)           return "Enter your current password.";
      if (v.next.length < 6)    return "New password needs at least 6 characters.";
      if (v.next !== v.confirm) return "New passwords do not match.";
      if (v.next === v.current) return "New password must be different.";

      try {
        const res = await fetch("http://127.0.0.1:5000/api/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            current_password: v.current,
            new_password: v.next,
          }),
        });
        const data = await res.json();
        if (!res.ok) return data.error || "Could not change password.";
        toast("Password updated successfully");
        return;   // undefined → modal closes
      } catch (e) {
        return "Failed to connect to the server.";
      }
    },
    "Update Password"
  );
}

function forgotPasswordForm() {
  modal(
    "Forgot Password",
    [{ k: "email", l: "Account email", t: "email" }],
    async (v) => {
      if (!/^\S+@\S+\.\S+$/.test(v.email))
        return "Enter a valid email address.";

      try {
        const res = await fetch("http://127.0.0.1:5000/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: v.email }),
        });
        if (!res.ok) {
          const data = await res.json();
          return data.error || "Could not request a reset.";
        }
        toast("Check the Flask terminal for your reset token.");
        setTimeout(openResetPasswordModal, 300);   // auto-advance to paste step
        return;
      } catch (e) {
        return "Failed to connect to the server.";
      }
    },
    "Send Reset Token"
  );
}

function openResetPasswordModal(presetToken) {
  modal(
    "Reset Password",
    [
      { k: "token",   l: "Reset token",                 v: presetToken || "" },
      { k: "next",    l: "New password (min 6 chars)", t: "password" },
      { k: "confirm", l: "Confirm new password",       t: "password" },
    ],
    async (v) => {
      if (!v.token)             return "Paste the token from the Flask terminal.";
      if (v.next.length < 6)    return "New password needs at least 6 characters.";
      if (v.next !== v.confirm) return "New passwords do not match.";

      try {
        const res = await fetch("http://127.0.0.1:5000/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: v.token, new_password: v.next }),
        });
        const data = await res.json();
        if (!res.ok) return data.error || "Could not reset password.";
        toast("Password reset. Please sign in.");
        auth("in");
        return;
      } catch (e) {
        return "Failed to connect to the server.";
      }
    },
    "Reset Password"
  );
}

/* ===== E. LOGIN / SIGN UP ===== */
function auth(m) {
  mode = m;
  $("#ac").innerHTML = m === "in"
    ? `<h2>Sign In</h2>
       <input id="u" placeholder="Email Address">
       <input id="p" type="password" placeholder="Password">
       <div class="err" id="ae"></div>
       <button class="gbtn" onclick="signIn()">Sign In</button>
       <a onclick="forgotPasswordForm()">Forgot Password</a>
       <a onclick="auth('up')">Don't have an account?</a>
       <div class="hint">Demo: customer@rems.com / customer123 &nbsp;|&nbsp; agent@rems.com / agent123</div>`
    : `<h2>Sign Up</h2>
       <input id="n" placeholder="Full Name">
       <input id="u" placeholder="Email Address">
       <input id="p" type="password" placeholder="Password (min 6 chars)">
       <input id="p2" type="password" placeholder="Confirm Password">
       <select id="r">
         <option value="buyer">I'm looking to buy / rent</option>
         <option value="owner">I want to list my property</option>
       </select>
       <div class="err" id="ae"></div>
       <button class="gbtn" onclick="signUp()">Sign Up</button>
       <a onclick="auth('in')">Already have an account?</a>`;
  $("#wt").innerHTML = m === "in" ? "Welcome<br>Back!" : "Join<br>Urban Key";
  show("auth");
}


async function signIn() {
  const email = $("#u").value.trim();
  const password = $("#p").value;
  
  if (!email || !password) {
    return ($("#ae").textContent = "Enter your email and password.");
  }

  try {
    const response = await fetch("http://127.0.0.1:5000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      // credentials: "include" is important if you want Flask-Login cookies to persist
      credentials: "include", 
      body: JSON.stringify({ email: email, password: password })
    });

    const data = await response.json();

    if (response.ok) {
      // Store user info in session storage for the UI to use
      user = { name: data.name, role: data.role, email: email };
      sv("user", user);
      toast("Welcome, " + data.name);
      goHome();
    } else {
      $("#ae").textContent = data.error || "Wrong email or password.";
    }
  } catch (error) {
    $("#ae").textContent = "Failed to connect to the server.";
    console.error("Login error:", error);
  }
}

async function signUp() {
  const name     = $("#n").value.trim();
  const email    = $("#u").value.trim();
  const password = $("#p").value;
  const confirm  = $("#p2").value;
  const role     = $("#r").value;

  if (!name)                                       return ($("#ae").textContent = "Enter your full name.");
  if (!/^\S+@\S+\.\S+$/.test(email))               return ($("#ae").textContent = "Enter a valid email address.");
  if (password.length < 6)                          return ($("#ae").textContent = "Password needs at least 6 characters.");
  if (password !== confirm)                         return ($("#ae").textContent = "Passwords do not match.");

  try {
    const res = await fetch("http://127.0.0.1:5000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ full_name: name, email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) return ($("#ae").textContent = data.error || "Registration failed.");

    toast("Account created. Please sign in.");
    auth("in");
    setTimeout(() => { if ($("#u")) $("#u").value = email; }, 0);   // prefill email
  } catch (err) {
    $("#ae").textContent = "Failed to connect to the server.";
    console.error("Register error:", err);
  }
}

/* ===== F. CUSTOMER: SEARCH & DETAILS ===== */
function renderList() {
  const q = $("#q").value.toLowerCase(),
    pm = +$("#pmax").value,
    ms = +$("#msz").value;
  const r = P.filter(
    (p) =>
      (p.title + p.loc).toLowerCase().includes(q) &&
      (!pm || p.price <= pm) &&
      p.marla >= ms,
  );
  $("#list").innerHTML = r.length
    ? r
        .map(
          (p) =>
            `<div class="pc" onclick="det(${p.id})"><div class="im">${pic(p.img || IMAGES.gallery[0])}</div><div class="tx"><h4>${p.title}</h4><div class="pr">${money(p.price)}</div><div>${p.loc}</div><button class="tbtn" onclick="event.stopPropagation();toast('Message sent to ${p.agent} (prototype)')">Contact Agent</button></div><div class="marla">${p.marla}<small>Marla</small></div></div>`,
        )
        .join("")
    : "<p>No properties match your search. Try a different name or price.</p>";
}
function det(id, g) {
  cur = P.find((p) => p.id == id);
  const p = cur,
    L = gallery(p);
  gi = (((g || 0) % L.length) + L.length) % L.length;
  $("#detail").innerHTML =
    `<div class="gal"><div class="im">${pic(L[gi])}</div><div class="im">${pic(L[(gi + 1) % L.length])}</div><button class="gb" style="left:0" onclick="det(${id},${gi - 1})">&larr; Back</button><button class="gb" style="right:0" onclick="det(${id},${gi + 1})">Next &rarr;</button></div>
  <div class="dt"><h1>${p.title}</h1><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Spacious rooms, natural light and a quiet neighbourhood close to schools and markets.</p></div>
  <div class="loc">${p.loc}</div>
  <div class="sq"><div class="marla">${p.marla}<small>Marla</small></div><div>${p.sqft} square feet &nbsp; | &nbsp; ${money(p.price)}</div></div>
  <div class="ag"><span>&#128100; ${p.agent}</span><button onclick="toast('Advice request sent to ${p.agent} (prototype)')">Get Advice NOW</button></div>
  <div class="acts"><button onclick="schedule()">Schedule Visit</button><button onclick="toast('Payments are outside the prototype scope')">Buy Now!</button></div>
  <div class="end">The End</div>`;
  show("detail");
}
function schedule() {
  if (!user) {
    toast("Please sign in to schedule a visit");
    return auth("in");
  }
  const t = new Date().toISOString().slice(0, 10);
  modal(
    "Schedule Visit: " + cur.title,
    [
      { k: "d", l: "Preferred date", t: "date", min: t },
      {
        k: "t",
        l: "Preferred time",
        opts: ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00"],
      },
      { k: "n", l: "Note for agent (optional)" },
    ],
    (v) => {
      if (!v.d) return "Choose a visit date.";
      if (v.d < t) return "The date cannot be in the past.";
      V.push({
        id: Date.now(),
        pid: cur.id,
        cust: user.name,
        date: v.d,
        time: v.t,
        st: "Pending",
      });
      sv("visits", V);
      toast(
        "Visit requested for " +
          v.d +
          " at " +
          v.t +
          ". Awaiting agent confirmation.",
      );
    },
    "Request Visit",
  );
}
function myVisits() {
  const m = V.filter((v) => v.cust === user.name);
  $("#mb").innerHTML =
    `<h3>My Visits</h3>` +
    (m.length
      ? m
          .map(
            (v) =>
              `<p>${pname(v.pid)}<br>${v.date} at ${v.time} - <b>${v.st}</b></p>`,
          )
          .join("")
      : "<p>No visits yet. Open a property and choose Schedule Visit.</p>") +
    `<div class="row"><button onclick="closeM()" style="background:var(--gold)">Close</button></div>`;
  $("#ov").classList.add("on");
}

/* ===== G. AGENT: PROPERTY MANAGEMENT ===== */
function renderProps() {
  $("#ptb").innerHTML =
    P.map(
      (p) =>
        `<tr><td>${p.title}</td><td>${p.loc}</td><td>${money(p.price)}</td><td>${p.marla}</td><td><button class="sm b-n" onclick="propForm(${p.id})">Edit</button><button class="sm b-r" onclick="delProp(${p.id})">Delete</button></td></tr>`,
    ).join("") ||
    "<tr><td colspan=5>No properties yet. Add your first listing.</td></tr>";
}
function propForm(id) {
  const p = P.find((x) => x.id == id) || {};
  modal(
    id ? "Edit Property" : "Add Property",
    [
      { k: "title", l: "Title", v: p.title },
      { k: "loc", l: "Location", v: p.loc },
      { k: "price", l: "Price ($)", t: "number", v: p.price },
      { k: "marla", l: "Size (Marla)", t: "number", v: p.marla },
      { k: "sqft", l: "Square feet", t: "number", v: p.sqft },
    ],
    (v) => {
      if (!v.title || !v.loc) return "Title and location are required.";
      if (!(+v.price > 0) || !(+v.marla > 0))
        return "Price and size must be positive numbers.";
      const o = {
        title: v.title,
        loc: v.loc,
        price: +v.price,
        marla: +v.marla,
        sqft: +v.sqft || 0,
      };
      if (id) Object.assign(p, o);
      else
        P.push({
          id: Date.now(),
          agent: user ? user.name : "Agent Abdul",
          ...o,
        });
      sv("props", P);
      renderProps();
      toast(id ? "Property updated" : "Property added");
    },
  );
}
function delProp(id) {
  if (!confirm("Delete this property?")) return;
  P = P.filter((p) => p.id != id);
  sv("props", P);
  renderProps();
  toast("Property deleted");
}

/* ===== H. AGENT: VISIT MANAGEMENT ===== */
function renderVisits() {
  $("#vtb").innerHTML =
    V.map(
      (v) =>
        `<tr><td>${pname(v.pid)}</td><td>${v.cust}</td><td>${v.date}</td><td>${v.time}</td><td><span class="st ${v.st}">${v.st}</span></td><td><button class="sm b-t" onclick="setV(${v.id},'Confirmed')">Confirm</button><button class="sm b-n" onclick="resch(${v.id})">Reschedule</button><button class="sm b-r" onclick="setV(${v.id},'Cancelled')">Cancel</button></td></tr>`,
    ).join("") || "<tr><td colspan=6>No visit requests yet.</td></tr>";
}
function setV(id, s) {
  V.find((v) => v.id == id).st = s;
  sv("visits", V);
  renderVisits();
  toast("Visit " + s.toLowerCase());
}
function resch(id) {
  const v = V.find((x) => x.id == id),
    t = new Date().toISOString().slice(0, 10);
  modal(
    "Reschedule Visit",
    [
      { k: "d", l: "New date", t: "date", v: v.date, min: t },
      {
        k: "t",
        l: "New time",
        opts: ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00"],
      },
    ],
    (n) => {
      if (!n.d || n.d < t) return "Choose a valid future date.";
      v.date = n.d;
      v.time = n.t;
      v.st = "Pending";
      sv("visits", V);
      renderVisits();
      toast("Visit rescheduled");
    },
    "Reschedule",
  );
}


async function fetchProtectedData() {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/properties/manage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include" // Sends the session cookie automatically
    });

    const data = await response.json();
    if (response.ok) {
      console.log(data.message);
    } else {
      alert("Access Denied: " + data.error);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

/* ===== I. SESSION SYNC ===== */
async function syncSession() {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/me", {
      credentials: "include"
    });

    if (res.ok) {
      const data = await res.json();
      user = { name: data.name, role: data.role, email: data.email };
      sv("user", user);
      nav();
      // Only auto-navigate if the user hasn't interacted yet (initial load)
      if (scr === "welcome") goHome();
    } else {
      // 401 — cookie expired or user deactivated: drop stale local state
      user = null;
      sessionStorage.removeItem("user");
      nav();
    }
  } catch (e) {
    // Backend unreachable — stay with whatever sessionStorage has
    console.error("Session sync failed:", e);
  }
}

/* ===== I. START ===== */
$("#kb").innerHTML = KEY("#0f2a44");
$("#lk").innerHTML = KEY("#0f2a44");
syncSession();
// If the Flask console printed a reset link and the user opened it,
// pre-fill the token automatically.
const resetToken = new URLSearchParams(location.search).get("reset");
if (resetToken) {
  history.replaceState({}, "", location.pathname);  // strip token from URL bar
  openResetPasswordModal(resetToken);
}