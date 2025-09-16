const API_BASE = 'http://localhost:3000';

function authHeader(){
  const t = localStorage.getItem('authToken');
  return t ? { 'Authorization': 'Bearer '+t } : {};
}
function ensureProfessor(){
  const u = JSON.parse(localStorage.getItem('user') || 'null');
  if (!u || u.Role !== 'PROFESSOR') {
    alert('Μόνο για Διδάσκοντες.');
    location.href = 'login.html';
  }
}
ensureProfessor();

const kpiEl = document.getElementById('kpi');
const timeCtx  = document.getElementById('timeChart').getContext('2d');
const gradeCtx = document.getElementById('gradeChart').getContext('2d');
const countCtx = document.getElementById('countChart').getContext('2d');

async function loadStats(){
  try{
    const res = await fetch(`${API_BASE}/professor/stats`, { headers: { ...authHeader() } });
    if(!res.ok){ throw new Error('Σφάλμα φόρτωσης'); }
    const s = await res.json();
    renderKPIs(s);
    renderCharts(s);
  }catch(e){
    console.error(e);
    alert('Αποτυχία φόρτωσης στατιστικών.');
  }
}
loadStats();

function renderKPIs(s){
  const fmtDays = (d) => Number(d||0).toFixed(1);
  const fmtGrade = (g) => Number(g||0).toFixed(2);
  kpiEl.innerHTML = `
    <span class="pill"><strong>Επιβλέπων</strong>: ${s.supervisor.total} διπλ.</span>
    <span class="pill">Μ.Χρόνος: ${fmtDays(s.supervisor.meanCompletionDays)} ημ.</span>
    <span class="pill">Μ.Βαθμός: ${fmtGrade(s.supervisor.meanGrade)}</span>

    <span class="pill"><strong>Τριμελής</strong>: ${s.committee.total} διπλ.</span>
    <span class="pill">Μ.Χρόνος: ${fmtDays(s.committee.meanCompletionDays)} ημ.</span>
    <span class="pill">Μ.Βαθμός: ${fmtGrade(s.committee.meanGrade)}</span>
  `;
}

let timeChart, gradeChart, countChart;

function renderCharts(s){
  const labels = ['Επιβλέπων', 'Τριμελής'];

  [timeChart, gradeChart, countChart].forEach(ch => ch && ch.destroy && ch.destroy());

  timeChart = new Chart(timeCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'ημέρες', data: [
        s.supervisor.meanCompletionDays || 0,
        s.committee.meanCompletionDays  || 0
      ]}]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  gradeChart = new Chart(gradeCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'βαθμός', data: [
        s.supervisor.meanGrade || 0,
        s.committee.meanGrade  || 0
      ]}]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, suggestedMax: 10 } }
    }
  });

  countChart = new Chart(countCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'πλήθος', data: [
        s.supervisor.total || 0,
        s.committee.total  || 0
      ]}]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
