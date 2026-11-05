<?php
/**
 * Plugin Name:       Meetup Artwork Generator
 * Description:       Standardized artwork and announcement texts for WordPress community meetups (Meetup.com, Facebook, Instagram, LinkedIn, X and WhatsApp). On activation, the generator becomes the site front page.
 * Version:           1.4.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Caio Ferreira and the WordPress Brasil community
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       meetup-artwork-generator
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WPBR_ARTES_VERSION', '1.4.0' );
define( 'WPBR_ARTES_FILE', __FILE__ );
define( 'WPBR_ARTES_URL', plugin_dir_url( __FILE__ ) );
define( 'WPBR_ARTES_PATH', plugin_dir_path( __FILE__ ) );
define( 'WPBR_ARTES_SLUG', 'meetup-artwork-generator' );
define( 'WPBR_ARTES_SHORTCODE', 'meetup_artwork_generator' );

require_once WPBR_ARTES_PATH . 'includes/i18n.php';
require_once WPBR_ARTES_PATH . 'includes/cities.php';
require_once WPBR_ARTES_PATH . 'includes/generator.php';

/**
 * On activation, creates the generator page and makes it the front page.
 * The previous front page settings are kept so deactivation can restore them.
 */
function wpbr_artes_activate() {
	$page_id = (int) get_option( 'wpbr_artes_page_id' );

	if ( ! $page_id || ! get_post( $page_id ) || 'trash' === get_post_status( $page_id ) ) {
		$page_id = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_title'   => __( 'Meetup Artwork Generator', 'meetup-artwork-generator' ),
				'post_name'    => 'gerador-de-artes',
				'post_content' => '<!-- wp:shortcode -->[' . WPBR_ARTES_SHORTCODE . ']<!-- /wp:shortcode -->',
			)
		);
		if ( ! $page_id || is_wp_error( $page_id ) ) {
			return;
		}
		update_option( 'wpbr_artes_page_id', $page_id );
	}

	if ( (int) get_option( 'page_on_front' ) !== $page_id || 'page' !== get_option( 'show_on_front' ) ) {
		update_option(
			'wpbr_artes_previous_front',
			array(
				'show_on_front' => get_option( 'show_on_front' ),
				'page_on_front' => (int) get_option( 'page_on_front' ),
			)
		);
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $page_id );
	}
}
register_activation_hook( __FILE__, 'wpbr_artes_activate' );

/**
 * Restores the previous front page if the generator is still the front page.
 */
function wpbr_artes_deactivate() {
	$page_id  = (int) get_option( 'wpbr_artes_page_id' );
	$previous = get_option( 'wpbr_artes_previous_front' );

	if ( $page_id && (int) get_option( 'page_on_front' ) === $page_id && is_array( $previous ) ) {
		update_option( 'show_on_front', $previous['show_on_front'] );
		update_option( 'page_on_front', $previous['page_on_front'] );
	}
	delete_option( 'wpbr_artes_previous_front' );
}
register_deactivation_hook( __FILE__, 'wpbr_artes_deactivate' );

/**
 * Whether the current request shows the generator page created by the plugin.
 *
 * @return bool
 */
function wpbr_artes_is_generator_page() {
	$page_id = (int) get_option( 'wpbr_artes_page_id' );
	return $page_id && is_page( $page_id );
}

/**
 * Whether the current request shows the generator (its page or the shortcode).
 *
 * @return bool
 */
function wpbr_artes_is_generator_view() {
	if ( wpbr_artes_is_generator_page() ) {
		return true;
	}
	$post = get_post();
	return is_singular() && $post && has_shortcode( $post->post_content, WPBR_ARTES_SHORTCODE );
}

/**
 * The generator page uses its own full-width template, independent of the theme.
 *
 * @param string $template Template chosen by WordPress.
 * @return string
 */
function wpbr_artes_template_include( $template ) {
	if ( wpbr_artes_is_generator_page() ) {
		return WPBR_ARTES_PATH . 'templates/generator-page.php';
	}
	return $template;
}
add_filter( 'template_include', 'wpbr_artes_template_include', 99 );

/**
 * Loads the assets wherever the generator is shown.
 */
function wpbr_artes_maybe_enqueue() {
	if ( wpbr_artes_is_generator_view() ) {
		wpbr_artes_enqueue_assets();
	}
}
add_action( 'wp_enqueue_scripts', 'wpbr_artes_maybe_enqueue' );

/**
 * Enqueues styles, scripts and the community data.
 */
