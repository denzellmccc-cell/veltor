(function () {
  const $ = (id) => document.getElementById(id);
  const P = window.VeltorPosts;
  const say = (node, text, ok) => { node.textContent = text; node.className = "admin-msg " + (ok ? "ok" : "err"); };

  if (!P.enabled) { $("setup-warning").hidden = false; $("login-card").hidden = true; return; }

  let editingId = null;
  let cache = [];

  $("login-google").addEventListener("click", async () => {
    try { await P.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (err) { if (err.code !== "auth/popup-closed-by-user") say($("login-msg"), "No se pudo iniciar sesión (" + err.code + ").", false); }
  });
  $("logout").addEventListener("click", () => P.auth.signOut());

  P.auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Solo el admin puede leer "banned" (lo dicen las reglas de Firestore).
      const ok = await P.db.collection("banned").limit(1).get().then(() => true, () => false);
      if (!ok) { P.auth.signOut(); say($("login-msg"), "Esa cuenta no es la de administrador.", false); return; }
    }
    $("login-card").hidden = !!user;
    $("panel").hidden = !user;
    if (user) { $("user-email").textContent = user.email; refresh(); loadReports(); }
  });

  function resetForm() {
    editingId = null;
    $("post-form").reset();
    $("f-published").checked = true;
    $("form-title").textContent = "Nueva publicación";
    $("cancel-edit").hidden = true;
  }
  $("cancel-edit").addEventListener("click", resetForm);

  $("post-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const image = $("f-image").value.trim();
    if (image && !/^https:\/\//i.test(image)) return say($("form-msg"), "La imagen debe empezar con https://", false);
    const data = {
      title: $("f-title").value.trim(),
      category: $("f-category").value,
      summary: $("f-summary").value.trim(),
      body: $("f-body").value.trim(),
      imageUrl: image,
      published: $("f-published").checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (editingId) await P.db.collection("posts").doc(editingId).update(data);
      else await P.db.collection("posts").add(Object.assign(data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
      say($("form-msg"), data.published ? "Publicado ✔" : "Guardado como borrador ✔", true);
      resetForm();
      refresh();
    } catch (err) {
      say($("form-msg"), err.code === "permission-denied"
        ? "Sin permiso: revisa el correo en las reglas de Firebase y que las publicaste."
        : "Error al guardar: " + err.message, false);
    }
  });

  async function refresh() {
    try {
      cache = await P.loadAll();
      $("list-msg").textContent = cache.length ? "" : "Aún no hay publicaciones.";
      $("list-msg").className = "admin-msg";
      render();
    } catch (err) {
      say($("list-msg"), err.code === "permission-denied"
        ? "Sin permiso: revisa el correo en las reglas de Firebase y que las publicaste."
        : "No se pudo cargar: " + err.message, false);
    }
  }

  function render() {
    const list = $("post-list");
    list.replaceChildren();
    cache.forEach((p) => {
      const row = P.el("div", "post-row");
      const info = P.el("div", "");
      info.append(P.el("b", "", p.title), P.el("br"), P.el("small", "", (p.published ? "Publicado" : "Borrador") + " · " + (P.CATS.es[p.category] || "") + " · " + P.fmtDate(p.createdAt)));
      const actions = P.el("div", "post-actions");
      const btn = (label, fn, danger) => { const b = P.el("button", "filter" + (danger ? " danger" : ""), label); b.type = "button"; b.addEventListener("click", fn); return b; };
      actions.append(
        btn("Editar", () => edit(p)),
        btn(p.published ? "Ocultar" : "Publicar", async () => { await P.db.collection("posts").doc(p.id).update({ published: !p.published }); refresh(); }),
        btn("Eliminar", async () => { if (confirm("¿Eliminar «" + p.title + "» para siempre?")) { await P.db.collection("posts").doc(p.id).delete(); refresh(); } }, true)
      );
      row.append(info, actions);
      list.appendChild(row);
    });
  }

  function edit(p) {
    editingId = p.id;
    $("f-title").value = p.title; $("f-category").value = p.category; $("f-summary").value = p.summary;
    $("f-body").value = p.body; $("f-image").value = p.imageUrl || ""; $("f-published").checked = !!p.published;
    $("form-title").textContent = "Editando publicación";
    $("cancel-edit").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Reportes y suspensiones ----------
  async function loadReports() {
    const list = $("report-list");
    try {
      const [rs, bs] = await Promise.all([P.db.collection("reports").get(), P.db.collection("banned").get()]);
      const banned = new Set(bs.docs.map((d) => d.id));
      const reports = rs.docs.map((d) => Object.assign({ id: d.id }, d.data()))
        .sort((x, y) => (y.createdAt ? y.createdAt.toMillis() : 0) - (x.createdAt ? x.createdAt.toMillis() : 0));
      list.replaceChildren();
      say($("report-msg"), reports.length ? "" : "No hay reportes pendientes.", true);
      const names = {};
      const name = async (uid) => {
        if (names[uid]) return names[uid];
        try { const d = await P.db.collection("users").doc(uid).get(); names[uid] = d.exists ? d.data().displayName : "(sin perfil)"; } catch (e) { names[uid] = "?"; }
        return names[uid];
      };
      for (const r of reports) {
        const row = P.el("div", "post-row");
        const info = P.el("div", "");
        info.append(
          P.el("b", "", "Reportado: " + (await name(r.target)) + (banned.has(r.target) ? " (suspendido)" : "")), P.el("br"),
          P.el("small", "", "Por: " + (await name(r.reporter)) + " · " + P.fmtDate(r.createdAt) + " · " + (r.postId ? "publicación" : "perfil")), P.el("br"),
          P.el("span", "", r.reason)
        );
        const actions = P.el("div", "post-actions");
        const b = (label, fn, danger) => { const x = P.el("button", "filter" + (danger ? " danger" : ""), label); x.type = "button"; x.addEventListener("click", async () => { try { await fn(); loadReports(); } catch (e) { say($("report-msg"), "Error: " + e.code, false); } }); return x; };
        if (r.postId) { const l = P.el("a", "filter", "Ver"); l.href = "comunidad.html?post=" + encodeURIComponent(r.postId); l.target = "_blank"; l.rel = "noopener"; actions.appendChild(l); }
        if (r.postId) actions.appendChild(b("Borrar publicación", async () => { if (confirm("¿Borrar esa publicación?")) { await P.db.collection("community").doc(r.postId).delete(); await P.db.collection("reports").doc(r.id).delete(); } }, true));
        actions.appendChild(banned.has(r.target)
          ? b("Quitar suspensión", () => P.db.collection("banned").doc(r.target).delete())
          : b("Suspender usuario", async () => { if (confirm("¿Suspender a este usuario? No podrá publicar.")) await P.db.collection("banned").doc(r.target).set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, true));
        actions.appendChild(b("Descartar", () => P.db.collection("reports").doc(r.id).delete()));
        row.append(info, actions);
        list.appendChild(row);
      }
    } catch (err) { say($("report-msg"), "No se pudieron cargar los reportes (" + (err.code || err.message) + ").", false); }
  }
})();
