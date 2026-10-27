const starterPosts = [
  { title: "When mathematics meets the real world", excerpt: "A reflection on using mathematical thinking to make complex ideas clearer, more useful, and easier to teach.", content: "Mathematics is at its most interesting when it leaves the page and meets a real question. In teaching and research, I keep returning to the same practice: make the structure visible, then make it useful.\n\nA good model does not remove complexity. It gives us a way to look at complexity with more patience and precision.", date: "Sep 18, 2026" },
  { title: "Notes from scientific machine learning", excerpt: "Early questions from the space where mathematical models, data, and scientific intuition meet.", content: "Scientific machine learning asks us to let data and mathematics speak to one another. The most valuable work often happens in the translation between them.\n\nI am interested in models that are not only accurate, but understandable enough to teach, question, and improve.", date: "Aug 04, 2026" },
  { title: "A curious teacher's guide to AI", excerpt: "Learning to work with intelligent tools while keeping human judgment, curiosity, and good questions at the center.", content: "AI tools are becoming part of how we learn, work, and make things. The important question is not whether they can produce an answer, but whether they help us ask a better question.\n\nFor teachers and researchers, curiosity remains the most useful interface. Tools can accelerate the process, but judgment still gives it direction.", date: "Jul 11, 2026" },
  { title: "Teaching curiosity, not just answers", excerpt: "A few classroom practices that help students stay with a difficult problem long enough to discover something.", content: "A difficult problem can feel like a wall to a student. With the right question, it becomes a door.\n\nMy aim is to create enough space for students to try, revise, and see their own thinking change. The answer matters, but the habit of staying curious matters longer.", date: "Jun 22, 2026" }
];

const staticPosts = [
  {
    title: "Can We Ever Find Absolute Truth? The Quest for Certainty in Logicomix",
    excerpt: "An essay on Logicomix, Russell's paradox and Gödel's theorems: what the search for firm foundations in mathematics did, and did not, prove about certainty.",
    href: "writing/logicomix-search-for-truth/",
    created_at: "2026-10-28T08:00:00Z",
    minutes: 8
  }
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
let postsLoaded = false;
let listScroll = null;

const articleView = document.querySelector("#article-view");
const readProgress = document.querySelector("#read-progress");
const descriptionMeta = document.querySelector('meta[name="description"]');
const siteTitle = document.title;
const siteDescription = descriptionMeta.content;
const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" });
const longDate = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" });

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

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 70).replace(/-$/, "") || "post";
}

function readingMinutes(text) {
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 220));
}

function preparePosts(posts) {
  const used = new Set();
  return posts.map((post) => {
    let slug = slugify(post.title) + (post.id ? `-${post.id.slice(0, 8)}` : "");
    for (let n = 2; used.has(slug); n++) slug = `${slugify(post.title)}-${n}`;
    used.add(slug);
    const created = post.created_at ? new Date(post.created_at) : null;
    return {
      ...post,
      slug,
      minutes: post.minutes || readingMinutes(post.content || post.excerpt || ""),
      shortDate: created ? shortDate.format(created) : post.date,
      longDate: created ? longDate.format(created) : post.date
    };
  });
}