function wpbr_artes_enqueue_assets() {
	if ( wp_script_is( 'wpbr-artes-app', 'enqueued' ) ) {
		return;
	}

	wp_enqueue_style( 'dashicons' );
	wp_enqueue_style( 'wpbr-artes-fonts', WPBR_ARTES_URL . 'assets/css/fonts.css', array(), WPBR_ARTES_VERSION );
	wp_enqueue_style( 'wpbr-artes', WPBR_ARTES_URL . 'assets/css/generator.css', array( 'wpbr-artes-fonts', 'dashicons' ), WPBR_ARTES_VERSION );

	wp_enqueue_script( 'wpbr-artes-renderer', WPBR_ARTES_URL . 'assets/js/renderer.js', array(), WPBR_ARTES_VERSION, true );
	wp_enqueue_script( 'wpbr-artes-copy', WPBR_ARTES_URL . 'assets/js/copy.js', array(), WPBR_ARTES_VERSION, true );
	wp_enqueue_script( 'wpbr-artes-webmcp', WPBR_ARTES_URL . 'assets/js/webmcp.js', array(), WPBR_ARTES_VERSION, true );
	wp_enqueue_script( 'wpbr-artes-app', WPBR_ARTES_URL . 'assets/js/app.js', array( 'wpbr-artes-renderer', 'wpbr-artes-copy', 'wpbr-artes-webmcp' ), WPBR_ARTES_VERSION, true );

	wp_add_inline_script(
		'wpbr-artes-renderer',
		'window.wpbrArtes = ' . wp_json_encode(
			array(
				'cities'    => wpbr_artes_get_cities(),
				'landmarks' => wpbr_artes_get_landmarks(),
				'formats'   => wpbr_artes_get_formats(),
				'locale'    => str_replace( '_', '-', wpbr_artes_current_language() ),
				'i18n'      => wpbr_artes_js_strings(),
			)
		) . ';',
		'before'
	);
}

/**
 * Shortcode: [meetup_artwork_generator]. Works on any page or post.
 *
 * @return string
 */
function wpbr_artes_shortcode() {
	wpbr_artes_enqueue_assets();
	ob_start();
	wpbr_artes_render_generator();
	return ob_get_clean();
}
add_shortcode( WPBR_ARTES_SHORTCODE, 'wpbr_artes_shortcode' );

/**
 * Adds an "Open generator" link on the Plugins screen.
 *
 * @param array $links Action links.
 * @return array
 */
function wpbr_artes_action_links( $links ) {
	$page_id = (int) get_option( 'wpbr_artes_page_id' );
	if ( $page_id && get_post( $page_id ) ) {
		array_unshift( $links, '<a href="' . esc_url( get_permalink( $page_id ) ) . '">' . esc_html__( 'Open generator', 'meetup-artwork-generator' ) . '</a>' );
	}
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'wpbr_artes_action_links' );

/**
 * Output formats. Filterable so communities can add new sizes.
 *
 * @return array
 */
function wpbr_artes_get_formats() {
	$formats = array(
		array(
			'id'     => 'meetup',
			'label'  => __( 'Meetup.com', 'meetup-artwork-generator' ),
			'hint'   => __( 'Event cover', 'meetup-artwork-generator' ),
			'width'  => 1920,
			'height' => 1080,
		),
		array(
			'id'     => 'facebook-evento',
			'label'  => __( 'Facebook', 'meetup-artwork-generator' ),
			'hint'   => __( 'Event cover', 'meetup-artwork-generator' ),
			'width'  => 1920,
			'height' => 1005,
		),
		array(
			'id'     => 'link',
			'label'  => __( 'Facebook / LinkedIn', 'meetup-artwork-generator' ),
			'hint'   => __( 'Link post', 'meetup-artwork-generator' ),
			'width'  => 1200,
			'height' => 630,
		),
		array(
			'id'     => 'x',
			'label'  => __( 'X (Twitter)', 'meetup-artwork-generator' ),
			'hint'   => __( 'Image post', 'meetup-artwork-generator' ),
			'width'  => 1600,
			'height' => 900,
		),
		array(
			'id'     => 'quadrado',
			'label'  => __( 'Square', 'meetup-artwork-generator' ),
			'hint'   => __( 'Instagram, Facebook and WhatsApp', 'meetup-artwork-generator' ),
			'width'  => 1080,
			'height' => 1080,
		),
		array(
			'id'     => 'retrato',
			'label'  => __( 'Portrait', 'meetup-artwork-generator' ),
			'hint'   => __( 'Instagram and Facebook feed', 'meetup-artwork-generator' ),
			'width'  => 1080,
			'height' => 1350,
		),
		array(
			'id'          => 'status',
			'label'       => __( 'Status / Stories', 'meetup-artwork-generator' ),
			'hint'        => __( 'WhatsApp and Instagram', 'meetup-artwork-generator' ),
			'width'       => 1080,
			'height'      => 1920,
			'safe_top'    => 250,
			'safe_bottom' => 250,
		),
	);

	return apply_filters( 'wpbr_artes_formats', $formats );
}
