document.addEventListener("DOMContentLoaded", async () => {

  const wrap = document.getElementById("salon-list");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");

  let salons = [];
  let allSalons = [];


  let activeCategory = "";

  const salonIcon = L.icon({
  iconUrl: "assets/salon-marker.png",
  iconSize: [34, 42],
  iconAnchor: [17, 42],
  popupAnchor: [0, -36]
});


const categoriesBar = document.getElementById("categoriesBar");

async function loadCategories(){
  const res = await fetch("/api/categories");
  const categories = await res.json();
  console.log("📦 categories from api:", categories);

  categoriesBar.innerHTML =
    `<button class="active" data-cat="">Все</button>` +
    categories.map(c => `
      <button data-cat="${c.key}">${c.title}</button>
    `).join("");
categoriesBar.addEventListener("click", e => {
  if (e.target.tagName !== "BUTTON") return;

  document
    .querySelectorAll(".category-buttons button")
    .forEach(b => b.classList.remove("active"));

  e.target.classList.add("active");

  activeCategory = e.target.dataset.cat || "";

  console.log("🎯 activeCategory =", activeCategory);

  const items = activeCategory
    ? salons.filter(s =>
        Array.isArray(s.categories) &&
        s.categories.includes(activeCategory)
      )
    : salons;

  console.log("📋 filtered salons:", items);

  render(items);
});

}

loadCategories();


function filterSalons(){
  document.querySelectorAll(".salon-card").forEach(card => {
    const cats = JSON.parse(card.dataset.categories || "[]");

    if (!activeCategory || cats.includes(activeCategory)) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });
}


function addMinutes(dt, mins) {
  const d = new Date(dt.getTime() + mins * 60000);
  return d.toISOString();
}
function timeToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mm) {
  const h = String(Math.floor(mm / 60)).padStart(2, "0");
  const m = String(mm % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Заглушка SMS (подключишь провайдера: Twilio / Vonage / локальный SMS-шлюз)
async function sendSms(to, text) {
  console.log("[SMS]", to, text);
  // TODO: интеграция с SMS-провайдером
  return true;
}

let salonMarkers = [];

function placeMarkers(items) {
  // удалить старые маркеры салонов
  salonMarkers.forEach(m => map.removeLayer(m));
  salonMarkers = [];

  items.forEach(s => {
    if (!s.lat || !s.lng) return;

    const marker = L.marker([s.lat, s.lng], { icon: salonIcon })
      .addTo(map)
      .bindPopup(`
        <div style="min-width:180px">
          <b>${s.name}</b><br>
          <small>${s.address || ""}</small><br><br>
          <a href="salon.html?id=${s.id}" class="btn primary" style="padding:6px 10px; font-size:13px">
            Открыть
          </a>
        </div>
      `);

    salonMarkers.push(marker);
  });
}



  // ===== MAP =====
  const map = L.map("map").setView([41.311, 69.279], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
    .addTo(map);


  function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // радиус Земли
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

document.getElementById("nearbyBtn")?.addEventListener("click", () => {
  if (!userLocation) {
    alert("Разрешите доступ к геолокации");
    return;
  }
  const nearby = salons.filter(s => s.distance && s.distance < 3);
  render(nearby);
});

nearNowBtn.onclick = async () => {
  const res = await fetch("/api/salons/available/today");
  let data = await res.json();

  if (userLocation) {
    data = data.map(s => ({
      ...s,
      distance: distanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
    }))
    .sort((a,b)=>a.distance-b.distance);
  }

  render(data);
};


function applyFilters() {
  let list = [...allSalons];

  if (activeCategory) {
    list = list.filter(s =>
      JSON.stringify(s.categories).toLowerCase().includes(activeCategory)
    );
  }

  if (userLocation) {
    list = list
      .map(s => ({
        ...s,
        distance: s.lat && s.lng
          ? distanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null
      }))
      .sort((a,b)=>(a.distance ?? 9999)-(b.distance ?? 9999));
  }

  render(list);
}



  function placeMarkers(items) {
    map.eachLayer(layer => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    items.forEach(s => {
      if (!s.lat || !s.lng) return;
      L.marker([s.lat, s.lng])
        .addTo(map)
        .bindPopup(`<a href="salon.html?id=${s.id}">${s.name}</a>`);
    });
  }

  // ===== RENDER =====
  function render(items) {
  if (!items || !items.length) {
    wrap.innerHTML = "<p>Салоны не найдены</p>";
    placeMarkers([]);
    return;
  }

  wrap.innerHTML = items.map(s => `
  <article class="salon-card"
    data-categories='${JSON.stringify(s.categories || [])}'>

    <img src="${s.photos?.[0] || "assets/sample.jpg"}" alt="${s.name}">
      
    <h3>${s.name}</h3>

    ${s.distance !== undefined
      ? `<div class="distance">📍 ${s.distance.toFixed(1)} км от вас</div>`
      : ""
    }

    <p>${s.short_desc || ""}</p>

    <div class="card-actions">
      <a class="btn" href="salon.html?id=${s.id}">Открыть</a>
    </div>
  </article>
`).join("");


  placeMarkers(items);
}


  // ===== LOAD =====
  async function load() {
  const res = await fetch("/api/salons");
  allSalons = await res.json();

  // копия для работы
  salons = [...allSalons];

  if (userLocation) {
    salons = salons
      .map(s => {
        if (!s.lat || !s.lng) return s;

        const lat = Number(s.lat);
        const lng = Number(s.lng);

        if (isNaN(lat) || isNaN(lng)) return s;

        return {
          ...s,
          distance: distanceKm(
            userLocation.lat,
            userLocation.lng,
            lat,
            lng
          )
        };
      })
      .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
  }

  render(salons);

  if (salons.length) {
  const bounds = L.latLngBounds(
    salons.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng])
  );
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
}

}



  // ===== SEARCH =====
  function search(q) {
    q = q.toLowerCase();
    return salons.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.short_desc || "").toLowerCase().includes(q) ||
      (s.categories || []).join(" ").toLowerCase().includes(q)
    );
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();

    if (!q) {
      results.style.display = "none";
      render(activeCategory ? filterByCategory(activeCategory) : salons);
      return;
    }

    const found = search(q);
    render(found);

    results.innerHTML = found.length
      ? found.map(s => `<div class="search-item" data-id="${s.id}">${s.name}</div>`).join("")
      : "<div class='search-empty'>Ничего не найдено</div>";

    results.style.display = "block";
  });

  results.addEventListener("click", e => {
    if (e.target.classList.contains("search-item")) {
      window.location.href = `salon.html?id=${e.target.dataset.id}`;
    }
  });

  // ===== CATEGORY FILTER =====
 function filterByCategory(catKey) {
  return salons.filter(s =>
    Array.isArray(s.categories) &&
    s.categories.includes(catKey)
  );
}


  // document.querySelectorAll(".category-buttons button")
  //   .forEach(btn => {
  //     btn.addEventListener("click", () => {
  //       // document.querySelectorAll(".category-buttons button")
  //       //   .forEach(b => b.classList.remove("active"));

  //       // btn.classList.add("active");
  //       activeCategory = btn.dataset.cat?.toLowerCase() || "";

  //       const items = activeCategory
  //         ? filterByCategory(activeCategory)
  //         : salons;

  //       render(items);
  //     });
  //   });

    let userLocation = null;

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      map.setView([userLocation.lat, userLocation.lng], 14);

      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: "#ff3366",
        fillColor: "#ff3366",
        fillOpacity: 1
      })
      .addTo(map)
      .bindPopup("Вы здесь")
      .openPopup();
    },
    () => {
      console.warn("Геолокация отклонена");
    }
  );
}


  load();
});
