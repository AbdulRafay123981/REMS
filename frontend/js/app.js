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
let P = [],
  V = ld("visits", SEEDV),
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
  if (p.images?.length) {
    return p.images.map((image) =>
      image.image_path.startsWith("/")
        ? image.image_path
        : `/${image.image_path}`,
    );
  }

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

const money = (n) => "Rs. " + Number(n).toLocaleString("en-PK");

const areaLabel = (n) => (n == null ? "Area not specified" : `${n} Marla`);

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
            ? `<select id="f_${f.k}">${f.opts.map((o) => `<option ${o === f.v ? "selected" : ""}>${o}</option>`).join("")}</select>`
            : `<input id="f_${f.k}" type="${f.t || "text"}" value="${f.v || ""}" ${f.min ? `min="${f.min}"` : ""}>`),
      )
      .join("") +
    `<div class="err" id="me"></div><div class="row"><button onclick="closeM()">Cancel</button><button style="background:var(--gold);color:var(--navy)" id="mok">${okLabel || "Save"}</button></div>`;

  $("#ov").classList.add("on");

  $("#mok").onclick = async () => {
    const button = $("#mok");
    const v = {};

    fields.forEach((f) => (v[f.k] = $("#f_" + f.k).value.trim()));

    button.disabled = true;

    try {
      const e = await ok(v);

      if (e) {
        $("#me").textContent = e;
      } else {
        closeM();
      }
    } catch (error) {
      console.error("Modal submission failed:", error);
      $("#me").textContent = error.message || "Something went wrong.";
    } finally {
      button.disabled = false;
    }
  };
}

function closeM() {
  $("#ov").classList.remove("on");
}

function normalizeProperty(p) {
  return {
    id: p.property_id,
    title: p.title,
    img: IMAGES.gallery[0],
    price: p.price,
    loc: [p.address, p.area, p.city].filter(Boolean).join(", "),
    marla: p.area_marla,
    sqft: p.area_sqft,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    description: p.description,
    propertyType: p.property_type,
    listingType: p.listing_type,
    pricePeriod: p.price_period,
    agent: `Owner #${p.owner_id}`,
  };
}

async function loadProperties() {
  try {
    const response = await fetch("/api/properties");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const properties = await response.json();

    P = properties.map(normalizeProperty);

    if (scr === "home") renderList();
    if (scr === "aprops") renderProps();
  } catch (error) {
    console.error("Property loading failed:", error);
    toast("Could not load properties from the server.");
  }
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
    ? `<button class="pill ${scr == "aprops" ? "act" : ""}" onclick="show('aprops')">Properties</button><button class="pill ${scr == "avis" ? "act" : ""}" onclick="show('avis')">Visits</button><button class="pill" onclick="whoClick()">Log Out</button>`
    : user
      ? `<button class="pill ${scr == "home" || scr == "detail" ? "act" : ""}" onclick="goHome()">Buy</button><button class="pill" onclick="toast('Sell is coming soon (not part of this prototype)')">Sell</button><button class="pill" onclick="myVisits()">My Visits</button><button class="pill" onclick="whoClick()">Log Out</button>`
      : `<button class="pill ${scr == "auth" && mode == "in" ? "act" : ""}" onclick="auth('in')">Sign In</button><button class="pill ${scr == "auth" && mode == "up" ? "act" : ""}" onclick="auth('up')">Sign Up</button>`;
  $("#who").textContent = user ? user.name : "Visitor";
  $("#who").title = user ? "" : "Browse as a visitor";
}
function whoClick() {
  if (user) {
    user = null;
    sessionStorage.removeItem("user");
    show("welcome");
    toast("You have been logged out");
  } else {
    toast("Browsing as a visitor");
    show("home");
  }
}

