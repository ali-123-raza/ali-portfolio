(() => {
  const MAX_BYTES = 50 * 1024 * 1024;
  const EXTENSIONS = ["pdf", "epub", "mobi", "azw3", "djvu", "doc", "docx", "txt", "zip"];
  const COVERS = [["#202522", "#f4f1ea"], ["#b85c3f", "#f4f1ea"], ["#a9b8a0", "#202522"], ["#e9e4da", "#202522"], ["#3d4a41", "#f4f1ea"]];

  const grid = document.querySelector("#book-grid");
  const chips = document.querySelector("#book-chips");
  const search = document.querySelector("#book-search");
  const upload = document.querySelector("#book-upload");
  const dropzone = document.querySelector("#dropzone");
  const fileInput = document.querySelector("#book-file");
  const dropTitle = document.querySelector("#dropzone-title");
  const dropSub = document.querySelector("#dropzone-sub");
  const titleField = document.querySelector("#book-title");
  const authorField = document.querySelector("#book-author");
  const categoryField = document.querySelector("#book-category");
  const coverField = document.querySelector("#book-cover");
  const descField = document.querySelector("#book-description");
  const progress = document.querySelector("#upload-progress");
  const bar = document.querySelector("#upload-bar");
  const statusEl = document.querySelector("#book-status");
  const submit = document.querySelector("#book-submit");
  const datalist = document.querySelector("#book-categories");

  let books = [];
  let category = "All";
  let query = "";
  let picked = null;

  const storage = () => supabaseClient.storage.from("books");
  const publicUrl = (path, download) => storage().getPublicUrl(path, download ? { download } : undefined).data.publicUrl;
  const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
  const stem = (name) => name.replace(/\.[^.]+$/, "");
  const safeName = (value) => slugify(value) || "book";

  function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  function coverColors(title) {
    let hash = 0;
    for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return COVERS[hash % COVERS.length];
  }

  function say(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function visibleBooks() {
    const q = query.trim().toLowerCase();
    return books.filter((book) =>
      (category === "All" || book.category === category) &&
      (!q || `${book.title} ${book.author || ""}`.toLowerCase().includes(q)));
  }

  function renderChips() {
    const cats = [...new Set(books.map((b) => b.category).filter(Boolean))].sort();
    if (category !== "All" && !cats.includes(category)) category = "All";
    chips.innerHTML = ["All", ...cats].map((cat) =>
      `<button type="button" class="chip${cat === category ? " active" : ""}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join("");
    chips.hidden = cats.length === 0;
    datalist.innerHTML = cats.map((cat) => `<option value="${escapeHtml(cat)}"></option>`).join("");
  }

  function bookHtml(book) {
    const ext = book.file_type || extOf(book.file_path);
    const [bg, fg] = coverColors(book.title);
    const label = `${book.file_name || safeName(book.title)}`;
    const cover = book.cover_path
      ? `<img src="${escapeHtml(publicUrl(book.cover_path))}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" />`
      : `<span class="cover-title">${escapeHtml(book.title)}</span><span class="cover-author">${escapeHtml(book.author || "")}</span>`;
    const meta = [formatSize(book.file_size), `<span data-count="${book.id}">${book.downloads || 0}</span> downloads`].filter(Boolean).join(" · ");
    return `
      <article class="book" data-id="${book.id}">
        <div class="book-cover" style="--cover-bg:${bg};--cover-fg:${fg}">${cover}<span class="book-format">${escapeHtml(ext)}</span></div>
        <div class="book-info">
          ${book.category ? `<p class="book-category">${escapeHtml(book.category)}</p>` : ""}
          <h3>${escapeHtml(book.title)}</h3>
          ${book.author ? `<p class="book-author">by ${escapeHtml(book.author)}</p>` : ""}
          ${book.description ? `<p class="book-desc">${escapeHtml(book.description)}</p>` : ""}
          <p class="book-meta">${meta}</p>
          <div class="book-actions">
            <a class="book-download" data-download="${book.id}" href="${escapeHtml(publicUrl(book.file_path, label))}" rel="noopener">Download <span aria-hidden="true">↓</span></a>
            ${ext === "pdf" ? `<a class="book-preview" href="${escapeHtml(publicUrl(book.file_path))}" target="_blank" rel="noopener">Read online</a>` : ""}
            ${editorMode ? `<button class="book-delete" type="button" data-delete="${book.id}">Delete</button>` : ""}
          </div>
        </div>
      </article>`;
  }

  function render() {
    renderChips();
    const list = visibleBooks();
    if (!books.length) {
      grid.innerHTML = `<p class="list-empty">${editorMode ? "The shelf is empty. Add your first book above." : "The shelf is being stocked. Check back soon."}</p>`;
    } else if (!list.length) {
      grid.innerHTML = '<p class="list-empty">No books match that search.</p>';
    } else {
      grid.innerHTML = list.map(bookHtml).join("");
    }
  }

  async function loadBooks() {
    if (!supabaseClient) {
      grid.innerHTML = '<p class="list-empty">The library is not connected yet.</p>';
      return;
    }
    const { data, error } = await supabaseClient.from("books").select("*").order("created_at", { ascending: false });
    if (error) {
      grid.innerHTML = '<p class="list-empty">The library could not be loaded right now. Please refresh in a moment.</p>';
      return;
    }
    books = data;
    render();
  }

  // --- Visitors: filtering and downloading ---
  search.addEventListener("input", () => { query = search.value; render(); });

  chips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-cat]");
    if (!chip) return;
    category = chip.dataset.cat;
    render();
  });

  grid.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-download]");
    if (link) {
      const book = books.find((b) => b.id === link.dataset.download);
      if (!book) return;
      supabaseClient.rpc("increment_book_downloads", { book_id: book.id }).then(() => {});
      book.downloads = (book.downloads || 0) + 1;
      const counter = grid.querySelector(`[data-count="${book.id}"]`);
      if (counter) counter.textContent = book.downloads;
      window.goatcounter?.count?.({ path: `/books/download/${safeName(book.title)}`, title: `Download: ${book.title}`, event: true });
      return;
    }

    const del = event.target.closest("[data-delete]");
    if (!del) return;
    const book = books.find((b) => b.id === del.dataset.delete);
    if (!book || !window.confirm(`Delete “${book.title}” and its file?`)) return;
    const paths = [book.file_path, book.cover_path].filter(Boolean);
    await storage().remove(paths);
    const { error } = await supabaseClient.from("books").delete().eq("id", book.id);
    if (error) { say(error.message, true); return; }
    await loadBooks();
  });

  // --- Owner: picking and uploading ---
  function pickFile(file) {
    if (!file) return;
    const ext = extOf(file.name);
    if (!EXTENSIONS.includes(ext)) { say(`.${ext} files aren't supported here.`, true); return; }
    if (file.size > MAX_BYTES) { say(`That file is ${formatSize(file.size)}. The limit is 50 MB.`, true); return; }
    picked = file;
    dropzone.classList.add("has-file");
    dropTitle.textContent = file.name;
    dropSub.textContent = `${ext.toUpperCase()} · ${formatSize(file.size)} · click to change`;
    if (!titleField.value.trim()) titleField.value = stem(file.name).replace(/[_-]+/g, " ").trim();
    say("");
    titleField.focus();
  }

  function resetUpload() {
    picked = null;
    upload.reset();
    dropzone.classList.remove("has-file");
    dropTitle.textContent = "Drop a book here, or click to choose";
    dropSub.textContent = "PDF, EPUB, MOBI, AZW3, DJVU, DOC, TXT or ZIP · up to 50 MB";
    progress.hidden = true;
    bar.style.width = "0";
  }

  fileInput.addEventListener("change", () => pickFile(fileInput.files[0]));
  ["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.remove("dragging"); }));
  dropzone.addEventListener("drop", (e) => pickFile(e.dataTransfer.files[0]));

  function putWithProgress(path, file, token, onProgress) {
    const { url, anonKey } = window.SUPABASE_CONFIG;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${url}/storage/v1/object/books/${path}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status < 300) return resolve();
        let message = `Upload failed (${xhr.status}).`;
        try { message = JSON.parse(xhr.responseText).message || message; } catch {}
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      xhr.send(file);
    });
  }

  upload.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || !supabaseClient) { say("Please sign in as owner first.", true); return; }
    if (!picked) { say("Choose a book file first.", true); return; }

    submit.disabled = true;
    progress.hidden = false;
    bar.style.width = "0";
    say("Uploading…");
    const stamp = Date.now();
    const ext = extOf(picked.name);
    const title = titleField.value.trim();
    const filePath = `files/${stamp}-${safeName(title)}.${ext}`;
    let coverPath = null;

    try {
      const { data } = await supabaseClient.auth.getSession();
      await putWithProgress(filePath, picked, data.session.access_token, (ratio) => { bar.style.width = `${Math.round(ratio * 100)}%`; });

      const cover = coverField.files[0];
      if (cover) {
        coverPath = `covers/${stamp}-${safeName(title)}.${extOf(cover.name) || "jpg"}`;
        const { error } = await storage().upload(coverPath, cover, { contentType: cover.type });
        if (error) { coverPath = null; }
      }

      const { error } = await supabaseClient.from("books").insert({
        owner_id: currentUser.id,
        title,
        author: authorField.value.trim() || null,
        category: categoryField.value.trim() || null,
        description: descField.value.trim() || null,
        file_path: filePath,
        cover_path: coverPath,
        file_name: `${safeName(title)}.${ext}`,
        file_type: ext,
        file_size: picked.size
      });
      if (error) {
        await storage().remove([filePath, coverPath].filter(Boolean));
        throw error;
      }
      resetUpload();
      say("Book added to the shelf.");
      await loadBooks();
    } catch (err) {
      await storage().remove([filePath]);
      say(err.message || "Upload failed.", true);
      progress.hidden = true;
    } finally {
      submit.disabled = false;
      setTimeout(() => { if (!submit.disabled) say(""); }, 4000);
    }
  });

  window.renderBooks = render;
  loadBooks();
})();
