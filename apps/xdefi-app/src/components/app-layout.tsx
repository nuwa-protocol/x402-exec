import { Outlet } from 'react-router'
import AppFooter from './app-footer'
import { AppNav } from './app-nav'

export function AppLayout() {
    return (
        <div className="min-h-screen flex flex-col w-full ~bg-muted/50">
            <AppNav />
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex flex-grow flex-col pt-20">
                <div className='flex flex-grow flex-col'>
                    <Outlet />
                </div>
                <AppFooter />
            </div>
        </div>
    )
}
