//! Game library screen of the NIE app laid out with `taffy` (`TaffyTree` + CSS Grid/Flexbox).

use crate::{Feature, Game, Registry, Support};
use std::fmt::Write as _;
use taffy::prelude::*;

fn support_class(s: Support) -> &'static str {
    match s {
        Support::Full => "cell full",
        Support::Partial => "cell partial",
        Support::Planned => "cell planned",
        Support::None => "cell none",
    }
}

fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

/// Computed `taffy` geometry for a game row in the library matrix.
#[derive(Debug, Clone, PartialEq)]
pub struct LibraryRowLayout {
    pub game_id: String,
    pub y: f32,
    pub height: f32,
    pub cell_xs: Vec<f32>,
    pub cell_widths: Vec<f32>,
}

/// Computed `taffy` layout for the entire NIE game library screen.
#[derive(Debug, Clone, PartialEq)]
pub struct LibraryLayout {
    pub total_width: f32,
    pub total_height: f32,
    pub rows: Vec<LibraryRowLayout>,
}

/// Computes the CSS Grid / Flexbox layout of the game library matrix using `taffy::TaffyTree`.
#[must_use]
pub fn compute_library_layout(registry: &Registry, width: f32) -> LibraryLayout {
    let mut tree: TaffyTree<()> = TaffyTree::new();
    let cols = 2 + Feature::ALL.len();
    let row_height = 36.0;

    let title_node = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(32.0),
            },
            ..Default::default()
        })
        .expect("taffy leaf");
    let count_node = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(20.0),
            },
            ..Default::default()
        })
        .expect("taffy leaf");

    let mut grid_children = Vec::with_capacity((1 + registry.games.len()) * cols);
    for _ in 0..cols {
        grid_children.push(
            tree.new_leaf(Style {
                size: Size {
                    width: auto(),
                    height: length(row_height),
                },
                ..Default::default()
            })
            .expect("taffy header cell"),
        );
    }

    let mut row_cells: Vec<(&Game, Vec<NodeId>)> = Vec::with_capacity(registry.games.len());
    for g in &registry.games {
        let mut cells = Vec::with_capacity(cols);
        for _ in 0..cols {
            let cell = tree
                .new_leaf(Style {
                    size: Size {
                        width: auto(),
                        height: length(row_height),
                    },
                    ..Default::default()
                })
                .expect("taffy cell");
            grid_children.push(cell);
            cells.push(cell);
        }
        row_cells.push((g, cells));
    }

    let mut template_cols = vec![fr(2.0), fr(1.4)];
    template_cols.extend((0..Feature::ALL.len()).map(|_| fr(1.0)));

    let grid = tree
        .new_with_children(
            Style {
                display: Display::Grid,
                grid_template_columns: template_cols,
                gap: Size {
                    width: length(4.0),
                    height: length(4.0),
                },
                size: Size {
                    width: percent(1.0),
                    height: auto(),
                },
                ..Default::default()
            },
            &grid_children,
        )
        .expect("taffy grid");

    let root = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Column,
                gap: Size {
                    width: length(0.0),
                    height: length(8.0),
                },
                padding: Rect {
                    left: length(16.0),
                    right: length(16.0),
                    top: length(16.0),
                    bottom: length(16.0),
                },
                size: Size {
                    width: length(width.max(320.0)),
                    height: auto(),
                },
                ..Default::default()
            },
            &[title_node, count_node, grid],
        )
        .expect("taffy root");

    tree.compute_layout(
        root,
        Size {
            width: AvailableSpace::Definite(width.max(320.0)),
            height: AvailableSpace::MaxContent,
        },
    )
    .expect("taffy compute_layout");

    let root_layout = tree.layout(root).expect("root layout");
    let grid_loc = tree.layout(grid).expect("grid layout").location;

    let rows = row_cells
        .into_iter()
        .map(|(g, cells)| {
            let first = tree.layout(cells[0]).expect("cell layout");
            let mut cell_xs = Vec::with_capacity(cells.len());
            let mut cell_widths = Vec::with_capacity(cells.len());
            for c in cells {
                let l = tree.layout(c).expect("cell layout");
                cell_xs.push(grid_loc.x + l.location.x);
                cell_widths.push(l.size.width);
            }
            LibraryRowLayout {
                game_id: g.id.clone(),
                y: grid_loc.y + first.location.y,
                height: first.size.height,
                cell_xs,
                cell_widths,
            }
        })
        .collect();

    LibraryLayout {
        total_width: root_layout.size.width,
        total_height: root_layout.size.height,
        rows,
    }
}

/// Static HTML of the library with `taffy`-computed layout bounds.
#[must_use]
pub fn render_html(registry: Registry) -> String {
    let layout = compute_library_layout(&registry, 1280.0);
    let mut out = String::new();
    let _ = write!(
        out,
        "<main class=\"nie-library\" data-taffy-width=\"{:.0}\" data-taffy-height=\"{:.0}\">",
        layout.total_width, layout.total_height
    );
    out.push_str("<h1>Game library</h1>");
    let _ = write!(out, "<p class=\"count\">{} games</p>", registry.games.len());
    out.push_str("<table><thead><tr><th>Game</th><th>Platforms</th>");
    for f in Feature::ALL {
        let _ = write!(out, "<th>{}</th>", escape_html(f.as_str()));
    }
    out.push_str("</tr></thead><tbody>");
    for (g, row_layout) in registry.games.iter().zip(layout.rows.iter()) {
        let platforms: Vec<&'static str> = g.platforms().map(|p| p.as_str()).collect();
        let _ = write!(
            out,
            "<tr data-game=\"{}\" data-y=\"{:.0}\"><th scope=\"row\">{}</th><td class=\"platforms\">{}</td>",
            escape_html(&g.id),
            row_layout.y,
            escape_html(&g.title),
            escape_html(&platforms.join(" "))
        );
        for f in Feature::ALL {
            let s = g.support(f);
            let _ = write!(
                out,
                "<td class=\"{}\" title=\"{}\">{}</td>",
                support_class(s),
                escape_html(f.as_str()),
                escape_html(s.as_str())
            );
        }
        out.push_str("</tr>");
    }
    out.push_str("</tbody></table></main>");
    out
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

    #[test]
    fn taffy_grid_computes_non_overlapping_rows_for_every_game() {
        let reg = Registry::embedded();
        let layout = compute_library_layout(&reg, 1280.0);
        assert_eq!(layout.rows.len(), reg.games.len());
        assert!(layout.total_height > 100.0);
        for pair in layout.rows.windows(2) {
            assert!(pair[1].y >= pair[0].y + pair[0].height);
        }
    }
}
