import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CurriculumPage } from './pages/CurriculumPage.js';
import { TrackPage } from './pages/TrackPage.js';
import { ModulePage } from './pages/ModulePage.js';
import { PracticePage } from './pages/PracticePage.js';
import { PracticeSessionPage } from './pages/PracticeSessionPage.js';
import { SolveChallengePage } from './pages/SolveChallengePage.js';
import { CommunityPage } from './pages/CommunityPage.js';
import { ThreadDetailPage } from './pages/ThreadDetailPage.js';
import { SchedulePage } from './pages/SchedulePage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { RouteErrorBoundary } from './components/RouteErrorBoundary.js';
import './styles/tokens.css';
import './styles/components.css';
import './styles/base.css';
import './styles/chrome.css';
import './styles/legacy-widgets.css';
import './styles/components/focus-panel.css';
import './styles/components/streak.css';
import './styles/components/activity-feed.css';
import './styles/pages/login.css';
import './styles/pages/dashboard.css';
import './styles/pages/curriculum.css';
import './styles/pages/module.css';
import './styles/pages/practice-setup.css';
import './styles/pages/practice-session.css';
import './styles/pages/practice-report.css';
import './styles/pages/mock.css';
import './styles/pages/schedule.css';
import './styles/pages/community.css';
import './styles/pages/settings.css';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'curriculum', element: <CurriculumPage /> },
      { path: 'track/:trackId', element: <TrackPage /> },
      { path: 'track/:trackId/module/:moduleId', element: <ModulePage /> },
      { path: 'practice', element: <PracticePage /> },
      { path: 'practice/session', element: <PracticeSessionPage /> },
      { path: 'practice/challenge/:id', element: <SolveChallengePage /> },
      { path: 'community', element: <CommunityPage /> },
      { path: 'community/t/:id', element: <ThreadDetailPage /> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/:section', element: <SettingsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
