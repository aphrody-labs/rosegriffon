// SPDX-License-Identifier: Apache-2.0
//! Platform-neutral half of the Steam refresh-token lifecycle.
//!
//! Steam has no identity federation for CM client logins: the only durable credential is the
//! refresh token issued once by an interactive `BeginAuthSessionViaCredentials` + poll flow.
//! This module owns the pure parts of keeping that token alive:
//!
//! - [`TokenClaims`]: unverified JWT payload decoding (account steamid, expiry) so `auth status`
//!   can report an expiry date without ever printing the token.
//! - [`encode_generate_for_app`] / [`decode_generate_for_app`]: the wire format of
//!   `Authentication.GenerateAccessTokenForApp#1` with `renewal_type = Allow`, which returns a new
//!   access token and, when Steam decides to rotate, a new refresh token.
//! - [`rotation`]: the decision of whether the response carries a rotated refresh token that must
//!   be written back to the canonical store.
//!
//! Nothing here formats a token into a string meant for output; [`redact`] is the only display
//! form.

/// Service method name of the renewal call.
pub const GENERATE_FOR_APP_METHOD: &str = "Authentication.GenerateAccessTokenForApp#1";

/// `ETokenRenewalType::k_ETokenRenewalType_Allow`.
pub const RENEWAL_ALLOW: u64 = 1;

/// Claims read from a Steam refresh token (JWT). The signature is not verified: the values only
/// drive local reporting and renewal timing, Steam remains the authority.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct TokenClaims {
    /// `sub`: the 64-bit steamid of the account.
    pub steam_id: Option<u64>,
    /// `exp`: Unix seconds.
    pub expires_at: Option<u64>,
    /// `iat`: Unix seconds.
    pub issued_at: Option<u64>,
}

impl TokenClaims {
    /// Decodes the payload segment of `jwt`. Returns `None` when the value is not a JWT.
    pub fn parse(jwt: &str) -> Option<Self> {
        let mut parts = jwt.split('.');
        let (_header, payload, _sig) = (parts.next()?, parts.next()?, parts.next()?);
        let bytes = base64url_decode(payload)?;
        let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
        let num = |key: &str| -> Option<u64> {
            match value.get(key)? {
                serde_json::Value::Number(n) => n.as_u64(),
                serde_json::Value::String(s) => s.parse().ok(),
                _ => None,
            }
        };
        Some(Self {
            steam_id: num("sub"),
            expires_at: num("exp"),
            issued_at: num("iat"),
        })
    }

    /// `true` when the token is expired at `now` (Unix seconds).
    pub fn is_expired(&self, now: u64) -> bool {
        self.expires_at.is_some_and(|exp| exp <= now)
    }
}

/// Display form of a secret: length only, never a prefix or suffix.
pub fn redact(secret: &str) -> String {
    format!("<redacted:{} bytes>", secret.len())
}

/// Formats Unix seconds as an ISO-8601 UTC date-time (`YYYY-MM-DDTHH:MM:SSZ`).
pub fn format_unix_utc(secs: u64) -> String {
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // Civil-from-days (Howard Hinnant), valid for the whole u64 range we care about.
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mo = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mo <= 2 { y + 1 } else { y };
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

/// Encodes `CAuthentication_AccessToken_GenerateForApp_Request`.
pub fn encode_generate_for_app(refresh_token: &str, steam_id: u64, renewal_type: u64) -> Vec<u8> {
    let mut out = Vec::with_capacity(refresh_token.len() + 16);
    // field 1, wire type 2 (length-delimited)
    out.push(0x0a);
    put_varint(&mut out, refresh_token.len() as u64);
    out.extend_from_slice(refresh_token.as_bytes());
    // field 2, wire type 1 (fixed64)
    out.push(0x11);
    out.extend_from_slice(&steam_id.to_le_bytes());
    // field 3, wire type 0 (varint)
    out.push(0x18);
    put_varint(&mut out, renewal_type);
    out
}

/// Decoded `CAuthentication_AccessToken_GenerateForApp_Response`.
#[derive(Clone, Default, Eq, PartialEq)]
pub struct GenerateForAppResponse {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

impl std::fmt::Debug for GenerateForAppResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GenerateForAppResponse")
            .field("access_token", &self.access_token.as_deref().map(redact))
            .field("refresh_token", &self.refresh_token.as_deref().map(redact))
            .finish()
    }
}

