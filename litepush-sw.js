/*
 * Hausfußball / LitePush Service Worker
 *
 * Datei:
 * /Hausfussball/litepush-sw.js
 */

self.addEventListener("install", function(event){

  console.log(
    "[Hausfußball] LitePush Service Worker installiert."
  );

  self.skipWaiting();

});


self.addEventListener("activate", function(event){

  console.log(
    "[Hausfußball] LitePush Service Worker aktiviert."
  );

  event.waitUntil(
    self.clients.claim()
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


  const icon =
    data.icon ||
    data.notification?.icon ||
    "/Hausfussball/icon-192.png";


  const badge =
    data.badge ||
    "/Hausfussball/icon-192.png";


  const url =
    data.url ||
    data.notification?.url ||
    data.data?.url ||
    "/Hausfussball/";


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
      "/Hausfussball/";


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
