/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0B74E0',
        primaryDark: '#065FA8',
        secondary: '#4B5563',
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
        background: '#F7F9FB',
      },
    },
  },
  plugins: [],
};

