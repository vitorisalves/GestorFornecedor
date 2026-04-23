/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Service Worker Minimal para PWA e Notificações
const CACHE_NAME = 'gestor-prod-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Apenas passa adiante, focado em notificações por enquanto
  event.respondWith(fetch(event.request));
});

// Listener para Push (caso usemos um servidor de push no futuro)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nova Notificação';
  const options = {
    body: data.message || 'Você recebeu uma nova atualização.',
    icon: '/favicon.ico',
    badge: '/favicon.ico'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
