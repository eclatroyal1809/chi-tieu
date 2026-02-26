import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Có phiên bản mới. Bạn có muốn cập nhật không?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Ứng dụng đã sẵn sàng để sử dụng ngoại tuyến');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);