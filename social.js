(function () {
  const P = window.VeltorPosts, $ = (id) => document.getElementById(id), el = P.el;
  if (!P.enabled) { $("setup-warning").hidden = false; $("app").hidden = true; return; }

  const db = P.db, auth = P.auth, TS = () => firebase.firestore.FieldValue.serverTimestamp();
  const params = new URLSearchParams(location.search);
  let ageGroup = "", meAdult = false, me = null, rel = { friends: [], incoming: [], outgoing: [] }, cache = {}, view = { name: "feed" };

  const toast = (t) => { const m = $("toast"); m.textContent = t; m.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (m.hidden = true), 2600); };
  const https = (u) => (/^https:\/\//i.test(u || "") ? u : "");
  const fail = (e) => toast(e && e.code === "permission-denied" ? "No tienes permiso para esa acción." : "Error: " + ((e && (e.code || e.message)) || "desconocido"));
  const btn = (label, fn, cls) => { const b = el("button", cls || "filter", label); b.type = "button"; b.addEventListener("click", fn); return b; };
  const empty = (t) => el("p", "muted", t);
  const when = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
  const ms = (x) => (x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now());

  async function profile(uid) {
    if (cache[uid]) return cache[uid];
    try { const d = await db.collection("users").doc(uid).get(); cache[uid] = d.exists ? d.data() : null; } catch (e) { cache[uid] = null; }
    return (cache[uid] = cache[uid] || { displayName: "Usuario", bio: "", photoURL: "" });
  }
  function avatar(p) {
    const a = el("span", "avatar"), u = https(p.photoURL);
    if (u) a.style.backgroundImage = 'url("' + encodeURI(u) + '")'; else a.textContent = (p.displayName || "?")[0].toUpperCase();
    return a;
  }

  // ---------- Sesión ----------
  async function login(provider) {
    $("login-msg").textContent = "";
    const ag = $("age-group").value, say = (t) => { $("login-msg").textContent = t; };
    if (!ag) return say("Elige tu rango de edad.");
    if (ag === "under13") return say("Lo sentimos: debes tener al menos 13 años para crear una cuenta.");
    if (!$("age-ok").checked) return say("Debes aceptar los términos y la política de privacidad.");
    ageGroup = ag;
    try { await auth.signInWithPopup(provider); }
    catch (e) {
      $("login-msg").textContent = e.code === "auth/account-exists-with-different-credential" ? "Ese correo ya está registrado con otro método: prueba el otro botón."
        : e.code === "auth/popup-closed-by-user" ? "" : "No se pudo iniciar sesión (" + e.code + ").";
    }
  }
  $("login-google").addEventListener("click", () => login(new firebase.auth.GoogleAuthProvider()));
  $("logout").addEventListener("click", () => auth.signOut());

  auth.onAuthStateChanged(async (user) => {
    me = user; cache = {};
    $("login-box").hidden = !!user;
    document.querySelectorAll(".user-only").forEach((n) => (n.hidden = !user));
    if (user) {
      try {
        const ref = db.collection("users").doc(user.uid);
        if (!(await ref.get()).exists) {
          if (!ageGroup) { await auth.signOut(); $("login-msg").textContent = "Para crear tu cuenta indica tu edad y acepta los términos."; return; }
          await ref.set({ displayName: (user.displayName || "Usuario").slice(0, 60), bio: "", photoURL: https(user.photoURL).slice(0, 500), adult: ageGroup === "adult", termsAcceptedAt: TS() });
        }
        meAdult = (await profile(user.uid)).adult === true;
        adminFlag = await db.collection("banned").limit(1).get().then(() => true, () => false);
        await loadRel();
      } catch (e) { fail(e); }
    } else { meAdult = false; adminFlag = false; rel = { friends: [], incoming: [], outgoing: [] }; }
    go(view.name === "feed" || !user ? "feed" : view.name, view.arg);
  });

  document.querySelectorAll("#tabs [data-view]").forEach((b) => b.addEventListener("click", () => { params.delete("post"); go(b.dataset.view, b.dataset.view === "profile" ? me && me.uid : null); }));

  // ---------- Amigos ----------
  async function loadRel() {
    rel = { friends: [], incoming: [], outgoing: [] };
    const [a, b] = await Promise.all([
      db.collection("requests").where("from", "==", me.uid).get(),
      db.collection("requests").where("to", "==", me.uid).get()
    ]);
    a.docs.forEach((d) => { const r = d.data(); (r.status === "accepted" ? rel.friends : rel.outgoing).push({ id: d.id, uid: r.to }); });
    b.docs.forEach((d) => { const r = d.data(); (r.status === "accepted" ? rel.friends : rel.incoming).push({ id: d.id, uid: r.from }); });
  }
  const find = (list, uid) => list.find((x) => x.uid === uid);

  function friendBtn(uid, p) {
    if (!me || uid === me.uid) return null;
    if (p && (p.adult === true) !== meAdult) return null; // adultos y menores no se agregan entre sí
    const act = async (f) => { try { await f(); await loadRel(); go(view.name, view.arg); } catch (e) { fail(e); } };
    let r;
    if ((r = find(rel.friends, uid))) return btn("Amigos ✓ · quitar", () => confirm("¿Quitar de tus amigos?") && act(() => db.collection("requests").doc(r.id).delete()));
    if ((r = find(rel.incoming, uid))) return btn("Aceptar solicitud", () => act(() => db.collection("requests").doc(r.id).update({ status: "accepted" })), "filter active");
    if ((r = find(rel.outgoing, uid))) return btn("Solicitud enviada · cancelar", () => act(() => db.collection("requests").doc(r.id).delete()));
    return btn("Agregar", () => act(() => db.collection("requests").doc(me.uid + "_" + uid).set({ from: me.uid, to: uid, status: "pending" })), "filter active");
  }

  let adminFlag = false; // se detecta probando una lectura que solo permite el admin (ver reglas)
  const isAdmin = () => adminFlag;

  function reportBtn(targetUid, postId, host) {
    return btn("Reportar", () => {
      if (!me) return toast("Inicia sesión para reportar.");
      if (host.querySelector(".send-box")) return;
      const box = el("div", "send-box"), sel = el("select");
      ["Spam", "Odio o acoso", "Contenido inapropiado", "Suplantación", "Otro"].forEach((r) => { const o = el("option", "", r); o.value = r; sel.appendChild(o); });
      const note = el("input"); note.maxLength = 200; note.placeholder = "Detalles (opcional)";
      box.append(sel, note, btn("Enviar reporte", async () => {
        const reason = (sel.value + (note.value.trim() ? ": " + note.value.trim() : "")).slice(0, 300);
        try {
          await db.collection("reports").doc([me.uid, targetUid, postId || "user"].join("_")).set({ reporter: me.uid, target: targetUid, postId: postId || "", reason, createdAt: TS() });
          box.remove(); toast("Gracias, revisaremos el reporte.");
        } catch (e) { box.remove(); toast(e.code === "permission-denied" ? "Ya enviaste este reporte." : "No se pudo enviar el reporte."); }
      }, "filter active"), btn("Cancelar", () => box.remove()));
      host.appendChild(box);
    });
  }

  async function deleteAccount() {
    if (!confirm("Se borrarán tu perfil, tus publicaciones y tus amistades. No se puede deshacer. ¿Continuar?")) return;
    try {
      await me.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      const uid = me.uid;
      const [ps, r1, r2] = await Promise.all([
        db.collection("community").where("authorId", "==", uid).get(),
        db.collection("requests").where("from", "==", uid).get(),
        db.collection("requests").where("to", "==", uid).get()
      ]);
      for (const d of ps.docs) { const l = await d.ref.collection("likes").get(); for (const x of l.docs) await x.ref.delete(); await d.ref.delete(); }
      for (const d of r1.docs.concat(r2.docs)) await d.ref.delete();
      await db.collection("users").doc(uid).delete();
      await me.delete();
      toast("Cuenta eliminada.");
    } catch (e) { if (e.code !== "auth/popup-closed-by-user") fail(e); }
  }

  // ---------- Publicaciones ----------
  function composer(onDone) {
    const box = el("div", "admin-card composer");
    const text = el("textarea"); text.rows = 3; text.maxLength = 1000; text.placeholder = "¿Qué quieres compartir del fútbol?";
    const img = el("input"); img.type = "url"; img.placeholder = "URL de imagen (opcional, https://...)";
    const sens = el("label", "check"), cb = el("input"); cb.type = "checkbox";
    sens.append(cb, document.createTextNode(" Contenido sensible (violencia, lenguaje fuerte o temas delicados). Solo lo verán cuentas de 18+"));
    const go1 = btn("Publicar", async () => {
      const t = text.value.trim(), i = img.value.trim();
      if (!t) return toast("Escribe algo primero.");
      if (i && !https(i)) return toast("La imagen debe empezar con https://");
      try { await db.collection("community").add({ authorId: me.uid, text: t, imageUrl: i, sensitive: cb.checked, createdAt: TS() }); text.value = ""; img.value = ""; cb.checked = false; toast("Publicado ✔"); onDone(); } catch (e) { fail(e); }
    }, "button button-red");
    box.append(text, img, sens, go1);
    return box;
  }

  async function postCard(p) {
    const [pr, likes] = await Promise.all([profile(p.authorId), db.collection("community").doc(p.id).collection("likes").get()]);
    let n = likes.size, liked = !!me && likes.docs.some((d) => d.id === me.uid);
    const card = el("article", "post");
    const head = el("div", "post-head");
    const who = el("button", "linkbtn", pr.displayName); who.type = "button"; who.addEventListener("click", () => go("profile", p.authorId));
    const info = el("div", ""); info.append(who, el("br"), el("small", "", when(p.createdAt)));
    head.append(avatar(pr), info);
    const body = el("div", "post-body"); card.append(head, body); body.appendChild(el("p", "post-text", p.text));
    if (https(p.imageUrl)) { const im = el("img", "post-img"); im.src = p.imageUrl; im.loading = "lazy"; im.referrerPolicy = "no-referrer"; im.alt = ""; body.appendChild(im); }
    if (p.sensitive) { body.classList.add("hidden"); const warn = btn(meAdult ? "⚠ Contenido sensible · Pulsa para ver" : "⚠ Contenido sensible · solo para mayores de 18 con sesión iniciada", () => { if (!meAdult) return toast("Este contenido es solo para cuentas de 18 años o más."); body.classList.remove("hidden"); warn.remove(); }, "filter danger"); card.insertBefore(warn, body); }

    const bar = el("div", "post-actions");
    const likeBtn = btn("", async () => {
      if (!me) return toast("Inicia sesión para dar like.");
      const ref = db.collection("community").doc(p.id).collection("likes").doc(me.uid);
      try { if (liked) { await ref.delete(); n--; liked = false; } else { await ref.set({ createdAt: TS() }); n++; liked = true; } paint(); } catch (e) { fail(e); }
    });
    const paint = () => { likeBtn.textContent = (liked ? "♥ " : "♡ ") + n; likeBtn.classList.toggle("active", liked); };
    paint();
    const url = location.origin + location.pathname + "?post=" + p.id;
    const share = btn("Compartir", async () => {
      try { if (navigator.share) await navigator.share({ title: "VÉLTOR", text: p.text.slice(0, 80), url }); else { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } } catch (e) {}
    });
    bar.append(likeBtn, share);
    if (me && me.uid !== p.authorId) bar.appendChild(reportBtn(p.authorId, p.id, card));
    if (me && (me.uid === p.authorId || isAdmin())) bar.appendChild(btn(me.uid === p.authorId ? "Eliminar" : "Eliminar (admin)", async () => { if (confirm("¿Eliminar esta publicación?")) { try { await db.collection("community").doc(p.id).delete(); card.remove(); } catch (e) { fail(e); } } }, "filter danger"));
    card.appendChild(bar);
    return card;
  }
  const mapDocs = (s) => s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  async function appendPosts(c, posts) {
    if (!posts.length) return c.appendChild(empty("Aún no hay publicaciones."));
    (await Promise.all(posts.map(postCard))).forEach((n) => c.appendChild(n));
  }

  // ---------- Vistas ----------
  async function viewFeed(c) {
    if (me) c.appendChild(composer(() => go("feed")));
    const pid = params.get("post");
    if (pid) {
      c.appendChild(btn("← Ver toda la comunidad", () => { params.delete("post"); history.replaceState(null, "", location.pathname); go("feed"); }));
      const d = await db.collection("community").doc(pid).get();
      return appendPosts(c, d.exists ? [Object.assign({ id: d.id }, d.data())] : []);
    }
    const s = await db.collection("community").orderBy("createdAt", "desc").limit(30).get();
    await appendPosts(c, mapDocs(s));
  }

  async function viewProfile(c, uid) {
    uid = uid || me.uid;
    const pr = await profile(uid), mine = me && me.uid === uid;
    const head = el("div", "admin-card profile-head");
    const big = avatar(pr); big.classList.add("big");
    const info = el("div", ""); info.append(el("h2", "", pr.displayName), el("p", "muted", pr.bio || (mine ? "Añade una biografía." : "")));
    head.append(big, info);
    const fb = friendBtn(uid, pr); if (fb) info.appendChild(fb);
    if (me && !mine) info.appendChild(reportBtn(uid, "", head));
    c.appendChild(head);
    if (mine) {
      const f = el("div", "admin-card"); f.appendChild(el("h3", "", "Editar perfil"));
      const name = el("input"); name.value = pr.displayName; name.maxLength = 60;
      const bio = el("textarea"); bio.rows = 3; bio.maxLength = 300; bio.value = pr.bio; bio.placeholder = "Biografía (equipo favorito, ciudad…)";
      const ph = el("input"); ph.type = "url"; ph.value = pr.photoURL; ph.placeholder = "URL de foto de perfil (https://…)";
      f.append(name, bio, ph, btn("Guardar", async () => {
        if (!name.value.trim()) return toast("El nombre no puede estar vacío.");
        if (ph.value.trim() && !https(ph.value.trim())) return toast("La foto debe empezar con https://");
        try { const d = { displayName: name.value.trim(), bio: bio.value.trim(), photoURL: ph.value.trim() }; await db.collection("users").doc(uid).update(d); cache[uid] = Object.assign({}, pr, d); toast("Perfil guardado ✔"); go("profile", uid); } catch (e) { fail(e); }
      }, "button button-red"));
      f.appendChild(btn("Eliminar mi cuenta", deleteAccount, "filter danger"));
      c.appendChild(f);
    }
    c.appendChild(el("h3", "", "Publicaciones"));
    const s = await db.collection("community").where("authorId", "==", uid).get();
    await appendPosts(c, mapDocs(s).sort((a, b) => ms(b) - ms(a)));
  }

  async function personRow(uid, p) {
    const row = el("div", "post-row"), left = el("div", "post-head");
    const who = el("button", "linkbtn", p.displayName); who.type = "button"; who.addEventListener("click", () => go("profile", uid));
    const t = el("div", ""); t.append(who, el("br"), el("small", "", p.bio || ""));
    left.append(avatar(p), t);
    const right = el("div", "post-actions"), fb = friendBtn(uid, p); if (fb) right.appendChild(fb);
    row.append(left, right);
    return row;
  }

  async function viewPeople(c) {
    const q = el("input"); q.placeholder = "Buscar por nombre…";
    const list = el("div", ""); c.append(q, list);
    const s = await db.collection("users").limit(100).get();
    const users = s.docs.map((d) => ({ uid: d.id, p: d.data() })).filter((u) => u.uid !== me.uid && (u.p.adult === true) === meAdult);
    const draw = async () => {
      const t = q.value.trim().toLowerCase(), shown = users.filter((u) => u.p.displayName.toLowerCase().includes(t));
      list.replaceChildren(...(shown.length ? await Promise.all(shown.map((u) => personRow(u.uid, u.p))) : [empty("Nadie encontrado.")]));
    };
    q.addEventListener("input", draw); draw();
  }

  async function viewFriends(c) {
    const section = async (title, items, extra) => {
      c.appendChild(el("h3", "", title));
      if (!items.length) return c.appendChild(empty("Nada por aquí."));
      for (const it of items) { const row = await personRow(it.uid, await profile(it.uid)); if (extra) row.lastChild.appendChild(extra(it)); c.appendChild(row); }
    };
    await section("Solicitudes recibidas", rel.incoming);
    await section("Mis amigos", rel.friends);
    await section("Solicitudes enviadas", rel.outgoing);
  }

  // ---------- Navegación ----------
  async function go(name, arg) {
    if (!me && name !== "feed") name = "feed";
    view = { name, arg };
    document.querySelectorAll("#tabs [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    const c = $("content"); c.replaceChildren(empty("Cargando…"));
    const out = el("div", "");
    try {
      if (name === "feed") await viewFeed(out);
      else if (name === "people") await viewPeople(out);
      else if (name === "friends") await viewFriends(out);
      else if (name === "profile") await viewProfile(out, arg);
    } catch (e) { out.appendChild(empty("No se pudo cargar (" + (e.code || e.message) + ").")); }
    if (view.name === name) c.replaceChildren(out);
  }
})();
