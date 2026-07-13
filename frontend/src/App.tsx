import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CompaniesPage from './pages/CompaniesPage';
import CompanyFormPage from './pages/CompanyFormPage';
import LlmConfigPage from './pages/LlmConfigPage';
import SearchConfigsPage from './pages/SearchConfigsPage';
import JobDescriptionPage from './pages/JobDescriptionPage';
import QueuePage from './pages/QueuePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/companies" replace />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="companies/new" element={<CompanyFormPage />} />
          <Route path="companies/edit/:id" element={<CompanyFormPage />} />
          <Route path="settings/llm" element={<LlmConfigPage />} />
          <Route path="search-configs" element={<SearchConfigsPage />} />
          <Route path="jobs/:id" element={<JobDescriptionPage />} />
          <Route path="queue" element={<QueuePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
