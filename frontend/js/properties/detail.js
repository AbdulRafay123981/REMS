const detail = document.querySelector("#detail");

let currentProperty = null;
let currentImages = [];
let currentImageIndex = 0;

const money = (amount) =>
  "Rs. " + Number(amount).toLocaleString("en-PK");

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

function imagePath(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

function getGallery(property) {
  if (property.images?.length) {
    return property.images.map((image) =>
      imagePath(image.image_path)
    );
  }

  const fallback = IMAGES.gallery.map(imagePath);
  return fallback;
}

function renderGallery() {
  const image = detail.querySelector(".detail-gallery img");
  const count = detail.querySelector(".photo-count");

  image.src = currentImages[currentImageIndex];
  count.textContent =
    `${currentImageIndex + 1} / ${currentImages.length}`;
}

function changeImage(direction) {
  currentImageIndex =
    (currentImageIndex + direction + currentImages.length)
    % currentImages.length;

  renderGallery();
}

function renderProperty(property) {
  currentProperty = property;
  currentImages = getGallery(property);
  currentImageIndex = 0;

  const location = [
    property.address,
    property.area,
    property.city,
  ].filter(Boolean).join(", ");

  const priceLabel =
    property.listing_type === "rent" && property.price_period
      ? `${money(property.price)} / ${escapeHTML(property.price_period)}`
      : money(property.price);

  const facts = [
    ["Bedrooms", property.bedrooms],
    ["Bathrooms", property.bathrooms],
    [
      "Area",
      property.area_marla == null
        ? null
        : `${escapeHTML(property.area_marla)} Marla`,
    ],
    [
      "Size",
      property.area_sqft
        ? `${escapeHTML(property.area_sqft)} sq ft`
        : null,
    ],
  ];

  detail.innerHTML = `
    <div class="detail-page">

      <a class="back-btn" href="/properties">
        &larr; Back to properties
      </a>

      <div class="detail-gallery">
        <img src="${escapeHTML(currentImages[0])}"
             alt="${escapeHTML(property.title)}">

        <button class="gallery-btn prev" id="prev-image"
                aria-label="Previous image">&larr;</button>

        <button class="gallery-btn next" id="next-image"
                aria-label="Next image">&rarr;</button>

        <span class="photo-count">
          1 / ${currentImages.length}
        </span>
      </div>

      <div class="detail-content">

        <div class="detail-heading">
          <div>
            <span class="property-type">
              ${escapeHTML(property.property_type || "Property")}
              ${property.listing_type
                ? " • " + escapeHTML(property.listing_type)
                : ""}
            </span>

            <h1>${escapeHTML(property.title)}</h1>

            <p class="detail-location">
              ${escapeHTML(location || "Location not specified")}
            </p>
          </div>

          <div class="detail-price">${priceLabel}</div>
        </div>

        <section class="detail-section">
          <h2>Property Overview</h2>

          <div class="property-facts">
            ${facts
              .filter((fact) =>
                fact[1] != null && fact[1] !== ""
              )
              .map((fact) => `
                <div class="fact">
                  <strong>${fact[1]}</strong>
                  <span>${fact[0]}</span>
                </div>
              `)
              .join("")}
          </div>
        </section>

        <section class="detail-section">
          <h2>Description</h2>

          <p class="description">
            ${escapeHTML(
              property.description ||
              "No property description has been provided yet."
            )}
          </p>
        </section>

        <section class="agent-info">
          <div>
            <strong>Listed by</strong>
            <span>Owner #${escapeHTML(property.owner_id)}</span>
          </div>

          <button id="contact-agent">
            Contact Agent
          </button>
        </section>

        <div class="detail-actions">
          <button id="schedule-visit">Schedule Visit</button>
          <button id="buy-now">Buy Now</button>
        </div>

      </div>
    </div>
  `;

  detail.querySelector("#prev-image")
    .addEventListener("click", () => changeImage(-1));

  detail.querySelector("#next-image")
    .addEventListener("click", () => changeImage(1));

  detail.querySelector("#contact-agent")
    .addEventListener("click", () =>
      alert("Contact Agent functionality will be integrated later.")
    );

  detail.querySelector("#schedule-visit")
    .addEventListener("click", () =>
      alert("Visit scheduling will be integrated later.")
    );

  detail.querySelector("#buy-now")
    .addEventListener("click", () =>
      alert("Payment functionality is outside the current prototype scope.")
    );
}

async function loadProperty() {
  const propertyId = window.location.pathname.split("/").pop();

  try {
    const property = await REMSApi.get(
      `/api/properties/${propertyId}`
    );

    renderProperty(property);
  } catch (error) {
    console.error("Property loading failed:", error);

    detail.innerHTML = `
      <div class="detail-page">
        <h2>Property not found</h2>
        <p>We couldn't load this property's details.</p>
        <a href="/properties">Back to properties</a>
      </div>
    `;
  }
}

loadProperty();

