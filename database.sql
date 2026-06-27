-- Create Database
CREATE DATABASE IF NOT EXISTS `entry_editor_db`;
USE `entry_editor_db`;

-- Drop table if exists
DROP TABLE IF EXISTS `desktop_entries`;

-- Create Table for Desktop Entries
CREATE TABLE `desktop_entries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `filename` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `generic_name` VARCHAR(255) DEFAULT NULL,
  `exec_cmd` VARCHAR(512) NOT NULL,
  `icon` VARCHAR(255) DEFAULT NULL,
  `comment` TEXT DEFAULT NULL,
  `type` VARCHAR(50) DEFAULT 'Application',
  `terminal` TINYINT(1) DEFAULT 0,
  `categories` VARCHAR(512) DEFAULT NULL,
  `startup_notify` TINYINT(1) DEFAULT 0,
  `path_dir` VARCHAR(512) DEFAULT NULL,
  `mime_type` TEXT DEFAULT NULL,
  `unsupported_fields` TEXT DEFAULT NULL,
  `other_sections` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some initial sample entries in case the user wants to see them immediately
INSERT INTO `desktop_entries` (`filename`, `name`, `generic_name`, `exec_cmd`, `icon`, `comment`, `type`, `terminal`, `categories`, `startup_notify`, `path_dir`, `mime_type`, `unsupported_fields`, `other_sections`) VALUES
('alacritty-sample.desktop', 'Alacritty Sample', 'Terminal', 'alacritty', 'Alacritty', 'A fast, cross-platform, OpenGL terminal emulator', 'Application', 0, 'System;TerminalEmulator;', 1, NULL, NULL, '{}', '[]'),
('firefox-sample.desktop', 'Firefox Web Browser Sample', 'Web Browser', 'firefox %u', 'firefox', 'Browse the World Wide Web', 'Application', 0, 'Network;WebBrowser;', 1, NULL, NULL, '{}', '[]');