function summaryOf(post) {
  if (post.excerpt) return post.excerpt;
  const plain = (post.content || "").replace(/[#>*`\[\]!_-]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

function renderPosts() {
  postsCache = preparePosts([...staticPosts, ...getPosts()]);
  postsLoaded = true;
  renderPostsFromCache();
  route();
}

function inline(text) {
  return text.split(/(`[^`]+`)/).map((part) => {
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    return escapeHtml(part)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img class="post-image" src="$2" alt="$1" loading="lazy" />')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[color\]([^[]+)\[\/color\]/g, '<span class="accent-text">$1</span>');
  }).join("");
}

const blockStart = /^(#{1,3}\s|>\s?|[-*]\s|\d+\.\s|---+$|```)/;
const listItem = /^([-*]|\d+\.)\s+/;

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) {
      const level = Math.max(2, heading[1].length);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) { html.push("<hr />"); i++; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }
    const listMatch = line.match(listItem);
    if (listMatch) {
      const tag = /\d/.test(listMatch[1]) ? "ol" : "ul";
      const items = [];
      while (i < lines.length && listItem.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(listItem, ""))}</li>`);
      html.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    const image = line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (image) {
      html.push(`<figure><img class="post-image" src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy" />${image[1] ? `<figcaption>${escapeHtml(image[1])}</figcaption>` : ""}</figure>`);
      i++;
      continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !(paragraph.length && blockStart.test(lines[i]))) paragraph.push(lines[i++]);
    html.push(`<p>${paragraph.map(inline).join("<br />")}</p>`);
  }
  return html.join("\n");
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
    postsLoaded = true;
    if (!error && data) {
      postsCache = preparePosts([...staticPosts, ...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      renderPostsFromCache();
    } else {
      postList.innerHTML = '<p class="list-empty">Writing could not be loaded right now. Please refresh in a moment.</p>';
    }
    route();
    return;
  }
  renderPosts();
}

function renderPostsFromCache() {
  if (!postsLoaded) return;
  if (!postsCache.length) {
    postList.innerHTML = `<p class="list-empty">${editorMode ? "No posts yet. Write your first one below." : "The first piece is on its way."}</p>`;
    return;
  }
  postList.innerHTML = postsCache.map((post, index) => `
    <article class="post" data-index="${index}">
      <span class="post-number">${String(index + 1).padStart(2, "0")}</span>
      <div>
        <h3 class="post-title"><a href="${post.href || `#/writing/${post.slug}`}">${escapeHtml(post.title)}</a></h3>
        <p class="post-excerpt">${escapeHtml(summaryOf(post))}</p>
        ${editorMode && !post.href ? `<div class="post-actions"><button type="button" data-action="edit" data-index="${index}">Edit</button><button type="button" data-action="delete" data-index="${index}">Delete</button></div>` : ""}
      </div>
      <div class="post-meta"><time>${escapeHtml(post.shortDate)}</time><span>${post.minutes} min read</span></div>
    </article>
  `).join("");
}

function articleUrl(post) {
  return `${location.origin}${location.pathname}#/writing/${post.slug}`;
}

function articleHtml(post, index) {
  const newer = postsCache[index - 1];
  const older = postsCache[index + 1];
  const url = encodeURIComponent(articleUrl(post));
  const text = encodeURIComponent(post.title);
  const navLink = (target, label, side) => target
    ? `<a class="article-nav-${side}" href="${target.href || `#/writing/${target.slug}`}"><span>${label}</span><strong>${escapeHtml(target.title)}</strong></a>`
    : "<span></span>";
  return `
    <a class="article-back" href="#writing">&larr; All writing</a>
    <header class="article-header">
      <p class="eyebrow">${escapeHtml(post.longDate)} <span class="dot"></span> ${post.minutes} min read</p>
      <h1 id="article-title" tabindex="-1">${escapeHtml(post.title)}</h1>
      ${post.excerpt ? `<p class="article-standfirst">${escapeHtml(post.excerpt)}</p>` : ""}
    </header>
    <div class="article-body">${renderMarkdown(post.content || post.excerpt || "")}</div>
    <footer class="article-footer">
      <div class="article-author">
        <img src="profile.jpeg" alt="" />
        <div><strong>Ali Raza</strong><span>Lecturer in Mathematics and PhD scholar in scientific machine learning, Faisalabad.</span></div>
      </div>
      <div class="article-share">
        <span>Share</span>
        <button type="button" data-share="copy">Copy link</button>
        <a href="https://wa.me/?text=${text}%20${url}" target="_blank" rel="noopener">WhatsApp</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://twitter.com/intent/tweet?text=${text}&url=${url}" target="_blank" rel="noopener">X</a>
      </div>
      <nav class="article-nav" aria-label="More writing">${navLink(newer, "Newer", "newer")}${navLink(older, "Older", "older")}</nav>
    </footer>`;
}

function findPost(slug) {
  const exact = postsCache.find((post) => post.slug === slug);
  if (exact) return exact;
  const suffix = slug.slice(-8);
  return postsCache.find((post) => post.id && post.id.slice(0, 8) === suffix);
}

let lastViewPath = null;

function trackView(path, title) {
  if (path === lastViewPath) return;
  lastViewPath = path;
  const send = () => window.goatcounter?.count?.({ path, title });
  if (window.goatcounter?.count) send();
  else window.addEventListener("load", send, { once: true });
}

function showArticle(slug) {
  document.body.classList.add("reading");
  const post = findPost(slug);
  if (!post) {
    articleView.dataset.slug = "";
    articleView.innerHTML = postsLoaded
      ? '<a class="article-back" href="#writing">&larr; All writing</a><p class="article-missing">That piece could not be found. It may have been moved or removed.</p>'
      : '<p class="article-missing">Loading...</p>';
    return;
  }
  if (post.slug !== slug) history.replaceState(null, "", `#/writing/${post.slug}`);
  if (articleView.dataset.slug === post.slug) return;
  articleView.dataset.slug = post.slug;
  articleView.innerHTML = articleHtml(post, postsCache.indexOf(post));
  document.title = `${post.title} | Ali Raza`;
  descriptionMeta.content = summaryOf(post);
  trackView(`/writing/${post.slug}`, post.title);
  window.scrollTo({ top: 0, behavior: "instant" });
  articleView.querySelector("h1").focus({ preventScroll: true });
  updateProgress();
}

function showHome() {
  const wasReading = document.body.classList.contains("reading");
  document.body.classList.remove("reading");
  articleView.dataset.slug = "";
  readProgress.style.transform = "scaleX(0)";
  document.title = siteTitle;
  descriptionMeta.content = siteDescription;
  trackView("/", siteTitle);
  if (!wasReading) return;
  const hash = location.hash;
  if (listScroll !== null && (hash === "" || hash === "#writing")) {
    window.scrollTo({ top: listScroll, behavior: "instant" });
  } else {
    const target = hash.length > 1 && document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView({ behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }
  listScroll = null;
}

function route() {
  const match = location.hash.match(/^#\/writing\/([^/?#]+)/);
  if (match) showArticle(decodeURIComponent(match[1]));
  else showHome();
}

function updateProgress() {
  if (!document.body.classList.contains("reading")) return;
  const total = articleView.offsetHeight - window.innerHeight;
  const done = total > 0 ? Math.min(1, Math.max(0, -articleView.getBoundingClientRect().top / total)) : 1;
  readProgress.style.transform = `scaleX(${done})`;
}

window.addEventListener("hashchange", route);
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);

articleView.addEventListener("click", async (event) => {
  const button = event.target.closest('button[data-share="copy"]');
  if (!button) return;
  const post = findPost(articleView.dataset.slug);
  try {
    await navigator.clipboard.writeText(articleUrl(post));
    button.textContent = "Link copied";
  } catch {
    window.prompt("Copy this link:", articleUrl(post));
  }
  setTimeout(() => { button.textContent = "Copy link"; }, 2000);
});

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
  const fields = {
    title: data.get("title").trim(),
    excerpt: data.get("excerpt").trim(),
    content: data.get("content").trim()
  };
  const post = { ...fields, date: shortDate.format(new Date()) };
  if (supabaseClient && currentUser) {
    const payload = { ...fields, author_id: currentUser.id };
    const result = editingIndex === null
      ? await supabaseClient.from("posts").insert(payload)
      : await supabaseClient.from("posts").update(fields).eq("id", posts[editingIndex].id);
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

  if (event.target.closest("a")) listScroll = window.scrollY;
});

if (supabaseClient) postList.innerHTML = '<p class="list-empty">Loading...</p>';
else renderPosts();
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
