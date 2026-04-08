import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TrackPage } from './pages/TrackPage.js';
import { ModulePage } from './pages/ModulePage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import './index.css';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'track/:trackId', element: <TrackPage /> },
      { path: 'track/:trackId/module/:moduleId', element: <ModulePage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
