import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<div style="padding: 20px; color: red;">未找到 #root 元素，请检查 index.html</div>';
  throw new Error('Could not find root element to mount to');
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  console.error('React 渲染错误:', e);
  rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">渲染错误: ${String(e)}</div>`;
}
