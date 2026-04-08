import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TrackPage } from './pages/TrackPage.js';
import { ModulePage } from './pages/ModulePage.js';
import { PracticePage } from './pages/PracticePage.js';
import { CommunityPage } from './pages/CommunityPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
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
      { path: 'practice', element: <PracticePage /> },
      { path: 'community', element: <CommunityPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/:section', element: <SettingsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