/* ===== E. LOGIN / SIGN UP ===== */
function auth(m) {
  mode = m;
  $("#ac").innerHTML =
    m === "in"
      ? `<h2>Sign In</h2><input id="u" placeholder="User Name"><input id="p" type="password" placeholder="Password"><div class="err" id="ae"></div><button class="gbtn" onclick="signIn()">Sign In</button><a onclick="toast('Password reset is not part of the prototype')">Forgot Password</a><a onclick="auth('up')">Don't have an account?</a><div class="hint">Demo: customer / 1234 &nbsp;|&nbsp; agent / 1234</div>`
      : `<h2>Sign Up</h2><input id="u" placeholder="Email"><input id="p" type="password" placeholder="Password"><div class="err" id="ae"></div><button class="gbtn" onclick="signUp()">Sign Up</button><a onclick="auth('in')">Already have an account?</a>`;
  $("#wt").innerHTML = m === "in" ? "Welcome<br>Back!" : "Join<br>Urban Key";
  show("auth");
}
function signIn() {
  const u = $("#u").value.trim().toLowerCase(),
    p = $("#p").value;
  if (!u || !p)
    return ($("#ae").textContent = "Enter your user name and password.");
  const a = USERS[u];
  if (!a || a.pw !== p)
    return ($("#ae").textContent = "Wrong user name or password.");
  user = a;
  sv("user", a);
  toast("Welcome, " + a.name);
  goHome();
}
function signUp() {
  const u = $("#u").value.trim(),
    p = $("#p").value;
  if (!/^\S+@\S+\.\S+$/.test(u))
    return ($("#ae").textContent = "Enter a valid email address.");
  if (p.length < 6)
    return ($("#ae").textContent = "Password needs at least 6 characters.");
  toast("Account created (demo). Please sign in.");
  auth("in");
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
      (p.marla == null || p.marla >= ms),
  );
  $("#list").innerHTML = r.length
    ? r
        .map(
          (p) =>
            `<div class="pc" onclick="det(${p.id})"><div class="im">${pic(p.img || IMAGES.gallery[0])}</div><div class="tx"><h4>${p.title}</h4><div class="pr">${money(p.price)}</div><div>${p.loc}</div><button class="tbtn" onclick="event.stopPropagation();toast('Message sent to ${p.agent} (prototype)')">Contact Agent</button></div><div class="marla">${p.marla == null ? "—" : p.marla}<small>${p.marla == null ? "Area not specified" : "Marla"}</small></div></div>`,
        )
        .join("")
    : "<p>No properties match your search. Try a different name or price.</p>";
}

