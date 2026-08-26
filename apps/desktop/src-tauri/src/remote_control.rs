//! Injects mouse and keyboard input from a remote participant.
//!
//! Nothing here runs unless the person sharing their screen has explicitly
//! granted control: the frontend flips `set_enabled` on when they accept and
//! off the moment they revoke, the share stops, or the controller leaves. The
//! flag is checked on every event so a stray message after a revoke does
//! nothing.

use std::sync::atomic::{AtomicBool, Ordering};

use enigo::{
    Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings,
};
use serde::Deserialize;

static ENABLED: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ControlEvent {
    /// Pointer position as a fraction of the shared screen, 0..1.
    Move { x: f64, y: f64 },
    Button { button: String, down: bool },
    Scroll { dx: f64, dy: f64 },
    /// A named key such as "Enter" or a single character.
    Key { key: String, down: bool },
    Text { text: String },
}

fn to_button(name: &str) -> Button {
    match name {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    }
}

/// Maps the browser's KeyboardEvent.key values onto enigo's keys.
fn to_key(name: &str) -> Option<Key> {
    let key = match name {
        "Enter" => Key::Return,
        "Backspace" => Key::Backspace,
        "Tab" => Key::Tab,
        "Escape" => Key::Escape,
        "Delete" => Key::Delete,
        "Home" => Key::Home,
        "End" => Key::End,
        "PageUp" => Key::PageUp,
        "PageDown" => Key::PageDown,
        "ArrowUp" => Key::UpArrow,
        "ArrowDown" => Key::DownArrow,
        "ArrowLeft" => Key::LeftArrow,
        "ArrowRight" => Key::RightArrow,
        "Shift" => Key::Shift,
        "Control" => Key::Control,
        "Alt" => Key::Alt,
        "Meta" => Key::Meta,
        "CapsLock" => Key::CapsLock,
        " " | "Spacebar" => Key::Space,
        "F1" => Key::F1,
        "F2" => Key::F2,
        "F3" => Key::F3,
        "F4" => Key::F4,
        "F5" => Key::F5,
        "F6" => Key::F6,
        "F7" => Key::F7,
        "F8" => Key::F8,
        "F9" => Key::F9,
        "F10" => Key::F10,
        "F11" => Key::F11,
        "F12" => Key::F12,
        other => {
            let mut chars = other.chars();
            let first = chars.next()?;
            // Anything longer than one character is a named key we do not map.
            if chars.next().is_some() {
                return None;
            }
            Key::Unicode(first)
        }
    };
    Some(key)
}

/// Turns control on or off. Called from the consent UI on the sharer's side.
#[tauri::command]
pub fn remote_control_set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
pub fn remote_control_enabled() -> bool {
    ENABLED.load(Ordering::SeqCst)
}

/// Applies a batch of events. Batching keeps pointer streams off the IPC
/// hot path — the frontend coalesces moves before sending.
#[tauri::command]
pub fn remote_control_input(events: Vec<ControlEvent>) -> Result<(), String> {
    if !ENABLED.load(Ordering::SeqCst) {
        return Ok(());
    }

    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let (width, height) = enigo.main_display().map_err(|e| e.to_string())?;

    for event in events {
        let result = match event {
            ControlEvent::Move { x, y } => {
                let px = (x.clamp(0.0, 1.0) * width as f64).round() as i32;
                let py = (y.clamp(0.0, 1.0) * height as f64).round() as i32;
                enigo.move_mouse(px, py, Coordinate::Abs)
            }
            ControlEvent::Button { button, down } => enigo.button(
                to_button(&button),
                if down { Direction::Press } else { Direction::Release },
            ),
            ControlEvent::Scroll { dx, dy } => {
                let mut outcome = Ok(());
                if dy != 0.0 {
                    outcome = enigo.scroll(dy.round() as i32, Axis::Vertical);
                }
                if outcome.is_ok() && dx != 0.0 {
                    outcome = enigo.scroll(dx.round() as i32, Axis::Horizontal);
                }
                outcome
            }
            ControlEvent::Key { key, down } => match to_key(&key) {
                Some(k) => enigo.key(k, if down { Direction::Press } else { Direction::Release }),
                None => Ok(()),
            },
            ControlEvent::Text { text } => enigo.text(&text),
        };
        if let Err(err) = result {
            return Err(err.to_string());
        }
    }

    Ok(())
}
