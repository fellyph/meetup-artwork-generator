/**
 * Generator screen: keeps the form state, saves it in this browser,
 * renders the live preview, downloads the PNG files and fills the
 * announcement texts.
 */
( function () {
	'use strict';

	const config = window.wpbrArtes || { cities: [], landmarks: {}, formats: [], i18n: {}, locale: 'pt-BR' };
	const Renderer = window.WPBRArtesRenderer;
	const Copy = window.WPBRArtesCopy;
	const LOCALE = config.locale || 'pt-BR';
	const STORAGE_KEY = 'wpbr-artes-state-v1';
	const OTHER = 'outra';
	const CUSTOM = 'custom';
	const $ = ( selector, root ) => ( root || document ).querySelector( selector );

	/**
	 * Translated string with sprintf-style placeholders (%s, %d, %1$s).
	 */
	function t( key, ...args ) {
		let index = 0;
		return String( ( config.i18n && config.i18n[ key ] ) || key ).replace( /%(?:(\d+)\$)?[sd]/g, ( match, position ) => {
			const value = position ? args[ position - 1 ] : args[ index++ ];
			return value === undefined ? '' : String( value );
		} );
	}

	// The language selector reloads the page in the chosen language.
	const languageSelect = $( '#wpbr-language' );
	if ( languageSelect ) {
		languageSelect.addEventListener( 'change', () => languageSelect.form.submit() );
	}

	const form = $( '#wpbr-artes-form' );
	if ( ! form || ! Renderer ) {
		return;
	}

	// Fields live in the form and in the preview card (artwork colors).
	const root = form.closest( '.wpbr-artes' ) || form;
	const canvas = $( '#wpbr-canvas' );
	const sizeLabel = $( '#wpbr-size' );

	/* ------------------------------------------------------------------ */
	/* State                                                               */
	/* ------------------------------------------------------------------ */

	function defaults() {
		return {
			city: 'belo-horizonte',
			cityName: '',
			landmark: 'igreja-pampulha',
			watermark: '',
			mode: 'presencial',
			edition: '',
			header: '',
			subheader: '',
			date: '',
			time: '',
			tz: 'BRT',
			title: '',
			titleWeight: '400',
			description: '',
			highlight: t( 'defaultHighlight' ),
			venue: '',
			showVenue: false,
			link: '',
			talks: [ { title: t( 'defaultTalk' ), speaker: t( 'defaultSpeaker' ), photo: '' } ],
			sponsors: [],
			theme: 'light',
			format: config.formats.length ? config.formats[ 0 ].id : '',
			auto: { header: true, subheader: true },
		};
	}

	function load() {
		try {
			const saved = JSON.parse( window.localStorage.getItem( STORAGE_KEY ) || 'null' );
			if ( saved && typeof saved === 'object' ) {
				// Earlier versions filled the title with the community name.
				if ( saved.auto && saved.auto.title ) {
					saved.title = '';
				}
				// The header used to hold "Meetup Presencial"; it is now generated again.
				return Object.assign( defaults(), saved, { auto: { header: true, subheader: true } } );
			}
		} catch ( e ) {}
		return defaults();
	}

	let state = load();
	let saveTimer = null;

	function save() {
		clearTimeout( saveTimer );
		saveTimer = setTimeout( () => {
			try {
				window.localStorage.setItem( STORAGE_KEY, JSON.stringify( state ) );
			} catch ( e ) {
				// Storage full: keep the texts, drop the images.
				try {
					const light = Object.assign( {}, state, {
						watermark: '',
						talks: state.talks.map( ( item ) => Object.assign( {}, item, { photo: '' } ) ),
						sponsors: state.sponsors.map( ( item ) => Object.assign( {}, item, { logo: '' } ) ),
					} );
					window.localStorage.setItem( STORAGE_KEY, JSON.stringify( light ) );
				} catch ( e2 ) {}
			}
		}, 300 );
	}

	const findCity = ( id ) => config.cities.find( ( c ) => c.id === id );
	const normalize = ( text ) => String( text || '' ).normalize( 'NFD' ).replace( /[̀-ͯ]/g, '' ).trim().toLowerCase();
	const cityLabel = ( city ) => ( city.online ? t( 'onlineCommunity', city.name ) : `${ city.name } – ${ city.uf }` );

	function cityName() {
		if ( state.city === OTHER ) {
			return state.cityName.trim();
		}
		const city = findCity( state.city );
		return city ? city.name : '';
	}

	/** Community name in the current language. */
	function communityName() {
		const city = findCity( state.city );
		if ( city ) {
			return LOCALE.startsWith( 'pt' ) ? city.group : t( 'communityOf', city.name );
		}
		return state.cityName.trim() ? t( 'communityOf', state.cityName.trim() ) : t( 'community' );
	}

	/** "#18 Presencial": edition number (optional) and event type. */
	function autoSubheader() {
		const edition = String( state.edition || '' ).replace( /^#/, '' ).trim();
		const mode = state.mode === 'online' ? t( 'modeOnline' ) : t( 'modeInPerson' );
		return edition ? `#${ edition } ${ mode }` : mode;
	}

	const AUTO = { header: communityName, subheader: autoSubheader };

	function applyAuto() {
		Object.keys( AUTO ).forEach( ( field ) => {
			if ( state.auto[ field ] || ! state[ field ] ) {
				state[ field ] = AUTO[ field ]();
				state.auto[ field ] = true;
			}
		} );
	}

	/** Picks the city typed in the search field; unknown names become "other". */
	function chooseCity( query ) {
		const wanted = normalize( query );
		const match = config.cities.find( ( c ) => normalize( cityLabel( c ) ) === wanted || normalize( c.name ) === wanted );
		const previous = state.city;
		if ( match ) {
			state.city = match.id;
			state.cityName = '';
		} else {
			state.city = OTHER;
			state.cityName = query.trim();
		}
		if ( state.city !== previous ) {
			if ( state.landmark !== CUSTOM ) {
				state.landmark = match ? match.landmark : 'cidade';
			}
			state.mode = match && match.online ? 'online' : 'presencial';
			if ( match ) {
				state.tz = match.tz;
			}
		}
	}

	/* ------------------------------------------------------------------ */
	/* Static fields                                                       */
	/* ------------------------------------------------------------------ */

	function option( value, label ) {
		const el = document.createElement( 'option' );
		el.value = value;
		el.textContent = label;
		return el;
	}

	function buildSelects() {
		const list = $( '#wpbr-city-list' );
		config.cities.forEach( ( city ) => list.appendChild( option( cityLabel( city ), '' ) ) );

		const landmarkSelect = $( '#wpbr-landmark' );
		landmarkSelect.appendChild( option( '', t( 'none' ) ) );
		landmarkSelect.appendChild( option( CUSTOM, t( 'customImage' ) ) );
		Object.keys( config.landmarks ).forEach( ( id ) => {
			landmarkSelect.appendChild( option( id, config.landmarks[ id ].name ) );
		} );
	}

	function fieldValue( field ) {
		if ( field === 'cityQuery' ) {
			const city = findCity( state.city );
			return city ? cityLabel( city ) : state.cityName;
		}
		return state[ field ];
	}

	function syncFields( force = false ) {
		root.querySelectorAll( '[data-field]' ).forEach( ( el ) => {
			const value = fieldValue( el.dataset.field );
			if ( el.type === 'radio' ) {
				el.checked = String( value ) === el.value;
			} else if ( el.type === 'checkbox' ) {
				el.checked = !! value;
			} else if ( ( force || el !== document.activeElement ) && el.value !== String( value ?? '' ) ) {
				el.value = value ?? '';
			}
		} );
		root.querySelectorAll( '[data-show-when]' ).forEach( ( el ) => {
			const [ key, value ] = el.dataset.showWhen.split( '=' );
			el.hidden = String( state[ key ] ) !== value;
		} );
	}

	root.addEventListener( 'input', ( event ) => {
		const el = event.target;
		const field = el.dataset.field;
		if ( ! field || ( el.type === 'radio' && ! el.checked ) ) {
			return;
		}
		if ( field === 'cityQuery' ) {
			chooseCity( el.value );
		} else {
			state[ field ] = el.type === 'checkbox' ? el.checked : el.value;
		}
		if ( AUTO[ field ] ) {
			state.auto[ field ] = el.value.trim() === '';
		} else {
			applyAuto();
			syncFields();
		}
		changed();
	} );

	// Show the full community label once the city field loses focus.
	$( '#wpbr-city' ).addEventListener( 'change', () => syncFields() );
	$( '#wpbr-city' ).addEventListener( 'blur', () => syncFields() );

	/* ------------------------------------------------------------------ */
	/* Images                                                              */
	/* ------------------------------------------------------------------ */

	/**
	 * Reads an uploaded image and shrinks it so it fits in browser storage.
	 * Logos and watermarks keep transparency (PNG); photos become JPEG.
	 */
	function readImage( file, maxSize, keepAlpha ) {
		return new Promise( ( resolve ) => {
			const reader = new FileReader();
			reader.onload = () => {
				const img = new Image();
				img.onload = () => {
					const scale = Math.min( 1, maxSize / Math.max( img.naturalWidth, img.naturalHeight ) );
					const c = document.createElement( 'canvas' );
					c.width = Math.max( 1, Math.round( img.naturalWidth * scale ) );
					c.height = Math.max( 1, Math.round( img.naturalHeight * scale ) );
					c.getContext( '2d' ).drawImage( img, 0, 0, c.width, c.height );
					resolve( keepAlpha ? c.toDataURL( 'image/png' ) : c.toDataURL( 'image/jpeg', 0.88 ) );
				};
				img.onerror = () => {
					window.alert( t( 'imageError' ) );
					resolve( '' );
				};
				img.src = reader.result;
			};
			reader.onerror = () => resolve( '' );
			reader.readAsDataURL( file );
		} );
	}

	function showPreview( button, src ) {
		const img = $( 'img', button );
		img.hidden = ! src;
		button.classList.toggle( 'has-image', !! src );
		if ( src ) {
			img.src = src;
		} else {
			img.removeAttribute( 'src' );
		}
	}

	const watermarkButton = $( '#wpbr-watermark' );
	const watermarkFile = $( '#wpbr-watermark-file' );
	watermarkButton.addEventListener( 'click', () => watermarkFile.click() );
	watermarkFile.addEventListener( 'change', () => {
		const chosen = watermarkFile.files && watermarkFile.files[ 0 ];
		if ( chosen ) {
			readImage( chosen, 1200, true ).then( ( src ) => {
				if ( src ) {
					state.watermark = src;
					showPreview( watermarkButton, src );
					changed();
				}
			} );
		}
		watermarkFile.value = '';
	} );

	/* ------------------------------------------------------------------ */
	/* Repeatable lists (talks and sponsors)                               */
	/* ------------------------------------------------------------------ */

	const lists = {
		talks: {
			root: $( '#wpbr-talks' ),
			template: $( '#wpbr-talk-template' ),
			image: 'photo',
			label: ( i ) => t( 'talkLabel', i + 1 ),
			empty: () => ( { title: '', speaker: '', photo: '' } ),
			maxSize: 600,
		},
		sponsors: {
			root: $( '#wpbr-sponsors' ),
			template: $( '#wpbr-sponsor-template' ),
			image: 'logo',
			label: ( i ) => t( 'sponsorLabel', i + 1 ),
			empty: () => ( { name: '', logo: '' } ),
			maxSize: 800,
		},
	};

	function renderList( key ) {
		const list = lists[ key ];
		list.root.innerHTML = '';
		state[ key ].forEach( ( item, index ) => {
			const node = list.template.content.firstElementChild.cloneNode( true );
			$( '.wpbr-item__label', node ).textContent = list.label( index );
			node.querySelectorAll( '[data-key]' ).forEach( ( input ) => {
				input.value = item[ input.dataset.key ] || '';
				input.addEventListener( 'input', () => {
					item[ input.dataset.key ] = input.value;
					changed();
				} );
			} );

			const button = $( '.wpbr-photo__button', node );
			const remove = $( '.wpbr-photo__remove', node );
			const file = $( 'input[type="file"]', node );
			const showImage = () => {
				showPreview( button, item[ list.image ] );
				remove.hidden = ! item[ list.image ];
			};
			showImage();

			file.addEventListener( 'change', () => {
				const chosen = file.files && file.files[ 0 ];
				if ( ! chosen ) {
					return;
				}
				readImage( chosen, list.maxSize, key === 'sponsors' ).then( ( src ) => {
					if ( src ) {
						item[ list.image ] = src;
						showImage();
						changed();
					}
				} );
				file.value = '';
			} );

			node.addEventListener( 'click', ( event ) => {
				const action = event.target.closest( '[data-action]' );
				if ( ! action ) {
					return;
				}
				const items = state[ key ];
				switch ( action.dataset.action ) {
					case 'photo':
						file.click();
						return;
					case 'clear-photo':
						item[ list.image ] = '';
						showImage();
						changed();
						return;
					case 'remove':
						items.splice( index, 1 );
						break;
					case 'up':
						if ( index > 0 ) {
							items.splice( index - 1, 0, items.splice( index, 1 )[ 0 ] );
						}
						break;
					case 'down':
						if ( index < items.length - 1 ) {
							items.splice( index + 1, 0, items.splice( index, 1 )[ 0 ] );
						}
						break;
				}
				renderList( key );
				changed();
			} );

			list.root.appendChild( node );
		} );
	}

	function addItem( key ) {
		state[ key ].push( lists[ key ].empty() );
		renderList( key );
		changed();
		const inputs = lists[ key ].root.querySelectorAll( '.wpbr-item:last-child input[type="text"]' );
		if ( inputs.length ) {
			inputs[ 0 ].focus();
		}
	}

	$( '#wpbr-add-talk' ).addEventListener( 'click', () => addItem( 'talks' ) );
	$( '#wpbr-add-sponsor' ).addEventListener( 'click', () => addItem( 'sponsors' ) );

	/* ------------------------------------------------------------------ */
	/* Formats                                                             */
	/* ------------------------------------------------------------------ */

	const formatsRoot = $( '#wpbr-formats' );

	function currentFormat() {
		return config.formats.find( ( f ) => f.id === state.format ) || config.formats[ 0 ];
	}

	function buildFormats() {
		config.formats.forEach( ( format ) => {
			const button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'wpbr-format';
			button.setAttribute( 'role', 'radio' );
			button.dataset.format = format.id;

			const ratio = format.width / format.height;
			const shape = document.createElement( 'span' );
			shape.className = 'wpbr-format__shape';
			const box = document.createElement( 'i' );
			box.style.width = `${ Math.round( ratio >= 1 ? 24 : 24 * ratio ) }px`;
			box.style.height = `${ Math.round( ratio >= 1 ? 24 / ratio : 24 ) }px`;
			shape.appendChild( box );

			const text = document.createElement( 'span' );
			text.className = 'wpbr-format__text';
			const strong = document.createElement( 'strong' );
			strong.textContent = format.label;
			const small = document.createElement( 'small' );
			small.textContent = format.hint;
			text.append( strong, small );

			button.append( shape, text );
			button.addEventListener( 'click', () => {
				state.format = format.id;
				syncFormats();
				changed();
			} );
			formatsRoot.appendChild( button );
		} );
		syncFormats();
	}

	function syncFormats() {
		formatsRoot.querySelectorAll( '.wpbr-format' ).forEach( ( button ) => {
			const active = button.dataset.format === state.format;
			button.setAttribute( 'aria-checked', active ? 'true' : 'false' );
			button.tabIndex = active ? 0 : -1;
		} );
	}

	formatsRoot.addEventListener( 'keydown', ( event ) => {
		const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
		if ( ! keys[ event.key ] ) {
			return;
		}
		event.preventDefault();
		const ids = config.formats.map( ( f ) => f.id );
		const next = ids[ ( ids.indexOf( state.format ) + keys[ event.key ] + ids.length ) % ids.length ];
		state.format = next;
		syncFormats();
		formatsRoot.querySelector( `[data-format="${ next }"]` ).focus();
		changed();
	} );

	/* ------------------------------------------------------------------ */
	/* Rendering and download                                              */
	/* ------------------------------------------------------------------ */

	const fontsReady = Renderer.ready();

	/** "09.NOV" in the selected language. */
	function dateText( value ) {
		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec( value || '' );
		if ( ! match ) {
			return '';
		}
		const date = new Date( +match[ 1 ], +match[ 2 ] - 1, +match[ 3 ] );
		const month = new Intl.DateTimeFormat( LOCALE, { month: 'short' } ).format( date );
		return `${ match[ 3 ] }.${ normalize( month ).replace( /[^a-z]/g, '' ).slice( 0, 3 ).toUpperCase() }`;
	}

	function timeText( value, tz ) {
		const match = /^(\d{2}):(\d{2})/.exec( value || '' );
		return match ? `${ match[ 1 ] }:${ match[ 2 ] }${ tz ? ' ' + tz : '' }` : '';
	}

	function landmarkSource() {
		if ( state.landmark === CUSTOM ) {
			return state.watermark;
		}
		const landmark = config.landmarks[ state.landmark ];
		return landmark ? landmark.url : '';
	}

	async function renderData() {
		const [ landmarkImg, photos, logos ] = await Promise.all( [
			Renderer.loadImage( landmarkSource() ),
			Promise.all( state.talks.map( ( item ) => Renderer.loadImage( item.photo ) ) ),
			Promise.all( state.sponsors.map( ( item ) => Renderer.loadImage( item.logo ) ) ),
		] );
		return {
			theme: state.theme,
			header: state.header.trim(),
			subheader: state.subheader.trim(),
			dateText: dateText( state.date ),
			timeText: timeText( state.time, state.tz.trim().toUpperCase() ),
			title: state.title.trim() || t( 'titlePlaceholder' ),
			titleWeight: state.titleWeight,
			description: state.description.trim(),
			venue: state.mode === 'presencial' && state.showVenue ? state.venue.trim() : '',
			highlight: state.highlight.trim(),
			talks: state.talks
				.map( ( item, i ) => ( { title: item.title.trim(), speaker: item.speaker.trim(), photo: photos[ i ] } ) )
				.filter( ( item ) => item.title || item.speaker || item.photo ),
			sponsors: state.sponsors
				.map( ( item, i ) => ( { name: item.name.trim(), logo: logos[ i ] } ) )
				.filter( ( item ) => item.name || item.logo ),
			landmark: landmarkImg,
		};
	}

	let frame = null;
	let renderToken = 0;

	let previewPromise = null;
	function refreshPreview() {
		clearTimeout( frame );
		frame = null;
		if ( previewPromise ) { return previewPromise; }
		previewPromise = ( async () => {
			let token;
			let data;
			do {
				token = renderToken;
				await fontsReady;
				data = await renderData();
			} while ( token !== renderToken );
			const format = currentFormat();
			const result = Renderer.render( canvas, data, format );
			sizeLabel.textContent = `${ format.label } · ${ format.width } × ${ format.height } px` + ( result.overflow ? ' — ' + t( 'tooLong' ) : '' );
		} )().finally( () => { previewPromise = null; } );
		return previewPromise;
	}

	function changed() {
		save();
		renderCopy();
		++renderToken;
		if ( frame ) {
			return;
		}
		frame = window.setTimeout( () => {
			refreshPreview().catch( () => { /* A later edit can retry rendering. */ } );
		}, 16 );
	}

	function slug( text ) {
		return normalize( text ).replace( /[^a-z0-9]+/g, '-' ).replace( /^-|-$/g, '' );
	}

	async function download( format, signal ) {
		await fontsReady;
		const data = await renderData();
		const out = document.createElement( 'canvas' );
		Renderer.render( out, data, format );
		const blob = await new Promise( ( resolve ) => out.toBlob( resolve, 'image/png' ) );
		if ( ! blob ) {
			throw new Error( 'PNG generation failed.' );
		}
		if ( signal && signal.aborted ) {
			throw new Error( 'Download cancelled.' );
		}
		const name = [ 'meetup-wp', slug( cityName() ), state.date, format.id, state.theme === 'dark' ? 'dark' : '' ].filter( Boolean ).join( '-' );
		const link = document.createElement( 'a' );
		link.href = URL.createObjectURL( blob );
		link.download = `${ name }.png`;
		document.body.appendChild( link );
		link.click();
		link.remove();
		setTimeout( () => URL.revokeObjectURL( link.href ), 4000 );
	}

	function busy( button, promise ) {
		button.disabled = true;
		button.setAttribute( 'aria-busy', 'true' );
		return promise.finally( () => {
			button.disabled = false;
			button.removeAttribute( 'aria-busy' );
		} );
	}

	$( '#wpbr-download' ).addEventListener( 'click', ( event ) => {
		busy( event.currentTarget, download( currentFormat() ) );
	} );

	$( '#wpbr-download-all' ).addEventListener( 'click', ( event ) => {
		const run = async () => {
			for ( const format of config.formats ) {
				await download( format );
				// Browsers may block several downloads fired at the same instant.
				await new Promise( ( resolve ) => setTimeout( resolve, 500 ) );
			}
		};
		busy( event.currentTarget, run() );
	} );

	$( '#wpbr-reset' ).addEventListener( 'click', () => {
		if ( ! window.confirm( t( 'resetConfirm' ) ) ) {
			return;
		}
		try {
			window.localStorage.removeItem( STORAGE_KEY );
		} catch ( e ) {}
		state = defaults();
		init();
	} );

	/* ------------------------------------------------------------------ */
	/* Announcement texts                                                  */
	/* ------------------------------------------------------------------ */

	const copyRoot = $( '#wpbr-copy-list' );
	const copyTemplate = $( '#wpbr-copy-template' );
	const copyNodes = {};

	function copyInfo() {
		return {
			group: communityName(),
			city: state.city === 'brasil' ? '' : cityName(),
			online: state.mode === 'online',
			tz: state.tz.trim().toUpperCase(),
			title: state.title.trim(),
			date: state.date,
			time: state.time,
			venue: state.venue.trim(),
			link: state.link.trim(),
			description: state.description.trim(),
			highlight: state.highlight.trim(),
			talks: state.talks
				.map( ( item ) => ( { title: item.title.trim(), speaker: item.speaker.trim() } ) )
				.filter( ( item ) => item.title || item.speaker ),
			sponsors: state.sponsors.map( ( item ) => item.name.trim() ).filter( Boolean ),
		};
	}

	/**
	 * Copies text to the clipboard. Falls back to a hidden textarea where
	 * the Clipboard API is not available (sites without HTTPS).
	 */
	async function writeClipboard( text ) {
		try {
			await navigator.clipboard.writeText( text );
			return true;
		} catch ( e ) {
			const area = document.createElement( 'textarea' );
			area.value = text;
			area.setAttribute( 'readonly', '' );
			area.style.position = 'fixed';
			area.style.opacity = '0';
			document.body.appendChild( area );
			area.select();
			let ok = false;
			try {
				ok = document.execCommand( 'copy' );
			} catch ( e2 ) {}
			area.remove();
			return ok;
		}
	}

	function copyNode( item ) {
		const node = copyTemplate.content.firstElementChild.cloneNode( true );
		$( '.wpbr-copy__icon', node ).classList.add( item.icon );
		$( '.wpbr-copy__name', node ).textContent = item.label;
		$( '.wpbr-copy__hint', node ).textContent = item.hint;
		$( '.wpbr-copy__tip', node ).textContent = item.tip;

		const area = $( '.wpbr-copy__text', node );
		area.setAttribute( 'aria-label', t( 'textFor', item.label ) );
		const status = $( '.wpbr-copy__status', node );
		let timer = null;

		$( '[data-action="copy"]', node ).addEventListener( 'click', async () => {
			const ok = await writeClipboard( area.value );
			clearTimeout( timer );
			if ( ok ) {
				status.textContent = t( 'copied' );
				timer = setTimeout( () => ( status.textContent = '' ), 3000 );
			} else {
				status.textContent = t( 'copyFailed' );
				area.focus();
				area.select();
			}
		} );
		return node;
	}

	function renderCopy() {
		if ( ! Copy || ! copyRoot || ! copyTemplate ) {
			return;
		}
		const number = ( value ) => value.toLocaleString( LOCALE );
		Copy.build( copyInfo(), t, LOCALE ).forEach( ( item ) => {
			if ( ! copyNodes[ item.id ] ) {
				copyNodes[ item.id ] = copyNode( item );
				copyRoot.appendChild( copyNodes[ item.id ] );
			}
			const node = copyNodes[ item.id ];
			const area = $( '.wpbr-copy__text', node );
			if ( area.value !== item.text ) {
				area.value = item.text;
				area.rows = Math.min( 26, item.text.split( '\n' ).length + 1 );
			}
			const count = $( '.wpbr-copy__count', node );
			count.textContent = item.limit ? t( 'charsOf', number( item.length ), number( item.limit ) ) : t( 'chars', number( item.length ) );
			count.classList.toggle( 'is-over', !! item.limit && item.length > item.limit );
			$( '.wpbr-copy__badge', node ).hidden = ! item.missing;
		} );
	}

	/* ------------------------------------------------------------------ */
	/* Boot                                                                */
	/* ------------------------------------------------------------------ */

	function init() {
		if ( state.city !== OTHER && ! findCity( state.city ) ) {
			state.city = config.cities.length ? config.cities[ 0 ].id : OTHER;
		}
		if ( ! config.formats.some( ( f ) => f.id === state.format ) ) {
			state.format = config.formats[ 0 ].id;
		}
		applyAuto();
		syncFields();
		syncFormats();
		showPreview( watermarkButton, state.watermark );
		renderList( 'talks' );
		renderList( 'sponsors' );
		changed();
	}

	buildSelects();
	buildFormats();
	init();

	if ( window.WPBRArtesWebMCP ) {
		const refreshAgentView = async () => {
			applyAuto();
			syncFields( true );
			syncFormats();
			changed();
			try {
				await refreshPreview();
			} catch ( cause ) {
				const error = new Error( 'Draft updated, but preview rendering failed. Review the form and reload before retrying.' );
				error.code = 'PREVIEW_FAILED';
				throw error;
			}
		};
		window.WPBRArtesWebMCP.register( {
			config,
			getState: () => state,
			cityName,
			updateEvent: async ( fields ) => {
				if ( fields.city !== undefined ) { chooseCity( fields.city ); }
				for ( const [ key, value ] of Object.entries( fields ) ) {
					if ( key === 'city' ) { continue; }
					state[ key ] = value;
					if ( AUTO[ key ] ) { state.auto[ key ] = value.trim() === ''; }
				}
				await refreshAgentView();
			},
			updateItems: async ( items ) => {
				state.talks = items.talks;
				state.sponsors = items.sponsors;
				renderList( 'talks' );
				renderList( 'sponsors' );
				await refreshAgentView();
			},
			configure: async ( fields ) => {
				Object.assign( state, fields );
				await refreshAgentView();
			},
			download: ( id, signal ) => {
				const format = config.formats.find( ( item ) => item.id === id );
				if ( ! format ) { throw new Error( 'Format unavailable.' ); }
				return download( format, signal );
			},
			announcements: () => Copy ? Copy.build( copyInfo(), t, LOCALE ) : [],
			focusImage: async ( target, index ) => {
				const button = target === 'watermark' ? watermarkButton : lists[ target === 'talk' ? 'talks' : 'sponsors' ].root.children[ index - 1 ].querySelector( '.wpbr-photo__button' );
				if ( target === 'watermark' ) {
					state.landmark = CUSTOM;
					await refreshAgentView();
				}
				button.focus();
				button.scrollIntoView( { block: 'center' } );
			},
		} );
	}
} )();
