import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { EditorPage } from './pages/EditorPage'
import { LaunchPage } from './pages/LaunchPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LaunchPage />} />
        <Route path="/admin" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}
