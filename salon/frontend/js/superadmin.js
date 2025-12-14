const API = "/api";
const TOKEN_KEY = "salon_token";

/* ================= HELPERS ================= */

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function api(url, options = {}) {
  options.headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + getToken()
  };

  const res = await fetch(url, options);

  if (res.status === 401 || res.status === 403) {
    alert("Доступ запрещён. Войдите заново.");
    localStorage.removeItem(TOKEN_KEY);
    location.href = "/login.html";
    return;
  }

  return res.json();
}

/* ================= USERS ================= */

async function loadUsers() {
  const users = await api(API + "/admin/users");
  if (!users) return;

  document.getElementById("users").innerHTML =
    `<tr>
      <th>ID</th><th>Email</th><th>Role</th><th></th>
    </tr>` +
    users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.email}</td>
        <td>
          <select class="js-role" data-id="${u.id}">
            ${["client","salon_admin","master"].map(r =>
              `<option value="${r}" ${u.role===r?"selected":""}>${r}</option>`
            ).join("")}
          </select>
        </td>
        <td>
          <button class="js-del-user" data-id="${u.id}">🗑</button>
        </td>
      </tr>
    `).join("");
}

async function changeRole(id, role) {
  await api(`/api/admin/users/${id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role })
  });
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm("Удалить пользователя?")) return;
  await api(`/api/admin/users/${id}`, { method: "DELETE" });
  loadUsers();
}

/* ================= SALONS ================= */

async function loadSalons() {
  const salons = await api("/api/admin/salons");
  window._salons = salons;

  document.getElementById("salons").innerHTML =
    `<tr>
      <th>ID</th>
      <th>Название</th>
      <th>Владелец</th>
      <th>Адрес</th>
      <th>Категории</th>
      <th></th>
    </tr>` +
    salons.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>${s.owner_email}</td>
        <td>
          <a href="#" class="js-map" data-id="${s.id}">
            ${s.address || "Показать"}
          </a>
        </td>
        <td>${(s.categories || []).join(", ")}</td>
        <td>
          <button class="js-del-salon" data-id="${s.id}">🗑</button>
        </td>
      </tr>
    `).join("");
}

async function deleteSalon(id) {
  if (!confirm("Удалить салон полностью?")) return;
  await api(`/api/admin/salons/${id}`, { method: "DELETE" });
  loadSalons();
}

/* ================= BOOKINGS ================= */

async function loadBookings() {
  const rows = await api(API + "/admin/bookings");
  if (!rows) return;

  document.getElementById("bookings").innerHTML =
    `<tr>
      <th>Салон</th>
      <th>Мастер</th>
      <th>Услуга</th>
      <th>Дата</th>
      <th>Клиент</th>
      <th></th>
    </tr>` +
    rows.map(b => `
      <tr>
        <td>${b.salon_name}</td>
        <td>${b.master_name}</td>
        <td>
          <b>${b.service_name}</b><br>
          <small>${b.service_price ? b.service_price + " сум" : ""}</small>
        </td>
        <td>${b.date} ${b.time}</td>
        <td>${b.client_name}<br>${b.client_phone}</td>
        <td>
          <button class="js-del-booking" data-id="${b.booking_id}">❌</button>
        </td>
      </tr>
    `).join("");
}

async function deleteBooking(id) {
  if (!confirm("Удалить запись?")) return;
  await api(`/api/admin/bookings/${id}`, { method: "DELETE" });
  loadBookings();
}

/* ================= MAP ================= */

function openMap(salon) {
  document.getElementById("mapTitle").innerText =
    salon.name + " — " + (salon.address || "");

  let mapUrl;

  if (salon.lat && salon.lng) {
    mapUrl = `https://yandex.uz/map-widget/v1/?ll=${salon.lng},${salon.lat}&z=16&pt=${salon.lng},${salon.lat},pm2rdm`;
  } else {
    mapUrl = `https://yandex.uz/map-widget/v1/?text=${encodeURIComponent(salon.address || salon.name)}&z=16`;
  }

  document.getElementById("mapFrame").src = mapUrl;
  document.getElementById("mapModal").classList.remove("hidden");
}

function closeMap() {
  document.getElementById("mapModal").classList.add("hidden");
  document.getElementById("mapFrame").src = "";
}

/* ================= EVENTS (CSP SAFE) ================= */

document.addEventListener("click", (e) => {
  const delUser = e.target.closest(".js-del-user");
  if (delUser) return deleteUser(delUser.dataset.id);

  const delSalon = e.target.closest(".js-del-salon");
  if (delSalon) return deleteSalon(delSalon.dataset.id);

  const delBooking = e.target.closest(".js-del-booking");
  if (delBooking) return deleteBooking(delBooking.dataset.id);

  const mapBtn = e.target.closest(".js-map");
  if (mapBtn) {
    const salon = window._salons.find(s => s.id == mapBtn.dataset.id);
    if (salon) openMap(salon);
  }
});

document.addEventListener("change", (e) => {
  const sel = e.target.closest(".js-role");
  if (sel) changeRole(sel.dataset.id, sel.value);
});

/* ================= INIT ================= */

loadUsers();
loadSalons();
loadBookings();
