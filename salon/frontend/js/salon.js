(function () {
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return document.querySelectorAll(sel); }
  function parseId() {
    const p = new URLSearchParams(location.search);
    return p.get("id");
  }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  let currentSalon = null;
  let currentMaster = null;
  let selectedDate = null;
  let selectedSlotId = null;

  // ==========================
  // LOAD SALON
  // ==========================
  async function loadSalon() {
    const id = parseId();
    if (!id) return;

    try {
      const res = await fetch("/api/salons/" + id);
      const json = await res.json();

      if (json.error) {
        q("#salon-title").textContent = "Салон не найден";
        return;
      }

      currentSalon = {
        ...json.salon,
        masters: json.masters || []
      };

      renderSalon();
      initSalonMap();
      loadPublicServices();

    } catch (e) {
      console.error(e);
      q("#salon-title").textContent = "Ошибка загрузки салона";
    }
  }

  // ==========================
  // RENDER SALON
  // ==========================
  function renderSalon() {
    q("#salon-title").textContent = currentSalon.name;
    q("#salon-desc").textContent =
      currentSalon.full_desc || currentSalon.short_desc || "";

    q("#salon-address").textContent =
      currentSalon.address ? "📍 " + currentSalon.address : "";

    // gallery
    const gallery = q("#gallery");
    gallery.innerHTML =
      currentSalon.photos?.length
        ? currentSalon.photos.map(p => `<img src="${p}">`).join("")
        : `<img src="assets/sample.jpg">`;

    // masters
    const mastersWrap = q("#masters");
    mastersWrap.innerHTML = currentSalon.masters.map(m => `
      <div class="master" data-id="${m.id}">
        <img src="${m.photo || "assets/avatar.png"}">
        <div class="meta"><strong>${escapeHtml(m.name)}</strong></div>
      </div>
    `).join("");

    const sel = q("#master-select");
    sel.innerHTML = currentSalon.masters.map(m =>
      `<option value="${m.id}">${escapeHtml(m.name)}</option>`
    ).join("");

    currentMaster = currentSalon.masters[0] || null;
  }

  // ==========================
  // MAP
  // ==========================
  function initSalonMap() {
    if (!currentSalon?.lat || !currentSalon?.lng) return;

    ymaps.ready(() => {
      const map = new ymaps.Map("salon-map", {
        center: [currentSalon.lat, currentSalon.lng],
        zoom: 15
      });

      map.geoObjects.add(
        new ymaps.Placemark(
          [currentSalon.lat, currentSalon.lng],
          { balloonContent: currentSalon.address }
        )
      );
    });
  }

  // ==========================
  // CALENDAR
  // ==========================
  function buildCalendar() {
    const cal = q("#calendar");
    cal.innerHTML = "";

    const now = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const iso = d.toISOString().slice(0, 10);

      const el = document.createElement("div");
      el.className = "day-card";
      el.innerHTML = `
        <div class="day-num">${d.getDate()}</div>
        <div class="day-week">${d.toLocaleDateString("ru-RU", { weekday: "short" })}</div>
      `;

      el.onclick = async () => {
        qa(".day-card").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");

        selectedDate = iso;
        selectedSlotId = null;

        q("#time-slots").innerHTML = "<p>Загрузка...</p>";
        await loadSlots(iso);
      };

      cal.appendChild(el);
    }
  }

  // ==========================
  // LOAD SLOTS
  // ==========================
  async function loadSlots(date) {
    if (!currentMaster) return;

    try {
      const res = await fetch(`/api/masters/${currentMaster.id}/available?date=${date}`);
      const rows = await res.json();

      const wrap = q("#time-slots");

      if (!rows.length) {
        wrap.innerHTML = "<p>Нет свободных слотов</p>";
        return;
      }

      wrap.innerHTML = rows.map(r => `
        <div class="slot-card" data-id="${r.id}">
          ${r.time}
        </div>
      `).join("");

      qa(".slot-card").forEach(c => {
        c.onclick = () => {
          qa(".slot-card").forEach(x => x.classList.remove("selected"));
          c.classList.add("selected");
          selectedSlotId = c.dataset.id;
        };
      });

    } catch (e) {
      console.error(e);
      q("#time-slots").innerHTML = "<p>Ошибка загрузки</p>";
    }
  }

  // ==========================
  // SERVICES
  // ==========================
  async function loadPublicServices() {
    const wrap = q("#services-list-user");
    wrap.innerHTML = "<p>Загрузка...</p>";

    const res = await fetch(`/api/salons/${currentSalon.id}/services`);
    const services = await res.json();

    if (!services.length) {
      wrap.innerHTML = "<p>Услуг нет</p>";
      return;
    }

    wrap.innerHTML = services.map(s => `
      <div class="service-item">
        <h3>${escapeHtml(s.name)}</h3>
        <p>Цена: ${s.price || "-"} | ${s.duration_minutes || "-"} мин</p>
        <button class="btn primary" data-id="${s.id}">Показать мастеров</button>
        <div class="service-masters" id="srv-${s.id}"></div>
      </div>
    `).join("");

    qa(".service-item button").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const target = q("#srv-" + id);

        if (target.innerHTML) {
          target.innerHTML = "";
          return;
        }

        const r = await fetch(`/api/services/${id}/masters`);
        const masters = await r.json();

        target.innerHTML = masters.map(m =>
          `<div class="master-mini" data-id="${m.id}">${m.name}</div>`
        ).join("");

        qa(".master-mini").forEach(mi => {
          mi.onclick = () => {
            currentMaster = currentSalon.masters.find(x => x.id == mi.dataset.id);
            selectedDate = null;
            selectedSlotId = null;
            buildCalendar();
            q("#time-slots").innerHTML = "<small>Выберите день</small>";
            q("#booking-modal").classList.remove("hidden");
          };
        });
      };
    });
  }

  // ==========================
  // BOOKING (NO AUTH)
  // ==========================
  q("#confirm-book").onclick = async () => {
  const name = q("#client-name").value.trim();
  const phone = q("#client-phone").value.trim();

  if (!selectedDate) return alert("Выберите день");
  if (!selectedSlotId) return alert("Выберите время");
  if (!name || !phone) return alert("Введите имя и телефон");

  const res = await fetch("/api/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schedule_id: selectedSlotId,
      client_name: name,
      client_phone: phone
    })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Ошибка");

  alert("✅ Запись принята! Мы свяжемся с вами.");
  q("#booking-modal").classList.add("hidden");

  await loadSlots(selectedDate);
};



  // ==========================
  // UI
  // ==========================
  q("#book-btn").onclick = () => q("#booking-modal").classList.remove("hidden");
  q("#booking-close").onclick = () => q("#booking-modal").classList.add("hidden");

  q("#master-select").onchange = () => {
    currentMaster = currentSalon.masters.find(m => m.id == q("#master-select").value);
    selectedDate = null;
    selectedSlotId = null;
    buildCalendar();
    q("#time-slots").innerHTML = "<small>Выберите день</small>";
  };

  



  // ==========================
  // INIT
  // ==========================
  document.addEventListener("DOMContentLoaded", () => {
    loadSalon();
    buildCalendar();
  });

})();
