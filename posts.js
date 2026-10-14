// Conexión con Firebase + utilidades para mostrar publicaciones.
(function () {
  const cfg = window.FIREBASE_CONFIG;
  const enabled = !!(cfg && window.firebase && !String(cfg.apiKey).startsWith("PEGA"));
  let db = null, auth = null;
  if (enabled) {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
    auth = firebase.auth();
  }

  const CATS = {
    es: { news: "NOTICIAS", transfers: "FICHAJES", features: "REPORTAJES" },
    en: { news: "NEWS", transfers: "TRANSFERS", features: "FEATURES" }
  };
  const IMG_CLASS = { news: "image-tactics", transfers: "image-transfer", features: "image-stadium" };

  const lang = () => document.documentElement.lang === "en" ? "en" : "es";
  const safeImg = (u) => /^https:\/\//i.test(u || "") ? u : "";
  const minutes = (body) => Math.max(1, Math.round((body || "").trim().split(/\s+/).length / 200));
  const fmtDate = (ts) => ts && ts.toDate ? ts.toDate().toLocaleDateString(lang(), { day: "numeric", month: "long", year: "numeric" }) : "";

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  function card(post, featured) {
    const a = el("article", "article-card" + (featured ? " featured-card" : ""));
    a.dataset.category = post.category;
    const img = el("div", "article-image " + IMG_CLASS[post.category]);
    const url = safeImg(post.imageUrl);
    if (url) { img.style.backgroundImage = 'url("' + encodeURI(url) + '")'; img.style.backgroundSize = "cover"; img.style.backgroundPosition = "center"; }
    const lbl = el("span", "image-label"); lbl.dataset.i18n = "cat-" + post.category; lbl.textContent = CATS[lang()][post.category];
    img.appendChild(lbl);
    const c = el("div", "article-content");
    c.appendChild(el("p", "article-meta", fmtDate(post.createdAt) + " · " + minutes(post.body) + " MIN"));
    c.appendChild(el("h3", "", post.title));
    c.appendChild(el("p", "", post.summary));
    const link = el("a", "read-link"); link.href = "article.html?id=" + encodeURIComponent(post.id);
    const t = el("span", "", ""); link.append(document.createTextNode(""), t);
    const txt = el("b", ""); txt.dataset.i18n = "read-story"; txt.textContent = lang() === "en" ? "Read story" : "Leer historia";
    link.textContent = ""; link.append(txt, el("span", "", "↗"));
    c.appendChild(link);
    a.append(img, c);
    return a;
  }

  const fromSnap = (s) => s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  const ts = (p) => (p.createdAt && p.createdAt.toMillis ? p.createdAt.toMillis() : Date.now());

  window.VeltorPosts = {
    enabled, db, auth, card, el, safeImg, minutes, fmtDate, CATS,
    async loadPublished() {
      const s = await db.collection("posts").where("published", "==", true).get();
      return fromSnap(s).sort((a, b) => ts(b) - ts(a));
    },
    async loadAll() {
      const s = await db.collection("posts").get();
      return fromSnap(s).sort((a, b) => ts(b) - ts(a));
    },
    async loadOne(id) {
      const d = await db.collection("posts").doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    }
  };
})();
