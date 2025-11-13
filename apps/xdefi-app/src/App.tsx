import { BrowserRouter, HashRouter } from 'react-router'
import { ThemeProvider } from './contexts/ThemeContext'
import { NetworkModeProvider } from './contexts/NetworkModeContext'
import { Web3Provider } from './contexts/Web3Provider'
import Router from './Router'

const AppRouter = import.meta.env.VITE_USE_HASH_ROUTE === 'true' ? HashRouter : BrowserRouter

export default function App() {
    return (
        <ThemeProvider>
            <NetworkModeProvider>
                <Web3Provider>
                    <AppRouter>
                        <Router />
                    </AppRouter>
                </Web3Provider>
            </NetworkModeProvider>
        </ThemeProvider>
    )
}
