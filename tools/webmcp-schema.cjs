// Export the exact runtime schema for model evaluations (no separate schema to drift).
const fs = require( 'node:fs' );
const vm = require( 'node:vm' );
const path = require( 'node:path' );
const root = path.resolve( __dirname, '..' );
const context = { window: {} };
vm.runInNewContext( fs.readFileSync( path.join( root, 'assets/js/webmcp.js' ), 'utf8' ), context );
const output = JSON.stringify( { tools: context.window.WPBRArtesWebMCP.definitions }, null, 2 ) + '\n';
const target = path.join( root, 'docs/webmcp/schema.json' );
if ( process.argv.includes( '--check' ) ) {
	if ( fs.readFileSync( target, 'utf8' ) !== output ) { throw new Error( 'Regenerate schema: node tools/webmcp-schema.cjs' ); }
} else { fs.writeFileSync( target, output ); }
