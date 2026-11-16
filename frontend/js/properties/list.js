const list = document.querySelector("#list");
const search = document.querySelector("#q");
const maxPrice = document.querySelector("#pmax");
const maxSize = document.querySelector("#msz");

let properties = [];

const money = (amount) => "Rs. " + Number(amount).toLocaleString("en-PK");

const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

function propertyImage(property) {
  const image = property.images?.[0]?.image_path;

  return image
    ? image.startsWith("/")
      ? image
      : `/${image}`
    : "/images/green-house.jpg";
}

function renderProperties() {
  const query = search.value.trim().toLowerCase();
  const priceLimit = Number(maxPrice.value) || Infinity;
  const sizeLimit = Number(maxSize.value) || Infinity;

  const filtered = properties.filter((property) => {
    const location = [property.address, property.area, property.city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      property.title.toLowerCase().includes(query) || location.includes(query);

    const matchesPrice = Number(property.price) <= priceLimit;

    const matchesSize =
      property.area_marla == null || Number(property.area_marla) <= sizeLimit;

    return matchesSearch && matchesPrice && matchesSize;
  });

  if (filtered.length === 0) {
    list.innerHTML = "<p>No matching properties found.</p>";
    return;
  }

  list.innerHTML = filtered
    .map((property) => {
      const location = [property.address, property.area, property.city]
        .filter(Boolean)
        .map(escapeHTML)
        .join(", ");

      const price = money(property.price);
      const priceLabel =
        property.listing_type === "rent"
          ? `${price} / ${escapeHTML(property.price_period || "month")}`
          : price;

      const size =
        property.area_marla == null
          ? "—"
          : `${escapeHTML(property.area_marla)}<small>Marla</small>`;

      return `
      <a class="pc" href="/property/${property.property_id}">
        <div class="im">
          <img
            src="${escapeHTML(propertyImage(property))}"
            alt="${escapeHTML(property.title)}"
          >
        </div>

        <div class="tx">
          <h4>${escapeHTML(property.title)}</h4>
          <p class="pr">${priceLabel}</p>
          <p>${location}</p>
          <p>${escapeHTML(property.property_type)}</p>
        </div>

        <div class="marla">${size}</div>
      </a>
    `;
    })
    .join("");
}

async function loadProperties() {
  list.innerHTML = "<p>Loading properties...</p>";

  try {
    properties = await REMSApi.get("/api/properties");

    renderProperties();
  } catch (error) {
    console.error("Property loading failed:", error);
    list.innerHTML = `
      <p>Could not load properties. Please try again.</p>
    `;
  }
}

search.addEventListener("input", renderProperties);
maxPrice.addEventListener("change", renderProperties);
maxSize.addEventListener("change", renderProperties);

loadProperties();
