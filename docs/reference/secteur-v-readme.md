---
title: "Secteur V E-Sport"
description: "Présentation de la plateforme compétitive Secteur V ELO."
scope: ["inazuma-eleven", "esport", "secteur-v", "ref"]
status: "stable"
---

# ⚡⚽ Secteur V ⚽⚡

<div align="center">
  <img src="assets/img/banner.png" alt="Secteur V Banner" width="100%">
</div>

[![Static Badge](https://img.shields.io/badge/lang-en-0000FF)](README.md) [![Static Badge](https://img.shields.io/badge/PHP-8.2-777BB4?logo=php&logoColor=white)](https://www.php.net/) [![Static Badge](https://img.shields.io/badge/Database-MySQL-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/) [![Static Badge](https://img.shields.io/badge/License-AGPL%203.0-yellow)](LICENSE)

## 🌐 Online Access

**You can access the competitive platform directly from your browser:**

<h3 align="center">
🚀 OPEN BETA! Join Secteur V: <a href="https://secteur-v.letterk.me/?lang=en" target="_blank">https://secteur-v.letterk.me/?lang=en</a>
</h3>

---

**Secteur V** is the community and competitive platform dedicated to **Inazuma Eleven: Victory Road** players. It allows players to manage their profile, track their progress via a dynamic ELO ranking, and archive their match history. Designed to centralize competition, this project offers a seamless experience connected directly to Discord.

## Summary

The project addresses the need to structure the game's competitive scene. Rather than managing rankings manually and community by community, **Secteur V** automates score tracking, offers shareable public profiles, and secures player identity via OAuth2 authentication (Discord).

## Features

* **Discord Authentication:** Secure login via OAuth2, automatically retrieving the avatar and username.
* **ELO Ranking (Ladder):** Dynamic rank system calculated based on performance.
* **Player Profiles (Files):** Public page displaying stats, bio, current rank, and match history.
* **Account Management:** Interface to edit bio, contact information, or delete data (GDPR).

## Prerequisites & Installation

> 📝
> The project is hosted online at [https://secteur-v.letterk.me](https://secteur-v.letterk.me), no installation is required for players. If you wish to deploy your own instance, follow these steps.

### Installation Steps

1.  **Clone the repository:**
    Download the source code to your server or locally.

2.  **Server Configuration:**
    Ensure you have a compatible web server (Apache/Nginx) with **PHP 8.0+** and **MySQL**.

3.  **Database:**
    * Create a MySQL database.
    * Import the SQL structure (`users` table required).
    * Configure the `db.php` file with your credentials.

4.  **Discord Configuration:**
    * Create an application on the [Discord Developer Portal](https://discord.com/developers/applications).
    * Add your redirect URL (e.g., `https://your-website.com/discord_login.php`).
    * Fill in the `CLIENT_ID` and `CLIENT_SECRET` in `discord_login.php`.

## Usage Protocol

1.  **Registration:** Log in via the Discord button. An account is automatically created.
2.  **Customization:** Go to "Edit my file" to add a bio and customize your profile.
3.  **Competition:** You enter the match results, and your ELO updates automatically.
4.  **Sharing:** Share your profile URL (e.g., `secteur-v.letterk.me/profile?username=YourUsername`) with your friends.

> 💡
> **Tip:** The site is fully *Responsive*, so you can check your ranking from your mobile between two matches.

## Dependencies

This project relies on standard web technologies:

* **PHP 8:** Server-side language.
* **MySQL:** User and match data storage.
* **FontAwesome:** Interface icons.

## Licenses

**Artwork & Game:** Inazuma Eleven is the property of © LEVEL-5 Inc. This project is an unofficial community site.

**MIT License**

You are free to use, modify, distribute, and sell this software, provided that you include the original copyright notice and license in any copy or substantial portion of the software.

For more details, please see the [LICENSE](LICENSE) file.
