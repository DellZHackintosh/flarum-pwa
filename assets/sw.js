importScripts("assets/extensions/askvortsov-pwa/idb.js");

const image =
  /^(https?):\/\/[^\s/$.?#].[^\s]*\.(gif|jpg|jpeg|tiff|png|svg|webp)$/;
const keyFile =
  /^(https?):\/\/[^\s/$.?#].[^\s]*\.(js|css|woff|woff2|ttf|otf)(?:\?.*)?$/;

const dbPromise = idb.openDB("keyval-store", 1, {
  upgrade(db) {
    db.createObjectStore("keyval");
  },
});

const idbKeyval = {
  async get(key) {
    return (await dbPromise).get("keyval", key);
  },
  async set(key, val) {
    return (await dbPromise).put("keyval", val, key);
  },
  async delete(key) {
    return (await dbPromise).delete("keyval", key);
  },
  async clear() {
    return (await dbPromise).clear("keyval");
  },
  async keys() {
    return (await dbPromise).getAllKeys("keyval");
  },
};

const imgDBPromise = idb.openDB("images-store", 1, {
  upgrade(db) {
    db.createObjectStore("images");
  },
});

const imgStore = {
  async get(key) {
    return (await imgDBPromise).get("images", key);
  },
  async set(key, val) {
    return (await imgDBPromise).put("images", val, key);
  },
  async delete(key) {
    return (await imgDBPromise).delete("images", key);
  },
  async clear() {
    return (await imgDBPromise).clear("images");
  },
  async keys() {
    return (await imgDBPromise).getAllKeys("images");
  },
};

const pageCACHE = "pwa-page";
const keyFilesCache = "key-files";

const forumPayload = {};

const fallbackResponse = new Response("Network error happened", {
  status: 408,
  headers: { "Content-Type": "text/plain" },
});

// Replace the following with the correct offline fallback page i.e.: const offlineFallbackPage = "offline";
const offlineFallbackPage = "offline";

// Install stage sets up the offline page in the cache and opens a new cache
self.addEventListener("install", function (event) {
  console.log("[PWA] Install event processing...");

  event.waitUntil(
    caches.open(pageCACHE).then(function (cache) {
      console.log("[PWA] Cached offline page during install.");

      return cache.add(offlineFallbackPage);
    })
  );

  const receiveInfo = async () => {
    const payload = await idbKeyval.get("flarum.forumPayload");
    Object.assign(forumPayload, payload);
  };

  receiveInfo();
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[PWA] Activate event processing...");
  event.waitUntil(
    new Promise((resolve) => {
      resolve((async () => {
        const cache = await caches.open(keyFilesCache);
        const fileList = await cache.keys();
        return fileList.forEach((file) => {
          cache.delete(file);
          console.log("[PWA] Removed", file);
        });
      })());
    }).then(() => clients.claim())
  );
});

// If any fetch fails, it will show the offline page.
self.addEventListener("fetch", function (event) {
  if (image.test(event.request.url)) {
    event.respondWith(
      imgStore
        .get(event.request.url)
        .then((res) => {
          if (!res) {
            return (async () => {
              const fetchResponse = await fetch(event.request);
              imgStore.set(
                event.request.url,
                await fetchResponse.clone().blob()
              );
              return fetchResponse;
            })();
          } else return new Response(res);
        })
        .catch((error) => {
          throw error;
          return fallbackResponse;
        })
    );
    return;
  }
  if (keyFile.test(event.request.url)) {
    event.respondWith(
      caches
        .open(keyFilesCache)
        .then((cache) => {
          return cache.match(event.request);
        })
        .then((res) => {
          if (forumPayload.debug && forumPayload.clockworkEnabled) {
            return fetch(event.request);
          }
          if (!res)
            return (async () => {
              const fetchResponse = await fetch(event.request);
              await caches.open(keyFilesCache).then((cache) => {
                cache.put(event.request, fetchResponse.clone());
              });
              return fetchResponse;
            })();

          return res;
        })
        .catch((error) => {
          throw error;
          return fallbackResponse;
        })
    );
    return;
  }
  event.respondWith(
    (async () => {
      return (await caches.open(keyFilesCache))
        .match(event.request)
        .then((res) => {
          if (
            event.request.method !== "GET" ||
            (forumPayload.debug && forumPayload.clockworkEnabled) ||
            !res
          ) {
            return fetch(event.request);
          }

          return res;
        })
        .catch((error) => {
          // The following validates that the request was for a navigation to a new document
          if (
            event.request.destination !== "document" ||
            event.request.mode !== "navigate"
          ) {
            throw error;
          }

          return caches.open(pageCACHE).then(function (cache) {
            return cache.match(offlineFallbackPage);
          });
        });
    })()
  );
});

// This is an event that can be fired from your page to tell the SW to update the offline page
self.addEventListener("refreshOffline", function () {
  const offlinePageRequest = new Request(offlineFallbackPage);

  return fetch(offlineFallbackPage).then(function (response) {
    return caches.open(pageCACHE).then(function (cache) {
      console.log(
        "[PWA] Offline page updated from refreshOffline event: " + response.url
      );
      return cache.put(offlinePageRequest, response);
    });
  });
});

self.addEventListener("push", function (event) {
  function isJSON(str) {
    try {
      return JSON.parse(str) && !!str;
    } catch (e) {
      return false;
    }
  }

  if (isJSON(event.data.text())) {
    console.log(event.data.json());

    if ("clearAppBadge" in navigator)
      (async () => {
        const Badges = (await idbKeyval.get("Badges")) + 1;
        await idbKeyval.set("Badges", Badges);
        navigator.setAppBadge(Badges);
      })();

    const options = {
      body: event.data.json().content,
      icon: event.data.json().icon,
      badge: event.data.json().badge,
      data: {
        link: event.data.json().link,
      },
    };

    const promiseChain = self.registration.showNotification(
      event.data.json().title,
      options
    );

    event.waitUntil(promiseChain);
  } else {
    console.log("This push event has no data.");
  }
});

self.addEventListener("notificationclick", function (event) {
  const clickedNotification = event.notification;
  clickedNotification.close();

  if (event.notification.data && event.notification.data.link) {
    const promiseChain = clients.openWindow(event.notification.data.link);
    event.waitUntil(promiseChain);
  }
});