async function det(id, g) {
  const property = P.find((p) => p.id == id);

  if (!property) {
    toast("Property not found.");
    return;
  }

  if (!property.imagesLoaded) {
    try {
      const response = await fetch(`/api/properties/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const details = await response.json();

      Object.assign(property, normalizeProperty(details), {
        images: details.images || [],
        imagesLoaded: true,
      });
    } catch (error) {
      console.error("Property detail loading failed:", error);
      toast("Could not load property details.");
      return;
    }
  }

  cur = property;
  const p = cur;
  const L = gallery(p);

  gi = (((g || 0) % L.length) + L.length) % L.length;

  const priceLabel =
    p.listingType === "rent" && p.pricePeriod
      ? `${money(p.price)} / ${p.pricePeriod}`
      : money(p.price);

  const facts = [
    ["Bedrooms", p.bedrooms],
    ["Bathrooms", p.bathrooms],
    ["Area", p.marla == null ? null : `${p.marla} Marla`],
    ["Size", p.sqft ? `${p.sqft} sq ft` : null],
  ];

  $("#detail").innerHTML = `
    <div class="detail-page">

      <button class="back-btn" onclick="goHome()">
        &larr; Back to properties
      </button>

      <div class="detail-gallery">
        <img src="${L[gi]}" alt="${p.title}">

        <button class="gallery-btn prev"
          onclick="det(${id}, ${gi - 1})">&larr;</button>

        <button class="gallery-btn next"
          onclick="det(${id}, ${gi + 1})">&rarr;</button>

        <span class="photo-count">${gi + 1} / ${L.length}</span>
      </div>

      <div class="detail-content">

        <div class="detail-heading">
          <div>
            <span class="property-type">
              ${p.propertyType || "Property"}
              ${p.listingType ? " • " + p.listingType : ""}
            </span>
            <h1>${p.title}</h1>
            <p class="detail-location">${p.loc}</p>
          </div>

          <div class="detail-price">${priceLabel}</div>
        </div>

        <section class="detail-section">
          <h2>Property Overview</h2>

          <div class="property-facts">
            ${facts
              .filter((f) => f[1] != null && f[1] !== "")
              .map(
                (f) => `
                  <div class="fact">
                    <strong>${f[1]}</strong>
                    <span>${f[0]}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>

        <section class="detail-section">
          <h2>Description</h2>
          <p class="description">
            ${p.description || "No property description has been provided yet."}
          </p>
        </section>

        <section class="agent-info">
          <div>
            <strong>Listed by</strong>
            <span>${p.agent}</span>
          </div>

          <button onclick="toast('Advice request sent to ${p.agent} (prototype)')">
            Contact Agent
          </button>
        </section>

        <div class="detail-actions">
          <button onclick="schedule()">Schedule Visit</button>
          <button onclick="toast('Payments are outside the prototype scope')">
            Buy Now
          </button>
        </div>

      </div>
    </div>
  `;

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
        `<tr><td>${p.title}</td><td>${p.loc}</td><td>${money(p.price)}</td><td>${areaLabel(p.marla)}</td><td><button class="sm b-n" onclick="propForm(${p.id})">Edit</button><button class="sm b-r" onclick="delProp(${p.id})">Delete</button></td></tr>`,
    ).join("") ||
    "<tr><td colspan=5>No properties yet. Add your first listing.</td></tr>";
}

async function propForm(id) {
  let p = {};

  if (id) {
    const response = await fetch(`/api/properties/${id}`);
    const result = await response.json();

    if (!response.ok) {
      toast(result.error || "Could not load property.");
      return;
    }

    p = result;
  }

  modal(
    id ? "Edit Property" : "Add Property",
    [
      { k: "title", l: "Property Title", v: p.title || "" },
      { k: "address", l: "Street Address", v: p.address || "" },
      { k: "city", l: "City", v: p.city || "" },
      {
        k: "propertyType",
        l: "Property Type",
        v: p.property_type || "residential",
        opts: ["residential", "commercial", "industrial", "land", "other"],
      },
      {
        k: "listingType",
        l: "Listing Type",
        v: p.listing_type || "sale",
        opts: ["sale", "rent"],
      },
      {
        k: "price",
        l: "Price (PKR)",
        t: "number",
        min: "0",
        v: p.price ?? "",
      },
      {
        k: "pricePeriod",
        l: "Rent Period",
        v: p.price_period || "monthly",
        opts: ["daily", "weekly", "monthly", "yearly"],
      },
    ],
    async (v) => {
      if (!v.title || !v.address || !v.city)
        return "Title, address and city are required.";

      if (v.price === "" || !Number.isFinite(+v.price) || +v.price < 0)
        return "Enter a valid price.";

      const payload = {
        title: v.title,
        address: v.address,
        city: v.city,
        property_type: v.propertyType,
        listing_type: v.listingType,
        price: +v.price,
        price_period: v.listingType === "rent" ? v.pricePeriod : null,
      };

      if (!id) payload.owner_id = 1;

      const response = await fetch(
        id ? `/api/properties/${id}` : "/api/properties",
        {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok) return result.error || "Could not save property.";

      await loadProperties();
      toast(
        id
          ? "Property updated successfully!"
          : "Property created successfully!",
      );
    },
    id ? "Save Changes" : "Create Property",
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

/* ===== I. START ===== */
$("#kb").innerHTML = KEY("#0f2a44");
$("#lk").innerHTML = KEY("#0f2a44");

loadProperties();
