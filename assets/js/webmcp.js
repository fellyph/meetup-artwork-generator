/** Browser-tab agent controls. No remote requests or server-side changes. */
( function () {
	'use strict';
	const text = ( description, maxLength = 200 ) => ( { type: 'string', description, maxLength } );
	const choice = ( values, description ) => ( { type: 'string', enum: values, description } );
	const integer = ( description, minimum = 1 ) => ( { type: 'integer', minimum, description } );
	const object = ( properties, required = [] ) => ( { type: 'object', properties, required, additionalProperties: false } );
	const page = integer( 'Page number, starting at one.' );
	const read = { readOnlyHint: true };
	const untrusted = { readOnlyHint: true, untrustedContentHint: true };
	const definitions = [
		{ name: 'list_artwork_options', description: 'Lists available artwork choices. Use when resolving a city, format or landmark before editing.', annotations: read,
			inputSchema: object( { kind: choice( [ 'cities', 'formats', 'landmarks' ], 'Catalog to browse.' ), query: text( 'Optional name filter.' ), page, offset: integer( 'Continue an oversized catalog entry using next_offset.', 0 ) }, [ 'kind' ] ) },
		{ name: 'read_artwork', description: 'Reads the current draft without changing it. Use before revising existing details or identifying a talk or sponsor.', annotations: untrusted,
			inputSchema: object( { section: choice( [ 'event', 'appearance', 'talks', 'sponsors' ], 'Draft section to inspect.' ), page, offset: integer( 'Continue an oversized item using next_offset; concatenate text and parse the JSON.', 0 ) }, [ 'section' ] ) },
		{ name: 'update_event', description: 'Updates supplied event details and refreshes the preview, preserving other fields. Use when the user supplies or corrects meetup facts.',
			inputSchema: object( { city: text( 'City name as supplied by the user.', 100 ), mode: choice( [ 'presencial', 'online' ], 'In-person or online event.' ), edition: text( 'Edition number or label.', 6 ), header: text( 'Custom community heading; empty restores automatic text.', 50 ), subheader: text( 'Custom second heading; empty restores automatic text.', 40 ), date: text( 'Exact YYYY-MM-DD or user phrasing; supported relative dates are resolved locally.', 80 ), time: text( 'Local time HH:MM; ask for an exact time if ambiguous.', 5 ), tz: text( 'Displayed timezone abbreviation; no time conversion.', 6 ), title: text( 'Meetup theme/title.', 90 ), description: text( 'Optional event description.', 200 ), highlight: text( 'Footer highlight.', 60 ), venue: text( 'Venue and address.', 140 ), showVenue: { type: 'boolean', description: 'Show venue on the artwork.' }, link: text( 'Registration URL using https or http, or empty to clear.', 1000 ) } ) },
		{ name: 'edit_artwork_items', description: 'Edits talks and sponsors in a single validated batch while retaining images. Use to add, revise, reorder or remove entries the user specifies.',
			inputSchema: object( { changes: { type: 'array', minItems: 1, maxItems: 20, items: object( { kind: choice( [ 'talk', 'sponsor' ], 'Entry type.' ), action: choice( [ 'add', 'update', 'remove', 'move' ], 'Requested edit.' ), index: integer( 'Current one-based position; required except for add.' ), expected_name: text( 'Current speaker or sponsor name from read_artwork; required except for add.', 60 ), position: integer( 'Destination one-based position for move.' ), title: text( 'Talk title.', 80 ), speaker: text( 'Speaker name.', 60 ), name: text( 'Sponsor name.', 40 ) }, [ 'kind', 'action' ] ) } }, [ 'changes' ] ) },
		{ name: 'configure_artwork', description: 'Changes artwork styling and refreshes the preview. Use when adjusting the layout or visual treatment of an existing draft.',
			inputSchema: object( { theme: choice( [ 'light', 'dark' ], 'Artwork color theme.' ), format: text( 'Format name or ID from list_artwork_options.', 100 ), landmark: text( 'Landmark name or ID; none hides it, custom uses an already uploaded image.', 100 ), titleWeight: choice( [ '400', '700' ], 'Regular or bold title.' ) } ) },
		{ name: 'download_artwork', description: 'Requests PNG downloads from the current draft. Use only when the user asks to download artwork; the browser may require permission for multiple files.',
			inputSchema: object( { all: { type: 'boolean', description: 'Download all available formats; defaults to the selected format.' }, formats: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: text( 'Format name or ID from the catalog.', 100 ) } } ) },
		{ name: 'read_announcement', description: 'Reads exact generated announcement text and missing event facts. Use to review a draft for sharing, continuing through long text as needed.', annotations: untrusted,
			inputSchema: object( { network: choice( [ 'meetup', 'facebook', 'instagram', 'linkedin', 'x', 'whatsapp' ], 'Target social network.' ), offset: integer( 'Character offset returned as next_offset; starts at zero.', 0 ) }, [ 'network' ] ) },
		{ name: 'initiate_image_selection', description: 'Focuses the existing image upload control for the user to choose a local file. Use when a speaker photo, sponsor logo or custom watermark is requested.',
			inputSchema: object( { target: choice( [ 'talk', 'sponsor', 'watermark' ], 'Image destination.' ), index: integer( 'Current one-based entry position, except for watermark.' ), expected_name: text( 'Current speaker or sponsor name; required except for watermark.', 60 ) }, [ 'target' ] ) },
	];

	function validate( value, schema ) {
		if ( schema.type === 'object' ) {
			if ( ! value || typeof value !== 'object' || Array.isArray( value ) ) { throw new Error( 'Supply an object.' ); }
			for ( const key of Object.keys( value ) ) {
				if ( ! Object.hasOwn( schema.properties, key ) ) { throw new Error( 'Unknown field; use the tool schema.' ); }
				validate( value[ key ], schema.properties[ key ] );
			}
			for ( const key of schema.required ) { if ( ! Object.hasOwn( value, key ) ) { throw new Error( `Supply ${ key }.` ); } }
		} else if ( schema.type === 'array' ) {
			if ( ! Array.isArray( value ) || value.length < schema.minItems || value.length > schema.maxItems ) { throw new Error( 'Supply a list within the documented size limits.' ); }
			value.forEach( ( item ) => validate( item, schema.items ) );
			if ( schema.uniqueItems && new Set( value ).size !== value.length ) { throw new Error( 'Remove duplicate entries.' ); }
		} else if ( schema.type === 'integer' ) {
			if ( ! Number.isSafeInteger( value ) || value < schema.minimum ) { throw new Error( 'Supply a valid nonnegative position or page number.' ); }
		} else if ( typeof value !== schema.type || ( schema.maxLength && value.length > schema.maxLength ) || ( schema.enum && ! schema.enum.includes( value ) ) ) {
			throw new Error( 'Invalid field value; use the documented type, choices and length limits.' );
		}
	}
	const normalize = ( value ) => value.normalize( 'NFD' ).replace( /[\u0300-\u036f]/g, '' ).trim().toLowerCase();
	function resolveName( value, items ) {
		const matches = items.filter( ( item ) => normalize( item.id ) === normalize( value ) || normalize( item.name ) === normalize( value ) );
		if ( matches.length !== 1 ) { throw new Error( 'Choice is unknown or ambiguous. Use list_artwork_options and select an exact ID.' ); }
		return matches[ 0 ].id;
	}
	function resolveDate( value, now = new Date() ) {
		if ( value === '' ) { return ''; }
		const phrase = normalize( value );
		let date = new Date( now.getFullYear(), now.getMonth(), now.getDate(), 12 );
		if ( [ 'today', 'hoje', 'hoy' ].includes( phrase ) ) { /* Today in the browser timezone. */
		} else if ( [ 'tomorrow', 'amanha', 'manana' ].includes( phrase ) ) { date.setDate( date.getDate() + 1 );
		} else if ( /^\d{4}-\d{2}-\d{2}$/.test( phrase ) ) {
			const [ year, month, day ] = phrase.split( '-' ).map( Number );
			date = new Date( year, month - 1, day, 12 );
			if ( date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ) { throw new Error( 'Invalid calendar date. Ask for a valid exact date.' ); }
		} else {
			const weekdays = [ [ 'sunday', 'domingo' ], [ 'monday', 'segunda', 'segunda-feira', 'lunes' ], [ 'tuesday', 'terca', 'terca-feira', 'martes' ], [ 'wednesday', 'quarta', 'quarta-feira', 'miercoles' ], [ 'thursday', 'quinta', 'quinta-feira', 'jueves' ], [ 'friday', 'sexta', 'sexta-feira', 'viernes' ], [ 'saturday', 'sabado' ] ];
			const dayName = phrase.replace( /^(next |proxima |proximo |el proximo |el |na |no )/, '' );
			const day = weekdays.findIndex( ( names ) => names.includes( dayName ) );
			if ( day < 0 ) { throw new Error( 'Date phrase is ambiguous or unsupported. Ask for the exact calendar date (YYYY-MM-DD).' ); }
			date.setDate( date.getDate() + ( ( day - date.getDay() + 7 ) % 7 || 7 ) );
		}
		return `${ date.getFullYear() }-${ String( date.getMonth() + 1 ).padStart( 2, '0' ) }-${ String( date.getDate() ).padStart( 2, '0' ) }`;
	}
	// One item per page bounds ordinary results. Long individual values have explicit continuation.
	function paginate( items, pageNumber = 1, offset = 0 ) {
		const result = { page: pageNumber, page_size: 1, total_count: items.length, total_pages: items.length, items: items.slice( pageNumber - 1, pageNumber ) };
		if ( JSON.stringify( result ).length <= 1500 && ! offset ) { return result; }
		const { items: selected, ...metadata } = result;
		return chunk( JSON.stringify( selected[ 0 ] || null ), offset, { ...metadata, encoding: 'json' } );
	}

	function chunk( textValue, offset, extra = {} ) {
		if ( offset > textValue.length ) { throw new Error( 'Offset exceeds text length; restart at zero.' ); }
		let end = Math.min( textValue.length, offset + 900 );
		let result;
		do {
			result = { ...extra, text: textValue.slice( offset, end ), total_length: textValue.length, next_offset: end < textValue.length ? end : null };
			if ( JSON.stringify( result ).length <= 1500 ) { return result; }
			end--;
		} while ( end > offset );
		throw new Error( 'Result metadata is too large.' );
	}
	function checkSignal( signal ) {
		if ( signal && signal.aborted ) { const error = new Error( 'Execution cancelled. Read the draft before retrying edits.' ); error.code = 'CANCELLED'; throw error; }
	}

	function createTools( app ) {
		const catalogs = () => ( {
			cities: app.config.cities.map( ( item ) => ( { id: item.id, name: item.name } ) ),
			formats: app.config.formats.map( ( item ) => ( { id: item.id, name: item.label, width: item.width, height: item.height } ) ),
			landmarks: Object.entries( app.config.landmarks ).map( ( [ id, item ] ) => ( { id, name: item.name } ) ),
		} );
		const listKey = ( kind ) => kind === 'talk' ? 'talks' : 'sponsors';
		function targetItem( state, kind, index, expectedName ) {
			const item = state[ listKey( kind ) ][ index - 1 ];
			if ( ! item || expectedName === undefined || ( kind === 'talk' ? item.speaker : item.name ) !== expectedName ) { throw new Error( 'Entry changed or is missing. Read the current list and use its index and exact name.' ); }
			return item;
		}
		const handlers = {
			list_artwork_options: ( args ) => paginate( catalogs()[ args.kind ].filter( ( item ) => ! args.query || normalize( item.name ).includes( normalize( args.query ) ) ), args.page, args.offset ),
			read_artwork: ( args ) => {
				const state = app.getState();
				if ( [ 'talks', 'sponsors' ].includes( args.section ) ) {
					return paginate( state[ args.section ].map( ( item, index ) => ( { index: index + 1, ...( args.section === 'talks' ? { title: item.title, speaker: item.speaker } : { name: item.name } ), has_image: !! ( item.photo || item.logo ) } ) ), args.page, args.offset );
				}
				const keys = args.section === 'event' ? Object.keys( definitions[ 2 ].inputSchema.properties ) : [ 'theme', 'format', 'landmark', 'titleWeight' ];
				return paginate( keys.map( ( key ) => ( { field: key, value: key === 'city' ? app.cityName() : state[ key ] } ) ), args.page, args.offset );
			},
			update_event: async ( args, signal ) => {
				if ( ! Object.keys( args ).length ) { throw new Error( 'Supply at least one event detail.' ); }
				const fields = { ...args };
				if ( fields.date !== undefined ) { fields.date = resolveDate( fields.date ); }
				if ( fields.time && ! /^(?:[01]\d|2[0-3]):[0-5]\d$/.test( fields.time ) ) { throw new Error( 'Use a valid local time HH:MM.' ); }
				if ( fields.link ) { let url; try { url = new URL( fields.link ); } catch ( e ) { throw new Error( 'Supply a valid http or https registration URL.' ); } if ( ! [ 'http:', 'https:' ].includes( url.protocol ) ) { throw new Error( 'Use http or https for the registration URL.' ); } }
				checkSignal( signal );
				await app.updateEvent( fields );
				return { status: 'updated' };
			},
			edit_artwork_items: async ( args, signal ) => {
				const current = app.getState();
				const next = { talks: current.talks.map( ( item ) => ( { ...item } ) ), sponsors: current.sponsors.map( ( item ) => ( { ...item } ) ) };
				for ( const change of args.changes ) {
					const { kind, action, index, expected_name: expectedName } = change;
					const items = next[ listKey( kind ) ];
					const keys = kind === 'talk' ? [ 'title', 'speaker' ] : [ 'name' ];
					if ( ( kind === 'talk' && change.name !== undefined ) || ( kind === 'sponsor' && ( change.title !== undefined || change.speaker !== undefined ) ) ) { throw new Error( 'Use fields belonging to the selected entry type.' ); }
					if ( action === 'add' ) {
						if ( ! keys.every( ( key ) => typeof change[ key ] === 'string' && change[ key ].trim() ) ) { throw new Error( 'Supply a talk title and speaker, or a sponsor name.' ); }
						items.push( Object.fromEntries( [ ...keys.map( ( key ) => [ key, change[ key ] ] ), [ kind === 'talk' ? 'photo' : 'logo', '' ] ] ) );
					} else {
						const item = targetItem( next, kind, index, expectedName );
						if ( action === 'update' ) { if ( ! keys.some( ( key ) => change[ key ] !== undefined ) ) { throw new Error( 'Supply a field to update.' ); } keys.forEach( ( key ) => { if ( change[ key ] !== undefined ) { item[ key ] = change[ key ]; } } ); }
						if ( action === 'remove' ) { items.splice( index - 1, 1 ); }
						if ( action === 'move' ) { if ( ! change.position || change.position > items.length ) { throw new Error( 'Supply a destination within the current list.' ); } items.splice( change.position - 1, 0, items.splice( index - 1, 1 )[ 0 ] ); }
					}
				}
				checkSignal( signal );
				await app.updateItems( next );
				return { status: 'updated', changes: args.changes.length };
			},
			configure_artwork: async ( args, signal ) => {
				if ( ! Object.keys( args ).length ) { throw new Error( 'Supply at least one appearance choice.' ); }
				const fields = { ...args };
				if ( fields.format !== undefined ) { fields.format = resolveName( fields.format, catalogs().formats ); }
				if ( fields.landmark !== undefined ) {
					if ( fields.landmark === 'none' ) { fields.landmark = ''; } else if ( fields.landmark === 'custom' ) { if ( ! app.getState().watermark ) { throw new Error( 'Use initiate_image_selection for a custom watermark first.' ); } } else { fields.landmark = resolveName( fields.landmark, catalogs().landmarks ); }
				}
				checkSignal( signal ); await app.configure( fields ); return { status: 'updated' };
			},
			download_artwork: async ( args, signal ) => {
				if ( args.all && args.formats ) { throw new Error( 'Choose all formats or a specific list, not both.' ); }
				const ids = args.all ? app.config.formats.map( ( item ) => item.id ) : args.formats ? args.formats.map( ( name ) => resolveName( name, catalogs().formats ) ) : [ app.getState().format ];
				let count = 0;
				try {
					for ( const id of new Set( ids ) ) { checkSignal( signal ); await app.download( id, signal ); count++; if ( count < ids.length ) { await new Promise( ( resolve ) => setTimeout( resolve, 500 ) ); } }
				} catch ( error ) { return { error: 'Download interrupted. Check browser downloads before retrying.', code: signal && signal.aborted ? 'CANCELLED' : 'DOWNLOAD_FAILED', retryable: true, requested_count: count }; }
				return { status: 'download_requested', count };
			},
			read_announcement: ( args ) => {
				const item = app.announcements().find( ( entry ) => entry.id === args.network );
				if ( ! item ) { throw new Error( 'Announcement unavailable. Reload the generator and try again.' ); }
				const state = app.getState();
				const missing = [ 'date', 'time', 'link', ...( state.mode === 'presencial' ? [ 'venue' ] : [] ) ].filter( ( key ) => ! state[ key ].trim() );
				return chunk( item.text, args.offset || 0, { network: item.id, missing_fields: missing, has_placeholders: item.missing } );
			},
			initiate_image_selection: async ( args ) => {
				if ( args.target !== 'watermark' ) { targetItem( app.getState(), args.target, args.index, args.expected_name ); }
				await app.focusImage( args.target, args.index );
				return { status: 'requires_user_action', instruction: 'Activate the focused upload button and choose a local image file.' };
			},
		};
		let running = false;
		return definitions.map( ( definition ) => ( { ...definition, async execute( args, options = {} ) {
			if ( running ) { return { error: 'Another artwork tool is running. Wait for it to finish.', code: 'BUSY', retryable: true }; }
			running = true;
			try {
				validate( args, definition.inputSchema ); checkSignal( options.signal );
				const result = await handlers[ definition.name ]( args, options.signal );
				if ( JSON.stringify( result ).length > 1500 ) { return { error: 'Draft entry exceeds the response budget. Shorten it in the form before reading it.', code: 'RESULT_TOO_LARGE', retryable: false }; }
				return result;
			} catch ( error ) { return { error: error.message.slice( 0, 300 ), code: error.code || 'INVALID_INPUT', retryable: false }; } finally { running = false; }
		} } ) );
	}

	async function register( app ) {
		if ( ! document.modelContext || typeof document.modelContext.registerTool !== 'function' ) { return; }
		const controller = new AbortController();
		try {
			for ( const tool of createTools( app ) ) { await document.modelContext.registerTool( tool, { signal: controller.signal } ); }
		} catch ( error ) { controller.abort(); return; }
		window.addEventListener( 'pagehide', ( event ) => { if ( ! event.persisted ) { controller.abort(); } }, { once: false } );
	}
	window.WPBRArtesWebMCP = { register, definitions, createTools, resolveDate };
} )();
