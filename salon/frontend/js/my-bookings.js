(async function () {
  const box = document.getElementById("box");
  const token = localStorage.getItem("client_token");


  
  if (!token) {
    box.innerHTML = `
      <p>Нет записей.</p>
      <p>Сделайте запись на сайте — и здесь появятся ваши бронирования.</p>
    `;
    return;
  }

  let res, rows;

  try {
    res = await fetch("/api/my/bookings", {
      headers: { Authorization: "Bearer " + token }
    });
    rows = await res.json();
  } catch (e) {
    box.innerHTML = `<p>Ошибка соединения с сервером</p>`;
    return;
  }

  if (res.status === 401) {
    localStorage.removeItem("client_token");
    box.innerHTML = `<p>Сессия истекла. Сделайте новую запись.</p>`;
    return;
  }

  if (!rows.length) {
    box.innerHTML = `<p>Записей пока нет.</p>`;
    return;
  }

  box.innerHTML = rows.map(r => `
    <div style="border:1px solid #ddd;padding:12px;margin-bottom:10px;border-radius:8px">
      <div><b>${r.salon_name}</b></div>
      <div>Мастер: ${r.master_name}</div>
      <div>🗓 ${r.date} ⏰ ${r.time}</div>
      <div>Статус: <b>${statusLabel(r.status)}</b></div>

      ${r.status === "pending" ? `
        <button onclick="resendCode(${r.booking_id})">
          🔁 Отправить код ещё раз
        </button>
      ` : ""}
    </div>
  `).join("");

  if (rows.some(r => r.status === "pending")) {
    setTimeout(() => location.reload(), 15000);
  }
})();

function statusLabel(s) {
  return {
    pending: "⏳ Ожидает подтверждения",
    confirmed: "✅ Подтверждена",
    visited: "✔️ Посещена",
    no_show: "❌ Не пришёл"
  }[s] || s;
}

async function resendCode(booking_id) {
  try {
    const res = await fetch("/api/book/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert("Код отправлен ещё раз");
  } catch {
    alert("Не удалось отправить код");
  }
}
