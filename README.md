### <div align="center">![android-chrome-192x192](https://github.com/user-attachments/assets/925b5437-2d04-4239-8751-d4e5e1184977)</div>

# <div align="center">Audiobookshelf Manager</div>

https://github.com/user-attachments/assets/d76ac1e3-0336-4069-b055-3960019ca918

A powerful management interface for Audiobookshelf servers. This application provides a consolidated dashboard for viewing, managing, and integrating Audiobookshelf libraries with other services.

## Features

- **Multi-Library Management**: View and manage multiple Audiobookshelf libraries from a single interface
- **Recent Media Dashboard**: Browse recently added audiobooks across all your libraries
- **Library Statistics**: Get comprehensive statistics about your audiobooks, authors, and series
- **Format Customization**: Configure how audiobook information is displayed
- **Homepage Integration**: Generate YAML for seamless integration with [Homepage Dashboard](https://gethomepage.dev)
- **API Gateway**: Provides simplified and enhanced API endpoints for your Audiobookshelf content
- **Docker Support**: Easy deployment with Docker

## Quick Start

1. Create a `docker-compose.yml`:

```yaml
version: '3'
services:
  audiobookshelf-manager:
    image: ghcr.io/10mfox/gethomepage-audiobookshelf-api:latest
    container_name: audiobookshelf-manager
    ports:
      - "3020:3020"
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```

Alternative configuration for Linux systems:

```yaml
version: "3"
services:
  audiobookshelf-manager:
    image: ghcr.io/10mfox/gethomepage-audiobookshelf-api:latest
    container_name: audiobookshelf-manager
    user: "1000:1000"  # Replace with your user ID and group ID	
    ports:
      - "3020:3020"
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```

2. Start the container:
```bash
docker compose up -d
```

### Environment Variables

Not Required

| Variable | Description | Default |
|----------|-------------|---------|
| `AUDIOBOOKSHELF_CUSTOM_PORT` | Port the application listens on | `3020` |
| `AUDIOBOOKSHELF_REFRESH_INTERVAL` | Data refresh interval in milliseconds | `60000` |
| `NODE_OPTIONS` | Node.js options | `--max-old-space-size=256` |

### Configuration

After starting the application, you'll need to configure your Audiobookshelf connection. Visit the application at `http://your-server-ip:3020/setup` and provide:

1. **Audiobookshelf Base URL**: The URL of your Audiobookshelf server (e.g., `http://192.168.1.10:13378`)
2. **Audiobookshelf API Key**: Your Audiobookshelf API token
3. **Homepage Integration IP**: The IP address for Homepage Dashboard integration (optional)
4. **Library Selection**: Choose which libraries to include in your dashboard

## Usage

### Recent Media View

The default view shows recently added media from all your configured libraries. You can:

- Toggle between library view and combined view
- View basic information about each audiobook
- Get a quick overview of your entire collection

### Libraries View

View detailed information about all your libraries:

- Total items, authors, and series for each library
- Media type breakdown
- Library status indicators

### Format Settings

Customize how your audiobook information is displayed:

- Configure primary and additional display formats
- Use variables like `${title}`, `${author_name}`, `${series_name}`, etc.
- Preview how your formats will look with actual media items
- Set formats globally or per library

### Homepage Integration

Generate YAML configuration for [Homepage Dashboard](https://gethomepage.dev) integration:

- Choose between split or combined views
- Configure count display options
- Generate ready-to-use YAML for your Homepage configuration

### API Endpoints

Access enhanced APIs for your Audiobookshelf data:

- **Raw Endpoints**: `/api/audiobooks/raw` - Pure, unmodified Audiobookshelf data
- **Processed Endpoints**: `/api/audiobooks/recent` - Enhanced data with additional fields
- **Formatted Endpoints**: `/api/formats` - Data processed through your custom templates
- **Health & Status**: `/api/health` - Application health monitoring

Full API documentation is available at `http://your-server-ip:3020/api`

## Homepage Dashboard Integration

Audiobookshelf Manager is designed to work seamlessly with [Homepage Dashboard](https://gethomepage.dev).

To integrate with Homepage:

1. Navigate to the "Homepage Config" page in Audiobookshelf Manager
2. Configure your display preferences
3. Copy the generated YAML
4. Paste it into your Homepage configuration file

The integration provides:

- Recently added books display
- Library statistics
- Customizable formats

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Audiobookshelf](https://www.audiobookshelf.org/) - The fantastic self-hosted audiobook server
- [Homepage Dashboard](https://gethomepage.dev) - For the dashboard integration
- All the contributors who have helped make this project better

---

Made with ❤️ for audiobook enthusiasts
