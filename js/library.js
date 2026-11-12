// Colección del usuario (sus votaciones y grupos) con una única suscripción compartida
// por el menú lateral y las pantallas.
export function createLibrary(store) {
  let uid = null, data = null, error = null, unsub = null;
  const subs = new Set();
  const emit = () => subs.forEach(fn => fn(data, error));

  return {
    start(user) {
      if (user?.uid === uid) return;
      this.stop();
      if (!user) return;
      uid = user.uid;
      unsub = store.watchLibrary(uid,
        d => { data = d; error = null; emit(); },
        e => { error = e; emit(); });
    },
    stop() {
      unsub?.();
      unsub = null;
      uid = null;
      data = null;
      error = null;
    },
    get data() { return data; },
    // fn(data, error); se llama al momento si ya hay datos.
    subscribe(fn) {
      subs.add(fn);
      if (data || error) fn(data, error);
      return () => subs.delete(fn);
    },
  };
}
