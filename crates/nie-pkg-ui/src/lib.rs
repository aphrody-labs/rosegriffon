//! Game library screen of the NIE app, written once in Dioxus and rendered
//! through SSR (tests, static export), desktop (webview) or web (wasm).
//! dioxus-native (Blitz) is blocked: blitz-dom 0.2 pins image =0.25.6, the workspace uses 0.25.10.

use dioxus::prelude::*;
use nie_pkg::{Feature, Game, Registry, Support};

fn support_class(s: Support) -> &'static str {
    match s {
        Support::Full => "cell full",
        Support::Partial => "cell partial",
        Support::Planned => "cell planned",
        Support::None => "cell none",
    }
}

#[component]
fn GameRow(game: Game) -> Element {
    let platforms: Vec<&'static str> = game.platforms().map(|p| p.as_str()).collect();
    rsx! {
        tr { "data-game": "{game.id}",
            th { scope: "row", "{game.title}" }
            td { class: "platforms", {platforms.join(" ")} }
            for f in Feature::ALL {
                td { class: support_class(game.support(f)), title: f.as_str(), {game.support(f).as_str()} }
            }
        }
    }
}

/// Library + feature matrix for a registry.
#[component]
pub fn Library(registry: Registry) -> Element {
    rsx! {
        main { class: "nie-library",
            h1 { "Game library" }
            p { class: "count", "{registry.games.len()} games" }
            table {
                thead {
                    tr {
                        th { "Game" }
                        th { "Platforms" }
                        for f in Feature::ALL {
                            th { {f.as_str()} }
                        }
                    }
                }
                tbody {
                    for g in registry.games.iter().cloned() {
                        GameRow { key: "{g.id}", game: g }
                    }
                }
            }
        }
    }
}

/// Root component used by every renderer.
pub fn app() -> Element {
    rsx! { Library { registry: Registry::embedded() } }
}

/// Static HTML of the library (SSR).
pub fn render_html(registry: Registry) -> String {
    dioxus_ssr::render_element(rsx! { Library { registry } })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ssr_lists_every_game_with_matrix_cells() {
        let reg = Registry::embedded();
        let html = render_html(reg.clone());
        assert!(html.contains("Game library"));
        for g in &reg.games {
            assert!(
                html.contains(&format!("data-game=\"{}\"", g.id)),
                "{}",
                g.id
            );
        }
        let cells = html.matches("class=\"cell ").count();
        assert_eq!(cells, reg.games.len() * Feature::ALL.len());
    }
}
