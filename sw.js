const CACHE_NAME = 'laulabiisi-v2'; // Päivitä aina versio, kun muutat ASSETS-listaa

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './favicon.ico',
  './kuva.png',
  
  // Peruskirjastot ja testit
  './FinnishTunes.js',
  './FinnishTunes2.js',
  './suomitest3.js',
  './norway1.js',
  './swedish2.js',
  
  // Esävelmät-sarja
  './esavelmat_hs1.js',
  './esavelmat_kansantanssit.js',
  './esavelmat_kjs.js',
  './esavelmat_ls1.js',
  './esavelmat_ls2.js',
  './esavelmat_ls3.js',
  './esavelmat_ls4.js',
  './esavelmat_rs1.js',
  './esavelmat_rs2.js',
  
  // Folkwiki ja muut kokoelmat
  './folkwikiSet1.js',
  './folkwikiSet2.js',
  './folkwikiSet3.js',
  './fsfolkdiktning01.js',
  './fsfolkdiktning02.js',
  './extrasetti5.js',
  
  // SessionSet-sarja (01-18)
  './sessionSet01.js',
  './sessionSet02.js',
  './sessionSet03.js',
  './sessionSet04.js',
  './sessionSet05.js',
  './sessionSet06.js',
  './sessionSet07.js',
  './sessionSet08.js',
  './sessionSet09.js',
  './sessionSet10.js',
  './sessionSet11.js',
  './sessionSet12.js',
  './sessionSet13.js',
  './sessionSet14.js',
  './sessionSet15.js',
  './sessionSet16.js',
  './sessionSet17.js',
  './sessionSet18.js'
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
