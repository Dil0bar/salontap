const rows = await apiFetch("GET", `/masters/${myMasterId}/schedule/full`);

rows.forEach(r => {
  // дата, клиент, услуга
});

const stats = await apiFetch("GET", `/salons/${currentSalonId}/stats`);
document.getElementById("stats").innerHTML =
  stats.map(s => `<li>${s.name}: ${s.total}</li>`).join("");
