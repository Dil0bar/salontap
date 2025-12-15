(function () {
  const API = "/api";
  const tokenKey = "salon_token";

  // ====== MAP ======
  let mapAdmin = null;
  let markerAdmin = null;
  let lastCoords = null;

  // ====== HELPERS ======
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>\"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function b64urlDecode(str) {
    try {
      str = str.replace(/-/g, "+").replace(/_/g, "/");
      while (str.length % 4) str += "=";
      const json = atob(str);
      return decodeURIComponent(
        json.split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
      );
    } catch {
      return null;
    }
  }

  function parseJwt(token) {
    try {
      const payload = token.split(".")[1];
      const decoded = b64urlDecode(payload);
      return decoded ? JSON.parse(decoded) : null;
    } catch {
      return null;
    }
  }

  function getToken() {
    const token = localStorage.getItem(tokenKey);
    if (!token) return null;
    const payload = parseJwt(token);
    return payload ? { token, payload } : null;
  }

  async function apiFetch(method, url, body) {
    const headers = { "Content-Type": "application/json" };
    const auth = getToken();
    if (auth) headers["Authorization"] = "Bearer " + auth.token;

    const res = await fetch(API + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("API error", method, url, data);
      throw data || { error: "API error" };
    }
    return data;
  }

  function showStatus(msg) {
    const box = $("auth-status");
    if (!box) return;
    box.textContent = msg;
    setTimeout(() => (box.textContent = ""), 2500);
  }
  function timeToMinutes(t) {
    const [hh, mm] = String(t || "00:00").split(":").map(Number);
    return (hh * 60) + (mm || 0);
  }

  function minutesToTime(mins) {
    mins = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function calcEndTime(start, durationMinutes) {
    const dur = Number(durationMinutes || 0);
    if (!dur) return "";
    return minutesToTime(timeToMinutes(start) + dur);
  }

  // ====== DOM ======
  const authSection = $("auth-section");
  const createSection = document.querySelector(".create-card");
  const adminPanel = $("admin-panel");
  const adminSalonsWrap = $("admin-salons");
  const slotsSection = $("slots-section");

  const loginForm = $("login-form");
  const registerForm = $("register-form");
  const loginBtn = $("login-btn");
  const regBtn = $("reg-btn");
  const logoutBtn = $("logout-btn");

  const nameEl = $("salon-name");
  const descEl = $("salon-desc");
  const addressEl = $("salon-address");
  const photoInput = $("salon-photo");
  const createBtn = $("create-salon");

  // ====== AUTH UI ======
  function updateAuthUI() {
    const auth = getToken();

    if (!auth) {
      if (authSection) authSection.style.display = "block";
      if (createSection) createSection.style.display = "none";
      if (adminPanel) adminPanel.style.display = "none";
      if (slotsSection) slotsSection.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "none";
      return;
    }

    if (authSection) authSection.style.display = "none";
    if (createSection) createSection.style.display = "block";
    if (adminPanel) adminPanel.style.display = "block";
    if (logoutBtn) logoutBtn.style.display = "inline-block";

    setTimeout(initYandex, 100);
    renderMySalons();
  }

  // ====== SWITCH LOGIN/REGISTER ======
  const goRegister = $("go-register");
  const goLogin = $("go-login");

  if (goRegister) goRegister.onclick = (e) => {
    e.preventDefault();
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
  };

  if (goLogin) goLogin.onclick = (e) => {
    e.preventDefault();
    if (registerForm) registerForm.style.display = "none";
    if (loginForm) loginForm.style.display = "block";
  };

  if (loginBtn) loginBtn.onclick = async () => {
    try {
      const email = $("login-email")?.value.trim();
      const password = $("login-password")?.value;
      const r = await apiFetch("POST", "/login", { email, password });
      localStorage.setItem(tokenKey, r.token);
      updateAuthUI();
      showStatus("✅ Вы вошли");
    } catch {
      showStatus("❌ Ошибка входа");
    }
  };

  if (regBtn) regBtn.onclick = async () => {
    try {
      const email = $("reg-email")?.value.trim();
      const password = $("reg-password")?.value;
      const r = await apiFetch("POST", "/signup", { email, password });
      localStorage.setItem(tokenKey, r.token);
      updateAuthUI();
      showStatus("✅ Аккаунт создан");
    } catch {
      showStatus("❌ Ошибка регистрации");
    }
  };

  if (logoutBtn) logoutBtn.onclick = () => {
    localStorage.removeItem(tokenKey);
    location.reload();
  };

  // ====== CATEGORIES (create salon) ======
  const categoryContainer = document.querySelector(".svc-categories");
  let selectedCategories = [];

  function toggleCategoryClick(e) {
    const span = e.currentTarget;
    const val = span.dataset.cat;
    if (!val) return;

    span.classList.toggle("active");
    if (span.classList.contains("active")) {
      if (!selectedCategories.includes(val)) selectedCategories.push(val);
    } else {
      selectedCategories = selectedCategories.filter((c) => c !== val);
    }
  }

  if (categoryContainer) {
    categoryContainer.querySelectorAll("span[data-cat]")
      .forEach((span) => span.addEventListener("click", toggleCategoryClick));
  }

  window.addCategory = function () {
  const key = $("newCatKey")?.value.trim();
  const title = $("newCatTitle")?.value.trim();
  const itemsRaw = $("newCatItems")?.value.trim();

  if (!key || !title || !itemsRaw) {
    return alert("Заполните key, название и состав");
  }

  const items = itemsRaw.split(",").map(i => i.trim()).filter(Boolean);

  const block = document.createElement("div");
  block.className = "category-block";

  block.innerHTML = `
    <div class="category-title">${title}</div>
    <div class="category-items">
      ${items.map(item => `
        <button
          type="button"
          class="category-chip"
          data-key="${key}"
          data-title="${title}"
          data-items="${items.join(", ")}"
        >
          ${item}
        </button>
      `).join("")}
    </div>
  `;

  const wrap = document.getElementById("categories-wrap");
  wrap.appendChild(block);

  // навешиваем клики
  block.querySelectorAll(".category-chip").forEach(btn => {
    btn.onclick = () => {
      wrap.querySelectorAll(".category-chip")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      window.selectedCategoryKey = btn.dataset.key;
    };
  });

  // очистка
  $("newCatKey").value = "";
  $("newCatTitle").value = "";
  $("newCatItems").value = "";
};


  // ====== PHOTO ======
  let pendingPhoto = null;
  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => (pendingPhoto = reader.result);
      reader.readAsDataURL(f);
    });
  }

  // ====== CREATE SALON ======
  if (createBtn) createBtn.onclick = async () => {
    const auth = getToken();
    if (!auth) return alert("Сначала войдите в аккаунт");

    const name = nameEl?.value.trim();
    if (!name) return alert("Введите название салона");
    if (!lastCoords) return alert("Укажите адрес салона на карте");

    const payload = {
      name,
      address: addressEl?.value.trim() || "",
      short_desc: descEl?.value.trim() || "",
      full_desc: descEl?.value.trim() || "",
      categories: [...new Set(selectedCategories)],
      lat: lastCoords[0],
      lng: lastCoords[1],
      photos: pendingPhoto ? [pendingPhoto] : []
    };

    try {
      await apiFetch("POST", "/salons", payload);

      // reset form
      if (nameEl) nameEl.value = "";
      if (descEl) descEl.value = "";
      if (addressEl) addressEl.value = "";
      pendingPhoto = null;

      selectedCategories = [];
      categoryContainer?.querySelectorAll("span[data-cat]")
        ?.forEach(s => s.classList.remove("active"));

      showStatus("✅ Салон создан");
      await renderMySalons();
    } catch (e) {
      console.error(e);
      if (e?.error === "Forbidden") alert("❌ Нет роли salon_admin");
      else alert("Ошибка создания салона");
    }
  };
  

  // ====== RENDER MY SALONS ======
  async function renderMySalons() {
    if (!adminSalonsWrap) return;

    try {
      const salons = await apiFetch("GET", "/admin/my-salons");

      if (!salons.length) {
        adminSalonsWrap.innerHTML = "<p>У вас пока нет салона</p>";
        return;
      }

      adminSalonsWrap.innerHTML = salons.map((s) => `
        <div class="salon-block" data-salon-id="${s.id}">
          <h3>${escapeHtml(s.name)}</h3>
          <p>${escapeHtml(s.short_desc || "")}</p>
          <p><b>Адрес:</b> ${escapeHtml(s.address || "—")}</p>

          <button type="button" class="btn secondary js-toggle-manage" data-salon-id="${s.id}">
            Управлять салоном
          </button>

          <div class="salon-manage" id="manage-${s.id}" style="display:none; margin-top:16px;">

            <h4>Услуги</h4>

              <div class="service-create" style="display:flex; flex-direction:column; gap:10px; max-width:520px;">

                <input id="serviceName-${s.id}" placeholder="Название услуги">

                <div style="display:flex; gap:8px;">
                  <input id="servicePrice-${s.id}" type="number" placeholder="Цена, сум">
                  <input id="serviceDuration-${s.id}" type="number" placeholder="Длительность (мин)">
                </div>

                <!-- КАТЕГОРИЯ -->
                <label><b>Категория</b></label>
                <input
                  id="serviceCategory-${s.id}"
                  list="categoryList-${s.id}"
                  placeholder="Выберите категорию">
                <datalist id="categoryList-${s.id}"></datalist>

                <!-- МАСТЕРА -->
                <label><b>Мастера (через запятую)</b></label>
                <label><b>Мастера</b></label>
                  <div id="serviceMasters-${s.id}" class="service-masters-checkboxes">
                    <small style="opacity:.7">Выберите мастеров</small>
                  </div>

                <button class="btn" data-add-service="${s.id}">
                  Добавить услугу
                </button>
              </div>

              <ul id="servicesList-${s.id}" style="margin-top:10px;"></ul>


            <h4>Мастера</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <input id="masterName-${s.id}" placeholder="Имя мастера">
              <button type="button" class="btn" data-add-master="${s.id}">Добавить мастера</button>
            </div>
            <ul id="mastersList-${s.id}" style="margin-top:10px;"></ul>

            <hr>

            <h4>Слоты записи</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <select id="masterSelect-${s.id}"></select>
              <select id="serviceSelect-${s.id}"></select>
              <input type="date" id="slotDate-${s.id}">
              <input type="time" id="slotTime-${s.id}">
              <button type="button" class="btn" data-add-slot="${s.id}">➕ Добавить слот</button>
            </div>

            <table border="1" width="100%" style="margin-top:10px;">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Время</th>
                  <th>Услуга</th>
                  <th>Мастер</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="slotsTable-${s.id}"></tbody>
            </table>

          </div>
        </div>
      `).join("");

    } catch (e) {
      console.error(e);
      adminSalonsWrap.innerHTML = "<p>Ошибка загрузки салонов (проверь роль salon_admin).</p>";
    }
  }
  

