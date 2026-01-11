/***********************
 BROKOONS DASHBOARD
 CLEAN WORKING app.js
***********************/

// prevent double load
if (window.appAlreadyLoaded) {
  console.warn("App already loaded");
} else {
  window.appAlreadyLoaded = true;
}

/* =====================
   SUPABASE CONFIG
===================== */
const SUPABASE_URL = "https://dmrghgbbsvqlqmzuvbpb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcmdoZ2Jic3ZxbHFtenV2YnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNDUxNTgsImV4cCI6MjA1MTgyMTE1OH0.PGih7eEJ-Vf9XY47Ck9Moi3pSWerM6d61_JSPxImsIw";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =====================
   USERS
===================== */
const USERS = {
  midhun: "1977",
  akash: "2024",
  sajad: "5550",
  saran: "2244",
  muhammad: "1415",
};

/* =====================
   AUTH
===================== */
function login() {
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value.trim();

  if (USERS[u] && USERS[u] === p) {
    localStorage.setItem("brokoons_auth", "true");
    localStorage.setItem("brokoons_user", u);
    showNotification(`Welcome ${u}`, "success");
    initApp();
  } else {
    showNotification("Invalid login", "error");
  }
}

function logout() {
  localStorage.clear();
  location.reload();
}

/* =====================
   INIT
===================== */
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("brokoons_auth") === "true") {
    initApp();
  } else {
    showLogin();
  }
});

function showLogin() {
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("mainContent").style.display = "none";
}

function initApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("currentUser").textContent =
    localStorage.getItem("brokoons_user");

  showTab("dashboard");
  loadStock();
  loadPhotos();
  loadTasks();
  loadTeam();
}

/* =====================
   TABS
===================== */
function showTab(tab) {
  document.querySelectorAll(".tab-content").forEach((t) =>
    t.classList.remove("active")
  );
  document.getElementById(tab + "-tab").classList.add("active");
}

/* =====================
   NOTIFICATION
===================== */
function showNotification(msg, type = "info") {
  const n = document.createElement("div");
  n.className = `toast ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

/* =====================
   STOCK
===================== */
async function loadStock() {
  const { data } = await supabase.from("stock_items").select("*");
  const list = document.getElementById("stockList");
  if (!list) return;
  list.innerHTML = "";
  data?.forEach((i) => {
    list.innerHTML += `<li>${i.name} - ${i.qty}</li>`;
  });
}

async function addStock(name, qty) {
  await supabase.from("stock_items").insert([{ name, qty }]);
  loadStock();
}

/* =====================
   PHOTOS
===================== */
async function uploadPhoto(file) {
  const fileName = Date.now() + "_" + file.name;
  await supabase.storage.from("photos").upload(fileName, file);
  await supabase.from("photos").insert([{ file: fileName }]);
  loadPhotos();
}

async function loadPhotos() {
  const { data } = await supabase.from("photos").select("*");
  const box = document.getElementById("photoGallery");
  if (!box) return;
  box.innerHTML = "";
  data?.forEach((p) => {
    const url = supabase.storage.from("photos").getPublicUrl(p.file).data
      .publicUrl;
    box.innerHTML += `<img src="${url}" />`;
  });
}

/* =====================
   TASKS
===================== */
async function loadTasks() {
  const { data } = await supabase.from("tasks").select("*");
  const box = document.getElementById("taskList");
  if (!box) return;
  box.innerHTML = "";
  data?.forEach((t) => {
    box.innerHTML += `<li>${t.task}</li>`;
  });
}

async function addTask(task) {
  await supabase.from("tasks").insert([{ task }]);
  loadTasks();
}

/* =====================
   TEAM
===================== */
async function loadTeam() {
  const { data } = await supabase.from("team_members").select("*");
  const box = document.getElementById("teamList");
  if (!box) return;
  box.innerHTML = "";
  data?.forEach((m) => {
    box.innerHTML += `<li>${m.name} - ${m.role}</li>`;
  });
}

/* =====================
   EXPORT
===================== */
async function exportStockCSV() {
  const { data } = await supabase.from("stock_items").select("*");
  let csv = "Name,Qty\n";
  data.forEach((r) => (csv += `${r.name},${r.qty}\n`));
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stock.csv";
  a.click();
}
