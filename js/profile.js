// Pantalla "Tu perfil": nombre visible e imagen de perfil.
import { plural } from "./model.js";
import { $, esc, toast, errMsg, avatarHTML, imageToAvatar } from "./ui.js";

export function renderProfile(view, ctx) {
  const { store, user } = ctx;
  const st = { name: user.name || "", photo: user.photo || "", busy: false };

  view.innerHTML = `
    <div class="page-head">
      <a class="back" href="#/">← Volver</a>
      <h1>Tu perfil</h1>
    </div>
    <div class="profile">
      <section class="step">
        <h2>Imagen de perfil</h2>
        <div class="avatar-edit">
          <div id="pf-avatar"></div>
          <div class="avatar-btns">
            <button class="btn" data-act="upload">📷 Subir imagen</button>
            ${user.googlePhoto ? `<button class="btn" data-act="google">Usar la foto de Google</button>` : ""}
            <button class="btn danger" data-act="remove">Quitar imagen</button>
            <input type="file" id="pf-file" accept="image/*" hidden>
          </div>
        </div>
        <p class="hint hint-after">Se recorta en cuadrado y se reduce automáticamente. Sin imagen, se muestra tu inicial.</p>
      </section>
      <section class="step">
        <h2><label for="pf-name">Nombre visible</label></h2>
        <input id="pf-name" class="input big" maxlength="40" value="${esc(st.name)}" autocomplete="nickname">
        <p class="hint hint-after">Es el nombre que verán los demás en las votaciones y en la tabla de participantes.</p>
      </section>
      <div class="profile-bar">
        <button class="btn primary big" id="pf-save">Guardar cambios</button>
        <div class="status" id="pf-status" role="alert"></div>
      </div>
    </div>`;

  const q = sel => $(sel, view);
  const drawAvatar = () => { q("#pf-avatar").innerHTML = avatarHTML(st.name, st.photo, 96, user.uid); };
  drawAvatar();

  async function save() {
    if (st.busy) return;
    const name = st.name.trim();
    const status = q("#pf-status");
    if (!name) { status.textContent = "Escribe el nombre que quieres mostrar."; q("#pf-name").focus(); return; }
    st.busy = true;
    const btn = q("#pf-save");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    status.textContent = "";
    try {
      await store.saveProfile(user.uid, { name, photo: st.photo, updatedAt: Date.now() });
      Object.assign(user, { name, photo: st.photo });
      ctx.onUserChange?.();

      // Llevar el cambio a todas las votaciones en las que participa.
      const polls = ctx.library.data?.polls || {};
      const ids = Object.keys(polls);
      const jobs = ids.map(id => store.updateParticipant(id, user.uid, { name, photo: st.photo }));
      ids.filter(id => polls[id].role === "owner").forEach(id => {
        jobs.push(store.updatePoll(id, { ownerName: name }));
        jobs.push(store.saveLibraryEntry(user.uid, id, { ownerName: name }));
      });
      await Promise.allSettled(jobs);
      toast(ids.length ? `Perfil guardado y actualizado en ${plural(ids.length, ["votación", "votaciones"])}` : "Perfil guardado");
    } catch (e) {
      status.textContent = "No se pudo guardar el perfil. " + errMsg(e);
    }
    st.busy = false;
    btn.disabled = false;
    btn.textContent = "Guardar cambios";
  }

  view.onclick = e => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === "upload") q("#pf-file").click();
    else if (act === "google") { st.photo = user.googlePhoto; drawAvatar(); }
    else if (act === "remove") { st.photo = ""; drawAvatar(); }
    else if (b.id === "pf-save") save();
  };

  view.oninput = e => {
    if (e.target.id !== "pf-name") return;
    st.name = e.target.value;
    if (!st.photo) drawAvatar(); // la inicial cambia con el nombre
  };

  view.onkeydown = e => {
    if (e.key === "Enter" && e.target.id === "pf-name") { e.preventDefault(); save(); }
  };

  view.onchange = async e => {
    if (e.target.id !== "pf-file") return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      st.photo = await imageToAvatar(file);
      drawAvatar();
      q("#pf-status").textContent = "";
    } catch (err) {
      q("#pf-status").textContent = err.message || "No se pudo leer la imagen.";
    }
  };

  return () => {};
}