window.selectedCategoryKeys = [];

function loadCategories() {
  const wrap = document.getElementById("categories-wrap");
  if (!wrap) return;

  fetch("/api/categories")
    .then(r => r.json())
    .then(categories => {
      wrap.innerHTML = categories.map(cat => `
        <div class="category-row">
          <button
            type="button"
            class="category-btn"
            data-key="${cat.key}"
          >
            ${cat.title}
          </button>

          <div class="category-hint">
            ${cat.items.join(", ")}
          </div>
        </div>
      `).join("");

      wrap.querySelectorAll(".category-btn").forEach(btn => {
        btn.onclick = () => {
          const key = btn.dataset.key;

          btn.classList.toggle("active");

          if (btn.classList.contains("active")) {
            if (!window.selectedCategoryKeys.includes(key)) {
              window.selectedCategoryKeys.push(key);
            }
          } else {
            window.selectedCategoryKeys =
              window.selectedCategoryKeys.filter(k => k !== key);
          }

          console.log("Выбраны категории:", window.selectedCategoryKeys);
        };
      });
    });
}

function clearActive() {
  document.querySelectorAll(
    ".category-title, .category-chip"
  ).forEach(el => el.classList.remove("active"));
}



  
  // ====== OPEN/CLOSE MANAGE + LOAD DATA ======
  async function toggleSalonManage(salonId, btn) {
    const box = document.getElementById("manage-" + salonId);
    if (!box) return;

    // close other
    document.querySelectorAll(".salon-manage").forEach(b => {
      if (b.id !== "manage-" + salonId) b.style.display = "none";
    });

    const isOpen = box.style.display === "block";
    box.style.display = isOpen ? "none" : "block";
    if (btn) btn.textContent = isOpen ? "Управлять салоном" : "Скрыть управление";
    if (isOpen) return;

    await refreshSalonUI(salonId);
    await loadCategories();
  }


  async function refreshSalonUI(salonId) {
    // ВАЖНО: эти ручки должны существовать на бэке:
    // GET /api/salons/:id
    // GET /api/salons/:id/services
    const data = await apiFetch("GET", `/salons/${salonId}`);
    const services = await apiFetch("GET", `/salons/${salonId}/services`);

    const masters = data.masters || [];

    renderServicesInline(salonId, services);
    renderMastersInline(salonId, masters);

    renderServiceMastersCheckboxes(salonId, masters);


    const categories = await apiFetch("GET", "/categories");
    renderServiceCategories(salonId, categories);

    

    // default selects
    const ms = document.getElementById(`masterSelect-${salonId}`);
    const ss = document.getElementById(`serviceSelect-${salonId}`);

    if (ms && masters.length) ms.value = String(masters[0].id);
    if (ss && services.length) ss.value = String(services[0].id);

    // load slots for first master
    if (masters.length) await loadSlotsInline(salonId, masters[0].id);

    // when master changes -> load slots (and optionally filter services later)
    if (ms) {
      ms.onchange = async () => {
        const mid = ms.value;
        if (mid) await loadSlotsInline(salonId, mid);
      };
    }
  }

