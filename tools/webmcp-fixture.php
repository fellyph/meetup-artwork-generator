<?php
/** Test-only WordPress shims: render the real generator and configuration. */
define( 'ABSPATH', __DIR__ );
function plugin_dir_url( $file ) { return '/'; }
function plugin_dir_path( $file ) { return dirname( $file ) . '/'; }
function plugin_basename( $file ) { return basename( $file ); }
function add_action( ...$args ) {}
function add_filter( ...$args ) {}
function add_shortcode( ...$args ) {}
function register_activation_hook( ...$args ) {}
function register_deactivation_hook( ...$args ) {}
function wp_parse_args( $args, $defaults ) { return array_merge( $defaults, $args ); }
function apply_filters( $name, $value ) { return $value; }
function __( $text, ...$args ) { return $text; }
function _x( $text, ...$args ) { return $text; }
function esc_html__( $text, ...$args ) { return htmlspecialchars( $text, ENT_QUOTES ); }
function esc_attr__( $text, ...$args ) { return htmlspecialchars( $text, ENT_QUOTES ); }
function esc_html_e( $text, ...$args ) { echo esc_html__( $text ); }
function esc_attr_e( $text, ...$args ) { echo esc_attr__( $text ); }
function esc_html_x( $text, ...$args ) { return esc_html__( $text ); }
function esc_html( $text ) { return esc_html__( $text ); }
function esc_attr( $text ) { return esc_attr__( $text ); }
function esc_url( $text ) { return esc_attr__( $text ); }
require dirname( __DIR__ ) . '/meetup-artwork-generator.php';
?><!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/fonts.css"><link rel="stylesheet" href="/assets/css/generator.css"></head><body>
<?php wpbr_artes_render_generator(); ?>
<script>window.wpbrArtes = <?php echo json_encode( array( 'cities' => wpbr_artes_get_cities(), 'landmarks' => wpbr_artes_get_landmarks(), 'formats' => wpbr_artes_get_formats(), 'locale' => 'en-US', 'i18n' => wpbr_artes_js_strings() ) ); ?>;</script>
<script src="/assets/js/renderer.js"></script><script src="/assets/js/copy.js"></script><script src="/assets/js/webmcp.js"></script><script src="/assets/js/app.js"></script></body></html>
