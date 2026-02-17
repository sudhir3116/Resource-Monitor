/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            colors: {
                // Use standard Tailwind colors
                // Custom colors defined in CSS variables
            },
            spacing: {
                // 8px spacing system
                '0.5': '4px',
                '1': '8px',
                '2': '16px',
                '3': '24px',
                '4': '32px',
                '6': '48px',
            },
            'container': '1280px',
            animation: {
                'fade-in-down': 'fadeInDown 0.5s ease-out',
                'pulse-slow': 'pulse 3s infinite',
            },
            keyframes: {
                fadeInDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            },
        },
    },
    plugins: [],
};
