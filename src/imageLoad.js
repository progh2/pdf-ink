/** #428: 최초 요청자뿐 아니라 같은 이미지를 기다리는 모든 화면이 완료를 받는다. */
export function createImageLoadCache(load, dispose = () => {}) {
  const entries = new Map();
  return {
    get(src, onReady) {
      if (!src) return null;
      let entry = entries.get(src);
      if (!entry) {
        entry = { img: null, ready: false, settled: false, disposed: false, error: null };
        entries.set(src, entry);
        entry.promise = Promise.resolve().then(() => load(src)).then(
          (img) => {
            if (entry.disposed) dispose(img);
            else {
              entry.img = img;
              entry.ready = true;
            }
          },
          (error) => { entry.error = error; },
        ).finally(() => { entry.settled = true; }).then(() => entry);
      }
      if (!entry.settled && onReady) {
        entry.promise.then(() => {
          if (!entry.disposed) onReady();
        }).catch(() => {});
      }
      return entry;
    },
    clear() {
      for (const entry of entries.values()) {
        entry.disposed = true;
        if (entry.img) dispose(entry.img);
        entry.img = null;
        entry.ready = false;
      }
      entries.clear();
    },
  };
}
