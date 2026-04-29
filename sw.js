const CACHE_NAME = 'laulabiisi-v1'; // Päivitä aina versio, kun muutat ASSETS-listaa

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './kuva.png',
  './sessionSet01.js',
  // ... muut tiedostot ...
  './extrasetti5.js'
];

// 1. Asennusvaihe
self.addEventListener('install', (event) => {
  // PAKOTA uusi SW aktiiviseksi heti latauksen jälkeen
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Tallennetaan tiedostot välimuistiin...');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Aktivointivaihe
self.addEventListener('activate', (event) => {
  // Ota kontrolli kaikista avoimista välilehdistä välittömästi
  event.waitUntil(clients.claim()); 

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Poistetaan vanha välimuisti:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. Pyyntöjen käsittely (Verkko ensin -strategia on usein varmempi kehitysvaiheessa)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
