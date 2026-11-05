/** Real markup/canvas integration using captured WebMCP registrations. Requires Playwright and PHP. */
const { chromium } = require( 'playwright' );
const { execFileSync } = require( 'node:child_process' );
const fs = require( 'node:fs/promises' );
const path = require( 'node:path' );
const assert = require( 'node:assert/strict' );
const root = path.resolve( __dirname, '..' );
( async () => {
	const html = execFileSync( 'php', [ path.join( __dirname, 'webmcp-fixture.php' ) ], { encoding: 'utf8' } );
	const browser = await chromium.launch( { headless: true, ...( process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {} ), args: [ '--enable-features=WebMCP' ] } );
	try {
		const page = await browser.newPage( { acceptDownloads: true } );
		const errors = []; page.on( 'pageerror', ( error ) => errors.push( error.message ) );
		await page.route( 'http://localhost:8173/**', async ( route ) => {
			const pathname = new URL( route.request().url() ).pathname;
			if ( pathname === '/' ) { await route.fulfill( { contentType: 'text/html', body: html } ); return; }
			if ( ! pathname.startsWith( '/assets/' ) || pathname.includes( '..' ) ) { await route.abort(); return; }
			const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
			await route.fulfill( { contentType: types[ path.extname( pathname ) ] || 'application/octet-stream', body: await fs.readFile( path.join( root, pathname ) ) } );
		} );
		await page.addInitScript( ( native ) => {
			window.nativeWebMCPAvailable = !! document.modelContext;
			window.capturedTools = {};
			if ( native ) { return; }
			Object.defineProperty( document, 'modelContext', { configurable: true, value: { registerTool: async ( tool ) => { window.capturedTools[ tool.name ] = tool; } } } );
		}, !! process.env.WEBMCP_NATIVE );
		await page.goto( 'http://localhost:8173/' );
		await page.waitForFunction( async ( native ) => native ? document.modelContext && ( await document.modelContext.getTools() ).length === 8 : Object.keys( window.capturedTools ).length === 8, !! process.env.WEBMCP_NATIVE, { timeout: 10000 } );
		const invoke = async ( name, args ) => {
			const result = await page.evaluate( async ( { name, args } ) => window.capturedTools[ name ] ? window.capturedTools[ name ].execute( args ) : document.modelContext.executeTool( ( await document.modelContext.getTools() ).find( ( tool ) => tool.name === name ), args ), { name, args } );
			return typeof result === 'string' ? JSON.parse( result ) : result;
		};
		await page.locator( '#wpbr-title' ).focus();
		assert.equal( ( await invoke( 'update_event', { city: 'Curitiba', title: 'Agent controlled meetup', header: 'Custom heading', date: '2026-11-12', time: '19:00', venue: 'Community Hall', link: 'https://example.com/register' } ) ).status, 'updated' );
		assert.equal( await page.locator( '#wpbr-title' ).inputValue(), 'Agent controlled meetup' );
		assert.equal( await page.locator( '#wpbr-header' ).inputValue(), 'Custom heading' );
		assert.equal( ( await invoke( 'configure_artwork', { theme: 'dark', format: 'Square' } ) ).status, 'updated' );
		assert.equal( await page.locator( '#wpbr-canvas' ).getAttribute( 'width' ), '1080' );
		assert.equal( await page.locator( '[data-format="quadrado"]' ).getAttribute( 'aria-checked' ), 'true' );
		assert.equal( await page.locator( '[data-field="theme"][value="dark"]' ).isChecked(), true );
		assert.equal( ( await invoke( 'update_event', { title: 'Invalid update', time: '25:00' } ) ).code, 'INVALID_INPUT' );
		assert.equal( await page.locator( '#wpbr-title' ).inputValue(), 'Agent controlled meetup' );
		await page.locator( '#wpbr-talks input[type="file"]' ).setInputFiles( { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64' ) } );
		await page.waitForFunction( () => document.querySelector( '#wpbr-talks .wpbr-photo__button img' ).src.startsWith( 'data:image/' ) );
		const photo = await page.locator( '#wpbr-talks .wpbr-photo__button img' ).getAttribute( 'src' );
		const first = ( await invoke( 'read_artwork', { section: 'talks' } ) ).items[ 0 ];
		assert.equal( ( await invoke( 'edit_artwork_items', { changes: [ { kind: 'talk', action: 'update', index: 1, expected_name: first.speaker, title: 'Blocks', speaker: 'Ana' }, { kind: 'sponsor', action: 'add', name: 'Example Agency' } ] } ) ).status, 'updated' );
		assert.equal( await page.locator( '#wpbr-talks [data-key="speaker"]' ).inputValue(), 'Ana' );
		assert.equal( await page.locator( '#wpbr-talks .wpbr-photo__button img' ).getAttribute( 'src' ), photo );
		assert.equal( await page.locator( '#wpbr-sponsors [data-key="name"]' ).inputValue(), 'Example Agency' );
		assert.equal( ( await invoke( 'initiate_image_selection', { target: 'watermark' } ) ).status, 'requires_user_action' );
		assert.equal( await page.locator( '#wpbr-watermark' ).evaluate( ( el ) => el === document.activeElement && ! el.closest( '[hidden]' ) ), true );
		const copy = await invoke( 'read_announcement', { network: 'whatsapp' } );
		assert.ok( copy.text.includes( 'Agent controlled meetup' ) ); assert.equal( copy.missing_fields.length, 0 );
		const downloadPromise = page.waitForEvent( 'download' );
		assert.equal( ( await invoke( 'download_artwork', {} ) ).status, 'download_requested' );
		const download = await downloadPromise; assert.match( download.suggestedFilename(), /quadrado-dark\.png$/ );
		const png = await fs.readFile( await download.path() ); assert.equal( png.subarray( 1, 4 ).toString(), 'PNG' );
		await page.waitForFunction( () => JSON.parse( localStorage.getItem( 'wpbr-artes-state-v1' ) || '{}' ).title === 'Agent controlled meetup' );
		// Feature detection must leave all manual controls working on other browsers.
		const nativeAvailable = await page.evaluate( () => window.nativeWebMCPAvailable );
		await page.addInitScript( () => Object.defineProperty( document, 'modelContext', { configurable: true, value: undefined } ) );
		await page.reload();
		await page.locator( '#wpbr-title' ).fill( 'Manual control still works' );
		await page.locator( '[data-format="status"]' ).click();
		await page.waitForFunction( () => document.querySelector( '#wpbr-canvas' ).height === 1920 );
		assert.equal( await page.locator( '#wpbr-title' ).inputValue(), 'Manual control still works' );
		assert.equal( errors.length, 0, errors.join( '\n' ) );
		console.log( JSON.stringify( { result: 'PASS', registered_tools: 8, nativeWebMCPAvailable: nativeAvailable, browser: browser.version(), png_bytes: png.length, checks: 'focused fields, preview size, format selection, lists, upload handoff, copy, PNG download, persistence, no page errors' } ) );
	} finally { await browser.close(); }
} )().catch( ( error ) => { console.error( error ); process.exitCode = 1; } );
