/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                // Semantic aliases backed by CSS custom properties (see index.css)
                surface: "var(--color-bg-surface)",
                elevated: "var(--color-bg-elevated)",
                gain: "var(--color-gain)",
                loss: "var(--color-loss)",
                alert: "var(--color-alert)",
            },
        },
    },
    plugins: [],
};
