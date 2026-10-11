/*
 * Hausfußball / LitePush Service Worker
 *
 * Datei:
 * /Hausfussball/litepush-sw.js
 */

const APP_CACHE = "hausfussball-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.svg",
  "./icon-512.svg",
  "./live.html"
];

self.addEventListener("install", function(event){
  console.log("[Hausfußball] LitePush/PWA Service Worker installiert.");

  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(error => {
        console.warn("[Hausfußball] Offline-Cache konnte nicht vollständig angelegt werden:", error);
      })
  );

  self.skipWaiting();
});


self.addEventListener("activate", function(event){
  console.log("[Hausfußball] LitePush/PWA Service Worker aktiviert.");

  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("hausfussball-shell-") && key !== APP_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});


self.addEventListener("fetch", function(event){
  const request = event.request;
  if(request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if(requestUrl.origin !== self.location.origin) return;
  if(requestUrl.pathname.includes("/api/")) return;

  if(request.mode === "navigate"){
    event.respondWith(
      fetch(request)
        .then(response => {
          if(response && response.ok){
            const copy = response.clone();
            caches.open(APP_CACHE).then(cache => cache.put("./", copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(APP_CACHE);
          return await cache.match(request) || await cache.match("./") || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if(cached) return cached;
      return fetch(request).then(response => {
        if(response && response.ok){
          const copy = response.clone();
          caches.open(APP_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener("push", function(event){

  console.log(
    "[Hausfußball] Push empfangen.",
    event.data
  );


  let data = {};


  try{

    if(event.data){

      data =
        event.data.json();

    }

  }catch(error){

    try{

      data = {
        body:event.data.text()
      };

    }catch(e){

      data = {};

    }

  }


  /*
   * LitePush kann je nach Payload
   * unterschiedliche Felder liefern.
   */

  const title =
    data.title ||
    data.notification?.title ||
    data.payload?.title ||
    "⚽ Hausfußball";


  const body =
    data.body ||
    data.notification?.body ||
    data.payload?.body ||
    "Neues Ereignis bei Hausfußball.";


  const appBase = self.registration.scope;
  const defaultIcon = new URL("./icon-192.svg", appBase).href;
  const defaultAppUrl = new URL("./", appBase).href;

  const icon =
    data.icon ||
    data.notification?.icon ||
    defaultIcon;

  const badge =
    data.badge ||
    defaultIcon;

  const url =
    data.url ||
    data.notification?.url ||
    data.data?.url ||
    defaultAppUrl;


  const options = {

    body:body,

    icon:icon,

    badge:badge,

    tag:
      data.tag ||
      "hausfussball",

    renotify:true,

    data:{
      url:url
    }

  };


  event.waitUntil(

    self.registration.showNotification(
      title,
      options
    )

  );

});


self.addEventListener(
  "notificationclick",
  function(event){

    event.notification.close();


    const target =
      event.notification?.data?.url ||
      new URL("./", self.registration.scope).href;


    event.waitUntil(

      clients.matchAll({
        type:"window",
        includeUncontrolled:true
      })
      .then(function(clientList){

        for(
          const client of clientList
        ){

          if(
            "focus" in client
          ){

            return client.focus();

          }

        }


        if(
          clients.openWindow
        ){

          return clients.openWindow(
            target
          );

        }

      })

    );

  }
);
