import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Home } from './Home';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home 
      onEnterApp={() => console.log("Enter App")} 
      prefetching={false} 
      ready={true} 
    />
  </StrictMode>
);
