/*******************************
 BROKOONS DASHBOARD – PHASE 1
 Frontend Only (Stable)
 Author: You + ChatGPT
********************************/

/* ========= GLOBAL STATE ========= */
let currentUser = null;

/* ========= USERS (TEMP) ========= */
const USERS = {
  founder: {
    username: "founder",
    password: "1234",
    role: "founder"
  },
  team: {
    username: "team",
    password: "1234",
    role: "team"
  }
};

/* ========= DOM READY ========= */
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  bindLogin();
  bindLogout();
  applyRoleRestrictions();
  fixGraphLayout();
});

/* ========= LOGIN ========= */
function bindLogin() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    for (let key in USERS) {
      const user = USERS[key];
      if (user.username === username && user.password === password) {
        currentUser = user;
        localStorage.setItem("brokoons_user", JSON.stringify(user));
        window.location.href = "dashboard.html";
        return;
      }
    }

    alert("❌ Invalid login");
  });
}

/* ========= SESSION ========= */
function checkSession() {
  const savedUser = localStorage.getItem("brokoons_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
  }
}

/* ========= LOGOUT ========= */
function bindLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("brokoons_user");
    window.location.href = "index.html";
  });
}

/* ========= ROLE CONTROL ========= */
function applyRoleRestrictions() {
  const savedUser = localStorage.getItem("brokoons_user");
  if (!savedUser) return;

  const user = JSON.parse(savedUser);

  document.querySelectorAll("[data-founder-only]").forEach(el => {
    if (user.role !== "founder") {
      el.style.display = "none";
    }
  });
}

/* ========= TEAM GRAPH FIX ========= */
function fixGraphLayout() {
  const graph = document.getElementById("teamGraph");
  if (!graph) return;

  graph.style.maxWidth = "100%";
  graph.style.height = "auto";

  window.addEventListener("resize", () => {
    graph.style.width = "100%";
  });
}

/* ========= NOTIFICATIONS (UI ONLY) ========= */
function showNotification(msg) {
  const box = document.getElementById("notificationBox");
  if (!box) return;

  box.innerText = msg;
  box.classList.add("show");

  setTimeout(() => {
    box.classList.remove("show");
  }, 3000);
}
