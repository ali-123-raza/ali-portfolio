const starterPosts = [
  { title: "When mathematics meets the real world", excerpt: "A reflection on using mathematical thinking to make complex ideas clearer, more useful, and easier to teach.", content: "Mathematics is at its most interesting when it leaves the page and meets a real question. In teaching and research, I keep returning to the same practice: make the structure visible, then make it useful.\n\nA good model does not remove complexity. It gives us a way to look at complexity with more patience and precision.", date: "Sep 18, 2026" },
  { title: "Notes from scientific machine learning", excerpt: "Early questions from the space where mathematical models, data, and scientific intuition meet.", content: "Scientific machine learning asks us to let data and mathematics speak to one another. The most valuable work often happens in the translation between them.\n\nI am interested in models that are not only accurate, but understandable enough to teach, question, and improve.", date: "Aug 04, 2026" },
  { title: "A curious teacher's guide to AI", excerpt: "Learning to work with intelligent tools while keeping human judgment, curiosity, and good questions at the center.", content: "AI tools are becoming part of how we learn, work, and make things. The important question is not whether they can produce an answer, but whether they help us ask a better question.\n\nFor teachers and researchers, curiosity remains the most useful interface. Tools can accelerate the process, but judgment still gives it direction.", date: "Jul 11, 2026" },
  { title: "Teaching curiosity, not just answers", excerpt: "A few classroom practices that help students stay with a difficult problem long enough to discover something.", content: "A difficult problem can feel like a wall to a student. With the right question, it becomes a door.\n\nMy aim is to create enough space for students to try, revise, and see their own thinking change. The answer matters, but the habit of staying curious matters longer.", date: "Jun 22, 2026" }
];

const postList = document.querySelector("#post-list");
const form = document.querySelector("#post-form");
const status = document.querySelector("#form-status");
const titleInput = document.querySelector("#post-title");
const excerptInput = document.querySelector("#post-excerpt");
const contentInput = document.querySelector("#post-content");
const wordCount = document.querySelector("#word-count");
const submitButton = document.querySelector("#form-submit");
const cancelButton = document.querySelector("#cancel-edit");
const authButton = document.querySelector("#auth-button");
const loginDialog = document.querySelector("#login-dialog");
const loginForm = document.querySelector("#login-form");
const closeLogin = document.querySelector("#close-login");
const loginStatus = document.querySelector("#login-status");
const hasSupabaseConfig = window.SUPABASE_CONFIG && !window.SUPABASE_CONFIG.url.includes("YOUR-") && !window.SUPABASE_CONFIG.anonKey.includes("YOUR-");
const supabaseClient = hasSupabaseConfig && window.supabase
  ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey)
  : null;
let editorMode = false;
let editingIndex = null;
let currentUser = null;
let postsCache = [];

function setEditorMode(isOwner) {
  editorMode = isOwner;
  document.body.classList.toggle("owner-mode", isOwner);
  authButton.querySelector("span").textContent = isOwner ? "Sign out" : "Owner login";
  renderPostsFromCache();
}

function getPosts() {
  try {
    return JSON.parse(localStorage.getItem("ali-notes")) || starterPosts;
  } catch {
    return starterPosts;
  }
}

function renderPosts() {
  const posts = getPosts();
  postsCache = posts;
  postList.innerHTML = posts.map((post, index) => `
    <article class="post" data-index="${index}" ${editorMode ? "" : 'tabindex="0" role="button"'} aria-expanded="false">
      <span class="post-number">0${index + 1}</span>
      <div>
        <h3 class="post-title">${escapeHtml(post.title)}</h3>
        <p class="post-excerpt">${escapeHtml(post.excerpt || "")}</p>
        <div class="post-body" id="post-body-${index}">${formatBody(post.content || post.excerpt || "")}</div>
        ${editorMode ? `<div class="post-actions"><button type="button" data-action="edit" data-index="${index}">Edit</button><button type="button" data-action="delete" data-index="${index}">Delete</button></div>` : ""}
      </div>
      <time class="post-meta">${escapeHtml(post.date)}</time>
    </article>
  `).join("");
}

function formatBody(value) {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img class="post-image" src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[color\]([^[]+)\[\/color\]/g, '<span class="accent-text">$1</span>')
    .replace(/\n/g, "<br />");
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function updateWordCount() {
  const words = contentInput.value.trim() ? contentInput.value.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
}

function savePosts(posts) {
  localStorage.setItem("ali-notes", JSON.stringify(posts));
  renderPosts();
}

async function loadPosts() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("posts").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      postsCache = data.map((post) => ({ ...post, date: new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(post.created_at)) }));
      renderPostsFromCache();
      return;
    }
  }
  renderPosts();
}

