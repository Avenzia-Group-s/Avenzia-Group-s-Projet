const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { bg: v("bg"), side: v("side"), surface: v("surface"), surface2: v("surface2"), line: v("line"),
      txt: v("txt"), muted: v("muted"), accent: v("accent"), ok: v("ok"), danger: v("danger"), warn: v("warn") },
    fontFamily: { sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"] },
  } },
};