/// Decodes the response body; unknown fields are skipped.
pub fn decode_generate_for_app(mut buf: &[u8]) -> Option<GenerateForAppResponse> {
    let mut out = GenerateForAppResponse::default();
    while !buf.is_empty() {
        let key = take_varint(&mut buf)?;
        let (field, wire) = (key >> 3, key & 7);
        match wire {
            0 => {
                take_varint(&mut buf)?;
            }
            1 => buf = buf.get(8..)?,
            2 => {
                let len = usize::try_from(take_varint(&mut buf)?).ok()?;
                let bytes = buf.get(..len)?;
                buf = &buf[len..];
                let text = std::str::from_utf8(bytes).ok()?.to_owned();
                match field {
                    1 => out.access_token = Some(text),
                    2 => out.refresh_token = Some(text),
                    _ => {}
                }
            }
            5 => buf = buf.get(4..)?,
            _ => return None,
        }
    }
    Some(out)
}

/// Returns the rotated refresh token when the renewal response carries one that differs from
/// `current`; `None` means the stored token stays valid as is.
pub fn rotation<'a>(current: &str, response: &'a GenerateForAppResponse) -> Option<&'a str> {
    response
        .refresh_token
        .as_deref()
        .filter(|t| !t.is_empty() && *t != current)
}

fn put_varint(out: &mut Vec<u8>, mut v: u64) {
    while v >= 0x80 {
        out.push((v as u8) | 0x80);
        v >>= 7;
    }
    out.push(v as u8);
}

fn take_varint(buf: &mut &[u8]) -> Option<u64> {
    let mut v = 0u64;
    for shift in (0..64).step_by(7) {
        let (&b, rest) = buf.split_first()?;
        *buf = rest;
        v |= u64::from(b & 0x7f) << shift;
        if b & 0x80 == 0 {
            return Some(v);
        }
    }
    None
}

fn base64url_decode(input: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut acc = 0u32;
    let mut bits = 0u32;
    for c in input.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'-' | b'+' => 62,
            b'_' | b'/' => 63,
            b'=' => break,
            _ => return None,
        };
        acc = (acc << 6) | u32::from(v);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn b64url(bytes: &[u8]) -> String {
        const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let mut s = String::new();
        for chunk in bytes.chunks(3) {
            let n = chunk
                .iter()
                .enumerate()
                .fold(0u32, |a, (i, &b)| a | (u32::from(b) << (16 - 8 * i)));
            for i in 0..=chunk.len() {
                s.push(T[((n >> (18 - 6 * i)) & 63) as usize] as char);
            }
        }
        s
    }

    fn fake_jwt(payload: &str) -> String {
        format!(
            "{}.{}.sig",
            b64url(br#"{"alg":"EdDSA"}"#),
            b64url(payload.as_bytes())
        )
    }

    #[test]
    fn claims_from_jwt() {
        let jwt = fake_jwt(r#"{"sub":"76561190000000001","exp":1893456000,"iat":1700000000}"#);
        let c = TokenClaims::parse(&jwt).expect("jwt");
        assert_eq!(c.steam_id, Some(76_561_190_000_000_001));
        assert_eq!(c.expires_at, Some(1_893_456_000));
        assert!(!c.is_expired(1_800_000_000));
        assert!(c.is_expired(1_893_456_000));
        assert_eq!(format_unix_utc(1_893_456_000), "2030-01-01T00:00:00Z");
    }

    #[test]
    fn claims_reject_non_jwt() {
        assert_eq!(TokenClaims::parse("not-a-token"), None);
    }

    #[test]
    fn request_round_trip_fields() {
        let body = encode_generate_for_app("abc", 7, RENEWAL_ALLOW);
        assert_eq!(&body[..5], &[0x0a, 3, b'a', b'b', b'c']);
        assert_eq!(body[5], 0x11);
        assert_eq!(&body[6..14], &7u64.to_le_bytes());
        assert_eq!(&body[14..], &[0x18, 1]);
    }

    /// Mocked CM response: access token, rotated refresh token and an unknown varint field.
    #[test]
    fn decode_mocked_rotation_response() {
        let mut body = vec![
            0x0a, 2, b'A', b'T', 0x12, 3, b'n', b'e', b'w', 0x18, 0x96, 0x01,
        ];
        body.extend_from_slice(&[0x21, 0, 0, 0, 0, 0, 0, 0, 0]);
        let r = decode_generate_for_app(&body).expect("decode");
        assert_eq!(r.access_token.as_deref(), Some("AT"));
        assert_eq!(rotation("old", &r), Some("new"));
        assert_eq!(rotation("new", &r), None);
        assert!(!format!("{r:?}").contains("new"));
    }

    #[test]
    fn no_rotation_without_refresh_field() {
        let r = decode_generate_for_app(&[0x0a, 1, b'x']).expect("decode");
        assert_eq!(rotation("old", &r), None);
        assert!(decode_generate_for_app(&[0x0a, 9, b'x']).is_none());
    }
}
