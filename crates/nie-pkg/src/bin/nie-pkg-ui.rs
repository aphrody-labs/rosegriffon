fn main() {
    let reg = nie_pkg::Registry::embedded();
    println!("{}", nie_pkg::ui::render_html(reg));
}