function renderServiceCategories(salonId, categories) {
  const list = document.getElementById(`categoryList-${salonId}`);
  if (!list) return;

  list.innerHTML = categories.map(c =>
    `<option value="${c.key}">${c.title}</option>`
  ).join("");
}



  function renderServicesInline(salonId, services) {
    const ul = document.getElementById(`servicesList-${salonId}`);
    const sel = document.getElementById(`serviceSelect-${salonId}`);
    if (!ul || !sel) return;

    ul.innerHTML = services.length
      ? services.map(s => `
          <li style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div>
              <b>${escapeHtml(s.name)}</b>
              ${s.price ? ` — ${escapeHtml(s.price)} сум` : ""}
              ${s.duration_minutes ? ` • ${escapeHtml(s.duration_minutes)} мин` : ""}
            </div>
            <button type="button" class="btn danger" data-del-service="${s.id}" data-salon-id="${salonId}" style="padding:6px 10px;">
              ✖
            </button>
          </li>
        `).join("")
      : "<li>Пока нет услуг</li>";

    sel.innerHTML = services.map(s =>
      `<option value="${s.id}">${escapeHtml(s.name)}${s.duration_minutes ? ` (${s.duration_minutes} мин)` : ""}</option>`
    ).join("");
  }

  function renderMastersInline(salonId, masters) {
    const ul = document.getElementById(`mastersList-${salonId}`);
    const sel = document.getElementById(`masterSelect-${salonId}`);
    if (!ul || !sel) return;

    ul.innerHTML = masters.length
      ? masters.map(m => `
          <li style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div>${escapeHtml(m.name)}</div>
            <button type="button" class="btn danger" data-del-master="${m.id}" data-salon-id="${salonId}" style="padding:6px 10px;">
              ✖
            </button>
          </li>
        `).join("")
      : "<li>Пока нет мастеров</li>";

    sel.innerHTML = masters.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
  }

  async function loadSlotsInline(salonId, masterId) {
    const tbody = document.getElementById(`slotsTable-${salonId}`);
    if (!tbody) return;

    const rows = await apiFetch("GET", `/masters/${masterId}/schedule/full`);

    tbody.innerHTML = (rows || []).map(r => {
      const end = calcEndTime(r.time, r.duration_minutes);
      const timeText = end ? `${escapeHtml(r.time)} – ${escapeHtml(end)}` : `${escapeHtml(r.time)}`;

      return `
        <tr>
          <td>${escapeHtml(r.date)}</td>
          <td>${timeText}</td>
          <td>
            <div style="font-weight:600;">${escapeHtml(r.service_name || "")}</div>
            ${r.service_price ? `<div style="opacity:.75; font-size:13px;">${escapeHtml(r.service_price)} сум</div>` : ""}
            ${r.duration_minutes ? `<div style="opacity:.75; font-size:13px;">${escapeHtml(r.duration_minutes)} мин</div>` : ""}
          </td>
          <td>${escapeHtml(r.master_name || "")}</td>
          <td>${r.is_blocked ? "⛔ Заблокирован" : (r.is_taken ? "✅ Занят" : "🟢 Свободен")}</td>
          <td>
            <button type="button" class="btn danger" style="padding:6px 10px;" data-del-slot="${r.id}" data-salon-id="${salonId}" data-master-id="${masterId}">
              ✖
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function loadServiceInputs(salonId) {

  // ===== КАТЕГОРИИ =====
  const catList = document.getElementById(`categoryList-${salonId}`);
  catList.innerHTML = '';

  const categories = await fetch(`/api/categories?salon_id=${salonId}`)
    .then(r => r.json());

  categories.forEach(c => {
    catList.insertAdjacentHTML(
      'beforeend',
      `<option value="${c.name}" data-id="${c.id}"></option>`
    );
  });

  // ===== МАСТЕРА =====
  const mastersList = document.getElementById(`mastersList-${salonId}`);
  mastersList.innerHTML = '';

  const masters = await fetch(`/api/masters?salon_id=${salonId}`)
    .then(r => r.json());

  masters.forEach(m => {
    mastersList.insertAdjacentHTML(
      'beforeend',
      `<option value="${m.name}" data-id="${m.id}"></option>`
    );
  });
}


function renderServiceMastersCheckboxes(salonId, masters) {
  const box = document.getElementById(`serviceMasters-${salonId}`);
  if (!box) return;

  selectedMasters = [];

  if (!masters.length) {
    box.innerHTML = "<small>Сначала добавьте мастеров</small>";
    return;
  }

  box.innerHTML = masters.map(m => `
    <label class="master-checkbox">
      <input type="checkbox" name="service-master" value="${m.id}">
      ${escapeHtml(m.name)}
    </label>
  `).join("");

  box.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = Number(cb.value);
      if (cb.checked) {
        if (!selectedMasters.includes(id)) {
          selectedMasters.push(id);
        }
      } else {
        selectedMasters = selectedMasters.filter(x => x !== id);
      }
    });
  });
}




  // ====== CLICK HANDLER (event delegation) ======
  document.addEventListener("click", async (e) => {
    try {
      // toggle manage
      const toggleBtn = e.target.closest(".js-toggle-manage");
      if (toggleBtn) {
        const salonId = Number(toggleBtn.dataset.salonId);
        await toggleSalonManage(salonId, toggleBtn);
        return;
      }

      if (e.target.closest("#close-bookings")) {
          document.getElementById("bookings-modal").style.display = "none";
        }

        if (e.target.classList.contains("modal-overlay")) {
          e.target.style.display = "none";
        }

      // add service
      const addServiceBtn = e.target.closest("[data-add-service]");
        if (addServiceBtn) {
          const salonId = Number(addServiceBtn.dataset.addService);

          const name =
            document.getElementById(`serviceName-${salonId}`).value.trim();

          const price =
            document.getElementById(`servicePrice-${salonId}`).value || null;

          const duration_minutes =
            document.getElementById(`serviceDuration-${salonId}`).value || null;

          if (!name) return alert("Введите название услуги");

            const categoryInput = document.getElementById(`serviceCategory-${salonId}`);
            const category = categoryInput ? categoryInput.value.trim() : "";


          if (!category) return alert("Выберите категорию");

          const checkedMasters = Array.from(
            document.querySelectorAll(
              `#manage-${salonId} input[name="service-master"]:checked`
            )
          ).map(cb => Number(cb.value));

          if (!checkedMasters.length) {
            return alert("Выберите хотя бы одного мастера");
}


          // 🚀 один запрос
          await apiFetch("POST", "/services", {
            salon_id: salonId,
            name,
            price,
            duration_minutes,
            category,
            masters: checkedMasters  
          });

          await refreshSalonUI(salonId);
          showStatus("✅ Услуга создана");
          return;
}


      // delete service
      const delServiceBtn = e.target.closest("[data-del-service]");
      if (delServiceBtn) {
        const serviceId = Number(delServiceBtn.dataset.delService);
        const salonId = Number(delServiceBtn.dataset.salonId);
        if (!confirm("Удалить услугу?")) return;

        await apiFetch("DELETE", `/services/${serviceId}`);
        await refreshSalonUI(salonId);
        showStatus("✅ Услуга удалена");
        return;
      }

      // add master
      const addMasterBtn = e.target.closest("[data-add-master]");
      if (addMasterBtn) {
        const salonId = addMasterBtn.dataset.addMaster;
        const input = document.getElementById(`masterName-${salonId}`);
        const name = input?.value.trim();
        if (!name) return alert("Введите имя мастера");

        await apiFetch("POST", `/salons/${salonId}/masters`, { name });
        if (input) input.value = "";

        await refreshSalonUI(Number(salonId));
        showStatus("✅ Мастер добавлен");
        return;
      }

      // delete master
      const delMasterBtn = e.target.closest("[data-del-master]");
      if (delMasterBtn) {
        const masterId = Number(delMasterBtn.dataset.delMaster);
        const salonId = Number(delMasterBtn.dataset.salonId);
        if (!confirm("Удалить мастера?")) return;

        await apiFetch("DELETE", `/masters/${masterId}`);
        await refreshSalonUI(salonId);
        showStatus("✅ Мастер удалён");
        return;
      }

      // add slot
      const addSlotBtn = e.target.closest("[data-add-slot]");
      if (addSlotBtn) {
        const salonId = addSlotBtn.dataset.addSlot;

        const ms = document.getElementById(`masterSelect-${salonId}`);
        const ss = document.getElementById(`serviceSelect-${salonId}`);
        const d = document.getElementById(`slotDate-${salonId}`);
        const t = document.getElementById(`slotTime-${salonId}`);

        const masterId = ms?.value;
        const serviceId = ss?.value;
        const date = d?.value;
        const time = t?.value;

        if (!masterId || !serviceId) return alert("Выберите мастера и услугу");
        if (!date || !time) return alert("Укажите дату и время");

        await apiFetch("POST", `/masters/${masterId}/schedule`, {
          service_id: Number(serviceId),
          slots: [{ date, time }]
        });

        await loadSlotsInline(Number(salonId), masterId);
        showStatus("✅ Слот добавлен");
        return;
      }

      // delete slot
      const delSlotBtn = e.target.closest("[data-del-slot]");
      if (delSlotBtn) {
        const slotId = Number(delSlotBtn.dataset.delSlot);
        const salonId = Number(delSlotBtn.dataset.salonId);
        const masterId = delSlotBtn.dataset.masterId;

        if (!confirm("Удалить слот?")) return;

        await apiFetch("DELETE", `/schedule/${slotId}`);
        await loadSlotsInline(salonId, masterId);
        showStatus("✅ Слот удалён");
        return;
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка. Открой Console (F12) и пришли текст ошибки.");
    }
  });

  // ====== YANDEX MAP ======
  function initYandex() {
    const mapDiv = $("map-admin");
    if (!mapDiv) return;
    if (typeof ymaps === "undefined") {
      console.warn("ymaps is undefined — карта не загрузилась");
      return;
    }

    ymaps.ready(() => {
      const center = [41.311081, 69.240562];

      mapAdmin = new ymaps.Map("map-admin", { center, zoom: 12 });

      markerAdmin = new ymaps.Placemark(center, {}, { draggable: true });
      mapAdmin.geoObjects.add(markerAdmin);
      lastCoords = center;

      markerAdmin.events.add("dragend", async () => {
        const coords = markerAdmin.geometry.getCoordinates();
        lastCoords = coords;
        if (addressEl) addressEl.value = await reverseGeocode(coords);
      });

      mapAdmin.events.add("click", async (e) => {
        const coords = e.get("coords");
        lastCoords = coords;
        markerAdmin.geometry.setCoordinates(coords);
        if (addressEl) addressEl.value = await reverseGeocode(coords);
      });

      setupSuggest();
    });
  }

  function setupSuggest() {
    const inputId = "salon-address";
    try {
      const sv = new ymaps.SuggestView(inputId);
      sv.events.add("select", (e) => {
        const value = e.get("item").value;
        ymaps.geocode(value).then((res) => {
          const obj = res.geoObjects.get(0);
          if (!obj) return;
          const coords = obj.geometry.getCoordinates();
          lastCoords = coords;
          markerAdmin.geometry.setCoordinates(coords);
          mapAdmin.setCenter(coords, 16);
        });
      });
    } catch (e) {
      console.warn("SuggestView error", e);
    }
  }

  async function reverseGeocode(coords) {
    const res = await ymaps.geocode(coords);
    const obj = res.geoObjects.get(0);
    return obj ? obj.getAddressLine() : "";
  }

  // ====== START ======
  document.addEventListener("DOMContentLoaded", () => {
    updateAuthUI();
    loadCategories(); 

  });

})();
