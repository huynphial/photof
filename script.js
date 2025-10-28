let CONFIG = {
  title: "Default Title",
  total_pages: 1,
  api_url: "",
};

let REPO_LIST = [];
let CURRENT_REPO = null;

/* ======================= LOAD DANH SÁCH REPO ======================= */
async function loadRepoList() {
  const repoSelect = document.getElementById("repoSelect");
  repoSelect.innerHTML = "<option>Đang tải...</option>";

  try {
    const res = await fetch("list.csv?_=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    const rows = text.trim().split("\n");

    const headers = rows[0].replace(/\uFEFF/g, "").split("|").map(x => x.trim());
    const nameIdx = headers.indexOf("name");
    const titleIdx = headers.indexOf("title");
    const maxPageIdx = headers.indexOf("max_page");
    const urlIdx = headers.indexOf("url");

    REPO_LIST = rows.slice(1).map(line => {
      const cols = line.split("|").map(c => c.trim());
      return {
        name: cols[nameIdx],
        title: cols[titleIdx],
        max_page: parseInt(cols[maxPageIdx]),
        url: cols[urlIdx].replace(/\/+$/, ""), // bỏ dấu / cuối
      };
    });

    // Xác định repo hiện tại từ URL
    const params = new URLSearchParams(window.location.search);
    const repoName = params.get("repo") || REPO_LIST[0]?.name;
    CURRENT_REPO = REPO_LIST.find(r => r.name === repoName) || REPO_LIST[0];

    // Hiển thị danh sách trong combo box
    repoSelect.innerHTML = "";
    REPO_LIST.forEach(repo => {
      const opt = document.createElement("option");
      opt.value = repo.name;
      opt.textContent = repo.title;
      if (repo.name === CURRENT_REPO.name) opt.selected = true;
      repoSelect.appendChild(opt);
    });

    // Khi đổi repo
    repoSelect.addEventListener("change", () => {
      const newRepo = repoSelect.value;
      window.location.href = `index.html?repo=${newRepo}&page=1`;
    });

    // Cập nhật title và tổng trang
    CONFIG.title = CURRENT_REPO.title;
    CONFIG.total_pages = CURRENT_REPO.max_page;

    document.title = CONFIG.title;
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = CONFIG.title;

    // Bắt đầu load dữ liệu trang hiện tại
    loadPage();
  } catch (err) {
    console.error("Lỗi load list.csv:", err);
    repoSelect.innerHTML = "<option>Lỗi tải danh sách!</option>";
  }
}

/* ======================= LOAD PAGE DỮ LIỆU ======================= */
async function loadPage() {
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get("page")) || 1;
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "<p>Đang tải...</p>";

  // Base URL lấy từ repo đã chọn
  const base = CURRENT_REPO ? CURRENT_REPO.url : "";
  const csvFile = `${base}/data/page_${page}.csv`;

  try {
    const res = await fetch(csvFile + "?_=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();

    const rows = text.trim().split("\n");
    const headers = rows[0].replace(/\uFEFF/g, "").split("|").map(h => h.trim());
    const dataIndex = headers.indexOf("data");
    if (dataIndex === -1) throw new Error("Không tìm thấy cột 'data'.");

    gallery.innerHTML = "";

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue;
      const cols = rows[i].split("|");
      if (cols.length < headers.length) continue;

      const record = Object.fromEntries(headers.map((h, j) => [h, cols[j]?.trim()]));
      const rawData = record.data;
      let data = {};
      try {
        if (rawData) {
          const cleaned = rawData.replaceAll('""', '"').replace(/(^")|("$)/g, "");
          data = JSON.parse(cleaned);
        }
      } catch (e) {
        console.warn("Lỗi parse JSON ở dòng", i + 1, e);
      }

      const imgSrc = data.url_max_2000 || data.url_max;
      if (!imgSrc) continue;

      const card = document.createElement("div");
      card.className = "card";

      const img = document.createElement("img");
      img.src = imgSrc;
      img.alt = data.title || "";
      img.className = "card-img";
      img.onclick = (ev) => {
        ev.stopPropagation();
        openModal(data);
      };

      const info = document.createElement("div");
      info.className = "info-grid";
      info.innerHTML = `
        <div class="info-col">
          <strong>${escapeHtml(data.title || "(No title)")}</strong>
          <small>📷 ${escapeHtml(data.camera || "Unknown camera")}</small>
          <small>🔭 ${escapeHtml(data.lens_model || "Không rõ")}</small>
          <small>📏 ${escapeHtml((data.max_width && data.max_height) ? `${data.max_width}×${data.max_height}` : "")}</small>
          <small>🔦 Focal: ${escapeHtml(data.focal_length || "")}</small>
        </div>
        <div class="info-col">
          <small>👤 ${escapeHtml(data.realname || "")}</small>
          <small>📅 ${escapeHtml(data.datetaken || "")}</small>
          <small>ISO: ${escapeHtml(data.iso || "")}</small>
          <small>ƒ/${escapeHtml(data.aperture || "")}</small>
          <small>${escapeHtml(data.exposure_time || "")}s</small>
        </div>`;

      const buttonBox = document.createElement("div");
      buttonBox.className = "button-box";

      const saveBtn = document.createElement("button");
      saveBtn.className = "save-btn";
      saveBtn.textContent = "Save";
      saveBtn.dataset.data = JSON.stringify(data);

      const openBtn = document.createElement("button");
      openBtn.className = "open-btn";
      openBtn.textContent = "Open";
      openBtn.onclick = (e) => {
        e.stopPropagation();
        if (data.url_max) window.open(data.url_max, "_blank");
        else alert("Không có ảnh gốc!");
      };

      buttonBox.appendChild(saveBtn);
      buttonBox.appendChild(openBtn);

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(buttonBox);

      gallery.appendChild(card);
    }

    createPagination(page);
  } catch (err) {
    console.error("Lỗi đọc CSV:", err);
    gallery.innerHTML = `<p style="color:red">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</p>`;
  }
}

