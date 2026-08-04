
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "OneClick",
    short_name: "OneClick",
    description:
      "Sistem pelaporan & monitoring operasional bandara yang cepat dan bisa offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f6fbf8",
    theme_color: "#0f766e",
    lang: "id",
    dir: "ltr",
    categories: ["business", "productivity", "utilities"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/pwa-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/pwa-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/login-install.png",
        sizes: "1440x1080",
        type: "image/png",
        label: "Halaman login Gapura untuk akses cepat dari layar utama.",
        form_factor: "wide",
      },
      {
        src: "/screenshots/public-report-install.png",
        sizes: "1440x1080",
        type: "image/png",
        label: "Form public report untuk pelaporan cepat dari perangkat mobile.",
        form_factor: "wide",
      },

      {
        src: "/screenshots/login-narrow.png",
        sizes: "750x1334",
        type: "image/png",
        label: "Halaman login Gapura di perangkat mobile.",
        form_factor: "narrow",
      },
      {
        src: "/screenshots/public-report-narrow.png",
        sizes: "750x1334",
        type: "image/png",
        label: "Form pelaporan cepat di perangkat mobile.",
        form_factor: "narrow",
      },
    ],
    share_target: {
      action: "/auth/public-report",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    shortcuts: [
      {
        name: "Laporkan Insiden",
        short_name: "Lapor",
        url: "/auth/public-report",
        icons: [
          {
            src: "/icons/pwa-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
