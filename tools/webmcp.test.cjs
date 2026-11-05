const { test } = require( 'node:test' );
const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const vm = require( 'node:vm' );
const source = fs.readFileSync( require( 'node:path' ).join( __dirname, '../assets/js/webmcp.js' ), 'utf8' );
function setup( modelContext ) {
	const events = {};
	const context = { window: { addEventListener: ( name, callback ) => { events[ name ] = callback; } }, document: { modelContext }, AbortController, URL, setTimeout };
	vm.runInNewContext( source, context );
	const api = context.window.WPBRArtesWebMCP;
	let state = { city: 'curitiba', title: 'Original', date: '', time: '', tz: 'BRT', link: '', venue: '', mode: 'presencial', format: 'square', watermark: '', talks: [ { title: 'Blocks', speaker: 'Ana', photo: 'keep-photo' } ], sponsors: [ { name: 'Agency', logo: 'keep-logo' } ] };
	let rendered = 0;
	const app = { config: { cities: [ { id: 'curitiba', name: 'Curitiba' } ], formats: [ { id: 'square', label: 'Square', width: 1080, height: 1080 } ], landmarks: { garden: { name: 'Garden' } } }, getState: () => state, cityName: () => 'Curitiba', updateEvent: async ( fields ) => { Object.assign( state, fields ); await Promise.resolve(); rendered++; }, updateItems: async ( fields ) => { Object.assign( state, fields ); rendered++; }, configure: async ( fields ) => { Object.assign( state, fields ); rendered++; }, download: async () => {}, announcements: () => [ { id: 'whatsapp', text: 'a"\n'.repeat( 2000 ), missing: true } ], focusImage: async () => {} };
	const tools = api.createTools( app );
	const run = ( name, args, options ) => tools.find( ( tool ) => tool.name === name ).execute( args, options );
	return { api, app, run, events, tools, state, rendered: () => rendered };
}
test( 'event patch validates all inputs before mutation and awaits rendering', async () => {
	const s = setup();
	assert.equal( ( await s.run( 'update_event', { title: 'Changed', time: '25:00' } ) ).code, 'INVALID_INPUT' );
	assert.equal( s.state.title, 'Original' );
	assert.equal( ( await s.run( 'update_event', { title: 'Changed', date: '2026-02-30' } ) ).code, 'INVALID_INPUT' );
	assert.equal( ( await s.run( 'update_event', { title: 'Changed', link: 'javascript:alert(1)' } ) ).code, 'INVALID_INPUT' );
	assert.equal( ( await s.run( 'update_event', { title: 'Changed' } ) ).status, 'updated' );
	assert.equal( s.state.title, 'Changed' ); assert.equal( s.state.tz, 'BRT' ); assert.equal( s.rendered(), 1 );
	assert.equal( ( await s.run( 'update_event', JSON.parse( '{"__proto__":{}}' ) ) ).code, 'INVALID_INPUT' );
} );
test( 'batch edits are atomic, protect stale entries, retain images and reorder', async () => {
	const s = setup();
	const update = { kind: 'talk', action: 'update', index: 1, expected_name: 'Ana', speaker: 'Bruno' };
	assert.equal( ( await s.run( 'edit_artwork_items', { changes: [ update, { kind: 'sponsor', action: 'remove', index: 3, expected_name: 'missing' } ] } ) ).code, 'INVALID_INPUT' );
	assert.equal( s.state.talks[ 0 ].speaker, 'Ana' );
	await s.run( 'edit_artwork_items', { changes: [ update, { kind: 'talk', action: 'add', title: 'Themes', speaker: 'Carla' }, { kind: 'talk', action: 'move', index: 2, expected_name: 'Carla', position: 1 } ] } );
	assert.equal( s.state.talks[ 0 ].speaker, 'Carla' ); assert.equal( s.state.talks[ 1 ].photo, 'keep-photo' );
	assert.equal( ( await s.run( 'edit_artwork_items', { changes: [ update ] } ) ).code, 'INVALID_INPUT' );
} );
test( 'copy pagination preserves exact long text and bounds escaped payloads', async () => {
	const s = setup(); let offset = 0; let output = '';
	do { const result = await s.run( 'read_announcement', { network: 'whatsapp', offset } ); assert.ok( JSON.stringify( result ).length <= 1500 ); output += result.text; offset = result.next_offset; assert.ok( result.missing_fields.includes( 'date' ) ); } while ( offset !== null );
	assert.equal( output, s.app.announcements()[ 0 ].text );
} );
test( 'catalog, appearance validation, image handoff and pure reads', async () => {
	const s = setup(); const before = JSON.stringify( s.state );
	assert.equal( ( await s.run( 'list_artwork_options', { kind: 'formats' } ) ).items[ 0 ].id, 'square' );
	assert.equal( ( await s.run( 'read_artwork', { section: 'talks' } ) ).items[ 0 ].has_image, true );
	assert.equal( JSON.stringify( s.state ), before );
	assert.equal( ( await s.run( 'configure_artwork', { theme: 'dark', format: 'Unknown' } ) ).code, 'INVALID_INPUT' ); assert.equal( s.state.theme, undefined );
	assert.equal( ( await s.run( 'configure_artwork', { landmark: 'custom' } ) ).code, 'INVALID_INPUT' );
	assert.equal( ( await s.run( 'configure_artwork', { theme: 'dark', format: 'Square' } ) ).status, 'updated' );
	assert.equal( ( await s.run( 'initiate_image_selection', { target: 'talk', index: 1, expected_name: 'Ana' } ) ).status, 'requires_user_action' );
} );
test( 'relative dates resolve locally and unsupported phrases return guidance', () => {
	const { api } = setup(); const now = new Date( 2026, 10, 5, 12 );
	assert.equal( api.resolveDate( 'tomorrow', now ), '2026-11-06' );
	assert.equal( api.resolveDate( 'próxima sexta-feira', now ), '2026-11-06' );
	assert.equal( api.resolveDate( 'el próximo lunes', now ), '2026-11-09' );
	assert.throws( () => api.resolveDate( 'sometime next week', now ), /exact calendar date/ );
} );
test( 'cancellation and concurrent execution do not silently perform edits', async () => {
	const s = setup(); const controller = new AbortController(); controller.abort();
	assert.equal( ( await s.run( 'update_event', { title: 'No' }, { signal: controller.signal } ) ).code, 'CANCELLED' );
	assert.equal( s.state.title, 'Original' );
	let finish; s.app.updateEvent = () => new Promise( ( resolve ) => { finish = resolve; } );
	const pending = s.run( 'update_event', { title: 'Pending' } );
	assert.equal( ( await s.run( 'read_artwork', { section: 'event' } ) ).code, 'BUSY' );
	finish(); await pending;
} );
test( 'download errors preserve completed count and never claim saved files', async () => {
	const s = setup();
	assert.equal( ( await s.run( 'download_artwork', {} ) ).status, 'download_requested' );
	s.app.download = async () => { throw new Error( 'PNG failed' ); };
	const result = await s.run( 'download_artwork', {} ); assert.equal( result.code, 'DOWNLOAD_FAILED' ); assert.equal( result.requested_count, 0 );
} );
test( 'registration is optional, cleans up on page exit and preserves BFCache', async () => {
	const noSupport = setup(); await noSupport.api.register( noSupport.app );
	const captured = []; const s = setup( { registerTool: async ( tool, options ) => captured.push( { tool, options } ) } );
	await s.api.register( s.app ); assert.equal( captured.length, 8 );
	assert.equal( ( await captured[ 2 ].tool.execute( { title: 'Registered' } ) ).status, 'updated' );
	s.events.pagehide( { persisted: true } ); assert.equal( captured[ 0 ].options.signal.aborted, false );
	s.events.pagehide( { persisted: false } ); assert.equal( captured[ 0 ].options.signal.aborted, true );
} );
test( 'partial registration failure aborts all registered tools', async () => {
	let signal; let count = 0;
	const s = setup( { registerTool: async ( tool, options ) => { signal = options.signal; if ( ++count === 2 ) { throw new Error( 'denied' ); } } } );
	await s.api.register( s.app ); assert.equal( signal.aborted, true );
} );
test( 'schema names, descriptions and annotations meet budgets', () => {
	for ( const tool of setup().tools ) {
		assert.ok( tool.name.length <= 30 ); assert.ok( tool.description.length <= 500 );
		for ( const value of Object.values( tool.annotations || {} ) ) { assert.equal( value, true ); }
		function inspect( schema ) { if ( schema.description ) { assert.ok( schema.description.length <= 150 ); } for ( const [ key, value ] of Object.entries( schema.properties || {} ) ) { assert.ok( key.length <= 30 ); inspect( value ); } if ( schema.items ) { inspect( schema.items ); } }
		inspect( tool.inputSchema );
	}
} );
test( 'oversized stored fields use exact JSON continuation rather than truncation', async () => {
	const s = setup(); s.state.talks[ 0 ].title = '"\n'.repeat( 3000 );
	let offset = 0; let output = '';
	do { const result = await s.run( 'read_artwork', { section: 'talks', offset } ); assert.ok( JSON.stringify( result ).length <= 1500 ); assert.equal( result.encoding, 'json' ); output += result.text; offset = result.next_offset; } while ( offset !== null );
	assert.equal( JSON.parse( output ).title, s.state.talks[ 0 ].title );
} );
