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

      // ✅ важно: после того как мастер выбран
      buildCalendar();
      q("#time-slots").innerHTML = "<small>Выберите день</small>";

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
    if (gallery) {
      gallery.innerHTML =
        currentSalon.photos?.length
          ? currentSalon.photos.map(p => `<img src="${p}">`).join("")
          : `<img src="assets/sample.jpg">`;
    }

    // masters cards (если есть)
    const mastersWrap = q("#masters");
    if (mastersWrap) {
      mastersWrap.innerHTML = (currentSalon.masters || []).map(m => `
        <div class="master" data-id="${m.id}">
          <img src="${m.photo || "assets/avatar.png"}">
          <div class="meta"><strong>${escapeHtml(m.name)}</strong></div>
        </div>
      `).join("");
    }

    // master select
    const sel = q("#master-select");
    if (sel) {
      sel.innerHTML = (currentSalon.masters || []).map(m =>
        `<option value="${m.id}">${escapeHtml(m.name)}</option>`
      ).join("");

      currentMaster = currentSalon.masters?.[0] || null;
      if (currentMaster) sel.value = String(currentMaster.id);

      // ✅ смена мастера -> сброс выбора и календарь заново
      sel.onchange = () => {
        const mid = Number(sel.value);
        currentMaster = currentSalon.masters.find(m => m.id === mid) || null;
        selectedDate = null;
        selectedSlotId = null;
        buildCalendar();
        q("#time-slots").innerHTML = "<small>Выберите день</small>";
      };
    } else {
      // если селекта нет — всё равно ставим первого мастера
      currentMaster = currentSalon.masters?.[0] || null;
    }
  }

  // ==========================
  // MAP
  // ==========================
  function initSalonMap() {
    if (!currentSalon?.lat || !currentSalon?.lng) return;
    if (typeof ymaps === "undefined") return;

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
    if (!cal) return;

    cal.innerHTML = "";

    // если нет мастера — нечего строить
    if (!currentMaster) {
      cal.innerHTML = "<small>Нет мастеров для записи</small>";
      return;
    }

    const now = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const iso = d.toISOString().slice(0, 10);

      const el = document.createElement("div");
      el.className = "day-card";
      el.dataset.date = iso;
      el.innerHTML = `
        <div class="day-num">${d.getDate()}</div>
        <div class="day-week">${d.toLocaleDateString("ru-RU", { weekday: "short" })}</div>
      `;

      el.addEventListener("click", async () => {
        qa(".day-card").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");

        selectedDate = iso;
        selectedSlotId = null;

        const ts = q("#time-slots");
        if (ts) ts.innerHTML = "<p>Загрузка...</p>";

        await loadSlots(iso);
      });

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
      if (!wrap) return;

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
        c.addEventListener("click", () => {
          qa(".slot-card").forEach(x => x.classList.remove("selected"));
          c.classList.add("selected");
          selectedSlotId = c.dataset.id;
        });
      });

    } catch (e) {
      console.error(e);
      const wrap = q("#time-slots");
      if (wrap) wrap.innerHTML = "<p>Ошибка загрузки</p>";
    }
  }

  // ==========================
  // SERVICES (public)
  // ==========================
  async function loadPublicServices() {
    const wrap = q("#services-list-user");
    if (!wrap) return;

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
        <button class="btn primary" data-id="${s.id}">Выбрать услугу</button>
        <div class="service-masters" id="srv-${s.id}"></div>
      </div>
    `).join("");

    qa(".service-item button").forEach(btn => {
      btn.addEventListener("click", async () => {
        const serviceId = btn.dataset.id;
        const target = q("#srv-" + serviceId);
        if (!target) return;

        target.innerHTML = "<small>Загрузка мастеров...</small>";

        const r = await fetch(`/api/services/${serviceId}/masters`);
        const masters = await r.json();

        if (!masters.length) {
          target.innerHTML = "<small>Мастера не найдены</small>";
          return;
        }

        target.innerHTML = masters.map(m => `
          <div class="master-mini">
            👤 ${escapeHtml(m.name)}
            <button class="btn small" data-master="${m.id}">Выбрать</button>
          </div>
        `).join("");

        target.querySelectorAll("button").forEach(b => {
          b.addEventListener("click", () => {
            currentMaster = masters.find(m => m.id == b.dataset.master) || null;

            selectedDate = null;
            selectedSlotId = null;

            buildCalendar();
            q("#time-slots").innerHTML = "<small>Выберите день</small>";
            q("#booking-modal")?.classList.remove("hidden");
          });
        });
      });
    });
  }

  // ==========================
  // INIT
  // ==========================
  document.addEventListener("DOMContentLoaded", () => {

    // UI open/close modal (✅ внутри DOMContentLoaded)
    q("#book-btn")?.addEventListener("click", () => {
      q("#booking-modal")?.classList.remove("hidden");
    });

    q("#booking-close")?.addEventListener("click", () => {
      q("#booking-modal")?.classList.add("hidden");
    });

    // confirm booking
    q("#confirm-book")?.addEventListener("click", async () => {
      const nameEl = q("#client-name");
      const phoneEl = q("#client-phone");

      const name = (nameEl?.value || "").trim();
      const phone = (phoneEl?.value || "").trim();

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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "Ошибка");

      alert("✅ Запись принята! Мы свяжемся с вами.");
      q("#booking-modal")?.classList.add("hidden");

      await loadSlots(selectedDate);
    });

    // загружаем салон (после навешивания событий)
    loadSalon();
  });

})();
