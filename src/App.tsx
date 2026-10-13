import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Leads from './pages/Leads';
import Designs from './pages/Designs';
import Proposals from './pages/Proposals';
import ProposalView from './pages/ProposalView';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <Routes>
      {/* Customer-facing proposal: no app chrome */}
      <Route path="/proposals/:id" element={<ProposalView />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/:tab" element={<ProjectDetail />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/designs" element={<Designs />} />
        <Route path="/proposals" element={<Proposals />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}
