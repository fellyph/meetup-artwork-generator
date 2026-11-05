# Meetup Artwork Generator

[![Open in WordPress Playground](https://img.shields.io/badge/Open%20in-WordPress%20Playground-3858e9?logo=wordpress&logoColor=white)](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/caiohferreiradev/meetup-artwork-generator/main/playground/blueprint.json)

Standardized artwork and announcement texts for WordPress community meetups, ready for Meetup.com, Facebook, Instagram, LinkedIn, X and WhatsApp. Made by and for the WordPress community in Brazil, usable anywhere.

![Example artwork](.github/preview.png)

## Try it

Click **Open in WordPress Playground** above. A WordPress site opens in your browser with the generator as the front page. Nothing to install, and nothing you fill in leaves your browser.

To run it on your own computer:

```bash
tools/build-playground-bundle.sh
npx @wp-playground/cli server --blueprint=dist/meetup-artwork-generator-playground.zip
```

Or install the plugin on any WordPress 6.5+ site: download the zip from [Releases](https://github.com/caiohferreiradev/meetup-artwork-generator/releases) and upload it in **Plugins → Add New → Upload Plugin**. On activation the generator becomes the front page; deactivating restores the previous one.

## What organizers get

- A guided form: city (searchable), event type, date, time and time zone, meetup title, talks with speaker photos, venue and supporter logos.
- A live preview and PNG downloads in 7 formats: Meetup.com, Facebook event cover, link post, X, square, portrait and Status/Stories.
- Light and dark artwork, with a local landmark silhouette or your own image as a watermark.
- Ready-to-copy announcement texts for each network, following its best practices.
- Portuguese, English and Spanish, following the browser language.

## Contributing

Contributions are welcome, especially from communities outside Brazil.

- **New city or landmark:** add the city to `includes/cities.php` and a single-color SVG to `assets/landmarks/`. See the FAQ in [`readme.txt`](readme.txt).
- **New language:** start from `languages/meetup-artwork-generator.pot`, add your translations to `tools/translations.py` and run `python3 tools/translations.py .`
- **Bugs and ideas:** open an issue.

## Português

Gerador de artes e textos de divulgação para meetups das comunidades WordPress. Clique em **Open in WordPress Playground** para usar no navegador; o gerador abre no idioma do seu navegador e dá para trocar no topo da página.

## License

GPL-2.0-or-later. Fonts: Inter and IBM Plex Mono, SIL Open Font License 1.1 (see `assets/fonts/`).

## Browser agent support

WebMCP-enabled browsers can inspect and update event details, manage talks and
sponsors, adjust artwork, request PNG downloads and read announcement drafts.
Local image selection stays with the user. Browsers without WebMCP keep the same
manual controls. See [tools, boundaries and verification](docs/webmcp/README.md).
