import localFont from 'next/font/local';
import '@/ui/tokens.css';
import '@/ui/hud.css';
import './globals.css';
const oxanium = localFont({
    variable: '--font-oxanium',
    src: [
        { path: '../assets/fonts/Oxanium-Regular.ttf', weight: '400' },
        { path: '../assets/fonts/Oxanium-Medium.ttf', weight: '500' },
        { path: '../assets/fonts/Oxanium-SemiBold.ttf', weight: '600' },
        { path: '../assets/fonts/Oxanium-Bold.ttf', weight: '700' },
    ],
});
const abhaya = localFont({
    variable: '--font-abhaya',
    src: [
        { path: '../assets/fonts/AbhayaLibre-Regular.ttf', weight: '400' },
        { path: '../assets/fonts/AbhayaLibre-Medium.ttf', weight: '500' },
        { path: '../assets/fonts/AbhayaLibre-SemiBold.ttf', weight: '600' },
        { path: '../assets/fonts/AbhayaLibre-Bold.ttf', weight: '700' },
    ],
});
export const metadata = {
    title: 'Evolution of the Microchip',
    description: 'Interactive microchip evolution exhibit, 1976 to 2026',
};
export const viewport = {
    width: 'device-width',
    initialScale: 1,
    userScalable: false,
};
export default function RootLayout({ children, }) {
    return (<html lang="en" className={`${oxanium.variable} ${abhaya.variable}`}>
      <body>{children}</body>
    </html>);
}