function renderPostsFromCache() {
  const posts = postsCache;
  postList.innerHTML = posts.map((post, index) => `
    <article class="post" data-index="${index}" ${editorMode ? "" : 'tabindex="0" role="button"'} aria-expanded="false">
      <span class="post-number">0${index + 1}</span>
      <div>
        <h3 class="post-title">${escapeHtml(post.title)}</h3>
        <p class="post-excerpt">${escapeHtml(post.excerpt || "")}</p>
        <div class="post-body" id="post-body-${index}">${formatBody(post.content || post.excerpt || "")}</div>
        ${editorMode ? `<div class="post-actions"><button type="button" data-action="edit" data-index="${index}">Edit</button><button type="button" data-action="delete" data-index="${index}">Delete</button></div>` : ""}
      </div>
      <time class="post-meta">${escapeHtml(post.date)}</time>
    </article>
  `).join("");
}

function resetEditor() {
  editingIndex = null;
  form.reset();
  submitButton.innerHTML = "Publish post <span aria-hidden=\"true\">↗</span>";
  cancelButton.hidden = true;
  updateWordCount();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const posts = [...postsCache];
  const post = {
    title: data.get("title").trim(),
    excerpt: data.get("excerpt").trim(),
    content: data.get("content").trim(),
    date: new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(new Date())
  };
  if (supabaseClient && currentUser) {
    const payload = { ...post, author_id: currentUser.id };
    const result = editingIndex === null
      ? await supabaseClient.from("posts").insert(payload)
      : await supabaseClient.from("posts").update(post).eq("id", posts[editingIndex].id);
    if (result.error) {
      status.textContent = result.error.message;
      return;
    }
    status.textContent = editingIndex === null ? "Published to your archive." : "Post updated in your archive.";
    await loadPosts();
  } else if (editingIndex === null) {
    posts.unshift(post);
    savePosts(posts);
    status.textContent = "Published locally. Add Supabase settings to publish online.";
  } else {
    posts[editingIndex] = { ...posts[editingIndex], ...post };
    savePosts(posts);
    status.textContent = "Post updated in your archive.";
  }
  resetEditor();
  setTimeout(() => { status.textContent = ""; }, 3500);
});

contentInput.addEventListener("input", updateWordCount);
cancelButton.addEventListener("click", resetEditor);

document.querySelectorAll(".editor-toolbar button").forEach((button) => {
  button.addEventListener("click", () => {
    const insertion = button.dataset.markdown;
    const start = contentInput.selectionStart;
    const end = contentInput.selectionEnd;
    contentInput.setRangeText(insertion, start, end, "select");
    contentInput.focus();
    updateWordCount();
  });
});

postList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) {
    const index = Number(button.dataset.index);
    const posts = postsCache;
    const post = posts[index];
    if (!post) return;

    if (button.dataset.action === "edit") {
      editingIndex = index;
      titleInput.value = post.title;
      excerptInput.value = post.excerpt || "";
      contentInput.value = post.content || post.excerpt || "";
      submitButton.innerHTML = "Save changes <span aria-hidden=\"true\">↗</span>";
      cancelButton.hidden = false;
      updateWordCount();
      document.querySelector("#write").scrollIntoView({ behavior: "smooth" });
      titleInput.focus();
    }

    if (button.dataset.action === "delete" && window.confirm(`Delete “${post.title}”?`)) {
      if (supabaseClient && currentUser) {
        const result = await supabaseClient.from("posts").delete().eq("id", post.id);
        if (result.error) {
          status.textContent = result.error.message;
          return;
        }
        await loadPosts();
      } else {
        posts.splice(index, 1);
        savePosts(posts);
      }
      status.textContent = "Post deleted.";
      setTimeout(() => { status.textContent = ""; }, 3500);
    }
    return;
  }

  if (event.target.closest("a")) return;
  const article = event.target.closest(".post");
  if (!article) return;
  const index = Number(article.dataset.index);
  const body = article.querySelector(".post-body");
  const isOpen = body.classList.toggle("is-open");
  article.setAttribute("aria-expanded", String(isOpen));
});

postList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const article = event.target.closest(".post");
  if (!article) return;
  event.preventDefault();
  article.click();
});

renderPosts();
updateWordCount();

authButton.addEventListener("click", async () => {
  if (currentUser && supabaseClient) {
    await supabaseClient.auth.signOut();
    currentUser = null;
    setEditorMode(false);
    await loadPosts();
    return;
  }
  loginStatus.textContent = hasSupabaseConfig ? "" : "Add your Supabase settings first.";
  loginDialog.showModal();
});

closeLogin.addEventListener("click", () => loginDialog.close());

const passwordInput = document.querySelector("#login-password");
const togglePassword = document.querySelector("#toggle-password");
togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Hide" : "Show";
  togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
  togglePassword.setAttribute("aria-pressed", String(show));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    loginStatus.textContent = "Supabase is not configured yet.";
    return;
  }
  loginStatus.textContent = "Signing in...";
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: document.querySelector("#login-email").value,
    password: document.querySelector("#login-password").value
  });
  if (error) {
    loginStatus.textContent = error.message;
    return;
  }
  currentUser = data.user;
  setEditorMode(true);
  loginDialog.close();
  await loadPosts();
});

if (supabaseClient) {
  supabaseClient.auth.getSession().then(async ({ data }) => {
    currentUser = data.session?.user || null;
    setEditorMode(Boolean(currentUser));
    await loadPosts();
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    setEditorMode(Boolean(currentUser));
  });
}
