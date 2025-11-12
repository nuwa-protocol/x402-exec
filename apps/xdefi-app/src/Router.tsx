import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/app-layout'
import NotMatch from './pages/NotMatch'
import SwapPage from './pages/Swap'
import BridgePage from './pages/Bridge'
import FAQPage from './pages/FAQ'

export default function Router() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="" element={<SwapPage />} />
                <Route path="swap" element={<SwapPage />} />
                <Route path="bridge" element={<BridgePage />} />
                <Route path="faq" element={<FAQPage />} />
                <Route path="*" element={<NotMatch />} />
            </Route>
        </Routes>
    )
}
