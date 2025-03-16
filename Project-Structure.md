Project Folder
│   Dockerfile
│   logger.js
│   package.json
│   Project-Structure.md
│   server.js
│
├───backend
│   ├───api
│   │       audiobooks.js
│   │       debug.js
│   │       formats.js
│   │       proxy.js
│   │
│   └───services
│           audiobookshelfService.js
│           background-refresh.js
│           cacheService.js
│           settings.js
│
├───config
│       settings.json
│
└───frontend
    │   package.json
    │   postcss.config.js
    │   tailwind.config.js
    │
    ├───public
    │       android-chrome-192x192.png
    │       android-chrome-512x512.png
    │       apple-touch-icon.png
    │       favicon-16x16.png
    │       favicon-32x32.png
    │       favicon.ico
    │       index.html
    │       manifest.json
    │       site.webmanifest
    │
    └───src
        │   App.js
        │   index.css
        │   index.js
        │
        └───components
            ├───api
            │       ApiEndpointsView.js
            │
            ├───dashboard
            │       RecentView.js
            │
            ├───layout
            │       Navbar.js
            │
            ├───libraries
            │       LibrariesView.js
            │
            ├───settings
            │       FormatSettingsView.js
            │       HomepageConfigView.js
            │
            └───setup
                    SetupView.js