fn main() {
    #[cfg(any(feature = "desktop", feature = "web"))]
    dioxus::launch(nie_pkg_ui::app);
    #[cfg(not(any(feature = "desktop", feature = "web")))]
    print!("{}", nie_pkg_ui::render_html(nie_pkg::Registry::embedded()));
}
