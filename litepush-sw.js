/* LitePush Service Worker */

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    self.clients.claim()
  );
});

self.addEventListener("push", event => {

  let data = {};

  try {

    if(event.data){

      data =
        event.data.json();

    }

  }catch(error){

    console.warn(
      "[Hausfußball Push] JSON konnte nicht gelesen werden:",
      error
    );

    try{

      data = {
        body:
          event.data
          ? event.data.text()
          : ""
      };

    }catch{

      data = {};

    }

  }


  const notification =
    data.notification || {};


  const title =
    data.title ||
    notification.title ||
    "⚽ Hausfußball";


  const body =
    data.body ||
    notification.body ||
    "Es gibt ein neues Ereignis.";


  const icon =
    data.icon ||
    notification.icon ||
    "/icon-192.png";


  const badge =
    data.badge ||
    notification.badge ||
    "/icon-192.png";


  const url =
    data.url ||
    notification.url ||
    "/";


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

    self.registration
      .showNotification(
        title,
        options
      )

  );

});


self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();

    const url =
      event.notification?.data?.url ||
      "/";


    event.waitUntil(

      self.clients
        .matchAll({
          type:"window",
          includeUncontrolled:true
        })
        .then(
          clientList => {

            for(
              const client
              of clientList
            ){

              if(
                "focus" in client
              ){

                client.navigate(url);

                return client.focus();

              }

            }


            if(
              self.clients.openWindow
            ){

              return self.clients
                .openWindow(url);

            }

          }
        )

    );

  }
);