/* ======================= PHẦN CÒN LẠI GIỮ NGUYÊN ======================= */
function createPagination(currentPage) {
  const totalPages = CONFIG.total_pages || 1;
  const container = document.getElementById("pagination");
  container.innerHTML = "";

  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  const params = new URLSearchParams(window.location.search);
  const repo = params.get("repo") || (CURRENT_REPO?.name ?? "");

  const go = (p) => window.location.href = `index.html?repo=${repo}&page=${p}`;

  if (currentPage > 1) {
    const first = document.createElement("button");
    first.textContent = "«";
    first.onclick = () => go(1);
    container.appendChild(first);

    const prev = document.createElement("button");
    prev.textContent = "<";
    prev.onclick = () => go(currentPage - 1);
    container.appendChild(prev);
  }

  for (let i = start; i <= end; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");
    btn.onclick = () => go(i);
    container.appendChild(btn);
  }

  if (end < totalPages) {
    const dots = document.createElement("span");
    dots.textContent = "...";
    dots.classList.add("dots");
    container.appendChild(dots);

    const last = document.createElement("button");
    last.textContent = totalPages;
    last.onclick = () => go(totalPages);
    container.appendChild(last);
  }

  if (currentPage < totalPages) {
    const next = document.createElement("button");
    next.textContent = ">";
    next.onclick = () => go(currentPage + 1);
    container.appendChild(next);

    const last = document.createElement("button");
    last.textContent = "»";
    last.onclick = () => go(totalPages);
    container.appendChild(last);
  }

  const jumpBox = document.createElement("div");
  jumpBox.className = "jump-box";
  jumpBox.innerHTML = `
    <span>Đi tới trang:</span>
    <input type="number" id="jumpInput" min="1" max="${totalPages}" style="width:60px;">
    <button id="jumpBtn">Go</button>`;
  container.appendChild(jumpBox);

  document.getElementById("jumpBtn").onclick = () => {
    const val = parseInt(document.getElementById("jumpInput").value);
    if (val >= 1 && val <= totalPages) go(val);
    else alert("Số trang không hợp lệ!");
  };
}

/* ========== Modal, nút Save/Open, scroll, ... (giữ nguyên) ========== */
// (Phần còn lại của file của bạn giữ nguyên 100%)

loadRepoList();

/* Escape HTML */
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
